'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useChatbotWorkflowService } from '@/services';
import { ChatbotWorkflow, WorkflowGroup, WorkflowOption, formatQuestionType } from '@/models/ChatbotWorkflow';
import { useQuestionTypeService } from '@/services';
import type { QuestionTypeItem } from '@/models/QuestionType';
import { toast } from 'react-toastify';
import { Trash2, Plus, Save, Edit2, X, ChevronDown, ChevronUp, Folder, MessageSquare, GripVertical, Paperclip, Link2, Upload, FileText, AlertCircle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function ChatbotWorkflowPageContent() {
  const { user } = useAuth();
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workflowGroups, setWorkflowGroups] = useState<WorkflowGroup[]>([]);
  const [allQuestions, setAllQuestions] = useState<ChatbotWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editingWorkflowGroupId, setEditingWorkflowGroupId] = useState<string | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeItem[]>([]);
  const [newQuestion, setNewQuestion] = useState<Partial<ChatbotWorkflow>>({
    title: '',
    question: '',
    questionTypeId: 0,
    options: [],
    isRoot: false,
    isActive: true,
    order: 0
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionIdToDelete, setQuestionIdToDelete] = useState<string | null>(null);
  const [creatingNewWorkflow, setCreatingNewWorkflow] = useState(false);
  const [reorderingQuestions, setReorderingQuestions] = useState<Record<string, ChatbotWorkflow[]>>({});

  // Attachment state
  const [pendingAttachmentFile, setPendingAttachmentFile] = useState<File | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadWorkflows = async (): Promise<WorkflowGroup[]> => {
    if (!currentApp?.id) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const service = await useChatbotWorkflowService();
      const groupedResponse = await service.listGrouped(currentApp.id, true);
      setWorkflowGroups(groupedResponse.data.workflows);
      
      const allResponse = await service.list(currentApp.id, true);
      setAllQuestions(allResponse.data.workflows);
      
      setReorderingQuestions({});
      
      const workflowId = searchParams.get('workflowId');
      if (workflowId) {
        const targetGroup = groupedResponse.data.workflows.find(
          group => group.rootQuestion._id === workflowId
        );
        if (targetGroup) {
          setExpandedWorkflows(new Set([targetGroup._id]));
          setTimeout(() => {
            const element = document.querySelector(`[data-workflow-id="${targetGroup._id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
      
      return groupedResponse.data.workflows;
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workflows');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentApp?.id) {
      loadWorkflows();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, currentApp?.id]);

  useEffect(() => {
    const loadQuestionTypes = async () => {
      try {
        const service = await useQuestionTypeService();
        const response = await service.getQuestionTypes();
        if (response.status === 'success' && response.data?.questionTypes) {
          setQuestionTypes(response.data.questionTypes);
          if ((!newQuestion.questionTypeId || newQuestion.questionTypeId === 0) && response.data.questionTypes.length > 0) {
            setNewQuestion(prev => ({ ...prev, questionTypeId: response.data.questionTypes[0].id }));
          }
        }
      } catch (error) {
        console.error('Failed to load question types:', error);
      }
    };
    loadQuestionTypes();
  }, []);

  const handleCreateNewWorkflow = () => {
    setNewQuestion({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      options: [],
      isRoot: true,
      isActive: true,
      order: 0,
      workflowGroupId: null
    });
    setPendingAttachmentFile(null);
    setCreatingNewWorkflow(true);
    setEditingQuestion('new-workflow');
  };

  const handleAddQuestionToWorkflow = (workflowGroupId: string) => {
    const questionsInWorkflow = getQuestionsForWorkflow(workflowGroupId);
    const nextOrder = questionsInWorkflow.length;
    setNewQuestion({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      options: [],
      isRoot: false,
      isActive: true,
      order: nextOrder,
      workflowGroupId: workflowGroupId
    });
    setPendingAttachmentFile(null);
    setEditingWorkflowGroupId(workflowGroupId);
    setEditingQuestion('new-question');
  };

  const handleSaveQuestion = async () => {
    if (!currentApp?.id || !editingQuestion) return;
    
    setSaving(true);
    try {
      const service = await useChatbotWorkflowService();
      
      if (!newQuestion.question?.trim()) {
        toast.error('Question is required');
        setSaving(false);
        return;
      }

      const questionData = {
        ...newQuestion,
        title: newQuestion.title?.trim() || newQuestion.question.trim().substring(0, 100),
        questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0
      };

      let savedWorkflowId: string | null = null;
      if (editingQuestion === 'new-workflow' || editingQuestion === 'new-question') {
        const createResponse = await service.create(currentApp.id, questionData);
        savedWorkflowId = createResponse.data?.workflow?._id || null;
        toast.success(creatingNewWorkflow ? 'Workflow created successfully' : 'Question added successfully');
      } else {
        savedWorkflowId = editingQuestion;
        await service.update(currentApp.id, editingQuestion, questionData);
        toast.success('Question updated successfully');
      }

      // Upload attachment if a new file was selected
      if (savedWorkflowId && pendingAttachmentFile) {
        try {
          await service.uploadAttachment(currentApp.id, savedWorkflowId, pendingAttachmentFile);
          toast.success('Attachment uploaded successfully');
        } catch (attachErr: any) {
          toast.error(attachErr.message || 'Failed to upload attachment');
        }
        setPendingAttachmentFile(null);
      }

      // Handle attachment removal for existing questions
      if (savedWorkflowId && removingAttachment && !pendingAttachmentFile) {
        try {
          await service.deleteAttachment(currentApp.id, savedWorkflowId);
        } catch {}
        setRemovingAttachment(false);
      }
      
      const loadedWorkflowGroups = await loadWorkflows();
      
      if (creatingNewWorkflow && savedWorkflowId) {
        const newWorkflowGroup = loadedWorkflowGroups.find(
          group => group.rootQuestion._id === savedWorkflowId
        );
        if (newWorkflowGroup) {
          setExpandedWorkflows(prev => new Set([...prev, newWorkflowGroup._id]));
          setTimeout(() => {
            const element = document.querySelector(`[data-workflow-id="${newWorkflowGroup._id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
      
      setEditingQuestion(null);
      setEditingWorkflowGroupId(null);
      setCreatingNewWorkflow(false);
      setNewQuestion({
        title: '',
        question: '',
        questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
        options: [],
        isRoot: false,
        isActive: true,
        order: 0
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setEditingWorkflowGroupId(null);
    setCreatingNewWorkflow(false);
    setPendingAttachmentFile(null);
    setRemovingAttachment(false);
    setNewQuestion({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      options: [],
      isRoot: false,
      isActive: true,
      order: 0
    });
  };

  const handleEditQuestion = (question: ChatbotWorkflow) => {
    setNewQuestion({
      ...question,
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0
    });
    setPendingAttachmentFile(null);
    setRemovingAttachment(false);
    setEditingQuestion(question._id || null);
    setEditingWorkflowGroupId(question.workflowGroupId || null);
  };

  const handleDeleteQuestion = async () => {
    if (!questionIdToDelete) return;
    try {
      const service = await useChatbotWorkflowService();
      
      const questionToDelete = allQuestions.find(q => q._id === questionIdToDelete);
      const workflowGroupId = questionToDelete?.workflowGroupId;
      const deletedOrder = questionToDelete?.order ?? 0;
      
      await service.delete(currentApp.id, questionIdToDelete);
      
      if (workflowGroupId) {
        const remainingQuestions = allQuestions
          .filter(q => q.workflowGroupId === workflowGroupId && !q.isRoot && q._id !== questionIdToDelete)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        const reorderPromises = remainingQuestions
          .map((q, index) => {
            const newOrder = index;
            if (q.order !== newOrder) {
              return service.update(currentApp.id, q._id!, { order: newOrder });
            }
            return null;
          })
          .filter(p => p !== null);
        
        if (reorderPromises.length > 0) {
          await Promise.all(reorderPromises);
        }
      }
      
      toast.success('Question deleted successfully');
      await loadWorkflows();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete question');
    } finally {
      setQuestionIdToDelete(null);
      setShowDeleteModal(false);
    }
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

  const getQuestionsForWorkflow = (workflowGroupId: string) => {
    const questions = allQuestions.filter(q => q.workflowGroupId === workflowGroupId && !q.isRoot);
    if (reorderingQuestions[workflowGroupId]) {
      return reorderingQuestions[workflowGroupId];
    }
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  };
  
  const getActiveQuestionsForWorkflow = (workflowGroupId: string): ChatbotWorkflow[] => {
    return allQuestions
      .filter(q => q.workflowGroupId === workflowGroupId && !q.isRoot && q.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const handleDragEnd = async (event: DragEndEvent, workflowGroupId: string) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const questions = getQuestionsForWorkflow(workflowGroupId);
      const oldIndex = questions.findIndex(q => q._id === active.id);
      const newIndex = questions.findIndex(q => q._id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(questions, oldIndex, newIndex);
        
        setReorderingQuestions(prev => ({
          ...prev,
          [workflowGroupId]: reordered
        }));

        try {
          const service = await useChatbotWorkflowService();
          const updatePromises = reordered
            .map((question, index) => {
              if (question.order !== index) {
                return service.update(currentApp.id, question._id!, { order: index });
              }
              return null;
            })
            .filter(p => p !== null);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            toast.success('Question order updated successfully');
          }
          
          await loadWorkflows();
        } catch (error: any) {
          toast.error(error.message || 'Failed to update question order');
          await loadWorkflows();
        }
      }
    }
  };

  // Options editor helpers
  const addOption = () => {
    setNewQuestion(prev => ({
      ...prev,
      options: [...(prev.options || []), { text: '', nextQuestionId: null, isTerminal: false, order: (prev.options || []).length }]
    }));
  };

  const updateOption = (idx: number, field: keyof WorkflowOption, value: any) => {
    setNewQuestion(prev => {
      const opts = [...(prev.options || [])];
      opts[idx] = { ...opts[idx], [field]: value };
      return { ...prev, options: opts };
    });
  };

  const removeOption = (idx: number) => {
    setNewQuestion(prev => {
      const opts = (prev.options || []).filter((_, i) => i !== idx);
      return { ...prev, options: opts };
    });
  };

  // Attachment handler
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 25MB');
        return;
      }
      setPendingAttachmentFile(file);
      setRemovingAttachment(false);
    }
  };

  // Questions that can be linked (for branching dropdowns)
  const getLinkableQuestions = () => {
    const currentGroupId = newQuestion.workflowGroupId;
    return allQuestions.filter(q => 
      q._id !== editingQuestion && 
      q._id &&
      (currentGroupId ? q.workflowGroupId === currentGroupId : true)
    );
  };

  // Sortable Question Item Component
  const SortableQuestionItem = ({ 
    question, 
    index,
    onEdit,
    onDelete,
    disabled,
  }: { 
    question: ChatbotWorkflow; 
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    disabled: boolean;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: question._id || '',
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const hasOptions = question.options && question.options.length > 0;
    const hasAttachment = question.attachment?.hasFile;

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50"
      >
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0 touch-none"
            disabled={disabled}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1.5 min-w-0">
                  <MessageSquare className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-gray-900 break-words min-w-0 flex-1">{question.question}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    question.isActive ? 'text-blue-700 bg-blue-100' : 'text-gray-500 bg-gray-200'
                  }`}>
                    {question.isActive ? `#${index + 1}` : 'Inactive'}
                  </span>
                  {question.isActive ? (
                    <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">Inactive</span>
                  )}
                  {hasOptions && (
                    <span className="px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {question.options!.length} option{question.options!.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {hasAttachment && (
                    <span className="px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {question.attachment!.filename || 'File attached'}
                    </span>
                  )}
                </div>
                {/* Show options preview */}
                {hasOptions && (
                  <div className="mt-2 ml-6 space-y-1">
                    {question.options!.map((opt, oi) => {
                      const linkedQ = opt.nextQuestionId ? allQuestions.find(q => q._id === opt.nextQuestionId) : null;
                      return (
                        <div key={oi} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px] shrink-0">{oi + 1}</span>
                          <span className="font-medium">{opt.text}</span>
                          {linkedQ && (
                            <span className="text-purple-600 flex items-center gap-0.5">
                              <Link2 className="h-3 w-3" />
                              → {linkedQ.question.substring(0, 40)}{linkedQ.question.length > 40 ? '…' : ''}
                            </span>
                          )}
                          {opt.isTerminal && <span className="text-red-500">(ends flow)</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  disabled={disabled}
                  title="Edit Question"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded border border-gray-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-50"
                  disabled={disabled}
                  title="Delete Question"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className="bg-gray-50 min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00bc7d]"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!currentApp || !currentApp.id) {
    return (
      <ProtectedRoute>
        <div className="bg-gray-50 min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <NoAppEmptyState
                title="Build Your Conversation Flows"
                description="Create an app first to start building interactive conversation flows and chatbot workflows. Each app comes with industry-specific default flows that you can customize."
              />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="bg-gray-50 min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Conversations</h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">Create conversation flows and add questions to build interactive dialogues</p>
                <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                  • Create a flow to group related questions • Add multiple-choice options for branching • Attach PDFs for users to download
                </p>
              </div>
              <button
                onClick={handleCreateNewWorkflow}
                className="btn-primary flex items-center gap-2 self-start shrink-0"
                disabled={editingQuestion !== null}
              >
                <Plus className="h-4 w-4" />
                Create Flow
              </button>
            </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {workflowGroups.length === 0 && !editingQuestion && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-2">No conversation flows yet</p>
                  <p className="text-gray-400 text-sm mb-4">Create your first conversation flow to get started</p>
                  <button
                    onClick={handleCreateNewWorkflow}
                    className="btn-primary"
                  >
                    Create Flow
                  </button>
                </div>
              )}

              {workflowGroups.map((group) => {
                const questionsInWorkflow = getQuestionsForWorkflow(group._id);
                const activeQuestionsInWorkflow = getActiveQuestionsForWorkflow(group._id);
                const isExpanded = expandedWorkflows.has(group._id);
                
                return (
                  <div 
                    key={group._id} 
                    data-workflow-id={group._id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Workflow Header */}
                    <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-[#00bc7d]/5 to-transparent">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <Folder className="h-5 w-5 text-[#00bc7d] shrink-0 mt-0.5" />
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{group.rootQuestion.question}</h3>
                            <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded shrink-0">Root</span>
                            {!group.isActive && (
                              <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded shrink-0">Inactive</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 ml-7 text-xs text-gray-500">
                            <span>{activeQuestionsInWorkflow.length} active question{activeQuestionsInWorkflow.length !== 1 ? 's' : ''}</span>
                            {questionsInWorkflow.length > activeQuestionsInWorkflow.length && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-400">{questionsInWorkflow.length - activeQuestionsInWorkflow.length} inactive</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => toggleExpanded(group._id)}
                            className="btn-secondary p-2"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleEditQuestion(group.rootQuestion)}
                            className="btn-secondary p-2"
                            disabled={editingQuestion !== null}
                            title="Edit Root Question"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setQuestionIdToDelete(group.rootQuestion._id ?? null); setShowDeleteModal(true); }}
                            className="btn-secondary p-2 text-red-600 hover:text-red-700"
                            disabled={editingQuestion !== null}
                            title="Delete Workflow"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Workflow Content */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6">
                        <div className="mb-4">
                          <button
                            onClick={() => handleAddQuestionToWorkflow(group._id)}
                            className="btn-secondary flex items-center gap-2 text-sm w-full sm:w-auto justify-center sm:justify-start"
                            disabled={editingQuestion !== null}
                          >
                            <Plus className="h-4 w-4" />
                            Add Question to This Flow
                          </button>
                        </div>

                        {questionsInWorkflow.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No questions in this flow yet</p>
                          </div>
                        ) : (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => handleDragEnd(event, group._id)}
                          >
                            <SortableContext
                              items={questionsInWorkflow.map(q => q._id || '')}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                {questionsInWorkflow.map((question, index) => {
                                  const activeQuestions = getActiveQuestionsForWorkflow(group._id);
                                  const activeIndex = activeQuestions.findIndex(aq => aq._id === question._id);
                                  const displayIndex = activeIndex >= 0 ? activeIndex : index;
                                  
                                  return (
                                    <SortableQuestionItem
                                      key={question._id}
                                      question={question}
                                      index={displayIndex}
                                      onEdit={() => handleEditQuestion(question)}
                                      onDelete={() => { setQuestionIdToDelete(question._id ?? null); setShowDeleteModal(true); }}
                                      disabled={editingQuestion !== null}
                                    />
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Create New Workflow Modal */}
        {editingQuestion === 'new-workflow' && (
          <div className="fixed z-50 inset-0 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
                <h2 className="text-base sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Folder className="h-5 w-5 text-[#00bc7d]" />
                  Create New Conversation Flow
                </h2>
                <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 sm:p-6">{renderQuestionForm(true)}</div>
            </div>
          </div>
        )}

        {/* Add Question Modal */}
        {editingQuestion === 'new-question' && editingWorkflowGroupId && (
          <div className="fixed z-50 inset-0 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
                <h2 className="text-base sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Add Question to Flow
                </h2>
                <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 sm:p-6">{renderQuestionForm(false)}</div>
            </div>
          </div>
        )}

        {/* Edit Question Modal */}
        {editingQuestion && editingQuestion !== 'new-workflow' && editingQuestion !== 'new-question' && (
          <div className="fixed z-50 inset-0 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
                <h2 className="text-base sm:text-xl font-semibold text-gray-900">Edit Question</h2>
                <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 sm:p-6">{renderQuestionForm(false)}</div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed z-50 inset-0 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 shadow-lg w-full sm:max-w-md">
              <h2 className="text-base font-semibold mb-2 text-gray-900">Confirm Deletion</h2>
              <p className="mb-5 text-sm text-gray-700">Are you sure you want to delete this question? This action cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => { setShowDeleteModal(false); setQuestionIdToDelete(null); }}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteQuestion}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );

  function renderQuestionForm(isRoot: boolean) {
    const options = newQuestion.options || [];
    const linkableQuestions = getLinkableQuestions();
    const hasExistingAttachment = newQuestion.attachment?.hasFile && !removingAttachment;

    return (
      <div className="space-y-5">
        {/* Question text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isRoot ? 'Opening Message / Title' : 'Question'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={newQuestion.question || ''}
            onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
            className="input-field w-full"
            rows={3}
            placeholder={isRoot ? "Enter the opening message for this flow" : "Enter the question to ask users"}
          />
        </div>

        {/* ── Multiple-choice options (branching) ─────────────────────────── */}
        {!isRoot && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-purple-600" />
                  Multiple-Choice Options (Branching)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add options so users can choose a scenario. Each option can lead to a different next question.
                </p>
              </div>
              <button
                type="button"
                onClick={addOption}
                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Option
              </button>
            </div>

            {options.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                No options yet — the chatbot will expect a free-text reply. Add options to offer clickable choices.
              </p>
            )}

            {options.map((opt, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    className="input-field flex-1 text-sm py-1"
                    placeholder="Option text (e.g. I'm a job seeker)"
                    value={opt.text}
                    onChange={(e) => updateOption(idx, 'text', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-red-400 hover:text-red-600 p-1 shrink-0"
                    title="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="ml-7 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">→ Next question (leave blank for sequential)</label>
                    <select
                      className="input-field w-full text-xs py-1"
                      value={opt.nextQuestionId || ''}
                      onChange={(e) => updateOption(idx, 'nextQuestionId', e.target.value || null)}
                    >
                      <option value="">Sequential (next in order)</option>
                      {linkableQuestions.map(q => (
                        <option key={q._id} value={q._id}>
                          {q.question.substring(0, 60)}{q.question.length > 60 ? '…' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 sm:mt-5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.isTerminal || false}
                        onChange={(e) => updateOption(idx, 'isTerminal', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600">End flow</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── File attachment (PDF, Word, etc.) ───────────────────────────── */}
        {!isRoot && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-orange-600" />
                File Attachment
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Attach a PDF, Word doc, or other file. Users will see a download button in the chat (web &amp; WhatsApp).
              </p>
            </div>

            {/* Existing attachment info */}
            {hasExistingAttachment && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <FileText className="h-4 w-4 text-orange-600 shrink-0" />
                <span className="text-sm text-orange-800 flex-1 truncate">{newQuestion.attachment!.filename}</span>
                <button
                  type="button"
                  onClick={() => { setRemovingAttachment(true); setPendingAttachmentFile(null); }}
                  className="text-red-400 hover:text-red-600 p-1 shrink-0"
                  title="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Pending new file */}
            {pendingAttachmentFile && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm text-blue-800 flex-1 truncate">{pendingAttachmentFile.name}</span>
                <span className="text-xs text-blue-500 shrink-0">
                  {(pendingAttachmentFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => setPendingAttachmentFile(null)}
                  className="text-red-400 hover:text-red-600 p-1 shrink-0"
                  title="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Upload button */}
            {!pendingAttachmentFile && (
              <div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {hasExistingAttachment ? 'Replace File' : 'Attach File'}
                </button>
                <p className="text-xs text-gray-400 mt-1">Supported: PDF, Word, Excel, images · Max 25MB</p>
              </div>
            )}
          </div>
        )}

        {/* Active toggle */}
        <div className="flex items-center justify-end">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={newQuestion.isActive ?? true}
              onChange={(e) => setNewQuestion({ ...newQuestion, isActive: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSaveQuestion}
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
    );
  }
}

function ChatbotWorkflowPageFallback() {
  const { isOpen: isSidebarOpen } = useSidebar();
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} container mx-auto px-4 py-8`}>
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function ChatbotWorkflowPage() {
  return (
    <Suspense fallback={<ChatbotWorkflowPageFallback />}>
      <ChatbotWorkflowPageContent />
    </Suspense>
  );
}
