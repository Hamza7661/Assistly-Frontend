import { HttpService } from './httpService';
import { ChatbotWorkflow, WorkflowListResponse, WorkflowResponse, WorkflowMutationResponse, WorkflowOption, WorkflowGroup, WorkflowGroupListResponse } from '@/models/ChatbotWorkflow';

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

  // Get workflows grouped by workflow group
  async listGrouped(includeInactive?: boolean): Promise<WorkflowGroupListResponse> {
    const query = includeInactive ? '?includeInactive=true' : '';
    const res = await this.request<any>(`/chatbot-workflows/grouped${query}`);
    return {
      status: res.status,
      data: {
        workflows: res.data.workflows?.map((group: any) => {
          // Ensure rootQuestion exists before parsing
          if (!group.rootQuestion) {
            console.warn('Workflow group missing rootQuestion', group);
            return null;
          }
          return {
            _id: group._id,
            title: group.title,
            isActive: group.isActive,
            rootQuestion: ChatbotWorkflow.fromJson(group.rootQuestion),
            questions: group.questions?.map((q: any) => ChatbotWorkflow.fromJson(q)) || []
          };
        }).filter((g: any) => g !== null) || [],
        count: res.data.count || 0
      }
    };
  }

  // Public endpoint to get workflows (no auth)
  async getPublicWorkflows(ownerId: string): Promise<WorkflowListResponse> {
    const res = await this.request<any>(`/chatbot-workflows/public/${ownerId}`);
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
    if (workflow.questionTypeId !== undefined) clean.questionTypeId = workflow.questionTypeId;
    if (workflow.workflowGroupId !== undefined) clean.workflowGroupId = workflow.workflowGroupId;
    if (workflow.isRoot !== undefined) clean.isRoot = workflow.isRoot;
    if (workflow.isActive !== undefined) clean.isActive = workflow.isActive;
    if (workflow.order !== undefined) clean.order = workflow.order;
    
    return clean;
  }
}

export const chatbotWorkflowService = new ChatbotWorkflowService();
export const useChatbotWorkflowService = () => import('./chatbotWorkflowService').then(m => m.chatbotWorkflowService);
