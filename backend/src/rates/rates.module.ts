import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { Provider } from './provider.entity';
import { RateHistory } from './entities/rate-history.entity';
import { RateStats } from './entities/rate-stats.entity';
import { RatesService } from './services/rate.service';
import { RatesController } from './rates.controller';
import { RateGraphEngine } from './services/rate-graph.engine';
import { RateCacheService } from './services/rate-cache.service';
import { RateStorageService } from './services/rate-storage.service';
import { RateFetchService } from './services/rate-fetch.service';
import { RateMonitorService } from './services/rate-monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExchangeRate, 
      Provider, 
      RateHistory, 
      RateStats
    ]),
  ],
  controllers: [RatesController],
  providers: [
    RatesService,
    RateGraphEngine,
    RateCacheService,
    RateStorageService,
    RateFetchService,
    RateMonitorService,
  ],
  exports: [
    RatesService,
    RateGraphEngine,
    RateFetchService,
  ],
})
export class RatesModule {}
