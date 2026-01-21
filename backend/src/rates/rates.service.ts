import { Injectable } from '@nestjs/common';
import { RateGraphEngine, GraphPathfindingResult } from './rate-graph-engine';

@Injectable()
export class RatesService {
  constructor(private rateGraphEngine: RateGraphEngine) {}

  async getLatestRate(from: string, to: string): Promise<any> {
    const result = await this.rateGraphEngine.getRate(from, to);
    
    if (!result) {
      return null;
    }
    
    return {
      from: result.from,
      to: result.to,
      rate: result.rate,
      timestamp: result.timestamp,
      source: result.source,
      path: result.path,
      hops: result.hops,
      isInferred: result.isInferred,
    };
  }

  async getRateAtDate(from: string, to: string, date: Date): Promise<any> {
    const result = await this.rateGraphEngine.getRate(from, to, { date });
    
    if (!result) {
      return null;
    }
    
    return {
      from: result.from,
      to: result.to,
      rate: result.rate,
      timestamp: result.timestamp,
      source: result.source,
      path: result.path,
      hops: result.hops,
      isInferred: result.isInferred,
    };
  }

  async convert(amount: number, from: string, to: string, date?: Date): Promise<any> {
    return this.rateGraphEngine.convert(amount, from, to, date);
  }

  async getAvailablePaths(from: string, to: string, date?: Date): Promise<any[]> {
    const paths = await this.rateGraphEngine.getAvailablePaths(from, to, date);
    return paths.map(p => ({
      path: p.path,
      totalRate: p.totalRate,
      hops: p.hops,
    }));
  }

  async getRateHistory(
    from: string,
    to: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {},
  ): Promise<{
    rates: Array<{
      from: string;
      to: string;
      rate: number;
      date: Date;
      fetched_at: Date;
      provider_id: string;
    }>;
    total: number;
  }> {
    return this.rateGraphEngine.getRateHistory(from, to, options);
  }

  async getRateTrend(from: string, to: string, days: number = 30): Promise<{
    min_rate: number;
    max_rate: number;
    avg_rate: number;
    trend: 'up' | 'down' | 'stable';
    change_percent: number;
    history: Array<{ date: string; rate: number }>;
  }> {
    return this.rateGraphEngine.getRateTrend(from, to, days);
  }

  async getAverageRate(
    from: string,
    to: string,
    options: {
      fromDate: Date;
      toDate: Date;
    },
  ): Promise<{
    average_rate: number;
    min_rate: number;
    max_rate: number;
    sample_count: number;
  }> {
    return this.rateGraphEngine.getAverageRate(from, to, options);
  }
}
