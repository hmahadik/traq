import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText, ListChecks, MessageSquare } from 'lucide-react';

interface ReportTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const REPORT_TYPES = [
  {
    id: 'summary',
    name: 'Summary',
    description: 'High-level overview of your activity',
    icon: FileText,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'In-depth breakdown with all activities',
    icon: ListChecks,
  },
  {
    id: 'standup',
    name: 'Standup',
    description: 'Brief format for daily standups',
    icon: MessageSquare,
  },
];

export function ReportTypeSelector({ value, onChange }: ReportTypeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Report Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {REPORT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = value === type.id;
            return (
              <button
                key={type.id}
                onClick={() => onChange(type.id)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:bg-accent hover:border-accent-foreground/20'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-md',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{type.name}</p>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
