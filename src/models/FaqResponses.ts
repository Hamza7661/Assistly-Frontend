import { QuestionnareItem } from './QuestionnareItem';

export class FaqListResponse {
  status: string;
  data: { faqs: QuestionnareItem[]; count: number };

  constructor(json: any) {
    this.status = json.status;
    const raw = (json?.data?.faqs ?? json?.data?.items ?? []) as any[];
    const list = raw.map((f: any) => new QuestionnareItem(f));
    this.data = {
      faqs: list,
      count: json?.data?.count ?? list.length,
    };
  }
}

export class FaqMutationResponse {
  status: string;
  message?: string;
  data: { faq: Faq };

  constructor(json: any) {
    this.status = json.status;
    this.message = json.message;
    this.data = { faq: new Faq(json.data?.faq) };
  }
}


