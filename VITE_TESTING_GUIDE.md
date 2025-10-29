# 🧪 Vite App Testing Guide

## ✅ Current Status

### Completed ✓
- [x] Vite proxy configuration with cookie injection
- [x] TMS API client service with auto-refresh
- [x] Session Manager component with header parsing
- [x] Live Price Monitor component
- [x] Simple Order component
- [x] IPO Sniper component
- [x] Zustand state management with persistence
- [x] Golden ratio dark mode design
- [x] Development server running on http://localhost:5176/

### Ready to Test 🚀
All components are functional and ready for end-to-end testing.

---

## 🎯 Testing Checklist

### 1. Session Activation Test

**Goal:** Verify that header parsing and session activation work correctly.

#### Steps:
1. Open **http://localhost:5176/** in Chrome
2. Open DevTools (F12) and go to **Console** tab
3. Navigate to **Session** tab in the app
4. Open TMS in another tab: **https://tms56.nepsetms.com.np**
5. Log in to TMS
6. In TMS DevTools → Network tab, find any API request
7. Click on request → Headers section
8. Copy **ALL request headers** including:
   - `x-xsrf-token`
   - `host-session-id`
   - `membercode`
   - `request-owner`
   - `cookie` (should contain `_aid`, `_rid`, `XSRF-TOKEN`)

#### Option A: Paste as JSON
```json
{
  "x-xsrf-token": "your-token-here",
  "host-session-id": "your-session-here",
  "membercode": "56",
  "request-owner": "25717",
  "cookie": "XSRF-TOKEN=xxx; _aid=yyy; _rid=zzz"
}
```

#### Option B: Paste as Raw Headers
```
x-xsrf-token
your-token-here
host-session-id
your-session-here
membercode
56
request-owner
25717
cookie
XSRF-TOKEN=xxx; _aid=yyy; _rid=zzz
```

#### Expected Result:
- ✅ "Session is active and ready" message appears
- ✅ Console shows: `[Session Store] Updating headers:`
- ✅ Console shows: `[TMS API] Session data updated:`
- ✅ Green checkmark icon visible
- ✅ Client Details section available
- ❌ No error messages

---

### 2. Client Info Test

**Goal:** Verify that the app can fetch client details using the session.

#### Steps:
1. After session activation, click **"Fetch Details"** button
2. Watch Console for API calls

#### Expected Result:
- ✅ Console shows: `[TMS API] Request headers:` with all auth data
- ✅ Console shows: `[Vite Proxy] Injected cookies from X-TMS-Cookies header`
- ✅ Console shows: `[TMS API] Response received:` with client data
- ✅ UI displays:
  - UCC (e.g., 201811020695929)
  - Client Code (e.g., 881337)
  - Client Name
  - DP ID (if available)
- ❌ No 401/403 errors

---

### 3. Live Price Test

**Goal:** Verify that live price monitoring works for a stock.

#### Steps:
1. Navigate to **Orders** tab
2. In **Live Price Monitor** card:
   - Enter stock symbol: `NABIL` (or any listed stock)
   - Enter stock ID: `288` (NABIL's ID)
3. Click **"Fetch Price"**
4. Enable **"Auto-refresh"** toggle
5. Watch price updates every 5 seconds

#### Expected Result:
- ✅ Console shows: `[TMS API] Request headers:` for `/tmsapi/rtApi/ws/stockQuote/288`
- ✅ Console shows: `[Vite Proxy] Sending Request: GET /tmsapi/rtApi/ws/stockQuote/288`
- ✅ Console shows: `[TMS API] Response received:` with stock data
- ✅ UI displays:
  - Last Traded Price (LTP)
  - High/Low prices
  - Volume
  - Percentage change (green/red)
- ✅ Auto-refresh updates every 5 seconds when enabled
- ❌ No network errors

---

### 4. Order Placement Test

**Goal:** Verify that order placement works (use small quantity for testing).

#### Steps:
1. In **Simple Order** card:
   - Select Transaction Type: **Buy** or **Sell**
   - Enter Symbol: `NABIL`
   - Enter Quantity: `10` (minimum)
   - Enter Price: Current LTP from Live Price Monitor
   - Stock ID: `288`
2. Click **"Place Order"**
3. Watch Console for request/response

#### Expected Result:
- ✅ Console shows: `[TMS API] Request headers:` for POST `/tmsapi/orderApi/order/`
- ✅ Console shows request payload with all order details
- ✅ Console shows: `[Vite Proxy] Injected cookies from X-TMS-Cookies header`
- ✅ Console shows: `[TMS API] Response received:` with order confirmation
- ✅ UI shows success message or order ID
- ❌ No validation errors
- ❌ No 401/403 errors

**⚠️ Warning:** This will place a REAL order. Use minimum quantity and cancel immediately in TMS if needed.

---

### 5. IPO Sniper Test

**Goal:** Verify IPO sniper configuration (don't actually execute during testing).

#### Steps:
1. In **IPO Sniper** card:
   - Enter Symbol: `TESTIPO`
   - Enter Quantity: `10`
   - Enter Price: `100`
   - Stock ID: `999`
   - Enable **"Cancel on First Fill"**
2. Click **"Start Sniping"**
3. Immediately click **"Stop Sniping"** (don't let it actually place orders)

#### Expected Result:
- ✅ Console shows: `Starting IPO sniper...`
- ✅ Sniper status changes to "Sniping Active"
- ✅ Console shows periodic price checks
- ✅ Stop button works and halts sniping
- ❌ Should NOT place actual orders during test

---

### 6. Session Persistence Test

**Goal:** Verify that session persists across page refreshes.

#### Steps:
1. Activate session (Test 1)
2. Refresh the page (F5)
3. Watch Console during page load

#### Expected Result:
- ✅ Console shows: `[Session Store] Rehydration starting...`
- ✅ Console shows: `[Session Store] Rehydrating session from localStorage:`
- ✅ Console shows: `[Session Store] Session restored to TMS API successfully`
- ✅ Session status remains "active and ready"
- ✅ No need to re-enter headers
- ❌ Session should NOT be lost

---

### 7. Auto-Refresh Test (Token Expiry)

**Goal:** Verify that the app auto-refreshes when token expires.

#### Steps:
1. Activate session
2. Wait for token to expire (or manually trigger 401 by invalidating cookies)
3. Try to fetch live price or place order

#### Expected Result:
- ✅ Console shows: `ACCESS_TOKEN_EXPIRED` error
- ✅ Console shows: `Auto-refreshing session...`
- ✅ Console shows: `POST /tmsapi/authApi/authenticate/refresh`
- ✅ Request automatically retries after refresh
- ✅ Operation succeeds after refresh
- ❌ User should NOT see error in UI

---

### 8. Vite Proxy Test

**Goal:** Verify that Vite proxy correctly forwards requests and injects cookies.

#### Steps:
1. Open DevTools → Network tab
2. Perform any action (fetch price, place order, etc.)
3. Find request to `/tmsapi/...`
4. Check request headers

#### Expected Result:
- ✅ Request URL starts with `/tmsapi/...` (relative path)
- ✅ Console shows: `[Vite Proxy] Sending Request: GET /tmsapi/...`
- ✅ Console shows: `[Vite Proxy] Injected cookies from X-TMS-Cookies header`
- ✅ Console shows: `[Vite Proxy] Headers:` with x-xsrf-token, host-session-id, Cookie: SET
- ✅ Console shows: `[Vite Proxy] Response: 200 /tmsapi/...`
- ❌ Should NOT see CORS errors
- ❌ Request URL should NOT start with `https://tms56.nepsetms.com.np`

---

## 🔍 Debugging Tips

### Check Console Logs
The app has comprehensive logging. Look for these prefixes:
- `[TMS API]` - TMS API client operations
- `[Vite Proxy]` - Proxy request/response handling
- `[Session Store]` - Session state management
- `[Session Manager]` - UI component actions

### Common Issues

#### 1. "Missing required headers"
**Problem:** Header parsing failed
**Solution:** 
- Ensure you copied ALL headers including cookie
- Try JSON format if raw format fails
- Check Console for parsing errors

#### 2. 401 Unauthorized
**Problem:** Invalid or expired session
**Solution:**
- Get fresh headers from TMS
- Ensure TMS session is still active in browser
- Check that membercode and request-owner are correct

#### 3. 403 Forbidden
**Problem:** Missing membercode or request-owner
**Solution:**
- Verify membercode is "56"
- Verify request-owner is "25717"
- Check proxy logs to confirm headers are sent

#### 4. CORS Error
**Problem:** Request not going through Vite proxy
**Solution:**
- Ensure request URL starts with `/tmsapi/`
- Check vite.config.ts proxy configuration
- Verify TMS_BASE_URL is empty in dev mode

#### 5. Cookies Not Injected
**Problem:** Proxy not receiving X-TMS-Cookies header
**Solution:**
- Check TMS API client is sending cookies via custom header
- Verify sessionData has aid, rid, xsrfToken values
- Check Console for "Sending cookies via X-TMS-Cookies header"

---

## 📊 Expected Console Output (Successful Request)

```
[TMS API] Request headers: {
  x-xsrf-token: "abc123...",
  host-session-id: "def456...",
  membercode: "56",
  request-owner: "25717",
  X-TMS-Cookies: "SET",
  url: "/tmsapi/rtApi/ws/stockQuote/288"
}

[Vite Proxy] Sending Request: GET /tmsapi/rtApi/ws/stockQuote/288
[Vite Proxy] Headers: {
  x-xsrf-token: "abc123...",
  host-session-id: "def456...",
  Cookie: "SET"
}

[Vite Proxy] Response: 200 /tmsapi/rtApi/ws/stockQuote/288

[TMS API] Response received: {
  url: "/tmsapi/rtApi/ws/stockQuote/288",
  status: 200,
  data: { /* stock data */ }
}
```

---

## 🎨 UI Validation

### Golden Ratio Design Checklist
- [ ] Background color is deep black (#0A0A0A)
- [ ] Primary gold color (#D4AF37) used for accents
- [ ] Success actions in green (#3FB950)
- [ ] Error messages in red (#F85149)
- [ ] Spacing follows golden ratio (8px base)
- [ ] Cards have subtle border and shadow
- [ ] Buttons have hover effects
- [ ] Loading states show spinners
- [ ] Icons are properly sized and colored

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Create Production Build**
   ```bash
   cd nepse-trading-vite
   npm run build
   ```

2. **Preview Production Build**
   ```bash
   npm run preview
   ```

3. **Deploy** (optional)
   - Vercel: `vercel`
   - Netlify: `netlify deploy`
   - Static hosting: Copy `dist/` folder

4. **Environment Variables** (if deploying)
   - Set `VITE_TMS_BASE_URL=https://tms56.nepsetms.com.np` for production
   - Configure CORS if needed on backend

---

## 📝 Testing Report Template

```markdown
# Testing Report - [Date]

## Environment
- Browser: Chrome [version]
- Vite Dev Server: http://localhost:5176/
- TMS URL: https://tms56.nepsetms.com.np

## Test Results

### 1. Session Activation
- Status: ✅ Pass / ❌ Fail
- Notes: 

### 2. Client Info
- Status: ✅ Pass / ❌ Fail
- Client ID: 881337
- UCC: 201811020695929
- Notes:

### 3. Live Price
- Status: ✅ Pass / ❌ Fail
- Symbol: NABIL
- Price fetched: 
- Auto-refresh: Working / Not Working
- Notes:

### 4. Order Placement
- Status: ✅ Pass / ❌ Fail
- Order Type: Buy/Sell
- Quantity: 10
- Response: Success / Error
- Notes:

### 5. IPO Sniper
- Status: ✅ Pass / ❌ Fail
- Start/Stop: Working / Not Working
- Notes:

### 6. Session Persistence
- Status: ✅ Pass / ❌ Fail
- After refresh: Session restored / Lost
- Notes:

### 7. Auto-Refresh
- Status: ✅ Pass / ❌ Fail
- Token expired: Handled / Not Handled
- Notes:

### 8. Vite Proxy
- Status: ✅ Pass / ❌ Fail
- Cookies injected: Yes / No
- CORS errors: None / Present
- Notes:

## Issues Found
1. 
2. 
3. 

## Overall Status
✅ All tests passed - Ready for production
⚠️ Minor issues - Needs fixes
❌ Critical issues - Not ready
```

---

## 🎯 Success Criteria

The migration is successful when:
- ✅ Session activation works with both JSON and raw header formats
- ✅ Client info fetches correctly with valid client ID (881337)
- ✅ Live price monitoring works and auto-refreshes
- ✅ Orders can be placed successfully (test with minimum quantity)
- ✅ IPO Sniper starts/stops without errors
- ✅ Session persists across page refreshes
- ✅ Auto-refresh handles token expiry gracefully
- ✅ Vite proxy injects cookies correctly
- ✅ No CORS errors in Console
- ✅ UI follows golden ratio design with dark mode
- ✅ All Console logs are clean and informative

---

## 📞 Support

If you encounter issues during testing:

1. **Check Console Logs** - Most issues are logged with helpful context
2. **Review VITE_MIGRATION_GUIDE.md** - Comprehensive reference documentation
3. **Check TMS Session** - Ensure TMS is logged in and session is active
4. **Verify Headers** - Make sure all required headers are present
5. **Test in Incognito** - Rule out extension interference

**Happy Testing! 🚀**
