import { Injectable, Logger } from '@nestjs/common';

/**
 * 图边
 */
export interface RateEdge {
  from: string;
  to: string;
  rate: number;
  providerId: string;
  timestamp: Date;
}

/**
 * 汇率图
 */
export interface RateGraph {
  nodes: Set<string>;
  edges: Map<string, Map<string, RateEdge>>;
}

/**
 * 路径查找结果
 */
export interface PathResult {
  path: string[];           // ['BTC', 'ETH', 'USD']
  totalRate: number;        // 累积汇率
  hops: number;             // 跳数
  edges: RateEdge[];        // 使用的边
}

/**
 * Rate Graph Engine
 * 
 * 图算法核心:
 * - 单图设计: 所有 Providers 的汇率合并到同一张图
 * - Dijkstra 算法: 查找最优兑换路径
 * - 多跳支持: 最多 5 跳 (BTC → USD → EUR)
 * 
 * 图算法的价值:
 * - 连接不同 Provider (法币 + 加密 + 大宗商品)
 * - 自动发现最优兑换路径
 */
@Injectable()
export class RateGraphEngine {
  private readonly logger = new Logger(RateGraphEngine.name);

  /**
   * 构建汇率图
   * 
   * @param rates Map<货币对, 汇率> (如 "EUR" -> 0.92)
   * @param baseCurrency 基础货币
   * @param providerId 提供者 ID
   * @returns RateGraph
   */
  buildGraph(
    rates: Map<string, number>,
    baseCurrency: string,
    providerId: string
  ): RateGraph {
    const graph: RateGraph = {
      nodes: new Set([baseCurrency]),
      edges: new Map(),
    };

    for (const [currency, rate] of rates) {
      const upperCurrency = currency.toUpperCase();
      
      graph.nodes.add(upperCurrency);

      // 添加正向边 (Base → Currency)
      this.addEdge(graph, baseCurrency, upperCurrency, rate, providerId);

      // 添加反向边 (Currency → Base)
      const inverseRate = 1 / rate;
      this.addEdge(graph, upperCurrency, baseCurrency, inverseRate, providerId);
    }

    return graph;
  }

  /**
   * 合并多个图 (单图设计)
   * 
   * 将多个 Provider 的图合并为一张图
   * 相同边保留高置信度的 (新数据)
   */
  mergeGraphs(graphs: RateGraph[]): RateGraph {
    const merged: RateGraph = {
      nodes: new Set(),
      edges: new Map(),
    };

    for (const graph of graphs) {
      // 合并节点
      for (const node of graph.nodes) {
        merged.nodes.add(node);
      }

      // 合并边
      for (const [from, edges] of graph.edges) {
        if (!merged.edges.has(from)) {
          merged.edges.set(from, new Map());
        }

        for (const [to, edge] of edges) {
          const existing = merged.edges.get(from)?.get(to);
          
          // 保留新的边 (更高的 rate 通常意味着更准确)
          if (!existing || edge.timestamp > existing.timestamp) {
            merged.edges.get(from)!.set(to, edge);
          }
        }
      }
    }

    return merged;
  }

  /**
   * 使用 Dijkstra 算法查找最优路径
   * 
   * @param graph 汇率图
   * @param from 起始货币
   * @param to 目标货币
   * @param maxHops 最大跳数 (默认 5)
   * @returns PathResult 或 null (找不到路径)
   */
  findBestPath(
    graph: RateGraph,
    from: string,
    to: string,
    options: { maxHops?: number } = {}
  ): PathResult | null {
    const { maxHops = 5 } = options;

    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // 同货币检查
    if (fromUpper === toUpper) {
      return {
        path: [fromUpper],
        totalRate: 1,
        hops: 0,
        edges: [],
      };
    }

    // 节点存在性检查
    if (!graph.nodes.has(fromUpper) || !graph.nodes.has(toUpper)) {
      return null;
    }

    // Dijkstra 最短路径 (使用 -log(rate) 作为权重)
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();
    const edgeUsed = new Map<string, RateEdge>();
    const depths = new Map<string, number>();

    // 初始化
    for (const node of graph.nodes) {
      distances.set(node, node === fromUpper ? 0 : Infinity);
      depths.set(node, 0);
    }

    // 优先级队列 (min-heap)
    const queue: string[] = [fromUpper];
    
    while (queue.length > 0) {
      // 找到最小距离的节点
      let current = queue[0];
      let currentDist = distances.get(current)!;
      
      for (let i = 1; i < queue.length; i++) {
        const dist = distances.get(queue[i])!;
        if (dist < currentDist) {
          current = queue[i];
          currentDist = dist;
        }
      }

      // 从队列移除
      queue.splice(queue.indexOf(current), 1);

      // 达到目标
      if (current === toUpper) {
        break;
      }

      // 跳过深度超限
      const currentDepth = depths.get(current) || 0;
      if (currentDepth >= maxHops) {
        continue;
      }

      // 遍历邻居
      const edges = graph.edges.get(current);
      if (!edges) continue;

      for (const [next, edge] of edges) {
        const newDepth = currentDepth + 1;
        if (newDepth > maxHops) continue;

        // 计算新距离 (使用 log 转换乘法为加法)
        const edgeWeight = -Math.log(edge.rate);
        const newDist = currentDist + edgeWeight;
        const oldDist = distances.get(next) || Infinity;

        if (newDist < oldDist) {
          distances.set(next, newDist);
          predecessors.set(next, current);
          edgeUsed.set(next, edge);
          depths.set(next, newDepth);

          // 添加到队列
          if (!queue.includes(next)) {
            queue.push(next);
          }
        }
      }
    }

    // 检查是否找到路径
    if (!predecessors.has(toUpper)) {
      return null;
    }

    // 重建路径
    const path: string[] = [];
    const pathEdges: RateEdge[] = [];
    let current = toUpper;

    while (current !== fromUpper) {
      path.unshift(current);
      pathEdges.unshift(edgeUsed.get(current)!);
      current = predecessors.get(current)!;
    }
    path.unshift(fromUpper);

    // 计算总汇率
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
   * 查找所有可用路径 (DFS)
   */
  findAllPaths(
    graph: RateGraph,
    from: string,
    to: string,
    options: { maxPaths?: number; maxHops?: number } = {}
  ): PathResult[] {
    const { maxPaths = 10, maxHops = 5 } = options;

    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    const results: PathResult[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [fromUpper];

    const dfs = (current: string): void => {
      if (results.length >= maxPaths) return;
      if (currentPath.length > maxHops + 1) return;

      if (current === toUpper && currentPath.length > 1) {
        // 计算总汇率
        let totalRate = 1;
        const pathEdges: RateEdge[] = [];

        for (let i = 0; i < currentPath.length - 1; i++) {
          const fromNode = currentPath[i];
          const toNode = currentPath[i + 1];
          const edge = graph.edges.get(fromNode)?.get(toNode);

          if (edge) {
            totalRate *= edge.rate;
            pathEdges.push(edge);
          }
        }

        results.push({
          path: [...currentPath],
          totalRate,
          hops: currentPath.length - 1,
          edges: pathEdges,
        });
        return;
      }

      visited.add(current);

      const edges = graph.edges.get(current);
      if (edges) {
        for (const [next, edge] of edges) {
          if (!visited.has(next)) {
            currentPath.push(next);
            dfs(next);
            currentPath.pop();
          }
        }
      }

      visited.delete(current);
    };

    dfs(fromUpper);

    // 按汇率降序排序
    results.sort((a, b) => b.totalRate - a.totalRate);

    return results;
  }

  /**
   * 获取两个货币之间的直接边
   */
  getDirectEdge(
    graph: RateGraph,
    from: string,
    to: string
  ): RateEdge | null {
    return graph.edges.get(from.toUpperCase())?.get(to.toUpperCase()) || null;
  }

  /**
   * 获取节点的所有邻居
   */
  getNeighbors(graph: RateGraph, node: string): string[] {
    const edges = graph.edges.get(node.toUpperCase());
    return edges ? Array.from(edges.keys()) : [];
  }

  /**
   * 获取图的统计信息
   */
  getGraphStats(graph: RateGraph): {
    nodeCount: number;
    edgeCount: number;
    isConnected: boolean;
  } {
    let edgeCount = 0;
    for (const edges of graph.edges.values()) {
      edgeCount += edges.size;
    }

    // 简单判断是否连通 (从任意节点能到达多少节点)
    const nodes = Array.from(graph.nodes);
    let maxReachable = 0;
    
    for (const start of nodes.slice(0, 3)) {  // 采样检查
      const reachable = new Set<string>([start]);
      const queue = [start];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = this.getNeighbors(graph, current);
        
        for (const neighbor of neighbors) {
          if (!reachable.has(neighbor)) {
            reachable.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      
      maxReachable = Math.max(maxReachable, reachable.size);
    }

    return {
      nodeCount: graph.nodes.size,
      edgeCount,
      isConnected: maxReachable === graph.nodes.size,
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 添加边到图
   */
  private addEdge(
    graph: RateGraph,
    from: string,
    to: string,
    rate: number,
    providerId: string
  ): void {
    if (!graph.edges.has(from)) {
      graph.edges.set(from, new Map());
    }

    graph.edges.get(from)!.set(to, {
      from,
      to,
      rate,
      providerId,
      timestamp: new Date(),
    });
  }

  // ==================== 兼容旧 API ====================

  /**
   * 获取汇率 (兼容旧 API)
   * 
   * @deprecated 使用 RateFetchService.getRate 替代
   * @param from 源货币
   * @param to 目标货币
   * @param options.date 可选的日期
   * @returns 包含 rate 属性的对象
   */
  async getRate(
    from: string,
    to: string,
    options: { date?: Date } = {}
  ): Promise<{ rate: number }> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (fromUpper === toUpper) {
      return { rate: 1 };
    }

    // 直接查找边
    const edge = this.getDirectEdge(this.getGlobalGraph(), fromUpper, toUpper);
    
    if (edge) {
      return { rate: edge.rate };
    }

    // 查找路径
    const pathResult = this.findBestPath(this.getGlobalGraph(), fromUpper, toUpper);
    
    return { rate: pathResult?.totalRate || 1 };
  }

  /**
   * 获取全局图 (用于兼容旧 API)
   * 实际使用时应该由 RateFetchService 构建和管理图
   */
  private globalGraph: RateGraph = {
    nodes: new Set(),
    edges: new Map(),
  };

  getGlobalGraph(): RateGraph {
    return this.globalGraph;
  }

  setGlobalGraph(graph: RateGraph): void {
    this.globalGraph = graph;
  }
}
