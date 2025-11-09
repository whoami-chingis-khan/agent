import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { ClientManager } from './components/clients/ClientManager';
import { IPOSniperMulti } from './components/orders/IPOSniperMulti';
import { SniperDashboard } from './components/dashboard/SniperDashboard';
import { NepseIndexTracker } from './components/dashboard/NepseIndexTracker';

function App() {
  const [activeTab, setActiveTab] = useState('clients');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'clients' && <ClientManager />}

      {activeTab === 'sniper' && (
        <div className="space-y-gr-lg">
          <IPOSniperMulti />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-gr-lg">
          <NepseIndexTracker />
          <SniperDashboard />
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
