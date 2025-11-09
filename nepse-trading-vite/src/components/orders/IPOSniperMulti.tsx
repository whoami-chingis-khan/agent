import { useState } from 'react';
import { useClientStore } from '../../store/clientStore';
import { useSniperStore } from '../../store/sniperStore';
import { multiStockMonitor } from '../../services/multiStockMonitor';
import { sniperOrderExecutor } from '../../services/sniperOrderExecutor';
import type { SniperConfig } from '../../types/sniper';

export const IPOSniperMulti = () => {
  const activeClient = useClientStore(state => state.getActiveClient());
  const snipers = useSniperStore(state => 
    activeClient ? state.getSnipersByClient(activeClient.id) : []
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!activeClient) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 mb-4">
          Please select a client from the Client Manager first
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            IPO Sniper - {activeClient.name}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Monitor and snipe multiple stocks simultaneously
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded font-medium transition-colors"
          style={{ backgroundColor: '#D4AF37', color: '#0A0A0A' }}
        >
          ➕ Add Stock to Monitor
        </button>
      </div>

      {/* Active Snipers Grid */}
      {snipers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-4">No active snipers for this client</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded font-medium"
            style={{ backgroundColor: '#D4AF37', color: '#0A0A0A' }}
          >
            Create Your First Sniper
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {snipers.map(sniper => (
            <SniperCard key={sniper.id} sniperId={sniper.id} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateSniperModal
          clientId={activeClient.id}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

const SniperCard = ({ sniperId }: { sniperId: string }) => {
  const sniper = useSniperStore(state => state.getSniperInstance(sniperId));
  const stopSniper = useSniperStore(state => state.stopSniper);
  const removeSniper = useSniperStore(state => state.removeSniper);

  if (!sniper) return null;

  const handleStop = () => {
    multiStockMonitor.stopMonitoring(sniperId);
    stopSniper(sniperId);
  };

  const handleRemove = () => {
    if (confirm('Remove this sniper?')) {
      multiStockMonitor.stopMonitoring(sniperId);
      removeSniper(sniperId);
    }
  };

  // Execute if triggered
  if (sniper.status === 'triggered') {
    sniperOrderExecutor.executeSniperOrders(sniperId);
  }

  const getStatusColor = () => {
    switch (sniper.status) {
      case 'monitoring': return 'text-blue-400';
      case 'triggered': return 'text-yellow-400';
      case 'executing': return 'text-orange-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-[#D4AF37] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold" style={{ color: '#D4AF37' }}>
            {sniper.symbol}
          </h3>
          <span className={`text-sm font-medium capitalize ${getStatusColor()}`}>
            {sniper.status}
          </span>
        </div>
        <div className={`w-3 h-3 rounded-full ${sniper.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Live Price:</span>
          <span className="font-medium text-white">
            {sniper.currentPrice ? `Rs. ${sniper.currentPrice.toFixed(2)}` : '-'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Zone:</span>
          <span className={`font-medium ${
            sniper.currentZone !== null 
              ? sniper.currentZone >= 3 ? 'text-red-400' 
                : sniper.currentZone <= -3 ? 'text-green-400' 
                : 'text-gray-300'
              : 'text-gray-600'
          }`}>
            {sniper.currentZone !== null ? `Zone ${sniper.currentZone}` : '-'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Target:</span>
          <span className="font-medium text-white">
            Zone {sniper.config.targetZone}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Quantity:</span>
          <span className="font-medium text-white">
            {sniper.config.totalQuantity} ({sniper.config.numOrders} orders)
          </span>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
        <div>
          <div className="text-gray-400">Total</div>
          <div className="font-bold text-white">{sniper.stats.totalOrders}</div>
        </div>
        <div>
          <div className="text-green-400">200</div>
          <div className="font-bold text-green-400">{sniper.stats.successfulOrders}</div>
        </div>
        <div>
          <div className="text-yellow-400">400</div>
          <div className="font-bold text-yellow-400">{sniper.stats.failedOrders}</div>
        </div>
        <div>
          <div className="text-red-400">502</div>
          <div className="font-bold text-red-400">{sniper.stats.gatewayErrors}</div>
        </div>
      </div>

      {/* Progress Bar */}
      {sniper.stats.totalOrders > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Success Rate</span>
            <span className={sniper.stats.successRate >= 0.9 ? 'text-green-400' : 'text-yellow-400'}>
              {(sniper.stats.successRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
              style={{ width: `${sniper.stats.successRate * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Delay Info */}
      {sniper.stats.totalOrders > 0 && (
        <div className="text-xs text-center mb-4 py-2 bg-gray-900/50 rounded">
          {sniper.stats.isDelayLocked ? (
            <span className="text-green-400">🔒 Locked at {sniper.stats.optimalDelay}ms</span>
          ) : (
            <span className="text-yellow-400">⚙️ Calibrating: {sniper.stats.currentDelay}ms</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {sniper.isActive && (
          <button
            onClick={handleStop}
            className="flex-1 px-3 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        )}
        {!sniper.isActive && sniper.status !== 'executing' && (
          <button
            onClick={handleRemove}
            className="flex-1 px-3 py-2 rounded text-sm font-medium bg-gray-600 hover:bg-gray-700 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

const CreateSniperModal = ({ clientId, onClose }: { clientId: string; onClose: () => void }) => {
  const createSniper = useSniperStore(state => state.createSniper);
  const startSniper = useSniperStore(state => state.startSniper);
  
  const [formData, setFormData] = useState<SniperConfig>({
    symbol: '',
    stockId: 0,
    isin: '',
    targetZone: 5,
    triggerPrice: 0,
    totalQuantity: 100,
    numOrders: 10,
    orderType: 'LIMIT',
    cancelOnFirstFill: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create sniper instance
    const sniperId = createSniper(clientId, formData);

    // Start monitoring
    const sniper = useSniperStore.getState().getSniperInstance(sniperId);
    if (sniper) {
      multiStockMonitor.startMonitoring(sniper, clientId);
      startSniper(sniperId);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4" style={{ color: '#D4AF37' }}>
          Create IPO Sniper
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Stock Symbol</label>
              <input
                type="text"
                required
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none uppercase"
                placeholder="e.g., NLO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Stock ID</label>
              <input
                type="number"
                required
                value={formData.stockId || ''}
                onChange={(e) => setFormData({ ...formData, stockId: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
                placeholder="e.g., 219"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">ISIN Code</label>
            <input
              type="text"
              required
              value={formData.isin}
              onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
              placeholder="e.g., NP0000012345"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Target Zone</label>
              <input
                type="number"
                required
                value={formData.targetZone}
                onChange={(e) => setFormData({ ...formData, targetZone: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
                min="-5"
                max="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Trigger Price (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={formData.triggerPrice || ''}
                onChange={(e) => setFormData({ ...formData, triggerPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
                placeholder="0 = use zone only"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Total Quantity</label>
              <input
                type="number"
                required
                value={formData.totalQuantity}
                onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Number of Orders</label>
              <input
                type="number"
                required
                value={formData.numOrders}
                onChange={(e) => setFormData({ ...formData, numOrders: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Order Type</label>
            <select
              value={formData.orderType}
              onChange={(e) => setFormData({ ...formData, orderType: e.target.value as 'LIMIT' | 'MARKET' })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none"
            >
              <option value="LIMIT">Limit</option>
              <option value="MARKET">Market</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cancelOnFirstFill"
              checked={formData.cancelOnFirstFill}
              onChange={(e) => setFormData({ ...formData, cancelOnFirstFill: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="cancelOnFirstFill" className="text-sm text-gray-300">
              Cancel remaining orders on first fill (Recommended for IPO)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded font-medium"
              style={{ backgroundColor: '#D4AF37', color: '#0A0A0A' }}
            >
              Create & Start Monitoring
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded font-medium bg-gray-700 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
