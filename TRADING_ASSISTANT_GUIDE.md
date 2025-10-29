# Trading Assistant Guide

## Overview

The Trading Assistant is an **automated trading system** that monitors stock prices in real-time and executes orders when trigger conditions are met. It handles:

- **Real-time price monitoring** (poll every 1-2 seconds)
- **Conditional order triggers** (buy when LTP ≤ X, sell when LTP ≥ Y)
- **Automatic ±2% price validation** before order placement
- **Split order execution** (place N separate orders automatically)
- **Error handling** for 401, 400, partial success

---

## Quick Start Example

### 1. Update Session (Required)

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

### 2. Add Trigger

```bash
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": "<=",
  "triggerPrice": 240,
  "side": "BUY",
  "limitPrice": 240,
  "totalQuantity": 50,
  "numOrders": 5,
  "validity": "DAY",
  "recurring": false,
  "name": "Buy NLO when dips to 240"
}
```

**What happens next:**
1. System starts monitoring NLO price automatically
2. Every 1.5 seconds, checks if LTP ≤ 240
3. When condition is met:
   - Validates 240 is within ±2% of current LTP
   - Places 5 separate orders of 10 shares each
   - Returns results for each order

### 3. Check Status

```bash
GET /trading/triggers
GET /monitor/status
GET /monitor/price/NLO
```

---

## Core Concepts

### 1. Price Monitoring

The system continuously polls stock prices from TMS API.

**Features:**
- Poll interval: 1-2 seconds (configurable)
- Tracks price history (last 100 points)
- Emits events on price changes
- Supports multiple stocks simultaneously

**Automatic behavior:**
- When you add a trigger, monitoring starts automatically
- Monitoring continues even after trigger executes (if recurring)
- You can also start monitoring manually

### 2. Triggers

A trigger defines **when** and **what** to trade.

**Trigger components:**
- **Condition**: When to execute (`<=`, `>=`, `==`, `<`, `>`)
- **Trigger price**: The price that activates the trigger
- **Action**: What to do (BUY or SELL)
- **Limit price**: Price for the limit order
- **Quantity**: How many shares
- **Split**: How many separate orders
- **Recurring**: Execute once or multiple times

**Trigger lifecycle:**
```
active → condition met → executing → validating → placing orders → executed
                                                                      ↓
                                                    (if recurring) → active
```

### 3. Order Validation (±2% Rule)

**NEPSE Rule**: Limit orders must be within ±2% of current market price.

**How it works:**
1. Check current LTP from price monitor
2. Calculate valid range: `[LTP × 0.98, LTP × 1.02]`
3. Verify limit price is within this range
4. If valid → place order
5. If invalid → log error, mark trigger as failed

**Example:**
- Current LTP: 245
- Valid range: [240.10, 249.90]
- Your limit price: 250 → **REJECTED** (outside range)
- Your limit price: 245 → **ACCEPTED**

### 4. Split Orders

Instead of placing one large order, split into N smaller orders.

**Why split?**
- Reduce market impact
- Better chance of fills
- Comply with broker limits

**How it works:**
- Total quantity: 50 shares
- Split into: 5 orders
- Result: 5 orders of 10 shares each
- Remainder handled automatically (last order gets extra shares)

**Example:**
- Total: 53 shares, split into 5
- Orders: 10, 10, 10, 10, 13 shares

---

## API Reference

### Trading Assistant Endpoints

#### 1. Add Trigger
**POST** `/trading/trigger/add`

```json
{
  "symbol": "NLO",                    // Stock symbol (required)
  "condition": "<=",                  // <=, >=, ==, <, > (required)
  "triggerPrice": 240,                // Activation price (required)
  "side": "BUY",                      // BUY or SELL (required)
  "limitPrice": 240,                  // Order price (required)
  "totalQuantity": 50,                // Total shares (required)
  "numOrders": 5,                     // Split into N orders (default: 1)
  "validity": "DAY",                  // DAY, IOC, GTC (default: DAY)
  "recurring": false,                 // Re-trigger after execution?
  "name": "Optional description"      // Human-readable name
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Trigger added successfully",
  "trigger": {
    "triggerId": "trigger_1_1730188800000",
    "name": "Buy NLO when dips to 240",
    "symbol": "NLO",
    "status": "active",
    ...
  }
}
```

---

#### 2. Get All Triggers
**GET** `/trading/triggers`

Returns all triggers (active, paused, executed).

---

#### 3. Get Trigger by ID
**GET** `/trading/trigger/:triggerId`

Returns specific trigger details including execution history.

---

#### 4. Remove Trigger
**DELETE** `/trading/trigger/:triggerId`

Removes a trigger (stops monitoring if no other triggers for that symbol).

---

#### 5. Pause Trigger
**POST** `/trading/trigger/:triggerId/pause`

Temporarily disable a trigger (monitoring continues).

---

#### 6. Resume Trigger
**POST** `/trading/trigger/:triggerId/resume`

Re-enable a paused trigger.

---

#### 7. Get Execution History
**GET** `/trading/executions?limit=50`

Returns history of executed triggers.

**Response:**
```json
{
  "ok": true,
  "executions": [
    {
      "triggerId": "trigger_1_...",
      "triggerName": "Buy NLO when dips to 240",
      "executionTime": 1730188800000,
      "ltp": 239.5,
      "jobId": "job_1_..."
    }
  ]
}
```

---

### Price Monitoring Endpoints

#### 1. Start Monitoring
**POST** `/monitor/start`

```json
{
  "symbol": "NLO",
  "pollInterval": 1500  // Optional, milliseconds (default: 1500)
}
```

**Note:** Monitoring starts automatically when you add a trigger. Use this endpoint only for manual control.

---

#### 2. Stop Monitoring
**POST** `/monitor/stop`

```json
{
  "symbol": "NLO"
}
```

---

#### 3. Get Monitoring Status
**GET** `/monitor/status`

Returns all active monitors.

**Response:**
```json
{
  "ok": true,
  "monitors": [
    {
      "symbol": "NLO",
      "stockId": 198,
      "currentLtp": 244.33,
      "lastUpdate": 1730188800000,
      "pollInterval": 1500,
      "errors": 0,
      "historyPoints": 45
    }
  ]
}
```

---

#### 4. Get Current Price
**GET** `/monitor/price/:symbol`

Returns latest LTP for a symbol.

---

#### 5. Get Price History
**GET** `/monitor/history/:symbol?limit=50`

Returns historical price data.

---

#### 6. Validate Limit Price
**POST** `/monitor/validate-price`

```json
{
  "symbol": "NLO",
  "limitPrice": 250
}
```

**Response:**
```json
{
  "ok": true,
  "validation": {
    "valid": false,
    "ltp": 244.33,
    "limitPrice": 250,
    "difference": 5.67,
    "percentDiff": 2.32,
    "validRange": {
      "lowerBound": 239.44,
      "upperBound": 249.22
    },
    "reason": "Price must be between 239.44 and 249.22"
  }
}
```

---

### Split Order Endpoints

#### 1. Place Split Orders
**POST** `/order/split`

```json
{
  "symbol": "NLO",
  "side": "BUY",
  "limitPrice": 245,
  "totalQuantity": 50,
  "numOrders": 5,
  "validity": "DAY",
  "delayBetweenOrders": 200,    // Optional, milliseconds
  "validateEachOrder": true,     // Optional, validate before each order
  "stopOnError": false           // Optional, stop if any order fails
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Placed 5/5 orders successfully",
  "job": {
    "jobId": "job_1_1730188800000",
    "successful": 5,
    "failed": 0,
    "duration": 2345,
    "orders": [
      {
        "orderNum": 1,
        "quantity": 10,
        "status": "success",
        "response": { "message": "ORDER PLACEMENT SUCCESS" }
      },
      ...
    ]
  }
}
```

---

#### 2. Get Job Status
**GET** `/order/job/:jobId`

Returns detailed status of a split order job.

---

#### 3. Get All Jobs
**GET** `/order/jobs`

Returns all split order jobs.

---

## Usage Patterns

### Pattern 1: Buy Dip

**Goal:** Buy when price drops to 240 or below.

```bash
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": "<=",
  "triggerPrice": 240,
  "side": "BUY",
  "limitPrice": 240,
  "totalQuantity": 50,
  "numOrders": 5,
  "validity": "DAY"
}
```

**Behavior:**
- Waits for LTP ≤ 240
- Validates 240 is within ±2% of LTP at execution time
- Places 5 orders of 10 shares each
- Trigger executes once and stops

---

### Pattern 2: Sell Rally

**Goal:** Sell when price rises to 260 or above.

```bash
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": ">=",
  "triggerPrice": 260,
  "side": "SELL",
  "limitPrice": 260,
  "totalQuantity": 100,
  "numOrders": 10,
  "validity": "DAY"
}
```

---

### Pattern 3: Recurring Scalp

**Goal:** Buy every time price hits 245 exactly (for scalping).

```bash
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": "<=",
  "triggerPrice": 245,
  "side": "BUY",
  "limitPrice": 245,
  "totalQuantity": 10,
  "numOrders": 1,
  "validity": "IOC",
  "recurring": true,
  "name": "Scalp NLO at 245"
}
```

**Behavior:**
- Every time LTP ≤ 245, places order
- After execution, trigger remains active
- Can fire multiple times in a day

---

### Pattern 4: Manual Split Order (No Trigger)

**Goal:** Place split orders immediately without waiting for trigger.

```bash
POST /order/split
{
  "symbol": "NLO",
  "side": "BUY",
  "limitPrice": 244,
  "totalQuantity": 100,
  "numOrders": 10,
  "validity": "DAY",
  "validateEachOrder": true
}
```

**Behavior:**
- Validates price before EVERY order
- Places 10 orders of 10 shares each
- Continues even if some orders fail

---

## Complete Workflow Example

### Scenario: Buy 50 shares of NLO when it dips below 240

```bash
# Step 1: Ensure session is authenticated
POST /update-headers
{ "headers": { ... } }

# Step 2: Add the trigger
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": "<=",
  "triggerPrice": 240,
  "side": "BUY",
  "limitPrice": 240,
  "totalQuantity": 50,
  "numOrders": 5,
  "validity": "DAY",
  "name": "Buy NLO dip"
}

# Response:
{
  "ok": true,
  "trigger": {
    "triggerId": "trigger_1_1730188800000",
    "status": "active"
  }
}

# Step 3: System starts monitoring automatically
# Console output:
# "Started monitoring NLO (ID: 198) every 1500ms"
# "✓ Trigger added: Buy NLO dip"

# Step 4: Monitor checks price every 1.5s
# (waiting for LTP ≤ 240)

# Step 5: When LTP reaches 239.5:
# Console output:
# "🎯 TRIGGER ACTIVATED: Buy NLO dip"
# "  Current LTP: 239.5"
# "  Trigger Price: 240"
# "✓ Price validation passed (LTP: 239.5)"
# ""
# "=== Split Order Job job_1_... ==="
# "Symbol: NLO"
# "Total Quantity: 50"
# "Split into: 5 orders"
# "Quantity per order: 10"
# ""
# "[1/5] Placing order: 10 x NLO @ 240..."
# "  ✓ Order 1 placed successfully"
# "[2/5] Placing order: 10 x NLO @ 240..."
# "  ✓ Order 2 placed successfully"
# ... (continues for all 5 orders)

# Step 6: Check results
GET /trading/trigger/trigger_1_1730188800000

# Response shows execution details:
{
  "trigger": {
    "status": "executed",
    "executionCount": 1,
    "executions": [
      {
        "timestamp": 1730188800000,
        "ltp": 239.5,
        "status": "success",
        "successful": 5,
        "failed": 0
      }
    ]
  }
}
```

---

## Error Handling

### Error 1: Price Validation Failed

**Scenario:** Trigger activates but limit price is outside ±2% range.

**Example:**
- Trigger: Buy when LTP ≤ 240
- LTP drops to 230 (very fast drop)
- Your limit price: 240
- 240 is NOT within [230×0.98, 230×1.02] = [225.4, 234.6]

**Result:**
- Trigger marked as "validation_failed"
- No orders placed
- Logged in execution history

**Solution:**
- Use dynamic limit price (same as trigger price)
- OR adjust limit price based on current LTP

---

### Error 2: Session Expired (401)

**Scenario:** Session cookies expired during execution.

**Result:**
- Some orders may succeed, others fail with 401
- Job marked as partially successful

**Solution:**
- Re-extract headers from browser
- Call `POST /update-headers`
- Resume or retry

---

### Error 3: Stock Not in Database

**Scenario:** Trigger symbol not found in `stocks.json`.

**Result:**
- Error when adding trigger: "Stock not found: ABC"

**Solution:**
- Add stock to database first:
```bash
POST /stock/add
{
  "id": 123,
  "symbol": "ABC",
  "isin": "NPE...",
  "name": "ABC Company",
  "boardLotQuantity": 1,
  "tickSize": 0.1
}
```

---

### Error 4: Partial Success

**Scenario:** Some orders succeed, some fail (network issues, price moves out of range).

**Example:**
- 5 orders total
- Orders 1-3: Success
- Order 4: 401 error (session expired)
- Order 5: Not attempted (stopOnError=true)

**Result:**
```json
{
  "successful": 3,
  "failed": 1,
  "orders": [
    { "orderNum": 1, "status": "success" },
    { "orderNum": 2, "status": "success" },
    { "orderNum": 3, "status": "success" },
    { "orderNum": 4, "status": "failed", "error": "401 UNAUTHORIZED" }
  ]
}
```

**Solution:**
- Check job status
- Manually retry failed orders if needed

---

## Advanced Features

### 1. Multiple Triggers on Same Stock

You can have multiple triggers for the same stock:

```bash
# Trigger 1: Buy dip
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": "<=",
  "triggerPrice": 240,
  "side": "BUY",
  "limitPrice": 240,
  "totalQuantity": 50,
  "numOrders": 5
}

# Trigger 2: Sell rally
POST /trading/trigger/add
{
  "symbol": "NLO",
  "condition": ">=",
  "triggerPrice": 260,
  "side": "SELL",
  "limitPrice": 260,
  "totalQuantity": 50,
  "numOrders": 5
}
```

Both triggers share the same price monitor.

---

### 2. Price History Analysis

Get recent price data for analysis:

```bash
GET /monitor/history/NLO?limit=100
```

**Response:**
```json
{
  "ok": true,
  "symbol": "NLO",
  "history": [
    {
      "timestamp": 1730188800000,
      "ltp": 244.33,
      "volume": 15000,
      "totalBuyQty": 22423,
      "totalSellQty": 0
    },
    ...
  ]
}
```

Use this to:
- Plot price charts
- Calculate moving averages
- Detect trends

---

### 3. Event Listening (WebSocket Alternative)

The system emits events internally. For a frontend, you could:

1. Poll `/monitor/status` every few seconds
2. Poll `/monitor/price/:symbol` for latest price
3. Check `/trading/triggers` for trigger status

Future enhancement: Add WebSocket endpoint to push price updates to clients.

---

## Configuration Options

### Poll Interval

**Default:** 1500ms (1.5 seconds)

**Adjust:**
```bash
POST /monitor/start
{
  "symbol": "NLO",
  "pollInterval": 1000  # 1 second (more frequent)
}
```

**Tradeoffs:**
- Faster (1s): More responsive, but higher API load
- Slower (3s): Lower load, but may miss rapid price moves

---

### Delay Between Split Orders

**Default:** 200ms

**Adjust:**
```bash
POST /order/split
{
  ...
  "delayBetweenOrders": 500  # 500ms delay
}
```

**Why?**
- Spread out orders over time
- Reduce chance of all orders hitting simultaneously
- Mimic manual trading

---

### Stop on Error

**Default:** `false` (continues placing orders even if some fail)

**Adjust:**
```bash
POST /order/split
{
  ...
  "stopOnError": true  # Stop on first error
}
```

---

## Best Practices

### 1. Always Update Session First

```bash
# GOOD
POST /update-headers
POST /trading/trigger/add

# BAD
POST /trading/trigger/add  # Will fail with 401 later
```

---

### 2. Test with Small Quantities First

```bash
# Test trigger
POST /trading/trigger/add
{
  "totalQuantity": 1,  # Just 1 share
  "numOrders": 1,
  ...
}
```

---

### 3. Use Recurring Triggers Carefully

Recurring triggers can execute multiple times. Make sure you:
- Have sufficient funds
- Monitor execution count
- Remove trigger when done

---

### 4. Validate Prices Before Adding Triggers

```bash
# Check current price first
GET /monitor/price/NLO

# Then validate your limit price
POST /monitor/validate-price
{
  "symbol": "NLO",
  "limitPrice": 240
}

# If valid, add trigger
POST /trading/trigger/add { ... }
```

---

### 5. Monitor Execution History

Regularly check:
```bash
GET /trading/executions
GET /order/jobs
```

Review failed orders and adjust strategy.

---

## Troubleshooting

### Issue: Trigger not activating

**Check:**
1. Is monitoring active? `GET /monitor/status`
2. Is trigger active? `GET /trading/triggers`
3. Is current price meeting condition? `GET /monitor/price/:symbol`

---

### Issue: Orders failing with 401

**Solution:**
1. Session expired
2. Extract fresh headers from browser
3. `POST /update-headers`

---

### Issue: Orders failing with "price validation failed"

**Cause:** Price moved outside ±2% range between trigger and execution.

**Solution:**
- Use smaller poll interval for faster execution
- OR use `triggerPrice` same as `limitPrice` for better alignment

---

### Issue: Stock monitor stopped

**Check console logs:**
- "Too many errors for NLO, stopping monitor"

**Cause:** Network issues or API unavailable

**Solution:**
- Check TMS API status
- Restart monitor: `POST /monitor/start { "symbol": "NLO" }`

---

## File References

- Price monitor: `services/priceMonitor.js`
- Split order placer: `services/splitOrderPlacer.js`
- Trading assistant: `services/tradingAssistant.js`
- API endpoints: `server.js:572-805`

---

## Next Steps

1. **Build a UI** with:
   - Trigger creation form
   - Live price display
   - Trigger status dashboard
   - Execution history

2. **Add WebSocket support** for real-time updates

3. **Enhance error recovery**:
   - Auto-refresh session
   - Retry failed orders

4. **Add more trigger types**:
   - Trailing stop
   - Time-based triggers
   - Volume-based triggers
