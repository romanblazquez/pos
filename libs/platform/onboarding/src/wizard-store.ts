import { nanoid } from 'nanoid';
import type { WizardState, WizardStepId, WizardData } from './wizard-types.js';

/** Persistence port for wizard state — in-memory for tests; SQLite in the shell. */
export interface WizardPersistence {
  load(): WizardState | null;
  save(state: WizardState): void;
}

export class InMemoryWizardPersistence implements WizardPersistence {
  private state: WizardState | null = null;
  load() { return this.state; }
  save(s: WizardState) { this.state = { ...s }; }
}

/**
 * WizardStore — manages the onboarding wizard lifecycle.
 *
 * Tracks current step, completed steps, and partial data. On each `advance()`
 * the current step is marked complete, data merged, and the next step activated.
 * State is persisted after every transition so restarts resume where they left off.
 */
export class WizardStore {
  private state!: WizardState;

  constructor(private readonly persistence: WizardPersistence) {
    const saved = persistence.load();
    if (saved) {
      this.state = saved;
    } else {
      this.state = {
        id: nanoid(),
        currentStep: 'business-info',
        completedSteps: [],
        data: { connectedProviders: [] },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persistence.save(this.state);
    }
  }

  getState(): WizardState {
    return { ...this.state, data: { ...this.state.data } };
  }

  isStarted(): boolean {
    return this.state.completedSteps.length > 0 || !!this.state.data.businessInfo?.businessName;
  }

  advance(stepId: WizardStepId, partialData: Partial<WizardData>): void {
    if (!this.state.completedSteps.includes(stepId)) {
      this.state.completedSteps.push(stepId);
    }
    this.state.data = { ...this.state.data, ...partialData };
    this.state.updatedAt = new Date().toISOString();
    this.persistence.save(this.state);
  }

  setStep(stepId: WizardStepId): void {
    this.state.currentStep = stepId;
    this.state.updatedAt = new Date().toISOString();
    this.persistence.save(this.state);
  }

  complete(): void {
    this.state.completedAt = new Date().toISOString();
    this.persistence.save(this.state);
  }

  reset(): void {
    this.state = {
      id: nanoid(),
      currentStep: 'business-info',
      completedSteps: [],
      data: { connectedProviders: [] },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.persistence.save(this.state);
  }
}
