# Stock Search & Management API Guide

## Overview

This system provides a complete stock lookup workflow that mirrors the NEPSE TMS frontend behavior, including:
- Local stock database with caching
- Complete search sequence (OHLC → Quote → STP)
- Client information retrieval

---

## Architecture

### Components

1. **Stock Database** (`data/stocks.json`)
   - Local reference of stocks with metadata
   - Prevents repeated lookups
   - Enables fast autocomplete/search

2. **Stock Service** (`services/stockService.js`)
   - In-memory caching with TTL
   - Stock search by symbol/ISIN/ID
   - Dynamic stock addition from API responses

3. **API Endpoints** (server.js:202-417)
   - Stock search and lookup
   - STP validation
   - Client info retrieval

---

## API Endpoints

### 1. List All Stocks
**GET** `/stocks?active=true&sector=Manufacturing`

Returns all stocks in the database.

**Query Parameters:**
- `active` (optional): Filter by active status
- `sector` (optional): Filter by sector

**Response:**
```json
{
  "ok": true,
  "stocks": [
    {
      "id": 198,
      "symbol": "NLO",
      "name": "Nepal Lube Oil Limited",
      "isin": "NPE183A00001",
      "sector": "Manufacturing"
    }
  ]
}
```

---

### 2. Search Stock by Query
**GET** `/stock/search/:query`

Searches for stock by symbol, ISIN, ID, or partial name match.

**Parameters:**
- `query`: Symbol (e.g., "NLO"), ISIN, ID (198), or partial name

**Response:**
```json
{
  "ok": true,
  "stock": {
    "id": 198,
    "symbol": "NLO",
    "isin": "NPE183A00001",
    "name": "Nepal Lube Oil Limited",
    "companyName": "Nepal Lube Oil Limited",
    "fiftyTwoWeekHigh": 293.2,
    "fiftyTwoWeekLow": 242.1,
    "active": true
  }
}
```

---

### 3. Complete Stock Lookup (Recommended)
**GET** `/stock/lookup/:query`

Performs the complete TMS search sequence:
1. Find stock in local database
2. Fetch OHLC data (price validation)
3. Fetch stock quote (market depth, buy/sell orders)
4. Fetch STP rules (order placement constraints)

**Parameters:**
- `query`: Symbol, ISIN, or ID

**Response:**
```json
{
  "ok": true,
  "data": {
    "stock": {
      "id": 198,
      "symbol": "NLO",
      "isin": "NPE183A00001",
      "name": "Nepal Lube Oil Limited"
    },
    "ohlc": {
      "status": "200",
      "data": {
        "ltp": 244.33,
        "openPrice": 244.33,
        "dayHigh": 244.33,
        "dayLow": 244.33,
        "closePrice": 244.33,
        "fiftyTwoWeekHigh": 293.2,
        "fiftyTwoWeekLow": 242.1,
        "averageTradedPrice": 244.33
      }
    },
    "quote": {
      "payload": {
        "data": [
          {
            "security": {...},
            "ltp": 244.33,
            "topBuy": [...],
            "topSell": [...],
            "totalBuyQty": 22423,
            "totalSellQty": 0
          }
        ]
      }
    },
    "stp": {
      "code": "LTPCF",
      "value": "2",
      "isin": "NPE183A00001"
    }
  }
}
```

**Cache TTLs:**
- OHLC: 5 seconds
- Quotes: 2 seconds
- STP: 60 seconds

---

### 4. Get OHLC Data Only
**GET** `/stock-ohlc/:securityId/:isin`

Fetch OHLC (Open, High, Low, Close) price data.

**Parameters:**
- `securityId`: Stock ID (e.g., 198)
- `isin`: ISIN code (e.g., NPE183A00001)

---

### 5. Get Stock Quote Only
**GET** `/ping-stock-quote/:id`

Fetch market depth and real-time quote.

**Parameters:**
- `id`: Stock ID (e.g., 198)

---

### 6. Get STP Validation
**GET** `/stock/stp/:isin/:code?`

Fetch STP (Systematic Trading Program) rules for order validation.

**Parameters:**
- `isin`: ISIN code
- `code` (optional): Rule code (default: "LTPCF")

**Response:**
```json
{
  "ok": true,
  "tms": {
    "data": {
      "code": "LTPCF",
      "value": "2",
      "isin": "NPE183A00001"
    }
  }
}
```

**Common STP Codes:**
- `LTPCF`: LTP-based order placement constraint
  - `value: "2"` typically means orders must be within ±2% of LTP

---

### 7. Add/Update Stock
**POST** `/stock/add`

Add or update a stock in the local database.

**Request Body:**
```json
{
  "id": 198,
  "symbol": "NLO",
  "isin": "NPE183A00001",
  "name": "Nepal Lube Oil Limited",
  "companyName": "Nepal Lube Oil Limited",
  "fiftyTwoWeekHigh": 293.2,
  "fiftyTwoWeekLow": 242.1,
  "sector": "Manufacturing",
  "active": true
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Stock added/updated successfully"
}
```

---

### 8. Get Client Information
**GET** `/client/info/:clientId`

Retrieve client/dealer information for display in UI.

**Parameters:**
- `clientId`: Client ID (e.g., 881337)

**Response:**
```json
{
  "ok": true,
  "summary": {
    "id": 881337,
    "name": "Individual",
    "accountType": "CLI",
    "clientCode": "201811020695929",
    "contactNumber": "9843665111",
    "email": "pratikmittal08@gmail.com",
    "allowedToTrade": true,
    "branch": "Kathmandu",
    "clientGroup": "DEFAULT_ONLINE_CLIENT_GROUP",
    "bankAccount": "30107010023929",
    "bank": "Global IME Bank Limited"
  },
  "full": {
    // Complete API response with all details
  }
}
```

---

## Usage Workflow

### For Order Placement UI

1. **User starts typing stock symbol**
   ```
   GET /stocks?active=true
   → Display autocomplete dropdown
   ```

2. **User selects "NLO"**
   ```
   GET /stock/lookup/NLO
   → Returns OHLC, quote, STP rules
   → Display current price, market depth
   → Validate order constraints (STP rules)
   ```

3. **Display client info in sidebar**
   ```
   GET /client/info/881337
   → Show user details, bank account, trading status
   ```

4. **User places order**
   ```
   POST /place-order
   → Uses data from step 2 to validate price/quantity
   ```

---

## Stock Database Management

### Initial Setup

The `data/stocks.json` file starts with a sample entry (NLO). You can:

1. **Add stocks manually** by editing the JSON file
2. **Add via API** using `POST /stock/add`
3. **Auto-populate** from API responses (future enhancement)

### Recommended: Bulk Import Script

Create `scripts/import-stocks.js` to fetch all stocks from NEPSE and populate the database:

```javascript
const axios = require('axios');
const stockService = require('../services/stockService');

async function importAllStocks() {
  // Fetch stock list from NEPSE API
  // Loop through each and call stockService.upsertStock()
}
```

---

## Caching Strategy

The stock service implements a three-tier cache:

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| OHLC | 5s | Price data changes frequently |
| Quotes | 2s | Market depth updates constantly |
| STP | 60s | Rules rarely change |

**Cache keys:**
- OHLC: `${securityId}_${isin}`
- Quotes: `${securityId}`
- STP: `${isin}_${code}`

To clear all caches:
```javascript
stockService.clearCaches();
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "ok": false,
  "error": "Error message here"
}
```

**Common errors:**
- `404`: Stock not found in database
- `502`: TMS API unavailable
- `401`: Authentication headers invalid/expired

**Handling authentication:**
Update headers via:
```
POST /update-headers
{
  "headers": {
    "cookie": "...",
    "x-xsrf-token": "..."
  }
}
```

---

## Testing

Run the test suite:
```bash
node test-stock-lookup.js
```

Expected output:
```
=== Testing Stock Service ===
Loading stocks...
Loaded 1 stocks from database
All stocks:
[...]
=== All tests passed! ===
```

---

## Next Steps

1. **Build frontend UI** that consumes these endpoints
2. **Implement WebSocket** for real-time quote updates
3. **Add bulk stock import** script
4. **Integrate with order placement** workflow
5. **Add user session management** with auto-header refresh

---

## File References

- Stock service: `services/stockService.js`
- Stock endpoints: `server.js:202-374`
- Client endpoint: `server.js:376-417`
- Stock database: `data/stocks.json`
- Tests: `test-stock-lookup.js`
