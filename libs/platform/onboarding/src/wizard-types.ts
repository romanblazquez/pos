/**
 * Onboarding wizard — domain types.
 *
 * The wizard runs when the platform is installed for the first time or when no
 * merchant/store is configured. It is resumable: progress persists after each
 * step so a restart never loses data. The `WizardState` is stored in SQLite
 * (local) and replicated to the central DB on completion.
 */
export type WizardStepId =
  | 'business-info'
  | 'store-info'
  | 'payment-providers'
  | 'hardware'
  | 'taxes'
  | 'import-products'
  | 'finish';

export interface WizardStep {
  id: WizardStepId;
  title: string;
  subtitle: string;
  /** Completed = data submitted and valid for this step. */
  completed: boolean;
  optional?: boolean;
}

export interface BusinessInfo {
  businessName: string;
  legalName: string;
  country: string;           // ISO-3166-1 alpha-2
  taxIdentifier: string;     // RFC (MX) / RUT (CL) / etc.
  currency: string;          // ISO-4217
  timezone: string;          // IANA tz
}

export interface StoreInfo {
  storeName: string;
  storeAddress: string;
  storeType: 'retail' | 'food_beverage' | 'services' | 'other';
  numberOfStations: number;
}

export type ConnectedProvider = {
  id: string;
  name: string;
  status: 'connected' | 'pending_oauth' | 'error';
  mode: 'production' | 'development';
};

export interface HardwareConfig {
  barcodeScanner: boolean;
  receiptPrinter: boolean;
  cashDrawer: boolean;
  customerDisplay: boolean;
  /** Extensible: future plugins register hardware types here. */
  extra: Record<string, boolean>;
}

export interface TaxConfig {
  countryDefault: number;   // percent, e.g. 16 for Mexico IVA
  taxName: string;          // e.g. "IVA"
  inclusiveInPrice: boolean;
  receiptShowTax: boolean;
}

export interface WizardData {
  businessInfo?: Partial<BusinessInfo>;
  storeInfo?: Partial<StoreInfo>;
  connectedProviders: ConnectedProvider[];
  hardware?: Partial<HardwareConfig>;
  taxes?: Partial<TaxConfig>;
  importCompleted?: boolean;
}

export interface WizardState {
  id: string;
  currentStep: WizardStepId;
  completedSteps: WizardStepId[];
  data: WizardData;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'business-info', title: 'Tu Negocio', subtitle: 'Información fiscal y de la empresa', completed: false },
  { id: 'store-info', title: 'Tu Tienda', subtitle: 'Ubicación y tipo de negocio', completed: false },
  { id: 'payment-providers', title: 'Pagos', subtitle: 'Conecta tus terminales y métodos de pago', completed: false },
  { id: 'hardware', title: 'Hardware', subtitle: 'Escáner, impresora y periféricos', completed: false, optional: true },
  { id: 'taxes', title: 'Impuestos', subtitle: 'IVA y configuración fiscal', completed: false },
  { id: 'import-products', title: 'Productos', subtitle: 'Importa tu catálogo', completed: false, optional: true },
  { id: 'finish', title: 'Listo', subtitle: 'Tu plataforma está lista', completed: false },
];

export function isWizardComplete(state: WizardState): boolean {
  const required = WIZARD_STEPS.filter((s) => !s.optional).map((s) => s.id);
  return required.every((id) => state.completedSteps.includes(id));
}
