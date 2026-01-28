'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import styles from './styles.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useQuestionnareService } from '@/services';
import { QuestionnareType } from '@/enums/QuestionnareType';

type FaqItem = { question: string; answer: string };

export default function QuestionnarePage() {
  const { user } = useAuth();
  const { currentApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [items, setItems] = useState<FaqItem[]>([{ question: '', answer: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [itemErrors, setItemErrors] = useState<Record<number, { question?: string; answer?: string }>>({});
  const [originalItems, setOriginalItems] = useState<FaqItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const reloadData = async () => {
    if (!currentApp?.id) { setLoading(false); return; }
    try {
      const faqSvc = await useQuestionnareService();
      const res = await faqSvc.list(currentApp.id, QuestionnareType.FAQ);
      const all = Array.isArray(res.data?.faqs) ? res.data.faqs : [];
      const onlyQuestionnare = all.filter((f: any) => ((f?.type ?? QuestionnareType.FAQ) === QuestionnareType.FAQ));
      const mappedFaqs = onlyQuestionnare.map((f: any) => ({ question: f?.question || '', answer: f?.answer || '' }));
      const faqItems = mappedFaqs.length > 0 ? mappedFaqs : [{ question: '', answer: '' }];
      setItems(faqItems);
      setOriginalItems([...faqItems]);
    } catch (e: any) {
      setItems([{ question: '', answer: '' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [currentApp?.id]);

  const updateItem = (index: number, key: keyof FaqItem, value: string) => {
    setItems(prev => {
      const newItems = prev.map((it, i) => i === index ? { ...it, [key]: value } : it);
      checkForChanges(newItems);
      return newItems;
    });
  };

  const checkForChanges = (newItems: FaqItem[]) => {
    const hasChanges = JSON.stringify(newItems) !== JSON.stringify(originalItems);
    setHasUnsavedChanges(hasChanges);
  };

  const addRow = () => {
    setItems(prev => {
      const newItems = [...prev, { question: '', answer: '' }];
      checkForChanges(newItems);
      return newItems;
    });
  };
  
  const removeRow = (index: number) => {
    setItems(prev => {
      const newItems = prev.filter((_, i) => i !== index);
      checkForChanges(newItems);
      return newItems;
    });
  };

  const onSave = async () => {
    if (!currentApp?.id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      // Validate paired fields per row
      const errors: Record<number, { question?: string; answer?: string }> = {};
      items.forEach((it, idx) => {
        const q = it.question.trim();
        const a = it.answer.trim();
        if (q && !a) errors[idx] = { ...(errors[idx] || {}), answer: 'Answer is required.' };
        if (!q && a) errors[idx] = { ...(errors[idx] || {}), question: 'Question is required.' };
      });
      if (Object.keys(errors).length > 0) {
        setItemErrors(errors);
        setError('Please complete both question and answer for highlighted rows.');
        setSaving(false);
        return;
      }

      const cleaned = items
        .map(it => ({ question: it.question.trim(), answer: it.answer.trim() }))
        .filter(it => it.question.length > 0 && it.answer.length > 0);

      // Allow zero valid rows and still save (backend will receive empty items)
      const faqSvc = await useQuestionnareService();
      const res = await faqSvc.upsert(currentApp.id, QuestionnareType.FAQ, cleaned);
      setMessage('Saved successfully');
      setItemErrors({});
      setHasUnsavedChanges(false);
      await reloadData();
      // Saved successfully; keep current rows as-is
    } catch (e: any) {
      setError(e?.message || 'Failed to save training data');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  // Show empty state if no app is selected
  if (!currentApp || !currentApp.id) {
    return (
      <ProtectedRoute>
        <div className={styles.container}>
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className={styles.pageContainer}>
              <NoAppEmptyState
                title="Set Up Your Training Data"
                description="Create an app first to start adding FAQs and training data for your chatbot. Each app comes with industry-specific default FAQs that you can customize and expand."
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
          <h1 className={styles.title}>Training Data</h1>
          <p className={styles.subtitle}>Add questions and answers to train your AI chatbot. This data helps the model understand and respond to common queries.</p>

          {error && <div className="error-message mb-4">{error}</div>}
          {message && <div className="success-message mb-4">{message}</div>}

          {loading ? (
            <div className="min-h-[200px] flex items-center justify-center"><div className="loading-spinner"></div></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.headerRow}>
                <div className={styles.colQ}>Question</div>
                <div className={styles.colA}>Answer</div>
                <div className={styles.colActions}></div>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className={styles.dataRow}>
                  <div className={styles.colQ}>
                    <textarea
                      value={it.question}
                      onChange={(e) => updateItem(idx, 'question', e.target.value)}
                      className={`${styles.textarea} ${itemErrors[idx]?.question ? styles.textareaError : ''}`}
                      placeholder="Enter a question"
                      rows={5}
                    />
                    {itemErrors[idx]?.question && (
                      <div className={styles.errorText}>{itemErrors[idx]?.question}</div>
                    )}
                  </div>
                  <div className={styles.colA}>
                    <textarea
                      value={it.answer}
                      onChange={(e) => updateItem(idx, 'answer', e.target.value)}
                      className={`${styles.textarea} ${itemErrors[idx]?.answer ? styles.textareaError : ''}`}
                      placeholder="Write the answer"
                      rows={5}
                    />
                    {itemErrors[idx]?.answer && (
                      <div className={styles.errorText}>{itemErrors[idx]?.answer}</div>
                    )}
                  </div>
                  <div className={styles.colActions}>
                    <button onClick={() => removeRow(idx)} className="btn-secondary border-red-300 text-red-700 hover:bg-red-100">Remove</button>
                  </div>
                </div>
              ))}
              <div className={styles.actionsRow}>
                <div className="flex items-center w-full">
                  <button onClick={addRow} className="btn-secondary">Add Row</button>
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
                          setItems([...originalItems]);
                          setHasUnsavedChanges(false);
                        }}
                        className="btn-secondary"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}
                    <button onClick={onSave} className="btn-primary" disabled={saving || !hasUnsavedChanges}>{saving ? 'Saving...' : 'Save'}</button>
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


