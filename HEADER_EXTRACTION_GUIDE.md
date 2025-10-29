# Header Extraction Guide

## Problem

When updating session headers, you may encounter errors like:
```json
{
  "ok": false,
  "error": "Header name must be a valid HTTP token [\"ok\"]"
}
```

This happens when **invalid headers** (like API response fields) are accidentally included in your headers object.

---

## Solution

The system now **automatically sanitizes** headers, removing invalid fields. However, to avoid issues, follow this guide to extract headers correctly.

---

## Method 1: Extract from Browser DevTools (Recommended)

### Step 1: Open TMS and Login

1. Go to https://tms56.nepsetms.com.np
2. Log in to your account
3. Navigate to the trading/order page

### Step 2: Open DevTools

1. Press `F12` or right-click → Inspect
2. Go to **Network** tab
3. Refresh the page or perform an action (place test order, check balance, etc.)

### Step 3: Find a TMS API Request

Look for requests to `tms56.nepsetms.com.np` in the Network tab. Examples:
- `/tmsapi/rtApi/ws/stockQuote/198`
- `/tmsapi/clientApi/clientDealer/info/881337`
- `/tmsapi/orderApi/order/`

Click on any of these requests.

### Step 4: Copy Request Headers

In the Headers tab, find the **Request Headers** section. You need these specific headers:

**Required headers:**
- `cookie` - Full cookie string
- `x-xsrf-token` - XSRF token value
- `host-session-id` - Session ID
- `membercode` - Your broker member code (usually "56")
- `request-owner` - Your client ID (e.g., "25717")

**DO NOT include:**
- Response headers (like `content-type`, `content-length`, `date`)
- HTTP/2 pseudo-headers (like `:authority`, `:method`, `:path`, `:scheme`)
- Status or data fields (like `ok`, `status`, `data`, `error`)

### Step 5: Format as JSON

Create a JSON object with ONLY the required headers:

```json
{
  "headers": {
    "cookie": "XSRF-TOKEN=f4a1928a-e118-4a5a-82da-e058d1c13853; _aid=eyJlbmM...; _rid=eyJlbmM...",
    "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
    "host-session-id": "TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

### Step 6: Send to Your Server

```bash
curl -X POST http://localhost:3000/update-headers \
  -H "Content-Type: application/json" \
  -d '{
    "headers": {
      "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
      "x-xsrf-token": "...",
      "host-session-id": "...",
      "membercode": "56",
      "request-owner": "25717"
    }
  }'
```

---

## Method 2: Copy as cURL and Extract

### Step 1: Right-click on Network Request

In DevTools Network tab, right-click on a TMS API request.

### Step 2: Copy → Copy as cURL

This gives you a complete cURL command.

### Step 3: Extract Headers

From the cURL command, extract only the relevant `-H` (header) flags:

**Example cURL:**
```bash
curl 'https://tms56.nepsetms.com.np/tmsapi/rtApi/ws/stockQuote/198' \
  -H 'cookie: XSRF-TOKEN=f4a1928a...; _aid=eyJlbmM...; _rid=eyJlbmM...' \
  -H 'x-xsrf-token: f4a1928a-e118-4a5a-82da-e058d1c13853' \
  -H 'host-session-id: TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=' \
  -H 'membercode: 56' \
  -H 'request-owner: 25717' \
  ...
```

**Extract these:**
```json
{
  "headers": {
    "cookie": "XSRF-TOKEN=f4a1928a...; _aid=eyJlbmM...; _rid=eyJlbmM...",
    "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
    "host-session-id": "TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

---

## Common Mistakes

### ❌ Mistake 1: Including Response Fields

**Bad:**
```json
{
  "headers": {
    "ok": true,           // ← API response field, NOT a header!
    "status": "200",      // ← HTTP status, NOT a header!
    "data": {...},        // ← Response data, NOT a header!
    "cookie": "..."
  }
}
```

**Good:**
```json
{
  "headers": {
    "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
    "x-xsrf-token": "...",
    "membercode": "56"
  }
}
```

---

### ❌ Mistake 2: Including HTTP/2 Pseudo-Headers

**Bad:**
```json
{
  "headers": {
    ":authority": "tms56.nepsetms.com.np",  // ← HTTP/2 pseudo-header
    ":method": "POST",                      // ← HTTP/2 pseudo-header
    ":path": "/tmsapi/orderApi/order/",     // ← HTTP/2 pseudo-header
    "cookie": "..."
  }
}
```

**Good:**
```json
{
  "headers": {
    "cookie": "...",
    "x-xsrf-token": "...",
    "membercode": "56"
  }
}
```

> **Note:** Headers starting with `:` are HTTP/2 pseudo-headers and are automatically removed by the system.

---

### ❌ Mistake 3: Including Response Headers

**Bad:**
```json
{
  "headers": {
    "content-type": "application/json",  // ← Response header
    "content-length": "1234",            // ← Response header
    "date": "Wed, 29 Oct 2025...",       // ← Response header
    "cookie": "..."
  }
}
```

**Good:**
```json
{
  "headers": {
    "cookie": "...",
    "x-xsrf-token": "...",
    "membercode": "56"
  }
}
```

---

## Validation

After sending headers, check the response:

### ✅ Success Response

```json
{
  "ok": true,
  "message": "Headers updated successfully",
  "summary": {
    "hasXSRF": true,
    "hasAID": true,
    "hasRID": true,
    "membercode": "56",
    "requestOwner": "25717"
  },
  "sessionStatus": {
    "hasAuth": true,
    "membercode": "56",
    "requestOwner": "25717",
    "cookies": {
      "hasXSRF": true,
      "hasAID": true,
      "hasRID": true
    }
  }
}
```

This means your session is **fully authenticated** and ready to place orders.

---

### ⚠️ Incomplete Session

```json
{
  "ok": true,
  "message": "Headers updated successfully",
  "warning": "Session is incomplete. Missing required authentication data.",
  "missingData": [
    "_aid cookie",
    "_rid cookie"
  ],
  "sessionStatus": {
    "hasAuth": false,
    "cookies": {
      "hasXSRF": true,
      "hasAID": false,
      "hasRID": false
    }
  }
}
```

This means some required data is missing. You need to:
1. Re-extract headers from browser
2. Make sure to include the **full cookie string** (including `_aid` and `_rid`)

---

### ❌ Error Response

```json
{
  "ok": false,
  "error": "Header name must be a valid HTTP token [\"ok\"]",
  "hint": "Make sure you are sending valid HTTP headers. Avoid including response-only fields like \"ok\", \"status\", or \"data\"."
}
```

This means you included invalid headers. The system now **auto-sanitizes**, but you should still avoid sending:
- Response fields (`ok`, `status`, `data`, `error`, `message`)
- HTTP/2 pseudo-headers (`:authority`, `:method`, etc.)

---

## Complete Example

### Browser DevTools → JSON

**From DevTools:**
```
Request Headers:
  accept: application/json, text/plain, */*
  cookie: XSRF-TOKEN=f4a1928a-e118-4a5a-82da-e058d1c13853; _aid=eyJlbmM...; _rid=eyJlbmM...
  host-session-id: TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=
  membercode: 56
  request-owner: 25717
  x-xsrf-token: f4a1928a-e118-4a5a-82da-e058d1c13853
```

**To JSON:**
```json
{
  "headers": {
    "cookie": "XSRF-TOKEN=f4a1928a-e118-4a5a-82da-e058d1c13853; _aid=eyJlbmM...; _rid=eyJlbmM...",
    "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
    "host-session-id": "TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

**Send to API:**
```bash
curl -X POST http://localhost:3000/update-headers \
  -H "Content-Type: application/json" \
  -d @headers.json
```

**Verify:**
```bash
curl http://localhost:3000/session/status
```

---

## Programmatic Extraction (Advanced)

If you want to automate header extraction, you can create a browser extension:

### Chrome Extension Example

```javascript
// content.js
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (details.url.includes('tms56.nepsetms.com.np')) {
      const headers = {};
      details.requestHeaders.forEach(header => {
        if (['cookie', 'x-xsrf-token', 'host-session-id', 'membercode', 'request-owner'].includes(header.name.toLowerCase())) {
          headers[header.name.toLowerCase()] = header.value;
        }
      });

      // Send to your local server
      fetch('http://localhost:3000/update-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers })
      });
    }
  },
  { urls: ["https://tms56.nepsetms.com.np/*"] },
  ["requestHeaders"]
);
```

---

## Troubleshooting

### Issue: "Session not authenticated"

**Cause:** Headers not updated or expired.

**Solution:**
1. Extract fresh headers from browser
2. Call `POST /update-headers`
3. Verify with `GET /session/status`

---

### Issue: "Invalid header name"

**Cause:** Sending headers with special characters or reserved names.

**Solution:** The system now auto-sanitizes, but make sure you're only sending actual HTTP headers, not response fields.

---

### Issue: "Missing _aid or _rid cookies"

**Cause:** Cookie string is incomplete.

**Solution:**
1. Make sure you copy the **full cookie string** from DevTools
2. It should include `XSRF-TOKEN`, `_aid`, and `_rid`
3. Cookie string can be very long (2000+ characters) - don't truncate it

**Example of full cookie:**
```
XSRF-TOKEN=f4a1928a-e118-4a5a-82da-e058d1c13853; _aid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..PVBTFDYXr5SG5y9S.OHLdyZQ4ldoEhIimeZuiNghZfaiVpocX64XJ2P49MAjhCOdGWrcb3IWatzg0BxgjHOc9x32SuSRxQC-LWE1BHshtuDCTos1hN-3-KJ_0o3oG4RoKcxHw2UzV_fiRV35MYax1g01jsvzcSPQZ63-Hwb1dCS6oq9XO9yb_ZQ_1SfBA97oplse4M7EjLlycYqNKgLmCQcP5Nbg-X1hUfW4DCtV1rvmxfaYRmFn1ky633G8D55v07jJ7qa2_hAJiGxixaBM8c9G1j1jVYGXfSUYWGYLA5HupEUmDZpj1ny15nvGDasIwckXOv_5OH8LZhQag9pXH9qWzDxyYydTko8QoOXculbATolm8-g72oVOWwzg5MKVhJg8kgLPxjoy3KbzMTc95PoPubROPXBSV804D5IMs-btOB6z2Rxm1clr5qo2z9HRAFEFDPJboQxLQjOvzt81c9urVEJvq1W4OjThibXkKEqXybpQaXgroJbJKsDAoG94M0tD08D7giBHjd89RH5LOs7Wbi5UrYof7EfZRmlVNIdiV3dcA4NakHk7w5m4ZC6PYdPsz8QerUA.njclW-Nxr5WzELCfMnUc6A; _rid=eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiZGlyIn0..dga09qpc53NY-ZZq.NmZTZyoDIJCCTNd61ZWkU7qH55qr7qFDsNrEDX1tPz2qWuZDfhu3piYTJrZ0LnKUPf7Zkf0lgHSzlsob3qC3JRVVXTy5-J6IGqp9uzgrGScdmmL_PnBQZmJI38p4elTRjXMZ4PaHqMBNJI2nPqAoVW_Rjw12BwwXrtf99x2CUte6_FgG76lM39rxARRxb0gwZ3eLzzd0TuSN62LY5pDAT-krBbPceDUjegaKxjR5k309GyQ3Q6Ub_pHnC8AGYu0ynQn2CPbHcAsw9anPqr83hrvKe5zia5QLsveT_CBV41BIY1GFwRWN-zza435nQhXTkWjE2vBKGiOpGCZ0CP3kgUKiSDAW0v1YSDtQ4eTxHtxiat3WEdhizMJlHgaXqf9M3fN0DeUTwcfOHeM2R5Kp_rlzDWEUvgJFUgnZd3QdFKc2xOII7Mb6iMqQ17Vd7aZ-8oxpwGuII9mX2MXMiVbsKP5dtRv0-s9dV8LA2J5B6rlUFCFZ643TWdYEl-B7qq9Oj9glmykQacpGFA8FynUoj6bwUoebDU0P1eUx57UYppM9ccD4j49M3ITISA.P9aktrg5hW34lj6cUKDDow
```

---

## Quick Reference

### Required Headers

| Header | Description | Example |
|--------|-------------|---------|
| `cookie` | Full cookie string with XSRF-TOKEN, _aid, _rid | `XSRF-TOKEN=...; _aid=...; _rid=...` |
| `x-xsrf-token` | XSRF token (same value as in cookie) | `f4a1928a-e118-4a5a-82da-e058d1c13853` |
| `host-session-id` | Session identifier (base64 encoded) | `TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=` |
| `membercode` | Broker member code | `56` |
| `request-owner` | Your client ID | `25717` |

### Forbidden Headers (Auto-removed)

- `ok`, `status`, `data`, `error`, `message` (API response fields)
- `:authority`, `:method`, `:path`, `:scheme` (HTTP/2 pseudo-headers)
- `content-length`, `host` (Calculated by axios)

---

## Next Steps

After updating headers successfully:

1. **Verify session:**
   ```bash
   GET /session/status
   ```

2. **Test with a simple API call:**
   ```bash
   GET /ping-tms
   ```

3. **Start trading:**
   ```bash
   POST /place-order
   POST /trading/trigger/add
   ```

---

## Related Documentation

- [Order Placement Guide](ORDER_PLACEMENT_GUIDE.md) - How to place orders after authentication
- [Trading Assistant Guide](TRADING_ASSISTANT_GUIDE.md) - Automated trading with triggers
- [Quick Reference](QUICK_REFERENCE.md) - Command cheat sheet
