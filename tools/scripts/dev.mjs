#!/usr/bin/env node
/**
 * Retail OS — dev orchestrator.
 *
 * 1. Kills any leftover process on port 4200 (Ctrl+C doesn't always propagate
 *    through pnpm to Vite on macOS, so stale processes survive across restarts).
 * 2. Runs `electron-rebuild` for better-sqlite3 (Electron ABI).
 * 3. Starts the React POS (Vite) on port 4200.
 * 4. Waits for the POS server, then launches the Electron shell.
 */
import { spawn, execSync } from 'node:child_process';
import process from 'node:process';

const POS_HOST = 'localhost';
const POS_PORT = 4200;
const standaloneArg = process.argv.find((arg) => arg.startsWith('--standalone='));
const standaloneAppId = standaloneArg ? standaloneArg.split('=')[1] : '';

// ─── Cleanup leftover process on port 4200 ───────────────────────────────────
try {
  const pids = execSync(`lsof -ti tcp:${POS_PORT} 2>/dev/null || true`).toString().trim();
  if (pids) {
    pids.split('\n').filter(Boolean).forEach((pid) => {
      try { process.kill(Number(pid), 'SIGKILL'); } catch {}
    });
    console.log(`[dev] killed leftover process(es) on port ${POS_PORT}:`, pids.replace(/\n/g, ' '));
    // Brief pause so the socket is released before Vite binds.
    execSync('sleep 0.5');
  }
} catch {}

// ─── Electron rebuild (main-process native ABI) ───────────────────────────────
console.log('[dev] rebuilding better-sqlite3 for Electron…');
try {
  execSync('pnpm exec electron-rebuild -f -w better-sqlite3', { stdio: 'inherit' });
} catch {
  console.warn('[dev] electron-rebuild failed — continuing anyway');
}

// ─── Child process registry ───────────────────────────────────────────────────
const children = [];

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited with code ${code}`);
    // Only shut down everything if it was an unexpected exit (not a clean 0).
    if (code !== 0) shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

function waitForPort(host, port, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const url = `http://${host}:${port}/`;
      fetch(url).then((res) => {
        if (res.ok) resolve();
        else throw new Error(`HTTP ${res.status}`);
      }).catch(() => {
        if (Date.now() - start > timeoutMs) reject(new Error('POS dev server timed out'));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ─── Start POS Vite dev server ────────────────────────────────────────────────
console.log(`[dev] starting POS (Vite) on port ${POS_PORT}…`);
run('pos', 'pnpm', ['dev:pos']);

// ─── Wait for POS, then launch Electron shell ────────────────────────────────
waitForPort(POS_HOST, POS_PORT)
  .then(() => {
    const label = standaloneAppId ? `standalone ${standaloneAppId}` : 'Electron shell';
    console.log(`[dev] POS is up — launching ${label}`);
    run(
      'shell',
      'pnpm',
      ['dev:shell'],
      standaloneAppId
        ? { RETAIL_START_APP: standaloneAppId, RETAIL_SKIP_LAUNCHER: 'true' }
        : {},
    );
  })
  .catch((err) => {
    console.error('[dev]', err.message);
    shutdown(1);
  });
