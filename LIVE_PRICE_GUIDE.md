# Live Stock Price Monitoring Guide

## Overview

The NEPSE Trading Assistant now includes **real-time stock price monitoring** that you can integrate into your order placement forms. This allows you to fetch live prices on-demand without needing to start/stop continuous monitoring.

## New Endpoints

### 1. Get Live Stock Price (Recommended for Order Forms)

**Endpoint:** `GET /stock/live-price/:symbol`

**Description:** Fetches real-time price data for a stock. Perfect for displaying live prices in order forms.

**Example Request:**
```bash
curl http://localhost:3000/stock/live-price/NLO
```

**Example Response:**
```json
{
  "ok": true,
  "symbol": "NLO",
  "stockId": 198,
  "isin": "NPE183A00001",
  "price": {
    "ltp": 244.33,
    "open": 244.33,
    "high": 244.33,
    "low": 244.33,
    "close": 244.33,
    "change": 0.0,
    "changePercent": 0.0,
    "volume": 0,
    "avgTradedPrice": 244.33,
    "lastTradedTime": null,
    "lastTradedQty": 0
  },
  "orderBook": {
    "totalBuyQty": 0,
    "totalSellQty": 0,
    "topBuy": [],
    "topSell": []
  },
  "security": {
    "name": "Nepal Lube Oil Limited",
    "companyName": "Nepal Lube Oil Limited",
    "fiftyTwoWeekHigh": 293.2,
    "fiftyTwoWeekLow": 242.1
  },
  "timestamp": 1730195965123
}
```

### 2. Get OHLC Data

**Endpoint:** `GET /stock/ohlc/:symbolOrId`

**Description:** Fetches OHLC (Open, High, Low, Close) validation data.

**Example Request:**
```bash
curl http://localhost:3000/stock/ohlc/NLO
# or
curl http://localhost:3000/stock/ohlc/198
```

## Usage in Order Form

### JavaScript Example (Vanilla)

```javascript
// Fetch price once
async function fetchLivePrice(symbol) {
  try {
    const response = await fetch(`http://localhost:3000/stock/live-price/${symbol}`);
    const data = await response.json();
    
    if (data.ok) {
      console.log(`Current price of ${symbol}: NPR ${data.price.ltp}`);
      return data.price.ltp;
    } else {
      console.error('Error:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch price:', error);
    return null;
  }
}

// Auto-refresh price every 2 seconds
let priceInterval;

function startPriceMonitoring(symbol, callback) {
  // Fetch immediately
  fetchLivePrice(symbol).then(callback);
  
  // Then fetch every 2 seconds
  priceInterval = setInterval(async () => {
    const price = await fetchLivePrice(symbol);
    callback(price);
  }, 2000);
}

function stopPriceMonitoring() {
  if (priceInterval) {
    clearInterval(priceInterval);
  }
}

// Usage
startPriceMonitoring('NLO', (price) => {
  console.log('Updated price:', price);
  // Update your UI here
  document.getElementById('currentPrice').textContent = `NPR ${price}`;
});
```

### React Example

```jsx
import { useState, useEffect } from 'react';

function LivePriceDisplay({ symbol }) {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval;

    const fetchPrice = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:3000/stock/live-price/${symbol}`);
        const data = await response.json();
        
        if (data.ok) {
          setPriceData(data);
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchPrice();

    // Then fetch every 2 seconds
    interval = setInterval(fetchPrice, 2000);

    // Cleanup
    return () => clearInterval(interval);
  }, [symbol]);

  if (!priceData) return <div>Loading...</div>;

  return (
    <div className="price-display">
      <h3>{priceData.symbol}</h3>
      <div className="ltp">
        NPR {priceData.price.ltp.toFixed(2)}
      </div>
      <div className="change" style={{ 
        color: priceData.price.change >= 0 ? 'green' : 'red' 
      }}>
        {priceData.price.change >= 0 ? '+' : ''}
        {priceData.price.change.toFixed(2)} 
        ({priceData.price.changePercent.toFixed(2)}%)
      </div>
    </div>
  );
}
```

### jQuery Example

```javascript
function updatePrice(symbol) {
  $.ajax({
    url: `http://localhost:3000/stock/live-price/${symbol}`,
    method: 'GET',
    success: function(data) {
      if (data.ok) {
        $('#currentPrice').text('NPR ' + data.price.ltp.toFixed(2));
        $('#change').text(data.price.change.toFixed(2));
        $('#changePercent').text(data.price.changePercent.toFixed(2) + '%');
        
        // Color based on change
        if (data.price.change > 0) {
          $('#change').css('color', 'green');
        } else if (data.price.change < 0) {
          $('#change').css('color', 'red');
        }
      }
    },
    error: function(error) {
      console.error('Error:', error);
    }
  });
}

// Auto-refresh every 2 seconds
setInterval(function() {
  updatePrice('NLO');
}, 2000);
```

## Integration with Order Placement

### Example: Order Form with Live Price

```html
<div class="order-form">
  <h2>Place Order</h2>
  
  <label>Stock Symbol:</label>
  <input type="text" id="orderSymbol" value="NLO" onchange="startPriceMonitoring()">
  
  <div class="live-price-section">
    <label>Current Price (LTP):</label>
    <div class="price-display">
      <span id="livePrice">--</span>
      <span id="priceChange" class="change">--</span>
    </div>
    <small class="last-update">Last updated: <span id="lastUpdate">--</span></small>
  </div>
  
  <label>Order Type:</label>
  <select id="orderType">
    <option value="buy">Buy</option>
    <option value="sell">Sell</option>
  </select>
  
  <label>Limit Price:</label>
  <input type="number" id="limitPrice" step="0.01">
  
  <label>Quantity:</label>
  <input type="number" id="quantity" min="10" step="10">
  
  <button onclick="placeOrder()">Place Order</button>
</div>

<script>
let priceMonitorInterval;

function startPriceMonitoring() {
  const symbol = document.getElementById('orderSymbol').value;
  
  // Clear existing interval
  if (priceMonitorInterval) {
    clearInterval(priceMonitorInterval);
  }
  
  // Fetch immediately
  updateLivePrice(symbol);
  
  // Then every 2 seconds
  priceMonitorInterval = setInterval(() => {
    updateLivePrice(symbol);
  }, 2000);
}

async function updateLivePrice(symbol) {
  try {
    const response = await fetch(`http://localhost:3000/stock/live-price/${symbol}`);
    const data = await response.json();
    
    if (data.ok) {
      // Update price display
      document.getElementById('livePrice').textContent = 
        `NPR ${data.price.ltp.toFixed(2)}`;
      
      // Update change
      const changeEl = document.getElementById('priceChange');
      const change = data.price.change;
      const changePercent = data.price.changePercent;
      
      changeEl.textContent = 
        `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
      changeEl.style.color = change >= 0 ? 'green' : 'red';
      
      // Update timestamp
      document.getElementById('lastUpdate').textContent = 
        new Date().toLocaleTimeString();
        
      // Optionally pre-fill limit price with current LTP
      if (!document.getElementById('limitPrice').value) {
        document.getElementById('limitPrice').value = data.price.ltp.toFixed(2);
      }
    }
  } catch (error) {
    console.error('Error fetching price:', error);
  }
}

// Start monitoring when page loads
window.addEventListener('load', startPriceMonitoring);

// Stop monitoring when leaving page
window.addEventListener('beforeunload', () => {
  if (priceMonitorInterval) {
    clearInterval(priceMonitorInterval);
  }
});
</script>
```

## Best Practices

1. **Polling Interval:** Use 1-3 seconds for real-time feel, 5+ seconds for less critical updates
2. **Error Handling:** Always handle network errors gracefully
3. **Cleanup:** Clear intervals when component unmounts or user navigates away
4. **Visual Feedback:** Show loading states and last update timestamp
5. **Price Validation:** Validate limit prices against current LTP before order placement
6. **Battery Consideration:** Stop polling when page is hidden or inactive

## Advanced: WebSocket Alternative (Future Enhancement)

For true real-time updates without polling, consider implementing WebSocket connections:

```javascript
// Future implementation
const ws = new WebSocket('ws://localhost:3000/live-prices');

ws.on('message', (data) => {
  const priceUpdate = JSON.parse(data);
  updatePriceDisplay(priceUpdate);
});

ws.send(JSON.stringify({ subscribe: 'NLO' }));
```

## Demo

Open `examples/live-price-monitor-ui.html` in your browser to see a fully functional live price monitoring interface.

## Troubleshooting

### Price not updating
- Ensure server is running: `node server.js`
- Check if stock exists in database: `GET /stock/search/NLO`
- Verify session headers are configured: `GET /session/status`

### "Stock not found" error
- Add stock to database first: `POST /stock/add`
- Or use stock lookup: `GET /stock/lookup/NLO`

### High latency
- Reduce polling interval
- Check network connection
- Ensure TMS API is responding: `GET /ping-tms`

## API Response Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `price.ltp` | number | Last Traded Price (current market price) |
| `price.open` | number | Opening price of the day |
| `price.high` | number | Highest price of the day |
| `price.low` | number | Lowest price of the day |
| `price.close` | number | Previous closing price |
| `price.change` | number | Change in price (ltp - close) |
| `price.changePercent` | number | Percentage change |
| `price.volume` | number | Total traded volume |
| `orderBook.totalBuyQty` | number | Total quantity in buy orders |
| `orderBook.totalSellQty` | number | Total quantity in sell orders |
| `orderBook.topBuy` | array | Top 5 buy orders |
| `orderBook.topSell` | array | Top 5 sell orders |

---

**Need help?** Check `ORDER_PLACEMENT_GUIDE.md` for order placement integration or `QUICK_REFERENCE.md` for all available endpoints.
