import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

type Confidence = 'high' | 'medium' | 'low' | null;

interface ConfidenceBadgeProps {
  confidence: Confidence;
  showIcon?: boolean;
  className?: string;
}

const CONFIDENCE_CONFIG = {
  high: {
    label: 'High Confidence',
    variant: 'default' as const,
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: CheckCircle,
  },
  medium: {
    label: 'Medium Confidence',
    variant: 'secondary' as const,
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    icon: AlertCircle,
  },
  low: {
    label: 'Low Confidence',
    variant: 'outline' as const,
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: HelpCircle,
  },
};

export function ConfidenceBadge({
  confidence,
  showIcon = true,
  className,
}: ConfidenceBadgeProps) {
  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('border', config.color, className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
