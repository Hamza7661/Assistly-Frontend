import { HttpService } from './httpService';
import { ChatbotWorkflow, WorkflowListResponse, WorkflowResponse, WorkflowMutationResponse, QuestionType, WorkflowOption } from '@/models/ChatbotWorkflow';

class ChatbotWorkflowService extends HttpService {
  async list(includeInactive?: boolean): Promise<WorkflowListResponse> {
    const query = includeInactive ? '?includeInactive=true' : '';
    const res = await this.request<any>(`/chatbot-workflows${query}`);
    return {
      status: res.status,
      data: {
        workflows: res.data.workflows?.map((w: any) => ChatbotWorkflow.fromJson(w)) || [],
        count: res.data.count || 0
      }
    };
  }

  async get(id: string): Promise<WorkflowResponse> {
    const res = await this.request<any>(`/chatbot-workflows/${id}`);
    return {
      status: res.status,
      data: {
        workflow: ChatbotWorkflow.fromJson(res.data.workflow)
      }
    };
  }

  async create(workflow: Partial<ChatbotWorkflow>): Promise<WorkflowMutationResponse> {
    const payload = this.sanitizeWorkflow(workflow);
    const res = await this.request<any>(`/chatbot-workflows`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      status: res.status,
      message: res.message || 'Workflow created successfully',
      data: {
        workflow: res.data?.workflow ? ChatbotWorkflow.fromJson(res.data.workflow) : undefined
      }
    };
  }

  async update(id: string, workflow: Partial<ChatbotWorkflow>): Promise<WorkflowMutationResponse> {
    const payload = this.sanitizeWorkflow(workflow);
    const res = await this.request<any>(`/chatbot-workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return {
      status: res.status,
      message: res.message || 'Workflow updated successfully',
      data: {
        workflow: res.data?.workflow ? ChatbotWorkflow.fromJson(res.data.workflow) : undefined
      }
    };
  }

  async delete(id: string): Promise<WorkflowMutationResponse> {
    const res = await this.request<any>(`/chatbot-workflows/${id}`, {
      method: 'DELETE'
    });
    return {
      status: res.status,
      message: res.message || 'Workflow deleted successfully',
      data: {}
    };
  }

  async replace(workflows: Partial<ChatbotWorkflow>[]): Promise<WorkflowMutationResponse> {
    const payload = {
      workflows: workflows.map(w => this.sanitizeWorkflow(w))
    };
    const res = await this.request<any>(`/chatbot-workflows`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return {
      status: res.status,
      message: res.message || 'Workflows replaced successfully',
      data: {
        count: res.data?.count || 0,
        workflows: res.data?.workflows?.map((w: any) => ChatbotWorkflow.fromJson(w)) || []
      }
    };
  }

  // Public endpoint to get workflows (no auth)
  async getPublicWorkflows(ownerId: string): Promise<WorkflowListResponse> {
    const res = await this.request<any>(`/chatbot-workflows/public/${ownerId}`, {
      useAuth: false
    });
    return {
      status: res.status,
      data: {
        workflows: res.data.workflows?.map((w: any) => ChatbotWorkflow.fromJson(w)) || [],
        count: res.data.count || 0
      }
    };
  }

  private sanitizeWorkflow(workflow: Partial<ChatbotWorkflow>): any {
    const clean: any = {};
    
    if (workflow.title !== undefined) clean.title = workflow.title;
    if (workflow.question !== undefined) clean.question = workflow.question;
    if (workflow.questionType !== undefined) clean.questionType = workflow.questionType;
    if (workflow.options !== undefined) clean.options = workflow.options;
    if (workflow.isRoot !== undefined) clean.isRoot = workflow.isRoot;
    if (workflow.isActive !== undefined) clean.isActive = workflow.isActive;
    if (workflow.order !== undefined) clean.order = workflow.order;
    
    return clean;
  }
}

export const chatbotWorkflowService = new ChatbotWorkflowService();
export const useChatbotWorkflowService = () => import('./chatbotWorkflowService').then(m => m.chatbotWorkflowService);
