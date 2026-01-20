'use client';

// Force dynamic rendering to avoid SSR pre-rendering issues
export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminHealth } from '@/hooks/use-admin';
import { Activity, Database, Server, HardDrive, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminHealthPage() {
  const { data: health, isLoading, refetch } = useAdminHealth();
  const { toast } = useToast();

  const statusColors: Record<string, string> = {
    healthy: 'text-green-600 bg-green-100',
    degraded: 'text-yellow-600 bg-yellow-100',
    fail: 'text-red-600 bg-red-100',
  };

  const statusBgColors: Record<string, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    fail: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">Monitor system status and metrics</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Overall health of the system</CardDescription>
          </div>
          <div className={`px-4 py-2 rounded-full font-semibold capitalize ${statusColors[health?.status || 'healthy']}`}>
            {health?.status || 'Unknown'}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
          </div>
        </CardContent>
      </Card>

      {/* Component Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${
              health?.components?.database?.status === 'healthy' ? 'text-green-600' :
              health?.components?.database?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.database?.status || 'Unknown'}
            </div>
            {health?.components?.database?.details?.latency && (
              <p className="text-xs text-muted-foreground">
                Latency: {health.components.database.details.latency}ms
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${
              health?.components?.cache?.status === 'healthy' ? 'text-green-600' :
              health?.components?.cache?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.cache?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${
              health?.components?.providers?.status === 'healthy' ? 'text-green-600' :
              health?.components?.providers?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.providers?.status || 'Unknown'}
            </div>
            {health?.components?.providers?.details?.active_count !== undefined && (
              <p className="text-xs text-muted-foreground">
                {health.components.providers.details.active_count} active
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${
              health?.components?.storage?.status === 'healthy' ? 'text-green-600' :
              health?.components?.storage?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.storage?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
          <CardDescription>Current system metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">
                {health?.metrics?.uptime 
                  ? `${Math.floor(health.metrics.uptime / 60)}m ${Math.floor(health.metrics.uptime % 60)}s` 
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="text-2xl font-bold">
                {health?.metrics?.memory_usage 
                  ? `${health.metrics.memory_usage.toFixed(1)} MB` 
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold">{health?.metrics?.active_users || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Requests/min</p>
              <p className="text-2xl font-bold">{health?.metrics?.requests_per_minute || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
