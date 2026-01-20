'use client';

// Force dynamic rendering to avoid SSR pre-rendering issues
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
  const { data, isLoading, refetch } = useSystemConfig();
  const updateConfig = useUpdateSystemConfig();
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    default_currency: 'USD',
    fiat_decimals: 2,
    crypto_decimals: 8,
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    session_timeout: 3600,
    mfa_required: false,
  });

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(form);
      toast({ title: 'Settings saved successfully' });
      refetch();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currency Settings</CardTitle>
          <CardDescription>Default currency and decimal places</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fiat Decimals</Label>
              <Input type="number" value={form.fiat_decimals} onChange={(e) => setForm({ ...form, fiat_decimals: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Crypto Decimals</Label>
              <Input type="number" value={form.crypto_decimals} onChange={(e) => setForm({ ...form, crypto_decimals: parseInt(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localization</CardTitle>
          <CardDescription>Timezone and date format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Input value={form.date_format} onChange={(e) => setForm({ ...form, date_format: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Session and authentication settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Session Timeout (seconds)</Label>
            <Input type="number" value={form.session_timeout} onChange={(e) => setForm({ ...form, session_timeout: parseInt(e.target.value) })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateConfig.isPending}>
        {updateConfig.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
