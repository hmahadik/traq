import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Clock, History, CalendarDays, CalendarRange, MessageSquare } from 'lucide-react';

interface QuickPresetsProps {
  onGenerate: (timeRange: string, reportType: 'summary' | 'detailed' | 'standup') => void;
  isGenerating: boolean;
}

const QUICK_PRESETS = [
  {
    label: 'Today',
    timeRange: 'today',
    reportType: 'summary' as const,
    icon: Clock,
    description: 'Summary report',
  },
  {
    label: 'Yesterday',
    timeRange: 'yesterday',
    reportType: 'summary' as const,
    icon: History,
    description: 'Summary report',
  },
  {
    label: 'This Week',
    timeRange: 'this week',
    reportType: 'summary' as const,
    icon: CalendarDays,
    description: 'Summary report',
  },
  {
    label: 'Last Week',
    timeRange: 'last week',
    reportType: 'summary' as const,
    icon: CalendarRange,
    description: 'Summary report',
  },
  {
    label: 'Today',
    timeRange: 'today',
    reportType: 'standup' as const,
    icon: MessageSquare,
    description: 'Daily standup',
  },
  {
    label: 'Yesterday',
    timeRange: 'yesterday',
    reportType: 'standup' as const,
    icon: MessageSquare,
    description: 'Daily standup',
  },
];

export function QuickPresets({ onGenerate, isGenerating }: QuickPresetsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Reports
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Generate reports with one click
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={`${preset.timeRange}-${preset.reportType}`}
                variant="outline"
                size="sm"
                disabled={isGenerating}
                onClick={() => onGenerate(preset.timeRange, preset.reportType)}
                className="justify-start h-auto py-3 px-3"
              >
                <div className="flex items-start gap-2 w-full">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {preset.description}
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
