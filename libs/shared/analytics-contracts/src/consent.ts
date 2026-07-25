// Consent model — the gate every other part of the analytics platform asks.
//
// This module is deliberately free of transport, storage and framework concerns
// so the browser SDK, the Next server, the Vite SPA and the Nest collector all
// evaluate consent with the same code. A disagreement between client and server
// about what was granted is the failure mode that quietly makes a platform
// non-compliant, so there is exactly one implementation.
//
// Nothing here talks to a CMP. A certified CMP is an *adapter* that produces a
// `ConsentState` (see `CmpAdapter` in `cmp.ts`); swapping vendors must never
// reach past that boundary.

/**
 * The consent categories Juegospedia asks about, each independently grantable.
 *
 * `necessary` is not a question — it covers security, load balancing and the
 * session cookie, has no toggle, and is always granted. It is modelled anyway
 * so a consent record is a complete statement of what applied at a point in
 * time rather than a partial one.
 */
export const CONSENT_CATEGORIES = [
  'necessary',
  'functional',
  'analytics',
  'personalization',
  'advertisingStorage',
  'advertisingUserData',
  'advertisingPersonalization',
  'uxDiagnostics',
  'sessionReplay',
] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/** Categories a user can actually decline. `necessary` is excluded by design. */
export const OPTIONAL_CONSENT_CATEGORIES = CONSENT_CATEGORIES.filter(
  (category): category is Exclude<ConsentCategory, 'necessary'> => category !== 'necessary',
);

export type ConsentDecisions = Record<ConsentCategory, boolean>;

/**
 * How a consent state came to be. Recorded so an auditor can tell a real choice
 * from a default, and a default from an inherited regional policy.
 */
export type ConsentSource =
  /** No interaction yet — the privacy-conservative starting point. */
  | 'default'
  /** The visitor used the banner or preference centre. */
  | 'explicit'
  /** Carried forward from a stored decision on a previous visit. */
  | 'restored'
  /** A region where opt-out (rather than opt-in) is the lawful basis. */
  | 'regional-policy'
  /** The visitor withdrew consent. */
  | 'withdrawn'
  /** Set by an operator on the visitor's behalf, e.g. a rights request. */
  | 'operator';

/**
 * Which consent regime applies. Drives the *default*, never the storage: a
 * record is written the same way everywhere so the evidence is uniform.
 */
export type ConsentRegime =
  /** EEA/UK/CH — opt-in. Nothing optional runs before an explicit grant. */
  | 'gdpr'
  /** US state privacy laws — opt-out permitted for some categories. */
  | 'us-state'
  /** Everywhere else — we still default to opt-in rather than assume. */
  | 'default';

export interface ConsentState {
  decisions: ConsentDecisions;
  source: ConsentSource;
  regime: ConsentRegime;
  /** Version of the consent *policy* text the visitor was shown. */
  policyVersion: string;
  /** Version of the category set itself; bump when categories change meaning. */
  consentVersion: string;
  /** ms since epoch. */
  updatedAt: number;
  /** Opaque, non-identifying handle for the stored record. */
  consentPublicId?: string;
  /** IAB TCF string when a certified CMP supplied one. */
  tcfString?: string;
  cmpName?: string;
  cmpVersion?: string;
}

/** The category set this build understands. Bump on any semantic change. */
export const CONSENT_VERSION = '1';

/** Everything optional off. The only safe starting point, in every region. */
export function denyAll(): ConsentDecisions {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    personalization: false,
    advertisingStorage: false,
    advertisingUserData: false,
    advertisingPersonalization: false,
    uxDiagnostics: false,
    sessionReplay: false,
  };
}

/**
 * Everything on — only ever the result of an explicit "accept all".
 *
 * Session replay is deliberately excluded even here. It is the most invasive
 * category we support, and bundling it into a one-tap accept is exactly the
 * kind of thing a user does not expect to have agreed to.
 */
export function grantAll(): ConsentDecisions {
  return {
    ...denyAll(),
    functional: true,
    analytics: true,
    personalization: true,
    advertisingStorage: true,
    advertisingUserData: true,
    advertisingPersonalization: true,
    uxDiagnostics: true,
  };
}

/**
 * The state to use before any interaction.
 *
 * Conservative in every regime. `us-state` is *not* given pre-granted analytics
 * here even though an opt-out basis may permit it: the opt-out signal (and any
 * Global Privacy Control header) is resolved server-side, and defaulting to
 * "on" client-side would race that decision.
 */
export function defaultConsentState(
  regime: ConsentRegime,
  policyVersion: string,
  now = Date.now(),
): ConsentState {
  return {
    decisions: denyAll(),
    source: 'default',
    regime,
    policyVersion,
    consentVersion: CONSENT_VERSION,
    updatedAt: now,
  };
}

/** True when the category is granted. The single question the SDK should ask. */
export function isGranted(state: ConsentState, category: ConsentCategory): boolean {
  return state.decisions[category] === true;
}

/**
 * True when a decision has actually been made, i.e. a banner should no longer
 * block. `default` is not a decision; `restored` is.
 */
export function hasDecided(state: ConsentState): boolean {
  return state.source !== 'default';
}

/**
 * True when the stored decision predates the current policy or category set and
 * must be re-asked. Re-consent on version drift is the whole point of storing
 * both versions.
 */
export function needsRenewal(state: ConsentState, currentPolicyVersion: string): boolean {
  return state.policyVersion !== currentPolicyVersion || state.consentVersion !== CONSENT_VERSION;
}

// ── Google Consent Mode v2 ───────────────────────────────────────────────────

export type GoogleConsentSignal =
  | 'security_storage'
  | 'functionality_storage'
  | 'analytics_storage'
  | 'personalization_storage'
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization';

export type GoogleConsentValue = 'granted' | 'denied';

/**
 * Project our categories onto Consent Mode v2 signals.
 *
 * The mapping is 1:1 by design — a category per signal — because collapsing two
 * signals onto one toggle removes a choice the user is entitled to make
 * separately (notably ad_user_data vs ad_personalization).
 */
export function toGoogleConsent(
  state: ConsentState,
): Record<GoogleConsentSignal, GoogleConsentValue> {
  const v = (granted: boolean): GoogleConsentValue => (granted ? 'granted' : 'denied');
  return {
    security_storage: v(state.decisions.necessary),
    functionality_storage: v(state.decisions.functional),
    analytics_storage: v(state.decisions.analytics),
    personalization_storage: v(state.decisions.personalization),
    ad_storage: v(state.decisions.advertisingStorage),
    ad_user_data: v(state.decisions.advertisingUserData),
    ad_personalization: v(state.decisions.advertisingPersonalization),
  };
}

/** How ads may be served under the current state. */
export type AdMode =
  /** No ad storage: contextual only, no ad identifiers. */
  | 'limited'
  /** Ad storage granted, personalization refused. */
  | 'non-personalized'
  /** Full personalization granted. */
  | 'personalized';

/**
 * Ads are allowed to run in some form in every state — but "limited" is a real
 * restriction, not a synonym for personalized, and the caller must pass it to
 * the provider rather than treating any non-personalized state as the same.
 */
export function resolveAdMode(state: ConsentState): AdMode {
  if (!state.decisions.advertisingStorage) return 'limited';
  return state.decisions.advertisingPersonalization ? 'personalized' : 'non-personalized';
}

/**
 * The category a given capability requires. Used by the SDK and the collector so
 * both agree on what a piece of data is *for* — the collector re-checks rather
 * than trusting a client that says it had consent.
 */
export const CAPABILITY_CONSENT: Record<string, ConsentCategory> = {
  /** Behavioural event collection. */
  events: 'analytics',
  /** The pseudonymous jgp_visitor cookie. */
  visitorId: 'analytics',
  /** Web Vitals, rage clicks, client errors. */
  uxDiagnostics: 'uxDiagnostics',
  /** Recommendation and preference signals. */
  personalization: 'personalization',
  /** Campaign/affiliate attribution storage. */
  attribution: 'advertisingStorage',
  /** Experiment assignment persistence. */
  experiments: 'functional',
  /** Third-party replay provider. */
  sessionReplay: 'sessionReplay',
};

export type AnalyticsCapability = keyof typeof CAPABILITY_CONSENT;

/** Whether a capability may run. Prefer this over reading categories directly. */
export function allows(state: ConsentState, capability: AnalyticsCapability): boolean {
  const category = CAPABILITY_CONSENT[capability];
  return category ? isGranted(state, category) : false;
}

/**
 * Apply a partial update, preserving `necessary` and stamping provenance.
 *
 * Callers cannot revoke `necessary` and cannot silently forge a source: both are
 * set here so every transition through the system is recorded the same way.
 */
export function applyDecisions(
  state: ConsentState,
  changes: Partial<ConsentDecisions>,
  source: ConsentSource,
  now = Date.now(),
): ConsentState {
  return {
    ...state,
    decisions: { ...state.decisions, ...changes, necessary: true },
    source,
    updatedAt: now,
  };
}

/** Withdrawal is a first-class transition, not "accept-all with false values". */
export function withdrawAll(state: ConsentState, now = Date.now()): ConsentState {
  return { ...state, decisions: denyAll(), source: 'withdrawn', updatedAt: now };
}
