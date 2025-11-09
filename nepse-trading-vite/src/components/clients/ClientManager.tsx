import { useState } from 'react';
import { useClientStore } from '../../store/clientStore';
import { multiClientTmsApi } from '../../services/multiClientTmsApi';
import { smartParseHeaders } from '../../utils/headerParser';

export const ClientManager = () => {
  const { clients, activeClientId, removeClient, switchClient, updateClientSession } = useClientStore();
  const [showAddModal, setShowAddModal] = useState(false);

  const clientList = Array.from(clients.values());

  const handleFetchDetails = async (clientId: string) => {
    try {
      const clientInfo = await multiClientTmsApi.getClientInfo(clientId);
      const client = clients.get(clientId);
      
      if (client) {
        // Update client with fetched details
        updateClientSession(clientId, {
          name: clientInfo.clientName || client.name,
          clientId: clientInfo.clientCode || client.clientId,
          ucc: clientInfo.ucc || client.ucc,
          headers: {
            ...client.headers,
            'request-owner': clientInfo.clientCode || client.headers['request-owner'],
          },
        });
        alert('Client details fetched successfully!');
      }
    } catch (error) {
      console.error('Failed to fetch client details:', error);
      alert('Failed to fetch client details');
    }
  };

  const handleRefreshClient = async (clientId: string) => {
    try {
      await multiClientTmsApi.refreshClientSession(clientId);
      alert('Session refreshed successfully!');
    } catch (error) {
      console.error('Failed to refresh session:', error);
      alert('Failed to refresh session');
    }
  };

  const handleRemoveClient = (clientId: string) => {
    if (confirm('Are you sure you want to remove this client?')) {
      multiClientTmsApi.removeClientApi(clientId);
      removeClient(clientId);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
          Client Sessions ({clientList.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded font-medium transition-colors"
          style={{ 
            backgroundColor: '#D4AF37', 
            color: '#0A0A0A'
          }}
        >
          ➕ Add Client
        </button>
      </div>

      {clientList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-4">No client sessions configured</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded font-medium"
            style={{ backgroundColor: '#D4AF37', color: '#0A0A0A' }}
          >
            Add Your First Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientList.map(client => (
            <div
              key={client.id}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                activeClientId === client.id
                  ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
              onClick={() => switchClient(client.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1" style={{ color: '#D4AF37' }}>
                    {client.name}
                  </h3>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    client.isValid ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                  }`}>
                    {client.isValid ? '✓ Valid' : '✗ Invalid'}
                  </span>
                </div>
                {activeClientId === client.id && (
                  <span className="text-xl">⭐</span>
                )}
              </div>

              <div className="space-y-1 text-sm text-gray-400 mb-4">
                <div>TMS: <span className="text-[#D4AF37] font-semibold">{client.tmsProvider}</span></div>
                <div>UCC: <span className="text-gray-300">{client.ucc || 'Not fetched'}</span></div>
                <div>Client ID: <span className="text-gray-300">{client.clientId || 'Not fetched'}</span></div>
                <div>Member: <span className="text-gray-300">{client.memberCode}</span></div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFetchDetails(client.id);
                  }}
                  className="flex-1 px-3 py-2 rounded text-sm font-medium bg-green-600 hover:bg-green-700 transition-colors"
                >
                  📥 Fetch Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshClient(client.id);
                  }}
                  className="flex-1 px-3 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveClient(client.id);
                  }}
                  className="px-3 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddClientModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
};

const AddClientModal = ({ onClose }: { onClose: () => void }) => {
  const { addClient } = useClientStore();
  const [headerInput, setHeaderInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setHeaderInput(text);
      setError('');
    } catch (err) {
      setError('Failed to read clipboard');
    }
  };

  const handleActivateSession = async () => {
    setError('');
    setLoading(true);

    try {
      // Use the same smart parser as SessionManager
      const headers = smartParseHeaders(headerInput);

      // Validate required headers
      const xsrfToken = headers['x-xsrf-token'];
      const hostSessionId = headers['host-session-id'];
      const memberCode = headers['membercode'] || '56';
      const requestOwner = headers['request-owner'] || '';

      if (!xsrfToken || !hostSessionId) {
        setError('Missing required headers (x-xsrf-token, host-session-id). Please paste valid session headers.');
        setLoading(false);
        return;
      }

      // Extract cookies from cookie header
      let aid = '';
      let rid = '';
      
      if (headers['cookie']) {
        const cookies = headers['cookie'].split(';').map((c: string) => c.trim());
        cookies.forEach((cookie: string) => {
          const [name, value] = cookie.split('=');
          if (name === '_aid') aid = value;
          if (name === '_rid') rid = value;
        });
      }

      if (!aid || !rid) {
        setError('Missing required cookies (_aid, _rid) in cookie header');
        setLoading(false);
        return;
      }

      // CRITICAL: Detect TMS provider from headers or prompt user
      // Try to extract from referer, origin, or host header
      let tmsProvider = 'tms56'; // default
      let tmsBaseUrl = 'https://tms56.nepsetms.com.np';
      
      const referer = (headers as any)['referer'] || (headers as any)['origin'];
      if (referer) {
        const match = referer.match(/tms(\d+)\.nepsetms\.com\.np/);
        if (match) {
          tmsProvider = `tms${match[1]}`;
          tmsBaseUrl = `https://tms${match[1]}.nepsetms.com.np`;
        }
      }
      
      // If still default, use membercode to infer
      if (tmsProvider === 'tms56' && memberCode !== '56') {
        tmsProvider = `tms${memberCode}`;
        tmsBaseUrl = `https://tms${memberCode}.nepsetms.com.np`;
      }

      console.log('[Client Manager] Detected TMS Provider:', tmsProvider, tmsBaseUrl);

      // Create client ID
      const clientId = `client_${Date.now()}`;
      
      // Create client session (without name, will be fetched)
      const newClient = {
        id: clientId,
        name: 'Loading...', // Will be updated when details are fetched
        memberCode,
        clientId: '',  // Will be filled when details are fetched
        ucc: '',       // Will be filled when details are fetched
        tmsProvider,   // CRITICAL: Set detected TMS provider
        tmsBaseUrl,    // CRITICAL: Set TMS base URL
        cookies: {
          'XSRF-TOKEN': xsrfToken,
          '_aid': aid,
          '_rid': rid,
        },
        headers: {
          'x-xsrf-token': xsrfToken,
          'host-session-id': hostSessionId,
          'membercode': memberCode,
          'request-owner': requestOwner,
        },
        isActive: true,
        lastRefresh: null,
        createdAt: new Date(),
        isValid: true,
        lastValidated: new Date(),
      };

      // Add client to store
      addClient(newClient);
      
      // Create API instance for this client
      multiClientTmsApi.createClientApi(clientId, newClient);

      console.log('[Client Manager] Client session activated:', clientId);
      
      onClose();

    } catch (err: any) {
      setError('Failed to parse headers. Please check the format.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4" style={{ color: '#D4AF37' }}>
          Add Client Session
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Session Headers (from Browser DevTools)
            </label>
            <textarea
              value={headerInput}
              onChange={(e) => setHeaderInput(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#D4AF37] focus:outline-none font-mono text-sm h-64"
              placeholder={`Paste headers from Chrome DevTools Network tab:

x-xsrf-token: your-token
host-session-id: your-session-id
membercode: 56
request-owner: 25717
cookie: XSRF-TOKEN=...; _aid=...; _rid=...

Or paste as JSON:
{
  "x-xsrf-token": "...",
  "host-session-id": "...",
  ...
}`}
            />
          </div>

          <button
            type="button"
            onClick={handlePaste}
            className="w-full px-4 py-2 rounded font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            📋 Paste from Clipboard
          </button>

          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-600/10 border border-blue-600/30 rounded p-4">
            <p className="text-sm text-blue-400 mb-2">💡 How to get headers:</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Open Chrome DevTools (F12)</li>
              <li>Go to Network tab</li>
              <li>Login to TMS and click any request</li>
              <li>Go to Headers tab → Request Headers</li>
              <li>Copy headers and paste above</li>
            </ol>
          </div>

          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded p-4">
            <p className="text-sm text-[#D4AF37] mb-2">🔒 TMS Provider Detection:</p>
            <p className="text-xs text-gray-400">
              The system will automatically detect your TMS provider (tms56, tms57, etc.) from your headers. 
              This ensures tokens are sent to the correct TMS server, preventing refresh loops and 401 errors.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleActivateSession}
              disabled={loading || !headerInput.trim()}
              className="flex-1 px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4AF37', color: '#0A0A0A' }}
            >
              {loading ? 'Activating...' : 'Activate Session'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded font-medium bg-gray-700 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
