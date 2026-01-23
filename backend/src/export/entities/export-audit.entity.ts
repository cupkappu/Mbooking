import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ExportType {
  BILLS = 'bills',
  ACCOUNTS = 'accounts',
}

export enum ExportStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('export_audit_logs')
@Index('idx_export_audit_tenant_created', ['tenant_id', 'created_at'])
@Index('idx_export_audit_user', ['user_id'])
export class ExportAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  user_id: string;

  @Column({
    type: 'enum',
    enum: ExportType,
  })
  export_type: ExportType;

  @Column({ type: 'jsonb', nullable: true })
  filters_applied: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  record_count: number;

  @Column({
    type: 'enum',
    enum: ExportStatus,
    default: ExportStatus.SUCCESS,
  })
  status: ExportStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'bigint', nullable: true })
  file_size_bytes: number | null;
}
