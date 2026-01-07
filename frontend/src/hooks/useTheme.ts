import { useEffect } from 'react';
import { useConfig } from '../api/hooks';
import { usePrefersDarkMode } from './useMediaQuery';

/**
 * Applies the configured theme to the document.
 * Handles 'light', 'dark', and 'system' (follows OS preference) modes.
 */
export function useTheme() {
  const { data: config } = useConfig();
  const prefersDark = usePrefersDarkMode();

  useEffect(() => {
    const theme = config?.ui?.theme ?? 'system';
    const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);

    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, [config?.ui?.theme, prefersDark]);
}
