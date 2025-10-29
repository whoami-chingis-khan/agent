# Debug Logging Guide

## Overview
Enhanced debug logging has been added to help you see exactly what headers are being sent to the TMS API, especially for order placement and other critical API calls.

## What's Been Added

### 1. **Enhanced Console Logging**
All API requests made through `sessionService.makeRequest()` now automatically log:
- 🚀 Full request details (method, URL, timestamp)
- 📋 Complete headers being sent (with full values, not sanitized)
- 📦 Request body/payload
- ✅ Success response with status and duration
- ❌ Error response with detailed error information

### 2. **Session Header Preparation Logging**
When `getRequestHeaders()` is called, you'll see:
- Which session cookies are available (XSRF-TOKEN, _aid, _rid)
- Which session headers are available (x-xsrf-token, host-session-id, membercode, request-owner)
- Cookie string length
- List of all headers being prepared

## How to Use

### View Logs in Console
When you run your server, you'll automatically see detailed logs in the terminal:

```bash
node server.js
```

Look for these log patterns:

```
🔍 Preparing headers for TMS API request:
Session cookies available: { 'XSRF-TOKEN': true, '_aid': true, '_rid': true }
Session headers available: { 'x-xsrf-token': true, 'host-session-id': true, ... }

╔═══════════════════════════════════════════════════════════════╗
║              🚀 OUTGOING API REQUEST                          ║
╚═══════════════════════════════════════════════════════════════╝
📍 POST https://tms56.nepsetms.com.np/tmsapi/...
⏰ 2025-10-29T...

📋 Request Headers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cookie: XSRF-TOKEN=abc123...; _aid=xyz789...; _rid=...
x-xsrf-token: abc123...
membercode: 56
request-owner: 25717
...
```

### View Logs via API Endpoints
Access debug logs programmatically:

1. **Get last 10 logs:**
   ```
   GET http://localhost:3000/debug/logs?limit=10
   ```

2. **Get the most recent request:**
   ```
   GET http://localhost:3000/debug/last
   ```

3. **Get failed requests only:**
   ```
   GET http://localhost:3000/debug/failed?limit=10
   ```

4. **Get logs for specific endpoint:**
   ```
   GET http://localhost:3000/debug/endpoint?url=clientDealer&limit=5
   ```

5. **Get debug summary:**
   ```
   GET http://localhost:3000/debug/summary
   ```

6. **Clear all logs:**
   ```
   POST http://localhost:3000/debug/clear
   ```

## Troubleshooting 401 Errors

When you see:
```
Failed to fetch client info: Request failed with status code 401
```

Check the debug logs for:

### 1. **Missing Headers**
Look for the "Preparing headers" section:
```
Session headers available: {
  'x-xsrf-token': false,  // ❌ Missing!
  'host-session-id': true,
  'membercode': true,
  'request-owner': true
}
```

### 2. **Missing Cookies**
```
Session cookies available: {
  'XSRF-TOKEN': false,  // ❌ Missing!
  '_aid': true,
  '_rid': true
}
```

### 3. **Mismatched Values**
In the "Request Headers" section, verify:
- `x-xsrf-token` matches the value in the `cookie` header's `XSRF-TOKEN`
- `membercode` is present (should be '56')
- `request-owner` is present (your client ID)

## What to Look For

### Correct Header Pattern:
```
cookie: XSRF-TOKEN=abc123def456; _aid=xyz789; _rid=pqr012
x-xsrf-token: abc123def456
host-session-id: some-session-id
membercode: 56
request-owner: 25717
```

### Common Issues:

1. **Cookie not being sent:**
   - Cookie string is empty or very short
   - Missing XSRF-TOKEN, _aid, or _rid

2. **x-xsrf-token mismatch:**
   - x-xsrf-token header doesn't match XSRF-TOKEN cookie value

3. **Missing authentication headers:**
   - membercode or request-owner not being sent

## Next Steps

1. **Restart your server** to enable the new logging
2. **Update headers** via `/update-headers` endpoint
3. **Make a test API call** and watch the console output
4. **Check the debug logs** to see exactly what's being sent
5. **Compare with working requests** from the browser

## Example: Debugging Order Placement

When placing an order, you'll see:
```
🔍 Preparing headers for TMS API request:
...

╔═══════════════════════════════════════════════════════════════╗
║              🚀 OUTGOING API REQUEST                          ║
╚═══════════════════════════════════════════════════════════════╝
📍 POST https://tms56.nepsetms.com.np/tmsapi/order/saveorder
...

📋 Request Headers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cookie: XSRF-TOKEN=...; _aid=...; _rid=...
x-xsrf-token: ...
membercode: 56
request-owner: 25717
...

📦 Request Body:
{
  "symbol": "NABIL",
  "quantity": 10,
  ...
}
```

If you get a 401 error, the logs will show:
```
╔═══════════════════════════════════════════════════════════════╗
║              ❌ REQUEST FAILED                                ║
╚═══════════════════════════════════════════════════════════════╝
🚫 ERROR: Request failed with status code 401
📊 Status: 401 Unauthorized
📥 Response Data:
{
  "message": "UNAUTHORIZED_ACCESS",
  "errorCode": "401"
}
```

This tells you that your session headers are invalid or expired.

## Tips

- The logs show **actual values** (not sanitized), so be careful when sharing logs
- Cookie values are shown in full for debugging
- Check logs immediately after a failed request
- Use `/debug/last` endpoint to programmatically check the last request
- Compare working vs. failing requests by looking at header differences
