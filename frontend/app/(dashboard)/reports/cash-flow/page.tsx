'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { RefreshCw, FileText, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface CashFlowStatement {
  title: string;
  period: { from: string; to: string };
  generated_at: string;
  sections: {
    operating: { name: string; items: { name: string; amount: number }[]; total: number };
    investing: { name: string; items: { name: string; amount: number }[]; total: number };
    financing: { name: string; items: { name: string; amount: number }[]; total: number };
  };
  totals: {
    operating: number;
    investing: number;
    financing: number;
    net_change: number;
    beginning_cash: number;
    ending_cash: number;
    currency: string;
  };
}

export default function CashFlowPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [cashFlow, setCashFlow] = useState<CashFlowStatement | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCashFlow = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<CashFlowStatement>(
        `/reports/cash-flow?from_date=${dateRange.from}&to_date=${dateRange.to}`
      );
      setCashFlow(data);
    } catch (error) {
      console.error('Failed to fetch cash flow statement:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cashFlow?.totals.currency || 'USD',
    }).format(Math.abs(amount));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
        <p className="text-muted-foreground">Track cash movements through operating, investing, and financing activities</p>
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
        <Button onClick={fetchCashFlow} disabled={loading} className="mt-5">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Generate'}
        </Button>
      </div>

      {cashFlow && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Operating Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cashFlow.totals.operating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cashFlow.totals.operating)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Investing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cashFlow.totals.investing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cashFlow.totals.investing)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Financing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cashFlow.totals.financing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cashFlow.totals.financing)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Change</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${cashFlow.totals.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cashFlow.totals.net_change)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Position */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Position</CardTitle>
              <CardDescription>
                Period: {cashFlow.period.from} to {cashFlow.period.to}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Beginning Cash</p>
                  <p className="text-3xl font-bold">{formatCurrency(cashFlow.totals.beginning_cash)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Net Change</p>
                  <p className={`text-3xl font-bold ${cashFlow.totals.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {cashFlow.totals.net_change >= 0 ? '+' : ''}{formatCurrency(cashFlow.totals.net_change)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ending Cash</p>
                  <p className="text-3xl font-bold">{formatCurrency(cashFlow.totals.ending_cash)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Operating Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Operating Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashFlow.sections.operating.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className={item.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t font-semibold">
                    <span>Net Cash from Operating</span>
                    <span className={cashFlow.sections.operating.total >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(cashFlow.sections.operating.total)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investing Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-purple-600" />
                  Investing Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashFlow.sections.investing.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No investing activities</p>
                  ) : (
                    cashFlow.sections.investing.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className={item.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between pt-3 border-t font-semibold">
                    <span>Net Cash from Investing</span>
                    <span className={cashFlow.sections.investing.total >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(cashFlow.sections.investing.total)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financing Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                  Financing Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashFlow.sections.financing.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No financing activities</p>
                  ) : (
                    cashFlow.sections.financing.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className={item.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between pt-3 border-t font-semibold">
                    <span>Net Cash from Financing</span>
                    <span className={cashFlow.sections.financing.total >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(cashFlow.sections.financing.total)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!cashFlow && !loading && (
        <Card>
          <CardContent className="text-center text-muted-foreground py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a date range and click Generate to view cash flow statement</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
