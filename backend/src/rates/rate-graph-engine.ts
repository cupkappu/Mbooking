import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { Provider, ProviderType } from './provider.entity';

// ============================================================================
// Graph Data Structures
// ============================================================================

export interface RateEdge {
  from: string;
  to: string;
  rate: number;        // Exchange rate (from -> to)
  providerId: string;
  providerName: string;
  timestamp: Date;
  confidence: number;  // 0-1, based on staleness and source reliability
}

export interface RateGraph {
  nodes: Set<string>;
  edges: Map<string, Map<string, RateEdge>>;  // edges[from][to] = edge
}

export interface PathResult {
  path: string[];           // ['BTC', 'ETH', 'USDT', 'USD']
  totalRate: number;        // Cumulative rate
  hops: number;
  edges: RateEdge[];        // Individual edges used
}

export interface GraphPathfindingResult {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
  path: string[];
  hops: number;
  isInferred: boolean;
}

// ============================================================================
// Priority Queue for Dijkstra
// ============================================================================

class PriorityQueue<T> {
  private items: Map<T, number> = new Map();

  constructor() {}

  enqueue(item: T, priority: number): void {
    this.items.set(item, priority);
  }

  dequeue(): [T, number] | null {
    if (this.items.size === 0) return null;

    let minPriority = Infinity;
    let minItem: T | null = null;

    for (const [item, priority] of this.items) {
      if (priority < minPriority) {
        minPriority = priority;
        minItem = item;
      }
    }

    if (minItem !== null) {
      this.items.delete(minItem);
      return [minItem, minPriority];
    }

    return null;
  }

  update(item: T, priority: number): void {
    if (this.items.has(item)) {
      this.items.set(item, priority);
    }
  }

  has(item: T): boolean {
    return this.items.has(item);
  }

  isEmpty(): boolean {
    return this.items.size === 0;
  }

  size(): number {
    return this.items.size;
  }

  static from<T>(items: Map<T, number>): PriorityQueue<T> {
    const pq = new PriorityQueue<T>();
    for (const [item, priority] of items) {
      pq.enqueue(item, priority);
    }
    return pq;
  }
}

// ============================================================================
// Graph-Based Rate Engine
// ============================================================================

@Injectable()
export class RateGraphEngine {
  private readonly logger = new Logger(RateGraphEngine.name);
  private graphCache: Map<string, { graph: RateGraph; expiresAt: Date }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(ExchangeRate)
    private rateRepository: Repository<ExchangeRate>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get exchange rate using graph-based path finding
   * Falls back to direct rate if available, otherwise finds optimal path
   */
  async getRate(
    from: string,
    to: string,
    options: { date?: Date; providerId?: string } = {}
  ): Promise<GraphPathfindingResult | null> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // Same currency
    if (fromUpper === toUpper) {
      return {
        from: fromUpper,
        to: toUpper,
        rate: 1,
        timestamp: new Date(),
        source: 'identity',
        path: [fromUpper],
        hops: 0,
        isInferred: false,
      };
    }

    const date = options.date || new Date();
    const cacheKey = this.getCacheKey(date);

    // Try direct rate first (from cache)
    const directEdge = await this.getDirectEdge(fromUpper, toUpper, date);
    if (directEdge) {
      return {
        from: fromUpper,
        to: toUpper,
        rate: directEdge.rate,
        timestamp: directEdge.timestamp,
        source: directEdge.providerName,
        path: [fromUpper, toUpper],
        hops: 1,
        isInferred: false,
      };
    }

    // Build graph and find path
    const graph = await this.buildGraph(date, options.providerId);
    
    // Find optimal path using Dijkstra
    const pathResult = this.findBestPath(graph, fromUpper, toUpper, {
      maxHops: 5,
      minConfidence: 0.1,
    });

    if (!pathResult) {
      return null;
    }

    // Calculate total rate from path edges
    let totalRate = 1;
    for (const edge of pathResult.edges) {
      totalRate *= edge.rate;
    }

    return {
      from: fromUpper,
      to: toUpper,
      rate: totalRate,
      timestamp: new Date(),
      source: 'graph-inference',
      path: pathResult.path,
      hops: pathResult.hops,
      isInferred: true,
    };
  }

  /**
   * Convert amount using graph-based rate finding
   */
  async convert(
    amount: number,
    from: string,
    to: string,
    date?: Date
  ): Promise<{
    amount: number;
    from: string;
    to: string;
    converted_amount: number;
    rate: number;
    date: Date;
    path?: string[];
    hops?: number;
  }> {
    const rateResult = await this.getRate(from, to, { date });
    const rate = rateResult?.rate || 1;

    return {
      amount,
      from,
      to,
      converted_amount: amount * rate,
      rate,
      date: date || new Date(),
      path: rateResult?.path,
      hops: rateResult?.hops,
    };
  }

  /**
   * Get all available paths between two currencies
   */
  async getAvailablePaths(
    from: string,
    to: string,
    date?: Date
  ): Promise<PathResult[]> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    
    try {
      const graph = await this.buildGraph(date || new Date());

      // Find all simple paths (limited to reasonable number)
      const paths: PathResult[] = [];
      const maxPaths = 10;
      const maxHops = 4;

      this.findAllPaths(
        graph,
        fromUpper,
        toUpper,
        new Set<string>(),
        [fromUpper],
        paths,
        maxPaths,
        maxHops
      );

      // Sort by total rate (descending - we want best rate)
      paths.sort((a, b) => b.totalRate - a.totalRate);

      return paths;
    } catch (error) {
      this.logger.error(`Failed to find paths from ${fromUpper} to ${toUpper}: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // Graph Building
  // ============================================================================

  /**
   * Build a rate graph from cached rates and providers
   */
  private async buildGraph(
    date: Date,
    providerId?: string
  ): Promise<RateGraph> {
    const cacheKey = this.getCacheKey(date);
    const cached = this.graphCache.get(cacheKey);
    
    if (cached && cached.expiresAt > new Date()) {
      return cached.graph;
    }

    const graph: RateGraph = {
      nodes: new Set(),
      edges: new Map(),
    };

    // Get providers
    const providerWhere = providerId
      ? [{ id: providerId }]
      : [{ is_active: true }];
    const providers = await this.providerRepository.find({
      where: providerWhere,
    });

    // Get cached rates
    const cachedRates = await this.rateRepository.find({
      where: { date: LessThanOrEqual(date) },
      order: { fetched_at: 'DESC' },
    });

    // Add edges from cached rates (de-duplicate by keeping most recent)
    const rateMap = new Map<string, ExchangeRate>();
    for (const rate of cachedRates) {
      const key = `${rate.from_currency}:${rate.to_currency}`;
      if (!rateMap.has(key)) {
        rateMap.set(key, rate);
      }
    }

    for (const rate of rateMap.values()) {
      const confidence = this.calculateConfidence(rate.fetched_at);
      this.addEdgeToGraph(graph, {
        from: rate.from_currency,
        to: rate.to_currency,
        rate: Number(rate.rate),
        providerId: rate.provider_id,
        providerName: 'cached',
        timestamp: rate.fetched_at,
        confidence,
      });
    }

    // Fetch live rates from providers
    for (const provider of providers) {
      await this.fetchProviderRates(graph, provider, date);
    }

    // Cache the graph
    this.graphCache.set(cacheKey, {
      graph,
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
    });

    return graph;
  }

  /**
   * Fetch rates from a provider and add to graph
   */
  private async fetchProviderRates(
    graph: RateGraph,
    provider: Provider,
    date: Date
  ): Promise<void> {
    try {
      if (provider.type === ProviderType.JS_PLUGIN) {
        await this.fetchFromJsPlugin(graph, provider, date);
      } else if (provider.type === ProviderType.REST_API) {
        await this.fetchFromRestApi(graph, provider, date);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch rates from ${provider.name}: ${error.message}`);
    }
  }

  /**
   * Fetch rates from JavaScript plugin provider
   */
  private async fetchFromJsPlugin(
    graph: RateGraph,
    provider: Provider,
    date: Date
  ): Promise<void> {
    const pluginPath = provider.config.file_path;
    if (!pluginPath) return;

    // Use absolute path
    const absolutePath = __dirname.replace('/dist/rates', '') + '/' + pluginPath;
    
    try {
      const module = require(absolutePath);
      const plugin = module.default || module;

      const currencies = provider.supported_currencies || [];
      
      for (const currency of currencies) {
        // Try to get rates for this currency
        if (plugin.fetchRates) {
          // For crypto providers, they often give rates in terms of a fiat base
          // e.g., CoinGecko gives BTC price in USD
          const baseCurrencies = ['USD', 'EUR', 'GBP', 'CNY'];
          
          for (const base of baseCurrencies) {
            try {
              const rates = await plugin.fetchRates([currency], base);
              
              for (const [rateKey, rateValue] of Object.entries(rates)) {
                // Parse rate key like "USD/BTC" or "BTC/USD"
                const [rateFrom, rateTo] = rateKey.split('/');
                const rateNum = Number(rateValue);
                
                if (isNaN(rateNum)) continue;
                
                if (rateFrom === base && rateTo === currency) {
                  // Rate is base/crypto, meaning 1 base = X crypto
                  // We need crypto/base = 1 / rateValue
                  const cryptoToBase = 1 / rateNum;
                  
                  this.addEdgeToGraph(graph, {
                    from: currency,
                    to: base,
                    rate: cryptoToBase,
                    providerId: provider.id,
                    providerName: provider.name,
                    timestamp: new Date(),
                    confidence: 0.95,
                  });
                } else if (rateFrom === currency && rateTo === base) {
                  // Rate is crypto/base, meaning 1 crypto = X base
                  this.addEdgeToGraph(graph, {
                    from: currency,
                    to: base,
                    rate: rateNum,
                    providerId: provider.id,
                    providerName: provider.name,
                    timestamp: new Date(),
                    confidence: 0.95,
                  });
                }
              }
            } catch {
              // Ignore errors for individual rate fetches
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to load plugin ${provider.name}: ${error.message}`);
    }
  }

  /**
   * Fetch rates from REST API provider
   */
  private async fetchFromRestApi(
    graph: RateGraph,
    provider: Provider,
    date: Date
  ): Promise<void> {
    // Placeholder - REST API fetching would go here
    // Similar logic to JS plugin but using axios
  }

  // ============================================================================
  // Graph Operations
  // ============================================================================

  /**
   * Add an edge to the graph, handling duplicates intelligently
   */
  private addEdgeToGraph(graph: RateGraph, edge: RateEdge): void {
    graph.nodes.add(edge.from);
    graph.nodes.add(edge.to);

    if (!graph.edges.has(edge.from)) {
      graph.edges.set(edge.from, new Map());
    }

    const existingEdge = graph.edges.get(edge.from)?.get(edge.to);
    
    // Keep the edge with higher confidence
    if (!existingEdge || edge.confidence > existingEdge.confidence) {
      graph.edges.get(edge.from)!.set(edge.to, edge);
    }
  }

  /**
   * Get direct edge from cache or providers
   */
  private async getDirectEdge(
    from: string,
    to: string,
    date: Date
  ): Promise<RateEdge | null> {
    // Check cache first
    const cachedRate = await this.rateRepository.findOne({
      where: {
        from_currency: from,
        to_currency: to,
        date: date,
      },
    });

    if (cachedRate) {
      const provider = await this.providerRepository.findOne({
        where: { id: cachedRate.provider_id },
      });

      return {
        from,
        to,
        rate: Number(cachedRate.rate),
        providerId: cachedRate.provider_id,
        providerName: provider?.name || 'unknown',
        timestamp: cachedRate.fetched_at,
        confidence: this.calculateConfidence(cachedRate.fetched_at),
      };
    }

    return null;
  }

  // ============================================================================
  // Path Finding (Dijkstra's Algorithm)
  // ============================================================================

  /**
   * Find the best path using Dijkstra's algorithm
   * Optimizes for highest effective rate (multiplicative)
   */
  private findBestPath(
    graph: RateGraph,
    from: string,
    to: string,
    options: { maxHops: number; minConfidence: number }
  ): PathResult | null {
    const { maxHops, minConfidence } = options;

    if (!graph.nodes.has(from) || !graph.nodes.has(to)) {
      return null;
    }

    // Distance map: stores negative log of rate for minimization
    // Using log to convert multiplicative to additive
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();
    const edgeUsed = new Map<string, RateEdge>();

    // Initialize distances
    for (const node of graph.nodes) {
      distances.set(node, node === from ? 0 : Infinity);
    }

    // Priority queue (min-heap by distance)
    const queue = new PriorityQueue<string>();
    queue.enqueue(from, 0);

    let hops = 0;

    while (!queue.isEmpty()) {
      const [current, currentDist] = queue.dequeue()!;

      // Skip if we've found a better path already
      if (currentDist > (distances.get(current) || Infinity)) {
        continue;
      }

      // Count hops from start
      if (current !== from) {
        const edge = edgeUsed.get(current);
        if (edge) {
          hops++;
        }
      }

      // Stop if we've reached target with too many hops
      if (current === to && hops > maxHops) {
        return null;
      }

      if (current === to) {
        break;
      }

      const edges = graph.edges.get(current);
      if (!edges) continue;

      for (const [next, edge] of edges) {
        if (edge.confidence < minConfidence) continue;

        // Calculate new distance (using log for numerical stability)
        // log(a * b) = log(a) + log(b)
        // We want to maximize rate, so minimize -log(rate)
        const edgeWeight = -Math.log(edge.rate);
        const newDist = currentDist + edgeWeight;

        const oldDist = distances.get(next) || Infinity;

        if (newDist < oldDist) {
          distances.set(next, newDist);
          predecessors.set(next, current);
          edgeUsed.set(next, edge);
          queue.enqueue(next, newDist);
        }
      }
    }

    // Reconstruct path
    if (!predecessors.has(to)) {
      return null;
    }

    const path: string[] = [];
    const pathEdges: RateEdge[] = [];
    let current = to;

    while (current !== from) {
      path.unshift(current);
      pathEdges.unshift(edgeUsed.get(current)!);
      current = predecessors.get(current)!;
    }
    path.unshift(from);

    // Calculate total rate from edges
    let totalRate = 1;
    for (const edge of pathEdges) {
      totalRate *= edge.rate;
    }

    return {
      path,
      totalRate,
      hops: pathEdges.length,
      edges: pathEdges,
    };
  }

  /**
   * Find all simple paths (DFS with limits)
   */
  private findAllPaths(
    graph: RateGraph,
    current: string,
    target: string,
    visited: Set<string>,
    currentPath: string[],
    results: PathResult[],
    maxResults: number,
    maxHops: number
  ): void {
    try {
      if (results.length >= maxResults) return;
      if (currentPath.length > maxHops + 1) return;

      if (current === target && currentPath.length > 1) {
        // Calculate total rate
        let totalRate = 1;
        const edges: RateEdge[] = [];

        for (let i = 0; i < currentPath.length - 1; i++) {
          const from = currentPath[i];
          const to = currentPath[i + 1];
          const edge = graph.edges.get(from)?.get(to);

          if (edge) {
            totalRate *= edge.rate;
            edges.push(edge);
          }
        }

        results.push({
          path: [...currentPath],
          totalRate,
          hops: currentPath.length - 1,
          edges,
        });
        return;
      }

      visited.add(current);

      const edges = graph.edges.get(current);
      if (edges) {
        for (const [next, edge] of edges) {
          // Prevent cycles by checking visited
          if (!visited.has(next)) {
            this.findAllPaths(
              graph,
              next,
              target,
              visited,
              [...currentPath, next],
              results,
              maxResults,
              maxHops
            );
          }
        }
      }
    } finally {
      visited.delete(current);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Calculate confidence based on data freshness
   */
  private calculateConfidence(fetchedAt: Date): number {
    const age = Date.now() - fetchedAt.getTime();
    const ageHours = age / (1000 * 60 * 60);

    // Confidence decays over time
    if (ageHours < 1) return 1.0;
    if (ageHours < 6) return 0.9;
    if (ageHours < 24) return 0.7;
    if (ageHours < 72) return 0.5;
    return 0.3;
  }

  /**
   * Generate cache key for a date
   */
  private getCacheKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Clear the graph cache
   */
  clearCache(): void {
    this.graphCache.clear();
  }

  /**
    * Get cache statistics
    */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.graphCache.size,
      keys: Array.from(this.graphCache.keys()),
    };
  }

  // ============================================================================
  // Rate History & Analytics (migrated from RateEngine)
  // ============================================================================

  /**
   * Get average rate over a date range
   */
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
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    const { fromDate, toDate } = options;

    // Use graph engine to find paths for each day in range
    const rates: number[] = [];
    let currentDate = new Date(fromDate);
    const endDate = new Date(toDate);

    while (currentDate <= endDate) {
      const result = await this.getRate(fromUpper, toUpper, { date: currentDate });
      if (result && result.rate > 0) {
        rates.push(result.rate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (rates.length === 0) {
      return {
        average_rate: 0,
        min_rate: 0,
        max_rate: 0,
        sample_count: 0,
      };
    }

    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    return {
      average_rate: parseFloat(avgRate.toFixed(8)),
      min_rate: parseFloat(minRate.toFixed(8)),
      max_rate: parseFloat(maxRate.toFixed(8)),
      sample_count: rates.length,
    };
  }

  /**
   * Get rate history using graph-based rate finding
   */
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
    const { fromDate, toDate, limit = 100 } = options;

    // Build date range
    const dates: Date[] = [];
    const startDate = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = toDate || new Date();

    let currentDate = new Date(startDate);
    while (currentDate <= endDate && dates.length < limit) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const rates: Array<{
      from: string;
      to: string;
      rate: number;
      date: Date;
      fetched_at: Date;
      provider_id: string;
    }> = [];

    for (const date of dates) {
      const result = await this.getRate(from.toUpperCase(), to.toUpperCase(), { date });
      if (result) {
        rates.push({
          from: result.from,
          to: result.to,
          rate: result.rate,
          date: date,
          fetched_at: result.timestamp,
          provider_id: result.source,
        });
      }
    }

    return {
      rates,
      total: rates.length,
    };
  }

  /**
   * Get rate trend analysis using graph-based rates
   */
  async getRateTrend(
    from: string,
    to: string,
    days: number = 30,
  ): Promise<{
    min_rate: number;
    max_rate: number;
    avg_rate: number;
    trend: 'up' | 'down' | 'stable';
    change_percent: number;
    history: Array<{ date: string; rate: number }>;
  }> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { rates } = await this.getRateHistory(from, to, {
      fromDate,
      toDate,
      limit: days,
    });

    if (rates.length === 0) {
      return {
        min_rate: 0,
        max_rate: 0,
        avg_rate: 0,
        trend: 'stable',
        change_percent: 0,
        history: [],
      };
    }

    const rateValues = rates.map(r => r.rate);
    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);
    const avgRate = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;

    const sortedRates = rates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstRate = sortedRates[0]?.rate || 0;
    const lastRate = sortedRates[sortedRates.length - 1]?.rate || 0;
    const changePercent = firstRate !== 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0;

    let trend: 'up' | 'down' | 'stable';
    if (changePercent > 1) trend = 'up';
    else if (changePercent < -1) trend = 'down';
    else trend = 'stable';

    return {
      min_rate: parseFloat(minRate.toFixed(8)),
      max_rate: parseFloat(maxRate.toFixed(8)),
      avg_rate: parseFloat(avgRate.toFixed(8)),
      trend,
      change_percent: parseFloat(changePercent.toFixed(2)),
      history: rates.map(r => ({
        date: r.date.toISOString().split('T')[0],
        rate: r.rate,
      })),
    };
  }

  /**
   * Get cross rate via intermediate currencies using graph path
   */
  async getCrossRate(from: string, to: string, via: string[] = ['USD']): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) return 1;

    // Use graph-based path finding to get the best rate
    const result = await this.getRate(from, to);
    return result?.rate || 1;
  }
}
