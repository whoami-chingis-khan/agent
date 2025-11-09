/**
 * Circuit Price Calculator for NEPSE
 * Handles circuit breaker calculations and price ladder generation for IPO listing day trading
 */

export interface CircuitLimits {
  upper: number;
  lower: number;
  range: number;
}

export interface CircuitStep {
  level: number;
  price: number;
  status: 'circuit' | 'trigger' | 'placeable' | 'current' | 'below';
  isPlaceable: boolean;
}

export interface CircuitLadder {
  steps: CircuitStep[];
  circuitPrice: number;
  triggerPrice: number;
  currentLTP: number;
  stepsToCircuit: number;
}

/**
 * Calculate upper and lower circuit limits based on previous closing price
 * NEPSE Rule: ±10% from previous close
 */
export function calculateCircuitLimits(previousClose: number): CircuitLimits {
  const range = previousClose * 0.10; // 10% range
  return {
    upper: previousClose + range,
    lower: previousClose - range,
    range,
  };
}

/**
 * Calculate all 2% intermediate steps from opening LTP to circuit price
 * Example: LTP=101, Circuit=110 → [101, 103.02, 105.08, 107.18, 109.32, 110]
 */
export function calculateCircuitLadder(
  openingLTP: number,
  circuitPrice: number,
  tickSize: number = 0.01
): CircuitStep[] {
  const steps: CircuitStep[] = [];
  let currentPrice = openingLTP;
  let level = 0;

  // Start with current LTP
  steps.push({
    level: level++,
    price: alignToTickSize(currentPrice, tickSize),
    status: 'current',
    isPlaceable: false,
  });

  // Calculate 2% increments until we reach or exceed circuit
  while (currentPrice < circuitPrice) {
    currentPrice = currentPrice * 1.02; // Add 2%

    // Don't exceed circuit price
    if (currentPrice >= circuitPrice) {
      currentPrice = circuitPrice;
    }

    steps.push({
      level: level++,
      price: alignToTickSize(currentPrice, tickSize),
      status: currentPrice >= circuitPrice ? 'circuit' : 'placeable',
      isPlaceable: true,
    });

    // Break if we've reached circuit
    if (currentPrice >= circuitPrice) {
      break;
    }
  }

  return steps;
}

/**
 * Get the trigger price (2 steps below circuit)
 * This is the LTP level where we should start placing orders
 */
export function getTriggerPrice(ladder: CircuitStep[]): number {
  if (ladder.length < 3) {
    // If ladder is too short, return the price before circuit
    return ladder[ladder.length - 2]?.price || ladder[ladder.length - 1].price;
  }

  // Get 2 steps before the circuit (which is the last step)
  return ladder[ladder.length - 3].price;
}

/**
 * Build a complete circuit ladder with status indicators
 */
export function buildCircuitLadder(
  currentLTP: number,
  previousClose: number,
  tickSize: number = 0.01
): CircuitLadder {
  const limits = calculateCircuitLimits(previousClose);
  const circuitPrice = limits.upper;

  // Calculate all steps from current LTP to circuit
  let steps = calculateCircuitLadder(currentLTP, circuitPrice, tickSize);

  // Update status based on current LTP
  const triggerPrice = getTriggerPrice(steps);

  steps = steps.map((step, index) => {
    let status: CircuitStep['status'] = 'placeable';

    if (step.price <= currentLTP) {
      status = index === 0 ? 'current' : 'below';
    } else if (step.price >= circuitPrice) {
      status = 'circuit';
    } else if (step.price >= triggerPrice && step.price < circuitPrice) {
      status = 'trigger';
    }

    return {
      ...step,
      status,
      isPlaceable: step.price > currentLTP && step.price <= circuitPrice,
    };
  });

  return {
    steps,
    circuitPrice,
    triggerPrice,
    currentLTP,
    stepsToCircuit: steps.length - 1,
  };
}

/**
 * Check if current LTP is within ±2% of target price (placeable range)
 */
export function isWithinPlaceableRange(currentLTP: number, targetPrice: number): boolean {
  const lowerBound = targetPrice * 0.98; // -2%
  const upperBound = targetPrice * 1.02; // +2%
  return currentLTP >= lowerBound && currentLTP <= upperBound;
}

/**
 * Check if LTP has reached the trigger zone (2 steps below circuit)
 */
export function isInTriggerZone(currentLTP: number, triggerPrice: number): boolean {
  return currentLTP >= triggerPrice;
}

/**
 * Align price to tick size (minimum price increment)
 * For NEPSE, we truncate (floor) to 1 decimal place - NO rounding
 * Example: price=399.74 → 399.7, price=399.79 → 399.7, price=103.025 → 103.0
 */
export function alignToTickSize(price: number, tickSize: number): number {
  // Truncate to 1 decimal place (tenths) for NEPSE - NO rounding
  return Math.floor(price * 10) / 10;
}

/**
 * Format price to 1 decimal place for NEPSE
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) {
    return '0.0';
  }
  return price.toFixed(1);
}

/**
 * Calculate percentage change between two prices
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Validate if a price is within circuit limits
 */
export function isWithinCircuitLimits(price: number, previousClose: number): {
  valid: boolean;
  breached: 'upper' | 'lower' | null;
  limits: CircuitLimits;
} {
  const limits = calculateCircuitLimits(previousClose);

  if (price > limits.upper) {
    return { valid: false, breached: 'upper', limits };
  }

  if (price < limits.lower) {
    return { valid: false, breached: 'lower', limits };
  }

  return { valid: true, breached: null, limits };
}

/**
 * Get human-readable status label for circuit step
 */
export function getStepStatusLabel(status: CircuitStep['status']): string {
  const labels: Record<CircuitStep['status'], string> = {
    circuit: 'Circuit Price',
    trigger: 'Trigger Zone',
    placeable: 'Placeable',
    current: 'Current LTP',
    below: 'Below LTP',
  };
  return labels[status];
}

/**
 * Get color code for circuit step status
 */
export function getStepStatusColor(status: CircuitStep['status']): string {
  const colors: Record<CircuitStep['status'], string> = {
    circuit: 'text-accent-red',
    trigger: 'text-yellow-500',
    placeable: 'text-dark-300',
    current: 'text-accent-green',
    below: 'text-dark-500',
  };
  return colors[status];
}

/**
 * Get emoji indicator for circuit step status
 */
export function getStepStatusEmoji(status: CircuitStep['status']): string {
  const emojis: Record<CircuitStep['status'], string> = {
    circuit: '🔴',
    trigger: '🟡',
    placeable: '⚪',
    current: '🟢',
    below: '⚫',
  };
  return emojis[status];
}
