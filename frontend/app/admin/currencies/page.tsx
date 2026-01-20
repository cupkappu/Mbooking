'use client';

// Force dynamic rendering to avoid SSR pre-rendering issues
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAdminCurrencies,
  useCreateCurrency,
  useUpdateCurrency,
  useDeleteCurrency,
  useSeedCurrencies,
  AdminCurrency,
} from '@/hooks/use-currencies';
import { Plus, Search, RefreshCw, Trash2, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminCurrenciesPage() {
  const [search, setSearch] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    symbol: '',
    decimal_places: '2',
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<AdminCurrency | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    symbol: '',
    decimal_places: '2',
    is_active: true,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currencyToDelete, setCurrencyToDelete] = useState<AdminCurrency | null>(null);

  const { data, isLoading, refetch } = useAdminCurrencies();
  const createCurrency = useCreateCurrency();
  const updateCurrency = useUpdateCurrency();
  const deleteCurrency = useDeleteCurrency();
  const seedCurrencies = useSeedCurrencies();
  const { toast } = useToast();

  const handleCreateCurrency = async () => {
    try {
      await createCurrency.mutateAsync({
        code: createForm.code.toUpperCase(),
        name: createForm.name,
        symbol: createForm.symbol,
        decimal_places: parseInt(createForm.decimal_places, 10),
      });

      toast({ title: 'Currency created successfully' });
      setShowCreateDialog(false);
      setCreateForm({ code: '', name: '', symbol: '', decimal_places: '2' });
      refetch();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateCurrency = async () => {
    if (!selectedCurrency) return;

    try {
      await updateCurrency.mutateAsync({
        code: selectedCurrency.code,
        data: {
          name: editForm.name,
          symbol: editForm.symbol,
          decimal_places: parseInt(editForm.decimal_places, 10),
          is_active: editForm.is_active,
        },
      });

      toast({ title: 'Currency updated successfully' });
      setShowEditDialog(false);
      refetch();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCurrency = async () => {
    if (!currencyToDelete) return;

    try {
      await deleteCurrency.mutateAsync(currencyToDelete.code);
      toast({ title: 'Currency deleted successfully' });
      setShowDeleteDialog(false);
      setCurrencyToDelete(null);
      refetch();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSeedCurrencies = async () => {
    try {
      const result = await seedCurrencies.mutateAsync();
      toast({
        title: 'Currencies seeded successfully',
        description: `Added ${result.added} currencies, skipped ${result.skipped}`,
      });
      refetch();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (currency: AdminCurrency) => {
    setSelectedCurrency(currency);
    setEditForm({
      name: currency.name,
      symbol: currency.symbol,
      decimal_places: String(currency.decimal_places),
      is_active: currency.is_active,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (currency: AdminCurrency) => {
    setCurrencyToDelete(currency);
    setShowDeleteDialog(true);
  };

  const filteredCurrencies = data?.filter((currency) =>
    currency.code.toLowerCase().includes(search.toLowerCase()) ||
    currency.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Currency Management</h1>
          <p className="text-muted-foreground">Manage system currencies and exchange rates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSeedCurrencies} disabled={seedCurrencies.isPending}>
            <Database className="h-4 w-4 mr-2" />
            {seedCurrencies.isPending ? 'Seeding...' : 'Seed Default Currencies'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Currency
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currencies</CardTitle>
          <CardDescription>Total {data?.length || 0} currencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search currencies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Decimal Places</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredCurrencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No currencies found</TableCell>
                </TableRow>
              ) : (
                filteredCurrencies.map((currency) => (
                  <TableRow key={currency.code}>
                    <TableCell className="font-medium">{currency.code}</TableCell>
                    <TableCell>{currency.name}</TableCell>
                    <TableCell>{currency.symbol}</TableCell>
                    <TableCell>{currency.decimal_places}</TableCell>
                    <TableCell>
                      <Badge variant={currency.is_active ? 'default' : 'secondary'}>
                        {currency.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(currency)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="delete-currency"
                          onClick={() => openDeleteDialog(currency)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Currency</DialogTitle>
            <DialogDescription>Add a new currency to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="US Dollar"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={createForm.symbol}
                onChange={(e) => setCreateForm({ ...createForm, symbol: e.target.value })}
                placeholder="$"
              />
            </div>
            <div className="space-y-2">
              <Label>Decimal Places</Label>
              <Select
                value={createForm.decimal_places}
                onValueChange={(value) => setCreateForm({ ...createForm, decimal_places: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 (Fiat currencies)</SelectItem>
                  <SelectItem value="8">8 (Cryptocurrencies)</SelectItem>
                  <SelectItem value="0">0 (No decimals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateCurrency}
              disabled={
                !createForm.code ||
                !createForm.name ||
                !createForm.symbol ||
                createCurrency.isPending
              }
            >
              {createCurrency.isPending ? 'Creating...' : 'Create Currency'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Currency</DialogTitle>
            <DialogDescription>Update currency information for {selectedCurrency?.code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={selectedCurrency?.code} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={editForm.symbol}
                onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Decimal Places</Label>
              <Select
                value={editForm.decimal_places}
                onValueChange={(value) => setEditForm({ ...editForm, decimal_places: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 (Fiat currencies)</SelectItem>
                  <SelectItem value="8">8 (Cryptocurrencies)</SelectItem>
                  <SelectItem value="0">0 (No decimals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.is_active.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, is_active: value === 'true' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateCurrency} disabled={updateCurrency.isPending}>
              {updateCurrency.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Currency</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{currencyToDelete?.code} - {currencyToDelete?.name}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCurrency}
              disabled={deleteCurrency.isPending}
            >
              {deleteCurrency.isPending ? 'Deleting...' : 'Delete Currency'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
