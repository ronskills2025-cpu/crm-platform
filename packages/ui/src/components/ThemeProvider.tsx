/**
 * packages/ui/src/components/ThemeProvider.tsx
 * 
 * Global Theme Provider for dark/light mode
 * - Persists theme in localStorage
 * - Applies theme class to document root
 * - Provides theme context to all components
 */

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
  const { theme, setTheme } = useAppStore();

  // Apply theme class to document root on mount and theme change
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = theme || defaultTheme;

    // Remove both classes first
    root.classList.remove('dark', 'light');
    
    // Add the current theme class
    root.classList.add(currentTheme);

    // Also update color-scheme for native elements
    root.style.colorScheme = currentTheme;

    // Store in localStorage for persistence
    localStorage.setItem('crm-theme', currentTheme);
  }, [theme, defaultTheme]);

  // Initialize theme from localStorage on first render
  useEffect(() => {
    const stored = localStorage.getItem('crm-theme') as Theme | null;
    if (stored && (stored === 'dark' || stored === 'light')) {
      setTheme(stored);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, [setTheme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextValue = {
    theme: theme || defaultTheme,
    setTheme,
    toggleTheme,
    isDark: (theme || defaultTheme) === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
