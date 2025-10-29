import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import tmsApi from '../../services/tmsApi';
import { useSessionStore } from '../../store/sessionStore';

export function SimpleOrder() {
  const { isAuthenticated } = useSessionStore();
  const [formData, setFormData] = useState({
    stockId: '',
    isin: '',
    quantity: '',
    price: '',
    orderType: 'B' as 'B' | 'S',
    ucc: '',
    clientCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setResult({ success: false, message: 'Please activate session first' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        stockId: parseInt(formData.stockId),
        isin: formData.isin,
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        orderType: formData.orderType,
        orderValidity: 'DAY',
        ucc: formData.ucc,
        clientCode: formData.clientCode,
      };

      await tmsApi.placeOrder(payload);
      setResult({ success: true, message: 'Order placed successfully!' });

      // Reset form
      setFormData({
        stockId: '',
        isin: '',
        quantity: '',
        price: '',
        orderType: 'B',
        ucc: '',
        clientCode: '',
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.message || 'Failed to place order',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-gr-md mb-gr-lg">
        <ShoppingCart className="w-6 h-6 text-primary-500" />
        <h2 className="text-xl font-bold">Simple Order</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-gr-md">
        <div className="grid grid-cols-2 gap-gr-md">
          <div>
            <label className="label">Stock ID</label>
            <input
              type="text"
              value={formData.stockId}
              onChange={(e) => setFormData({ ...formData, stockId: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">ISIN</label>
            <input
              type="text"
              value={formData.isin}
              onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
              className="input"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-gr-md">
          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="input"
              required
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
              required
            />
          </div>
          <div>
            <label className="label">Client Code</label>
            <input
              type="text"
              value={formData.clientCode}
              onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Order Type</label>
          <div className="flex space-x-gr-md">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, orderType: 'B' })}
              className={`flex-1 py-gr-sm rounded-lg font-medium transition-all ${
                formData.orderType === 'B' ? 'btn-success' : 'bg-dark-700 text-dark-300'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, orderType: 'S' })}
              className={`flex-1 py-gr-sm rounded-lg font-medium transition-all ${
                formData.orderType === 'S' ? 'btn-danger' : 'bg-dark-700 text-dark-300'
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        {result && (
          <div
            className={`p-gr-md rounded-lg ${
              result.success ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green' : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
            }`}
          >
            {result.message}
          </div>
        )}

        <button type="submit" disabled={loading || !isAuthenticated} className="btn btn-primary w-full">
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}
