import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useStocksStore } from '../../store/stocksStore';
import tmsApi from '../../services/tmsApi';

export function LivePriceMonitor() {
  const { selectedStock, livePrice, setLivePrice } = useStocksStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStock) return;

    const fetchPrice = async () => {
      try {
        setLoading(true);
        const data = await tmsApi.getLivePrice(selectedStock.symbol, selectedStock.id);
        setLivePrice(data);
      } catch (error) {
        console.error('Failed to fetch live price:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [selectedStock, setLivePrice]);

  if (!selectedStock) {
    return (
      <div className="card">
        <p className="text-dark-400 text-center">Select a stock to view live price</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-gr-md">
        <div>
          <h3 className="text-2xl font-bold">{selectedStock.symbol}</h3>
          <p className="text-dark-400 text-sm">{selectedStock.companyName}</p>
        </div>
        {loading && <div className="text-primary-500 text-sm">Updating...</div>}
      </div>

      {livePrice && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gr-md">
          <div className="space-y-1">
            <p className="text-dark-400 text-sm">LTP</p>
            <p className="text-2xl font-bold text-primary-500">Rs. {livePrice.ltp.toFixed(2)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-dark-400 text-sm">Change</p>
            <div className={`flex items-center space-x-1 ${livePrice.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {livePrice.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-lg font-semibold">{livePrice.changePercent.toFixed(2)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-dark-400 text-sm">Volume</p>
            <p className="text-lg font-semibold">{livePrice.volume.toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <p className="text-dark-400 text-sm">Trades</p>
            <p className="text-lg font-semibold">{livePrice.totalTrade}</p>
          </div>
        </div>
      )}
    </div>
  );
}
