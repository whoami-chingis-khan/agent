export interface Stock {
  id: number;
  symbol: string;
  isin: string;
  companyName: string;
  securityName: string;
  activeStatus: string;
  instrumentType: string;
}

export interface LivePrice {
  stockId: number;
  symbol: string;
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  totalTrade: number;
}

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
}

export interface STP {
  upperCircuit: number;
  lowerCircuit: number;
  tickSize: number;
}
