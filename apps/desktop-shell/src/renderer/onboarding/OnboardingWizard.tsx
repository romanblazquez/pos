import { useState, useCallback } from 'react';
import {
  WIZARD_STEPS,
  WizardStore,
  InMemoryWizardPersistence,
  type WizardStepId,
} from '@retail-os/onboarding';
import { StepBusinessInfo } from './steps/StepBusinessInfo.js';
import { StepStoreInfo } from './steps/StepStoreInfo.js';
import { StepPaymentProviders } from './steps/StepPaymentProviders.js';
import { StepHardware } from './steps/StepHardware.js';
import { StepTaxes } from './steps/StepTaxes.js';
import { StepImportProducts } from './steps/StepImportProducts.js';
import { StepFinish } from './steps/StepFinish.js';

const wizardStore = new WizardStore(new InMemoryWizardPersistence());
// TODO: in the shell, replace InMemoryWizardPersistence with SqliteWizardPersistence

const STEP_COMPONENTS: Record<WizardStepId, React.ComponentType<StepProps>> = {
  'business-info': StepBusinessInfo,
  'store-info': StepStoreInfo,
  'payment-providers': StepPaymentProviders,
  'hardware': StepHardware,
  'taxes': StepTaxes,
  'import-products': StepImportProducts,
  'finish': StepFinish,
};

export interface StepProps {
  data: ReturnType<WizardStore['getState']>['data'];
  onNext(partial?: Partial<ReturnType<WizardStore['getState']>['data']>): void;
  onBack(): void;
  onSkip(): void;
  isFirst: boolean;
  isLast: boolean;
  optional?: boolean;
}

const STEP_ORDER: WizardStepId[] = [
  'business-info', 'store-info', 'payment-providers', 'hardware', 'taxes', 'import-products', 'finish',
];

export function OnboardingWizard({ onComplete }: { onComplete(): void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [wizardState, setWizardState] = useState(() => wizardStore.getState());

  const currentStepId = STEP_ORDER[stepIndex];
  const currentMeta = WIZARD_STEPS.find((s) => s.id === currentStepId)!;
  const StepComponent = STEP_COMPONENTS[currentStepId];

  const goNext = useCallback((partial?: Partial<typeof wizardState['data']>) => {
    wizardStore.advance(currentStepId, partial ?? {});
    if (currentStepId === 'finish') {
      wizardStore.complete();
      onComplete();
      return;
    }
    const next = stepIndex + 1;
    wizardStore.setStep(STEP_ORDER[next]);
    setStepIndex(next);
    setWizardState(wizardStore.getState());
  }, [currentStepId, stepIndex, onComplete]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) return;
    const prev = stepIndex - 1;
    wizardStore.setStep(STEP_ORDER[prev]);
    setStepIndex(prev);
  }, [stepIndex]);

  const skip = useCallback(() => {
    goNext();
  }, [goNext]);

  const progress = ((stepIndex) / (STEP_ORDER.length - 1)) * 100;

  return (
    <div className="onboarding-wizard">
      <div className="onboarding-sidebar">
        <div className="onboarding-logo">
          <span className="onboarding-logo-mark">◆</span>
          <div>
            <strong>Retail OS</strong>
            <span>Bienvenido</span>
          </div>
        </div>
        <div className="onboarding-steps">
          {WIZARD_STEPS.map((step, i) => {
            const done = wizardState.completedSteps.includes(step.id);
            const active = step.id === currentStepId;
            return (
              <div key={step.id} className={`onboarding-step-item${active ? ' active' : ''}${done ? ' done' : ''}`}>
                <div className="step-dot">
                  {done ? '✓' : i + 1}
                </div>
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="onboarding-progress-bar">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="onboarding-main">
        <div className="onboarding-step-header">
          <h1>{currentMeta.title}</h1>
          <p>{currentMeta.subtitle}</p>
        </div>
        <div className="onboarding-step-content">
          <StepComponent
            data={wizardState.data}
            onNext={goNext}
            onBack={goBack}
            onSkip={skip}
            isFirst={stepIndex === 0}
            isLast={currentStepId === 'finish'}
            optional={currentMeta.optional}
          />
        </div>
      </div>
    </div>
  );
}
