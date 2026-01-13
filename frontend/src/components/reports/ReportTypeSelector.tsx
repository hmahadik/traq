import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText, ListChecks, MessageSquare, Circle, CheckCircle2 } from 'lucide-react';

interface ReportTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const REPORT_TYPES = [
  { id: 'summary', name: 'Summary', description: 'High-level overview', icon: FileText },
  { id: 'detailed', name: 'Detailed', description: 'Full activity breakdown', icon: ListChecks },
  { id: 'standup', name: 'Standup', description: 'Brief daily format', icon: MessageSquare },
];

export function ReportTypeSelector({ value, onChange }: ReportTypeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Report Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.id;
          return (
            <button
              key={type.id}
              onClick={() => onChange(type.id)}
              className={cn(
                'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                isSelected
                  ? 'bg-accent'
                  : 'hover:bg-accent/50'
              )}
            >
              {isSelected ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{type.name}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
