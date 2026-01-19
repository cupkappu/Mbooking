'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, Activity, Clock, FileText, Heart } from 'lucide-react';
import { useAdminHealth } from '@/hooks/use-admin';
import { useAdminUsers } from '@/hooks/use-admin';
import { useAdminProviders } from '@/hooks/use-admin';


export default function AdminDashboard() {
  const { data: health } = useAdminHealth();
  const { data: usersData } = useAdminUsers({ limit: 1 });
  const { data: providersData } = useAdminProviders({ limit: 1 });

  const statusColors = {
    healthy: 'text-green-600',
    degraded: 'text-yellow-600',
    fail: 'text-red-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and management</p>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Heart className={`h-4 w-4 ${statusColors[health?.status || 'healthy']}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">{health?.status || 'Unknown'}</div>
          <p className="text-xs text-muted-foreground">
            Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providersData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.metrics?.uptime 
                ? `${Math.floor(health.metrics.uptime / 60)}m` 
                : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.metrics?.memory_usage 
                ? `${health.metrics.memory_usage.toFixed(1)} MB` 
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold capitalize ${
              health?.components?.database?.status === 'healthy' ? 'text-green-600' :
              health?.components?.database?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.database?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cache</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold capitalize ${
              health?.components?.cache?.status === 'healthy' ? 'text-green-600' :
              health?.components?.cache?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.cache?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold capitalize ${
              health?.components?.providers?.status === 'healthy' ? 'text-green-600' :
              health?.components?.providers?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.providers?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold capitalize ${
              health?.components?.storage?.status === 'healthy' ? 'text-green-600' :
              health?.components?.storage?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {health?.components?.storage?.status || 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
