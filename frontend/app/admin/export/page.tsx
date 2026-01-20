'use client';

// Force dynamic rendering to avoid SSR pre-rendering issues
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Database, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { useDataExport } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminExportPage() {
  const [scope, setScope] = useState('full');
  const [format, setFormat] = useState('json');
  const [isExporting, setIsExporting] = useState(false);

  const dataExport = useDataExport();
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const result = await dataExport.mutateAsync({ scope, format });
      
      if (format === 'json') {
        // Download JSON file
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${scope}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({ title: 'Export completed', description: 'JSON file downloaded successfully' });
      } else {
        toast({ 
          title: 'Export initiated', 
          description: `Exporting ${scope} data as ${format.toUpperCase()}`,
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'Export failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      value: 'full',
      label: 'Full Export',
      description: 'All accounts, journal entries, currencies, rates, and budgets',
      icon: Database,
    },
    {
      value: 'accounts',
      label: 'Accounts Only',
      description: 'Complete account hierarchy and balances',
      icon: FileText,
    },
    {
      value: 'journal',
      label: 'Journal Entries',
      description: 'All journal entries and line items',
      icon: FileText,
    },
    {
      value: 'rates',
      label: 'Exchange Rates',
      description: 'All exchange rate history',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Export</h1>
        <p className="text-muted-foreground">Export your accounting data for backup or migration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
          <CardDescription>Select what data to export and the format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Export Scope</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        scope === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setScope(option.value)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      <span>JSON</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>CSV (coming soon)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sql">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span>SQL (coming soon)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleExport} 
              disabled={isExporting || dataExport.isPending}
              size="lg"
            >
              {isExporting || dataExport.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>Recent exports and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No export history yet</p>
            <p className="text-sm">Your exported files will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
