'use client';

export function PrivacyPreferencesButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="footer-privacy-button"
      onClick={() => window.dispatchEvent(new Event('juegospedia:open-privacy'))}
    >
      {label}
    </button>
  );
}
