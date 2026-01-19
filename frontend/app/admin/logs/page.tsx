'use client';


import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditLogs, useExportAuditLogs, AuditLog } from '@/hooks/use-admin';
import { RefreshCw, Download, Filter } from 'lucide-react';

export default function AdminLogsPage() {
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    entity_type: '',
    date_from: '',
    date_to: '',
  });
  const [offset, setOffset] = useState(0);
  
  const { data, isLoading, refetch } = useAuditLogs({
    offset,
    limit: 50,
    ...filters,
  });
  
  const exportLogs = useExportAuditLogs();

  const handleExport = async () => {
    try {
      const csv = await exportLogs.mutateAsync(filters);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">View system activity logs</p>
        </div>
        <Button onClick={handleExport} disabled={exportLogs.isPending}>
          <Download className="h-4 w-4 mr-2" />
          {exportLogs.isPending ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Filter by user"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Input
                placeholder="Filter by action"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Input
                placeholder="e.g., user, journal"
                value={filters.entity_type}
                onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Total {data?.total || 0} log entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : !data?.logs.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No logs found</TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.user_id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip_address || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data && data.total > 50 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - 50))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Showing {offset + 1} - {Math.min(offset + 50, data.total)} of {data.total}
              </span>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + 50)}
                disabled={offset + 50 >= data.total}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
