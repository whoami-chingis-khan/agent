import { multiClientTmsApi } from './multiClientTmsApi';
import { useSniperStore } from '../store/sniperStore';
import type { SniperInstance } from '../types/sniper';

interface StockMonitorConfig {
  stockId: number;
  isin: string;
  pollInterval: number;  // milliseconds
  clientId: string;
  sniperId: string;
  onPriceUpdate?: (ltp: number, zone: number) => void;
  onError?: (error: Error) => void;
}

class StockMonitor {
  private config: StockMonitorConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: StockMonitorConfig) {
    this.config = config;
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[Stock Monitor] Already running for sniper:', this.config.sniperId);
      return;
    }

    console.log('[Stock Monitor] Starting monitor for sniper:', this.config.sniperId, 'stock:', this.config.stockId);

    this.isRunning = true;
    this.poll();  // Initial poll

    // Setup interval
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.config.pollInterval);
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[Stock Monitor] Stopping monitor for sniper:', this.config.sniperId);

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  private async poll(): Promise<void> {
    try {
      // Get live price data
      const liveData = await multiClientTmsApi.getLivePrice(
        this.config.clientId,
        this.config.stockId,
        this.config.isin
      );

      if (liveData && liveData.ltp !== undefined) {
        const ltp = parseFloat(liveData.ltp);
        const zone = liveData.zone || this.calculateZone(ltp, liveData);

        // Update sniper instance with current price/zone
        useSniperStore.getState().updateSniperInstance(this.config.sniperId, {
          currentPrice: ltp,
          currentZone: zone,
        });

        // Call callback if provided
        if (this.config.onPriceUpdate) {
          this.config.onPriceUpdate(ltp, zone);
        }
      }
    } catch (error) {
      console.error('[Stock Monitor] Error polling price for sniper:', this.config.sniperId, error);
      
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }

  private calculateZone(ltp: number, liveData: any): number {
    // Zone calculation logic based on circuit breakers
    const upperCircuit = liveData.upperCircuit || liveData.maxPrice;
    const lowerCircuit = liveData.lowerCircuit || liveData.minPrice;

    if (!upperCircuit || !lowerCircuit) return 0;

    const range = upperCircuit - lowerCircuit;
    const priceFromBottom = ltp - lowerCircuit;
    const percentFromBottom = (priceFromBottom / range) * 100;

    // Zone mapping (approximate)
    if (percentFromBottom < 2) return -5;
    if (percentFromBottom < 4) return -4;
    if (percentFromBottom < 6) return -3;
    if (percentFromBottom < 8) return -2;
    if (percentFromBottom < 10) return -1;
    if (percentFromBottom > 98) return 5;
    if (percentFromBottom > 96) return 4;
    if (percentFromBottom > 94) return 3;
    if (percentFromBottom > 92) return 2;
    if (percentFromBottom > 90) return 1;

    return 0;  // Normal zone
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// Multi-stock monitor manager
class MultiStockMonitor {
  private monitors: Map<string, StockMonitor> = new Map();

  // Start monitoring for a specific sniper instance
  startMonitoring(sniper: SniperInstance, clientId: string): void {
    const monitorId = sniper.id;

    // Stop existing monitor if any
    this.stopMonitoring(monitorId);

    console.log('[Multi-Stock Monitor] Starting monitor for sniper:', monitorId, 'stock:', sniper.symbol);

    const monitor = new StockMonitor({
      stockId: sniper.stockId,
      isin: sniper.isin,
      pollInterval: 1000,  // 1 second
      clientId,
      sniperId: sniper.id,
      onPriceUpdate: (ltp, zone) => {
        this.handlePriceUpdate(monitorId, ltp, zone, sniper);
      },
      onError: (error) => {
        console.error('[Multi-Stock Monitor] Error for sniper:', monitorId, error);
      },
    });

    monitor.start();
    this.monitors.set(monitorId, monitor);

    // Update sniper status
    useSniperStore.getState().updateSniperInstance(monitorId, {
      status: 'monitoring',
      isActive: true,
    });
  }

  // Stop monitoring for specific sniper instance
  stopMonitoring(sniperId: string): void {
    const monitor = this.monitors.get(sniperId);
    if (monitor) {
      monitor.stop();
      this.monitors.delete(sniperId);
      console.log('[Multi-Stock Monitor] Stopped monitor for sniper:', sniperId);
    }
  }

  // Handle price update for specific instance
  private handlePriceUpdate(
    sniperId: string,
    ltp: number,
    zone: number,
    sniper: SniperInstance
  ): void {
    // Update current price/zone already done in StockMonitor.poll()

    // Check if trigger condition met
    if (this.shouldTrigger(sniper, ltp, zone)) {
      console.log('[Multi-Stock Monitor] Trigger condition met for sniper:', sniperId);
      this.triggerSniper(sniperId);
    }
  }

  // Check if sniper should be triggered
  private shouldTrigger(sniper: SniperInstance, ltp: number, zone: number): boolean {
    // Don't trigger if not in monitoring state
    if (sniper.status !== 'monitoring') return false;

    // Check if price reached target zone
    if (sniper.config.targetZone !== undefined && zone >= sniper.config.targetZone) {
      return true;
    }

    // Check if price reached trigger price
    if (sniper.config.triggerPrice > 0 && ltp >= sniper.config.triggerPrice) {
      return true;
    }

    return false;
  }

  // Trigger sniper execution
  private triggerSniper(sniperId: string): void {
    // Stop monitoring
    this.stopMonitoring(sniperId);

    // Update sniper status
    useSniperStore.getState().updateSniperInstance(sniperId, {
      status: 'triggered',
      triggeredAt: new Date(),
    });

    console.log('[Multi-Stock Monitor] Sniper triggered:', sniperId);

    // Execution will be handled by SniperOrderExecutor
    // The UI or a separate service will listen for 'triggered' status and start execution
  }

  // Stop all monitors
  stopAll(): void {
    this.monitors.forEach((monitor, sniperId) => {
      monitor.stop();
      console.log('[Multi-Stock Monitor] Stopped monitor:', sniperId);
    });
    this.monitors.clear();
  }

  // Get active monitor count
  getActiveCount(): number {
    return this.monitors.size;
  }

  // Check if specific sniper is being monitored
  isMonitoring(sniperId: string): boolean {
    const monitor = this.monitors.get(sniperId);
    return monitor ? monitor.isActive() : false;
  }
}

// Export singleton instance
export const multiStockMonitor = new MultiStockMonitor();
