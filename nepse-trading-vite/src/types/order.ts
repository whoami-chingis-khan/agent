export interface OrderPayload {
  stockId: number;
  isin: string;
  quantity: number;
  price: number;
  orderType: 'B' | 'S'; // Buy or Sell
  orderValidity: string;
  ucc: string;
  clientCode: string;
}

export interface Order {
  orderId: string;
  stockId: number;
  symbol: string;
  quantity: number;
  price: number;
  orderType: 'B' | 'S';
  status: string;
  timestamp: string;
}

export interface SplitOrderConfig {
  symbol: string;
  stockId: number;
  isin: string;
  side: 'B' | 'S';
  totalQuantity: number;
  numOrders: number;
  limitPrice: number;
  orderType: 'LIMIT' | 'MARKET';
  validity: string;
  delayMs: number;
  validatePrice: boolean;
  cancelOnFirstFill: boolean; // Stop placing orders after first success
  ucc: string;
  clientCode: string;
}

export interface SplitOrderSubOrder {
  orderId: number;
  quantity: number;
  price: number;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  message?: string;
  timestamp?: string;
  tmsOrderId?: string;
}

export interface SplitOrderJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'completed_early' | 'failed';
  config: SplitOrderConfig;
  orders: SplitOrderSubOrder[];
  successful: number;
  failed: number;
  skipped: number;
  startTime: string;
  endTime?: string;
  duration?: number;
}
