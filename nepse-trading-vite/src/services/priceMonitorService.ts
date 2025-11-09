/**
 * Price Monitor Service
 * Enhanced live price monitoring for IPO listing day trading
 * Fetches live prices, OHLC, and STP data with automatic circuit ladder calculation
 */

import tmsApi from './tmsApi';
import { buildCircuitLadder, isInTriggerZone, type CircuitLadder } from '../utils/circuitCalculator';
import type { LivePrice, OHLC } from '../types/stock';

export interface StockMonitorData {
  livePrice: LivePrice;
  ohlc: OHLC;
  stp: {
    upperCircuit: number;
    lowerCircuit: number;
    tickSize: number;
  };
  circuitLadder: CircuitLadder;
  isInTriggerZone: boolean;
  timestamp: number;
}

export type TriggerCallback = (data: StockMonitorData) => void;

class PriceMonitorService {
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private triggerCallbacks: Set<TriggerCallback> = new Set();
  private lastTriggerState: boolean = false;
  private isMonitoring: boolean = false;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 3;

  /**
   * Start monitoring a stock with automatic circuit ladder calculation
   */
  async startMonitoring(
    stockId: number,
    symbol: string,
    isin: string,
    previousClose: number,
    intervalMs: number = 1000,
    onUpdate: (data: StockMonitorData) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // Stop any existing monitoring
    this.stopMonitoring();

    this.isMonitoring = true;

    const fetchData = async () => {
      if (!this.isMonitoring) return;

      try {
        // Fetch all data in parallel
        // The tmsApi automatically handles session refresh on 401 errors
        const [livePriceRes, ohlcRes, stpRes] = await Promise.all([
          tmsApi.getLivePrice(symbol, stockId),
          tmsApi.getOHLC(stockId, isin),
          tmsApi.getSTP(isin),
        ]);

        // Build circuit ladder based on current LTP
        const circuitLadder = buildCircuitLadder(
          livePriceRes.ltp,
          previousClose,
          stpRes.tickSize || 0.01
        );

        // Check if we're in trigger zone
        const inTriggerZone = isInTriggerZone(livePriceRes.ltp, circuitLadder.triggerPrice);

        const monitorData: StockMonitorData = {
          livePrice: livePriceRes,
          ohlc: ohlcRes,
          stp: stpRes,
          circuitLadder,
          isInTriggerZone: inTriggerZone,
          timestamp: Date.now(),
        };

        // Call update callback
        onUpdate(monitorData);

        // Check for trigger zone entry (transition from false to true)
        if (inTriggerZone && !this.lastTriggerState) {
          this.notifyTriggerCallbacks(monitorData);
        }

        this.lastTriggerState = inTriggerZone;

        // Reset error counter on successful fetch
        this.consecutiveErrors = 0;
      } catch (error: any) {
        this.consecutiveErrors++;

        // Handle session-related errors specifically
        if (error.response?.status === 401) {
          console.warn('[Price Monitor] Session expired - auto-refresh in progress...');
          // The tmsApi interceptor handles refresh automatically
          // Don't count 401 errors towards stopping the monitor
          this.consecutiveErrors = 0;
        }

        // Only call error handler if we haven't exceeded max consecutive errors
        if (this.consecutiveErrors < this.maxConsecutiveErrors) {
          onError(error as Error);
        } else {
          console.error('[Price Monitor] Too many consecutive errors, stopping monitoring');
          this.stopMonitoring();
          onError(new Error('Monitoring stopped due to repeated errors'));
        }
      }
    };

    // Initial fetch
    await fetchData();

    // Set up polling
    this.pollingInterval = setInterval(fetchData, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isMonitoring = false;
    this.lastTriggerState = false;
    this.consecutiveErrors = 0;
  }

  /**
   * Register callback for trigger zone entry
   */
  onTriggerZoneEntry(callback: TriggerCallback): () => void {
    this.triggerCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.triggerCallbacks.delete(callback);
    };
  }

  /**
   * Notify all trigger callbacks
   */
  private notifyTriggerCallbacks(data: StockMonitorData): void {
    this.triggerCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in trigger callback:', error);
      }
    });
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { isMonitoring: boolean; isInTriggerZone: boolean } {
    return {
      isMonitoring: this.isMonitoring,
      isInTriggerZone: this.lastTriggerState,
    };
  }

  /**
   * Fetch stock data once without starting monitoring
   */
  async fetchOnce(
    stockId: number,
    symbol: string,
    isin: string,
    previousClose: number
  ): Promise<StockMonitorData> {
    const [livePriceRes, ohlcRes, stpRes] = await Promise.all([
      tmsApi.getLivePrice(symbol, stockId),
      tmsApi.getOHLC(stockId, isin),
      tmsApi.getSTP(isin),
    ]);

    const circuitLadder = buildCircuitLadder(
      livePriceRes.ltp,
      previousClose,
      stpRes.tickSize || 0.01
    );

    const inTriggerZone = isInTriggerZone(livePriceRes.ltp, circuitLadder.triggerPrice);

    return {
      livePrice: livePriceRes,
      ohlc: ohlcRes,
      stp: stpRes,
      circuitLadder,
      isInTriggerZone: inTriggerZone,
      timestamp: Date.now(),
    };
  }
}

export const priceMonitorService = new PriceMonitorService();
export default priceMonitorService;
