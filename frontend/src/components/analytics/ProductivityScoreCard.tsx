import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Award, Info } from 'lucide-react';

interface ProductivityScore {
  score: number;
  productiveMinutes: number;
  neutralMinutes: number;
  distractingMinutes: number;
  totalMinutes: number;
  productivePercentage: number;
}

interface ProductivityScoreCardProps {
  score: ProductivityScore | undefined;
  isLoading: boolean;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

function getScoreColor(score: number): string {
  switch (score) {
    case 5:
      return 'text-emerald-500';
    case 4:
      return 'text-green-500';
    case 3:
      return 'text-yellow-500';
    case 2:
      return 'text-orange-500';
    case 1:
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

function getScoreLabel(score: number): string {
  switch (score) {
    case 5:
      return 'Excellent';
    case 4:
      return 'Good';
    case 3:
      return 'Fair';
    case 2:
      return 'Poor';
    case 1:
      return 'Very Poor';
    default:
      return 'N/A';
  }
}

function getScoreIcon(score: number) {
  if (score >= 4) {
    return <TrendingUp className="h-4 w-4" />;
  }
  if (score <= 2) {
    return <TrendingDown className="h-4 w-4" />;
  }
  return <Minus className="h-4 w-4" />;
}

export function ProductivityScoreCard({ score, isLoading }: ProductivityScoreCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!score || score.totalMinutes === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">N/A</div>
          <p className="text-xs text-muted-foreground mt-1">
            No activity tracked
          </p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = getScoreColor(score.score);
  const scoreLabel = getScoreLabel(score.score);
  const scoreIcon = getScoreIcon(score.score);

  return (
    <TooltipProvider>
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Score from 1-5 based on time spent in productive vs distracting applications. Calculated from window focus events and application usage patterns.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-baseline gap-2">
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {score.score}
          </div>
          <div className="text-sm text-muted-foreground">/ 5</div>
          <div className={`flex items-center gap-1 ml-2 ${scoreColor}`}>
            {scoreIcon}
            <span className="text-sm font-medium">{scoreLabel}</span>
          </div>
        </div>

        {/* Time Breakdown */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Time Breakdown</div>

          {/* Productive Time */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Productive</span>
            </div>
            <span className="font-medium text-green-500">
              {formatMinutes(score.productiveMinutes)}
            </span>
          </div>

          {/* Neutral Time */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-500" />
              <span>Neutral</span>
            </div>
            <span className="font-medium text-gray-500">
              {formatMinutes(score.neutralMinutes)}
            </span>
          </div>

          {/* Distracting Time */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Distracting</span>
            </div>
            <span className="font-medium text-red-500">
              {formatMinutes(score.distractingMinutes)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={score.productivePercentage} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {score.productivePercentage.toFixed(1)}% productive
          </div>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
