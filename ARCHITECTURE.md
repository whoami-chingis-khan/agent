# System Architecture

## Overview

This system acts as a **simplified proxy** between your application and the NEPSE TMS API, handling authentication, data resolution, and payload construction automatically.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your Application                            │
│                    (Frontend / Trading Bot)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Simple API calls:
                             │ - POST /place-order { symbol, side, price }
                             │ - GET /stock/lookup/NLO
                             │ - GET /session/status
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                        Express Server                               │
│                      (localhost:3000)                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    API Endpoints                              │ │
│  │  - /place-order       (Simplified order placement)           │ │
│  │  - /order/buy         (Quick buy shortcut)                   │ │
│  │  - /order/sell        (Quick sell shortcut)                  │ │
│  │  - /stock/lookup/:q   (Complete stock search)                │ │
│  │  - /session/status    (Session management)                   │ │
│  │  - /client/info/:id   (Client information)                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                    Service Layer                             │  │
│  │                                                              │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │  │
│  │  │ SessionService  │  │ StockService │  │ OrderBuilder   │ │  │
│  │  │                 │  │              │  │                │ │  │
│  │  │ - Manage auth   │  │ - Stock DB   │  │ - Build payload│ │  │
│  │  │ - Extract       │  │ - Caching    │  │ - Validate     │ │  │
│  │  │   cookies       │  │ - Search     │  │ - Resolve IDs  │ │  │
│  │  │ - Validate      │  │ - Lookup     │  │                │ │  │
│  │  └─────────────────┘  └──────────────┘  └────────────────┘ │  │
│  │           │                   │                  │          │  │
│  └───────────┼───────────────────┼──────────────────┼──────────┘  │
│              │                   │                  │              │
│  ┌───────────▼───────────────────▼──────────────────▼──────────┐  │
│  │                    Data Layer                                │  │
│  │                                                              │  │
│  │  ┌──────────────┐    ┌─────────────────────────────────┐   │  │
│  │  │stocks.json   │    │ In-Memory Caches                │   │  │
│  │  │              │    │ - OHLC (5s TTL)                 │   │  │
│  │  │ - id         │    │ - Quotes (2s TTL)               │   │  │
│  │  │ - symbol     │    │ - STP rules (60s TTL)           │   │  │
│  │  │ - ISIN       │    │ - Session data                  │   │  │
│  │  │ - metadata   │    │                                 │   │  │
│  │  └──────────────┘    └─────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Full TMS API calls with auth:
                             │ - POST /tmsapi/orderApi/order/
                             │ - GET /tmsapi/rtApi/ws/stockQuote/:id
                             │ - GET /tmsapi/clientApi/clientDealer/info/:id
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    NEPSE TMS API                                    │
│               (tms56.nepsetms.com.np)                              │
│                                                                     │
│  - Requires session cookies (_aid, _rid, XSRF-TOKEN)              │
│  - Requires headers (x-xsrf-token, host-session-id, etc.)         │
│  - Returns complex JSON responses                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Interactions

### Order Placement Flow

```
User App                Server                  Services                TMS API
   │                       │                       │                      │
   │  POST /place-order    │                       │                      │
   │  { symbol: "NLO",     │                       │                      │
   │    side: "BUY",       │                       │                      │
   │    quantity: 10,      │                       │                      │
   │    price: 245 }       │                       │                      │
   ├──────────────────────►│                       │                      │
   │                       │                       │                      │
   │                       │  1. Check session     │                      │
   │                       ├──────────────────────►│                      │
   │                       │  sessionService       │                      │
   │                       │  .hasRequiredAuth()   │                      │
   │                       │◄──────────────────────┤                      │
   │                       │                       │                      │
   │                       │  2. Find stock "NLO"  │                      │
   │                       ├──────────────────────►│                      │
   │                       │  stockService         │                      │
   │                       │  .findStock("NLO")    │                      │
   │                       │◄──────────────────────┤                      │
   │                       │  Returns: id=198,     │                      │
   │                       │  ISIN=NPE183A00001    │                      │
   │                       │                       │                      │
   │                       │  3. Get client info   │                      │
   │                       ├──────────────────────►│                      │
   │                       │  sessionService       │                      │
   │                       │  .getClientInfo()     │ GET /clientDealer/   │
   │                       │                       │      info/881337     │
   │                       │                       ├─────────────────────►│
   │                       │                       │◄─────────────────────┤
   │                       │◄──────────────────────┤  Returns client data │
   │                       │                       │                      │
   │                       │  4. Build payload     │                      │
   │                       ├──────────────────────►│                      │
   │                       │  orderBuilder         │                      │
   │                       │  .buildOrder(...)     │                      │
   │                       │◄──────────────────────┤                      │
   │                       │  Returns full TMS     │                      │
   │                       │  order payload        │                      │
   │                       │                       │                      │
   │                       │  5. Submit order      │                      │
   │                       │  with session headers │ POST /orderApi/      │
   │                       ├──────────────────────────────────────order/  │
   │                       │                       │                   ──►│
   │                       │◄──────────────────────────────────────────────┤
   │  Response:            │  ORDER PLACEMENT      │                      │
   │  { ok: true,          │  SUCCESS              │                      │
   │    message: "..." }   │                       │                      │
   │◄──────────────────────┤                       │                      │
   │                       │                       │                      │
```

---

### Stock Lookup Flow

```
User App                Server                  Services                TMS API
   │                       │                       │                      │
   │  GET /stock/          │                       │                      │
   │      lookup/NLO       │                       │                      │
   ├──────────────────────►│                       │                      │
   │                       │                       │                      │
   │                       │  1. Find in DB        │                      │
   │                       ├──────────────────────►│                      │
   │                       │  stockService         │                      │
   │                       │  .findStock("NLO")    │                      │
   │                       │◄──────────────────────┤                      │
   │                       │  Returns: stock obj   │                      │
   │                       │                       │                      │
   │                       │  2. Check OHLC cache  │                      │
   │                       ├──────────────────────►│                      │
   │                       │  getCached('ohlc',    │                      │
   │                       │    '198_NPE183A..')   │                      │
   │                       │◄──────────────────────┤                      │
   │                       │  Cache MISS           │                      │
   │                       │                       │                      │
   │                       │  3. Fetch OHLC        │  GET /stock/         │
   │                       │                       │  validation/ohlc/    │
   │                       │                       │  198/NPE183A00001    │
   │                       │                       ├─────────────────────►│
   │                       │                       │◄─────────────────────┤
   │                       │◄──────────────────────┤  { ltp: 244.33, ...} │
   │                       │                       │                      │
   │                       │  4. Fetch Quote       │  GET /ws/stockQuote/ │
   │                       │                       │      198             │
   │                       │                       ├─────────────────────►│
   │                       │                       │◄─────────────────────┤
   │                       │◄──────────────────────┤  { topBuy: [...], ...│
   │                       │                       │                      │
   │                       │  5. Fetch STP         │  GET /stock/         │
   │                       │                       │  validation/stp/...  │
   │                       │                       ├─────────────────────►│
   │                       │                       │◄─────────────────────┤
   │                       │◄──────────────────────┤  { code: "LTPCF", ...│
   │                       │                       │                      │
   │  Response:            │  6. Combine all data  │                      │
   │  { stock: {...},      │                       │                      │
   │    ohlc: {...},       │                       │                      │
   │    quote: {...},      │                       │                      │
   │    stp: {...} }       │                       │                      │
   │◄──────────────────────┤                       │                      │
   │                       │                       │                      │
```

---

## Session Authentication Flow

```
Browser (TMS)          User App              Server              SessionService
     │                    │                     │                      │
     │  1. User logs in   │                     │                      │
     │  to TMS            │                     │                      │
     │                    │                     │                      │
     │  2. Extract        │                     │                      │
     │  session headers   │                     │                      │
     │  from DevTools     │                     │                      │
     │                    │                     │                      │
     │                    │  POST /update-      │                      │
     │                    │  headers            │                      │
     │                    ├────────────────────►│                      │
     │                    │  { headers: {       │                      │
     │                    │    cookie: "...",   │                      │
     │                    │    x-xsrf-token...  │                      │
     │                    │  }}                 │                      │
     │                    │                     │                      │
     │                    │                     │  Store session       │
     │                    │                     ├─────────────────────►│
     │                    │                     │  - Parse cookies     │
     │                    │                     │  - Extract headers   │
     │                    │                     │  - Build lookup maps │
     │                    │                     │◄─────────────────────┤
     │                    │  { ok: true,        │  Session updated     │
     │                    │    sessionStatus... │                      │
     │                    │◄────────────────────┤                      │
     │                    │                     │                      │
     │                    │  Now all API calls  │                      │
     │                    │  use stored session │                      │
     │                    │  headers            │                      │
     │                    │                     │  getRequestHeaders() │
     │                    │                     ├─────────────────────►│
     │                    │                     │◄─────────────────────┤
     │                    │                     │  Returns full headers│
     │                    │                     │  with cookies, tokens│
```

---

## Data Flow: Simple vs Raw

### Simple Order (Recommended)

```
User Input                    System Processing                 TMS Payload
────────────────────────────────────────────────────────────────────────────

{                             1. Resolve stock:
  "symbol": "NLO",               "NLO" → id: 198
  "side": "BUY",                       ISIN: NPE183A00001
  "orderType": "LIMIT",
  "quantity": 10,             2. Fetch client:
  "price": 245                   request-owner: 25717
}                                → Full client object

                              3. Map types:
                                 "LIMIT" → {id:1, code:"LMT"}
                                 "DAY" → {id:1, code:"DAY"}
                                 "BUY" → buyOrSell: 1

                              4. Build payload:          {
                                                           orderBook: {
                                                             security: {
                                                               id: 198,
                                                               exchangeSecurityId: 198,
                                                               ...
                                                             },
                                                             client: {
                                                               id: 881337,
                                                               ...
                                                             },
                                                             orderBookExtensions: [{
                                                               orderTypes: {id:1},
                                                               orderPrice: 245,
                                                               orderQuantity: 10,
                                                               ...
                                                             }],
                                                             buyOrSell: 1,
                                                             ...
                                                           },
                                                           orderPlacedBy: 2
                                                         }
```

### Raw Order (Advanced)

```
User Input                                                      TMS Payload
──────────────────────────────────────────────────────────────────────────────

{                                                               {
  orderBook: {                  ──────────────────────────────►   orderBook: {
    security: { id: 198, ... },                                     security: { id: 198, ... },
    client: { id: 881337, ... },                                    client: { id: 881337, ... },
    ...                                                             ...
  },                                                              },
  orderPlacedBy: 2                                                orderPlacedBy: 2
}                                                               }

                                 (Sent as-is, no processing)
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Cache Hierarchy                          │
└─────────────────────────────────────────────────────────────┘

Level 1: Stock Database (stocks.json)
────────────────────────────────────────────────────────
│ Persistent │ Fast lookup │ Manual/Auto updates │
│ Contains: Stock metadata (id, symbol, ISIN, etc.)  │
│ Updated: Via POST /stock/add or bulk import         │
────────────────────────────────────────────────────────

Level 2: In-Memory Caches (Map objects)
────────────────────────────────────────────────────────
│ Volatile │ Very fast │ Auto-expire with TTL │

┌─────────────┬──────────┬──────────────────────────┐
│ Cache Type  │ TTL      │ Contents                 │
├─────────────┼──────────┼──────────────────────────┤
│ OHLC        │ 5s       │ Price data (ltp, high...) │
│ Quotes      │ 2s       │ Market depth, buy/sell   │
│ STP         │ 60s      │ Order placement rules    │
│ Session     │ No expiry│ Auth cookies, headers    │
└─────────────┴──────────┴──────────────────────────┘

Level 3: TMS API (source of truth)
────────────────────────────────────────────────────────
│ Remote │ Slower │ Always current │
│ Accessed: On cache miss or expiry │
────────────────────────────────────────────────────────
```

---

## Error Handling Chain

```
User Request
     │
     ▼
┌─────────────────┐
│ Input Validation│  ───► 400 Bad Request
│ - Required      │        (Missing/invalid fields)
│   fields        │
│ - Field types   │
│ - Value ranges  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Session Check    │  ───► 401 Unauthorized
│ - Has cookies?  │        (Session not authenticated)
│ - Has headers?  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stock Lookup    │  ───► 404 Not Found
│ - Exists in DB? │        (Stock not in database)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Client Info     │  ───► 500 Internal Error
│ - Fetch from    │        (TMS API unavailable)
│   TMS API       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Payload   │  ───► 400 Bad Request
│ - Map types     │        (Invalid order params)
│ - Construct     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit to TMS   │  ───► 401/403/500
│ - POST order/   │        (TMS rejection)
└────────┬────────┘
         │
         ▼
    Success 200
```

---

## Security Model

### Authentication Tokens

```
Browser Session → Extract → Store in Memory → Attach to Requests
     │                │              │                │
     │                │              │                ▼
     │                │              │         ┌──────────────┐
     │                │              │         │ TMS API Call │
     │                │              │         │              │
     │                │              │         │ Headers:     │
     │                │              │         │ - cookie     │
     │                │              │         │ - x-xsrf-... │
     │                │              │         │ - host-se... │
     │                │              │         └──────────────┘
     │                │              │
     ▼                ▼              ▼
┌─────────┐   ┌───────────┐  ┌─────────────┐
│ Cookies │   │  Headers  │  │ SessionService │
│────────│   │───────────│  │──────────────│
│ XSRF   │   │ x-xsrf-   │  │ In-memory    │
│ _aid   │   │ host-     │  │ storage      │
│ _rid   │   │ member... │  │ (not persisted│
└─────────┘   └───────────┘  └─────────────┘

Note: Tokens never written to disk for security
```

---

## File Organization

```
sniper/
│
├── server.js                 # Main Express app
│   ├── Imports services
│   ├── Defines endpoints
│   └── Error handling
│
├── services/
│   ├── sessionService.js     # Session management
│   │   ├── Parse cookies
│   │   ├── Build headers
│   │   ├── Validate session
│   │   └── Cache client info
│   │
│   ├── stockService.js       # Stock data management
│   │   ├── Load from JSON
│   │   ├── Search (symbol/ISIN/ID)
│   │   ├── Cache OHLC/quotes/STP
│   │   └── Upsert stocks
│   │
│   └── orderBuilder.js       # Order construction
│       ├── Validate inputs
│       ├── Resolve stock ID
│       ├── Fetch client data
│       ├── Map order types
│       └── Build TMS payload
│
├── middleware/
│   └── pingTmsMiddleware.js  # TMS API wrapper
│       ├── Store default headers
│       ├── Make axios calls
│       └── Handle responses
│
├── data/
│   └── stocks.json           # Stock database
│
├── examples/
│   └── order-placement-example.js
│
└── docs/
    ├── ARCHITECTURE.md       # This file
    ├── ORDER_PLACEMENT_GUIDE.md
    ├── STOCK_API_GUIDE.md
    └── QUICK_REFERENCE.md
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Server | Express.js | HTTP server & routing |
| HTTP Client | Axios | TMS API communication |
| Data Storage | JSON files | Stock database |
| Caching | JavaScript Map | In-memory caching |
| Session | In-memory objects | Session management |
| Validation | Custom logic | Input validation |

---

## Performance Considerations

### Caching Strategy
- **OHLC**: 5s TTL (balances freshness vs API load)
- **Quotes**: 2s TTL (market depth changes rapidly)
- **STP**: 60s TTL (rules rarely change)

### Lookup Optimization
- Stock search uses Map objects (O(1) lookup)
- Three indexes: by ID, by symbol, by ISIN

### Scalability
- Current: Single-instance, in-memory
- Future: Redis for shared session/cache across instances

---

## Future Enhancements

1. **WebSocket Integration**
   - Real-time price updates
   - Order status notifications

2. **Persistent Session Store**
   - Redis or database storage
   - Auto-refresh tokens

3. **Bulk Stock Import**
   - Fetch all NEPSE stocks
   - Periodic updates

4. **Order Management**
   - View open orders
   - Cancel/modify orders
   - Order history

5. **Risk Management**
   - Position limits
   - Price validation
   - Duplicate order prevention

6. **Multi-User Support**
   - User authentication
   - Session isolation
   - Role-based access

---

## Related Documentation

- [Order Placement Guide](ORDER_PLACEMENT_GUIDE.md) - Complete order API reference
- [Stock API Guide](STOCK_API_GUIDE.md) - Stock search and management
- [Quick Reference](QUICK_REFERENCE.md) - Command cheat sheet
