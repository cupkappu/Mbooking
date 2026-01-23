import { Transform } from 'stream';

/**
 * CSV Formatter Utility
 * Implements RFC 4180 compliant CSV escaping for special characters.
 */
export class CsvFormatterUtil {
  /**
   * Escape a value according to RFC 4180
   * - Fields containing commas, double quotes, or newlines must be enclosed in double quotes
   * - Double quotes within a field must be represented by two consecutive double quotes
   */
  static escape(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);
    const separator = ',';
    const newline = /\r?\n/;

    // Check if escaping is needed
    const needsQuoting =
      str.includes(separator) ||
      str.includes('"') ||
      newline.test(str);

    if (needsQuoting) {
      // Escape double quotes by doubling them
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Format a row of data into a CSV line
   */
  static formatRow(values: unknown[]): string {
    return values.map((value) => this.escape(value)).join(',');
  }

  /**
   * Format a header row
   */
  static formatHeader(headers: string[]): string {
    return this.formatRow(headers);
  }
}

/**
 * Transform stream for CSV line formatting
 */
export class CsvLineTransform extends Transform {
  private headers: string[];
  private headersWritten = false;
  private readonly separator = ',';
  private readonly newline = '\n';

  constructor(headers: string[]) {
    super({ objectMode: true });
    this.headers = headers;
  }

  _transform(row: Record<string, unknown>, _encoding: string, callback: () => void): void {
    // Write headers on first row
    if (!this.headersWritten) {
      this.push(CsvFormatterUtil.formatHeader(this.headers) + this.newline);
      this.headersWritten = true;
    }

    // Format the row
    const values = this.headers.map((header) => row[header]);
    const csvLine = CsvFormatterUtil.formatRow(values) + this.newline;

    this.push(csvLine);
    callback();
  }
}

/**
 * Utility to calculate date presets
 */
export class DatePresetUtil {
  static calculateDateRange(
    preset: 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time'
  ): { dateFrom: Date; dateTo: Date } | null {
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
}
