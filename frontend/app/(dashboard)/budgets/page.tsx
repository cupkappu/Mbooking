'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, AlertTriangle, DollarSign, TrendingDown } from 'lucide-react';
import { BudgetCard } from '@/components/budgets/budget-card/budget-card';
import { MultiCurrencySummary } from '@/components/budgets/multi-currency-summary/multi-currency-summary';
import { useBudgetsList } from '@/hooks/use-budgets';
import { useBudgetAlerts } from '@/hooks/use-budget-alerts';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Budget } from '@/types';

export default function BudgetListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch budgets list (non-paginated for client-side filtering)
  const { data: budgetsResponse, isLoading: isLoadingBudgets } = useBudgetsList();
  const budgets = budgetsResponse || [];

  // Fetch alerts
  const { data: alertsResponse } = useBudgetAlerts({ status: 'pending' });
  const alerts = alertsResponse?.data || [];

  // Calculate status based on percentage used
  const getBudgetStatus = (budget: Budget): 'normal' | 'warning' | 'exceeded' | 'archived' => {
    const percentage = budget.amount > 0 ? (Number(budget.spent_amount) / Number(budget.amount)) * 100 : 0;

    if (budget.status === 'archived' || !budget.is_active) {
      return 'archived';
    }
    if (percentage >= 100) {
      return 'exceeded';
    }
    if (percentage >= 80) {
      return 'warning';
    }
    return 'normal';
  };

  // Filter budgets
  const filteredBudgets = budgets.filter(budget => {
    // Search filter
    if (searchQuery && !budget.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Type filter
    if (typeFilter !== 'all' && budget.type !== typeFilter) {
      return false;
    }
    // Status filter
    if (statusFilter !== 'all') {
      const currentStatus = getBudgetStatus(budget);
      if (currentStatus !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Calculate summary stats
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent_amount), 0);
  const totalRemaining = totalBudget - totalSpent;

  const pendingAlertCount = alerts.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">预算</h1>
          <p className="text-muted-foreground">管理并监控您的预算</p>
        </div>
        <Link
          href="/budgets/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建预算
        </Link>
      </div>

      {/* Alert Banner */}
      {pendingAlertCount > 0 && (
        <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-yellow-800 dark:text-yellow-200">
            您有 {pendingAlertCount} 个待处理预算告警
          </span>
          <Link href="/budgets/alerts" className="text-yellow-700 dark:text-yellow-300 underline ml-auto hover:no-underline">
            查看全部
          </Link>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总预算</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('zh-CN', {
                    style: 'currency',
                    currency: 'CNY',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(totalBudget)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已使用</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {new Intl.NumberFormat('zh-CN', {
                    style: 'currency',
                    currency: 'CNY',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(totalSpent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalRemaining >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                <DollarSign className={`w-5 h-5 ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">剩余</p>
                <p className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {new Intl.NumberFormat('zh-CN', {
                    style: 'currency',
                    currency: 'CNY',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(totalRemaining)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Currency Summary */}
      <MultiCurrencySummary />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索预算..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="periodic">周期性</SelectItem>
            <SelectItem value="non_periodic">非周期性</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="normal">正常</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="exceeded">超支</SelectItem>
            <SelectItem value="archived">已归档</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">
          共 {filteredBudgets.length} 个预算
        </div>
      </div>

      {/* Budget Cards Grid */}
      {isLoadingBudgets ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : filteredBudgets.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">暂无预算</p>
          <Link
            href="/budgets/new"
            className="text-primary hover:underline inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建第一个预算
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBudgets.map(budget => {
            const budgetAlerts = alerts.filter(a => a.budget_id === budget.id);
            return (
              <BudgetCard
                key={budget.id}
                budget={budget}
                pendingAlerts={budgetAlerts.length}
                onClick={() => {
                  // Navigate to budget detail
                  window.location.href = `/budgets/${budget.id}`;
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
