# Testing Authentication Headers - Step by Step Guide

## ✅ What I Just Fixed

1. **Added Detailed Console Logging** - Every request now logs headers being sent
2. **Fixed Session Persistence** - Session data now properly restores from localStorage on page refresh
3. **Added Error Response Logging** - See exactly what error TMS is returning
4. **Session Rehydration** - TMS API client gets session data when app loads

---

## 🧪 How to Test Right Now

### **Step 1: Clear Everything and Start Fresh**

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Under **Storage** → **Local Storage** → `http://localhost:5173`
4. Click "Clear All" or delete these keys:
   - `nepse-session-storage`
   - `stocks-storage`
5. Refresh the page

### **Step 2: Activate Your Session**

1. Go to **Session Manager** tab
2. Paste your authentication headers (the ones you showed me):
   ```
   cookie: XSRF-TOKEN=90c03448-3e1b-4acb-899f-b2b4c87f80d4; _aid=eyJlbmMi...; _rid=eyJlbmMi...
   x-xsrf-token: 90c03448-3e1b-4acb-899f-b2b4c87f80d4
   host-session-id: TWpRPS01NmQwMmE4Yy02NjUxLTRmYTYtOWVjOS1mNmFiMzE3NWQyZTE=
   membercode: 56
   request-owner: 25717
   ```
3. Click **"Activate Session"**

### **Step 3: Check Console Logs**

Open **Console** tab in DevTools. You should see:

```
[Session Store] Updating headers: {...}
[TMS API] Updating session with data: {...}
[TMS API] Session data updated: {
  hasXsrfToken: true,
  hasSessionId: true,
  hasMemberCode: true,
  hasRequestOwner: true,
  hasAid: true,
  hasRid: true
}
```

✅ **If you see this** → Session is activated correctly
❌ **If you don't** → Headers weren't pasted correctly

### **Step 4: Test API Request**

1. Go to **IPO Sniper** tab
2. Fill in stock details:
   - Symbol: NLO
   - Stock ID: 198
   - ISIN: NPE183A00001
   - Previous Close: 100
3. Click **"Start Live Monitoring"**

### **Step 5: Check Request Headers**

In DevTools, go to **Network** tab:

1. Filter by "ohlc" or "stockQuote"
2. Click on any request
3. Look at **Request Headers** section

**You MUST see these 4 headers:**
```
x-xsrf-token: 90c03448-3e1b-4acb-899f-b2b4c87f80d4
host-session-id: TWpRPS01NmQwMmE4Yy02NjUxLTRmYTYtOWVjOS1mNmFiMzE3NWQyZTE=
membercode: 56
request-owner: 25717
```

### **Step 6: Check Console Logs for Requests**

In **Console** tab, you should see:

```
[TMS API] Request headers: {
  x-xsrf-token: "90c03448-3e1b-4acb-899f-b2b4c87f80d4",
  host-session-id: "TWpRPS01NmQwMmE4Yy02NjUxLTRmYTYtOWVjOS1mNmFiMzE3NWQyZTE=",
  membercode: "56",
  request-owner: "25717",
  url: "/tmsapi/rtApi/stock/validation/ohlc/198/NPE183A00001"
}
```

If the request fails, you'll see:
```
[TMS API] Request failed: {
  url: "/tmsapi/rtApi/stock/validation/ohlc/198/NPE183A00001",
  status: 500,
  data: {"status":"500","level":"OAUTH","message":"","data":null},
  headers: {...}
}
```

---

## 🔍 Troubleshooting

### Problem: Headers Not in Request

**Symptom**: Network tab shows no authentication headers

**Causes & Fixes**:

1. **Session Not Activated**
   - Go to Session Manager
   - Paste headers again
   - Check console for "Session data updated"

2. **Page Refreshed Before Activation**
   - Session persistence now works!
   - Refresh the page
   - Check console for: `[Session Store] Rehydrating session from localStorage`
   - If you see "No session to rehydrate" → Activate session again

3. **Headers Pasted Incorrectly**
   - Make sure you're pasting the RAW headers, not JSON
   - Or paste properly formatted JSON like:
     ```json
     {
       "x-xsrf-token": "90c03448-3e1b-4acb-899f-b2b4c87f80d4",
       "host-session-id": "TWpRPS01NmQwMmE4Yy02NjUxLTRmYTYtOWVjOS1mNmFiMzE3NWQyZTE=",
       "membercode": "56",
       "request-owner": "25717",
       "cookie": "XSRF-TOKEN=...; _aid=...; _rid=..."
     }
     ```

### Problem: Still Getting 500 OAUTH Error

**Symptom**: Headers ARE being sent, but still getting 500 error

**This means TMS API requires cookies too!**

**Solutions**:

#### Option A: Use Browser Extension (Recommended)

1. **Install ModHeader** extension
2. Create profile for TMS API
3. Add **Request Headers**:
   ```
   x-xsrf-token: 90c03448-3e1b-4acb-899f-b2b4c87f80d4
   host-session-id: TWpRPS01NmQwMmE4Yy02NjUxLTRmYTYtOWVjOS1mNmFiMzE3NWQyZTE=
   membercode: 56
   request-owner: 25717
   ```
4. Add **Request Cookies**:
   ```
   XSRF-TOKEN=90c03448-3e1b-4acb-899f-b2b4c87f80d4
   _aid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0...(full value)
   _rid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0...(full value)
   ```
5. Set filter to: `*tms56.nepsetms.com.np/*`
6. Enable the profile
7. Test again

#### Option B: Get Fresh Headers

Your headers might be expired:

1. Open TMS website: https://tms56.nepsetms.com.np
2. Log in
3. Open DevTools → Network tab
4. Make any action (search stock, view order book)
5. Click on any API request
6. Copy **ALL** Request Headers
7. Paste in Session Manager
8. Test again

---

## 📊 Expected Console Output (Full Flow)

When everything works correctly:

```
1. On Page Load:
   [Session Store] Rehydration starting... {hasState: true, isAuthenticated: true, hasSessionData: true}
   [Session Store] Rehydrating session from localStorage: {...}
   [TMS API] Updating session with data: {...}
   [TMS API] Session data updated: {hasXsrfToken: true, ...}
   [Session Store] Session restored to TMS API successfully

2. When Starting Monitoring:
   [TMS API] Request headers: {x-xsrf-token: "...", host-session-id: "...", ...}

3. On Successful Request:
   [TMS API] Response received: {
     url: "/tmsapi/rtApi/stock/validation/ohlc/198/NPE183A00001",
     status: 200,
     data: {open: 244.33, high: 244.33, ...}
   }

4. On Failed Request:
   [TMS API] Request failed: {
     url: "...",
     status: 500,
     data: {"status":"500","level":"OAUTH","message":"","data":null},
     headers: {x-xsrf-token: "...", ...}
   }
```

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Console shows "Session data updated" with all fields as `true`
2. ✅ Network tab shows all 4 auth headers in requests
3. ✅ Console shows "Request headers" log before each API call
4. ✅ API returns 200 status instead of 500
5. ✅ Live Price Dashboard appears with actual stock data
6. ✅ Circuit Ladder shows with calculated prices
7. ✅ No "OAUTH" errors in console

---

## 🚨 If Nothing Works

If you've tried everything and still getting errors:

1. **Export your console logs**:
   - Right-click in Console → "Save as..."
   - Send me the log file

2. **Export a Network HAR file**:
   - Network tab → Right-click → "Save all as HAR"
   - Send me the HAR file

3. **Send me a screenshot** showing:
   - Network tab with failed request headers
   - Console tab with all log messages
   - Response tab showing error

This will help me debug the exact issue!

---

## 🎯 Quick Test Script

Paste this in the **Console** tab to check current session status:

```javascript
// Check if session is active
const session = JSON.parse(localStorage.getItem('nepse-session-storage'));
console.log('Session Status:', {
  exists: !!session,
  isAuthenticated: session?.state?.isAuthenticated,
  hasSessionData: !!session?.state?.sessionData,
  sessionData: session?.state?.sessionData
});

// Check if TMS API has session
console.log('If you see authentication headers in next request, session is working!');
```

---

**Dev Server Running**: http://localhost:5173

**Test it now and check the console logs!** 🚀
