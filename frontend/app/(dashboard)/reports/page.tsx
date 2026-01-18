'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { RefreshCw, FileText, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'balance-sheet' | 'income-statement' | 'cash-flow'>('balance-sheet');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/reports/balance-sheet?as_of_date=${dateRange.to}`);
      setBalanceSheet(data);
    } catch (error) {
      console.error('Failed to fetch balance sheet:', error);
    }
    setLoading(false);
  };

  const fetchIncomeStatement = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(
        `/reports/income-statement?from_date=${dateRange.from}&to_date=${dateRange.to}`
      );
      setIncomeStatement(data);
    } catch (error) {
      console.error('Failed to fetch income statement:', error);
    }
    setLoading(false);
  };

  const handleTabChange = (tab: 'balance-sheet' | 'income-statement') => {
    setActiveTab(tab);
    if (tab === 'balance-sheet' && !balanceSheet) {
      fetchBalanceSheet();
    } else if (tab === 'income-statement' && !incomeStatement) {
      fetchIncomeStatement();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">View your financial statements</p>
      </div>

      <div className="flex gap-4 border-b">
        <button
          onClick={() => handleTabChange('balance-sheet')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'balance-sheet'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          Balance Sheet
        </button>
        <button
          onClick={() => handleTabChange('income-statement')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'income-statement'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Income Statement
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <Input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-40"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <Input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-40"
          />
        </div>
        <Button
          onClick={activeTab === 'balance-sheet' ? fetchBalanceSheet : fetchIncomeStatement}
          disabled={loading}
          className="mt-5"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {activeTab === 'balance-sheet' && balanceSheet && (
        <Card>
          <CardHeader>
            <CardTitle>{balanceSheet.title}</CardTitle>
            <CardDescription>As of {balanceSheet.as_of_date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Assets
                </h3>
                {balanceSheet.sections?.assets?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1 text-sm">
                    <span className="ml-4 text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2">
                  <span>Total Assets</span>
                  <span className="text-green-600">{formatCurrency(balanceSheet.totals?.assets)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Liabilities
                </h3>
                {balanceSheet.sections?.liabilities?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1 text-sm">
                    <span className="ml-4 text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2">
                  <span>Total Liabilities</span>
                  <span className="text-red-600">{formatCurrency(balanceSheet.totals?.liabilities)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Equity
                </h3>
                {balanceSheet.sections?.equity?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1 text-sm">
                    <span className="ml-4 text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2">
                  <span>Total Equity</span>
                  <span className="text-blue-600">{formatCurrency(balanceSheet.totals?.equity)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-center font-semibold">
                Liabilities + Equity = {formatCurrency(balanceSheet.totals?.liabilities + balanceSheet.totals?.equity)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'income-statement' && incomeStatement && (
        <Card>
          <CardHeader>
            <CardTitle>{incomeStatement.title}</CardTitle>
            <CardDescription>
              {incomeStatement.period?.from} to {incomeStatement.period?.to}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-green-600">
                  <TrendingUp className="w-5 h-5" />
                  Revenue
                </h3>
                {incomeStatement.sections?.revenue?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1 text-sm">
                    <span className="ml-4 text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2 text-green-600">
                  <span>Total Revenue</span>
                  <span>{formatCurrency(incomeStatement.totals?.revenue)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-red-600">
                  <TrendingDown className="w-5 h-5" />
                  Expenses
                </h3>
                {incomeStatement.sections?.expenses?.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1 text-sm">
                    <span className="ml-4 text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2 text-red-600">
                  <span>Total Expenses</span>
                  <span>{formatCurrency(incomeStatement.totals?.expenses)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between font-semibold">
                <span>Net Income</span>
                <span className={incomeStatement.totals?.net_income >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(incomeStatement.totals?.net_income)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!balanceSheet && !incomeStatement && !loading && (
        <Card>
          <CardContent className="text-center text-muted-foreground py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a report type and click Refresh to generate</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
