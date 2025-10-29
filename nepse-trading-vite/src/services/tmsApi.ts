import axios, { type AxiosInstance } from 'axios';

// In development, use empty baseURL to proxy through Vite dev server
// In production, set this to the actual TMS URL
const TMS_BASE_URL = import.meta.env.DEV ? '' : 'https://tms56.nepsetms.com.np';

class TMSApiClient {
  private client: AxiosInstance;
  private sessionData: {
    xsrfToken?: string;
    aid?: string;
    rid?: string;
    sessionId?: string;
    memberCode?: string;
    requestOwner?: string;
  } = {};

  constructor() {
    console.log('[TMS API] Initializing with baseURL:', TMS_BASE_URL || '(using Vite proxy)');

    this.client = axios.create({
      baseURL: TMS_BASE_URL,
      timeout: 10000,
      withCredentials: true, // Important: enables sending cookies with CORS requests
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use((config) => {
      // Add authentication headers
      if (this.sessionData.xsrfToken) {
        config.headers['x-xsrf-token'] = this.sessionData.xsrfToken;
      }
      if (this.sessionData.sessionId) {
        config.headers['host-session-id'] = this.sessionData.sessionId;
      }
      if (this.sessionData.memberCode) {
        config.headers['membercode'] = this.sessionData.memberCode;
      }
      if (this.sessionData.requestOwner) {
        config.headers['request-owner'] = this.sessionData.requestOwner;
      }

      // Send cookies via custom header for Vite proxy to inject
      // This bypasses browser's forbidden header restrictions
      const cookies = [];
      if (this.sessionData.xsrfToken) cookies.push(`XSRF-TOKEN=${this.sessionData.xsrfToken}`);
      if (this.sessionData.aid) cookies.push(`_aid=${this.sessionData.aid}`);
      if (this.sessionData.rid) cookies.push(`_rid=${this.sessionData.rid}`);
      if (cookies.length) {
        config.headers['X-TMS-Cookies'] = cookies.join('; ');
        console.log('[TMS API] Sending cookies via X-TMS-Cookies header');
      }

      console.log('[TMS API] Request headers:', {
        'x-xsrf-token': config.headers['x-xsrf-token'],
        'host-session-id': config.headers['host-session-id'],
        'membercode': config.headers['membercode'],
        'request-owner': config.headers['request-owner'],
        'X-TMS-Cookies': cookies.length > 0 ? 'SET' : 'NOT SET',
        url: config.url,
      });

      return config;
    });

    // Response interceptor for auto-refresh and error logging
    this.client.interceptors.response.use(
      (response) => {
        console.log('[TMS API] Response received:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      async (error) => {
        console.error('[TMS API] Request failed:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.config?.headers,
        });

        // Only auto-refresh ONCE to prevent infinite loops
        // Check if this request has already been retried
        if (error.config && !error.config.__isRetryRequest) {
          if (error.response?.status === 401 &&
              error.response?.data?.message === 'ACCESS_TOKEN_EXPIRED') {
            
            console.log('[TMS API] 🔄 ACCESS TOKEN EXPIRED - Refreshing session...');
            
            try {
              // Mark this config as a retry to prevent infinite loops
              error.config.__isRetryRequest = true;
              
              // Refresh the session
              await this.refreshSession();
              console.log('[TMS API] ✅ Session refreshed, retrying original request...');
              
              // Retry the original request with fresh tokens
              return this.client.request(error.config);
            } catch (refreshError) {
              console.error('[TMS API] ❌ Session refresh failed:', refreshError);
              throw error; // Throw original error
            }
          }
        }
        
        throw error;
      }
    );
  }

  updateSession(sessionData: any) {
    console.log('[TMS API] Updating session with data:', sessionData);

    // Parse cookies from cookie string
    if (sessionData.cookie) {
      const cookies = sessionData.cookie.split(';').map((c: string) => c.trim());
      cookies.forEach((cookie: string) => {
        const [name, value] = cookie.split('=');
        if (name === 'XSRF-TOKEN') this.sessionData.xsrfToken = value;
        if (name === '_aid') this.sessionData.aid = value;
        if (name === '_rid') this.sessionData.rid = value;
      });
    }

    // Set headers
    this.sessionData.xsrfToken = sessionData['x-xsrf-token'] || this.sessionData.xsrfToken;
    this.sessionData.sessionId = sessionData['host-session-id'];
    this.sessionData.memberCode = sessionData['membercode'];
    this.sessionData.requestOwner = sessionData['request-owner'];

    console.log('[TMS API] Session data updated:', {
      hasXsrfToken: !!this.sessionData.xsrfToken,
      hasSessionId: !!this.sessionData.sessionId,
      hasMemberCode: !!this.sessionData.memberCode,
      hasRequestOwner: !!this.sessionData.requestOwner,
      hasAid: !!this.sessionData.aid,
      hasRid: !!this.sessionData.rid,
    });
  }

  async refreshSession() {
    const response = await this.client.post('/tmsapi/authApi/authenticate/refresh', {});
    // Update session from response headers
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      // Parse and update cookies
      setCookie.forEach((cookie: string) => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name === 'XSRF-TOKEN') this.sessionData.xsrfToken = value;
        if (name === '_aid') this.sessionData.aid = value;
        if (name === '_rid') this.sessionData.rid = value;
      });
    }
    return response.data;
  }

  // Stock APIs
  async getLivePrice(_symbol: string, stockId: number) {
    const response = await this.client.get(`/tmsapi/rtApi/ws/stockQuote/${stockId}`);
    return response.data;
  }

  async getOHLC(stockId: number, isin: string) {
    const response = await this.client.get(`/tmsapi/rtApi/stock/validation/ohlc/${stockId}/${isin}`);
    return response.data;
  }

  async getSTP(isin: string, code: string = 'LTPCF') {
    const response = await this.client.get(`/tmsapi/orderApi/stock/validation/stp/${isin}/${code}`);
    return response.data;
  }

  // Order APIs
  async placeOrder(orderPayload: any) {
    const response = await this.client.post('/tmsapi/orderApi/order/', orderPayload);
    return response.data;
  }

  // Client API
  async getClientInfo(ucc: string, memberCode: string = 'PG') {
    const response = await this.client.get(
      `/tmsapi/masterclients/clientsSearchInfo?ucc=${ucc}&contactPerson=null&memberCode=${memberCode}&clientOrDealer=C&`
    );
    return response.data;
  }

  // Get current user's client details
  async getMyClientDetails() {
    // Default UCC for the logged-in user
    const defaultUCC = '201811020695929';
    const response = await this.client.get(
      `/tmsapi/masterclients/clientsSearchInfo?ucc=${defaultUCC}&contactPerson=null&memberCode=PG&clientOrDealer=C&`
    );
    // Response is an array, return first item
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

  // Search for clients by UCC or name
  async searchClients(searchTerm: string, memberCode: string = 'PG') {
    const response = await this.client.get(
      `/tmsapi/masterclients/clientsSearchInfo?ucc=${searchTerm}&contactPerson=null&memberCode=${memberCode}&clientOrDealer=C&`
    );
    // Response is an array
    return Array.isArray(response.data) ? response.data : [response.data];
  }

  getSessionStatus() {
    return {
      hasAuth: !!(this.sessionData.xsrfToken && this.sessionData.aid && this.sessionData.rid),
      ...this.sessionData,
    };
  }
}

export const tmsApi = new TMSApiClient();
export default tmsApi;
