import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '../api/client.js';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  const navItem = (to, label, icon) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
        }`
      }
    >
      <span className="text-lg">{icon}</span>
      {label}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">AIA ICE</p>
              <p className="text-gray-500 text-xs">Installer v1.0</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItem('/deploy', 'Despliegue', '🚀')}
          {navItem('/config', 'Configuración', '⚙️')}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase">
              {user.username?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-gray-200 text-xs font-medium truncate">{user.username}</p>
              <p className="text-gray-500 text-xs truncate">{user.environment}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span>🚪</span>
            {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
