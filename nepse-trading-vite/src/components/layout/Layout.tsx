import { type ReactNode } from 'react';
import { Header } from './Header';
import { Settings, TrendingUp, Bell, FileText } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const tabs = [
    { id: 'session', label: 'Session', icon: Settings },
    { id: 'orders', label: 'Orders', icon: TrendingUp },
    { id: 'monitoring', label: 'Monitoring', icon: Bell },
    { id: 'history', label: 'History', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Header />

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-dark-800 border-r border-dark-700 min-h-[calc(100vh-73px)]">
          <div className="p-gr-md space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center space-x-gr-sm px-gr-md py-gr-sm rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-dark-900'
                      : 'text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-gr-xl">
          {children}
        </main>
      </div>
    </div>
  );
}
