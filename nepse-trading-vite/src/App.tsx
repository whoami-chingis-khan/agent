import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { SessionManager } from './components/session/SessionManager';
import { LivePriceMonitor } from './components/orders/LivePriceMonitor';
import { SimpleOrder } from './components/orders/SimpleOrder';
import { IPOSniper } from './components/orders/IPOSniper';

function App() {
  const [activeTab, setActiveTab] = useState('session');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'session' && <SessionManager />}

      {activeTab === 'orders' && (
        <div className="space-y-gr-lg">
          <LivePriceMonitor />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gr-lg">
            <SimpleOrder />
            <IPOSniper />
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-gr-md">Price Monitoring</h2>
          <p className="text-dark-400">Price monitoring features coming soon...</p>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-gr-md">Order History</h2>
          <p className="text-dark-400">Order history features coming soon...</p>
        </div>
      )}
    </Layout>
  );
}

export default App;
