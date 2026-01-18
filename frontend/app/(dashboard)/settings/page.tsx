'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { currenciesApi } from '@/lib/currencies';
import { tenantsApi } from '@/lib/tenants';
import type { Currency } from '@/types/currency';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'currencies' | 'providers'>('general');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [newCurrency, setNewCurrency] = useState({
    code: '',
    name: '',
    symbol: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    symbol: '',
    is_active: true,
    is_default: false,
  });
  const [defaultCurrency, setDefaultCurrency] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('UTC');
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current tenant settings
  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsApi.getCurrent(),
    enabled: !!session,
  });

  // Set default values when tenant data loads
  useEffect(() => {
    if (tenant?.settings?.default_currency) {
      setDefaultCurrency(tenant.settings.default_currency);
    }
    if (tenant?.settings?.timezone) {
      setTimezone(tenant.settings.timezone);
    }
  }, [tenant]);

  // Mutation for updating tenant settings
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { default_currency?: string; timezone?: string }) => 
      tenantsApi.updateSettings(settings),
    onSuccess: (updatedTenant) => {
      queryClient.setQueryData(['tenant', 'current'], updatedTenant);
      toast({
        title: 'Settings saved successfully',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving settings',
        description: error.message || 'An error occurred while saving settings',
        variant: 'destructive',
      });
    },
  });

  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      const data = await currenciesApi.getAll();
      setCurrencies(data);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'currencies' || activeTab === 'general') && currencies.length === 0) {
      fetchCurrencies();
    }
  }, [activeTab, currencies.length]);

  const handleAddCurrency = async () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol) return;
    
    try {
      await currenciesApi.create(newCurrency);
      setNewCurrency({ code: '', name: '', symbol: '' });
      await fetchCurrencies();
    } catch (error) {
      console.error('Failed to add currency:', error);
    }
  };

  const handleDeleteCurrency = async (id: string) => {
    if (!confirm('Are you sure you want to delete this currency?')) return;
    
    try {
      await currenciesApi.delete(id);
      await fetchCurrencies();
    } catch (error) {
      console.error('Failed to delete currency:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await currenciesApi.setDefault(id);
      await fetchCurrencies();
    } catch (error) {
      console.error('Failed to set default currency:', error);
    }
  };

  const startEditing = (currency: Currency) => {
    setEditingCurrency(currency.id);
    setEditForm({
      name: currency.name,
      symbol: currency.symbol,
      is_active: currency.is_active,
      is_default: currency.is_default,
    });
  };

  const cancelEditing = () => {
    setEditingCurrency(null);
    setEditForm({ name: '', symbol: '', is_active: true, is_default: false });
  };

  const saveEdit = async (id: string) => {
    try {
      await currenciesApi.update(id, editForm);
      cancelEditing();
      await fetchCurrencies();
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'currencies', label: 'Currencies' },
    { id: 'providers', label: 'Rate Providers' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="flex gap-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

       {activeTab === 'general' && (
         <Card>
           <CardHeader>
             <CardTitle>General Settings</CardTitle>
             <CardDescription>Configure your general account preferences</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="default-currency">Default Currency</Label>
               <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                 <SelectTrigger id="default-currency">
                   <SelectValue placeholder="Select currency" />
                 </SelectTrigger>
                 <SelectContent>
                   {currencies.map((currency) => (
                     <SelectItem key={currency.id} value={currency.code}>
                       {currency.code} - {currency.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="space-y-2">
               <Label htmlFor="timezone">Timezone</Label>
               <Select value={timezone} onValueChange={setTimezone}>
                 <SelectTrigger id="timezone">
                   <SelectValue placeholder="Select timezone" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="UTC">UTC</SelectItem>
                   <SelectItem value="Asia/Hong_Kong">Asia/Hong_Kong</SelectItem>
                   <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                   <SelectItem value="America/New_York">America/New_York</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             <Button 
               onClick={() => {
                 updateSettingsMutation.mutate({
                   default_currency: defaultCurrency,
                   timezone: timezone,
                 });
               }}
               disabled={updateSettingsMutation.isPending}
             >
               {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
             </Button>
           </CardContent>
         </Card>
       )}

      {activeTab === 'currencies' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Currency</CardTitle>
              <CardDescription>Add a new currency to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency-code">Code</Label>
                  <Input
                    id="currency-code"
                    placeholder="USD"
                    value={newCurrency.code}
                    onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency-name">Name</Label>
                  <Input
                    id="currency-name"
                    placeholder="US Dollar"
                    value={newCurrency.name}
                    onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency-symbol">Symbol</Label>
                  <Input
                    id="currency-symbol"
                    placeholder="$"
                    value={newCurrency.symbol}
                    onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddCurrency} disabled={!newCurrency.code || !newCurrency.name || !newCurrency.symbol}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Currency
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Currency Management</CardTitle>
              <CardDescription>View and manage your currencies</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.id}>
                      {editingCurrency === currency.id ? (
                        <>
                          <TableCell className="font-medium">{currency.code}</TableCell>
                          <TableCell>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.symbol}
                              onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editForm.is_active ? 'active' : 'inactive'}
                              onValueChange={(value) => setEditForm({ ...editForm, is_active: value === 'active' })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={editForm.is_default ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setEditForm({ ...editForm, is_default: !editForm.is_default })}
                            >
                              {editForm.is_default ? 'Default' : 'Set'}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => saveEdit(currency.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEditing}>
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{currency.code}</TableCell>
                          <TableCell>{currency.name}</TableCell>
                          <TableCell>{currency.symbol}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              currency.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {currency.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {currency.is_default && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Default
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!currency.is_default && (
                              <Button variant="ghost" size="sm" onClick={() => handleSetDefault(currency.id)}>
                                Set Default
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => startEditing(currency)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCurrency(currency.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {currencies.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No currencies found. Add a currency above to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'providers' && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Providers</CardTitle>
            <CardDescription>Configure exchange rate providers for currency conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Default Provider</h3>
                    <p className="text-sm text-muted-foreground">Built-in exchange rate data</p>
                  </div>
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>
                </div>
              </div>

              <Button variant="outline" className="w-full border-dashed">
                <Plus className="w-4 h-4 mr-2" />
                Add Rate Provider
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
