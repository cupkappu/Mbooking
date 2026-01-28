import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProviderType {
  JS_PLUGIN = 'js_plugin',
  REST_API = 'rest_api',
  MANUAL = 'manual',
}

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ProviderType,
    default: ProviderType.REST_API,
  })
  type: ProviderType;

  @Column({ type: 'jsonb' })
  config: {
    file_path?: string;
    base_url?: string;
    api_key?: string;
    timeout?: number;
    headers?: Record<string, string>;
    plugin_path?: string;
  };

  @Column('text', { array: true })
  supported_currencies: string[];

  @Column({ default: false })
  supports_historical: boolean;

  @Column({ default: false })
  supports_date_query: boolean;

  @Column({ default: true })
  record_history: boolean;

  @Column({ default: 1 })
  priority: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
