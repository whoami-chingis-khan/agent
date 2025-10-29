# Order Placement API Guide

## Overview

This system provides a **simplified order placement workflow** that automatically handles:
- Session authentication management
- Stock ID resolution from symbols
- Client data extraction from session
- TMS payload construction

You no longer need to know ISINs, security IDs, or client IDs - just provide the stock symbol, side, price, and quantity.

---

## Architecture

### Components

1. **SessionService** (`services/sessionService.js`)
   - Manages TMS authentication cookies and headers
   - Validates session state
   - Provides request headers for API calls

2. **OrderBuilder** (`services/orderBuilder.js`)
   - Converts simple user inputs to full TMS payloads
   - Auto-resolves stock and client data
   - Validates order parameters

3. **Order Endpoints** (server.js:179-354)
   - Simplified order placement
   - Quick buy/sell shortcuts
   - Raw payload support for advanced users

---

## Quick Start

### 1. Update Session Headers

First, authenticate by providing session headers from your TMS browser session:

```bash
POST /update-headers
Content-Type: application/json

{
  "headers": {
    "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
    "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
    "host-session-id": "TWpRPS02MDIzM2NjNS04YzQzLTQ1OWYtYTUzNS03OTFlMjE3YWYxOGQ=",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Headers updated",
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

---

### 2. Check Session Status

```bash
GET /session/status
```

**Response:**
```json
{
  "ok": true,
  "session": {
    "hasAuth": true,
    "isValid": false,
    "lastChecked": 1730188800000,
    "membercode": "56",
    "requestOwner": "25717",
    "hasClientInfo": false,
    "cookies": {
      "hasXSRF": true,
      "hasAID": true,
      "hasRID": true
    }
  }
}
```

---

### 3. Place a Simplified Order

**POST** `/place-order`

```json
{
  "symbol": "NLO",
  "side": "BUY",
  "orderType": "LIMIT",
  "quantity": 10,
  "price": 245,
  "validity": "DAY"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "ORDER PLACEMENT SUCCESS",
  "tms": {
    "status": 200,
    "data": {
      "status": "200",
      "level": null,
      "message": "ORDER PLACEMENT SUCCESS",
      "data": null
    }
  },
  "orderDetails": {
    "symbol": "NLO",
    "side": "BUY",
    "quantity": 10,
    "price": 245
  }
}
```

**Response (Error - 401):**
```json
{
  "ok": false,
  "error": "Session not authenticated. Please update headers first using POST /update-headers",
  "sessionStatus": {
    "hasAuth": false
  }
}
```

---

## API Endpoints

### Session Management

#### 1. Check Session Status
**GET** `/session/status`

Returns current session state including authentication status.

---

#### 2. Validate Session with TMS
**GET** `/session/validate`

Calls TMS `/sessionCheck` endpoint to verify session is still valid.

**Response:**
```json
{
  "ok": true,
  "valid": true,
  "session": { ... }
}
```

---

#### 3. Clear Session
**POST** `/session/clear`

Clears all session data (useful for logout/reset).

---

### Order Placement

#### 1. Place Order (Simplified) ⭐ RECOMMENDED
**POST** `/place-order`

Automatically builds the full TMS payload from simple inputs.

**Request Body:**
```json
{
  "symbol": "NLO",           // Stock symbol (required)
  "side": "BUY",             // "BUY" or "SELL" (required)
  "orderType": "LIMIT",      // "LIMIT", "MARKET", "STOP_LOSS" (required)
  "quantity": 10,            // Order quantity (required)
  "price": 245,              // Order price (required for LIMIT)
  "validity": "DAY",         // "DAY", "IOC", "GTC" (optional, default: DAY)
  "triggerPrice": 0,         // Trigger price (required for STOP_LOSS)
  "disclosedQuantity": 0,    // Disclosed quantity (optional, default: 0)
  "productType": "CNC",      // "CNC" or "MIS" (optional, default: CNC)
  "marketType": "CONTINUOUS" // "CONTINUOUS", "PRE_OPEN", "CLOSING" (optional)
}
```

**Validation Rules:**
- `symbol` must exist in stock database (use `GET /stock/search/:symbol` to verify)
- `side` must be "BUY" or "SELL"
- `orderType` options: LIMIT, MARKET, STOP_LOSS (or LMT, MKT, SL)
- `price` required for LIMIT orders
- `triggerPrice` required for STOP_LOSS orders
- `quantity` must be > 0

---

#### 2. Quick Buy
**POST** `/order/buy`

Shortcut for placing a BUY LIMIT order.

**Request Body:**
```json
{
  "symbol": "NLO",
  "quantity": 10,
  "price": 245,
  "validity": "DAY"  // optional
}
```

**Response:**
```json
{
  "ok": true,
  "message": "BUY order placed: 10 x NLO @ 245",
  "tms": {
    "status": "200",
    "message": "ORDER PLACEMENT SUCCESS"
  }
}
```

---

#### 3. Quick Sell
**POST** `/order/sell`

Shortcut for placing a SELL LIMIT order.

**Request Body:**
```json
{
  "symbol": "NLO",
  "quantity": 10,
  "price": 250,
  "validity": "DAY"  // optional
}
```

---

#### 4. Place Order (Raw Payload)
**POST** `/place-order-raw`

For advanced users who want to send the full TMS payload directly.

Accepts the complete `orderBook` structure as shown in the working payload from api.txt:134.

---

## How It Works

### Authentication Flow

The TMS API uses **session-based authentication** (not OAuth tokens, despite the "OAUTH" error message):

1. **Cookies**:
   - `XSRF-TOKEN`: Cross-site request forgery protection
   - `_aid`: Authentication ID (encrypted)
   - `_rid`: Request ID (encrypted)

2. **Headers**:
   - `x-xsrf-token`: Must match `XSRF-TOKEN` cookie
   - `host-session-id`: Session identifier (base64 encoded)
   - `membercode`: Broker member code (e.g., "56")
   - `request-owner`: Client ID (e.g., "25717")

**All of these must be present and valid, or you'll get a 401 UNAUTHORIZED_ACCESS error.**

---

### Order Building Flow

When you call `POST /place-order` with simplified inputs:

1. **Validate inputs** (symbol, side, quantity, price, etc.)
2. **Resolve stock** from local database using symbol
   - If not found, returns 404 error
3. **Fetch client info** from session using `request-owner` header
   - Calls `/tmsapi/clientApi/clientDealer/info/:clientId`
4. **Build complete payload** with:
   - Client object (from session)
   - Security object (from stock database)
   - Order book extensions (from user inputs)
   - Market type, instrument type, product type
5. **Submit order** to TMS using session headers

---

## Extracting Session Data from Browser

### Method 1: Browser DevTools

1. Open TMS in Chrome and log in
2. Open DevTools (F12) → Network tab
3. Place a test order or refresh dashboard
4. Find any API request to `tms56.nepsetms.com.np`
5. Copy **Request Headers**:
   - `cookie` (full string)
   - `x-xsrf-token`
   - `host-session-id`
   - `membercode`
   - `request-owner`

6. Send to your app:
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

### Method 2: Browser Extension (Future)

Create a Chrome extension that:
1. Intercepts TMS API requests
2. Extracts headers automatically
3. Sends to your local server via `/update-headers`

---

## Error Handling

### 401 UNAUTHORIZED_ACCESS

**Cause**: Session headers are missing, invalid, or expired.

**Solution**:
1. Re-extract headers from browser
2. Call `POST /update-headers`
3. Retry order placement

---

### 400 Order validation failed

**Cause**: Invalid order parameters.

**Example errors**:
- "symbol is required"
- "price is required for LIMIT orders"
- "quantity must be greater than 0"
- "Stock not found: ABC"

**Solution**: Fix the order payload and retry.

---

### 404 Stock not found

**Cause**: Stock symbol not in local database.

**Solution**:
1. Check symbol is correct
2. Add stock to database:
```bash
POST /stock/add
{
  "id": 198,
  "symbol": "NLO",
  "isin": "NPE183A00001",
  "name": "Nepal Lube Oil Limited",
  "boardLotQuantity": 1,
  "tickSize": 0.1
}
```

---

## Order Type Reference

| Order Type | Code | Description | Required Fields |
|------------|------|-------------|-----------------|
| LIMIT | LMT | Limit order at specified price | price |
| MARKET | MKT | Market order (best available price) | - |
| STOP_LOSS | SL | Stop loss order | triggerPrice, price |

---

## Order Validity Reference

| Validity | Code | Description |
|----------|------|-------------|
| DAY | DAY | Valid for the current trading day |
| IOC | IOC | Immediate or Cancel (fill immediately or cancel) |
| GTC | GTC | Good Till Cancelled (valid until manually cancelled) |

---

## Product Type Reference

| Product | Code | Description |
|---------|------|-------------|
| CNC | CNC | Cash and Carry (delivery-based trading) |
| MIS | MIS | Margin Intraday Squareoff (intraday trading) |

---

## Testing

### Test Order (will fail in production without valid session):

```bash
# 1. Update headers (use real values from browser)
curl -X POST http://localhost:3000/update-headers \
  -H "Content-Type: application/json" \
  -d '{"headers": {...}}'

# 2. Check session
curl http://localhost:3000/session/status

# 3. Place test order
curl -X POST http://localhost:3000/place-order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NLO",
    "side": "BUY",
    "orderType": "LIMIT",
    "quantity": 10,
    "price": 245,
    "validity": "DAY"
  }'
```

---

## Security Notes

1. **Never commit session cookies/tokens to Git**
2. **Session tokens expire** - implement auto-refresh or manual update flow
3. **Store session data securely** - consider encryption for production
4. **Validate all orders** before submission to prevent accidental trades
5. **Implement rate limiting** to prevent API abuse

---

## Next Steps

1. **Build a frontend UI** that:
   - Displays session status
   - Provides order entry form with stock autocomplete
   - Shows order confirmation before submission

2. **Implement session auto-refresh**:
   - Detect 401 errors
   - Prompt user to re-authenticate
   - Retry failed orders

3. **Add order management**:
   - View open orders
   - Cancel orders
   - Order history

4. **Enhance stock database**:
   - Bulk import all NEPSE stocks
   - Update stock data periodically
   - Display stock info in order form

---

## File References

- Session service: `services/sessionService.js`
- Order builder: `services/orderBuilder.js`
- Order endpoints: `server.js:179-354`
- Session endpoints: `server.js:142-177`
- Stock database: `data/stocks.json`
