import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode; // Optional action element (e.g., button) in the header
}

export function SettingsCard({ title, description, children, className, action }: SettingsCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
