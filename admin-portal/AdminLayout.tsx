// admin-portal/AdminLayout.tsx
// Main Admin Portal Layout with Sidebar Navigation

import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

const navigationItems = [
  {
    section: 'Overview',
    items: [
      { name: 'Dashboard', path: '/admin', icon: '📊' },
    ]
  },
  {
    section: 'Core Management',
    items: [
      { name: 'Bookings Console', path: '/admin/bookings', icon: '📅' },
      { name: 'Cleaner Management', path: '/admin/cleaners', icon: '👥' },
      { name: 'Client Management', path: '/admin/clients', icon: '🏢' },
    ]
  },
  {
    section: 'Analytics & Finance',
    items: [
      { name: 'Analytics & Reports', path: '/admin/analytics', icon: '📈' },
      { name: 'Finance Center', path: '/admin/finance', icon: '💰' },
    ]
  },
  {
    section: 'Operations',
    items: [
      { name: 'Risk Management', path: '/admin/risk', icon: '⚠️' },
      { name: 'Message Log', path: '/admin/messages', icon: '📧' },
    ]
  },
  {
    section: 'Settings',
    items: [
      { name: 'System Config', path: '/admin/system', icon: '⚙️' },
    ]
  }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem('adminUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load system health
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_BASE_URL}/admin/system/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemHealth(response.data);
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-gradient-to-b from-gray-900 to-gray-800 text-white transition-all duration-300 flex flex-col shadow-2xl`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    PureTask Admin
                  </h1>
                  <p className="text-xs text-gray-400 mt-1">Control Center</p>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ←
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors mx-auto"
              >
                →
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {navigationItems.map((section, idx) => (
            <div key={idx} className="mb-6">
              {sidebarOpen && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.section}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                      isActivePath(item.path)
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    {sidebarOpen && (
                      <span className="font-medium text-sm">{item.name}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* System Health Indicator */}
        {sidebarOpen && systemHealth && (
          <div className="p-4 border-t border-gray-700">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400">System Status</span>
                <span className={`w-2 h-2 rounded-full ${
                  systemHealth.status === 'healthy' ? 'bg-green-400' :
                  systemHealth.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
              </div>
              <p className="text-xs text-gray-300 capitalize">{systemHealth.status}</p>
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="p-4 border-t border-gray-700">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                🚪
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors w-full"
              title="Logout"
            >
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {navigationItems
                  .flatMap(s => s.items)
                  .find(item => isActivePath(item.path))?.name || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                🔔 Notifications
              </button>
              <button 
                onClick={() => loadSystemHealth()}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 overflow-auto">
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>© 2026 PureTask Admin Portal. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-gray-900 transition-colors">Documentation</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Support</a>
              <a href="#" className="hover:text-gray-900 transition-colors">API Status</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

