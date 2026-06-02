import { app, session } from 'electron';

/**
 * Hardened Electron security policy (mirrors the reference shell):
 * - contextIsolation on / nodeIntegration off (set per-window in window-manager)
 * - CSP limits sources to self + the local dev servers
 * - permission requests denied by default
 */
export function setupSecurity(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['clipboard-sanitized-write'].includes(permission));
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:* ws://localhost:*; " +
            "script-src 'self' 'unsafe-inline' http://localhost:*; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: http://localhost:*; " +
            "connect-src 'self' http://localhost:* ws://localhost:*;",
        ],
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.on('web-contents-created', (_e, contents) => {
      contents.on('console-message', (_ev, _level, message) => {
        if (message.includes('ERROR')) console.info(`[renderer] ${message}`);
      });
    });
  }
}
