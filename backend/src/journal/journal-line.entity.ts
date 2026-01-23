import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { Account } from '../accounts/account.entity';

@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  journal_entry: JournalEntry;

  @Column()
  journal_entry_id: string;

  @Column()
  tenant_id: string;

  @Column()
  account_id: string;

  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  created_at: Date;
}
