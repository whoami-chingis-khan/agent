export interface ClientSession {
  id: string;                    // UUID
  name: string;                  // Display name (e.g., "POOJA MITTAL")
  memberCode: string;            // "56", "57", etc.
  clientId: string;              // "881337"
  ucc: string;                   // "201811020695929"
  
  // TMS Provider Configuration
  tmsProvider: string;           // e.g., "tms56", "tms57", "tms58"
  tmsBaseUrl: string;            // e.g., "https://tms56.nepsetms.com.np"
  
  // Authentication
  cookies: {
    'XSRF-TOKEN': string;
    '_aid': string;
    '_rid': string;
  };
  
  headers: {
    'x-xsrf-token': string;
    'host-session-id': string;
    'membercode': string;
    'request-owner': string;
  };
  
  // Metadata
  isActive: boolean;
  lastRefresh: Date | null;
  createdAt: Date;
  
  // Status
  isValid: boolean;
  lastValidated: Date | null;
}

export interface ClientManager {
  clients: Map<string, ClientSession>;
  activeClientId: string | null;
  
  addClient(session: ClientSession): void;
  removeClient(clientId: string): void;
  switchClient(clientId: string): void;
  refreshClient(clientId: string): Promise<void>;
  validateClient(clientId: string): Promise<boolean>;
}
