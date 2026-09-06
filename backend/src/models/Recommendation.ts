export type RecommendationModel = {
  id?: number;
  title?: string;
  description?: string;
  score?: number;
};

export class Recommendation {
  constructor(private data: RecommendationModel = {}) {}

  toJSON() {
    return this.data;
  }
}
