export type PlaceModel = {
  id?: number;
  name?: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export class Place {
  constructor(private data: PlaceModel = {}) {}

  toJSON() {
    return this.data;
  }
}
