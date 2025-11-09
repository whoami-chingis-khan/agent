import { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, AlertTriangle, Info, TrendingUp, Activity, Save, BookmarkPlus, Trash2, Monitor, Edit3, Target } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useStocksStore, type SavedStock } from '../../store/stocksStore';
import tmsApi from '../../services/tmsApi';
import priceMonitorService, { type StockMonitorData } from '../../services/priceMonitorService';
import { formatPrice, getStepStatusEmoji, getStepStatusLabel, buildCircuitLadder, getStepStatusColor, type CircuitLadder } from '../../utils/circuitCalculator';

export function IPOSniper() {
  const { isAuthenticated } = useSessionStore();
  const { savedStocks, addSavedStock, removeSavedStock } = useStocksStore();
  const [formData, setFormData] = useState({
    symbol: '',
    stockId: '',
    isin: '',
    companyName: '',
    previousClose: '',
    openingLtp: '',
    quantity: '100',
  });
  const [clientInfo, setClientInfo] = useState<{ ucc: string; clientCode: number } | null>(null);
  const [isContinuousFiring, setIsContinuousFiring] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSavedStocks, setShowSavedStocks] = useState(false);
  const orderCountRef = useRef(0);
  const firingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasFilledRef = useRef(false);

  const [autoPriceMonitoring, setAutoPriceMonitoring] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorData, setMonitorData] = useState<StockMonitorData | null>(null);

  const manualLadder: CircuitLadder | null = useMemo(() => {
    if (!formData.openingLtp || !formData.previousClose) return null;
    const openingLtp = parseFloat(formData.openingLtp);
    const previousClose = parseFloat(formData.previousClose);
    if (isNaN(openingLtp) || isNaN(previousClose)) return null;
    return buildCircuitLadder(openingLtp, previousClose, 0.01);
  }, [formData.openingLtp, formData.previousClose]);

  // Auto-fetch client info when authenticated
  useEffect(() => {
    if (isAuthenticated && !clientInfo) {
      fetchClientInfo();
    }
  }, [isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (firingIntervalRef.current) clearInterval(firingIntervalRef.current);
      if (isMonitoring) priceMonitorService.stopMonitoring();
    };
  }, [isMonitoring]);

  // Auto-stop monitoring when toggle is turned off
  useEffect(() => {
    if (!autoPriceMonitoring && isMonitoring) stopMonitoring();
  }, [autoPriceMonitoring]);

  // Continuous firing when in trigger zone
  useEffect(() => {
    if (isContinuousFiring && monitorData?.isInTriggerZone && !firingIntervalRef.current && !hasFilledRef.current) {
      console.log('[IPO Sniper] In trigger zone - Starting continuous firing');
      startContinuousFiring();
    } else if (isContinuousFiring && !monitorData?.isInTriggerZone && firingIntervalRef.current) {
      console.log('[IPO Sniper] Left trigger zone - Pausing firing');
      pauseContinuousFiring();
    }
  }, [isContinuousFiring, monitorData?.isInTriggerZone]);

  const fetchClientInfo = async () => {
    try {
      const clientData = await tmsApi.getMyClientDetails();
      setClientInfo({ ucc: clientData.ucc, clientCode: clientData.clientCode });
      setResult({ success: true, message: `Client loaded: ${clientData.clientName} (UCC: ${clientData.ucc})` });
    } catch (error: any) {
      console.error('[IPO Sniper] Failed to fetch client info:', error);
      setResult({ success: false, message: `Failed to fetch client info: ${error.message}` });
    }
  };

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
        1000,
        (data) => setMonitorData(data),
        (error) => {
          console.error('[IPO Sniper] Price monitoring error:', error);
          if (!error.message?.includes('401')) {
            setResult({ success: false, message: `Monitoring error: ${error.message}` });
          }
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

  const fireSingleOrder = async () => {
    if (!clientInfo) {
      console.error('[IPO Sniper] No client info available');
      return false;
    }

    // If already filled, stop firing
    if (hasFilledRef.current) {
      console.log('[IPO Sniper] Order already filled, stopping continuous fire');
      stopContinuousFiring();
      return false;
    }

    try {
      const circuitPrice = parseFloat(formData.previousClose) * 1.10;
      const orderPayload = {
        orderBook: {
          orderBookExtensions: [{
            orderTypes: { id: 1, orderTypeCode: "LMT" },
            disclosedQuantity: 0,
            orderValidity: { id: 1, orderValidityCode: "DAY" },
            triggerPrice: 0,
            orderPrice: circuitPrice,
            orderQuantity: parseInt(formData.quantity),
            remainingOrderQuantity: parseInt(formData.quantity),
            marketType: { id: 2, marketType: "Continuous" }
          }],
          exchange: { id: 1 },
          dnaConnection: {},
          dealer: {},
          member: {},
          productType: { id: 1, productCode: "CNC" },
          instrumentType: { id: 1, code: "EQ" },
          client: {
            activeStatus: "A",
            id: clientInfo.clientCode,
            accountType: "CLI",
            allowedToTrade: "Y",
            clientMemberCode: "PG",
            clientOrDealer: "C",
            contactNumber: "",
            emailId: null,
            notsUniqueClientCode: clientInfo.ucc,
            clientDealerType: null,
            clientGroup: { activeStatus: "A", id: 101, clientGroupCode: null, clientGroupName: null },
            memberBranch: { activeStatus: "A", id: 1, branchLocation: null, branchName: null, hidden: null, branchProvince: null, branchDistrict: null, branchMunicipality: null, branchHead: null, branchPhoneNumber: null },
            displayName: "",
            blockedDate: null,
            remarks: null,
            parentId: null,
            recordType: null,
            collateralByEntities: null,
            shortSellMode: 0,
            onlineOrOffline: 1,
            panNumber: null,
            onlineFundTransfer: null,
            collateralCalculationMode: 1,
            isMarginLendingClient: null,
            clientRiskType: null,
            userAgreementChecked: null,
            referredBy: null,
            responseStatus: null,
            isCkycAccount: null,
            kycUpload: false,
            marginLendingClient: null
          },
          security: {
            id: parseInt(formData.stockId),
            exchangeSecurityId: parseInt(formData.stockId),
            marketProtectionPercentage: 0,
            divisor: 100,
            boardLotQuantity: 1,
            tickSize: 0.1
          },
          accountType: 1,
          cpMemberId: 0,
          buyOrSell: 1
        },
        orderPlacedBy: 2,
        exchangeOrderId: null
      };

      console.log('[IPO Sniper] Firing order #' + (orderCountRef.current + 1));
      const response = await tmsApi.placeOrder(orderPayload);
      orderCountRef.current++;
      hasFilledRef.current = true;
      console.log('[IPO Sniper] Order placed successfully:', response);
      setResult({ success: true, message: `Order #${orderCountRef.current} FILLED at Rs. ${formatPrice(circuitPrice)}! ${isContinuousFiring ? 'Stopping continuous fire.' : ''}` });

      // Stop continuous firing after first success
      if (isContinuousFiring) {
        stopContinuousFiring();
      }
      return true;
    } catch (error: any) {
      console.error('[IPO Sniper] Order failed:', error);
      orderCountRef.current++;
      setResult({ success: false, message: `Order #${orderCountRef.current} failed: ${error.response?.data?.message || error.message}` });
      return false;
    }
  };

  const startContinuousFiring = () => {
    if (firingIntervalRef.current) return;
    fireSingleOrder();
    // Fire every 60ms to match API response time
    firingIntervalRef.current = setInterval(() => { fireSingleOrder(); }, 60);
  };

  const pauseContinuousFiring = () => {
    if (firingIntervalRef.current) {
      clearInterval(firingIntervalRef.current);
      firingIntervalRef.current = null;
    }
  };

  const stopContinuousFiring = () => {
    pauseContinuousFiring();
    setIsContinuousFiring(false);
    setResult({ success: true, message: `Continuous fire stopped. Total orders attempted: ${orderCountRef.current}${hasFilledRef.current ? ' (1 filled)' : ''}` });
  };

  const handleContinuousFire = () => {
    if (!isAuthenticated) {
      setResult({ success: false, message: 'Please activate session first' });
      return;
    }
    if (!clientInfo) {
      setResult({ success: false, message: 'Client info not loaded' });
      return;
    }
    if (!isMonitoring) {
      setResult({ success: false, message: 'Please start monitoring first' });
      return;
    }
    setIsContinuousFiring(true);
    orderCountRef.current = 0;
    hasFilledRef.current = false;
    setResult({ success: true, message: 'Continuous fire enabled! Will fire orders at 60ms interval when in trigger zone until first order fills.' });
  };

  const handleStopContinuousFire = () => {
    stopContinuousFiring();
  };

  const handleFireNow = async () => {
    if (!isAuthenticated) {
      setResult({ success: false, message: 'Please activate session first' });
      return;
    }
    if (!clientInfo) {
      setResult({ success: false, message: 'Client info not loaded' });
      return;
    }
    orderCountRef.current = 0;
    hasFilledRef.current = false;
    await fireSingleOrder();
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
    setFormData({ ...formData, symbol: stock.symbol, stockId: stock.stockId.toString(), isin: stock.isin, companyName: stock.companyName || '' });
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

      {isContinuousFiring && (
        <div className="mb-gr-md p-gr-md bg-accent-green/10 border border-accent-green/30 rounded-lg">
          <div className="flex items-center space-x-gr-md">
            <AlertTriangle className="w-5 h-5 text-accent-green animate-pulse" />
            <div className="flex-1">
              <span className="text-accent-green font-semibold block">
                {firingIntervalRef.current ? 'CONTINUOUS FIRE - ACTIVE! (60ms interval)' : 'CONTINUOUS FIRE - Waiting for trigger zone...'}
              </span>
              <span className="text-xs text-dark-300">Orders attempted: {orderCountRef.current}</span>
            </div>
          </div>
        </div>
      )}

      {clientInfo && (
        <div className="mb-gr-md p-gr-md bg-primary-500/10 border border-primary-500/30 rounded-lg">
          <div className="flex items-start space-x-gr-sm">
            <Info className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-dark-300">
              <strong className="text-primary-400">Client Info (Auto-loaded):</strong> UCC: {clientInfo.ucc}, Client Code: {clientInfo.clientCode}
            </div>
          </div>
        </div>
      )}

      {isMonitoring && monitorData && (
        <div className="mb-gr-md space-y-gr-md">
          {monitorData.isInTriggerZone && (
            <div className="p-gr-md bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center space-x-gr-sm">
                <AlertTriangle className="w-5 h-5 text-yellow-500 animate-pulse" />
                <div>
                  <p className="text-yellow-500 font-semibold">TRIGGER ZONE REACHED!</p>
                  <p className="text-sm text-dark-300">
                    LTP: Rs. {formatPrice(monitorData.livePrice?.ltp)} | Circuit: Rs. {formatPrice(monitorData.circuitLadder?.circuitPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                <p className="text-xl font-bold text-primary-400">Rs. {formatPrice(monitorData.livePrice?.ltp)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Change</p>
                <p className={`text-lg font-semibold ${(monitorData.livePrice?.change ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {(monitorData.livePrice?.change ?? 0) >= 0 ? '+' : ''}{formatPrice(monitorData.livePrice?.change)} ({(monitorData.livePrice?.changePercent ?? 0).toFixed(2)}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Volume</p>
                <p className="text-lg font-semibold text-dark-200">{(monitorData.livePrice?.volume ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Trades</p>
                <p className="text-lg font-semibold text-dark-200">{monitorData.livePrice?.totalTrade ?? 0}</p>
              </div>
            </div>
            <div className="mt-gr-md pt-gr-md border-t border-dark-600 grid grid-cols-4 gap-gr-sm text-xs">
              <div><span className="text-dark-400">Open:</span><span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.open)}</span></div>
              <div><span className="text-dark-400">High:</span><span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.high)}</span></div>
              <div><span className="text-dark-400">Low:</span><span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.low)}</span></div>
              <div><span className="text-dark-400">Prev Close:</span><span className="ml-1 text-dark-200">{formatPrice(monitorData.livePrice?.close)}</span></div>
            </div>
          </div>

          <div className="bg-dark-700 p-gr-md rounded-lg">
            <div className="flex items-center justify-between mb-gr-md">
              <div className="flex items-center space-x-gr-sm">
                <TrendingUp className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-semibold text-dark-200">Circuit Ladder</span>
              </div>
              <div className="text-xs text-dark-400">Trigger: Rs. {formatPrice(monitorData.circuitLadder?.triggerPrice)}</div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {monitorData.circuitLadder?.steps?.slice().reverse().map((step, index) => (
                <div key={index} className={`flex items-center justify-between p-2 rounded ${step.status === 'current' ? 'bg-accent-green/20 border border-accent-green/30' : step.status === 'circuit' ? 'bg-accent-red/20 border border-accent-red/30' : step.status === 'trigger' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-dark-600'}`}>
                  <div className="flex items-center space-x-gr-sm">
                    <span className="text-sm">{getStepStatusEmoji(step.status)}</span>
                    <span className="text-xs text-dark-300">{getStepStatusLabel(step.status)}</span>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${step.status === 'current' ? 'text-accent-green' : step.status === 'circuit' ? 'text-accent-red' : step.status === 'trigger' ? 'text-yellow-500' : 'text-dark-200'}`}>
                    Rs. {formatPrice(step.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-gr-md">
        <div className="bg-dark-700 p-gr-md rounded-lg">
          <div className="flex items-center justify-between mb-gr-md">
            <h3 className="text-sm font-semibold text-dark-200">Stock Details</h3>
            <div className="flex space-x-gr-sm">
              <button onClick={handleSaveStock} disabled={isMonitoring || isContinuousFiring} className="btn btn-primary btn-sm flex items-center space-x-1" title="Save stock for later use">
                <Save className="w-3 h-3" /><span>Save</span>
              </button>
              <button onClick={() => setShowSavedStocks(!showSavedStocks)} className="btn btn-primary btn-sm flex items-center space-x-1" title="Load saved stock">
                <BookmarkPlus className="w-3 h-3" /><span>Load ({savedStocks.length})</span>
              </button>
            </div>
          </div>

          {showSavedStocks && savedStocks.length > 0 && (
            <div className="mb-gr-md p-gr-md bg-dark-600 rounded-lg max-h-48 overflow-y-auto">
              <p className="text-xs text-dark-400 mb-gr-sm">Saved Stocks:</p>
              <div className="space-y-1">
                {savedStocks.map((stock) => (
                  <div key={stock.symbol} className="flex items-center justify-between p-2 bg-dark-700 rounded hover:bg-dark-600 transition-colors">
                    <button onClick={() => handleLoadStock(stock)} className="flex-1 text-left">
                      <div className="flex items-center space-x-gr-md">
                        <span className="font-mono font-semibold text-primary-400">{stock.symbol}</span>
                        <span className="text-xs text-dark-400">ID: {stock.stockId}</span>
                        {stock.companyName && <span className="text-xs text-dark-400 truncate">{stock.companyName}</span>}
                      </div>
                      <div className="text-xs text-dark-500 font-mono">{stock.isin}</div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteStock(stock.symbol); }} className="ml-gr-sm p-1 text-accent-red hover:bg-accent-red/10 rounded" title="Delete stock">
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
              <input type="text" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })} className="input" disabled={isMonitoring || isContinuousFiring} placeholder="e.g., NLO" />
            </div>
            <div>
              <label className="label">Stock ID</label>
              <input type="text" value={formData.stockId} onChange={(e) => setFormData({ ...formData, stockId: e.target.value })} className="input" disabled={isMonitoring || isContinuousFiring} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-gr-md">
            <div>
              <label className="label">ISIN</label>
              <input type="text" value={formData.isin} onChange={(e) => setFormData({ ...formData, isin: e.target.value })} className="input" disabled={isMonitoring || isContinuousFiring} />
            </div>
            <div>
              <label className="label">Company Name (Optional)</label>
              <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="input" disabled={isMonitoring || isContinuousFiring} placeholder="e.g., Nepal Lube Oil Ltd" />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Previous Day Closing Price</label>
          <input type="number" step="0.01" value={formData.previousClose} onChange={(e) => setFormData({ ...formData, previousClose: e.target.value })} className="input" disabled={isMonitoring || isContinuousFiring} placeholder="e.g., 100.00 (Circuit will be calculated as 110.00)" />
        </div>

        <div>
          <label className="label">Quantity per Order</label>
          <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="input" disabled={isContinuousFiring} placeholder="100" />
        </div>

        <div className="bg-dark-700 p-gr-md rounded-lg">
          <div className="flex items-center justify-between mb-gr-md">
            <div className="flex items-center space-x-2">
              <Monitor className="w-4 h-4 text-primary-400" />
              <h3 className="text-sm font-semibold text-dark-200">Price Monitoring</h3>
            </div>
            <button onClick={() => { setAutoPriceMonitoring(!autoPriceMonitoring); if (autoPriceMonitoring) stopMonitoring(); }} disabled={isContinuousFiring} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${autoPriceMonitoring ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30' : 'bg-dark-600 text-dark-400 hover:bg-dark-500'}`}>
              <Activity className="w-3 h-3" />
              <span>{autoPriceMonitoring ? 'Auto' : 'Manual'}</span>
            </button>
          </div>

          {!autoPriceMonitoring && (
            <div>
              <label className="label">Opening LTP (Manual Entry)</label>
              <input type="number" step="0.01" value={formData.openingLtp} onChange={(e) => setFormData({ ...formData, openingLtp: e.target.value })} className="input" disabled={isContinuousFiring} placeholder="e.g., 101.00 (Enter market opening price)" />
              <p className="text-xs text-dark-400 mt-1"><Edit3 className="w-3 h-3 inline mr-1" />Enter the opening LTP to calculate circuit ladder manually</p>
            </div>
          )}

          {autoPriceMonitoring && (
            <div className="space-y-gr-sm">
              <p className="text-xs text-dark-400"><Info className="w-3 h-3 inline mr-1" />Automatic monitoring will fetch live prices every second. Requires valid stock details.</p>
              {!isMonitoring && <button onClick={handleStartMonitoring} disabled={!formData.stockId || !formData.symbol || !formData.isin || !formData.previousClose || isContinuousFiring} className="btn btn-primary btn-sm w-full">Start Monitoring</button>}
              {isMonitoring && <button onClick={stopMonitoring} disabled={isContinuousFiring} className="btn btn-danger btn-sm w-full">Stop Monitoring</button>}
            </div>
          )}
        </div>

        {!autoPriceMonitoring && manualLadder && (
          <div className="bg-dark-700 p-gr-md rounded-lg">
            <div className="flex items-center justify-between mb-gr-md">
              <div className="flex items-center space-x-gr-sm">
                <TrendingUp className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-semibold text-dark-200">Circuit Ladder (Manual)</span>
              </div>
              <div className="text-xs space-x-2">
                <span className="text-dark-400">Trigger:</span>
                <span className="text-yellow-500 font-mono font-semibold">Rs. {formatPrice(manualLadder.triggerPrice)}</span>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {manualLadder.steps.slice().reverse().map((step, index) => (
                <div key={index} className={`flex items-center justify-between p-2 rounded transition-colors ${step.status === 'current' ? 'bg-accent-green/20 border border-accent-green/30' : step.status === 'circuit' ? 'bg-accent-red/20 border border-accent-red/30' : step.status === 'trigger' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-dark-600'}`}>
                  <div className="flex items-center space-x-gr-sm">
                    <span className="text-sm">{getStepStatusEmoji(step.status)}</span>
                    <span className="text-xs text-dark-300">{getStepStatusLabel(step.status)}</span>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${getStepStatusColor(step.status)}`}>Rs. {formatPrice(step.price)}</span>
                </div>
              ))}
            </div>
            <div className="mt-gr-md pt-gr-md border-t border-dark-600 text-xs text-dark-400">
              <p><span className="font-semibold text-yellow-500">Trigger Zone:</span> Fire the sniper when LTP reaches Rs. {formatPrice(manualLadder.triggerPrice)}</p>
              <p className="mt-1"><span className="font-semibold text-accent-red">Circuit Price:</span> Rs. {formatPrice(manualLadder.circuitPrice)} (+10% from previous close)</p>
            </div>
          </div>
        )}

        {result && (
          <div className={`p-gr-md rounded-lg ${result.success ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green' : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'}`}>
            <p className="font-semibold">{result.message}</p>
          </div>
        )}

        <div className="space-y-gr-sm">
          {!isMonitoring ? (
            <button onClick={handleStartMonitoring} disabled={!isAuthenticated} className="btn btn-primary w-full flex items-center justify-center space-x-2">
              <Activity className="w-4 h-4" /><span>Start Live Monitoring</span>
            </button>
          ) : (
            <button onClick={stopMonitoring} disabled={isContinuousFiring} className="btn btn-danger w-full">Stop Monitoring</button>
          )}

          <div className="flex space-x-gr-md">
            {!isContinuousFiring && isMonitoring ? (
              <>
                <button onClick={handleContinuousFire} disabled={!isAuthenticated || !clientInfo} className="btn btn-success flex-1 flex items-center justify-center space-x-2">
                  <Zap className="w-4 h-4" /><span>Continuous Fire</span>
                </button>
                <button onClick={handleFireNow} disabled={!isAuthenticated || !clientInfo} className="btn btn-success flex-1 flex items-center justify-center space-x-2">
                  <Target className="w-4 h-4" /><span>Fire Now</span>
                </button>
              </>
            ) : isContinuousFiring ? (
              <button onClick={handleStopContinuousFire} className="btn btn-danger w-full">Stop Continuous Fire</button>
            ) : null}
          </div>
        </div>

        <div className="bg-dark-700 p-gr-md rounded-lg space-y-gr-sm">
          <p className="text-dark-200 text-sm font-semibold">How IPO Sniper Works:</p>
          <ol className="text-dark-300 text-xs space-y-1 list-decimal list-inside">
            <li>UCC and Client Code are automatically fetched when you activate session</li>
            <li>Enter stock details and previous day's closing price</li>
            <li>Click "Start Live Monitoring" to track live price and circuit ladder</li>
            <li>System calculates all 2% steps from LTP to 10% circuit price</li>
            <li>Trigger zone is 2 steps below circuit price</li>
            <li>"Continuous Fire" fires orders at 60ms interval when in trigger zone, stops after first fill</li>
            <li>"Fire Now" fires a single order immediately at circuit price</li>
            <li>All orders are LIMIT orders placed at circuit price (previous close + 10%)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
