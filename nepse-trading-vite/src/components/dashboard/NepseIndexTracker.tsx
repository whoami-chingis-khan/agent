import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Power } from 'lucide-react';
import tmsApi from '../../services/tmsApi';

interface IndexData {
  index: number;
  change: number;
  changePercent: number;
  turnover: number;
  totalTrades: number;
  volume: number;
  timestamp?: string;
}

export function NepseIndexTracker() {
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Only run if enabled
    if (!isEnabled) return;

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    let intervalId: ReturnType<typeof setInterval>;

    const fetchIndexData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch NEPSE index data (using stock ID 0 or specific endpoint if available)
        // Note: You may need to adjust this endpoint based on your TMS API
        // The tmsApi automatically handles session refresh on 401 errors
        const response = await tmsApi.getLivePrice('NEPSE', 0);

        setIndexData({
          index: response.ltp || 0,
          change: response.change || 0,
          changePercent: response.changePercent || 0,
          turnover: response.turnover || 0,
          totalTrades: response.totalTrade || 0,
          volume: response.volume || 0,
          timestamp: new Date().toISOString(),
        });

        // Reset error counter on successful fetch
        consecutiveErrors = 0;
      } catch (err: any) {
        console.error('[NEPSE Index] Failed to fetch:', err);

        // Handle session-related errors specifically
        if (err.response?.status === 401) {
          console.warn('[NEPSE Index] Session expired - auto-refresh in progress...');
          // The tmsApi interceptor handles refresh automatically
          // Don't count 401 errors towards stopping the tracker
          consecutiveErrors = 0;
          setError('Session refreshing...');
        } else {
          consecutiveErrors++;

          if (consecutiveErrors >= maxConsecutiveErrors) {
            setError('Failed to fetch index data after multiple attempts');
          } else {
            setError('Failed to fetch index data');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchIndexData();

    // Set up polling
    intervalId = setInterval(fetchIndexData, 5000); // Update every 5 seconds

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isEnabled]);

  return (
    <div className="card bg-gradient-to-br from-primary-900 to-primary-800 border-primary-700">
      <div className="flex items-center justify-between mb-gr-md">
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-primary-400" />
          <h3 className="text-xl font-bold text-white">NEPSE Index</h3>
        </div>
        <div className="flex items-center space-x-3">
          {loading && <div className="text-primary-300 text-sm">Updating...</div>}
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isEnabled
                ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-accent-red/20 border border-accent-red/40 rounded-lg p-3 mb-gr-md">
          <p className="text-accent-red text-sm">{error}</p>
        </div>
      )}

      {indexData && (
        <>
          <div className="mb-gr-lg">
            <p className="text-primary-300 text-sm mb-1">Current Index</p>
            <div className="flex items-baseline space-x-3">
              <p className="text-4xl font-bold text-white">{indexData.index.toFixed(2)}</p>
              <div className={`flex items-center space-x-1 ${indexData.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {indexData.change >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="text-xl font-semibold">
                  {indexData.change >= 0 ? '+' : ''}{indexData.change.toFixed(2)}
                </span>
                <span className="text-lg">
                  ({indexData.change >= 0 ? '+' : ''}{indexData.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-gr-md border-t border-primary-700 pt-gr-md">
            <div className="space-y-1">
              <p className="text-primary-300 text-xs uppercase tracking-wide">Turnover</p>
              <p className="text-lg font-semibold text-white">
                Rs. {(indexData.turnover / 10000000).toFixed(2)}Cr
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-primary-300 text-xs uppercase tracking-wide">Volume</p>
              <p className="text-lg font-semibold text-white">
                {(indexData.volume / 100000).toFixed(2)}L
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-primary-300 text-xs uppercase tracking-wide">Trades</p>
              <p className="text-lg font-semibold text-white">
                {indexData.totalTrades.toLocaleString()}
              </p>
            </div>
          </div>

          {indexData.timestamp && (
            <div className="mt-gr-md pt-gr-md border-t border-primary-700">
              <p className="text-primary-400 text-xs text-center">
                Last updated: {new Date(indexData.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </>
      )}

      {!isEnabled && (
        <div className="text-center py-gr-lg">
          <p className="text-primary-300">Click the toggle button to enable NEPSE index tracking</p>
        </div>
      )}

      {isEnabled && !indexData && !loading && !error && (
        <div className="text-center py-gr-lg">
          <p className="text-primary-300">Loading index data...</p>
        </div>
      )}
    </div>
  );
}
