import { useSniperStore } from '../store/sniperStore';

interface DelayCalibrationConfig {
  minDelay: number;
  maxDelay: number;
  targetSuccessRate: number;
  checkInterval: number;  // Check every N orders
  stabilityWindow: number;  // Lock after N stable orders
}

interface DelayCalibrationState {
  currentDelay: number;
  recentResults: number[];  // Recent HTTP status codes
  adjustmentHistory: number[];
  isLocked: boolean;
  optimalDelay: number | null;
  lastAdjustment: number;  // Order count at last adjustment
}

class DelayCalibrator {
  private config: DelayCalibrationConfig;
  private state: DelayCalibrationState;
  private sniperId: string;

  constructor(sniperId: string, config?: Partial<DelayCalibrationConfig>) {
    this.sniperId = sniperId;
    this.config = {
      minDelay: config?.minDelay ?? 50,
      maxDelay: config?.maxDelay ?? 5000,
      targetSuccessRate: config?.targetSuccessRate ?? 0.90,
      checkInterval: config?.checkInterval ?? 10,
      stabilityWindow: config?.stabilityWindow ?? 30,
    };

    this.state = {
      currentDelay: this.config.minDelay,
      recentResults: [],
      adjustmentHistory: [this.config.minDelay],
      isLocked: false,
      optimalDelay: null,
      lastAdjustment: 0,
    };

    console.log('[Delay Calibrator] Initialized for sniper:', sniperId, 'Starting delay:', this.config.minDelay);
  }

  // Record order result and return next delay
  calibrate(statusCode: number, _responseTime: number): number {
    // Don't calibrate if locked
    if (this.state.isLocked && this.state.optimalDelay) {
      return this.state.optimalDelay;
    }

    // Add result to recent history
    this.state.recentResults.push(statusCode);

    // Keep only last 50 results
    if (this.state.recentResults.length > 50) {
      this.state.recentResults.shift();
    }

    // Get total orders from sniper stats
    const sniper = useSniperStore.getState().getSniperInstance(this.sniperId);
    if (!sniper) return this.state.currentDelay;

    const totalOrders = sniper.stats.totalOrders;

    // Adjust delay every checkInterval orders
    if (totalOrders > 0 && totalOrders % this.config.checkInterval === 0) {
      this.adjustDelay(totalOrders);
    }

    // Check if we should lock the delay
    if (totalOrders >= this.config.stabilityWindow && !this.state.isLocked) {
      this.checkForStability(totalOrders);
    }

    // Update sniper stats
    useSniperStore.getState().updateSniperStats(this.sniperId, {
      currentDelay: this.state.currentDelay,
      optimalDelay: this.state.optimalDelay,
      isDelayLocked: this.state.isLocked,
    });

    return this.state.currentDelay;
  }

  private adjustDelay(totalOrders: number): void {
    const successRate = this.calculateSuccessRate();

    console.log('[Delay Calibrator] Sniper:', this.sniperId, 
      'Orders:', totalOrders, 
      'Success Rate:', (successRate * 100).toFixed(1) + '%',
      'Current Delay:', this.state.currentDelay
    );

    let newDelay = this.state.currentDelay;

    if (successRate < this.config.targetSuccessRate) {
      // Too many 502s - slow down significantly
      const increase = Math.max(50, this.state.currentDelay * 0.5);  // Increase by 50% or 50ms minimum
      newDelay = Math.min(this.state.currentDelay + increase, this.config.maxDelay);
      console.log('[Delay Calibrator] ⬆️ Increasing delay:', this.state.currentDelay, '→', newDelay);
    } else if (successRate > 0.95 && this.state.currentDelay > this.config.minDelay) {
      // Success rate too high - try speeding up
      const decrease = Math.max(25, this.state.currentDelay * 0.2);  // Decrease by 20% or 25ms minimum
      newDelay = Math.max(this.state.currentDelay - decrease, this.config.minDelay);
      console.log('[Delay Calibrator] ⬇️ Decreasing delay:', this.state.currentDelay, '→', newDelay);
    } else {
      // Success rate in target range (90-95%) - maintain current delay
      console.log('[Delay Calibrator] ✓ Delay optimal, maintaining:', this.state.currentDelay);
    }

    this.state.currentDelay = Math.round(newDelay);
    this.state.adjustmentHistory.push(this.state.currentDelay);
    this.state.lastAdjustment = totalOrders;
  }

  private calculateSuccessRate(): number {
    if (this.state.recentResults.length === 0) return 0;

    // Count 200 and 400 as success (order was accepted by TMS)
    const successCount = this.state.recentResults.filter(
      (status) => status === 200 || status === 400
    ).length;

    return successCount / this.state.recentResults.length;
  }

  private checkForStability(_totalOrders: number): void {
    // Check if success rate has been stable in target range
    if (this.state.recentResults.length < this.config.stabilityWindow) {
      return;
    }

    const successRate = this.calculateSuccessRate();

    // Lock if success rate is in target range (90-95%)
    if (successRate >= this.config.targetSuccessRate && successRate <= 0.95) {
      // Check if delay hasn't changed in last 20 orders
      const recentHistory = this.state.adjustmentHistory.slice(-3);
      const isStable = recentHistory.every((delay) => 
        Math.abs(delay - this.state.currentDelay) < 50
      );

      if (isStable) {
        this.state.isLocked = true;
        this.state.optimalDelay = this.state.currentDelay;

        console.log('[Delay Calibrator] 🔒 Delay LOCKED at', this.state.optimalDelay, 
          'ms for sniper:', this.sniperId,
          'Success Rate:', (successRate * 100).toFixed(1) + '%'
        );

        // Update sniper stats
        useSniperStore.getState().updateSniperStats(this.sniperId, {
          optimalDelay: this.state.optimalDelay,
          isDelayLocked: true,
        });
      }
    }
  }

  // Force unlock for manual adjustments
  unlock(): void {
    this.state.isLocked = false;
    this.state.optimalDelay = null;
    console.log('[Delay Calibrator] 🔓 Unlocked delay for sniper:', this.sniperId);
  }

  // Get current delay
  getCurrentDelay(): number {
    return this.state.currentDelay;
  }

  // Get calibration state
  getState(): DelayCalibrationState {
    return { ...this.state };
  }
}

// Singleton manager for all calibrators
class PerInstanceDelayCalibrator {
  private calibrators: Map<string, DelayCalibrator> = new Map();

  // Get or create calibrator for specific sniper instance
  getCalibratorForInstance(sniperId: string, config?: Partial<DelayCalibrationConfig>): DelayCalibrator {
    if (!this.calibrators.has(sniperId)) {
      const calibrator = new DelayCalibrator(sniperId, config);
      this.calibrators.set(sniperId, calibrator);
    }

    return this.calibrators.get(sniperId)!;
  }

  // Feed order result to calibrator and get next delay
  recordOrderResult(sniperId: string, statusCode: number, responseTime: number): number {
    const calibrator = this.getCalibratorForInstance(sniperId);
    return calibrator.calibrate(statusCode, responseTime);
  }

  // Remove calibrator when sniper is removed
  removeCalibrator(sniperId: string): void {
    this.calibrators.delete(sniperId);
    console.log('[Per-Instance Calibrator] Removed calibrator for sniper:', sniperId);
  }

  // Get calibrator state
  getCalibratorState(sniperId: string): DelayCalibrationState | null {
    const calibrator = this.calibrators.get(sniperId);
    return calibrator ? calibrator.getState() : null;
  }
}

// Export singleton instance
export const perInstanceCalibrator = new PerInstanceDelayCalibrator();
