import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { BggEnrichmentWorker, isCircuitOpenError } from './worker.js';

const config = loadConfig();
const shutdown = new AbortController();
const worker = new BggEnrichmentWorker(config, shutdown.signal);

const server = createServer((request, response) => {
  if (request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }
  const circuitOpen = worker.status.state === 'circuit_open';
  response.writeHead(circuitOpen ? 503 : 200, { 'Content-Type': 'application/json' });
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

  const existingCircuit = await worker.initialize();
  if (existingCircuit) {
    console.error(`[bgg-enricher] outbound work remains halted: ${existingCircuit.reason}`);
    return;
  }

  try {
    await worker.run();
  } catch (error) {
    if (isCircuitOpenError(error)) {
      await worker.openCircuit(error.record);
      console.error(`[bgg-enricher] circuit opened: ${error.record.reason}`);
      return;
    }
    throw error;
  } finally {
    if (shutdown.signal.aborted) await worker.close();
  }
}

main().catch(async (error: unknown) => {
  console.error('[bgg-enricher] fatal:', error);
  process.exitCode = 1;
  shutdown.abort();
  server.close();
  await worker.close();
});
