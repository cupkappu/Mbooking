'use client';


import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, RefreshCw, Play, AlertCircle, CheckCircle, XCircle, FileCode, Plus } from 'lucide-react';
import { useAdminPlugins, useUploadPlugin, useReloadPlugin, Plugin } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminPluginsPage() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({ filename: '', content: '' });
  const [reloadingPlugin, setReloadingPlugin] = useState<string | null>(null);

  const { data, isLoading, refetch } = useAdminPlugins();
  const uploadPlugin = useUploadPlugin();
  const reloadPlugin = useReloadPlugin();
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!uploadForm.filename || !uploadForm.content) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    try {
      await uploadPlugin.mutateAsync(uploadForm);
      toast({ title: 'Plugin uploaded successfully' });
      setShowUploadDialog(false);
      setUploadForm({ filename: '', content: '' });
      refetch();
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleReload = async (pluginId: string) => {
    try {
      setReloadingPlugin(pluginId);
      await reloadPlugin.mutateAsync(pluginId);
      toast({ title: 'Plugin reloaded successfully' });
      refetch();
    } catch (error: any) {
      toast({ title: 'Reload failed', description: error.message, variant: 'destructive' });
    } finally {
      setReloadingPlugin(null);
    }
  };

  const getStatusBadge = (status: Plugin['status']) => {
    switch (status) {
      case 'loaded':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Loaded</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Unloaded</Badge>;
    }
  };

  // Sample plugin template
  const samplePlugin = `/**
 * Exchange Rate Provider Plugin
 * 
 * This plugin fetches exchange rates from a custom source.
 * 
 * @plugin-name my-custom-provider
 * @plugin-version 1.0.0
 */

module.exports = {
  name: 'my-custom-provider',
  version: '1.0.0',
  description: 'Custom exchange rate provider',
  
  // Supported currency pairs
  supported_currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CNY'],
  
  // Fetch rates for given currency pairs
  async fetchRates(currencies, baseCurrency = 'USD') {
    // Your implementation here
    // Return rates in format: { 'USD/EUR': 0.85, 'USD/GBP': 0.73, ... }
    
    // Example:
    const rates = {};
    for (const currency of currencies) {
      if (currency !== baseCurrency) {
        rates[\`\${baseCurrency}/\${currency}\`] = Math.random() * 2 + 0.5;
      }
    }
    return rates;
  },
  
  // Optional: Validate configuration
  validateConfig(config) {
    if (!config.api_key) {
      throw new Error('API key is required');
    }
    return true;
  }
};`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugins</h1>
          <p className="text-muted-foreground">Manage JS plugin extensions for rate providers</p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Plugin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installed Plugins</CardTitle>
          <CardDescription>Custom JavaScript plugins for exchange rate providers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File Path</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : !data?.plugins || data.plugins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <FileCode className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No plugins installed</p>
                      <p className="text-sm text-muted-foreground">Upload a JS plugin to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.plugins.map((plugin) => (
                  <TableRow key={plugin.id}>
                    <TableCell className="font-medium">{plugin.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plugin.version}</Badge>
                    </TableCell>
                    <TableCell>{plugin.description}</TableCell>
                    <TableCell>{getStatusBadge(plugin.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{plugin.file_path}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReload(plugin.id)}
                        disabled={reloadingPlugin === plugin.id || plugin.status !== 'loaded'}
                      >
                        {reloadingPlugin === plugin.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plugin Development</CardTitle>
          <CardDescription>Learn how to create custom rate provider plugins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">Plugin Requirements</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Must export a CommonJS module</li>
              <li>• Must have <code>name</code>, <code>version</code>, and <code>description</code> properties</li>
              <li>• Must implement <code>fetchRates(currencies, baseCurrency)</code> method</li>
              <li>• Can optionally implement <code>validateConfig(config)</code> method</li>
              <li>• Must be placed in <code>backend/plugins/</code> directory</li>
            </ul>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">Sample Plugin Template</h4>
            <pre className="text-xs overflow-x-auto p-2 bg-background rounded border">
              {samplePlugin}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Plugin</DialogTitle>
            <DialogDescription>Upload a new JavaScript plugin for rate providers</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plugin Filename</Label>
              <Input
                value={uploadForm.filename}
                onChange={(e) => setUploadForm({ ...uploadForm, filename: e.target.value })}
                placeholder="my-provider.js"
              />
            </div>
            <div className="space-y-2">
              <Label>Plugin Code</Label>
              <textarea
                className="w-full h-64 p-3 rounded-lg border bg-background font-mono text-sm"
                value={uploadForm.content}
                onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                placeholder="// Paste your plugin code here..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setUploadForm({ filename: 'my-provider.js', content: samplePlugin });
            }}>
              Load Sample Template
            </Button>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleUpload} 
              disabled={!uploadForm.filename || !uploadForm.content || uploadPlugin.isPending}
            >
              {uploadPlugin.isPending ? 'Uploading...' : 'Upload Plugin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
