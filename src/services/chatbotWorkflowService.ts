import { HttpService } from './httpService';
import { ChatbotWorkflow, WorkflowListResponse, WorkflowResponse, WorkflowMutationResponse, WorkflowOption, WorkflowGroup, WorkflowGroupListResponse, WorkflowAttachment } from '@/models/ChatbotWorkflow';

class ChatbotWorkflowService extends HttpService {
  async list(appId: string, includeInactive?: boolean): Promise<WorkflowListResponse> {
    const query = includeInactive ? '?includeInactive=true' : '';
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}${query}`);
    return {
      status: res.status,
      data: {
        workflows: res.data.workflows?.map((w: any) => ChatbotWorkflow.fromJson(w)) || [],
        count: res.data.count || 0
      }
    };
  }

  async get(appId: string, id: string): Promise<WorkflowResponse> {
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/${id}`);
    return {
      status: res.status,
      data: {
        workflow: ChatbotWorkflow.fromJson(res.data.workflow)
      }
    };
  }

  async create(appId: string, workflow: Partial<ChatbotWorkflow>): Promise<WorkflowMutationResponse> {
    const payload = this.sanitizeWorkflow(workflow);
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}`, {
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

  async update(appId: string, id: string, workflow: Partial<ChatbotWorkflow>): Promise<WorkflowMutationResponse> {
    const payload = this.sanitizeWorkflow(workflow);
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/${id}`, {
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

  async delete(appId: string, id: string): Promise<WorkflowMutationResponse> {
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/${id}`, {
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
  async listGrouped(appId: string, includeInactive?: boolean): Promise<WorkflowGroupListResponse> {
    const query = includeInactive ? '?includeInactive=true' : '';
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/grouped${query}`);
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

  async uploadAttachment(appId: string, workflowId: string, file: File): Promise<{ status: string; data: { attachment: WorkflowAttachment } }> {
    const formData = new FormData();
    formData.append('attachment', file);
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/${workflowId}/attachment`, {
      method: 'PUT',
      body: formData
    });
    return res;
  }

  async deleteAttachment(appId: string, workflowId: string): Promise<{ status: string; message: string }> {
    const res = await this.request<any>(`/chatbot-workflows/apps/${appId}/${workflowId}/attachment`, {
      method: 'DELETE'
    });
    return res;
  }

  getAttachmentUrl(appId: string, workflowId: string): string {
    const base = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    return `${base}/chatbot-workflows/apps/${appId}/${workflowId}/attachment`;
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
    if (workflow.options !== undefined) clean.options = workflow.options;
    
    return clean;
  }
}

export const chatbotWorkflowService = new ChatbotWorkflowService();
export const useChatbotWorkflowService = () => import('./chatbotWorkflowService').then(m => m.chatbotWorkflowService);
