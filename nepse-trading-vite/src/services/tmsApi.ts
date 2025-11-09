import axios, { type AxiosInstance } from 'axios';

// In development, use Vite dev server proxy (/tmsapi)
// In production (Vercel), use serverless function (/api/tmsapi)
const API_PREFIX = import.meta.env.DEV ? '/tmsapi' : '/api/tmsapi';
const TMS_BASE_URL = '';

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
  private refreshPromise: Promise<any> | null = null;

  constructor() {
    console.log('[TMS API] Initializing with API prefix:', API_PREFIX);

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
      }

      console.log('[TMS API] 📤 REQUEST:', {
        url: config.url,
        method: config.method?.toUpperCase(),
        'x-xsrf-token': config.headers['x-xsrf-token'] ? config.headers['x-xsrf-token'].substring(0, 20) + '...' : 'NOT SET',
        'host-session-id': config.headers['host-session-id'] ? config.headers['host-session-id'].substring(0, 20) + '...' : 'NOT SET',
        'membercode': config.headers['membercode'] || 'NOT SET',
        'request-owner': config.headers['request-owner'] || 'NOT SET',
        cookies: {
          xsrfToken: this.sessionData.xsrfToken ? this.sessionData.xsrfToken.substring(0, 20) + '...' : 'NOT SET',
          aid: this.sessionData.aid ? this.sessionData.aid.substring(0, 20) + '...' : 'NOT SET',
          rid: this.sessionData.rid ? this.sessionData.rid.substring(0, 20) + '...' : 'NOT SET',
        }
      });

      return config;
    });

    // Response interceptor for auto-refresh and error logging
    this.client.interceptors.response.use(
      (response) => {
        console.log('[TMS API] ✅ Response received:', {
          url: response.config.url,
          status: response.status,
          dataKeys: Object.keys(response.data || {}),
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

              // Use existing refresh promise if one is in progress to prevent multiple simultaneous calls
              if (!this.refreshPromise) {
                console.log('[TMS API] Starting new refresh request');
                this.refreshPromise = this.refreshSession().finally(() => {
                  this.refreshPromise = null;
                });
              } else {
                console.log('[TMS API] Waiting for existing refresh request');
              }

              // Wait for refresh to complete
              await this.refreshPromise;
              console.log('[TMS API] ✅ Session refreshed successfully!');
              console.log('[TMS API] 🔁 Retrying original request with NEW tokens...');

              // Retry the original request with fresh tokens
              const retryResponse = await this.client.request(error.config);
              console.log('[TMS API] 🎉 Retry successful!');
              return retryResponse;
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
    console.log('[TMS API] 🔄 Refreshing session - OLD VALUES:', {
      aid: this.sessionData.aid ? this.sessionData.aid.substring(0, 20) + '...' : 'none',
      rid: this.sessionData.rid ? this.sessionData.rid.substring(0, 20) + '...' : 'none',
      xsrfToken: this.sessionData.xsrfToken ? this.sessionData.xsrfToken.substring(0, 20) + '...' : 'none',
      sessionId: this.sessionData.sessionId ? this.sessionData.sessionId.substring(0, 20) + '...' : 'none',
    });

    const response = await this.client.post(`${API_PREFIX}/authApi/authenticate/refresh`, {});

    console.log('[TMS API] Refresh response headers:', response.headers);
    console.log('[TMS API] Refresh response data:', response.data);

    // Extract new XSRF token - prioritize custom header from Vite proxy
    const newXsrfToken = response.headers['x-new-xsrf-token'] ||
                         response.headers['x-xsrf-token'] ||
                         response.headers['X-XSRF-TOKEN'] ||
                         response.headers['X-Xsrf-Token'];

    if (newXsrfToken) {
      console.log('[TMS API] ✅ Found new XSRF token:', newXsrfToken.substring(0, 20) + '...');
      this.sessionData.xsrfToken = newXsrfToken;
    }

    // Extract new host-session-id - prioritize custom header from Vite proxy
    const newSessionId = response.headers['x-new-session-id'] ||
                        response.headers['host-session-id'] ||
                        response.headers['Host-Session-Id'] ||
                        response.headers['HOST-SESSION-ID'];

    if (newSessionId) {
      console.log('[TMS API] ✅ Found new host-session-id:', newSessionId.substring(0, 20) + '...');
      this.sessionData.sessionId = newSessionId;
    }

    // Extract cookies from custom header set by Vite proxy
    const customSetCookie = response.headers['x-set-cookie'];
    if (customSetCookie) {
      console.log('[TMS API] Processing Set-Cookie from Vite proxy custom header...');
      try {
        const cookies = JSON.parse(customSetCookie);
        cookies.forEach((cookie: string) => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          if (name === 'XSRF-TOKEN') {
            console.log('[TMS API] ✅ Updated XSRF-TOKEN from cookie:', value.substring(0, 20) + '...');
            this.sessionData.xsrfToken = value;
          }
          if (name === '_aid') {
            console.log('[TMS API] ✅ Updated _aid from cookie:', value.substring(0, 20) + '...');
            this.sessionData.aid = value;
          }
          if (name === '_rid') {
            console.log('[TMS API] ✅ Updated _rid from cookie:', value.substring(0, 20) + '...');
            this.sessionData.rid = value;
          }
        });
      } catch (e) {
        console.error('[TMS API] Failed to parse X-Set-Cookie header:', e);
      }
    }

    // Fallback: In Vercel, cookies are in response._cookies (added by serverless function)
    const vercelCookies = response.data._cookies || response.headers['set-cookie'];
    if (vercelCookies && !customSetCookie) {
      console.log('[TMS API] Processing Set-Cookie from Vercel (fallback)...');
      const cookies = Array.isArray(vercelCookies) ? vercelCookies : [vercelCookies];
      cookies.forEach((cookie: string) => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name === 'XSRF-TOKEN') {
          console.log('[TMS API] ✅ Updated XSRF-TOKEN from cookie:', value.substring(0, 20) + '...');
          this.sessionData.xsrfToken = value;
        }
        if (name === '_aid') {
          console.log('[TMS API] ✅ Updated _aid from cookie:', value.substring(0, 20) + '...');
          this.sessionData.aid = value;
        }
        if (name === '_rid') {
          console.log('[TMS API] ✅ Updated _rid from cookie:', value.substring(0, 20) + '...');
          this.sessionData.rid = value;
        }
      });
    }

    console.log('[TMS API] 🎉 Session UPDATED - NEW VALUES:', {
      aid: this.sessionData.aid ? this.sessionData.aid.substring(0, 20) + '...' : 'none',
      rid: this.sessionData.rid ? this.sessionData.rid.substring(0, 20) + '...' : 'none',
      xsrfToken: this.sessionData.xsrfToken ? this.sessionData.xsrfToken.substring(0, 20) + '...' : 'none',
      sessionId: this.sessionData.sessionId ? this.sessionData.sessionId.substring(0, 20) + '...' : 'none',
    });

    if (!this.sessionData.xsrfToken) {
      console.warn('[TMS API] ⚠️ No XSRF token found in refresh response');
    }
    if (!this.sessionData.aid || !this.sessionData.rid) {
      console.warn('[TMS API] ⚠️ Missing _aid or _rid cookies in refresh response');
    }
    if (!this.sessionData.sessionId) {
      console.warn('[TMS API] ⚠️ No host-session-id found in refresh response');
    }

    return response.data;
  }

  // Stock APIs
  async getLivePrice(_symbol: string, stockId: number) {
    const response = await this.client.get(`${API_PREFIX}/rtApi/ws/stockQuote/${stockId}`);

    // Handle nested response structure
    // Response format: { header: {...}, payload: { data: [...] } }
    if (response.data?.payload?.data && Array.isArray(response.data.payload.data)) {
      const stockData = response.data.payload.data[0];

      // Map the nested structure to the expected flat structure
      return {
        ltp: stockData.ltp,
        change: stockData.change,
        changePercent: stockData.changePercentage,
        openPrice: stockData.openPrice,
        dayHigh: stockData.dayHigh,
        dayLow: stockData.dayLow,
        closePrice: stockData.closePrice,
        volume: stockData.volume,
        totalTrade: stockData.totalTradedQty,
        averageTradedPrice: stockData.averageTradedPrice,
        lastTradedTime: stockData.lastTradedTime,
        turnover: stockData.volume * stockData.averageTradedPrice, // Calculate turnover
        fiftyTwoWeekHigh: stockData.security?.fiftyTwoWeekhigh,
        fiftyTwoWeekLow: stockData.security?.fiftyTwoWeekLow,
      };
    }

    // Fallback to original data structure if format is different
    return response.data;
  }

  async getOHLC(stockId: number, isin: string) {
    const response = await this.client.get(`${API_PREFIX}/rtApi/stock/validation/ohlc/${stockId}/${isin}`);

    // Handle nested response structure
    // Response format: { status: "200", level: null, message: "Success", data: {...} }
    if (response.data?.status === "200" && response.data?.data) {
      const ohlcData = response.data.data;

      // Map to expected structure
      return {
        ltp: ohlcData.ltp,
        open: ohlcData.openPrice,
        high: ohlcData.dayHigh,
        low: ohlcData.dayLow,
        close: ohlcData.closePrice,
        previousClose: ohlcData.closePrice, // Use closePrice as previousClose
        fiftyTwoWeekHigh: ohlcData.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: ohlcData.fiftyTwoWeekLow,
        averageTradedPrice: ohlcData.averageTradedPrice,
      };
    }

    // Fallback to original data structure
    return response.data;
  }

  async getSTP(isin: string, code: string = 'LTPCF') {
    const response = await this.client.get(`${API_PREFIX}/orderApi/stock/validation/stp/${isin}/${code}`);
    return response.data;
  }

  // Order APIs
  async placeOrder(orderPayload: any) {
    const response = await this.client.post(`${API_PREFIX}/orderApi/order/`, orderPayload);
    return response.data;
  }

  // Client API
  async getClientInfo(ucc: string, memberCode: string = 'PG') {
    const response = await this.client.get(
      `${API_PREFIX}/masterclients/clientsSearchInfo?ucc=${ucc}&contactPerson=null&memberCode=${memberCode}&clientOrDealer=C&`
    );
    return response.data;
  }

  // Get current user's client details
  async getMyClientDetails() {
    // Default UCC for the logged-in user
    const defaultUCC = '201811020695929';
    const response = await this.client.get(
      `${API_PREFIX}/masterclients/clientsSearchInfo?ucc=${defaultUCC}&contactPerson=null&memberCode=PG&clientOrDealer=C&`
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
      `${API_PREFIX}/masterclients/clientsSearchInfo?ucc=${searchTerm}&contactPerson=null&memberCode=${memberCode}&clientOrDealer=C&`
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
