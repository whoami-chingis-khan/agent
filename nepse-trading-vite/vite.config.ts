import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tmsapi': {
        target: 'https://tms56.nepsetms.com.np',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
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
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
})
