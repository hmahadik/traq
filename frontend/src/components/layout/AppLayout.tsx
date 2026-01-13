import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { Sidebar } from './Sidebar';
import { SettingsDrawer } from './SettingsDrawer';
import { DateProvider } from '@/contexts';
import { GlobalErrorHandler } from '@/components/common/GlobalErrorHandler';

export function AppLayout() {
  useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <DateProvider>
      <GlobalErrorHandler>
        <div className="relative h-screen bg-background overflow-hidden">
          <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
          {/* Main content - offset by sidebar width on desktop */}
          <main className="lg:pl-[88px] h-screen flex flex-col">
            <div className="flex-1 px-4 sm:px-6 py-6 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </main>
          <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Toaster position="bottom-right" />
        </div>
      </GlobalErrorHandler>
    </DateProvider>
  );
}
