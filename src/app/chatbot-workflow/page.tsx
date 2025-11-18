'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChatbotWorkflowService } from '@/services';
import { ChatbotWorkflow, WorkflowGroup, formatQuestionType } from '@/models/ChatbotWorkflow';
import { useQuestionTypeService } from '@/services';
import type { QuestionTypeItem } from '@/models/QuestionType';
import { toast } from 'react-toastify';
import { Trash2, Plus, Save, Edit2, X, ChevronDown, ChevronUp, Folder, MessageSquare, GripVertical } from 'lucide-react';
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
    isRoot: false,
    isActive: true,
    order: 0
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionIdToDelete, setQuestionIdToDelete] = useState<string | null>(null);
  const [creatingNewWorkflow, setCreatingNewWorkflow] = useState(false);
  const [reorderingQuestions, setReorderingQuestions] = useState<Record<string, ChatbotWorkflow[]>>({});

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadWorkflows = async (): Promise<WorkflowGroup[]> => {
    if (!user?._id) return [];
    setLoading(true);
    try {
      const service = await useChatbotWorkflowService();
      const groupedResponse = await service.listGrouped(true);
      setWorkflowGroups(groupedResponse.data.workflows);
      
      // Also load all questions for linking
      const allResponse = await service.list(true);
      setAllQuestions(allResponse.data.workflows);
      
      // Clear reordering state on reload
      setReorderingQuestions({});
      
      // Check for workflowId query parameter and expand that workflow
      const workflowId = searchParams.get('workflowId');
      if (workflowId) {
        // Find the workflow group where the root question matches the workflowId
        const targetGroup = groupedResponse.data.workflows.find(
          group => group.rootQuestion._id === workflowId
        );
        if (targetGroup) {
          setExpandedWorkflows(new Set([targetGroup._id]));
          // Scroll to the workflow after a short delay to ensure it's rendered
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
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Fetch question types from API
  useEffect(() => {
    const loadQuestionTypes = async () => {
      try {
        const service = await useQuestionTypeService();
        const response = await service.getQuestionTypes();
        if (response.status === 'success' && response.data?.questionTypes) {
          setQuestionTypes(response.data.questionTypes);
          // Set default question type if not set
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
      isRoot: true,
      isActive: true,
      order: 0,
      workflowGroupId: null
    });
    setCreatingNewWorkflow(true);
    setEditingQuestion('new-workflow');
  };

  const handleAddQuestionToWorkflow = (workflowGroupId: string) => {
    const questionsInWorkflow = getQuestionsForWorkflow(workflowGroupId);
    const nextOrder = questionsInWorkflow.length; // Set order to the next available index
    setNewQuestion({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      isRoot: false,
      isActive: true,
      order: nextOrder,
      workflowGroupId: workflowGroupId
    });
    setEditingWorkflowGroupId(workflowGroupId);
    setEditingQuestion('new-question');
  };

  const handleSaveQuestion = async () => {
    if (!user?._id || !editingQuestion) return;
    
    setSaving(true);
    try {
      const service = await useChatbotWorkflowService();
      
      // Validate question
      if (!newQuestion.question?.trim()) {
        toast.error('Question is required');
        setSaving(false);
        return;
      }

      // Auto-generate title from question if not provided
      // All questions are text_response type, automatically linked in order
      const questionData = {
        ...newQuestion,
        title: newQuestion.title?.trim() || newQuestion.question.trim().substring(0, 100),
        questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0
      };

      let createdWorkflowId: string | null = null;
      if (editingQuestion === 'new-workflow' || editingQuestion === 'new-question') {
        const createResponse = await service.create(questionData);
        createdWorkflowId = createResponse.data?.workflow?._id || null;
        toast.success(creatingNewWorkflow ? 'Workflow created successfully' : 'Question added successfully');
      } else {
        await service.update(editingQuestion, questionData);
        toast.success('Question updated successfully');
      }
      
      const loadedWorkflowGroups = await loadWorkflows();
      
      // If a new workflow was created, expand its accordion
      if (creatingNewWorkflow && createdWorkflowId) {
        // Find the workflow group that contains this root question
        const newWorkflowGroup = loadedWorkflowGroups.find(
          group => group.rootQuestion._id === createdWorkflowId
        );
        if (newWorkflowGroup) {
          setExpandedWorkflows(prev => new Set([...prev, newWorkflowGroup._id]));
          // Scroll to the workflow after a short delay to ensure it's rendered
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
    setNewQuestion({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
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
    setEditingQuestion(question._id || null);
    setEditingWorkflowGroupId(question.workflowGroupId || null);
  };

  const handleDeleteQuestion = async () => {
    if (!questionIdToDelete) return;
    try {
      const service = await useChatbotWorkflowService();
      
      // Find the question being deleted to get its workflow group and order
      const questionToDelete = allQuestions.find(q => q._id === questionIdToDelete);
      const workflowGroupId = questionToDelete?.workflowGroupId;
      const deletedOrder = questionToDelete?.order ?? 0;
      
      // Delete the question
      await service.delete(questionIdToDelete);
      
      // If it was part of a workflow, reorder remaining questions
      if (workflowGroupId) {
        const remainingQuestions = allQuestions
          .filter(q => q.workflowGroupId === workflowGroupId && !q.isRoot && q._id !== questionIdToDelete)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Update orders for questions that came after the deleted one
        const reorderPromises = remainingQuestions
          .map((q, index) => {
            const newOrder = index;
            if (q.order !== newOrder && (q.order || 0) > deletedOrder) {
              return service.update(q._id!, { order: newOrder });
            } else if (q.order !== newOrder) {
              return service.update(q._id!, { order: newOrder });
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

  const getLinkedQuestion = (nextQuestionId?: string | null) => {
    if (!nextQuestionId) return null;
    return allQuestions.find(q => q._id === nextQuestionId);
  };

  const getQuestionsForWorkflow = (workflowGroupId: string) => {
    const questions = allQuestions.filter(q => q.workflowGroupId === workflowGroupId && !q.isRoot);
    // Use reordered questions if available, otherwise use sorted by order
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
        
        // Update local state immediately for better UX
        setReorderingQuestions(prev => ({
          ...prev,
          [workflowGroupId]: reordered
        }));

        // Update order values and save to backend
        try {
          const service = await useChatbotWorkflowService();
          const updatePromises = reordered
            .map((question, index) => {
              // Only update if order actually changed
              if (question.order !== index) {
                return service.update(question._id!, { order: index });
              }
              return null;
            })
            .filter(p => p !== null);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            toast.success('Question order updated successfully');
          }
          
          // Reload to sync with backend
          await loadWorkflows();
        } catch (error: any) {
          toast.error(error.message || 'Failed to update question order');
          // Reload on error to revert
          await loadWorkflows();
        }
      }
    }
  };

  // Sortable Question Item Component
  const SortableQuestionItem = ({ 
    question, 
    index,
    onEdit,
    onDelete,
    disabled,
    activeQuestionsCount
  }: { 
    question: ChatbotWorkflow; 
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    disabled: boolean;
    activeQuestionsCount?: number;
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

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
              disabled={disabled}
              title="Drag to reorder"
            >
              <GripVertical className="h-5 w-5" />
            </button>
            
            {/* Order Badge */}
            <span className={`px-2 py-0.5 text-xs font-medium rounded mt-1 ${
              question.isActive 
                ? 'text-blue-700 bg-blue-100' 
                : 'text-gray-500 bg-gray-200'
            }`}>
              {question.isActive ? `Order: ${index + 1}` : 'Inactive'}
            </span>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900">{question.question}</h4>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {question.questionTypeId && (
                  <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                    {formatQuestionType(question.questionTypeId, questionTypes)}
                  </span>
                )}
                {question.isActive ? (
                  <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={onEdit}
              className="btn-secondary"
              disabled={disabled}
              title="Edit Question"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="btn-secondary text-red-600 hover:text-red-700"
              disabled={disabled}
              title="Delete Question"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="bg-gray-50 min-h-screen">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
              <p className="text-gray-600 mt-2">Create conversation flows and add questions to build interactive dialogues</p>
              <p className="text-sm text-gray-500 mt-1">
                • Create a conversation flow to group related questions • Add questions within each flow • Link questions to create conversation paths
              </p>
            </div>
            <button
              onClick={handleCreateNewWorkflow}
              className="btn-primary flex items-center gap-2"
              disabled={editingQuestion !== null}
            >
              <Plus className="h-5 w-5" />
              Create Flow
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Workflow Groups */}
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
                    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#00bc7d]/5 to-transparent">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Folder className="h-6 w-6 text-[#00bc7d]" />
                            <h3 className="text-xl font-semibold text-gray-900">{group.rootQuestion.question}</h3>
                            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                              Root
                            </span>
                            {!group.isActive && (
                              <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 ml-9">{group.rootQuestion.question}</p>
                          <div className="flex items-center gap-4 mt-3 ml-9 text-sm text-gray-500">
                            <span>Type: {formatQuestionType(group.rootQuestion.questionTypeId, questionTypes)}</span>
                            <span>•</span>
                            <span>{activeQuestionsInWorkflow.length} active question{activeQuestionsInWorkflow.length !== 1 ? 's' : ''}</span>
                            {questionsInWorkflow.length > activeQuestionsInWorkflow.length && (
                              <>
                                <span>•</span>
                                <span className="text-gray-400">{questionsInWorkflow.length - activeQuestionsInWorkflow.length} inactive</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleExpanded(group._id)}
                            className="btn-secondary"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleEditQuestion(group.rootQuestion)}
                            className="btn-secondary"
                            disabled={editingQuestion !== null}
                            title="Edit Root Question"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setQuestionIdToDelete(group.rootQuestion._id ?? null); setShowDeleteModal(true); }}
                            className="btn-secondary text-red-600 hover:text-red-700"
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
                      <div className="p-6">
                        {/* Add Question Button */}
                        <div className="mb-4">
                          <button
                            onClick={() => handleAddQuestionToWorkflow(group._id)}
                            className="btn-secondary flex items-center gap-2 text-sm"
                            disabled={editingQuestion !== null}
                          >
                            <Plus className="h-4 w-4" />
                            Add Question to This Flow
                          </button>
                        </div>

                        {/* Questions in Workflow */}
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
                                  // Calculate display order based on active questions only
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
                                      activeQuestionsCount={activeQuestions.length}
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

        {/* Create New Flow Modal */}
        {editingQuestion === 'new-workflow' && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50" onClick={handleCancelEdit}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Folder className="h-5 w-5 text-[#00bc7d]" />
                  Create New Conversation Flow
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                {renderQuestionForm(true)}
              </div>
            </div>
          </div>
        )}

        {/* Add Question to Flow Modal */}
        {editingQuestion === 'new-question' && editingWorkflowGroupId && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50" onClick={handleCancelEdit}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Add Question to Flow
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                {renderQuestionForm(false)}
              </div>
            </div>
          </div>
        )}

        {/* Edit Question Modal */}
        {editingQuestion && editingQuestion !== 'new-workflow' && editingQuestion !== 'new-question' && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50" onClick={handleCancelEdit}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Edit Question</h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                {renderQuestionForm(false)}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md m-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Confirm Deletion</h2>
              <p className="mb-6 text-gray-700">Are you sure you want to delete this question? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button
                  className="btn-secondary px-4 py-2 rounded"
                  onClick={() => { setShowDeleteModal(false); setQuestionIdToDelete(null); }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700"
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
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isRoot ? 'Title' : 'Question'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={newQuestion.question || ''}
            onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
            className="input-field"
            rows={3}
            placeholder={isRoot ? "Enter the workflow title" : "Enter the question to ask users"}
          />
        </div>

        {!isRoot && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Questions are automatically linked in the order they are added to the workflow. After the user responds (text or voice), the conversation will proceed to the next question in order.
            </p>
          </div>
        )}

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

export default function ChatbotWorkflowPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <div className="container mx-auto px-4 py-8">
            <div className="min-h-[200px] flex items-center justify-center">
              <div className="loading-spinner"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    }>
      <ChatbotWorkflowPageContent />
    </Suspense>
  );
}
