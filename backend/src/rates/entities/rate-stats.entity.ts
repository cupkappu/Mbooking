import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rate_stats')
@Index(['date', 'hour'], { unique: true })
export class RateStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int' })
  hour: number;

  @Column({ type: 'int', default: 0, name: 'total_queries' })
  totalQueries: number;

  @Column({ type: 'int', default: 0, name: 'cache_hits' })
  cacheHits: number;

  @Column({ type: 'int', default: 0, name: 'cache_misses' })
  cacheMisses: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'cache_hit_rate' })
  cacheHitRate: number;

  @Column({ type: 'int', default: 0, name: 'provider_calls' })
  providerCalls: number;

  @Column({ type: 'int', default: 0, name: 'provider_failures' })
  providerFailures: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'avg_latency_ms' })
  avgLatencyMs: number;

  @Column({ type: 'int', default: 0, name: 'inferred_rates' })
  inferredRates: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
