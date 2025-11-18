import { HttpService } from './httpService';
import { FaqListResponse, FaqMutationResponse } from '@/models/FaqResponses';
import { QuestionnareType } from '@/enums/QuestionnareType';
import { Faq } from '@/models/Faq';

class QuestionnareService extends HttpService {
  async list(type?: QuestionnareType): Promise<FaqListResponse> {
    const query = typeof type === 'number' ? `?type=${type}` : '';
    const res = await this.request<any>(`/questionnaire${query}`);
    return new FaqListResponse(res);
  }

  async upsert(type: QuestionnareType, items: Array<Pick<Faq, 'question' | 'answer'> & { attachedWorkflows?: any[] }>): Promise<FaqMutationResponse | FaqListResponse> {
    const payload = { 
      type, 
      items: items.map(it => ({ 
        question: it.question, 
        answer: it.answer,
        attachedWorkflows: (it as any).attachedWorkflows || []
      })) 
    } as any;
    const res = await this.request<any>(`/questionnaire`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res?.data?.faq) return new FaqMutationResponse(res);
    return new FaqListResponse(res);
  }
}

export const questionnareService = new QuestionnareService();
export const useQuestionnareService = () => import('./questionnareService').then(m => m.questionnareService);


