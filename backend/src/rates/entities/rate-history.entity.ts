import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rate_history')
@Index(['fromCurrency', 'toCurrency', 'date'])
export class RateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 3, name: 'from_currency' })
  fromCurrency: string;

  @Column({ length: 3, name: 'to_currency' })
  toCurrency: string;

  @Column({ type: 'decimal', precision: 20, scale: 10 })
  rate: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ length: 36, name: 'provider_id' })
  providerId: string;

  @Column({ type: 'boolean', default: false, name: 'is_inferred' })
  isInferred: boolean;

  @Column({ type: 'int', nullable: true })
  hops: number;

  @Column({ type: 'simple-array', nullable: true })
  path: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
