export interface SniperInstance {
  id: string;                    // UUID
  clientId: string;              // Which client owns this
  symbol: string;                // Stock symbol
  stockId: number;               // Stock ID
  isin: string;                  // ISIN code
  
  // Configuration
  config: {
    targetZone: number;          // e.g., 5
    triggerPrice: number;        // e.g., 107.18
    totalQuantity: number;        // Total shares to buy
    numOrders: number;           // Split into N orders
    orderType: 'LIMIT' | 'MARKET';
    cancelOnFirstFill: boolean;
  };
  
  // State
  status: 'idle' | 'monitoring' | 'triggered' | 'executing' | 'completed' | 'failed' | 'stopped';
  isActive: boolean;
  
  // Live Data
  currentPrice: number | null;
  currentZone: number | null;
  
  // Statistics
  stats: SniperStats;
  
  // Timing
  createdAt: Date;
  triggeredAt: Date | null;
  completedAt: Date | null;
}

export interface SniperStats {
  totalOrders: number;
  successfulOrders: number;      // HTTP 200
  failedOrders: number;          // HTTP 400
  gatewayErrors: number;         // HTTP 502
  
  successRate: number;           // (200 + 400) / total
  currentDelay: number;          // Current calibrated delay
  optimalDelay: number | null;   // Locked optimal delay
  isDelayLocked: boolean;        // Whether delay is locked
  
  avgResponseTime: number;
  totalDuration: number;
  
  orders: OrderResult[];         // Detailed order history
}

export interface OrderResult {
  orderId: string;
  timestamp: Date;
  status: number;                // HTTP status
  quantity: number;
  price: number;
  responseTime: number;
  delay: number;                 // Delay used before this order
  message?: string;              // Error message if any
}

export interface SniperConfig {
  symbol: string;
  stockId: number;
  isin: string;
  targetZone: number;
  triggerPrice: number;
  totalQuantity: number;
  numOrders: number;
  orderType: 'LIMIT' | 'MARKET';
  cancelOnFirstFill: boolean;
}
