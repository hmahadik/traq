import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { Sidebar } from './Sidebar';
import { SettingsDrawer } from './SettingsDrawer';

export function AppLayout() {
  useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
      {/* Main content - offset by sidebar width on desktop */}
      <main className="lg:pl-20">
        <div className="px-6 py-6 pt-16 lg:pt-6">
          <Outlet />
        </div>
      </main>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster position="bottom-right" />
    </div>
  );
}
