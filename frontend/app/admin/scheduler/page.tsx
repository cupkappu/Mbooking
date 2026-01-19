'use client';


import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock, Play, Pause, RefreshCw, Calendar, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { 
  useSchedulerConfig, 
  useUpdateSchedulerConfig, 
  useTriggerManualFetch,
  useSchedulerHistory,
  SchedulerConfig 
} from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminSchedulerPage() {
  const [isFetching, setIsFetching] = useState(false);
  
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useSchedulerConfig();
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useSchedulerHistory();
  
  const updateConfig = useUpdateSchedulerConfig();
  const triggerFetch = useTriggerManualFetch();
  const { toast } = useToast();

  const config = configData;
  const history = historyData || [];

  const [editForm, setEditForm] = useState<Partial<SchedulerConfig>>({
    enabled: true,
    interval: 3600,
    base_currency: 'USD',
    providers: [],
    currencies: [],
  });

  useState(() => {
    if (config) {
      setEditForm({
        enabled: config.enabled,
        interval: config.interval,
        base_currency: config.base_currency,
        providers: config.providers || [],
        currencies: config.currencies || [],
      });
    }
  });

  const handleToggleScheduler = async () => {
    try {
      await updateConfig.mutateAsync({ enabled: !editForm.enabled });
      toast({ 
        title: 'Scheduler ' + (!editForm.enabled ? 'enabled' : 'disabled'),
        description: !editForm.enabled 
          ? 'Rate fetching will run according to the schedule' 
          : 'Rate fetching has been paused'
      });
      refetchConfig();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfig.mutateAsync(editForm);
      toast({ title: 'Configuration saved successfully' });
      refetchConfig();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleManualFetch = async () => {
    try {
      setIsFetching(true);
      const result = await triggerFetch.mutateAsync({});
      toast({ 
        title: 'Manual fetch initiated',
        description: `Job ID: ${result.job_id}`
      });
      setTimeout(() => {
        refetchHistory();
        setIsFetching(false);
      }, 2000);
    } catch (error: any) {
      setIsFetching(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const intervalOptions = [
    { value: 900, label: '15 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 7200, label: '2 hours' },
    { value: 21600, label: '6 hours' },
    { value: 43200, label: '12 hours' },
    { value: 86400, label: '24 hours' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduler</h1>
          <p className="text-muted-foreground">Configure automatic rate fetching schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleManualFetch}
            disabled={isFetching || triggerFetch.isPending}
            variant="outline"
          >
            {isFetching || triggerFetch.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Fetching...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Fetch Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduler Status
          </CardTitle>
          <CardDescription>Current scheduler state and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${editForm.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                {editForm.enabled ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <span className="font-medium">
                  {editForm.enabled ? 'Scheduler Active' : 'Scheduler Paused'}
                </span>
              </div>
              {config && (
                <div className="text-sm text-muted-foreground">
                  Next run: {new Date(Date.now() + (config.interval || 3600) * 1000).toLocaleString()}
                </div>
              )}
            </div>
            <Switch
              checked={editForm.enabled || false}
              onCheckedChange={handleToggleScheduler}
            />
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Rate fetching schedule settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Fetch Interval</Label>
              <Select 
                value={editForm.interval?.toString()} 
                onValueChange={(value) => setEditForm({ ...editForm, interval: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often to fetch new exchange rates
              </p>
            </div>

            <div className="space-y-2">
              <Label>Base Currency</Label>
              <Input
                value={editForm.base_currency || ''}
                onChange={(e) => setEditForm({ ...editForm, base_currency: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">
                The base currency for rate calculations
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Currencies to Track</Label>
            <Input
              value={(editForm.currencies || []).join(', ')}
              onChange={(e) => setEditForm({ 
                ...editForm, 
                currencies: e.target.value.split(',').map(c => c.trim()).filter(Boolean) 
              })}
              placeholder="USD, EUR, GBP, JPY, CNY"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of currency codes to fetch rates for
            </p>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveConfig}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Execution History
          </CardTitle>
          <CardDescription>Recent rate fetching jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Executed At</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No execution history yet</p>
                      <p className="text-sm text-muted-foreground">
                        Click "Fetch Now" to trigger a manual rate fetch
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                    <TableCell>{job.provider || '-'}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      {job.executed_at ? new Date(job.executed_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>{job.duration ? `${job.duration}ms` : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
