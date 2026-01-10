import { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MasterDetailLayoutProps {
  /** Content for the list/master panel */
  sidebar: ReactNode;
  /** Header content above the sidebar (optional) */
  sidebarHeader?: ReactNode;
  /** Content for the detail panel - usually an Outlet */
  children: ReactNode;
  /** Width of the sidebar */
  sidebarWidth?: string;
  /** Additional classes for the container */
  className?: string;
}

/**
 * A master-detail layout with a scrollable sidebar and main content area.
 * Similar to email clients or Slack.
 */
export function MasterDetailLayout({
  sidebar,
  sidebarHeader,
  children,
  sidebarWidth = 'w-80 lg:w-96',
  className,
}: MasterDetailLayoutProps) {
  return (
    <div className={cn('flex h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]', className)}>
      {/* Sidebar / List Panel */}
      <div className={cn('flex-shrink-0 border-r flex flex-col', sidebarWidth)}>
        {sidebarHeader && (
          <div className="flex-shrink-0 border-b">
            {sidebarHeader}
          </div>
        )}
        <ScrollArea className="flex-1">
          {sidebar}
        </ScrollArea>
      </div>

      {/* Main Content / Detail Panel */}
      <div className="flex-1 overflow-auto min-w-0">
        {children}
      </div>
    </div>
  );
}

/**
 * Empty state for when no item is selected
 */
interface EmptyDetailProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyDetail({ icon, title, description }: EmptyDetailProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      {icon && (
        <div className="mb-4 text-muted-foreground/50">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-semibold text-muted-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground/70 max-w-md">{description}</p>
      )}
    </div>
  );
}
