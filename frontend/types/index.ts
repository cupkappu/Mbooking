export interface Account {
  id: string;
  name: string;
  type: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expense';
  currency: string;
  path: string;
  depth: number;
  parent_id?: string;
  children?: Account[];
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference_id?: string;
  lines: JournalLine[];
  created_at: string;
}

export interface JournalLine {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  converted_amount?: number;
  tags: string[];
  remarks?: string;
}

export interface CurrencyBalance {
  currency: string;
  amount: number;
}

export interface AccountBalance {
  account: Account;
  currencies: CurrencyBalance[];
  converted_amount?: number;
  subtree_currencies?: CurrencyBalance[];
  converted_subtree_total?: number;
  converted_subtree_currency?: string;
}

export interface Budget {
  id: string;
  name: string;
  type: 'periodic' | 'non_periodic';
  amount: number;
  currency: string;
  start_date: string;
  end_date?: string;
  period_type?: 'monthly' | 'weekly' | 'yearly';
  spent_amount: number;
}
