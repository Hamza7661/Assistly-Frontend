export class TreatmentPlan {
  _id?: string;
  owner?: string;
  title: string;
  description: string;
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: Partial<TreatmentPlan> = {}) {
    this._id = data._id;
    this.owner = data.owner;
    this.title = data.title || '';
    this.description = data.description || '';
    this.tags = data.tags || [];
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromJson(json: any): TreatmentPlan {
    return new TreatmentPlan(json);
  }

  toJson(): any {
    return {
      _id: this._id,
      owner: this.owner,
      title: this.title,
      description: this.description,
      tags: this.tags,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}


