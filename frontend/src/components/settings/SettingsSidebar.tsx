import { Link, useLocation } from 'react-router-dom';
import { Camera, Database, Sparkles, Tags, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVersion } from '@/api/hooks';

const sections = [
  { path: '/settings/capture', label: 'Capture', icon: Camera },
  { path: '/settings/data-sources', label: 'Data Sources', icon: Database },
  { path: '/settings/ai', label: 'AI', icon: Sparkles },
  { path: '/settings/categories', label: 'Categories', icon: Tags },
  { path: '/settings/general', label: 'General', icon: Settings2 },
];

export function SettingsSidebar() {
  const location = useLocation();
  const { data: version } = useVersion();

  return (
    <aside className="w-52 flex-shrink-0 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {sections.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path ||
              (path === '/settings/capture' && location.pathname === '/settings');
            return (
              <li key={path}>
                <Link
                  to={path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        v{version || 'dev'}
      </div>
    </aside>
  );
}
