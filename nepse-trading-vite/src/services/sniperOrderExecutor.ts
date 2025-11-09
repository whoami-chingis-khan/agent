import { multiClientTmsApi } from './multiClientTmsApi';
import { perInstanceCalibrator } from './delayCalibrator';
import { useSniperStore } from '../store/sniperStore';
import { useClientStore } from '../store/clientStore';
import type { SniperInstance, OrderResult } from '../types/sniper';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class SniperOrderExecutor {
  // Execute orders for a triggered sniper instance
  async executeSniperOrders(sniperId: string): Promise<void> {
    const sniper = useSniperStore.getState().getSniperInstance(sniperId);
    if (!sniper) {
      console.error('[Sniper Executor] Sniper not found:', sniperId);
      return;
    }

    const client = useClientStore.getState().getClient(sniper.clientId);
    if (!client) {
      console.error('[Sniper Executor] Client not found:', sniper.clientId);
      return;
    }

    console.log('[Sniper Executor] Starting execution for sniper:', sniperId, 'stock:', sniper.symbol);

    // Update status
    useSniperStore.getState().updateSniperInstance(sniperId, {
      status: 'executing',
    });

    // Generate orders
    const orders = this.generateOrders(sniper);
    console.log('[Sniper Executor] Generated', orders.length, 'orders');

    const startTime = Date.now();
    let currentDelay = 50;  // Start with minimum delay

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

      // Wait before order (except first)
      if (i > 0) {
        await sleep(currentDelay);
      }

      // Place order
      const orderStartTime = Date.now();
      let orderResult: OrderResult;

      try {
        const response = await multiClientTmsApi.placeOrder(sniper.clientId, order);
        const responseTime = Date.now() - orderStartTime;

        orderResult = {
          orderId: response.orderId || `order_${i + 1}`,
          timestamp: new Date(),
          status: 200,  // Success
          quantity: order.orderBook.orderBookExtensions[0].orderQuantity,
          price: order.orderBook.orderBookExtensions[0].orderPrice,
          responseTime,
          delay: currentDelay,
          message: 'Order placed successfully',
        };

        console.log(`[Sniper Executor] Order ${i + 1}/${orders.length} - SUCCESS (200) - Delay: ${currentDelay}ms`);

        // Update stats
        this.updateStats(sniperId, orderResult, 200);

        // Calibrate delay for next order
        currentDelay = perInstanceCalibrator.recordOrderResult(sniperId, 200, responseTime);

        // Check cancel-on-first-fill
        if (sniper.config.cancelOnFirstFill) {
          console.log('[Sniper Executor] First fill successful, cancelling remaining orders');
          break;
        }

      } catch (error: any) {
        const responseTime = Date.now() - orderStartTime;
        const status = error.response?.status || 502;

        orderResult = {
          orderId: `order_${i + 1}`,
          timestamp: new Date(),
          status,
          quantity: order.orderBook.orderBookExtensions[0].orderQuantity,
          price: order.orderBook.orderBookExtensions[0].orderPrice,
          responseTime,
          delay: currentDelay,
          message: error.response?.data?.message || error.message || 'Unknown error',
        };

        console.log(`[Sniper Executor] Order ${i + 1}/${orders.length} - FAILED (${status}) - Delay: ${currentDelay}ms`);

        // Update stats
        this.updateStats(sniperId, orderResult, status);

        // Calibrate delay for next order
        currentDelay = perInstanceCalibrator.recordOrderResult(sniperId, status, responseTime);
      }

      // Add order to history
      const currentSniper = useSniperStore.getState().getSniperInstance(sniperId);
      if (currentSniper) {
        useSniperStore.getState().updateSniperStats(sniperId, {
          orders: [...currentSniper.stats.orders, orderResult],
        });
      }
    }

    // Calculate total duration
    const totalDuration = Date.now() - startTime;

    // Mark sniper as completed
    useSniperStore.getState().updateSniperInstance(sniperId, {
      status: 'completed',
      completedAt: new Date(),
      isActive: false,
    });

    useSniperStore.getState().updateSniperStats(sniperId, {
      totalDuration,
    });

    console.log('[Sniper Executor] Execution completed for sniper:', sniperId, 
      'Duration:', totalDuration + 'ms');
  }

  // Generate split orders from sniper config
  private generateOrders(sniper: SniperInstance): any[] {
    const { totalQuantity, numOrders, orderType } = sniper.config;
    const orders: any[] = [];

    // Calculate quantity per order
    const baseQuantity = Math.floor(totalQuantity / numOrders);
    const remainder = totalQuantity % numOrders;

    for (let i = 0; i < numOrders; i++) {
      // Distribute remainder across first few orders
      const quantity = baseQuantity + (i < remainder ? 1 : 0);

      const order = {
        orderBook: {
          buySell: 'B',  // Buy
          orderType: orderType,
          stockId: sniper.stockId,
          orderBookExtensions: [
            {
              orderQuantity: quantity,
              orderPrice: sniper.currentPrice || 0,  // Use current price
              orderValidity: 'DAY',
              orderType: orderType,
            },
          ],
        },
      };

      orders.push(order);
    }

    return orders;
  }

  // Update sniper statistics
  private updateStats(sniperId: string, orderResult: OrderResult, status: number): void {
    const sniper = useSniperStore.getState().getSniperInstance(sniperId);
    if (!sniper) return;

    const stats = sniper.stats;

    // Update counters
    const totalOrders = stats.totalOrders + 1;
    let successfulOrders = stats.successfulOrders;
    let failedOrders = stats.failedOrders;
    let gatewayErrors = stats.gatewayErrors;

    if (status === 200) {
      successfulOrders++;
    } else if (status === 400) {
      failedOrders++;
    } else if (status === 502) {
      gatewayErrors++;
    }

    // Calculate success rate (200 + 400 = successful delivery to TMS)
    const successRate = totalOrders > 0 
      ? (successfulOrders + failedOrders) / totalOrders 
      : 0;

    // Calculate average response time
    const totalResponseTime = stats.avgResponseTime * stats.totalOrders + orderResult.responseTime;
    const avgResponseTime = totalResponseTime / totalOrders;

    // Update stats
    useSniperStore.getState().updateSniperStats(sniperId, {
      totalOrders,
      successfulOrders,
      failedOrders,
      gatewayErrors,
      successRate,
      avgResponseTime,
    });
  }
}

// Export singleton instance
export const sniperOrderExecutor = new SniperOrderExecutor();
