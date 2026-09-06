export type UserModel = {
  id?: number;
  name?: string;
  email?: string;
};

export class User {
  constructor(private data: UserModel = {}) {}

  toJSON() {
    return this.data;
  }
}
