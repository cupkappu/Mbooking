# Research: CSV Export for Bills and Accounts

**Feature**: Export bills and accounts to CSV  
**Date**: 2026-01-23

## Research Questions

### Q1: CSV Export Strategy - Browser vs Server?

**Decision**: Server-side streaming with cursor pagination

**Rationale**:
- **Browser memory limitations**: JavaScript has strict memory limits (512MB-1GB). 10,000+ records in browser causes performance issues and crashes
- **Mobile compatibility**: Mobile browsers have stricter memory constraints
- **User experience**: Server-side streaming provides progressive feedback and handles interruptions better
- **Security**: Sensitive financial data stays on server

**Alternatives considered**:
- Browser-based Blob creation: Fails with large datasets
- Client-side pagination with multiple requests: More complex, slower user experience

---

### Q2: Memory Efficiency for Large Exports?

**Decision**: Use Node.js Streams with Cursor-Based Pagination

**Rationale**:
- **Constant memory footprint**: Streams process data in chunks without loading entire datasets
- **Cursor pagination**: Avoids OFFSET performance issues (O(n) vs O(1))
- **Backpressure handling**: Node.js streams automatically manage data flow

**Code pattern (NestJS with StreamableFile)**:
```typescript
@Controller('export')
export class CsvExportController {
  @Get('stream')
  @Header('Content-Type', 'text/csv')
  async exportStream() {
    const transformStream = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const csvLine = this.formatCSVLine(chunk);
        callback(null, csvLine);
      }
    });

    const dataStream = this.dataService.streamWithCursor(transformStream, { batchSize: 1000 });
    return new StreamableFile(dataStream);
  }
}
```

---

### Q3: UTF-8 BOM for Excel Compatibility?

**Decision**: Always include UTF-8 BOM (EF BB BF) for Excel compatibility

**Rationale**:
- **Excel defaults**: Excel uses system locale (often ANSI) without BOM, causing character corruption
- **Universal solution**: BOM is harmless for other apps, ensures Excel compatibility
- **Standard**: EF BB BF bytes at file start indicate UTF-8 encoding

**Code pattern**:
```typescript
@Controller('export')
export class CsvExportController {
  @Get('excel-compatible')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportForExcel() {
    const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
    return new StreamableFile(BOM);
  }
}
```

---

### Q4: TypeORM Pagination for Exports?

**Decision**: Use cursor-based pagination with stream() for large exports

**Rationale**:
- **Offset pagination**: O(n) complexity, degrades with large offsets
- **Cursor pagination**: O(1) per page, consistent performance
- **TypeORM stream()**: Memory-efficient row-by-row streaming

**Code pattern**:
```typescript
// In ExportService
async streamBillsWithCursor(
  tenantId: string,
  transform: Transform,
  options: { dateFrom?: Date; dateTo?: Date; batchSize?: number } = {}
): Promise<Transform> {
  const queryBuilder = this.journalEntryRepository
    .createQueryBuilder('je')
    .leftJoinAndSelect('je.lines', 'lines')
    .leftJoinAndSelect('lines.account', 'account')
    .where('je.tenant_id = :tenantId', { tenantId })
    .andWhere('je.deleted_at IS NULL')
    .orderBy('je.date', 'ASC')
    .addOrderBy('je.id', 'ASC');

  // Apply date filters
  if (options.dateFrom) {
    queryBuilder.andWhere('je.date >= :dateFrom', { dateFrom: options.dateFrom });
  }
  if (options.dateTo) {
    queryBuilder.andWhere('je.date <= :dateTo', { dateTo: options.dateTo });
  }

  const batchSize = options.batchSize || 1000;
  
  // Use cursor-based approach with take/take and last ID
  let lastId: string | null = null;
  
  const generateRows = async function* () {
    let hasMore = true;
    while (hasMore) {
      const whereCondition = lastId 
        ? { tenant_id: tenantId, id: MoreThan(lastId) }
        : { tenant_id: tenantId };
      
      const entries = await repository.find({
        where: whereCondition,
        take: batchSize,
        order: { id: 'ASC' },
        relations: ['lines', 'lines.account']
      });
      
      if (entries.length < batchSize) {
        hasMore = false;
      }
      
      if (entries.length > 0) {
        lastId = entries[entries.length - 1].id;
        yield* entries;
      }
    }
  };

  return Readable.from(generateRows()).pipe(transform);
}
```

**Alternatives considered**:
- OFFSET-based pagination: Performance degrades with large offsets
- Keyset pagination: Requires composite key, more complex but faster

---

### Q5: Special Character Escaping?

**Decision**: Implement RFC 4180 compliant escaping

**Rationale**:
- **Standard compliance**: RFC 4180 is the canonical CSV standard
- **Universal compatibility**: Works across Excel, LibreOffice, Google Sheets
- **Edge case handling**: Properly handles commas, quotes, newlines

**Code pattern**:
```typescript
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  const separator = ',';
  const newline = '\n';
  
  // RFC 4180: Quote if contains separator, quote, or newline
  const needsQuoting = 
    str.includes(separator) || 
    str.includes('"') || 
    str.includes(newline);
  
  if (needsQuoting) {
    return `"${str.replace(/"/g, '""')}"`;  // Escape double quotes
  }
  
  return str;
}
```

---

## Summary: Technical Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Architecture** | Server-side streaming | Browser memory limits, security, UX |
| **Memory** | Node.js streams + cursor pagination | Constant memory, O(1) pagination |
| **Excel** | UTF-8 BOM (EF BB BF) | Excel UTF-8 detection |
| **Framework** | NestJS StreamableFile + Transform | Native support, backpressure |
| **Escaping** | RFC 4180 | Universal compatibility |
| **Batch size** | 1000 records | Balance memory/network efficiency |

---

## Existing Codebase Patterns

Based on exploration of the codebase:

### JournalEntry Entity
```typescript
@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column()
  description: string;

  @OneToMany(() => JournalLine, (line) => line.journal_entry, { cascade: true })
  lines: JournalLine[];
  
  @DeleteDateColumn()
  deleted_at: Date | null;
}
```

### Account Entity (Tree)
```typescript
@Entity('accounts')
@Tree('materialized-path')
export class Account {
  @TreeParent({ onDelete: 'NO ACTION' })
  parent: Account | null;

  @TreeChildren({ cascade: true })
  children: Account[];

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string;
}
```

### Existing Service Patterns
- `JournalService.findAll()` uses skip/take pagination
- `AccountsService.findTree()` uses tree repository with path ordering
- Tenant isolation via `TenantContext.requireTenantId()`

---

## Implementation Implications

1. **Export Module**: Create `backend/src/export/export.module.ts` following existing module pattern
2. **Export Service**: Implement streaming with cursor pagination (not offset-based)
3. **Export Controller**: Use `StreamableFile` for CSV download with UTF-8 BOM
4. **Transform Stream**: RFC 4180 compliant CSV line formatting
5. **Frontend**: Simple button triggering API download, no data processing
6. **Date Filter UI**: Need to integrate or create date range picker (shadcn/ui has DatePicker)
