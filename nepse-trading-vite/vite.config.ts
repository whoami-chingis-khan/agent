import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tmsapi': {
        target: 'https://tms56.nepsetms.com.np', // Default, can be overridden per request
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // CRITICAL: Support dynamic TMS provider per client
            const tmsProviderHeader = req.headers['x-tms-provider'];
            const tmsProvider = Array.isArray(tmsProviderHeader) ? tmsProviderHeader[0] : tmsProviderHeader;
            
            if (tmsProvider) {
              // Override target URL dynamically
              proxyReq.path = tmsProvider.replace(/^https?:\/\/[^\/]+/, '') + proxyReq.path;
              proxyReq.setHeader('Host', new URL(tmsProvider).host);
              console.log('[Vite Proxy] Using TMS Provider:', tmsProvider);
            }
            
            // Inject cookies from custom header
            // Frontend sends cookies via X-TMS-Cookies header to bypass browser restrictions
            const customCookies = req.headers['x-tms-cookies'];
            if (customCookies) {
              proxyReq.setHeader('Cookie', customCookies);
              console.log('[Vite Proxy] Injected cookies from X-TMS-Cookies header');
            }

            console.log('[Vite Proxy] Sending Request:', req.method, req.url);
            console.log('[Vite Proxy] Headers:', {
              'x-xsrf-token': req.headers['x-xsrf-token'],
              'host-session-id': req.headers['host-session-id'],
              'Cookie': customCookies ? 'SET' : 'NOT SET',
            });
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);

            // Capture Set-Cookie headers and send them back in a custom header
            // This allows the frontend to access cookies that would normally be hidden
            const setCookieHeaders = proxyRes.headers['set-cookie'];
            if (setCookieHeaders && setCookieHeaders.length > 0) {
              console.log('[Vite Proxy] Captured Set-Cookie headers:', setCookieHeaders);
              // Send cookies back via custom header that JavaScript can read
              res.setHeader('X-Set-Cookie', JSON.stringify(setCookieHeaders));
            }

            // Also capture and forward other important headers
            const newXsrfToken = proxyRes.headers['x-xsrf-token'];
            const newSessionId = proxyRes.headers['host-session-id'];

            if (newXsrfToken) {
              console.log('[Vite Proxy] Captured x-xsrf-token:', newXsrfToken);
              res.setHeader('X-New-Xsrf-Token', newXsrfToken);
            }

            if (newSessionId) {
              console.log('[Vite Proxy] Captured host-session-id:', newSessionId);
              res.setHeader('X-New-Session-Id', newSessionId);
            }
          });
        },
      },
    },
  },
})
