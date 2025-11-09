import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ClientSession } from '../types/client';
import { useClientStore } from '../store/clientStore';

// In development, use Vite dev server proxy (/tmsapi)
// In production (Vercel), use serverless function (/api/tmsapi)
const API_PREFIX = import.meta.env.DEV ? '/tmsapi' : '/api/tmsapi';

class MultiClientTmsApi {
  private apiClients: Map<string, AxiosInstance> = new Map();

  // Create isolated API client for each session
  createClientApi(clientId: string, _session: ClientSession): AxiosInstance {
    console.log('[Multi-Client API] Creating API instance for client:', clientId);

    const api = axios.create({
      baseURL: '',
      timeout: 10000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    // Request interceptor - inject client-specific cookies and headers
    api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Get latest session data
        const currentSession = useClientStore.getState().getClient(clientId);
        if (!currentSession) {
          console.error('[Multi-Client API] Session not found for client:', clientId);
          return config;
        }

        // Build cookie string
        const cookieString = [
          `XSRF-TOKEN=${currentSession.cookies['XSRF-TOKEN']}`,
          `_aid=${currentSession.cookies['_aid']}`,
          `_rid=${currentSession.cookies['_rid']}`,
        ].join('; ');

        // Inject cookies via custom header (for serverless function)
        config.headers['X-TMS-Cookies'] = cookieString;
        
        // CRITICAL: Inject client's TMS provider URL
        config.headers['X-TMS-Provider'] = currentSession.tmsBaseUrl;

        // Inject other required headers
        config.headers['x-xsrf-token'] = currentSession.headers['x-xsrf-token'];
        config.headers['host-session-id'] = currentSession.headers['host-session-id'];
        config.headers['membercode'] = currentSession.headers['membercode'];
        config.headers['request-owner'] = currentSession.headers['request-owner'];

        console.log('[Multi-Client API] Request for client:', clientId, 
          'TMS:', currentSession.tmsProvider,
          config.method?.toUpperCase(), config.url);

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 and refresh session
    api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 and attempt refresh (only once per request)
        if (error.response?.status === 401 && !originalRequest.__isRetryRequest) {
          console.log('[Multi-Client API] 401 detected for client:', clientId, '- attempting refresh');

          originalRequest.__isRetryRequest = true;

          try {
            await this.refreshClientSession(clientId);
            // Retry original request with updated session
            return api.request(originalRequest);
          } catch (refreshError) {
            console.error('[Multi-Client API] Refresh failed for client:', clientId, refreshError);
            // Mark session as invalid
            useClientStore.getState().updateClientSession(clientId, {
              isValid: false,
            });
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    this.apiClients.set(clientId, api);
    return api;
  }

  // Get API instance for specific client
  getClientApi(clientId: string): AxiosInstance | null {
    return this.apiClients.get(clientId) || null;
  }

  // Get or create API instance
  getOrCreateClientApi(clientId: string): AxiosInstance {
    let api = this.apiClients.get(clientId);
    
    if (!api) {
      const session = useClientStore.getState().getClient(clientId);
      if (!session) {
        throw new Error(`Client session not found: ${clientId}`);
      }
      api = this.createClientApi(clientId, session);
    }
    
    return api;
  }

  // Refresh specific client session
  async refreshClientSession(clientId: string): Promise<void> {
    console.log('[Multi-Client API] Refreshing session for client:', clientId);

    const api = this.getOrCreateClientApi(clientId);
    const response = await api.post(`${API_PREFIX}/authApi/authenticate/refresh`, {});

    // Extract new cookies from response data (_cookies added by serverless function)
    const newCookies = (response.data as any)._cookies;

    if (newCookies) {
      // Parse cookie string(s)
      const cookieArray = Array.isArray(newCookies) ? newCookies : [newCookies];
      const updatedCookies: Partial<ClientSession['cookies']> = {};

      cookieArray.forEach((cookie: string) => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        
        if (name === 'XSRF-TOKEN') updatedCookies['XSRF-TOKEN'] = value;
        if (name === '_aid') updatedCookies['_aid'] = value;
        if (name === '_rid') updatedCookies['_rid'] = value;
      });

      // Update session in store
      const currentSession = useClientStore.getState().getClient(clientId);
      if (currentSession) {
        useClientStore.getState().updateClientSession(clientId, {
          cookies: {
            ...currentSession.cookies,
            ...updatedCookies,
          },
          headers: {
            ...currentSession.headers,
            'x-xsrf-token': updatedCookies['XSRF-TOKEN'] || currentSession.headers['x-xsrf-token'],
          },
          lastRefresh: new Date(),
          isValid: true,
        });

        console.log('[Multi-Client API] Session refreshed successfully for client:', clientId);
      }
    }
  }

  // Remove API instance when client is removed
  removeClientApi(clientId: string): void {
    this.apiClients.delete(clientId);
    console.log('[Multi-Client API] Removed API instance for client:', clientId);
  }

  // Get live price for a stock
  async getLivePrice(clientId: string, stockId: number, isin: string) {
    const api = this.getOrCreateClientApi(clientId);
    const response = await api.post(`${API_PREFIX}/stock/live-price`, { stockId, isin });
    return response.data;
  }

  // Get OHLC data
  async getOHLC(clientId: string, stockId: number, isin: string) {
    const api = this.getOrCreateClientApi(clientId);
    const response = await api.post(`${API_PREFIX}/stock/ohlc`, { stockId, isin });
    return response.data;
  }

  // Get STP (System Trading Price) data
  async getSTP(clientId: string, stockId: number, isin: string) {
    const api = this.getOrCreateClientApi(clientId);
    const response = await api.post(`${API_PREFIX}/stock/stp`, { stockId, isin });
    return response.data;
  }

  // Place order
  async placeOrder(clientId: string, orderData: any) {
    const api = this.getOrCreateClientApi(clientId);
    const response = await api.post(`${API_PREFIX}/orderApi/order/`, orderData);
    return response.data;
  }

  // Get client info
  async getClientInfo(clientId: string) {
    const api = this.getOrCreateClientApi(clientId);
    // Use the same endpoint as the original tmsApi - searches by default UCC
    const response = await api.get(
      `${API_PREFIX}/masterclients/clientsSearchInfo?ucc=&contactPerson=null&memberCode=56&clientOrDealer=C&`
    );
    
    // Response is an array, return first item (logged-in user)
    const clientData = Array.isArray(response.data) ? response.data[0] : response.data;
    
    return {
      clientCode: clientData?.id,
      clientName: clientData?.displayName,
      ucc: clientData?.notsUniqueClientCode,
      dpId: clientData?.boid,
      email: clientData?.emailId,
      phone: clientData?.phoneNumber,
      status: clientData?.activeStatus,
    };
  }
}

// Singleton instance
export const multiClientTmsApi = new MultiClientTmsApi();
