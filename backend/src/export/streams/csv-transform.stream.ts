import { Readable, Transform, Writable } from 'stream';
import { CsvFormatterUtil, DatePresetUtil } from './csv-formatter.util';

/**
 * Bills CSV Headers according to data-model.md
 */
export const BILLS_CSV_HEADERS = [
  'Date',
  'Description',
  'Debit Account',
  'Credit Account',
  'Amount',
  'Currency',
  'Reference ID',
];

/**
 * Accounts CSV Headers according to data-model.md
 */
export const ACCOUNTS_CSV_HEADERS = [
  'Account Name',
  'Account Type',
  'Parent Account',
  'Currency',
  'Balance',
  'Is Active',
  'Depth',
];

/**
 * Bills data transformer - converts JournalEntry to CSV row format
 */
export function transformBillToCsvRow(bill: {
  date: Date | string;
  description: string;
  reference_id: string | null;
  lines: Array<{
    amount: string | number;
    currency: string;
    account?: { name: string; type: string };
  }>;
}): Record<string, unknown> {
  const date = bill.date instanceof Date ? bill.date.toISOString().split('T')[0] : String(bill.date);

  // Find debit and credit accounts (positive = debit, negative = credit)
  const debitLine = bill.lines.find((line) => Number(line.amount) > 0);
  const creditLine = bill.lines.find((line) => Number(line.amount) < 0);

  const debitAccount = debitLine?.account?.name || '';
  const creditAccount = creditLine?.account?.name || '';
  const amount = Math.abs(Number(bill.lines[0]?.amount || 0)).toFixed(2);
  const currency = bill.lines[0]?.currency || '';

  return {
    Date: date,
    Description: bill.description,
    'Debit Account': debitAccount,
    'Credit Account': creditAccount,
    Amount: amount,
    Currency: currency,
    'Reference ID': bill.reference_id || '',
  };
}

/**
 * Accounts data transformer - converts Account to CSV row format
 */
export function transformAccountToCsvRow(account: {
  name: string;
  type: string;
  currency: string;
  parent?: { name: string } | null;
  is_active: boolean;
  depth: number;
  balance?: number | string;
}): Record<string, unknown> {
  return {
    'Account Name': account.name,
    'Account Type': account.type,
    'Parent Account': account.parent?.name || '',
    Currency: account.currency,
    Balance: account.balance !== undefined ? String(account.balance) : '0.00',
    'Is Active': account.is_active.toString(),
    Depth: account.depth.toString(),
  };
}

/**
 * Create a transform stream for bills CSV export
 */
export function createBillsCsvTransform(): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      const csvRow = transformBillToCsvRow(chunk);
      const csvLine = CsvFormatterUtil.formatRow(Object.values(csvRow));
      callback(null, csvLine + '\n');
    },
  });
}

/**
 * Create a transform stream for accounts CSV export
 */
export function createAccountsCsvTransform(): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      const csvRow = transformAccountToCsvRow(chunk);
      const csvLine = CsvFormatterUtil.formatRow(Object.values(csvRow));
      callback(null, csvLine + '\n');
    },
  });
}

/**
 * Add UTF-8 BOM to the beginning of a stream
 */
export function createBomTransform(): Transform {
  const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
  let firstChunk = true;

  return new Transform({
    transform(chunk, _encoding, callback) {
      if (firstChunk) {
        firstChunk = false;
        callback(null, Buffer.concat([BOM, chunk]));
      } else {
        callback(null, chunk);
      }
    },
  });
}

/**
 * Create a complete CSV export pipeline with BOM, headers, and data transformation
 */
export function createBillsExportPipeline(
  dataStream: Readable
): Readable {
  const bom = createBomTransform();
  const headers = CsvFormatterUtil.formatHeader(BILLS_CSV_HEADERS) + '\n';
  const transform = createBillsCsvTransform();

  return Readable.from(
    (async function* (): AsyncGenerator<Buffer> {
      // Yield BOM + headers
      yield Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(headers)]);

      // Yield transformed data rows
      for await (const row of dataStream) {
        const csvRow = transformBillToCsvRow(row);
        const csvLine = CsvFormatterUtil.formatRow(Object.values(csvRow)) + '\n';
        yield Buffer.from(csvLine);
      }
    })()
  );
}

/**
 * Create a complete accounts export pipeline with BOM, headers, and data transformation
 */
export function createAccountsExportPipeline(dataStream: Readable): Readable {
  const headers = CsvFormatterUtil.formatHeader(ACCOUNTS_CSV_HEADERS) + '\n';

  return Readable.from(
    (async function* (): AsyncGenerator<Buffer> {
      // Yield BOM + headers
      yield Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(headers)]);

      // Yield transformed data rows
      for await (const row of dataStream) {
        const csvRow = transformAccountToCsvRow(row);
        const csvLine = CsvFormatterUtil.formatRow(Object.values(csvRow)) + '\n';
        yield Buffer.from(csvLine);
      }
    })()
  );
}
