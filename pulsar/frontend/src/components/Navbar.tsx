/**
 * Navbar.tsx
 * 
 * Navigation bar with tabs for different sections of the app.
 */

interface NavbarProps {
  activeTab: 'channels' | 'marketplace' | 'analytics' | 'prediction'
  onTabChange: (tab: 'channels' | 'marketplace' | 'analytics' | 'prediction') => void
}

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const tabs = [
    { id: 'prediction' as const, label: 'Cost Prediction', icon: '🔮' },
    { id: 'channels' as const, label: 'Payment Channels', icon: '⚡' },
    { id: 'marketplace' as const, label: 'Agent Marketplace', icon: '🤖' },
    { id: 'analytics' as const, label: 'Analytics', icon: '📊' },
  ]

  return (
    <nav className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-b border-white/20 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-stellar-700 dark:text-white shadow-lg scale-105'
                  : 'text-white/70 dark:text-gray-400 hover:text-white dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
