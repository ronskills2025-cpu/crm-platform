import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Bell, Moon, Sun, LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { cn } from '../../../../utils/src/frontend-utils';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../../../../modules/users/frontend/stores/authStore';
import { productDashboardApi } from '../../services/api';

export interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { theme, setTheme } = useAppStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => productDashboardApi.listNotifications({ limit: '10' }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const unreadCount = notifications?.notifications?.filter((n: any) => !n.is_read).length || 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 md:px-6
                        bg-[var(--bg-surface)]/80 glass border-b border-[var(--border-subtle)]">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search modules, leads, campaigns..."
            className="w-full h-9 pl-10 pr-3 text-xs rounded-xl
                       bg-[var(--bg-input)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder-[var(--text-muted)]
                       focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/30
                       transition-all duration-200"
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            // Apply to document root immediately
            const root = document.documentElement;
            root.classList.remove('dark', 'light');
            root.classList.add(newTheme);
            root.style.colorScheme = newTheme;
          }}
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div ref={notificationRef} className="relative">
          <button 
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--accent-primary)] rounded-full ring-2 ring-[var(--bg-surface)]" />
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl
                           bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-lg
                           animate-fade-in-scale overflow-hidden z-50">
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-primary)]">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-[var(--accent-primary)] text-white px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications?.notifications?.length > 0 ? (
                  notifications.notifications.slice(0, 10).map((notification: any) => (
                    <div 
                      key={notification.id}
                      className={`p-3 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] cursor-pointer ${
                        !notification.is_read ? 'bg-[var(--accent-primary)]/5' : ''
                      }`}
                      onClick={() => {
                        navigate('/products');
                        setNotificationOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          !notification.is_read ? 'bg-[var(--accent-primary)]' : 'bg-transparent'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-muted)]">No notifications yet</p>
                  </div>
                )}
              </div>
              {notifications?.notifications?.length > 0 && (
                <div className="p-3 border-t border-[var(--border-subtle)]">
                  <button 
                    onClick={() => {
                      navigate('/products');
                      setNotificationOpen(false);
                    }}
                    className="w-full text-sm text-[var(--accent-primary)] hover:underline"
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600
                            flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-[var(--text-secondary)] hidden md:block max-w-[100px] truncate">
              {user?.name || 'User'}
            </span>
            <ChevronDown size={12} className="text-[var(--text-muted)] hidden md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl
                           bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-lg
                           animate-fade-in-scale overflow-hidden">
              <div className="p-3 border-b border-[var(--border-subtle)]">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user?.email || ''}</p>
              </div>
              <div className="p-1">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)]
                                   hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <User size={14} /> Profile
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)]
                                   hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Settings size={14} /> Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--status-error)]
                             hover:bg-[var(--status-error-bg)] transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


