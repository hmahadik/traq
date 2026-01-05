import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './Header';
import { SettingsDrawer } from './SettingsDrawer';

export function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <Header onSettingsClick={() => setSettingsOpen(true)} />
      <main className="container py-6">
        <Outlet />
      </main>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster position="bottom-right" />
    </div>
  );
}
