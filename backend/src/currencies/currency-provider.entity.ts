import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, DeleteDateColumn } from 'typeorm';
import { Currency } from './currency.entity';
import { Provider } from '../providers/provider.entity';

@Entity('currency_providers')
@Index(['currency_code', 'provider_id'], { unique: true })
export class CurrencyProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, name: 'currency_code' })
  currency_code: string;

  @Column({ name: 'provider_id' })
  provider_id: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => Currency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currency_code' })
  currency: Currency;

  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;
}
