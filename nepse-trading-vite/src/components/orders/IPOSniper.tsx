import { useState, useEffect } from 'react';
import { Zap, AlertTriangle, Info, TrendingUp, Activity, Save, BookmarkPlus, Trash2 } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useStocksStore, type SavedStock } from '../../store/stocksStore';
import splitOrderService from '../../services/splitOrderService';
import priceMonitorService, { type StockMonitorData } from '../../services/priceMonitorService';
import { formatPrice, getStepStatusEmoji, getStepStatusLabel } from '../../utils/circuitCalculator';
import type { SplitOrderConfig, SplitOrderJob } from '../../types/order';

export function IPOSniper() {
  const { isAuthenticated } = useSessionStore();
  const { savedStocks, addSavedStock, removeSavedStock } = useStocksStore();
  const [formData, setFormData] = useState({
    symbol: '',
    stockId: '',
    isin: '',
    companyName: '',
    previousClose: '',
    quantity: '',
    numOrders: '3',
    delayMs: '300',
    ucc: '',
    clientCode: '',
    targetTime: '',
  });
  const [isArmed, setIsArmed] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [monitorData, setMonitorData] = useState<StockMonitorData | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; job?: SplitOrderJob } | null>(null);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState(true);
  const [showSavedStocks, setShowSavedStocks] = useState(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      priceMonitorService.stopMonitoring();
    };
  }, [timeoutId]);

  // Auto-trigger effect - executes order when trigger zone is reached
  useEffect(() => {
    if (!autoTriggerEnabled || !isMonitoring || !monitorData) return;

    if (monitorData.isInTriggerZone && !isArmed && !isExecuting) {
      console.log('[IPO Sniper] Auto-trigger activated - LTP reached trigger zone');
      executeOrder();
    }
  }, [monitorData?.isInTriggerZone, autoTriggerEnabled, isMonitoring]);

  const startMonitoring = async () => {
    if (!formData.stockId || !formData.symbol || !formData.isin || !formData.previousClose) {
      setResult({ success: false, message: 'Please fill in all stock details' });
      return;
    }

    try {
      setIsMonitoring(true);
      setResult(null);

      await priceMonitorService.startMonitoring(
        parseInt(formData.stockId),
        formData.symbol,
        formData.isin,
        parseFloat(formData.previousClose),
        1000, // 1-second polling
        (data) => {
          setMonitorData(data);
        },
        (error) => {
          console.error('Price monitoring error:', error);
          setResult({ success: false, message: `Monitoring error: ${error.message}` });
        }
      );
    } catch (error: any) {
      setResult({ success: false, message: `Failed to start monitoring: ${error.message}` });
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = () => {
    priceMonitorService.stopMonitoring();
    setIsMonitoring(false);
    setMonitorData(null);
  };

  const executeOrder = async () => {
    setIsExecuting(true);
    try {
      // Use circuit price from ladder if available, otherwise use previous close + 10%
      const circuitPrice = monitorData?.circuitLadder.circuitPrice ||
        parseFloat(formData.previousClose) * 1.10;

      const config: SplitOrderConfig = {
        symbol: formData.symbol,
        stockId: parseInt(formData.stockId),
        isin: formData.isin,
        side: 'B',
        totalQuantity: parseInt(formData.quantity),
        numOrders: parseInt(formData.numOrders),
        limitPrice: circuitPrice,
        orderType: 'LIMIT',
        validity: 'DAY',
        delayMs: parseInt(formData.delayMs),
        validatePrice: false,
        cancelOnFirstFill: true, // Always enabled for IPO Sniper
        ucc: formData.ucc,
        clientCode: formData.clientCode,
      };

      const job = await splitOrderService.executeSplitOrder(config);

      setResult({
        success: job.successful > 0,
        message: job.successful > 0
          ? `Success! ${job.successful} order(s) placed at Rs. ${formatPrice(circuitPrice)}. ${job.skipped > 0 ? `${job.skipped} skipped after first fill.` : ''}`
          : 'All orders failed. Check the details below.',
        job,
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to execute split order',
      });
    } finally {
      setIsExecuting(false);
      setIsArmed(false);
    }
  };

  const handleArm = () => {
    if (!isAuthenticated) {
      setResult({ success: false, message: 'Please activate session first' });
      return;
    }

    // Validate inputs
    if (!formData.targetTime) {
      setResult({ success: false, message: 'Please set a target time' });
      return;
    }

    const now = new Date();
    const [hours, minutes] = formData.targetTime.split(':').map(Number);
    const targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);

    // If target time is in the past, assume it's for tomorrow
    if (targetDate < now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const msUntilTarget = targetDate.getTime() - now.getTime();

    if (msUntilTarget < 0) {
      setResult({ success: false, message: 'Target time must be in the future' });
      return;
    }

    // Arm the sniper
    setIsArmed(true);
    setResult({
      success: true,
      message: `IPO Sniper armed! Will fire at ${formData.targetTime} (${Math.round(msUntilTarget / 1000)}s from now)`,
    });

    // Set up the timer
    const timeout = setTimeout(() => {
      executeOrder();
    }, msUntilTarget);

    setTimeoutId(timeout);
  };

  const handleDisarm = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsArmed(false);
    setResult(null);
  };

  const handleFireNow = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsArmed(false);
    executeOrder();
  };

  const handleStartMonitoring = () => {
    if (!isAuthenticated) {
      setResult({ success: false, message: 'Please activate session first' });
      return;
    }
    startMonitoring();
  };

  const handleSaveStock = () => {
    if (!formData.symbol || !formData.stockId || !formData.isin) {
      setResult({ success: false, message: 'Please fill in Symbol, Stock ID, and ISIN to save' });
      return;
    }

    const savedStock: SavedStock = {
      symbol: formData.symbol.toUpperCase(),
      stockId: parseInt(formData.stockId),
      isin: formData.isin,
      companyName: formData.companyName || undefined,
    };

    addSavedStock(savedStock);
    setResult({ success: true, message: `${savedStock.symbol} saved successfully!` });
  };

  const handleLoadStock = (stock: SavedStock) => {
    setFormData({
      ...formData,
      symbol: stock.symbol,
      stockId: stock.stockId.toString(),
      isin: stock.isin,
      companyName: stock.companyName || '',
    });
    setShowSavedStocks(false);
    setResult({ success: true, message: `Loaded ${stock.symbol}` });
  };

  const handleDeleteStock = (symbol: string) => {
    removeSavedStock(symbol);
    setResult({ success: true, message: `${symbol} deleted` });
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-gr-md mb-gr-lg">
        <Zap className="w-6 h-6 text-primary-500" />
        <h2 className="text-xl font-bold">IPO Sniper</h2>
      </div>

      {/* Armed Status Banner */}
      {isArmed && (
        <div className="mb-gr-md p-gr-md bg-accent-green/10 border border-accent-green/30 rounded-lg flex items-center space-x-gr-md">
          <AlertTriangle className="w-5 h-5 text-accent-green animate-pulse" />
          <span className="text-accent-green font-semibold">ARMED - Ready to fire at target time</span>
        </div>
      )}

      {/* Cancel-on-First-Fill Info Banner */}
      <div className="mb-gr-md p-gr-md bg-primary-500/10 border border-primary-500/30 rounded-lg">
        <div className="flex items-start space-x-gr-sm">
          <Info className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-dark-300">
            <strong className="text-primary-400">Cancel-on-First-Fill Enabled:</strong> After the first successful order,
            remaining orders will be skipped automatically. NEPSE does not support API-based cancellation,
            so we prevent additional orders from being placed.
          </div>
        </div>
      </div>

      {/* Live Price Dashboard */}
      {isMonitoring && monitorData && (
        <div className="mb-gr-md space-y-gr-md">
          {/* Trigger Zone Alert */}
          {monitorData.isInTriggerZone && (
            <div className="p-gr-md bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center space-x-gr-sm">
                <AlertTriangle className="w-5 h-5 text-yellow-500 animate-pulse" />
                <div>
                  <p className="text-yellow-500 font-semibold">TRIGGER ZONE REACHED!</p>
                  <p className="text-sm text-dark-300">
                    LTP: Rs. {formatPrice(monitorData.livePrice?.ltp)} |
                    Circuit: Rs. {formatPrice(monitorData.circuitLadder?.circuitPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live Price Card */}
          <div className="bg-dark-700 p-gr-md rounded-lg">
            <div className="flex items-center justify-between mb-gr-sm">
              <div className="flex items-center space-x-gr-sm">
                <Activity className="w-4 h-4 text-accent-green animate-pulse" />
                <span className="text-sm font-semibold text-dark-200">Live Price</span>
              </div>
              <span className="text-xs text-dark-400">Updating every 1s</span>
            </div>

            <div className="grid grid-cols-4 gap-gr-md">
              <div>
                <p className="text-xs text-dark-400">LTP</p>
                <p className="text-xl font-bold text-primary-400">
                  Rs. {formatPrice(monitorData.livePrice?.ltp)}
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Change</p>
                <p className={`text-lg font-semibold ${(monitorData.livePrice?.change ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {(monitorData.livePrice?.change ?? 0) >= 0 ? '+' : ''}
                  {formatPrice(monitorData.livePrice?.change)} ({(monitorData.livePrice?.changePercent ?? 0).toFixed(2)}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Volume</p>
                <p className="text-lg font-semibold text-dark-200">
                  {(monitorData.livePrice?.volume ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Trades</p>
                <p className="text-lg font-semibold text-dark-200">
                  {monitorData.livePrice?.totalTrade ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-gr-md pt-gr-md border-t border-dark-600 grid grid-cols-4 gap-gr-sm text-xs">
              <div>
                <span className="text-dark-400">Open:</span>
                <span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.open)}</span>
              </div>
              <div>
                <span className="text-dark-400">High:</span>
                <span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.high)}</span>
              </div>
              <div>
                <span className="text-dark-400">Low:</span>
                <span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.low)}</span>
              </div>
              <div>
                <span className="text-dark-400">Prev Close:</span>
                <span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.close)}</span>
              </div>
            </div>
          </div>

          {/* Circuit Ladder */}
          <div className="bg-dark-700 p-gr-md rounded-lg">
            <div className="flex items-center justify-between mb-gr-md">
              <div className="flex items-center space-x-gr-sm">
                <TrendingUp className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-semibold text-dark-200">Circuit Ladder</span>
              </div>
              <div className="text-xs text-dark-400">
                Trigger: Rs. {formatPrice(monitorData.circuitLadder?.triggerPrice)}
              </div>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {monitorData.circuitLadder?.steps?.slice().reverse().map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded ${
                    step.status === 'current' ? 'bg-accent-green/20 border border-accent-green/30' :
                    step.status === 'circuit' ? 'bg-accent-red/20 border border-accent-red/30' :
                    step.status === 'trigger' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                    'bg-dark-600'
                  }`}
                >
                  <div className="flex items-center space-x-gr-sm">
                    <span className="text-sm">{getStepStatusEmoji(step.status)}</span>
                    <span className="text-xs text-dark-300">{getStepStatusLabel(step.status)}</span>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${
                    step.status === 'current' ? 'text-accent-green' :
                    step.status === 'circuit' ? 'text-accent-red' :
                    step.status === 'trigger' ? 'text-yellow-500' :
                    'text-dark-200'
                  }`}>
                    Rs. {formatPrice(step.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-gr-md">
        {/* Stock Configuration */}
        <div className="bg-dark-700 p-gr-md rounded-lg">
          <div className="flex items-center justify-between mb-gr-md">
            <h3 className="text-sm font-semibold text-dark-200">Stock Details</h3>
            <div className="flex space-x-gr-sm">
              <button
                onClick={handleSaveStock}
                disabled={isMonitoring || isArmed || isExecuting}
                className="btn btn-primary btn-sm flex items-center space-x-1"
                title="Save stock for later use"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setShowSavedStocks(!showSavedStocks)}
                className="btn btn-primary btn-sm flex items-center space-x-1"
                title="Load saved stock"
              >
                <BookmarkPlus className="w-3 h-3" />
                <span>Load ({savedStocks.length})</span>
              </button>
            </div>
          </div>

          {/* Saved Stocks Dropdown */}
          {showSavedStocks && savedStocks.length > 0 && (
            <div className="mb-gr-md p-gr-md bg-dark-600 rounded-lg max-h-48 overflow-y-auto">
              <p className="text-xs text-dark-400 mb-gr-sm">Saved Stocks:</p>
              <div className="space-y-1">
                {savedStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between p-2 bg-dark-700 rounded hover:bg-dark-600 transition-colors"
                  >
                    <button
                      onClick={() => handleLoadStock(stock)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center space-x-gr-md">
                        <span className="font-mono font-semibold text-primary-400">{stock.symbol}</span>
                        <span className="text-xs text-dark-400">ID: {stock.stockId}</span>
                        {stock.companyName && (
                          <span className="text-xs text-dark-400 truncate">{stock.companyName}</span>
                        )}
                      </div>
                      <div className="text-xs text-dark-500 font-mono">{stock.isin}</div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStock(stock.symbol);
                      }}
                      className="ml-gr-sm p-1 text-accent-red hover:bg-accent-red/10 rounded"
                      title="Delete stock"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSavedStocks && savedStocks.length === 0 && (
            <div className="mb-gr-md p-gr-md bg-dark-600 rounded-lg text-center">
              <p className="text-xs text-dark-400">No saved stocks yet. Fill in the details below and click Save.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-gr-md">
            <div>
              <label className="label">Symbol</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                className="input"
                disabled={isMonitoring || isArmed || isExecuting}
                placeholder="e.g., NLO"
              />
            </div>
            <div>
              <label className="label">Stock ID</label>
              <input
                type="text"
                value={formData.stockId}
                onChange={(e) => setFormData({ ...formData, stockId: e.target.value })}
                className="input"
                disabled={isMonitoring || isArmed || isExecuting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-gr-md">
            <div>
              <label className="label">ISIN</label>
              <input
                type="text"
                value={formData.isin}
                onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
                className="input"
                disabled={isMonitoring || isArmed || isExecuting}
              />
            </div>
            <div>
              <label className="label">Company Name (Optional)</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="input"
                disabled={isMonitoring || isArmed || isExecuting}
                placeholder="e.g., Nepal Lube Oil Ltd"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Previous Day Closing Price</label>
          <input
            type="number"
            step="0.01"
            value={formData.previousClose}
            onChange={(e) => setFormData({ ...formData, previousClose: e.target.value })}
            className="input"
            disabled={isMonitoring || isArmed || isExecuting}
            placeholder="e.g., 100.00 (Circuit will be calculated as 110.00)"
          />
        </div>

        <div className="grid grid-cols-3 gap-gr-md">
          <div>
            <label className="label">Total Quantity</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input"
              disabled={isArmed || isExecuting}
            />
          </div>
          <div>
            <label className="label">Split into # Orders</label>
            <input
              type="number"
              value={formData.numOrders}
              onChange={(e) => setFormData({ ...formData, numOrders: e.target.value })}
              className="input"
              disabled={isArmed || isExecuting}
              min="1"
              max="10"
            />
          </div>
          <div>
            <label className="label">Delay (ms)</label>
            <input
              type="number"
              value={formData.delayMs}
              onChange={(e) => setFormData({ ...formData, delayMs: e.target.value })}
              className="input"
              disabled={isArmed || isExecuting}
              placeholder="300"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-gr-md">
          <div>
            <label className="label">UCC</label>
            <input
              type="text"
              value={formData.ucc}
              onChange={(e) => setFormData({ ...formData, ucc: e.target.value })}
              className="input"
              disabled={isArmed || isExecuting}
            />
          </div>
          <div>
            <label className="label">Client Code</label>
            <input
              type="text"
              value={formData.clientCode}
              onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
              className="input"
              disabled={isArmed || isExecuting}
            />
          </div>
        </div>

        <div>
          <label className="label">Target Time (24h format)</label>
          <input
            type="time"
            value={formData.targetTime}
            onChange={(e) => setFormData({ ...formData, targetTime: e.target.value })}
            className="input"
            disabled={isArmed || isExecuting}
          />
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`p-gr-md rounded-lg ${
              result.success
                ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
                : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
            }`}
          >
            <p className="font-semibold mb-2">{result.message}</p>
            {result.job && (
              <div className="mt-2 space-y-1 text-xs">
                <p>Job ID: {result.job.jobId}</p>
                <p>Status: {result.job.status}</p>
                <p>
                  Success: {result.job.successful} | Failed: {result.job.failed} | Skipped: {result.job.skipped}
                </p>
                {result.job.duration && <p>Duration: {result.job.duration}ms</p>}
              </div>
            )}
          </div>
        )}

        {/* Auto-Trigger Toggle */}
        <div className="flex items-center justify-between p-gr-md bg-dark-700 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-dark-200">Auto-Trigger</p>
            <p className="text-xs text-dark-400">
              Automatically fire when LTP reaches trigger zone
            </p>
          </div>
          <button
            onClick={() => setAutoTriggerEnabled(!autoTriggerEnabled)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoTriggerEnabled
                ? 'bg-accent-green text-white'
                : 'bg-dark-600 text-dark-300'
            }`}
          >
            {autoTriggerEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-gr-sm">
          {/* Monitoring Control */}
          {!isMonitoring ? (
            <button
              onClick={handleStartMonitoring}
              disabled={!isAuthenticated || isExecuting}
              className="btn btn-primary w-full flex items-center justify-center space-x-2"
            >
              <Activity className="w-4 h-4" />
              <span>Start Live Monitoring</span>
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              disabled={isExecuting}
              className="btn btn-danger w-full"
            >
              Stop Monitoring
            </button>
          )}

          {/* Execution Controls */}
          <div className="flex space-x-gr-md">
            {!isArmed && !isExecuting && isMonitoring ? (
              <>
                <button
                  onClick={handleArm}
                  disabled={!isAuthenticated}
                  className="btn btn-success flex-1 flex items-center justify-center space-x-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Arm Sniper</span>
                </button>
                <button
                  onClick={handleFireNow}
                  disabled={!isAuthenticated}
                  className="btn btn-success flex-1"
                >
                  Fire Now
                </button>
              </>
            ) : isArmed ? (
              <button onClick={handleDisarm} className="btn btn-danger w-full">
                Disarm
              </button>
            ) : isExecuting ? (
              <button disabled className="btn btn-primary w-full">
                Executing...
              </button>
            ) : null}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-dark-700 p-gr-md rounded-lg space-y-gr-sm">
          <p className="text-dark-200 text-sm font-semibold">How IPO Sniper Works:</p>
          <ol className="text-dark-300 text-xs space-y-1 list-decimal list-inside">
            <li>Enter stock details and previous day's closing price</li>
            <li>Click "Start Live Monitoring" to track live price and circuit ladder</li>
            <li>System calculates all 2% steps from LTP to 10% circuit price</li>
            <li>Trigger zone is 2 steps below circuit price</li>
            <li>With Auto-Trigger ON: Orders fire automatically when LTP reaches trigger zone</li>
            <li>With Auto-Trigger OFF: Use "Arm Sniper" for timed execution or "Fire Now" for immediate</li>
            <li>Orders are placed at circuit price with cancel-on-first-fill enabled</li>
          </ol>
          <div className="pt-gr-sm border-t border-dark-600">
            <p className="text-yellow-500 text-xs">
              <strong>Note:</strong> NEPSE does not support API cancellation. This system prevents placing additional
              orders after the first success, but cannot cancel orders already accepted by the exchange.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
