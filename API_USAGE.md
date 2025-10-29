# API Usage Guide

## Running the Server

```bash
node server.js
```

This starts the Express server on `http://localhost:3000` with ALL features available via API endpoints.

---

## Workflow: Parse Headers → View JSON → Update Session

### Step 1: Copy Headers from Browser

Copy the content from your Chrome DevTools to `cookies.tx` (line-by-line format).

### Step 2: Parse Headers (View JSON Without Updating)

**Using the API:**

```bash
curl -X POST http://localhost:3000/parse-headers \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$(cat cookies.tx)\"}"
```

**Using the parse-headers.js script:**

```bash
node parse-headers.js cookies.tx
```

**Response:**
```json
{
  "ok": true,
  "message": "Headers parsed successfully",
  "totalHeadersParsed": 24,
  "requiredHeaders": {
    "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
    "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
    "host-session-id": "TWpRPS0zNjQ5NDIwMy05NTI2LTQ0YzEtYTRjNS0xMmJjYzdlZmY5NmE=",
    "membercode": "56",
    "request-owner": "25717"
  },
  "allParsedHeaders": {
    ... all 24 headers ...
  },
  "ready": true,
  "nextStep": "Send this to POST /update-headers with { \"headers\": requiredHeaders }"
}
```

This shows you the parsed JSON **before** updating the session.

### Step 3: Update Session

**Manually (using parsed output):**

```bash
curl -X POST http://localhost:3000/update-headers \
  -H "Content-Type: application/json" \
  -d '{
    "headers": {
      "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
      "x-xsrf-token": "f4a1928a-e118-4a5a-82da-e058d1c13853",
      "host-session-id": "TWpRPS0zNjQ5NDIwMy05NTI2LTQ0YzEtYTRjNS0xMmJjYzdlZmY5NmE=",
      "membercode": "56",
      "request-owner": "25717"
    }
  }'
```

**Automatically (using script):**

```bash
node parse-headers.js cookies.tx --send
```

**Response:**
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
    "isValid": false,
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

## Complete Feature Set

### 1. Session Management

```bash
# Check session status
curl http://localhost:3000/session/status

# Validate with TMS
curl http://localhost:3000/session/validate

# Clear session
curl -X POST http://localhost:3000/session/clear
```

### 2. Stock Search & Lookup

```bash
# List all stocks
curl http://localhost:3000/stocks

# Search for a stock
curl http://localhost:3000/stock/search/NLO

# Complete lookup (OHLC + Quote + STP)
curl http://localhost:3000/stock/lookup/NLO
```

### 3. Price Monitoring

```bash
# Start monitoring
curl -X POST http://localhost:3000/monitor/start \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NLO", "pollInterval": 1500}'

# Check current price
curl http://localhost:3000/monitor/price/NLO

# Get price history
curl http://localhost:3000/monitor/history/NLO?limit=50

# Validate limit price (±2% check)
curl -X POST http://localhost:3000/monitor/validate-price \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NLO", "limitPrice": 245}'

# Stop monitoring
curl -X POST http://localhost:3000/monitor/stop \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NLO"}'
```

### 4. Trading Assistant (Automated Triggers)

```bash
# Add a trigger
curl -X POST http://localhost:3000/trading/trigger/add \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NLO",
    "condition": "<=",
    "triggerPrice": 240,
    "side": "BUY",
    "limitPrice": 240,
    "totalQuantity": 50,
    "numOrders": 5,
    "validity": "DAY",
    "name": "Buy NLO at 240"
  }'

# Get all triggers
curl http://localhost:3000/trading/triggers

# Get specific trigger
curl http://localhost:3000/trading/trigger/trigger_1_1730188800000

# Pause trigger
curl -X POST http://localhost:3000/trading/trigger/trigger_1_1730188800000/pause

# Resume trigger
curl -X POST http://localhost:3000/trading/trigger/trigger_1_1730188800000/resume

# Remove trigger
curl -X DELETE http://localhost:3000/trading/trigger/trigger_1_1730188800000

# Get execution history
curl http://localhost:3000/trading/executions?limit=50
```

### 5. Order Placement

**Simplified order:**

```bash
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

**Quick buy:**

```bash
curl -X POST http://localhost:3000/order/buy \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NLO",
    "quantity": 10,
    "price": 245
  }'
```

**Split orders:**

```bash
curl -X POST http://localhost:3000/order/split \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NLO",
    "side": "BUY",
    "limitPrice": 245,
    "totalQuantity": 50,
    "numOrders": 5,
    "validity": "DAY",
    "validateEachOrder": true
  }'
```

**Check job status:**

```bash
curl http://localhost:3000/order/job/job_1_1730188800000
```

---

## Example: Complete Trading Workflow

### Scenario: Buy 50 shares when price drops to 240

```bash
# 1. Update session
node parse-headers.js cookies.tx --send

# 2. Verify authentication
curl http://localhost:3000/session/status

# 3. Add trigger
curl -X POST http://localhost:3000/trading/trigger/add \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NLO",
    "condition": "<=",
    "triggerPrice": 240,
    "side": "BUY",
    "limitPrice": 240,
    "totalQuantity": 50,
    "numOrders": 5,
    "validity": "DAY"
  }'

# 4. Monitor status
curl http://localhost:3000/monitor/status
curl http://localhost:3000/trading/triggers

# 5. Check executions (after trigger fires)
curl http://localhost:3000/trading/executions
```

---

## Postman Collection

Import this into Postman for easy testing:

```json
{
  "info": {
    "name": "NEPSE Trading Assistant",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Parse Headers",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/parse-headers",
        "body": {
          "mode": "raw",
          "raw": "{\"text\": \"paste headers here\"}",
          "options": {"raw": {"language": "json"}}
        }
      }
    },
    {
      "name": "Update Headers",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/update-headers",
        "body": {
          "mode": "raw",
          "raw": "{\"headers\": {}}",
          "options": {"raw": {"language": "json"}}
        }
      }
    },
    {
      "name": "Session Status",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/session/status"
      }
    },
    {
      "name": "Place Order",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/place-order",
        "body": {
          "mode": "raw",
          "raw": "{\"symbol\": \"NLO\", \"side\": \"BUY\", \"orderType\": \"LIMIT\", \"quantity\": 10, \"price\": 245}",
          "options": {"raw": {"language": "json"}}
        }
      }
    }
  ]
}
```

---

## Common Issues

### "Session not authenticated"

**Solution:** Update headers first:
```bash
node parse-headers.js cookies.tx --send
```

### "Stock not found"

**Solution:** Add stock to database:
```bash
curl -X POST http://localhost:3000/stock/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": 198,
    "symbol": "NLO",
    "isin": "NPE183A00001",
    "name": "Nepal Lube Oil Limited",
    "boardLotQuantity": 1,
    "tickSize": 0.1
  }'
```

### "Price validation failed"

**Solution:** Price is outside ±2% range. Check current LTP:
```bash
curl http://localhost:3000/monitor/price/NLO
```

---

## Server is Running - All Features Available!

Just run:
```bash
node server.js
```

All endpoints are accessible at `http://localhost:3000`

No frontend needed - pure API!
