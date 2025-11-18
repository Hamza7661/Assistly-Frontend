import { HttpService } from './httpService';
import type { QuestionTypeResponse, QuestionTypeItem } from '@/models/QuestionType';

class QuestionTypeService extends HttpService {
  async getQuestionTypes(): Promise<QuestionTypeResponse> {
    return this.request<QuestionTypeResponse>('/question-types', { method: 'GET' });
  }
}

export const questionTypeService = new QuestionTypeService();
export const useQuestionTypeService = () => import('./questionTypeService').then(m => m.questionTypeService);

