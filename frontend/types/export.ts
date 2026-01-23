export type AccountType = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expense';

export type DatePreset = 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time';

export type CsvDelimiter = ',' | ';' | '\t';

export interface ExportBillsRequest {
  date_from?: string;
  date_to?: string;
  date_preset?: DatePreset;
  account_types?: AccountType[];
  include_header?: boolean;
  delimiter?: CsvDelimiter;
}

export interface ExportAccountsRequest {
  account_types?: AccountType[];
  include_inactive?: boolean;
  include_header?: boolean;
  delimiter?: CsvDelimiter;
}

export interface ExportStatusResponse {
  export_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  record_count: number;
  total_records: number;
  download_url: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ErrorResponse {
  success: false;
  error_code: string;
  error_message: string;
  details?: Record<string, unknown>;
}
