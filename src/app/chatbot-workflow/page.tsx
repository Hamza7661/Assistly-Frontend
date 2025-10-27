'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChatbotWorkflowService } from '@/services';
import { ChatbotWorkflow, WorkflowOption, QuestionType } from '@/models/ChatbotWorkflow';
import { toast } from 'react-toastify';
import { Trash2, Plus, Save, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function ChatbotWorkflowPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<ChatbotWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [newWorkflow, setNewWorkflow] = useState<Partial<ChatbotWorkflow>>({
    title: '',
    question: '',
    questionType: 'single_choice',
    options: [],
    isRoot: false,
    isActive: true,
    order: 0
  });

  const loadWorkflows = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const service = await useChatbotWorkflowService();
      const response = await service.list(true);
      setWorkflows(response.data.workflows);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [user?._id]);

  const handleAddWorkflow = () => {
    setNewWorkflow({
      title: '',
      question: '',
      questionType: 'single_choice',
      options: [{ text: '', isTerminal: false, order: 0 }],
      isRoot: false,
      isActive: true,
      order: workflows.length
    });
    setEditingWorkflow('new');
  };

  const handleSaveWorkflow = async () => {
    if (!user?._id || !editingWorkflow) return;
    
    setSaving(true);
    try {
      const service = await useChatbotWorkflowService();
      
      // Validate workflow
      if (!newWorkflow.title?.trim() || !newWorkflow.question?.trim()) {
        toast.error('Title and question are required');
        setSaving(false);
        return;
      }

      if (editingWorkflow === 'new') {
        await service.create(newWorkflow);
        toast.success('Workflow created successfully');
      } else {
        await service.update(editingWorkflow, newWorkflow);
        toast.success('Workflow updated successfully');
      }
      
      await loadWorkflows();
      setEditingWorkflow(null);
      setNewWorkflow({
        title: '',
        question: '',
        questionType: 'single_choice',
        options: [],
        isRoot: false,
        isActive: true,
        order: 0
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingWorkflow(null);
    setNewWorkflow({
      title: '',
      question: '',
      questionType: 'single_choice',
      options: [],
      isRoot: false,
      isActive: true,
      order: 0
    });
  };

  const handleEditWorkflow = (workflow: ChatbotWorkflow) => {
    setNewWorkflow(workflow);
    setEditingWorkflow(workflow._id || null);
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      const service = await useChatbotWorkflowService();
      await service.delete(id);
      toast.success('Workflow deleted successfully');
      await loadWorkflows();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workflow');
    }
  };

  const handleAddOption = () => {
    setNewWorkflow(prev => ({
      ...prev,
      options: [...(prev.options || []), { text: '', isTerminal: false, order: (prev.options?.length || 0) }]
    }));
  };

  const handleRemoveOption = (index: number) => {
    setNewWorkflow(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || []
    }));
  };

  const handleUpdateOption = (index: number, field: keyof WorkflowOption, value: any) => {
    setNewWorkflow(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? { ...opt, [field]: value } : opt) || []
    }));
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWorkflows(newExpanded);
  };

  const getLinkedWorkflow = (nextQuestionId?: string | null) => {
    if (!nextQuestionId) return null;
    return workflows.find(w => w._id === nextQuestionId);
  };

  return (
    <ProtectedRoute>
      <div className="bg-gray-50 min-h-screen">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chatbot Workflows</h1>
              <p className="text-gray-600 mt-2">Design interactive question workflows for your chatbot</p>
              <p className="text-sm text-gray-500 mt-1">
                • Link options to create conversation flows • Mark questions as Root to start workflows • Mark options as Terminal to end flows
              </p>
            </div>
            <button
              onClick={handleAddWorkflow}
              className="btn-primary flex items-center gap-2"
              disabled={editingWorkflow !== null}
            >
              <Plus className="h-5 w-5" />
              Add Workflow
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.length === 0 && !editingWorkflow && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <p className="text-gray-500">No workflows yet. Create your first workflow to get started.</p>
                </div>
              )}

              {/* Edit/New Workflow Form */}
              {editingWorkflow && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {editingWorkflow === 'new' ? 'Create Workflow' : 'Edit Workflow'}
                    </h2>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newWorkflow.title || ''}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, title: e.target.value })}
                        className="input-field"
                        placeholder="Enter workflow title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newWorkflow.question || ''}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, question: e.target.value })}
                        className="input-field"
                        rows={3}
                        placeholder="Enter the question to ask users"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question Type
                      </label>
                      <select
                        value={newWorkflow.questionType || 'single_choice'}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, questionType: e.target.value as QuestionType })}
                        className="input-field"
                      >
                        <option value="single_choice">Single Choice (Buttons)</option>
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="text_input">Text Input</option>
                        <option value="number_input">Number Input</option>
                        <option value="email_input">Email Input</option>
                        <option value="phone_input">Phone Input</option>
                      </select>
                    </div>

                    {/* Options for choice-based questions */}
                    {(newWorkflow.questionType === 'single_choice' || newWorkflow.questionType === 'multiple_choice') && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Options
                          </label>
                          <button
                            onClick={handleAddOption}
                            className="btn-secondary flex items-center gap-1 text-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Add Option
                          </button>
                        </div>
                        <div className="space-y-3">
                          {newWorkflow.options?.map((option, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => handleUpdateOption(index, 'text', e.target.value)}
                                  className="input-field flex-1"
                                  placeholder="Option text"
                                />
                                <button
                                  onClick={() => handleRemoveOption(index)}
                                  className="btn-secondary text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center text-sm">
                                  <input
                                    type="checkbox"
                                    checked={option.isTerminal || false}
                                    onChange={(e) => handleUpdateOption(index, 'isTerminal', e.target.checked)}
                                    className="mr-2"
                                  />
                                  Terminal (ends conversation)
                                </label>
                                {!option.isTerminal && (
                                  <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Link to Next Question:
                                    </label>
                                    <select
                                      value={option.nextQuestionId || ''}
                                      onChange={(e) => handleUpdateOption(index, 'nextQuestionId', e.target.value || null)}
                                      className="input-field text-sm"
                                    >
                                      <option value="">-- Select next question --</option>
                                      {workflows
                                        .filter(w => w._id !== editingWorkflow && w.isActive)
                                        .map(workflow => (
                                          <option key={workflow._id} value={workflow._id}>
                                            {workflow.title}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newWorkflow.isRoot || false}
                          onChange={(e) => setNewWorkflow({ ...newWorkflow, isRoot: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Root Question</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newWorkflow.isActive ?? true}
                          onChange={(e) => setNewWorkflow({ ...newWorkflow, isActive: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Active</span>
                      </label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleSaveWorkflow}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Save className="h-5 w-5" />
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Workflows */}
              {workflows.map((workflow) => (
                <div key={workflow._id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => workflow._id && toggleExpanded(workflow._id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedWorkflows.has(workflow._id || '') ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                        <div>
                          <h3 className="font-semibold text-gray-900">{workflow.title}</h3>
                          <p className="text-sm text-gray-600">{workflow.question}</p>
                        </div>
                        {workflow.isRoot && (
                          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                            Root
                          </span>
                        )}
                        {!workflow.isActive && (
                          <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditWorkflow(workflow)}
                        className="btn-secondary"
                        disabled={editingWorkflow !== null}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => workflow._id && handleDeleteWorkflow(workflow._id)}
                        className="btn-secondary text-red-600 hover:text-red-700"
                        disabled={editingWorkflow !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                    {expandedWorkflows.has(workflow._id || '') && (
                    <div className="px-4 pb-4 border-t border-gray-200">
                      <div className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Question Type:</span> {workflow.questionType}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Order:</span> {workflow.order || 0}
                          </p>
                        </div>
                        {workflow.options && workflow.options.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Answer Options:</p>
                            <div className="space-y-2">
                              {workflow.options.map((option, idx) => {
                                const linkedWorkflow = getLinkedWorkflow(option.nextQuestionId);
                                return (
                                  <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded border">
                                    <span className="text-sm font-medium text-gray-700">• {option.text}</span>
                                    <div className="flex gap-2 ml-auto">
                                      {option.isTerminal && (
                                        <span className="px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                                          Terminal
                                        </span>
                                      )}
                                      {linkedWorkflow && (
                                        <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded flex items-center gap-1">
                                          <span>→</span> {linkedWorkflow.title}
                                        </span>
                                      )}
                                      {!option.isTerminal && !linkedWorkflow && (
                                        <span className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded">
                                          No next question
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
