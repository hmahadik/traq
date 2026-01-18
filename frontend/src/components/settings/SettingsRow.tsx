import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  vertical?: boolean;
}

export function SettingsRow({ label, description, children, className, vertical = false }: SettingsRowProps) {
  if (vertical) {
    return (
      <div className={cn('space-y-2', className)}>
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex-1 min-w-0">
        <label className="text-sm font-medium">{label}</label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}
