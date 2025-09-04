import { HttpService } from './httpService';
import { QuestionnareItem } from '@/models/QuestionnareItem';
import { QuestionnareType } from '@/enums/QuestionnareType';
import { FaqListResponse, FaqMutationResponse } from '@/models/FaqResponses';
import { QuestionnareType } from '@/enums/QuestionnareType';

class FaqService extends HttpService {
  async getUserFaqs(type?: QuestionnareType): Promise<FaqListResponse> {
    const query = typeof type === 'number' ? `?type=${type}` : '';
    const res = await this.request<any>(`/questionnaire${query}`);
    return new FaqListResponse(res);
  }

  async upsertUserFaqs(type: QuestionnareType, items: Array<Pick<QuestionnareItem, 'question' | 'answer'>>): Promise<FaqMutationResponse | FaqListResponse> {
    const payload = { type, items: items.map(it => ({ question: it.question, answer: it.answer })) } as any;
    const res = await this.request<any>(`/questionnaire`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res?.data?.faq) return new FaqMutationResponse(res);
    return new FaqListResponse(res);
  }
}

export const faqService = new FaqService();

export const useFaqService = () => import('./faqService').then(m => m.faqService);


