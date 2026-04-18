import { Outlet, Navigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Radio, Settings, FileText, Moon, Sun, LogOut
} from 'lucide-react';
import { cn } from '../../../../utils/src/frontend-utils';
import { useAuthStore } from '../../../../../modules/users/admin/stores/authStore';
import { useAppStore } from '../../stores/appStore';

const adminNav = [
  { label: 'Overview', path: '/', icon: <LayoutDashboard size={18} />, end: true },
  { label: 'Users', path: '/users', icon: <Users size={18} /> },
  { label: 'Providers', path: '/providers', icon: <Radio size={18} /> },
  { label: 'Channels', path: '/channels', icon: <Settings size={18} /> },
  { label: 'Campaigns', path: '/campaigns', icon: <FileText size={18} /> },
];

export default function AdminLayout() {
  const { isAuthenticated, logout, user } = useAuthStore();
  const { theme, setTheme } = useAppStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(newTheme);
    root.style.colorScheme = newTheme;
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-root)', color: 'var(--text-primary)' }}>
      {/* Admin sidebar */}
      <aside className="w-60 flex flex-col" style={{ borderRight: '1px solid var(--border-subtle)' }}>
        <div className="h-14 flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600
                          flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Admin</span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {adminNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }: { isActive: boolean }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-glow'
                  : 'border border-transparent hover:bg-[var(--bg-hover)]'
              )}
              style={({ isActive }: { isActive: boolean }) => ({
                color: isActive ? undefined : 'var(--text-secondary)',
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {/* Logout */}
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="h-14 flex items-center justify-between px-6 sticky top-0 z-10 glass"
             style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-root)' }}>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Admin Panel</h1>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</span>
        </div>
        <div className="p-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


