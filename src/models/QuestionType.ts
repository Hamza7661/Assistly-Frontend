export interface QuestionTypeItem {
  id: number;
  code: string;
  value: string;
}

export interface QuestionTypeResponse {
  status: 'success' | 'fail';
  data: {
    questionTypes: QuestionTypeItem[];
  };
}

