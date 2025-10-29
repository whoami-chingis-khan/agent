# 🔍 Header Debugging Guide

## The Problem

When calling the TMS order placement API, you were getting **401 Unauthorized** errors. The issue is that after the `refresh` API is called, new cookies are returned but the session headers need to be properly extracted and synchronized.

## What Was Fixed

### 1. **Enhanced Debug Logging**
Added comprehensive console logging to show:
- ✅ What cookies are available in the session
- ✅ What headers are being prepared
- ✅ Full cookie strings being sent
- ✅ Response headers received
- ✅ Session updates from responses

### 2. **Response Header Extraction**
Added `updateFromResponse()` method that:
- Extracts `Set-Cookie` headers from responses
- Updates the stored cookies (`_aid`, `_rid`, `XSRF-TOKEN`)
- Syncs the `x-xsrf-token` header with the cookie
- Logs all changes for debugging

### 3. **Detailed Header Printing**
Added `printDetailedHeaders()` method that shows:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DETAILED HEADERS BEING SENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 CRITICAL SESSION HEADERS:
   x-xsrf-token: f4a1928a-e118-4a5a-82da-e058d1c13853
   host-session-id: TWpRPS00MmU4YjdjZi01MWE3LTQxYTYtOTZlZS0zZjgxMTBiMGM0NTY=
   membercode: 56
   request-owner: 25717

🍪 COOKIES:
   XSRF-TOKEN: f4a1928a-e118-4a5a-82da-e058d1c13853
   _aid: eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..VhTRbFizmkSP13Jc...
   _rid: eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..NMPjtygG7o8xzfez...
```

### 4. **Request Wrapper**
All API calls now go through `sessionService.makeRequest()` which:
- Logs the request details
- Prints full headers before sending
- Captures and logs the response
- Automatically extracts and updates session from response
- Logs any errors with full context

## How to Use

### Step 1: Start the Server
```bash
node server.js
```

### Step 2: Update Headers from Browser
1. Open Chrome DevTools on the TMS website
2. Copy your headers from a successful request
3. Send to the server:
```bash
POST http://localhost:3000/update-headers
Content-Type: application/json

{
  "headers": {
    "cookie": "XSRF-TOKEN=xxx; _aid=xxx; _rid=xxx",
    "x-xsrf-token": "xxx",
    "host-session-id": "xxx",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

### Step 3: Run Debug Test
```bash
node test-headers-debug.js
```

This will:
- ✅ Show current session status
- ✅ Call the refresh API with full header logging
- ✅ Show what cookies/headers are updated
- ✅ Test client info fetch
- ✅ Show final session status

### Step 4: Watch the Console Output
You'll see detailed logs like:

```
🔍 Preparing headers for TMS API request:
Session cookies available: { XSRF-TOKEN: true, _aid: true, _rid: true }
Session headers available: { 
  x-xsrf-token: true, 
  host-session-id: true, 
  membercode: true, 
  request-owner: true 
}

📤 Making TMS API request...
   Method: POST
   URL: https://tms56.nepsetms.com.np/tmsapi/authApi/authenticate/refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DETAILED HEADERS BEING SENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Full header details here]

✅ Response: 200 OK

🔄 Extracting session data from response headers...
📦 Found Set-Cookie headers: 3
  ✓ Updated cookie: XSRF-TOKEN = f4a1928a-e118-4a5a-82da-e058d1c13853
  ✓ Updated cookie: _aid = eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0...
  ✓ Updated cookie: _rid = eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0...
  ✓ Synced x-xsrf-token with cookie
✅ Session updated from response
```

## Understanding the Output

### ✅ Successful Request
```
✅ Response: 200 OK
✅ Session updated from response
```
Means the headers were correct and the session was updated.

### ❌ Failed Request
```
❌ Request failed: Request failed with status code 401
   Status: 401
   Data: { error: 'UNAUTHORIZED_ACCESS' }
```
Means the headers are incorrect. Check:
1. Are cookies up to date?
2. Is `host-session-id` correct?
3. Did the session expire?

## Key Points from Your Issue

Based on your `orderissue.txt`:

1. **After refresh**, new cookies are returned in `set-cookie` headers:
   - `_aid` (new token)
   - `_rid` (new token)  
   - `XSRF-TOKEN` (new token)

2. **The `host-session-id` stays the same** in the refresh request (it's in the request headers, not the response)

3. **For subsequent requests**, you MUST use:
   - The NEW cookies from the refresh response
   - The SAME `host-session-id` from before
   - The NEW `x-xsrf-token` (synced with the new `XSRF-TOKEN` cookie)

## Testing Order Placement

Once headers are working, test order placement:

```bash
POST http://localhost:3000/place-order
Content-Type: application/json

{
  "scrip": "NMB",
  "quantity": 10,
  "price": 450.50,
  "action": "BUY"
}
```

Watch the console for the detailed header logs to see exactly what's being sent!

## Debugging Tips

1. **Always check the console output** - it now shows EXACTLY what headers are being sent
2. **Look for the "DETAILED HEADERS BEING SENT" section** - this shows the actual headers
3. **Watch for "Session updated from response"** - this confirms cookies were extracted
4. **If 401 errors persist**, compare your headers with a working browser request

## API Endpoints for Testing

- `GET /session/status` - Check current session status
- `POST /session/refresh` - Refresh the session tokens
- `GET /session/client-info` - Fetch client info (tests if headers work)
- `POST /update-headers` - Update session from browser headers
- `POST /place-order` - Place an order (full test)

---

**Remember**: The detailed header logging will show you EXACTLY what's being sent to the API, so you can compare it with your working browser requests!
