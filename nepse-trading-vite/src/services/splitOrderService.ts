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

    // Execute orders with burst strategy for IPO sniping
    let firstFillDetected = false;
    const burstSize = 5; // Number of orders to send in parallel bursts

    // Group orders into bursts
    const orderBursts: SplitOrderSubOrder[][] = [];
    for (let i = 0; i < subOrders.length; i += burstSize) {
      orderBursts.push(subOrders.slice(i, i + burstSize));
    }

    console.log(`[SplitOrder] Executing ${subOrders.length} orders in ${orderBursts.length} burst(s) of ${burstSize}`);

    for (let burstIndex = 0; burstIndex < orderBursts.length; burstIndex++) {
      const burst = orderBursts[burstIndex];

      // Check if we should skip this burst due to cancel-on-first-fill
      if (firstFillDetected && config.cancelOnFirstFill) {
        burst.forEach(subOrder => {
          subOrder.status = 'skipped';
          subOrder.message = 'Skipped due to first fill success';
          job.skipped++;
        });
        continue;
      }

      console.log(`[SplitOrder] 🚀 Burst ${burstIndex + 1}/${orderBursts.length}: Sending ${burst.length} orders in parallel...`);

      // Send all orders in this burst simultaneously
      const burstPromises = burst.map(async (subOrder) => {
        if (firstFillDetected && config.cancelOnFirstFill) {
          subOrder.status = 'skipped';
          subOrder.message = 'Skipped due to first fill success';
          job.skipped++;
          return;
        }

      // Place the order
      try {
        // Build complete TMS order payload matching the exact API structure
        const orderPayload = {
          orderBook: {
            orderBookExtensions: [{
              orderTypes: {
                id: 1,
                orderTypeCode: "LMT"  // LIMIT order
              },
              disclosedQuantity: 0,
              orderValidity: {
                id: 1,
                orderValidityCode: config.validity || "DAY"
              },
              triggerPrice: 0,
              orderPrice: config.limitPrice,
              orderQuantity: subOrder.quantity,
              remainingOrderQuantity: subOrder.quantity,
              marketType: {
                id: 2,
                marketType: "Continuous"
              }
            }],
            exchange: { id: 1 },
            dnaConnection: {},
            dealer: {},
            member: {},
            productType: {
              id: 1,
              productCode: "CNC"
            },
            instrumentType: {
              id: 1,
              code: "EQ"
            },
            client: {
              id: parseInt(config.clientCode),
              notsUniqueClientCode: config.ucc
            },
            security: {
              id: config.stockId
            },
            accountType: 1,
            cpMemberId: 0,
            buyOrSell: config.side === 'B' ? 1 : 2  // 1 = BUY, 2 = SELL
          },
          orderPlacedBy: 2,
          exchangeOrderId: null
        };

        console.log('[SplitOrder] Placing order #' + subOrder.orderId + ':', {
          securityId: config.stockId,
          quantity: subOrder.quantity,
          price: config.limitPrice,
          side: config.side,
        });

          const response = await tmsApi.placeOrder(orderPayload);
          console.log('[SplitOrder] ✅ Order #' + subOrder.orderId + ' SUCCESS');

          // Mark as success
          subOrder.status = 'success';
          subOrder.message = 'Order placed successfully';
          subOrder.timestamp = new Date().toISOString();
          subOrder.tmsOrderId = response.orderId || response.id;
          job.successful++;

          // Check if this is the first fill and we should stop
          if (config.cancelOnFirstFill && !firstFillDetected) {
            firstFillDetected = true;
            console.log(`[SplitOrder] 🎯 First fill detected — will skip remaining orders`);
          }
        } catch (error: any) {
          console.error('[SplitOrder] ❌ Order #' + subOrder.orderId + ' FAILED:', error.response?.data?.message || error.message);
          subOrder.status = 'failed';
          subOrder.message = error.response?.data?.message || error.message || 'Failed to place order';
          subOrder.timestamp = new Date().toISOString();
          job.failed++;
        }
      });

      // Wait for all orders in this burst to complete
      await Promise.all(burstPromises);
      console.log(`[SplitOrder] ✅ Burst ${burstIndex + 1} completed: ${job.successful} successful, ${job.failed} failed`);

      // Update job in store after each burst
      this.jobs.set(jobId, { ...job });

      // Add delay before next burst (unless this was the last burst or first fill detected)
      if (burstIndex < orderBursts.length - 1 && !firstFillDetected) {
        console.log(`[SplitOrder] ⏳ Waiting ${config.delayMs}ms before next burst...`);
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
