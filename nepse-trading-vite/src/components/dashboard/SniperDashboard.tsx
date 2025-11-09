import { useState } from 'react';
import { useClientStore } from '../../store/clientStore';
import { useSniperStore } from '../../store/sniperStore';
import type { SniperInstance } from '../../types/sniper';

export const SniperDashboard = () => {
  const clients = useClientStore(state => state.getAllClients());
  const allSnipers = useSniperStore(state => state.getAllSnipers());

  const activeSnipers = allSnipers.filter(s => s.isActive);
  const totalOrders = allSnipers.reduce((sum, s) => sum + s.stats.totalOrders, 0);
  const overallSuccessRate = allSnipers.length > 0
    ? allSnipers.reduce((sum, s) => sum + s.stats.successRate, 0) / allSnipers.length
    : 0;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6" style={{ color: '#D4AF37' }}>
        IPO Sniper Dashboard
      </h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Clients" value={clients.length} />
        <StatCard label="Active Snipers" value={activeSnipers.length} />
        <StatCard label="Total Orders" value={totalOrders} />
        <StatCard 
          label="Success Rate" 
          value={`${(overallSuccessRate * 100).toFixed(1)}%`} 
        />
      </div>

      {/* Per-Client Tables */}
      {clients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No clients configured. Please add a client first.</p>
        </div>
      ) : (
        clients.map(client => (
          <ClientSniperTable key={client.id} clientId={client.id} />
        ))
      )}
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
        {value}
      </div>
    </div>
  );
};

const ClientSniperTable = ({ clientId }: { clientId: string }) => {
  const client = useClientStore(state => state.getClient(clientId));
  const snipers = useSniperStore(state => state.getSnipersByClient(clientId));
  const stopSniper = useSniperStore(state => state.stopSniper);
  const removeSniper = useSniperStore(state => state.removeSniper);
  const [selectedSniper, setSelectedSniper] = useState<string | null>(null);

  if (!client) return null;
  if (snipers.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4" style={{ color: '#D4AF37' }}>
        {client.name} - {snipers.length} Sniper{snipers.length !== 1 ? 's' : ''}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border border-gray-700 rounded-lg">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Price</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Zone</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Total</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-green-400">200</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-yellow-400">400</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-red-400">502</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Success%</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Delay</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900/50">
            {snipers.map(sniper => (
              <tr key={sniper.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium" style={{ color: '#D4AF37' }}>
                  {sniper.symbol}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={sniper.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {sniper.currentPrice ? `Rs. ${sniper.currentPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {sniper.currentZone !== null ? (
                    <span className={`font-medium ${
                      sniper.currentZone >= 3 ? 'text-red-400' :
                      sniper.currentZone <= -3 ? 'text-green-400' :
                      'text-gray-400'
                    }`}>
                      {sniper.currentZone > 0 ? '+' : ''}{sniper.currentZone}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center text-gray-300">
                  {sniper.stats.totalOrders}
                </td>
                <td className="px-4 py-3 text-center text-green-400 font-medium">
                  {sniper.stats.successfulOrders}
                </td>
                <td className="px-4 py-3 text-center text-yellow-400 font-medium">
                  {sniper.stats.failedOrders}
                </td>
                <td className="px-4 py-3 text-center text-red-400 font-medium">
                  {sniper.stats.gatewayErrors}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${
                    sniper.stats.successRate >= 0.9 ? 'text-green-400' :
                    sniper.stats.successRate >= 0.7 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(sniper.stats.successRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {sniper.stats.isDelayLocked ? (
                    <span className="text-green-400">
                      🔒 {sniper.stats.optimalDelay}ms
                    </span>
                  ) : (
                    <span className="text-yellow-400">
                      ⚙️ {sniper.stats.currentDelay}ms
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    {sniper.isActive && (
                      <button
                        onClick={() => stopSniper(sniper.id)}
                        className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSniper(sniper.id)}
                      className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      Details
                    </button>
                    {!sniper.isActive && (
                      <button
                        onClick={() => {
                          if (confirm('Remove this sniper?')) {
                            removeSniper(sniper.id);
                          }
                        }}
                        className="px-3 py-1 text-xs rounded bg-gray-600 hover:bg-gray-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSniper && (
        <OrderHistoryModal
          sniperId={selectedSniper}
          onClose={() => setSelectedSniper(null)}
        />
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: SniperInstance['status'] }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'bg-gray-600/20 text-gray-400';
      case 'monitoring': return 'bg-blue-600/20 text-blue-400';
      case 'triggered': return 'bg-yellow-600/20 text-yellow-400';
      case 'executing': return 'bg-orange-600/20 text-orange-400';
      case 'completed': return 'bg-green-600/20 text-green-400';
      case 'failed': return 'bg-red-600/20 text-red-400';
      case 'stopped': return 'bg-gray-600/20 text-gray-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle': return '⏸️';
      case 'monitoring': return '🔄';
      case 'triggered': return '⚡';
      case 'executing': return '⚙️';
      case 'completed': return '✓';
      case 'failed': return '✗';
      case 'stopped': return '⏹️';
      default: return '';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
      <span>{getStatusIcon()}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
};

const OrderHistoryModal = ({ sniperId, onClose }: { sniperId: string; onClose: () => void }) => {
  const sniper = useSniperStore(state => state.getSniperInstance(sniperId));

  if (!sniper) return null;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            Order History - {sniper.symbol}
          </h3>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Total Duration</div>
            <div className="text-xl font-bold text-white">
              {formatDuration(sniper.stats.totalDuration)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Avg Response Time</div>
            <div className="text-xl font-bold text-white">
              {sniper.stats.avgResponseTime.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-gray-800/50 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Success Rate</div>
            <div className="text-xl font-bold text-green-400">
              {(sniper.stats.successRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-gray-800/50 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Optimal Delay</div>
            <div className="text-xl font-bold" style={{ color: '#D4AF37' }}>
              {sniper.stats.optimalDelay || sniper.stats.currentDelay}ms
            </div>
          </div>
        </div>

        {/* Order Table */}
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-700 rounded-lg">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">#</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Time</th>
                <th className="px-4 py-2 text-center text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-300">Qty</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-300">Price</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-300">Delay (ms)</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-300">Response (ms)</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Message</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900/50">
              {sniper.stats.orders.map((order, idx) => (
                <tr key={order.orderId} className="border-t border-gray-700">
                  <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2 text-gray-300">{formatTime(order.timestamp)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 200 ? 'bg-green-600/20 text-green-400' :
                      order.status === 400 ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-red-600/20 text-red-400'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">{order.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    Rs. {order.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">{order.delay}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{order.responseTime}</td>
                  <td className="px-4 py-2 text-sm text-gray-400 truncate max-w-xs">
                    {order.message || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
