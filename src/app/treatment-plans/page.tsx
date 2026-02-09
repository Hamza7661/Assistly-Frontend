'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import styles from './styles.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useQuestionnareService } from '@/services';
import { QuestionnareType } from '@/enums/QuestionnareType';
import { useChatbotWorkflowService } from '@/services';
import { ChatbotWorkflow, formatQuestionType } from '@/models/ChatbotWorkflow';
import { useQuestionTypeService } from '@/services';
import type { QuestionTypeItem } from '@/models/QuestionType';
import { ChevronUp, ChevronDown, X, Plus, Save, Trash2, GripVertical, Edit2, ExternalLink, Info } from 'lucide-react';
import { toast } from 'react-toastify';
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

type PlanItem = {
  _id?: string;
  title: string;
  description: string;
  attachedWorkflows: Array<{
    workflowId: string | null;
    order: number;
    workflowTitle?: string;
  }>;
};

export default function TreatmentPlansPage() {
  const { user } = useAuth();
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanItem[]>([{ title: '', description: '', attachedWorkflows: [] }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [planErrors, setPlanErrors] = useState<Record<number, { title?: string; description?: string }>>({});
  const [originalPlans, setOriginalPlans] = useState<PlanItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [workflows, setWorkflows] = useState<ChatbotWorkflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set());
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [creatingWorkflowForPlan, setCreatingWorkflowForPlan] = useState<number | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editingWorkflowPlanIndex, setEditingWorkflowPlanIndex] = useState<number | null>(null);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeItem[]>([]);
  const [newWorkflow, setNewWorkflow] = useState<Partial<ChatbotWorkflow>>({
    title: '',
    question: '',
    questionTypeId: 0,
    isRoot: false,
    isActive: true,
    order: 0
  });
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [showingWorkflowSelector, setShowingWorkflowSelector] = useState<number | null>(null);

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

  const reloadData = async () => {
    if (!currentApp?.id) { setLoading(false); setLoadingWorkflows(false); return; }
    try {
      const [faqSvc, workflowSvc] = await Promise.all([
        useQuestionnareService(),
        useChatbotWorkflowService()
      ]);
      
      const [res, workflowRes] = await Promise.all([
        faqSvc.list(currentApp.id, QuestionnareType.SERVICE_PLAN),
        workflowSvc.list(currentApp.id, true)
      ]);
      
      const all = Array.isArray(res.data?.faqs) ? res.data.faqs : [];
      const onlyPlans = all.filter((f: any) => ((f?.type ?? QuestionnareType.FAQ) === QuestionnareType.SERVICE_PLAN));
      
      const mappedPlans = onlyPlans.map((p: any) => {
        // Get attachedWorkflows from the item (now preserved in QuestionnareItem model)
        const attachedWorkflows = (p?.attachedWorkflows || [])
          .filter((aw: any) => {
            // Filter out null/undefined workflowIds
            const id = aw?.workflowId?._id || aw?.workflowId;
            return id != null && id !== '';
          })
          .map((aw: any) => {
            // Handle both populated (object with _id) and non-populated (string) workflowId
            const workflowId = aw.workflowId?._id || aw.workflowId || null;
            return {
              workflowId: workflowId ? String(workflowId) : null,
              order: aw.order || 0,
              workflowTitle: aw.workflowId?.title || ''
            };
          })
          .sort((a: any, b: any) => a.order - b.order);
        
        return {
          _id: p._id,
          title: p?.question || '',
          description: p?.answer || '',
          attachedWorkflows
        };
      });
      
      const planItems = mappedPlans.length > 0 ? mappedPlans : [{ title: '', description: '', attachedWorkflows: [] }];
      setPlans(planItems);
      setOriginalPlans(JSON.parse(JSON.stringify(planItems)));
      
      setWorkflows(workflowRes.data.workflows || []);
    } catch (e: any) {
      setPlans([{ title: '', description: '', attachedWorkflows: [] }]);
      setError(e?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
      setLoadingWorkflows(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [currentApp?.id]);

  // Fetch question types from API
  useEffect(() => {
    const loadQuestionTypes = async () => {
      try {
        const service = await useQuestionTypeService();
        const response = await service.getQuestionTypes();
        if (response.status === 'success' && response.data?.questionTypes) {
          setQuestionTypes(response.data.questionTypes);
          // Set default question type if not set
          if ((!newWorkflow.questionTypeId || newWorkflow.questionTypeId === 0) && response.data.questionTypes.length > 0) {
            setNewWorkflow(prev => ({ ...prev, questionTypeId: response.data.questionTypes[0].id }));
          }
        }
      } catch (error) {
        console.error('Failed to load question types:', error);
      }
    };
    loadQuestionTypes();
  }, []);

  const checkForChanges = (newPlans: PlanItem[]) => {
    const hasChanges = JSON.stringify(newPlans) !== JSON.stringify(originalPlans);
    setHasUnsavedChanges(hasChanges);
  };

  const updatePlan = (index: number, key: 'title' | 'description', value: string) => {
    setPlans(prev => {
      const newPlans = prev.map((p, i) => i === index ? { ...p, [key]: value } : p);
      checkForChanges(newPlans);
      return newPlans;
    });
  };

  const addPlanRow = () => {
    setPlans(prev => {
      const newPlans = [...prev, { title: '', description: '', attachedWorkflows: [] }];
      checkForChanges(newPlans);
      return newPlans;
    });
  };

  const removePlanRow = (index: number) => {
    setPlans(prev => {
      const newPlans = prev.filter((_, i) => i !== index);
      checkForChanges(newPlans);
      return newPlans;
    });
  };

  const removeWorkflowFromPlan = (planIndex: number, workflowId: string | null) => {
    if (!workflowId) return;
    setPlans(prev => {
      const newPlans = prev.map((p, i) => {
        if (i === planIndex) {
          const filtered = p.attachedWorkflows.filter((w) => w.workflowId !== workflowId);
          // Normalize orders to be sequential starting from 0
          const normalized = filtered.map((w, idx) => ({
            ...w,
            order: idx
          }));
          return {
            ...p,
            attachedWorkflows: normalized
          };
        }
        return p;
      });
      checkForChanges(newPlans);
      return newPlans;
    });
  };

  const handleDragEnd = (event: DragEndEvent, planIndex: number) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPlans(prev => {
        const newPlans = prev.map((p, i) => {
          if (i === planIndex) {
            const sortedWorkflows = [...p.attachedWorkflows].sort((a, b) => a.order - b.order);
            const oldIndex = sortedWorkflows.findIndex(w => `${planIndex}-${w.workflowId}` === active.id);
            const newIndex = sortedWorkflows.findIndex(w => `${planIndex}-${w.workflowId}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
              const reordered = arrayMove(sortedWorkflows, oldIndex, newIndex);
              
              // Reassign orders by creating new objects (not mutating)
              const reorderedWithNewOrders = reordered.map((wf, idx) => ({
                ...wf,
                order: idx
              }));
              
              return { ...p, attachedWorkflows: reorderedWithNewOrders };
            }
          }
          return p;
        });
        checkForChanges(newPlans);
        return newPlans;
      });
    }
  };

  const togglePlanExpansion = (index: number) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleCreateWorkflow = (planIndex: number) => {
    setNewWorkflow({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      isRoot: false,
      isActive: true,
      order: workflows.length
    });
    setCreatingWorkflowForPlan(planIndex);
    setEditingWorkflowId(null);
    setEditingWorkflowPlanIndex(null);
  };

  const handleAttachExistingWorkflow = (planIndex: number, workflowId: string) => {
    if (!workflowId) return;
    
    setPlans(prev => {
      const newPlans = prev.map((p, i) => {
        if (i === planIndex) {
          // Check if workflow is already attached to avoid duplicates
          const alreadyAttached = p.attachedWorkflows.some(aw => aw.workflowId === workflowId);
          if (alreadyAttached) {
            toast.info('This workflow is already attached to this plan');
            return p;
          }
          
          const maxOrder = p.attachedWorkflows.length > 0 
            ? Math.max(...p.attachedWorkflows.map(w => w.order), -1)
            : -1;
          return {
            ...p,
            attachedWorkflows: [...p.attachedWorkflows, { 
              workflowId: workflowId, 
              order: maxOrder + 1 
            }]
          };
        }
        return p;
      });
      checkForChanges(newPlans);
      return newPlans;
    });
    
    setShowingWorkflowSelector(null);
  };

  const handleEditWorkflow = (workflowId: string, planIndex: number) => {
    const workflow = workflows.find(w => w._id === workflowId);
    if (workflow) {
      setNewWorkflow({
        _id: workflow._id,
        title: workflow.title,
        question: workflow.question,
        questionTypeId: workflow.questionTypeId,
        isRoot: workflow.isRoot,
        isActive: workflow.isActive,
        order: workflow.order
      });
      setEditingWorkflowId(workflowId);
      setEditingWorkflowPlanIndex(planIndex);
      setCreatingWorkflowForPlan(planIndex);
    }
  };

  const handleCancelWorkflowCreation = () => {
    setCreatingWorkflowForPlan(null);
    setEditingWorkflowId(null);
    setEditingWorkflowPlanIndex(null);
    setNewWorkflow({
      title: '',
      question: '',
      questionTypeId: questionTypes.length > 0 ? questionTypes[0].id : 0,
      isRoot: false,
      isActive: true,
      order: 0
    });
  };

  const handleSaveWorkflow = async () => {
    if (!currentApp?.id || creatingWorkflowForPlan === null) return;
    
    setSavingWorkflow(true);
    try {
      const service = await useChatbotWorkflowService();
      
      // Validate workflow
      if (!newWorkflow.title?.trim() || !newWorkflow.question?.trim()) {
        toast.error('Title and question are required');
        setSavingWorkflow(false);
        return;
      }

      let savedWorkflow: ChatbotWorkflow | undefined;
      if (editingWorkflowId) {
        // Update existing workflow
        const response = await service.update(currentApp.id, editingWorkflowId, newWorkflow);
        savedWorkflow = response.data.workflow;
        if (savedWorkflow?._id) {
          const workflow = savedWorkflow; // Type guard
          toast.success('Workflow updated successfully');
          
          // Update the workflow in the workflows list
          setWorkflows(prev => prev.map(w => w._id === workflow._id ? workflow : w));
        }
      } else {
        // Create new workflow
        const response = await service.create(currentApp.id, newWorkflow);
        savedWorkflow = response.data.workflow;
        
        if (savedWorkflow?._id) {
          const workflow = savedWorkflow; // Type guard
          toast.success('Workflow created successfully');
          
          // Add the new workflow to the workflows list
          setWorkflows(prev => {
            const exists = prev.some(w => w._id === workflow._id);
            if (exists) {
              return prev.map(w => w._id === workflow._id ? workflow : w);
            }
            return [...prev, workflow];
          });
          
          // Automatically attach the new workflow to the plan
          const planIndex = creatingWorkflowForPlan;
          setPlans(prev => {
            const newPlans = prev.map((p, i) => {
              if (i === planIndex) {
                // Check if workflow is already attached to avoid duplicates
                const alreadyAttached = p.attachedWorkflows.some(aw => aw.workflowId === workflow._id);
                if (alreadyAttached) {
                  return p;
                }
                
                const maxOrder = p.attachedWorkflows.length > 0 
                  ? Math.max(...p.attachedWorkflows.map(w => w.order), -1)
                  : -1;
                return {
                  ...p,
                  attachedWorkflows: [...p.attachedWorkflows, { 
                    workflowId: workflow._id!, 
                    order: maxOrder + 1 
                  }]
                };
              }
              return p;
            });
            checkForChanges(newPlans);
            return newPlans;
          });
        }
      }
      
      if (savedWorkflow?._id) {
        // Automatically expand the workflow
        setExpandedWorkflows(prev => new Set([...prev, savedWorkflow!._id!]));
        handleCancelWorkflowCreation();
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editingWorkflowId ? 'update' : 'save'} workflow`);
    } finally {
      setSavingWorkflow(false);
    }
  };

  const toggleWorkflowExpansion = (workflowId: string) => {
    setExpandedWorkflows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowId)) {
        newSet.delete(workflowId);
      } else {
        newSet.add(workflowId);
      }
      return newSet;
    });
  };

  const getLinkedWorkflow = (nextQuestionId?: string | null) => {
    if (!nextQuestionId) return null;
    return workflows.find(w => w._id === nextQuestionId);
  };

  // Sortable Workflow Item Component
  const SortableWorkflowItem = ({ 
    attachedWorkflow, 
    planIdx, 
    sortedIdx, 
    actualIdx 
  }: { 
    attachedWorkflow: { workflowId: string | null; order: number; workflowTitle?: string };
    planIdx: number;
    sortedIdx: number;
    actualIdx: number;
  }) => {
    const workflow = workflows.find(w => w._id === attachedWorkflow.workflowId);
    const isExpanded = expandedWorkflows.has(workflow?._id || '');
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: `${planIdx}-${attachedWorkflow.workflowId}`,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    if (!workflow) {
      return (
        <div ref={setNodeRef} style={style} className="bg-white rounded border border-gray-200 p-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Workflow loading...</span>
            <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded">
              Order: {attachedWorkflow.order + 1}
            </span>
            <button
              onClick={() => removeWorkflowFromPlan(planIdx, attachedWorkflow.workflowId)}
              className="p-1 text-red-500 hover:text-red-700 ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div ref={setNodeRef} style={style} className="bg-white rounded border border-gray-200">
        <div className="flex items-center gap-2 p-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-[#00bc7d]"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <button
            onClick={() => workflow._id && toggleWorkflowExpansion(workflow._id)}
            className="flex-1 text-left flex items-center gap-2 hover:text-[#00bc7d]"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
            <span className="font-medium text-gray-900">{workflow.title}</span>
            <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded">
              Order: {attachedWorkflow.order + 1}
            </span>
            {workflow.isRoot && (
              <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                Root
              </span>
            )}
            {!workflow.isActive && (
              <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                Inactive
              </span>
            )}
          </button>
          <button
            onClick={() => removeWorkflowFromPlan(planIdx, attachedWorkflow.workflowId)}
            className="p-1 text-red-500 hover:text-red-700"
            title="Remove workflow from plan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-4 space-y-3">
              <div className="mb-2">
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Question:</span> {workflow.question}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Question Type:</span> {formatQuestionType(workflow.questionTypeId, questionTypes)}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Order in Plan:</span> {attachedWorkflow.order + 1}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (workflow._id) {
                      router.push(`/chatbot-workflow?workflowId=${workflow._id}`);
                    }
                  }}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  title="View workflow in Conversation Flows page"
                >
                  <ExternalLink className="h-4 w-4" />
                  View in Conversation Flows
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const onSave = async () => {
    if (!currentApp?.id) return;
    setSaving(true);
    setError('');
    try {
      const errors: Record<number, { title?: string; description?: string }> = {};
      plans.forEach((it, idx) => {
        const t = it.title.trim();
        const d = it.description.trim();
        if (t && !d) errors[idx] = { ...(errors[idx] || {}), description: 'Description is required.' };
        if (!t && d) errors[idx] = { ...(errors[idx] || {}), title: 'Title is required.' };
      });
      if (Object.keys(errors).length > 0) {
        setPlanErrors(errors);
        setError('Please complete both service plan title and description for highlighted rows.');
        setSaving(false);
        return;
      }

      const cleaned = plans
        .map(it => ({
          question: it.title.trim(),
          answer: it.description.trim(),
          attachedWorkflows: it.attachedWorkflows
            .filter(aw => aw.workflowId !== null)
            .map(aw => ({
              workflowId: aw.workflowId,
              order: aw.order
            }))
        }))
        .filter(it => it.question.length > 0 && it.answer.length > 0);

      const faqSvc = await useQuestionnareService();
      await faqSvc.upsert(currentApp.id, QuestionnareType.SERVICE_PLAN, cleaned as any);
      toast.success('Service plans saved successfully!');
      setPlanErrors({});
      setHasUnsavedChanges(false);
      await reloadData();
    } catch (e: any) {
      const errMsg = e?.message || 'Failed to save plans';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Show loading spinner while apps are loading
  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className={styles.container}>
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

  // Show empty state if no app is selected (after loading completes)
  if (!currentApp || !currentApp.id) {
    return (
      <ProtectedRoute>
        <div className={styles.container}>
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className={styles.pageContainer}>
              <NoAppEmptyState
                title="Create Your Service Plans"
                description="Create an app first to start building service plans and packages. Each app comes with industry-specific default service plans that you can customize and expand."
              />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className={styles.pageContainer}>
          <h1 className={styles.title}>Service Plans</h1>
          <p className={styles.subtitle}>List the service plans you offer with brief descriptions. You can attach chatbot workflows to each service plan and order them.</p>

          {error && <div className="error-message mb-4">{error}</div>}

          {loading ? (
            <div className="min-h-[200px] flex items-center justify-center"><div className="loading-spinner"></div></div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan, planIdx) => (
                <div key={planIdx} className={styles.table}>
                  <div className={styles.headerRow}>
                    <div className={styles.colQ}>Service Plan Title</div>
                    <div className={styles.colA}>Description</div>
                    <div className={styles.colActions}></div>
                  </div>
                  <div className={styles.dataRow}>
                    <div className={styles.colQ}>
                      <textarea
                        value={plan.title}
                        onChange={(e) => updatePlan(planIdx, 'title', e.target.value)}
                        className={`${styles.textarea} ${planErrors[planIdx]?.title ? styles.textareaError : ''}`}
                        placeholder="Enter a service plan title"
                        rows={3}
                      />
                      {planErrors[planIdx]?.title && (
                        <div className={styles.errorText}>{planErrors[planIdx]?.title}</div>
                      )}
                    </div>
                    <div className={styles.colA}>
                      <textarea
                        value={plan.description}
                        onChange={(e) => updatePlan(planIdx, 'description', e.target.value)}
                        className={`${styles.textarea} ${planErrors[planIdx]?.description ? styles.textareaError : ''}`}
                        placeholder="Describe the plan"
                        rows={3}
                      />
                      {planErrors[planIdx]?.description && (
                        <div className={styles.errorText}>{planErrors[planIdx]?.description}</div>
                      )}
                    </div>
                    <div className={styles.colActions}>
                      <button onClick={() => removePlanRow(planIdx)} className="btn-secondary border-red-300 text-red-700 hover:bg-red-100">Remove</button>
                    </div>
                  </div>
                  
                  {/* Workflows Section */}
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Attached Workflows {plan.attachedWorkflows.length > 0 && `(${plan.attachedWorkflows.length})`}
                      </h3>
                    </div>
                    
                    {/* Always show workflows list */}
                    <div className="space-y-2">
                        {/* Workflow Creation Form - HIDDEN (kept for separate workflow management) */}
                        {false && creatingWorkflowForPlan === planIdx && (
                          <div className="bg-white rounded-lg border-2 border-[#00bc7d] p-4 mb-4">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {editingWorkflowId ? 'Edit Workflow' : 'Create New Workflow'}
                              </h3>
                              <button
                                onClick={handleCancelWorkflowCreation}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={savingWorkflow}
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
                                  disabled={savingWorkflow}
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
                                  disabled={savingWorkflow}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Question Type
                                </label>
                                <select
                                  value={newWorkflow.questionTypeId || (questionTypes.length > 0 ? questionTypes[0].id : '')}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setNewWorkflow(prev => ({
                                      ...prev,
                                      questionTypeId: val
                                    }));
                                  }}
                                  className="input-field"
                                  disabled={savingWorkflow}
                                >
                                  {questionTypes.map((qt) => (
                                    <option key={qt.id} value={qt.id}>
                                      {qt.value}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center justify-between">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newWorkflow.isRoot || false}
                                    onChange={(e) => setNewWorkflow({ ...newWorkflow, isRoot: e.target.checked })}
                                    className="mr-2"
                                    disabled={savingWorkflow}
                                  />
                                  <span className="text-sm font-medium text-gray-700">Root Question</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newWorkflow.isActive ?? true}
                                    onChange={(e) => setNewWorkflow({ ...newWorkflow, isActive: e.target.checked })}
                                    className="mr-2"
                                    disabled={savingWorkflow}
                                  />
                                  <span className="text-sm font-medium text-gray-700">Active</span>
                                </label>
                              </div>

                              <div className="flex gap-2 pt-4 border-t border-gray-200">
                                <button
                                  onClick={handleSaveWorkflow}
                                  disabled={savingWorkflow}
                                  className="btn-primary flex items-center gap-2"
                                >
                                <Save className="h-5 w-5" />
                                {savingWorkflow 
                                  ? (editingWorkflowId ? 'Updating...' : 'Saving...') 
                                  : (editingWorkflowId ? 'Update Workflow' : 'Save & Attach')}
                                </button>
                                <button
                                  onClick={handleCancelWorkflowCreation}
                                  disabled={savingWorkflow}
                                  className="btn-secondary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Workflow Selector for Attaching Existing Workflows */}
                        {showingWorkflowSelector === planIdx && (
                          <div className="bg-white rounded-lg border-2 border-[#00bc7d] p-4 mb-4">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Attach Existing Workflow
                              </h3>
                              <button
                                onClick={() => setShowingWorkflowSelector(null)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Select Workflow <span className="text-red-500">*</span>
                                </label>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAttachExistingWorkflow(planIdx, e.target.value);
                                      e.target.value = ''; // Reset select
                                    }
                                  }}
                                  className="input-field"
                                  defaultValue=""
                                >
                                  <option value="">-- Select a workflow to attach --</option>
                                  {workflows
                                    .filter(w => w.isActive && w.isRoot)
                                    .filter(w => !plan.attachedWorkflows.some(aw => aw.workflowId === w._id))
                                    .map(workflow => (
                                      <option key={workflow._id} value={workflow._id}>
                                        {workflow.title}
                                      </option>
                                    ))}
                                </select>
                                {workflows.filter(w => w.isActive && w.isRoot && !plan.attachedWorkflows.some(aw => aw.workflowId === w._id)).length === 0 && (
                                  <p className="text-sm text-gray-500 mt-2">
                                    No available workflows to attach. All workflows are already attached or you need to create workflows first.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Always show workflows list with drag and drop */}
                        {plan.attachedWorkflows.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No workflows attached. Click <strong>"Attach Existing Workflow"</strong> to attach one or{' '}
                            <button
                              onClick={() => router.push('/chatbot-workflow')}
                              className="text-[#00bc7d] hover:text-[#00a86b] underline font-medium"
                            >
                              click here
                            </button>
                            {' '}to create a new workflow to attach.
                          </p>
                        ) : (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => handleDragEnd(event, planIdx)}
                          >
                            <SortableContext
                              items={[...plan.attachedWorkflows]
                                .sort((a, b) => a.order - b.order)
                                .map(w => `${planIdx}-${w.workflowId}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {[...plan.attachedWorkflows]
                                  .sort((a, b) => a.order - b.order)
                                  .map((attachedWorkflow, sortedIdx) => {
                                    const wfIdx = plan.attachedWorkflows.findIndex(
                                      w => w.workflowId === attachedWorkflow.workflowId && w.order === attachedWorkflow.order
                                    );
                                    const actualIdx = wfIdx >= 0 ? wfIdx : sortedIdx;
                                    
                                    return (
                                      <SortableWorkflowItem
                                        key={`${planIdx}-${sortedIdx}-${attachedWorkflow.workflowId}`}
                                        attachedWorkflow={attachedWorkflow}
                                        planIdx={planIdx}
                                        sortedIdx={sortedIdx}
                                        actualIdx={actualIdx}
                                      />
                                    );
                                  })}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                        
                        {/* Attach Existing Workflow button - only show when not showing selector */}
                        {showingWorkflowSelector !== planIdx && (
                          <div className="mt-4 flex items-center gap-3">
                            <button
                              onClick={() => setShowingWorkflowSelector(planIdx)}
                              disabled={!plan.title.trim() || !plan.description.trim()}
                              className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-4 w-4" />
                              Attach Existing Workflow
                            </button>
                            {(!plan.title.trim() || !plan.description.trim()) && (
                              <span className="text-sm text-amber-600 flex items-center gap-1">
                                <Info className="h-4 w-4" />
                                Please add a service plan title and description before attaching workflows
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className={styles.actionsRow}>
                <div className="flex items-center w-full">
                  <button onClick={addPlanRow} className="btn-secondary">Add Service Plan</button>
                  <div className="flex items-center ml-auto">
                    {hasUnsavedChanges && (
                      <div className="text-sm text-amber-600 flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        You have unsaved changes
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {hasUnsavedChanges && (
                      <button
                        onClick={() => {
                          setPlans(JSON.parse(JSON.stringify(originalPlans)));
                          setHasUnsavedChanges(false);
                        }}
                        className="btn-secondary"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}
                    <button onClick={onSave} className="btn-primary" disabled={saving || !hasUnsavedChanges}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

