/**
 * Split Order Service
 * Handles placing multiple orders with configurable delays and cancel-on-first-fill logic
 */

import tmsApi from './tmsApi';
import type { SplitOrderConfig, SplitOrderJob, SplitOrderSubOrder } from '../types/order';

class SplitOrderService {
  private jobs: Map<string, SplitOrderJob> = new Map();

  /**
   * Execute a split order job
   * Places multiple orders with delays, optionally stopping after first success
   */
  async executeSplitOrder(config: SplitOrderConfig): Promise<SplitOrderJob> {
    const jobId = `split_${Date.now()}_${config.symbol}`;
    const startTime = new Date().toISOString();

    // Calculate quantity distribution
    const baseQuantity = Math.floor(config.totalQuantity / config.numOrders);
    const remainder = config.totalQuantity % config.numOrders;

    // Create sub-orders
    const subOrders: SplitOrderSubOrder[] = [];
    for (let i = 0; i < config.numOrders; i++) {
      const quantity = baseQuantity + (i < remainder ? 1 : 0);
      subOrders.push({
        orderId: i + 1,
        quantity,
        price: config.limitPrice,
        status: 'pending',
      });
    }

    // Initialize job
    const job: SplitOrderJob = {
      jobId,
      status: 'running',
      config,
      orders: subOrders,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime,
    };

    this.jobs.set(jobId, job);

    // Execute orders sequentially
    let firstFillDetected = false;

    for (let i = 0; i < subOrders.length; i++) {
      const subOrder = subOrders[i];

      // Check if we should skip this order due to cancel-on-first-fill
      if (firstFillDetected && config.cancelOnFirstFill) {
        subOrder.status = 'skipped';
        subOrder.message = 'Skipped due to first fill success';
        job.skipped++;
        continue;
      }

      // Place the order
      try {
        const orderPayload = {
          stockId: config.stockId,
          isin: config.isin,
          quantity: subOrder.quantity,
          price: config.limitPrice,
          orderType: config.side,
          orderValidity: config.validity,
          ucc: config.ucc,
          clientCode: config.clientCode,
        };

        const response = await tmsApi.placeOrder(orderPayload);

        // Mark as success
        subOrder.status = 'success';
        subOrder.message = 'Order placed successfully';
        subOrder.timestamp = new Date().toISOString();
        subOrder.tmsOrderId = response.orderId || response.id;
        job.successful++;

        // Check if this is the first fill and we should stop
        if (config.cancelOnFirstFill && !firstFillDetected) {
          firstFillDetected = true;
          console.log(`[SplitOrder] First fill detected — skipping remaining ${subOrders.length - i - 1} orders`);
        }
      } catch (error: any) {
        subOrder.status = 'failed';
        subOrder.message = error.response?.data?.message || error.message || 'Failed to place order';
        subOrder.timestamp = new Date().toISOString();
        job.failed++;
      }

      // Update job in store
      this.jobs.set(jobId, { ...job });

      // Add delay before next order (unless this was the last order or we're done)
      if (i < subOrders.length - 1 && !firstFillDetected) {
        await this.delay(config.delayMs);
      }
    }

    // Finalize job
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    job.status = firstFillDetected && config.cancelOnFirstFill ? 'completed_early' : 'completed';
    job.endTime = endTime;
    job.duration = duration;

    this.jobs.set(jobId, job);

    return job;
  }

  /**
   * Get job status by ID
   */
  getJob(jobId: string): SplitOrderJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): SplitOrderJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'completed_early' || job.status === 'failed') {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const splitOrderService = new SplitOrderService();
export default splitOrderService;
