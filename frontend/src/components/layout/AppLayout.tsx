import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { Sidebar } from './Sidebar';
import { SettingsDrawer } from './SettingsDrawer';
import { DateProvider } from '@/contexts';

export function AppLayout() {
  useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <DateProvider>
      <div className="relative min-h-screen bg-background">
        <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
        {/* Main content - offset by sidebar width on desktop */}
        <main className="lg:pl-20 min-h-screen">
          <div className="px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
        <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
        <Toaster position="bottom-right" />
      </div>
    </DateProvider>
  );
}
