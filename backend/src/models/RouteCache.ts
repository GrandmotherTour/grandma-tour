export type RouteCacheModel = {
  key?: string;
  value?: unknown;
  updatedAt?: Date;
};

export class RouteCache {
  constructor(private data: RouteCacheModel = {}) {}

  toJSON() {
    return this.data;
  }
}
