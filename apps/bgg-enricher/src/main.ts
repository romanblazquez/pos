import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { BggEnrichmentWorker, isCircuitOpenError, sleep } from './worker.js';

const config = loadConfig();
const shutdown = new AbortController();
const worker = new BggEnrichmentWorker(config, shutdown.signal);

const server = createServer((request, response) => {
  if (request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }
  // An open circuit is the expected response to BGG rate-limiting us, not a
  // fault: the worker is alive and will retry half-open once the cooldown
  // elapses. Reporting 503 made a normal cooldown indistinguishable from a
  // genuinely broken enricher in `docker ps` and anything alerting on it.
  // Liveness is "the process is up and serving"; the cooldown remains
  // observable via `state` in the body below.
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(worker.status));
});

async function stop(signal: string): Promise<void> {
  console.log(`[bgg-enricher] received ${signal}`);
  shutdown.abort();
  server.close();
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

async function main(): Promise<void> {
  server.listen(config.healthPort, '0.0.0.0', () => {
    console.log(`[bgg-enricher] health endpoint listening on ${config.healthPort}`);
  });

  // Supervision loop: an open breaker parks the worker for a cooldown rather than
  // ending the process. BGG's 403s clear on their own, so retrying half-open is what
  // lets enrichment resume without someone noticing and deleting the state file.
  try {
    while (!shutdown.signal.aborted) {
      const existingCircuit = await worker.initialize();

      if (existingCircuit) {
        const waitMs = worker.circuitCooldownRemainingMs(existingCircuit);
        if (waitMs > 0) {
          console.error(
            `[bgg-enricher] circuit open (${existingCircuit.reason}); half-open retry in ${Math.round(waitMs / 60_000)} min`,
          );
          await sleep(waitMs, shutdown.signal);
          continue;
        }
        console.log('[bgg-enricher] circuit cooldown elapsed; attempting half-open retry');
        await worker.closeCircuit();
        continue;
      }

      try {
        await worker.run();
      } catch (error) {
        if (!isCircuitOpenError(error)) throw error;
        // Re-open and loop; the next pass reads the fresh openedAt and waits it out.
        await worker.openCircuit(error.record);
        console.error(`[bgg-enricher] circuit opened: ${error.record.reason}`);
      }
    }
  } finally {
    await worker.close();
  }
}

main().catch(async (error: unknown) => {
  console.error('[bgg-enricher] fatal:', error);
  process.exitCode = 1;
  shutdown.abort();
  server.close();
  await worker.close();
});
