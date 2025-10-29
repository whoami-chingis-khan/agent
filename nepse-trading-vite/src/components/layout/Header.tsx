import { Activity, LogOut } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

export function Header() {
  const { isAuthenticated, sessionData, clearSession } = useSessionStore();

  return (
    <header className="bg-dark-800 border-b border-dark-700 px-gr-lg py-gr-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-gr-md">
          <Activity className="w-8 h-8 text-primary-500" />
          <div>
            <h1 className="text-xl font-bold text-primary-500">NEPSE Trading Assistant</h1>
            <p className="text-sm text-dark-400">IPO Sniper & Order Manager</p>
          </div>
        </div>

        <div className="flex items-center space-x-gr-md">
          {isAuthenticated ? (
            <>
              <div className="text-right">
                <p className="text-sm text-dark-300">Session Active</p>
                <p className="text-xs text-dark-500">{sessionData?.memberCode}</p>
              </div>
              <button
                onClick={clearSession}
                className="btn btn-danger flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="text-sm text-accent-red">No active session</div>
          )}
        </div>
      </div>
    </header>
  );
}
