import { useState } from 'react';
import { toast } from 'sonner';
import { Briefcase, Loader2, Plug, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import {
  useConfig,
  useUpdateConfig,
  useProjectMappings,
  useSaveProjectMapping,
  useDeleteProjectMapping,
  useFFCustomers,
  useFFJobs,
  useFFTasks,
  useTestFFConnection,
  useProjects,
} from '@/api/hooks';
import type { storage } from '@wailsjs/go/models';

const ROUNDING_OPTIONS = [
  { value: '0.1', label: '0.1 hour (6 min)' },
  { value: '0.25', label: '0.25 hour (15 min)' },
  { value: '0.5', label: '0.5 hour (30 min)' },
  { value: '1', label: '1 hour' },
];

const AI_BACKENDS = [
  { value: 'inference', label: 'Local inference' },
  { value: 'claude', label: 'Claude Code (CLI)' },
  { value: 'opencode', label: 'OpenCode (CLI)' },
  { value: 'auto', label: 'Auto-detect CLI' },
];

export function FunctionFoxSettings() {
  const { data: config, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const { data: mappings } = useProjectMappings();
  const { data: traqProjects } = useProjects();
  const deleteMapping = useDeleteProjectMapping();
  const testConnection = useTestFFConnection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<storage.FunctionFoxProjectMapping | null>(null);

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const ts = config.timesheet ?? {
    hoursRounding: 0.25,
    ffAccountId: '',
    ffUsername: '',
    aiNotesEnabled: false,
    aiNotesBackend: 'auto',
  };

  const updateTs = (patch: Partial<typeof ts>) => {
    updateConfig.mutate({
      timesheet: { ...ts, ...patch },
    });
  };

  const openNewMapping = () => {
    setEditingMapping(null);
    setDialogOpen(true);
  };

  const openEditMapping = (m: storage.FunctionFoxProjectMapping) => {
    setEditingMapping(m);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <SettingsCard
        title="FunctionFox Connection"
        description="Credentials for pushing timesheet entries (Plan B preview only — push is disabled)"
      >
        <SettingsRow label="Account ID" description="FunctionFox sub-domain or account identifier">
          <Input
            className="w-56"
            value={ts.ffAccountId}
            placeholder="e.g. acme"
            onChange={(e) => updateTs({ ffAccountId: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow label="Username" description="Your FunctionFox login email">
          <Input
            className="w-56"
            type="email"
            value={ts.ffUsername}
            placeholder="you@example.com"
            onChange={(e) => updateTs({ ffUsername: e.target.value })}
          />
        </SettingsRow>
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending}
          >
            {testConnection.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
            Test Connection
          </Button>
          <span className="text-xs text-muted-foreground">
            Plan B uses a stub — connection always succeeds. Plan C wires real auth.
          </span>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Timesheet Defaults"
        description="How Traq rounds and labels per-project hours"
      >
        <SettingsRow
          label="Hours Rounding"
          description="Round each per-project, per-day total to the nearest multiple"
        >
          <Select
            value={String(ts.hoursRounding ?? 0.25)}
            onValueChange={(value) => updateTs({ hoursRounding: parseFloat(value) })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUNDING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="AI-generated Notes"
          description="Use a local AI agent (Claude/OpenCode CLI) to write timesheet notes"
        >
          <Switch
            checked={ts.aiNotesEnabled}
            onCheckedChange={(checked) => updateTs({ aiNotesEnabled: checked })}
          />
        </SettingsRow>

        {ts.aiNotesEnabled && (
          <SettingsRow label="AI Backend" description="Which CLI to invoke for note generation">
            <Select
              value={ts.aiNotesBackend || 'auto'}
              onValueChange={(value) => updateTs({ aiNotesBackend: value })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_BACKENDS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        )}

        <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            With AI notes off, entries arrive with empty notes — fill them in the preview
            table. With AI notes on, the chosen CLI writes a one-paragraph entry per
            (project, date) using your tracked window/git activity. Output is cached so
            re-rendering doesn't re-spend tokens.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Project Mappings"
        description="Map Traq projects to FunctionFox client/job/task triples"
        action={
          <Button size="sm" onClick={openNewMapping}>
            <Plus className="h-4 w-4 mr-1" />
            Add Mapping
          </Button>
        }
      >
        {!mappings || mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No mappings yet. Add one for each Traq project you want to push.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mappings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => openEditMapping(m)}
                  data-testid="mapping-row"
                >
                  <div className="font-medium text-sm">{m.traqProject}</div>
                  <div className="text-xs text-muted-foreground">
                    → {m.ffClientName} · {m.ffJobName} · {m.ffTaskName}
                    {!m.enabled && <span className="ml-2 text-amber-500">(disabled)</span>}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    deleteMapping.mutate(m.traqProject, {
                      onSuccess: () => toast.success(`Removed mapping for ${m.traqProject}`),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <span className="hidden" />
          </DialogTrigger>
          <MappingDialog
            key={editingMapping?.id ?? 'new'}
            initial={editingMapping}
            traqProjectChoices={(traqProjects ?? []).map((p) => p.name)}
            onClose={() => setDialogOpen(false)}
          />
        </Dialog>
      </SettingsCard>
    </div>
  );
}

interface MappingDialogProps {
  initial: storage.FunctionFoxProjectMapping | null;
  traqProjectChoices: string[];
  onClose: () => void;
}

function MappingDialog({ initial, traqProjectChoices, onClose }: MappingDialogProps) {
  const save = useSaveProjectMapping();
  const [traqProject, setTraqProject] = useState(initial?.traqProject ?? '');
  const [customerID, setCustomerID] = useState(initial?.ffClientId ?? '');
  const [jobID, setJobID] = useState(initial?.ffJobId ?? '');
  const [taskID, setTaskID] = useState(initial?.ffTaskId ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const { data: customers } = useFFCustomers(true);
  const { data: jobs } = useFFJobs(customerID);
  const { data: tasks } = useFFTasks(customerID, jobID);

  const customer = customers?.find((c) => c.ID === customerID);
  const job = jobs?.find((j) => j.ID === jobID);
  const task = tasks?.find((t) => t.ID === taskID);

  const handleSave = async () => {
    if (!traqProject || !customer || !job || !task) {
      toast.error('All fields required');
      return;
    }
    await save.mutateAsync({
      id: initial?.id ?? 0,
      traqProject,
      ffClientId: customer.ID,
      ffClientName: customer.Name,
      ffJobId: job.ID,
      ffJobName: job.Name,
      ffTaskId: task.ID,
      ffTaskName: task.Name,
      enabled,
      createdAt: initial?.createdAt ?? 0,
      updatedAt: initial?.updatedAt ?? 0,
    } as storage.FunctionFoxProjectMapping);
    toast.success(`Saved mapping for ${traqProject}`);
    onClose();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initial ? 'Edit Mapping' : 'New Project Mapping'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Traq Project</label>
          {traqProjectChoices.length > 0 ? (
            <Select value={traqProject} onValueChange={setTraqProject} disabled={!!initial}>
              <SelectTrigger>
                <SelectValue placeholder="Select Traq project" />
              </SelectTrigger>
              <SelectContent>
                {traqProjectChoices.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={traqProject}
              onChange={(e) => setTraqProject(e.target.value)}
              placeholder="Project name (must match Traq detected name)"
              disabled={!!initial}
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">FunctionFox Client</label>
          <Select value={customerID} onValueChange={(v) => { setCustomerID(v); setJobID(''); setTaskID(''); }}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {customers?.map((c) => (
                <SelectItem key={c.ID} value={c.ID}>{c.Name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">FunctionFox Job</label>
          <Select value={jobID} onValueChange={(v) => { setJobID(v); setTaskID(''); }} disabled={!customerID}>
            <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
            <SelectContent>
              {jobs?.map((j) => (
                <SelectItem key={j.ID} value={j.ID}>{j.Name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">FunctionFox Task</label>
          <Select value={taskID} onValueChange={setTaskID} disabled={!jobID}>
            <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
            <SelectContent>
              {tasks?.map((t) => (
                <SelectItem key={t.ID} value={t.ID}>{t.Name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="mapping-enabled" />
          <label htmlFor="mapping-enabled" className="text-sm cursor-pointer">
            Enabled (push entries for this mapping)
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
