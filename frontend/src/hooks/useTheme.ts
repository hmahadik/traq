import { useEffect, useState } from 'react';
import { useConfig } from '../api/hooks';
import { GetSystemTheme } from '../../wailsjs/go/main/App';

/**
 * Applies the configured theme to the document.
 * Handles 'light', 'dark', and 'system' (follows OS preference) modes.
 */
export function useTheme() {
  const { data: config } = useConfig();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Fetch the system theme from Go when user wants 'system'
  useEffect(() => {
    const theme = config?.ui?.theme || 'system';
    if (theme === 'system') {
      GetSystemTheme()
        .then((detected) => {
          setSystemTheme(detected === 'dark' ? 'dark' : 'light');
        })
        .catch(() => {
          // Fallback to light if detection fails
          setSystemTheme('light');
        });
    }
  }, [config?.ui?.theme]);

  useEffect(() => {
    const theme = config?.ui?.theme || 'system';
    const root = document.documentElement;

    // Remove all theme classes first
    root.classList.remove('dark', 'light');
    root.removeAttribute('data-theme');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.add('light');
    } else {
      // System theme - use Go-detected theme
      root.classList.add(systemTheme);
    }
  }, [config?.ui?.theme, systemTheme]);
}
