import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Tree, TreeChildren, TreeParent } from 'typeorm';

export enum AccountType {
  ASSETS = 'assets',
  LIABILITIES = 'liabilities',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

@Entity('accounts')
@Tree('materialized-path')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

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

  @Column({ type: 'int', default: 0 })
  depth: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;
}
