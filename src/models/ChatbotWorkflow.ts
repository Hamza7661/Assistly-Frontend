import type { QuestionTypeItem } from '@/models/QuestionType';

// Helper function to get question type display value from ID
export function formatQuestionType(questionTypeId: number | null | undefined, questionTypes: QuestionTypeItem[]): string {
  if (!questionTypeId || questionTypeId === 0) return '';
  const item = questionTypes.find(qt => qt.id === questionTypeId);
  return item?.value || '';
}

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
  questionTypeId?: number;
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
  workflowGroupId?: string | null;
  title: string;
  question: string;
  questionTypeId?: number;
  options: WorkflowOption[];
  isRoot: boolean;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: Partial<ChatbotWorkflow> = {}) {
    this._id = data._id;
    this.owner = data.owner;
    this.workflowGroupId = data.workflowGroupId;
    this.title = data.title || '';
    this.question = data.question || '';
    this.questionTypeId = data.questionTypeId ?? 0;
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
      workflowGroupId: this.workflowGroupId,
      title: this.title,
      question: this.question,
      questionTypeId: this.questionTypeId,
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

export interface WorkflowGroup {
  _id: string;
  title: string;
  isActive: boolean;
  rootQuestion: ChatbotWorkflow;
  questions: ChatbotWorkflow[];
}

export interface WorkflowGroupListResponse {
  status: 'success' | 'fail';
  data: {
    workflows: WorkflowGroup[];
    count: number;
  };
}
