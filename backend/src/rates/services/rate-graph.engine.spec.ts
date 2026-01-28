import { Test, TestingModule } from '@nestjs/testing';
import { RateGraphEngine, RateEdge, RateGraph, PathResult } from './rate-graph.engine';

describe('RateGraphEngine', () => {
  let engine: RateGraphEngine;

  beforeEach(() => {
    engine = new RateGraphEngine();
  });

  describe('buildGraph', () => {
    it('should build graph with single rate', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      
      const graph = engine.buildGraph(rates, 'USD', 'rest:exchangerate-host');

      expect(graph.nodes.has('USD')).toBe(true);
      expect(graph.nodes.has('EUR')).toBe(true);
      expect(graph.edges.has('USD')).toBe(true);
      expect(graph.edges.has('EUR')).toBe(true);

      // Check USD -> EUR edge
      const usdToEur = graph.edges.get('USD')?.get('EUR');
      expect(usdToEur).toBeDefined();
      expect(usdToEur?.rate).toBe(0.92);

      // Check EUR -> USD edge (inverse)
      const eurToUsd = graph.edges.get('EUR')?.get('USD');
      expect(eurToUsd).toBeDefined();
      expect(eurToUsd?.rate).toBeCloseTo(1 / 0.92, 5);
    });

    it('should build graph with multiple rates', () => {
      const rates = new Map<string, number>([
        ['EUR', 0.92],
        ['GBP', 0.79],
        ['JPY', 149.5],
      ]);

      const graph = engine.buildGraph(rates, 'USD', 'rest:exchangerate-host');

      expect(graph.nodes.size).toBe(4); // USD + 3 currencies
      expect(graph.edges.get('USD')?.size).toBe(3);
    });

    it('should handle empty rates', () => {
      const rates = new Map<string, number>();
      const graph = engine.buildGraph(rates, 'USD', 'rest:exchangerate-host');

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('USD')).toBe(true);
    });
  });

  describe('findBestPath', () => {
    it('should return direct path for same currency', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      const result = engine.findBestPath(graph, 'USD', 'USD');

      expect(result).not.toBeNull();
      expect(result?.path).toEqual(['USD']);
      expect(result?.totalRate).toBe(1);
      expect(result?.hops).toBe(0);
    });

    it('should find direct path', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      const result = engine.findBestPath(graph, 'USD', 'EUR');

      expect(result).not.toBeNull();
      expect(result?.path).toEqual(['USD', 'EUR']);
      expect(result?.hops).toBe(1);
      expect(result?.totalRate).toBe(0.92);
    });

    it('should find path through intermediate currency', () => {
      // BTC -> USD (via provider A), USD -> EUR (via provider B)
      const graph: RateGraph = {
        nodes: new Set(['BTC', 'USD', 'EUR']),
        edges: new Map([
          ['BTC', new Map([
            ['USD', { from: 'BTC', to: 'USD', rate: 43000, providerId: 'crypto-provider', timestamp: new Date() }]
          ])],
          ['USD', new Map([
            ['EUR', { from: 'USD', to: 'EUR', rate: 0.92, providerId: 'fx-provider', timestamp: new Date() }]
          ])],
        ]),
      };

      const result = engine.findBestPath(graph, 'BTC', 'EUR');

      expect(result).not.toBeNull();
      expect(result?.path).toEqual(['BTC', 'USD', 'EUR']);
      expect(result?.hops).toBe(2);
      expect(result?.totalRate).toBeCloseTo(43000 * 0.92, 0);
    });

    it('should return null when no path exists', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      // Try to find path to currency not in graph
      const result = engine.findBestPath(graph, 'USD', 'XYZ');

      expect(result).toBeNull();
    });

    it('should respect maxHops limit', () => {
      // Create a graph that would require more than 5 hops
      const createEdge = (from: string, to: string, rate: number): RateEdge => ({
        from, to, rate, providerId: 'p', timestamp: new Date()
      });
      
      const graph: RateGraph = {
        nodes: new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
        edges: new Map([
          ['A', new Map([['B', createEdge('A', 'B', 1)]])],
          ['B', new Map([['C', createEdge('B', 'C', 1)]])],
          ['C', new Map([['D', createEdge('C', 'D', 1)]])],
          ['D', new Map([['E', createEdge('D', 'E', 1)]])],
          ['E', new Map([['F', createEdge('E', 'F', 1)]])],
          ['F', new Map([['G', createEdge('F', 'G', 1)]])],
        ]),
      };

      const result = engine.findBestPath(graph, 'A', 'G', { maxHops: 3 });

      // Should not find path due to hop limit
      expect(result).toBeNull();
    });
  });

  describe('findAllPaths', () => {
    it('should find multiple paths when available', () => {
      // Create graph with multiple paths: USD -> EUR directly and USD -> GBP -> EUR
      const graph: RateGraph = {
        nodes: new Set(['USD', 'EUR', 'GBP']),
        edges: new Map([
          ['USD', new Map([
            ['EUR', { from: 'USD', to: 'EUR', rate: 0.92, providerId: 'p1', timestamp: new Date() }],
            ['GBP', { from: 'USD', to: 'GBP', rate: 0.79, providerId: 'p1', timestamp: new Date() }]
          ])],
          ['GBP', new Map([
            ['EUR', { from: 'GBP', to: 'EUR', rate: 1.16, providerId: 'p2', timestamp: new Date() }]
          ])],
        ]),
      };

      const results = engine.findAllPaths(graph, 'USD', 'EUR', { maxPaths: 10, maxHops: 3 });

      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should find direct path
      expect(results.some(r => r.hops === 1)).toBe(true);
    });
  });

  describe('mergeGraphs', () => {
    it('should merge multiple graphs', () => {
      const graph1 = engine.buildGraph(new Map([['EUR', 0.92]]), 'USD', 'provider1');
      const graph2 = engine.buildGraph(new Map([['GBP', 0.79]]), 'USD', 'provider2');

      const merged = engine.mergeGraphs([graph1, graph2]);

      expect(merged.nodes.size).toBe(3);
      expect(merged.edges.get('USD')?.size).toBe(2);
    });

    it('should keep newer edge when merging', () => {
      const graph1: RateGraph = {
        nodes: new Set(['USD', 'EUR']),
        edges: new Map([
          ['USD', new Map([
            ['EUR', { from: 'USD', to: 'EUR', rate: 0.90, providerId: 'old', timestamp: new Date(Date.now() - 10000) }]
          ])],
        ]),
      };

      const graph2: RateGraph = {
        nodes: new Set(['USD', 'EUR']),
        edges: new Map([
          ['USD', new Map([
            ['EUR', { from: 'USD', to: 'EUR', rate: 0.92, providerId: 'new', timestamp: new Date() }]
          ])],
        ]),
      };

      const merged = engine.mergeGraphs([graph1, graph2]);
      const edge = merged.edges.get('USD')?.get('EUR');

      expect(edge?.rate).toBe(0.92);
      expect(edge?.providerId).toBe('new');
    });
  });

  describe('getDirectEdge', () => {
    it('should return direct edge', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      const edge = engine.getDirectEdge(graph, 'USD', 'EUR');

      expect(edge).toBeDefined();
      expect(edge?.rate).toBe(0.92);
    });

    it('should return null for non-existent edge', () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      const edge = engine.getDirectEdge(graph, 'USD', 'XYZ');

      expect(edge).toBeNull();
    });
  });

  describe('getGraphStats', () => {
    it('should return correct statistics', () => {
      const rates = new Map<string, number>([
        ['EUR', 0.92],
        ['GBP', 0.79],
        ['JPY', 149.5],
      ]);
      const graph = engine.buildGraph(rates, 'USD', 'provider');

      const stats = engine.getGraphStats(graph);

      expect(stats.nodeCount).toBe(4);
      expect(stats.edgeCount).toBe(6); // 3正向 + 3反向
      expect(stats.isConnected).toBe(true);
    });
  });

  describe('getRate (compatibility method)', () => {
    it('should return rate object', async () => {
      const rates = new Map<string, number>([['EUR', 0.92]]);
      engine.setGlobalGraph(engine.buildGraph(rates, 'USD', 'provider'));

      const result = await engine.getRate('USD', 'EUR');

      expect(result.rate).toBe(0.92);
    });

    it('should return 1 for same currency', async () => {
      const result = await engine.getRate('USD', 'USD');

      expect(result.rate).toBe(1);
    });
  });
});
