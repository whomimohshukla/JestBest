export type NodeId = string;

export type GraphState = Record<string, unknown>;

export interface GraphNode<State extends GraphState> {
  id: NodeId;
  run: (state: State) => State | Partial<State> | Promise<State | Partial<State>>;
}

export interface GraphEdge<State extends GraphState> {
  from: NodeId;
  condition?: (state: State) => string;
  routes: Record<string, NodeId>;
  to?: NodeId;
}

export interface GraphTrace {
  visited: NodeId[];
  steps: number;
}

export interface GraphRunResult<State extends GraphState> {
  state: State;
  trace: GraphTrace;
}

const START_ID = '__start__';
const END_ID = '__end__';

const isEnd = (nodeId: NodeId): boolean => nodeId === END_ID;

export class StateGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateGraphError';
  }
}

export class StateGraphBuilder<State extends GraphState> {
  private readonly nodes = new Map<NodeId, GraphNode<State>>();
  private readonly edges: GraphEdge<State>[] = [];

  node(id: NodeId, run: GraphNode<State>['run']): this {
    if (this.nodes.has(id)) {
      throw new StateGraphError(`Duplicate node "${id}".`);
    }
    this.nodes.set(id, { id, run });
    return this;
  }

  addEdge(from: NodeId, to: NodeId): this {
    this.edges.push({ from, routes: {}, to });
    return this;
  }

  addConditionalEdges(
    from: NodeId,
    condition: (state: State) => string,
    routes: Record<string, NodeId>
  ): this {
    this.edges.push({ from, condition, routes });
    return this;
  }

  compile(start: NodeId = START_ID, end: NodeId = END_ID): StateGraph<State> {
    const referenced = new Set<NodeId>([start, end]);
    for (const edge of this.edges) {
      referenced.add(edge.from);
      if (edge.to) referenced.add(edge.to);
      for (const target of Object.values(edge.routes)) referenced.add(target);
    }

    const missing = [...referenced].filter((id) => !this.nodes.has(id) && !isEnd(id));
    if (missing.length > 0) {
      throw new StateGraphError(`Graph references undefined node(s): ${missing.join(', ')}`);
    }
    if (!this.nodes.has(start)) {
      throw new StateGraphError(`Start node "${start}" is not registered.`);
    }

    const adjacency = new Map<
      NodeId,
      { condition?: (state: State) => string; routes: Record<string, NodeId>; to?: NodeId }
    >();
    for (const edge of this.edges) {
      if (edge.condition) {
        adjacency.set(edge.from, { condition: edge.condition, routes: edge.routes });
      } else if (edge.to) {
        adjacency.set(edge.from, { routes: {}, to: edge.to });
      }
    }

    return new StateGraph<State>(this.nodes, adjacency, start, end);
  }
}

export class StateGraph<State extends GraphState> {
  constructor(
    private readonly nodes: Map<NodeId, GraphNode<State>>,
    private readonly adjacency: Map<
      NodeId,
      { condition?: (state: State) => string; routes: Record<string, NodeId>; to?: NodeId }
    >,
    private readonly start: NodeId,
    private readonly end: NodeId,
    private readonly maxSteps = 32
  ) {}

  get startNode(): NodeId {
    return this.start;
  }

  get endNode(): NodeId {
    return this.end;
  }

  async invoke(initialState: State): Promise<GraphRunResult<State>> {
    const state: State = { ...initialState };
    const visited: NodeId[] = [];
    let current: NodeId = this.start;

    for (let step = 0; step < this.maxSteps; step++) {
      if (isEnd(current)) {
        return { state, trace: { visited, steps: step } };
      }

      const node = this.nodes.get(current);
      if (!node) {
        throw new StateGraphError(`Unknown node "${current}" reached at step ${step}.`);
      }

      visited.push(current);
      const patch = await node.run(state);
      Object.assign(state, patch);

      const edge = this.adjacency.get(current);
      if (edge?.to) {
        current = edge.to;
        continue;
      }
      if (edge?.condition) {
        const target = edge.condition(state);
        current = edge.routes[target];
        if (!current) {
          throw new StateGraphError(`Condition of "${current}" returned unknown route "${target}".`);
        }
        continue;
      }

      throw new StateGraphError(`Node "${current}" has no outgoing edge.`);
    }

    throw new StateGraphError(
      `State graph exceeded ${this.maxSteps} steps. Possible cycle: ${visited.slice(-8).join(' → ')}`
    );
  }
}
