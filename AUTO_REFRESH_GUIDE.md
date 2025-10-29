# 🔄 Automatic Token Refresh Guide

## How It Works

The system now **automatically refreshes tokens** only when needed - specifically when the API returns `ACCESS_TOKEN_EXPIRED`.

## The Flow

```
1. You make an API call (e.g., place order, fetch client info)
   ↓
2. API responds with one of:
   
   ✅ SUCCESS (200) → Return response
   
   ❌ 401 + "ACCESS_TOKEN_EXPIRED" → Auto-refresh and retry
      ↓
      Call refresh API
      ↓
      Update session with new tokens
      ↓
      Print fresh session data
      ↓
      Retry original request with new tokens
      ↓
      Return response
   
   ❌ Other errors → Throw error
```

## Key Features

### 1. Smart Token Refresh
- ✅ **Only refreshes when tokens expire** (`ACCESS_TOKEN_EXPIRED`)
- ✅ **Automatically retries** the original request with fresh tokens
- ✅ **Prints session data** every time tokens are refreshed
- ✅ **Handles TOKEN_NOT_EXPIRED** gracefully (tokens still valid)

### 2. Visual Session Display
Every time tokens are refreshed, you'll see:

```
════════════════════════════════════════════════════════════════
🎉 SESSION REFRESHED - NEW SESSION DATA:
════════════════════════════════════════════════════════════════

╔═══════════════════════════════════════════════════════════════╗
║                    📋 SESSION STATUS                          ║
╚═══════════════════════════════════════════════════════════════╝

🔐 AUTHENTICATION:
   ✓ Has Auth: ✅ YES
   ✓ Is Valid: ✅ YES
   ✓ Last Checked: 10/29/2025, 8:05:09 AM

👤 USER INFO:
   ✓ Member Code: 56
   ✓ Request Owner: 25717
   ✓ Has Client Info: ✅ YES

🍪 COOKIES:
   ✓ XSRF-TOKEN: f4a1928a-e118-4a5a-82da-e058d1c13853...
   ✓ _aid: eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..VhTRbFizmkSP13Jc...
   ✓ _rid: eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..NMPjtygG7o8xzfez...

📝 HEADERS:
   ✓ x-xsrf-token: f4a1928a-e118-4a5a-82da-e058d1c13853...
   ✓ host-session-id: TWpRPS00MmU4YjdjZi01MWE3LTQxYTYtOTZlZS0zZjgxMTBiMGM0NTY=
   ✓ membercode: 56
   ✓ request-owner: 25717

╚═══════════════════════════════════════════════════════════════╝
```

## Updated Methods

### `sessionService.makeRequestWithAutoRefresh(config)`
Use this for all API calls that might need token refresh:

```javascript
// Automatically handles token refresh
const response = await sessionService.makeRequestWithAutoRefresh({
  method: 'POST',
  url: 'https://tms56.nepsetms.com.np/tmsapi/orderApi/order/',
  headers: sessionService.getRequestHeaders(),
  data: orderPayload
});
```

### `sessionService.refreshSession()`
Manually refresh session (optional):

```javascript
// Manually refresh tokens
await sessionService.refreshSession();

// If TOKEN_NOT_EXPIRED, prints current session
// If tokens refreshed, prints new session
```

## API Endpoints

### Automatic Refresh Endpoints
These endpoints now use auto-refresh:

- `POST /place-order-raw` - Place order with raw payload
- `POST /place-order` - Place order with simplified payload
- `POST /order/buy` - Buy order
- `POST /order/sell` - Sell order
- `GET /session/client-info/:clientId` - Fetch client info

### Manual Refresh
- `POST /session/refresh` - Manually refresh tokens
- `GET /session/status?detailed=true` - View detailed session status

## Examples

### Example 1: Place Order (Auto-refresh on expiry)

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

**Console Output (if token expired):**
```
📤 Making TMS API request...
   Method: POST
   URL: https://tms56.nepsetms.com.np/tmsapi/orderApi/order/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DETAILED HEADERS BEING SENT:
[... headers shown ...]

❌ Request failed: Request failed with status code 401
   Status: 401
   Data: { message: 'ACCESS_TOKEN_EXPIRED' }

⚠️ ACCESS TOKEN EXPIRED - Auto-refreshing session...

🔄 Refreshing session tokens...
✅ Session refresh successful

════════════════════════════════════════════════════════════════
🎉 SESSION REFRESHED - NEW SESSION DATA:
════════════════════════════════════════════════════════════════
[... session details shown ...]

✅ Session refreshed successfully, retrying original request...

📤 Making TMS API request...
   Method: POST
   URL: https://tms56.nepsetms.com.np/tmsapi/orderApi/order/

✅ Response: 200 OK
Order placed successfully!
```

### Example 2: Fetch Client Info (Auto-refresh)

```bash
GET http://localhost:3000/session/client-info/25717
```

If token is expired, it will:
1. Detect `ACCESS_TOKEN_EXPIRED`
2. Call refresh API
3. Show fresh session data
4. Retry the client info request
5. Return the result

### Example 3: Manual Refresh

```bash
POST http://localhost:3000/session/refresh
```

**Response when tokens not expired:**
```json
{
  "ok": true,
  "message": "Session refreshed successfully",
  "refreshResult": {
    "status": "200",
    "message": "TOKEN_NOT_EXPIRED",
    "data": {
      "note": "Tokens are still valid, no refresh performed"
    }
  },
  "session": {
    "hasAuth": true,
    "lastCheckedFormatted": "10/29/2025, 8:05:09 AM",
    "membercode": "56",
    "requestOwner": "25717",
    "cookies": { ... },
    "headers": { ... }
  }
}
```

**Console output:**
```
ℹ️ Tokens are still valid, no refresh needed

════════════════════════════════════════════════════════════════
🎉 CURRENT SESSION DATA (Tokens still valid):
════════════════════════════════════════════════════════════════
[... session details shown ...]
```

## Benefits

1. ✅ **No premature refreshes** - Only refresh when actually needed
2. ✅ **Automatic retry** - Original request automatically retried with fresh tokens
3. ✅ **Full visibility** - See session data every time tokens are refreshed
4. ✅ **Error handling** - Gracefully handles TOKEN_NOT_EXPIRED
5. ✅ **Seamless experience** - Your code doesn't need to handle refresh logic

## Testing

To test the auto-refresh:

1. Start the server:
```bash
node server.js
```

2. Update headers from browser:
```bash
POST http://localhost:3000/update-headers
```

3. Wait for token to expire (or manually force expiration in TMS)

4. Place an order:
```bash
POST http://localhost:3000/place-order
{
  "scrip": "NMB",
  "quantity": 10,
  "price": 450,
  "action": "BUY"
}
```

5. Watch the console - you'll see:
   - Initial request attempt
   - Detection of ACCESS_TOKEN_EXPIRED
   - Automatic refresh
   - Fresh session data display
   - Retry of original request
   - Success!

## Summary

**Before:** Manual refresh before each order → tokens might not be expired → unnecessary API calls

**Now:** Automatic refresh only on expiry → fresh tokens → seamless retry → visible session data

🎉 **You always see the fresh session data when tokens are refreshed!**
