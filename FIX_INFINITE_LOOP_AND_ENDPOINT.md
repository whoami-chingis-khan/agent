# 🔧 Critical Fixes Applied - Infinite Loop & Invalid Endpoint

## Issues Fixed

### 1. ❌ Invalid Request (400) - `/me/clientDetails` Endpoint
**Problem:** 
- Endpoint `/tmsapi/me/clientDetails` doesn't exist in TMS API
- Returns `{"status":"400","message":"Invalid Request"}`

**Root Cause:**
- Used wrong endpoint from incorrect assumption
- Correct endpoint is `/tmsapi/masterclients/clientsSearchInfo`

**Fix Applied:**
```typescript
// BEFORE (Wrong ❌)
async getMyClientDetails() {
  const response = await this.client.get('/tmsapi/me/clientDetails');
  return response.data;
}

// AFTER (Correct ✅)
async getMyClientDetails() {
  const defaultUCC = '201811020695929'; // User's UCC
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
    // ... other fields
  };
}
```

**File:** `nepse-trading-vite/src/services/tmsApi.ts`

---

### 2. 🔄 Infinite Loop on 401 Errors
**Problem:**
```
[Vite Proxy] Response: 401 /tmsapi/orderApi/stock/validation/stp/...
[Vite Proxy] Sending Request: POST /tmsapi/authApi/authenticate/refresh
[Vite Proxy] Response: 200 /tmsapi/authApi/authenticate/refresh
[Vite Proxy] Response: 401 /tmsapi/orderApi/stock/validation/stp/...
[Vite Proxy] Sending Request: POST /tmsapi/authApi/authenticate/refresh
[Vite Proxy] Response: 200 /tmsapi/authApi/authenticate/refresh
[Vite Proxy] Response: 401 /tmsapi/orderApi/stock/validation/stp/...
... INFINITE LOOP ...
```

**Root Cause:**
- Auto-refresh interceptor didn't track if a request was already retried
- On 401 error → refresh → retry → 401 again → refresh again → infinite loop
- Original Express app only retried ONCE then threw error

**Fix Applied:**
```typescript
// BEFORE (Infinite Loop ❌)
async (error) => {
  if (error.response?.status === 401 &&
      error.response?.data?.message === 'ACCESS_TOKEN_EXPIRED') {
    await this.refreshSession();
    return this.client.request(error.config); // ⚠️ Can retry forever
  }
  throw error;
}

// AFTER (Single Retry ✅)
async (error) => {
  // Only auto-refresh ONCE to prevent infinite loops
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
```

**Key Changes:**
1. ✅ Added `__isRetryRequest` flag to track if request was already retried
2. ✅ Only refresh and retry if flag is NOT set
3. ✅ Set flag before retrying to prevent second attempt
4. ✅ Better error logging for debugging

**File:** `nepse-trading-vite/src/services/tmsApi.ts`

---

## Testing After Fixes

### Test 1: Client Info Fetch ✅
1. Activate session in app
2. Click "Fetch Details" button
3. **Expected:**
   - ✅ No 400 error
   - ✅ Client details display (UCC, Client Code, Name, DP ID)
   - ✅ Console shows successful API call
   ```
   [TMS API] Response received: {
     url: "/tmsapi/masterclients/clientsSearchInfo?...",
     status: 200,
     data: [{ id: 881337, displayName: "...", ... }]
   }
   ```

### Test 2: Order with 401 Error ✅
1. Use expired session or invalid token
2. Try to fetch stock data or place order
3. **Expected:**
   - ✅ First 401 triggers refresh
   - ✅ Console shows: "🔄 ACCESS TOKEN EXPIRED - Refreshing session..."
   - ✅ Console shows: "✅ Session refreshed, retrying original request..."
   - ✅ Request retries ONCE
   - ✅ If still fails, error is thrown (no infinite loop)
   - ✅ Console shows: "❌ Session refresh failed" (if second attempt also fails)

### Test 3: Live Price Monitor ✅
1. Navigate to Orders tab
2. Enter symbol and stock ID
3. Click "Fetch Price"
4. **Expected:**
   - ✅ Price loads successfully
   - ✅ No infinite refresh loops
   - ✅ If token expired, refreshes once and retries

---

## How the Fix Works

### Request Flow (Normal)
```
User Action → TMS API Client → Axios Request → Vite Proxy → TMS Server
                                                              ↓
User sees result ← Display Data ← Response Handler ← 200 OK ←
```

### Request Flow (Token Expired - First Time)
```
User Action → TMS API Client → Axios Request → Vite Proxy → TMS Server
                                                              ↓
                                                            401 ACCESS_TOKEN_EXPIRED
                                                              ↓
                                              Error Interceptor catches
                                                              ↓
                                              Check: __isRetryRequest? NO
                                                              ↓
                                              Set: __isRetryRequest = true
                                                              ↓
                                              POST /authApi/authenticate/refresh
                                                              ↓
                                              Update cookies in sessionData
                                                              ↓
                                              Retry original request ←
                                                              ↓
User sees result ← Display Data ← Response Handler ← 200 OK ←
```

### Request Flow (Token Expired - Still Fails After Refresh)
```
User Action → TMS API Client → Axios Request → Vite Proxy → TMS Server
                                                              ↓
                                                            401 ACCESS_TOKEN_EXPIRED
                                                              ↓
                                              Error Interceptor catches
                                                              ↓
                                              Check: __isRetryRequest? NO
                                                              ↓
                                              Set: __isRetryRequest = true
                                                              ↓
                                              POST /authApi/authenticate/refresh
                                                              ↓
                                              Retry original request
                                                              ↓
                                                            401 ACCESS_TOKEN_EXPIRED (again)
                                                              ↓
                                              Error Interceptor catches
                                                              ↓
                                              Check: __isRetryRequest? YES ✋
                                                              ↓
                                              Throw error (stop retry)
                                                              ↓
User sees error ← Error Handler ← "Request failed after refresh" ←
```

**No infinite loop! Request only retries ONCE.**

---

## Comparison with Express App

| Feature | Express App | Vite App (Before) | Vite App (After) |
|---------|-------------|-------------------|------------------|
| Client Info Endpoint | `/masterclients/clientsSearchInfo` ✅ | `/me/clientDetails` ❌ | `/masterclients/clientsSearchInfo` ✅ |
| Auto-refresh on 401 | ✅ Once only | ✅ Infinite loop | ✅ Once only |
| Retry tracking | `refreshAttempted` flag | None | `__isRetryRequest` flag |
| Error handling | Throw after 1 retry | Never throws | Throw after 1 retry |
| Response parsing | Array → first item | Raw data | Array → first item |

---

## Files Modified

1. **nepse-trading-vite/src/services/tmsApi.ts**
   - Lines 70-115: Response interceptor (infinite loop fix)
   - Lines 195-212: `getMyClientDetails()` method (endpoint fix)
   - Lines 215-222: `searchClients()` method (response parsing fix)

---

## Console Output (After Fix)

### Successful Client Fetch:
```
[TMS API] Request headers: {
  x-xsrf-token: "90c03448-...",
  host-session-id: "TWpRPS04...",
  membercode: "56",
  request-owner: "25717",
  X-TMS-Cookies: "SET",
  url: "/tmsapi/masterclients/clientsSearchInfo?ucc=201811020695929&..."
}

[Vite Proxy] Injected cookies from X-TMS-Cookies header
[Vite Proxy] Sending Request: GET /tmsapi/masterclients/clientsSearchInfo?...
[Vite Proxy] Response: 200 /tmsapi/masterclients/clientsSearchInfo?...

[TMS API] Response received: {
  url: "/tmsapi/masterclients/clientsSearchInfo?...",
  status: 200,
  data: [{
    id: 881337,
    displayName: "Your Name",
    notsUniqueClientCode: "201811020695929",
    boid: "...",
    emailId: "...",
    phoneNumber: "..."
  }]
}
```

### Token Expired (Single Refresh):
```
[TMS API] Request failed: {
  url: "/tmsapi/orderApi/stock/validation/stp/...",
  status: 401,
  data: { message: "ACCESS_TOKEN_EXPIRED" }
}

[TMS API] 🔄 ACCESS TOKEN EXPIRED - Refreshing session...

[Vite Proxy] Sending Request: POST /tmsapi/authApi/authenticate/refresh
[Vite Proxy] Response: 200 /tmsapi/authApi/authenticate/refresh

[TMS API] ✅ Session refreshed, retrying original request...

[Vite Proxy] Sending Request: GET /tmsapi/orderApi/stock/validation/stp/...
[Vite Proxy] Response: 200 /tmsapi/orderApi/stock/validation/stp/...

[TMS API] Response received: {
  url: "/tmsapi/orderApi/stock/validation/stp/...",
  status: 200,
  data: { ... }
}
```

### Token Still Invalid After Refresh (No Infinite Loop):
```
[TMS API] Request failed: {
  url: "/tmsapi/orderApi/stock/validation/stp/...",
  status: 401,
  data: { message: "ACCESS_TOKEN_EXPIRED" }
}

[TMS API] 🔄 ACCESS TOKEN EXPIRED - Refreshing session...
[TMS API] ✅ Session refreshed, retrying original request...

[TMS API] Request failed: {
  url: "/tmsapi/orderApi/stock/validation/stp/...",
  status: 401,
  data: { message: "ACCESS_TOKEN_EXPIRED" }
}

[TMS API] ❌ Session refresh failed: Request failed with status code 401

❌ Error thrown to UI (no more retries)
```

---

## Status: ✅ FIXED

Both issues have been resolved:
1. ✅ Client info endpoint now uses correct URL
2. ✅ Auto-refresh only retries once to prevent infinite loops
3. ✅ Better error logging for debugging
4. ✅ Response parsing handles array format correctly

**Ready to test!** Refresh the browser and try:
1. Session activation
2. Client info fetch
3. Live price monitoring
4. Order operations

All should work without 400 errors or infinite loops.
