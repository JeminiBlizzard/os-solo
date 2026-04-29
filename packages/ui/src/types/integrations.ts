export type IntegrationType = 'stripe' | 'github' | 'email' | 'mcp' | 'webhook' | 'custom';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Integration {
  id: number;
  userId: number;
  type: IntegrationType;
  name: string;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationFormData {
  type: IntegrationType;
  name: string;
  config: Record<string, any>;
}
