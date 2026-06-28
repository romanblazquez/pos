'use client';

import { useEffect, useRef } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export interface GoogleSignInButtonProps {
  app: 'marketplace' | 'admin';
  clientId: string | undefined;
  apiBase: string;
  onCredential: (credential: string, state: string) => void | Promise<void>;
  onError: (message: string) => void;
  theme?: 'outline' | 'filled_blue' | 'filled_black';
}

export function GoogleSignInButton({
  app, clientId, apiBase, onCredential, onError, theme = 'outline',
}: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const credentialHandler = useRef(onCredential);
  const errorHandler = useRef(onError);
  credentialHandler.current = onCredential;
  errorHandler.current = onError;

  useEffect(() => {
    if (!clientId || !container.current) return;
    const configuredClientId = clientId;
    let cancelled = false;

    async function initialize() {
      try {
        const challengeResponse = await fetch(`${apiBase}/api/v1/auth/google/challenge?app=${app}`, {
          credentials: 'include',
        });
        if (!challengeResponse.ok) throw new Error('Google login is not configured on the API');
        const challenge = await challengeResponse.json() as { nonce: string; state: string };

        for (let attempt = 0; attempt < 50 && !window.google; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (cancelled) return;
        if (!window.google || !container.current) throw new Error('Google Identity Services did not load');

        window.google.accounts.id.initialize({
          client_id: configuredClientId,
          nonce: challenge.nonce,
          cancel_on_tap_outside: true,
          callback: (response) => { void credentialHandler.current(response.credential, challenge.state); },
        });
        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme,
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          width: 320,
          locale: 'es',
        });
      } catch (error) {
        if (!cancelled) errorHandler.current(error instanceof Error ? error.message : 'Google login failed');
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, [apiBase, app, clientId, theme]);

  if (!clientId) return null;
  return <div ref={container} className="flex min-h-10 justify-center" />;
}
