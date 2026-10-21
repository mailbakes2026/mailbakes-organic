export type GoogleStatus = {
  configured: boolean;
  encryptionReady: boolean;
  connected: boolean;
  email: string;
  lastError: string;
  redirectUri: string;
  financeEmail: string;
  expectedEmail: string;
  apiReady: boolean;
  scopes: string[];
  driveGranted: boolean;
};

export function googleEmailMismatch(status: GoogleStatus) {
  return Boolean(status.connected && status.email && status.email.toLowerCase() !== status.expectedEmail.toLowerCase());
}
