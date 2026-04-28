import { useEffect, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { service } from '@wailsjs/go/models';

interface TimesheetPreviewProps {
  data: service.TimesheetData | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onGenerate: () => void;
}

type Entry = service.TimesheetEntry;

export function TimesheetPreview({ data, isLoading, isError, error, onGenerate }: TimesheetPreviewProps) {
  // Local editable copy of entries — notes + skipped are user-editable.
  // Resets whenever a fresh `data` prop arrives.
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (data?.entries) {
      setEntries(data.entries.map((e) => ({ ...e })));
    } else {
      setEntries([]);
    }
  }, [data]);

  const updateEntry = (idx: number, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.skipped ? 0 : e.hours), 0);
  const includedCount = entries.filter((e) => !e.skipped).length;
  const unattributedHours = entries
    .filter((e) => e.skipReason === 'unattributed')
    .reduce((sum, e) => sum + e.hours, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          Timesheet Preview
          {data && (
            <span className="text-xs text-muted-foreground font-normal">
              {data.start} → {data.end} · {includedCount} entries · {totalHours.toFixed(2)}h
            </span>
          )}
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapping span ensures tooltip works on a disabled button */}
              <span tabIndex={0}>
                <Button size="sm" disabled>
                  <Send className="mr-2 h-4 w-4" />
                  Push to FunctionFox
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Connect FunctionFox in Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Building timesheet...
          </div>
        ) : isError ? (
          <div className="p-6 text-sm text-destructive">
            Failed to generate timesheet: {error instanceof Error ? error.message : String(error)}
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            <p className="text-sm">Select a date range and click Generate.</p>
            <Button size="sm" variant="outline" onClick={onGenerate}>
              Generate Timesheet
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No tracked project time in this range.
          </div>
        ) : (
          <>
            {unattributedHours > 0 && (
              <div className="m-4 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{unattributedHours.toFixed(2)}h unattributed</p>
                  <p className="text-muted-foreground text-xs">
                    Activity that isn't assigned to any Traq project. Assign these in the
                    Projects page (or add rules) so they bucket under the right client next time.
                  </p>
                </div>
              </div>
            )}
            {data.unmappedProjects && data.unmappedProjects.length > 0 && (
              <div className="m-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Unmapped projects</p>
                  <p className="text-muted-foreground text-xs">
                    These projects have time but no FunctionFox mapping — entries are skipped:{' '}
                    <span className="font-mono">{data.unmappedProjects.join(', ')}</span>
                  </p>
                </div>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-xs text-muted-foreground text-left">
                  <th className="px-3 py-2 w-8">Push</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">FF Mapping</th>
                  <th className="px-3 py-2 w-20 text-right">Hours</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const dimmed = e.skipped;
                  return (
                    <tr
                      key={`${e.date}|${e.traqProject}`}
                      className={`border-b align-top ${dimmed ? 'opacity-50' : ''}`}
                      data-testid="timesheet-row"
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={!e.skipped}
                          disabled={e.skipReason === 'unmapped' || e.skipReason === 'unattributed'}
                          onCheckedChange={(checked) =>
                            updateEntry(i, {
                              skipped: !checked,
                              skipReason: checked ? '' : 'user-skipped',
                            })
                          }
                          aria-label={`Include ${e.traqProject} on ${e.date}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{e.date}</td>
                      <td className="px-3 py-2 font-medium">{e.traqProject}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.skipReason === 'unattributed' ? (
                          <span className="text-orange-500">no project</span>
                        ) : e.ffClientName ? (
                          <div>
                            <div>{e.ffClientName}</div>
                            <div className="text-muted-foreground">
                              {e.ffJobName} · {e.ffTaskName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-500">unmapped</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{e.hours.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <Textarea
                          value={e.notes}
                          onChange={(ev) => updateEntry(i, { notes: ev.target.value })}
                          placeholder="Notes..."
                          className="min-h-[40px] text-xs resize-y"
                          rows={2}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
