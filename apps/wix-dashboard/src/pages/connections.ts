export interface ConnectionUiState {
  tenantId: string;
  connected: boolean;
  connectPath: string;
  disconnectPath: string;
}

export const defaultConnectionUiState: ConnectionUiState = {
  tenantId: '',
  connected: false,
  connectPath: '/api/hubspot/connect/start',
  disconnectPath: '/api/hubspot/disconnect'
};
