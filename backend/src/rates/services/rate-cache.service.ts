import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 缓存条目接口
 */
interface CacheEntry {
  rate: number;
  providerId: string;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Rate Cache Service
 * 
 * 支持两种存储后端:
 * - In-Memory: 单实例部署 (默认)
 * - Redis: 多实例部署 (配置 REDIS_URL)
 * 
 * 缓存策略:
 * - TTL: 2 小时 (±10min 随机防雪崩)
 * - 刷新: Lazy Expiration (过期后首次请求刷新)
 */
@Injectable()
export class RateCacheService implements OnModuleInit {
  private readonly logger = new Logger(RateCacheService.name);
  
  // 缓存 TTL: 2 小时 (毫秒)
  private readonly CACHE_TTL_MS = 2 * 60 * 60 * 1000;
  
  // 缓存 TTL 随机偏移范围 (防雪崩)
  private readonly TTL_JITTER_MS = 10 * 60 * 1000;  // ±10 分钟

  // 内存缓存 (单实例)
  private memoryCache: Map<string, CacheEntry> = new Map();

  // Redis 客户端 (多实例)
  private redis: any = null;
  private useRedis = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        // 延迟导入 redis，避免没有安装时报错
        const Redis = (await import('ioredis')).default;
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        
        this.redis.on('error', (err: Error) => {
          this.logger.warn(`Redis error, fallback to memory: ${err.message}`);
          this.useRedis = false;
        });
        
        this.redis.on('connect', () => {
          this.logger.log('Connected to Redis for rate cache');
        });

        await this.redis.connect();
        this.useRedis = true;
      } catch (error) {
        this.logger.warn('Redis not available, using memory cache');
        this.useRedis = false;
      }
    } else {
      this.logger.log('Using in-memory rate cache (single instance mode)');
      this.useRedis = false;
    }
  }

  /**
   * 获取缓存的汇率
   */
  async get(from: string, to: string, date: Date): Promise<CacheEntry | null> {
    const key = this.buildKey(from, to, date);

    if (this.useRedis && this.redis) {
      return this.redisGet(key);
    }

    // 内存缓存
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (new Date() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存的汇率
   */
  async set(
    from: string,
    to: string,
    date: Date,
    entry: Omit<CacheEntry, 'expiresAt'>
  ): Promise<void> {
    const key = this.buildKey(from, to, date);
    
    // 添加随机 jitter 防雪崩
    const jitter = Math.random() * this.TTL_JITTER_MS * 2 - this.TTL_JITTER_MS;
    const ttlMs = this.CACHE_TTL_MS + jitter;

    const fullEntry: CacheEntry = {
      ...entry,
      expiresAt: new Date(Date.now() + ttlMs),
    };

    if (this.useRedis && this.redis) {
      await this.redisSet(key, fullEntry, ttlMs / 1000);
      return;
    }

    // 内存缓存
    this.memoryCache.set(key, fullEntry);
  }

  /**
   * 批量获取缓存
   */
  async getBatch(
    pairs: Array<{ from: string; to: string; date: Date }>
  ): Promise<Map<string, CacheEntry>> {
    const results = new Map<string, CacheEntry>();

    if (this.useRedis && this.redis) {
      // Redis 批量获取
      const keys = pairs.map(p => this.buildKey(p.from, p.to, p.date));
      const values = await this.redis.mget(keys);
      
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const value = values[i];
        
        if (value) {
          try {
            const entry = JSON.parse(value) as CacheEntry;
            // 检查过期
            if (new Date() <= entry.expiresAt) {
              results.set(`${pair.from}:${pair.to}`, entry);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } else {
      // 内存批量获取
      for (const pair of pairs) {
        const entry = await this.get(pair.from, pair.to, pair.date);
        if (entry) {
          results.set(`${pair.from}:${pair.to}`, entry);
        }
      }
    }

    return results;
  }

  /**
   * 批量设置缓存
   */
  async setBatch(
    from: string,
    date: Date,
    rates: Map<string, number>,
    providerId: string
  ): Promise<void> {
    if (this.useRedis && this.redis) {
      // Redis 批量设置
      const pipeline = this.redis.pipeline();
      const jitter = Math.random() * this.TTL_JITTER_MS * 2 - this.TTL_JITTER_MS;
      const ttl = (this.CACHE_TTL_MS + jitter) / 1000;

      for (const [to, rate] of rates) {
        const key = this.buildKey(from, to, date);
        const entry: CacheEntry = {
          rate,
          providerId,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + this.CACHE_TTL_MS + jitter),
        };
        pipeline.setex(key, ttl, JSON.stringify(entry));
      }

      await pipeline.exec();
      return;
    }

    // 内存批量设置
    const jitter = Math.random() * this.TTL_JITTER_MS * 2 - this.TTL_JITTER_MS;
    
    for (const [to, rate] of rates) {
      const key = this.buildKey(from, to, date);
      this.memoryCache.set(key, {
        rate,
        providerId,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + this.CACHE_TTL_MS + jitter),
      });
    }
  }

  /**
   * 删除缓存
   */
  async delete(from: string, to: string, date: Date): Promise<boolean> {
    const key = this.buildKey(from, to, date);

    if (this.useRedis && this.redis) {
      const result = await this.redis.del(key);
      return result > 0;
    }

    return this.memoryCache.delete(key);
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    if (this.useRedis && this.redis) {
      const keys = await this.redis.keys('rate:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }

    this.memoryCache.clear();
    this.logger.log('Rate cache cleared');
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<{ size: number; keys: string[] }> {
    if (this.useRedis && this.redis) {
      const keys = await this.redis.keys('rate:*');
      return { size: keys.length, keys: keys.slice(0, 100) };
    }

    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()).slice(0, 100),
    };
  }

  // ==================== Redis 辅助方法 ====================

  private async redisGet(key: string): Promise<CacheEntry | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      const entry = JSON.parse(value) as CacheEntry;
      
      // 检查过期
      if (new Date() > entry.expiresAt) {
        await this.redis.del(key);
        return null;
      }

      return entry;
    } catch (error) {
      this.logger.warn(`Redis get error: ${error}`);
      return null;
    }
  }

  private async redisSet(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));
    } catch (error) {
      this.logger.warn(`Redis set error: ${error}`);
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 构建缓存键
   */
  private buildKey(from: string, to: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return `rate:${from.toUpperCase()}:${to.toUpperCase()}:${dateStr}`;
  }
}
