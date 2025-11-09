# Vercel Session Refresh Fix

## Problem
When deployed to Vercel, the app was experiencing `ACCESS_TOKEN_EXPIRED` errors. The refresh endpoint would return new cookies, but subsequent API calls would still use the old expired cookies.

## Root Cause
1. In development, Vite's proxy automatically forwards `set-cookie` headers from TMS API responses
2. In production (Vercel), the serverless function (`api/tmsapi.js`) was not extracting the `set-cookie` headers from the refresh response
3. The client's `refreshSession()` method couldn't access the new cookies to update them

## Solution

### 1. Serverless Function Cookie Extraction (`api/tmsapi.js`)
```javascript
// For refresh endpoint, extract and return cookies
if (path.includes('/authApi/authenticate/refresh') && response.ok) {
  console.log('[Vercel API] Refresh response - extracting cookies');
  
  // Extract all set-cookie headers (fetch API can have multiple)
  const cookies = [];
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') {
      cookies.push(value);
    }
  });
  
  if (cookies.length > 0) {
    console.log('[Vercel API] Found cookies:', cookies.length);
    // Add cookies to response data so client can update them
    data._cookies = cookies;
  }
}
```

**Key Points:**
- Uses `response.headers.forEach()` to iterate over all headers
- Captures all `set-cookie` headers (there may be multiple)
- Adds cookies to response body as `_cookies` property
- Only does this for the refresh endpoint

### 2. Client Refresh Method (`src/services/tmsApi.ts`)
```typescript
async refreshSession() {
  const response = await this.client.post(`${API_PREFIX}/authApi/authenticate/refresh`, {});
  
  console.log('[TMS API] Refresh response:', response.data);
  
  // In Vercel, cookies are in response._cookies (added by serverless function)
  // In dev, cookies are in response.headers['set-cookie']
  const setCookie = response.data._cookies || response.headers['set-cookie'];
  
  if (setCookie) {
    console.log('[TMS API] Updating session with new cookies');
    // Parse and update cookies
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    cookies.forEach((cookie: string) => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name === 'XSRF-TOKEN') this.sessionData.xsrfToken = value;
      if (name === '_aid') this.sessionData.aid = value;
      if (name === '_rid') this.sessionData.rid = value;
    });
    
    console.log('[TMS API] Session updated:', {
      aid: this.sessionData.aid?.substring(0, 10) + '...',
      rid: this.sessionData.rid?.substring(0, 10) + '...',
      xsrfToken: this.sessionData.xsrfToken?.substring(0, 10) + '...',
    });
  }
  
  return response.data;
}
```

**Key Points:**
- Checks `response.data._cookies` first (Vercel) then falls back to `response.headers['set-cookie']` (dev)
- Handles both array and string cookie formats
- Updates `this.sessionData` immediately
- Logs the update for debugging
- Request interceptor will automatically use updated cookies on next request

## How It Works

### Flow Diagram
```
1. Client makes API call with expired cookies
   ↓
2. TMS API returns 401 Unauthorized
   ↓
3. Response interceptor catches 401
   ↓
4. Calls refreshSession()
   ↓
5. Serverless function forwards to TMS refresh endpoint
   ↓
6. TMS returns new cookies in set-cookie headers
   ↓
7. Serverless function extracts cookies, adds to response body as _cookies
   ↓
8. Client receives response with _cookies array
   ↓
9. refreshSession() parses _cookies and updates this.sessionData
   ↓
10. Original request is retried
    ↓
11. Request interceptor uses NEW cookies from this.sessionData
    ↓
12. Success! ✅
```

## Testing Checklist

### Local Development
- [x] Build succeeds without errors
- [ ] Dev server works with Vite proxy
- [ ] Session refresh works in dev mode
- [ ] Cookies visible in browser DevTools

### Vercel Production
- [ ] Deploy to Vercel
- [ ] Activate session with browser headers
- [ ] Monitor stock price (should trigger refresh after ~15 minutes)
- [ ] Verify no ACCESS_TOKEN_EXPIRED errors
- [ ] Check Vercel logs for cookie extraction logs
- [ ] Confirm monitoring continues after refresh

## Build Output
```
vite v7.1.12 building for production...
✓ 1744 modules transformed.
dist/index.html                   0.47 kB │ gzip:  0.30 kB
dist/assets/index-BZXtP6O5.css   14.45 kB │ gzip:  3.24 kB
dist/assets/index-CqAUCqU5.js   284.44 kB │ gzip: 89.01 kB
✓ built in 2.24s
```

## Deployment Steps

1. **Build Production Bundle**
   ```bash
   npm run build
   ```

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "fix: session refresh cookie propagation in Vercel"
   git push origin main
   ```

3. **Deploy to Vercel**
   - Vercel auto-deploys from GitHub
   - Or use `vercel --prod` command

4. **Test Session Refresh**
   - Open Vercel deployment URL
   - Activate session from Session Manager tab
   - Go to Live Price Monitor
   - Add stock symbol and monitor
   - Wait for session expiry (~15 minutes)
   - Verify refresh happens automatically
   - Check Vercel logs for refresh success

## Debugging

### Enable Console Logs
All key operations now have console logs:
- `[Vercel API]` - Serverless function operations
- `[TMS API]` - Client-side TMS API operations

### Check Vercel Logs
```bash
vercel logs [deployment-url]
```

Look for:
- `Refresh response - extracting cookies`
- `Found cookies: 3` (should see _aid, _rid, XSRF-TOKEN)
- `Session updated` with truncated cookie values

### Common Issues

**Cookies not extracted**
- Check if refresh endpoint path matches: `/authApi/authenticate/refresh`
- Verify TMS API returns set-cookie headers
- Check Vercel logs for cookie count

**Cookies not used after refresh**
- Verify request interceptor builds X-TMS-Cookies header
- Check sessionData is updated (console logs)
- Ensure no caching of old cookie values

**Still getting 401 after refresh**
- Session may be fully expired (require browser re-login)
- Check if _aid/_rid/_XSRF-TOKEN are all present
- Verify membercode and request-owner headers are correct

## Files Modified
- `api/tmsapi.js` - Added cookie extraction logic
- `src/services/tmsApi.ts` - Updated refreshSession() to use _cookies from response body
- `dist/*` - New production build

## Next Steps
1. Deploy to Vercel
2. Test complete refresh flow
3. Monitor for any remaining issues
4. Update main README with deployment instructions
