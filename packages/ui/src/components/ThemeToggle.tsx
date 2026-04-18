/**
 * packages/ui/src/components/ThemeToggle.tsx
 * 
 * Theme toggle button component
 * Works with the global theme system
 */

import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useAppStore();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Apply to document root
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(newTheme);
    root.style.colorScheme = newTheme;
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        flex items-center gap-2 p-2 rounded-xl
        transition-all duration-200
        hover:bg-[var(--bg-hover)]
        text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        ${className}
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
