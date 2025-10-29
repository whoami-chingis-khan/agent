import { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { Key, Upload, CheckCircle, User, RefreshCw } from 'lucide-react';
import { smartParseHeaders } from '../../utils/headerParser';
import tmsApi from '../../services/tmsApi';

export function SessionManager() {
  const { isAuthenticated, updateHeaders } = useSessionStore();
  const [headerInput, setHeaderInput] = useState('');
  const [error, setError] = useState('');
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setHeaderInput(text);
      setError('');
    } catch (err) {
      setError('Failed to read clipboard');
    }
  };

  const handleSubmit = () => {
    try {
      // Use smart parser that handles both JSON and raw headers
      const headers = smartParseHeaders(headerInput);

      // Validate that we got at least some required headers
      if (!headers['x-xsrf-token'] && !headers['host-session-id']) {
        setError('Missing required headers. Please paste valid session headers.');
        return;
      }

      updateHeaders(headers);
      setError('');
      // Auto-fetch client details after successful authentication
      fetchClientDetails();
    } catch (err) {
      setError('Failed to parse headers. Please check the format.');
    }
  };

  const fetchClientDetails = async () => {
    if (!isAuthenticated) {
      setError('Please activate session first');
      return;
    }

    try {
      setLoadingClient(true);
      setError('');
      const details = await tmsApi.getMyClientDetails();
      setClientInfo(details);
      console.log('[Session Manager] Client details fetched:', details);
    } catch (err: any) {
      console.error('[Session Manager] Failed to fetch client details:', err);
      setError(`Failed to fetch client details: ${err.response?.data?.message || err.message}`);
      setClientInfo(null);
    } finally {
      setLoadingClient(false);
    }
  };

  return (
    <div className="space-y-gr-lg">
      <div className="card">
        <div className="flex items-center space-x-gr-md mb-gr-lg">
          <Key className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-bold">Session Management</h2>
        </div>

        {isAuthenticated ? (
          <div className="space-y-gr-md">
            <div className="flex items-center space-x-gr-md p-gr-md bg-accent-green/10 border border-accent-green/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-accent-green" />
              <span className="text-accent-green">Session is active and ready</span>
            </div>

            {/* Client Info Section */}
            <div className="bg-dark-700 p-gr-md rounded-lg">
              <div className="flex items-center justify-between mb-gr-md">
                <div className="flex items-center space-x-gr-sm">
                  <User className="w-5 h-5 text-primary-400" />
                  <h3 className="text-lg font-semibold text-dark-200">Client Details</h3>
                </div>
                <button
                  onClick={fetchClientDetails}
                  disabled={loadingClient}
                  className="btn btn-primary btn-sm flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingClient ? 'animate-spin' : ''}`} />
                  <span>{loadingClient ? 'Loading...' : 'Fetch Details'}</span>
                </button>
              </div>

              {clientInfo ? (
                <div className="space-y-gr-sm">
                  <div className="grid grid-cols-2 gap-gr-md">
                    <div>
                      <p className="text-xs text-dark-400">UCC</p>
                      <p className="font-mono text-sm text-dark-200 font-semibold">{clientInfo.ucc || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400">Client Code</p>
                      <p className="font-mono text-sm text-dark-200 font-semibold">{clientInfo.clientCode || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-dark-400">Client Name</p>
                    <p className="text-sm text-dark-200">{clientInfo.clientName || 'N/A'}</p>
                  </div>
                  {clientInfo.dpId && (
                    <div>
                      <p className="text-xs text-dark-400">DP ID</p>
                      <p className="font-mono text-sm text-dark-200">{clientInfo.dpId}</p>
                    </div>
                  )}
                  <div className="pt-gr-sm border-t border-dark-600">
                    <p className="text-xs text-accent-green">
                      ✓ You can now use these details in the IPO Sniper
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-dark-400 text-center py-gr-md">
                  Click "Fetch Details" to retrieve your client information
                </p>
              )}

              {error && (
                <div className="mt-gr-sm text-accent-red text-xs">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-gr-md">
            <p className="text-dark-300">
              Paste your TMS session headers below. You can paste either raw headers from Chrome DevTools or JSON format.
            </p>

            <div>
              <label className="label">Session Headers (Raw or JSON)</label>
              <textarea
                value={headerInput}
                onChange={(e) => setHeaderInput(e.target.value)}
                className="input h-48 font-mono text-sm"
                placeholder={`Paste raw headers like:
x-xsrf-token
your-token-here
host-session-id
your-session-id-here
...

Or JSON format:
{"x-xsrf-token": "...", "host-session-id": "...", ...}`}
              />
            </div>

            {error && (
              <div className="text-accent-red text-sm">{error}</div>
            )}

            <div className="flex space-x-gr-md">
              <button onClick={handlePaste} className="btn btn-primary flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Paste from Clipboard</span>
              </button>
              <button onClick={handleSubmit} className="btn btn-success">
                Activate Session
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-gr-md">How to Extract Headers</h3>
        <ol className="list-decimal list-inside space-y-2 text-dark-300">
          <li>Open TMS in Chrome and log in</li>
          <li>Open DevTools (F12)</li>
          <li>Go to Network tab</li>
          <li>Perform any action in TMS</li>
          <li>Click on any request</li>
          <li>Copy request headers and cookies</li>
          <li>Format as JSON and paste above</li>
        </ol>
      </div>
    </div>
  );
}
