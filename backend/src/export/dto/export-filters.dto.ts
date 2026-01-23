import { AccountType } from '../../accounts/account.entity';

export interface ExportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  datePreset?: string;
  accountTypes?: AccountType[];
  includeInactive?: boolean;
  includeHeader?: boolean;
  delimiter?: ',' | ';' | '\t';
}

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

export function parseDatePreset(preset: string): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'last_30_days':
      return {
        dateFrom: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        dateTo: today,
      };
    case 'last_90_days':
      return {
        dateFrom: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        dateTo: today,
      };
    case 'this_year':
      return {
        dateFrom: new Date(now.getFullYear(), 0, 1),
        dateTo: today,
      };
    case 'all_time':
    default:
      return null;
  }
}
