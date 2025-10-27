export type QuestionType = 'single_choice' | 'multiple_choice' | 'text_input' | 'number_input' | 'email_input' | 'phone_input';

export interface WorkflowOption {
  _id?: string;
  text: string;
  nextQuestionId?: string | null;
  isTerminal?: boolean;
  order?: number;
}

export interface ChatbotWorkflowItem {
  _id?: string;
  owner?: string;
  title: string;
  question: string;
  questionType: QuestionType;
  options: WorkflowOption[];
  isRoot?: boolean;
  isActive?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export class ChatbotWorkflow {
  _id?: string;
  owner?: string;
  title: string;
  question: string;
  questionType: QuestionType;
  options: WorkflowOption[];
  isRoot: boolean;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: Partial<ChatbotWorkflow> = {}) {
    this._id = data._id;
    this.owner = data.owner;
    this.title = data.title || '';
    this.question = data.question || '';
    this.questionType = data.questionType || 'single_choice';
    this.options = data.options || [];
    this.isRoot = data.isRoot ?? false;
    this.isActive = data.isActive ?? true;
    this.order = data.order ?? 0;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromJson(json: any): ChatbotWorkflow {
    return new ChatbotWorkflow(json);
  }

  toJson(): any {
    return {
      _id: this._id,
      owner: this.owner,
      title: this.title,
      question: this.question,
      questionType: this.questionType,
      options: this.options,
      isRoot: this.isRoot,
      isActive: this.isActive,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export interface WorkflowListResponse {
  status: 'success' | 'fail';
  data: {
    workflows: ChatbotWorkflow[];
    count: number;
  };
}

export interface WorkflowResponse {
  status: 'success' | 'fail';
  data: {
    workflow: ChatbotWorkflow;
  };
}

export interface WorkflowMutationResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    workflow?: ChatbotWorkflow;
    count?: number;
    workflows?: ChatbotWorkflow[];
  };
}
