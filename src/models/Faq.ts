import { QuestionnareType } from '@/enums/QuestionnareType';
export class Faq {
  _id?: string;
  owner?: string;
  question: string;
  answer: string;
  tags: string[];
  isActive?: boolean;
  type?: QuestionnareType;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: Partial<Faq> = {}) {
    this._id = data._id;
    this.owner = data.owner;
    this.question = data.question || '';
    this.answer = data.answer || '';
    this.tags = data.tags || [];
    this.isActive = data.isActive;
    this.type = (data as any).type ?? QuestionnareType.FAQ;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromJson(json: any): Faq {
    return new Faq(json);
  }

  toJson(): any {
    return {
      _id: this._id,
      owner: this.owner,
      question: this.question,
      answer: this.answer,
      tags: this.tags,
      isActive: this.isActive,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}


