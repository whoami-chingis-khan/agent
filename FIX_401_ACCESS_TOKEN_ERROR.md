# Fixing 401 ACCESS_TOKEN_MISSING Error

## The Problem

You're getting:
```json
{"status":"401","level":"OAUTH","message":"ACCESS_TOKEN_MISSING","data":null}
```

This means:
- ✅ Headers ARE being sent correctly (we confirmed this)
- ✅ Vite proxy is working
- ❌ TMS API needs cookies that browsers can't send cross-origin

---

## Why Cookies Aren't Working

The TMS API looks for access tokens in **HTTP-only cookies** which:
1. Cannot be set by JavaScript (forbidden by browsers)
2. Cannot be sent cross-origin without server cooperation
3. Must be set by the TMS server itself via `Set-Cookie` headers

Even with the Vite proxy, cookies from `tms56.nepsetms.com.np` won't be automatically sent because your browser thinks you're accessing `localhost:5174`.

---

## Solutions (Choose One)

### ✅ Solution 1: Use Browser Extension (EASIEST)

This is the **most reliable** way to test locally.

**Step 1: Install ModHeader**
- Chrome: https://chrome.google.com/webstore/detail/modheader/idgpnmonknjnojddfkpgkljpfnnfcklj

**Step 2: Configure ModHeader**

1. Click ModHeader icon → Create new profile "TMS API"

2. **Add Request Headers:**
   ```
   x-xsrf-token: 90c03448-3e1b-4acb-899f-b2b4c87f80d4
   host-session-id: TVRJPS03ZjQ3ZTQzNi0zMTU2LTRkZTAtOGM5Zi00YTkyMWQyMjAxODM=
   membercode: 56
   request-owner: 25717
   ```

3. **Add Request Cookies:**
   ```
   XSRF-TOKEN=90c03448-3e1b-4acb-899f-b2b4c87f80d4
   _aid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..3uG-e8UPDegT42rJ...(full value from your cookie header)
   _rid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..SUIbBsrilKcqmcUH...(full value from your cookie header)
   ```

4. **Set Filter:**
   ```
   Filter by: URL Pattern
   Pattern: *tms56.nepsetms.com.np*
   ```
   OR if using proxy:
   ```
   Pattern: *localhost:5174/tmsapi*
   ```

5. **Enable the profile** (toggle to ON)

6. **Test**: Refresh the app and try "Start Live Monitoring"

---

### ✅ Solution 2: Login to TMS in Same Browser

This only works if you access TMS directly (not through proxy):

1. Open **new tab**: https://tms56.nepsetms.com.np
2. **Log in** with your credentials
3. **Keep that tab open**
4. Open **another tab**: http://localhost:5174
5. Go to IPO Sniper and try monitoring

Cookies will be sent because same domain.

---

### ✅ Solution 3: Enhanced Vite Proxy (Advanced)

Update the Vite proxy to manually inject cookies:

Edit `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/tmsapi': {
        target: 'https://tms56.nepsetms.com.np',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Manually inject cookies from localStorage
            const cookies = [
              'XSRF-TOKEN=90c03448-3e1b-4acb-899f-b2b4c87f80d4',
              '_aid=eyJlbmMi...(full value)',
              '_rid=eyJlbmMi...(full value)'
            ].join('; ');

            proxyReq.setHeader('Cookie', cookies);
            console.log('[Proxy] Injecting cookies:', cookies);
          });
        },
      },
    },
  },
})
```

**Note**: You need to update cookies in `vite.config.ts` every time they change.

---

## How to Get Fresh Headers & Cookies

### Method 1: From Chrome DevTools

1. Open https://tms56.nepsetms.com.np
2. Log in
3. Press **F12** (DevTools)
4. Go to **Network** tab
5. Click any API request (e.g., to `/ohlc/...`)
6. In **Headers** tab, find:
   - **Request Headers** section
   - Copy `x-xsrf-token`, `host-session-id`, `membercode`, `request-owner`
   - Copy `cookie` header (the FULL value)

### Method 2: From Application Tab

1. Open https://tms56.nepsetms.com.np
2. Log in
3. Press **F12** (DevTools)
4. Go to **Application** tab
5. Under **Cookies** → `https://tms56.nepsetms.com.np`
6. Copy values for:
   - `XSRF-TOKEN`
   - `_aid`
   - `_rid`

---

## Testing the Fix

### Step 1: Configure ModHeader (if using Solution 1)

Set up headers and cookies as shown above.

### Step 2: Paste Headers in Session Manager

1. Go to Session Manager tab
2. Paste your headers:
   ```
   x-xsrf-token: <your-token>
   host-session-id: <your-session>
   membercode: 56
   request-owner: <your-request-owner>
   cookie: XSRF-TOKEN=<token>; _aid=<aid-value>; _rid=<rid-value>
   ```
3. Click "Activate Session"

### Step 3: Fetch Client Details

1. After activating session, click **"Fetch Details"** button
2. If successful, you'll see:
   - UCC
   - Client Code
   - Client Name
   - DP ID

3. If you get 401 error:
   - Cookies aren't being sent
   - Use ModHeader extension

### Step 4: Test IPO Sniper

1. Go to IPO Sniper tab
2. Fill in stock details
3. Click "Start Live Monitoring"
4. Check console for success/error

---

## Expected Console Output (Success)

```
[TMS API] Initializing with baseURL: (using Vite proxy)
[Session Store] Updating headers: {...}
[TMS API] Session data updated: {all fields true}
[TMS API] Request headers: {x-xsrf-token: "...", ...}
[Vite Proxy] Sending Request: GET /tmsapi/me/clientDetails
[Vite Proxy] Response: 200 /tmsapi/me/clientDetails
[Session Manager] Client details fetched: {ucc: "...", clientCode: "...", ...}
```

## Expected Console Output (Still 401)

```
[TMS API] Request headers: {x-xsrf-token: "...", ...}
[Vite Proxy] Sending Request: GET /tmsapi/me/clientDetails
[Vite Proxy] Response: 401 /tmsapi/me/clientDetails
[TMS API] Request failed: {status: 401, data: {message: "ACCESS_TOKEN_MISSING"}}
[Session Manager] Failed to fetch client details: ACCESS_TOKEN_MISSING
```

**This means**: Cookies aren't being sent → Use ModHeader extension

---

## Why This Happens

The TMS API architecture:

```
Authentication = Headers + Cookies

Headers (sent ✅):
- x-xsrf-token
- host-session-id
- membercode
- request-owner

Cookies (NOT sent ❌):
- XSRF-TOKEN  (contains actual access token)
- _aid         (authentication ID)
- _rid         (refresh token ID)
```

Browsers **will not** send cookies for `tms56.nepsetms.com.np` when you're accessing from `localhost:5174`, even with proxy.

**Solution**: Browser extension injects cookies into every request.

---

## Recommended Setup for Development

1. **Install ModHeader** (one-time)
2. **Create TMS profile** (one-time)
3. **Update headers/cookies** when they expire (every few hours)
4. **Enable profile** when testing
5. **Disable profile** when not testing

This gives you the most reliable development experience.

---

## For Production Deployment

In production, you'll need a **backend proxy server** that:

1. Stores session tokens securely
2. Adds cookies to every TMS request
3. Handles token refresh automatically
4. Returns responses to frontend

Example architecture:
```
Frontend → Your Backend API → TMS API
```

Your backend handles all authentication complexity.

---

## Quick Test Command

Paste this in Console to check if cookies are being sent:

```javascript
// Make a test request
fetch('/tmsapi/me/clientDetails', {
  headers: {
    'x-xsrf-token': localStorage.getItem('nepse-session-storage') || 'test'
  },
  credentials: 'include'
})
  .then(r => r.json())
  .then(d => console.log('Response:', d))
  .catch(e => console.error('Error:', e));
```

If you get 401 → ModHeader not configured or disabled.

---

## Summary

1. ✅ **Headers are working** (confirmed)
2. ✅ **Proxy is working** (confirmed)
3. ❌ **Cookies NOT working** (browser limitation)
4. ✅ **Solution**: ModHeader extension

**Install ModHeader and add cookies → Problem solved!** 🎉
