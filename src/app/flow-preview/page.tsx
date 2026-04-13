'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import Navigation from '@/components/Navigation';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useChatbotWorkflowService } from '@/services';
import type { ChatbotWorkflow, WorkflowGroup } from '@/models/ChatbotWorkflow';
import { GitBranch, MessageSquare, Folder, Calendar } from 'lucide-react';

function FlowPreviewContent() {
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [groups, setGroups] = useState<WorkflowGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentApp?.id) {
      setLoading(false);
      setGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const svc = await useChatbotWorkflowService();
        const res = await svc.listGrouped(currentApp.id, true);
        if (!cancelled) setGroups(res.data.workflows);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentApp?.id]);

  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className="bg-gray-50 min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} flex items-center justify-center min-h-[40vh]`}>
            <div className="loading-spinner" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!currentApp?.id) {
    return (
      <ProtectedRoute>
        <div className="bg-gray-50 min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} max-w-4xl mx-auto px-4 py-8`}>
            <NoAppEmptyState title="Flow preview" description="Select or create an app to preview conversation flows." />
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
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900">Flow preview</h1>
            <p className="text-gray-600 text-sm mt-1 mb-6">
              Read-only map of each flow: root message, questions, branches, and optional booking steps.
            </p>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="loading-spinner" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-gray-500 text-sm">No conversation flows yet. Add one under Conversations.</p>
            ) : (
              <div className="space-y-8">
                {groups.map((g) => (
                  <FlowGroupPreview key={g._id} group={g} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function FlowGroupPreview({ group }: { group: WorkflowGroup }) {
  const byId = useMemo(() => {
    const m = new Map<string, ChatbotWorkflow>();
    const add = (q: ChatbotWorkflow) => {
      if (q._id) m.set(q._id, q);
    };
    add(group.rootQuestion);
    (group.questions || []).forEach(add);
    return m;
  }, [group]);

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#c01721]/5 to-transparent flex items-center gap-2">
        <Folder className="h-5 w-5 text-[#c01721] shrink-0" />
        <h2 className="font-semibold text-gray-900 text-sm sm:text-base break-words">{group.rootQuestion.question}</h2>
        {!group.isActive && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">Inactive</span>
        )}
      </div>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Entry</div>
        <ChatBubble role="bot" emphasis>
          {group.rootQuestion.question}
        </ChatBubble>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-4">Follow-up questions</div>
        <QuestionTree rootId={group.rootQuestion._id} byId={byId} />
      </div>
    </section>
  );
}

function QuestionTree({
  rootId,
  byId,
}: {
  rootId?: string;
  byId: Map<string, ChatbotWorkflow>;
}) {
  const ordered = useMemo(() => {
    const list = Array.from(byId.values()).filter((q) => q._id !== rootId && !q.isRoot);
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [byId, rootId]);

  const linked = useMemo(() => {
    const s = new Set<string>();
    byId.forEach((q) => {
      (q.options || []).forEach((o) => {
        if (o.nextQuestionId) s.add(o.nextQuestionId);
      });
    });
    return s;
  }, [byId]);

  const sequential = ordered.filter((q) => q._id && !linked.has(q._id));

  return (
    <div className="space-y-3 pl-2 border-l-2 border-gray-100">
      {sequential.map((q) => (
        <FlowNode key={q._id} question={q} byId={byId} depth={0} visited={new Set()} />
      ))}
      {sequential.length === 0 && ordered.length > 0 && (
        <p className="text-xs text-gray-500">All questions are reached only via branches — expand choices above to see them.</p>
      )}
    </div>
  );
}

function FlowNode({
  question,
  byId,
  depth,
  visited,
}: {
  question: ChatbotWorkflow;
  byId: Map<string, ChatbotWorkflow>;
  depth: number;
  visited: Set<string>;
}) {
  const qid = question._id || '';
  if (qid && visited.has(qid)) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2" style={{ marginLeft: depth * 12 }}>
        ↩ Cycle: question already shown in this path
      </div>
    );
  }
  const nextVisited = new Set(visited);
  if (qid) nextVisited.add(qid);

  return (
    <div className="space-y-2" style={{ marginLeft: depth * 12 }}>
      <div className="flex items-start gap-2">
        <MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-1" />
        <ChatBubble role="bot">{question.question}</ChatBubble>
      </div>
      {question.bookingBlock?.enabled && (
        <div className="flex items-center gap-2 ml-6 text-xs text-teal-800">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Optional booking:</span>
          <span className="text-teal-700 truncate">{question.bookingBlock.bookingQuestionText || 'Book?'}</span>
        </div>
      )}
      {(question.options || []).length > 0 && (
        <ul className="ml-6 space-y-2 list-none">
          {question.options!.map((opt, i) => (
            <li key={i} className="text-sm">
              <span className="text-gray-500">Choice:</span>{' '}
              <span className="font-medium text-gray-800">{opt.text || '(empty)'}</span>
              {opt.isTerminal && <span className="text-red-500 text-xs ml-2">ends flow</span>}
              {opt.nextQuestionId && byId.has(opt.nextQuestionId) && (
                <div className="mt-2 pl-3 border-l border-dashed border-gray-200">
                  <FlowNode question={byId.get(opt.nextQuestionId)!} byId={byId} depth={depth + 1} visited={nextVisited} />
                </div>
              )}
              {opt.nextQuestionId && !byId.has(opt.nextQuestionId) && (
                <span className="text-xs text-amber-600 ml-2">→ missing question</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatBubble({
  role,
  children,
  emphasis,
}: {
  role: 'bot';
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm text-gray-800 max-w-[95%] shadow-sm border ${
        emphasis ? 'bg-[#c01721]/10 border-[#c01721]/20' : 'bg-gray-50 border-gray-200'
      }`}
    >
      {children}
    </div>
  );
}

function FlowPreviewFallback() {
  const { isOpen: isSidebarOpen } = useSidebar();
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} flex justify-center py-16`}>
          <div className="loading-spinner" />
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function FlowPreviewPage() {
  return (
    <Suspense fallback={<FlowPreviewFallback />}>
      <FlowPreviewContent />
    </Suspense>
  );
}
