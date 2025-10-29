# NEPSE TMS API - Quick Reference

## Setup

### 1. Start Server
```bash
npm start
# Server runs on http://localhost:3000
```

### 2. Update Session Headers
```bash
POST /update-headers
{
  "headers": {
    "cookie": "XSRF-TOKEN=...; _aid=...; _rid=...",
    "x-xsrf-token": "...",
    "host-session-id": "...",
    "membercode": "56",
    "request-owner": "25717"
  }
}
```

---

## Order Placement (Simplified)

### Buy Order
```bash
POST /place-order
{
  "symbol": "NLO",
  "side": "BUY",
  "orderType": "LIMIT",
  "quantity": 10,
  "price": 245,
  "validity": "DAY"
}
```

### Sell Order
```bash
POST /place-order
{
  "symbol": "NLO",
  "side": "SELL",
  "orderType": "LIMIT",
  "quantity": 10,
  "price": 250,
  "validity": "DAY"
}
```

### Quick Shortcuts
```bash
# Quick buy
POST /order/buy
{ "symbol": "NLO", "quantity": 10, "price": 245 }

# Quick sell
POST /order/sell
{ "symbol": "NLO", "quantity": 10, "price": 250 }
```

---

## Stock Search

### Complete Lookup (OHLC + Quote + STP)
```bash
GET /stock/lookup/NLO
# Returns: stock info, price data, market depth, STP rules
```

### Simple Search
```bash
GET /stock/search/NLO
# Returns: basic stock info
```

### List All Stocks
```bash
GET /stocks
# Returns: all stocks in database
```

---

## Session Management

### Check Status
```bash
GET /session/status
```

### Validate with TMS
```bash
GET /session/validate
```

### Clear Session
```bash
POST /session/clear
```

---

## Client Info

```bash
GET /client/info/881337
# Returns: user profile, bank details, trading status
```

---

## Order Parameters

### Required Fields
- `symbol` - Stock symbol (e.g., "NLO")
- `side` - "BUY" or "SELL"
- `orderType` - "LIMIT", "MARKET", "STOP_LOSS"
- `quantity` - Order quantity (> 0)
- `price` - Order price (required for LIMIT)

### Optional Fields
- `validity` - "DAY" (default), "IOC", "GTC"
- `triggerPrice` - For STOP_LOSS orders
- `disclosedQuantity` - Default: 0
- `productType` - "CNC" (default), "MIS"
- `marketType` - "CONTINUOUS" (default)

---

## Common Errors

### 401 UNAUTHORIZED_ACCESS
**Fix**: Update headers with fresh session data from browser

### 404 Stock not found
**Fix**: Add stock to database via `POST /stock/add`

### 400 Order validation failed
**Fix**: Check required fields (price for LIMIT, triggerPrice for STOP_LOSS)

---

## Extracting Headers from Browser

1. Open TMS in Chrome + login
2. DevTools (F12) → Network tab
3. Find any request to `tms56.nepsetms.com.np`
4. Copy these headers:
   - `cookie`
   - `x-xsrf-token`
   - `host-session-id`
   - `membercode`
   - `request-owner`

---

## File Structure

```
sniper/
├── server.js                   # Main server
├── data/
│   └── stocks.json             # Stock database
├── services/
│   ├── sessionService.js       # Session management
│   ├── stockService.js         # Stock data & caching
│   └── orderBuilder.js         # Order payload builder
├── middleware/
│   └── pingTmsMiddleware.js    # TMS API wrapper
├── examples/
│   └── order-placement-example.js
└── docs/
    ├── ORDER_PLACEMENT_GUIDE.md
    ├── STOCK_API_GUIDE.md
    └── QUICK_REFERENCE.md (this file)
```

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/update-headers` | POST | Update session headers |
| `/session/status` | GET | Check session status |
| `/session/validate` | GET | Validate with TMS |
| `/place-order` | POST | Place order (simplified) |
| `/order/buy` | POST | Quick buy shortcut |
| `/order/sell` | POST | Quick sell shortcut |
| `/stock/lookup/:query` | GET | Complete stock lookup |
| `/stock/search/:query` | GET | Search stock |
| `/stocks` | GET | List all stocks |
| `/client/info/:id` | GET | Get client info |

---

## Example Usage (JavaScript)

```javascript
const axios = require('axios');

// 1. Update session
await axios.post('http://localhost:3000/update-headers', {
  headers: { /* session headers */ }
});

// 2. Place buy order
await axios.post('http://localhost:3000/place-order', {
  symbol: 'NLO',
  side: 'BUY',
  orderType: 'LIMIT',
  quantity: 10,
  price: 245
});
```

---

## Testing

```bash
# Run stock service tests
node test-stock-lookup.js

# Run order placement example
node examples/order-placement-example.js
```

---

## Tips

1. **Always update headers first** before placing orders
2. **Check session status** if you get 401 errors
3. **Add stocks to database** before placing orders
4. **Session tokens expire** - re-extract from browser when needed
5. **Use simplified endpoints** (`/place-order`, `/order/buy`) for ease of use
6. **Use raw endpoint** (`/place-order-raw`) only if you need full control

---

## Support

- Full documentation: `ORDER_PLACEMENT_GUIDE.md`
- Stock API guide: `STOCK_API_GUIDE.md`
- Example code: `examples/order-placement-example.js`
