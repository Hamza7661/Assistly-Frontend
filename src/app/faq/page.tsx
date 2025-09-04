'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import styles from './styles.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestionnareService } from '@/services';
import { QuestionnareType } from '@/enums/QuestionnareType';
import { useAuthService } from '@/services';
import { User } from '@/models/User';

type FaqItem = { question: string; answer: string };
type PlanItem = { title: string; description: string };

export default function QuestionnarePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FaqItem[]>([{ question: '', answer: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [itemErrors, setItemErrors] = useState<Record<number, { question?: string; answer?: string }>>({});

  const [plans, setPlans] = useState<PlanItem[]>([{ title: '', description: '' }]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlans, setSavingPlans] = useState(false);
  const [errorPlans, setErrorPlans] = useState<string>('');
  const [messagePlans, setMessagePlans] = useState<string>('');
  const [planErrors, setPlanErrors] = useState<Record<number, { title?: string; description?: string }>>({});

  const reloadData = async () => {
    if (!user?._id) { setLoading(false); setLoadingPlans(false); return; }
    try {
      const faqSvc = await useQuestionnareService();
      const res = await faqSvc.list();
      const all = Array.isArray(res.data?.faqs) ? res.data.faqs : [];
      const onlyQuestionnare = all.filter((f: any) => ((f?.type ?? QuestionnareType.FAQ) === QuestionnareType.FAQ));
      const onlyPlans = all.filter((f: any) => ((f?.type ?? QuestionnareType.FAQ) === QuestionnareType.TREATMENT_PLAN));
      const mappedFaqs = onlyQuestionnare.map((f: any) => ({ question: f?.question || '', answer: f?.answer || '' }));
      const mappedPlans = onlyPlans.map((p: any) => ({ title: p?.question || '', description: p?.answer || '' }));
      setItems(mappedFaqs.length > 0 ? mappedFaqs : [{ question: '', answer: '' }]);
      setPlans(mappedPlans.length > 0 ? mappedPlans : [{ title: '', description: '' }]);
    } catch (e: any) {
      setItems([{ question: '', answer: '' }]);
      setPlans([{ title: '', description: '' }]);
    } finally {
      setLoading(false);
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, [user?._id]);

  const updateItem = (index: number, key: keyof FaqItem, value: string) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [key]: value } : it));
  };

  const addRow = () => setItems(prev => [...prev, { question: '', answer: '' }]);
  const removeRow = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const addPlanRow = () => setPlans(prev => [...prev, { title: '', description: '' }]);
  const removePlanRow = (index: number) => setPlans(prev => prev.filter((_, i) => i !== index));

  const onSave = async () => {
    if (!user?._id) return;
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
      const res = await faqSvc.upsert(QuestionnareType.FAQ, cleaned);
      setMessage('Saved successfully');
      setItemErrors({});
      await reloadData();
      // Saved successfully; keep current rows as-is
    } catch (e: any) {
      setError(e?.message || 'Failed to save FAQs');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const onSavePlans = async () => {
    if (!user?._id) return;
    setSavingPlans(true);
    setErrorPlans('');
    setMessagePlans('');
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
        setErrorPlans('Please complete both treatment title and description for highlighted rows.');
        setSavingPlans(false);
        return;
      }

      const cleaned = plans
        .map(it => ({ question: it.title.trim(), answer: it.description.trim() }))
        .filter(it => it.question.length > 0 && it.answer.length > 0);

      // Allow zero valid rows and still save (backend will receive empty items)
      const faqSvc = await useQuestionnareService();
      await faqSvc.upsert(QuestionnareType.TREATMENT_PLAN, cleaned);
      setMessagePlans('Saved successfully');
      setPlanErrors({});
      await reloadData();
      // Saved successfully; keep current rows as-is
    } catch (e: any) {
      setErrorPlans(e?.message || 'Failed to save treatment plans');
    } finally {
      setSavingPlans(false);
      setTimeout(() => setMessagePlans(''), 2000);
    }
  };

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <Navigation />
        <div className={styles.pageContainer}>
          <h1 className={styles.title}>Questionnare for Chatbot</h1>
          <p className={styles.subtitle}>Provide questions and answers about general FAQs, then click Save once done.</p>

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
                    <button onClick={() => removeRow(idx)} className="btn-secondary">Remove</button>
                  </div>
                </div>
              ))}
              <div className={styles.actionsRow}>
                <button onClick={addRow} className="btn-secondary">Add Row</button>
                <button onClick={onSave} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          <div className="mt-10" />

          <h2 className={styles.title}>Treatment Plans</h2>
          <p className={styles.subtitle}>List the treatment plans you offer with brief descriptions, then click Save once done.</p>

          {errorPlans && <div className="error-message mb-4">{errorPlans}</div>}
          {messagePlans && <div className="success-message mb-4">{messagePlans}</div>}

          {loadingPlans ? (
            <div className="min-h-[160px] flex items-center justify-center"><div className="loading-spinner"></div></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.headerRow}>
                <div className={styles.colQ}>Treatment Title</div>
                <div className={styles.colA}>Description</div>
                <div className={styles.colActions}></div>
              </div>
              {plans.map((it, idx) => (
                <div key={idx} className={styles.dataRow}>
                  <div className={styles.colQ}>
                    <textarea
                      value={it.title}
                      onChange={(e) => setPlans(prev => prev.map((p, i) => i === idx ? { ...p, title: e.target.value } : p))}
                      className={`${styles.textarea} ${planErrors[idx]?.title ? styles.textareaError : ''}`}
                      placeholder="Enter a treatment plan title"
                      rows={5}
                    />
                    {planErrors[idx]?.title && (
                      <div className={styles.errorText}>{planErrors[idx]?.title}</div>
                    )}
                  </div>
                  <div className={styles.colA}>
                    <textarea
                      value={it.description}
                      onChange={(e) => setPlans(prev => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                      className={`${styles.textarea} ${planErrors[idx]?.description ? styles.textareaError : ''}`}
                      placeholder="Describe the treatment plan"
                      rows={5}
                    />
                    {planErrors[idx]?.description && (
                      <div className={styles.errorText}>{planErrors[idx]?.description}</div>
                    )}
                  </div>
                  <div className={styles.colActions}>
                    <button onClick={() => removePlanRow(idx)} className="btn-secondary">Remove</button>
                  </div>
                </div>
              ))}
              <div className={styles.actionsRow}>
                <button onClick={addPlanRow} className="btn-secondary">Add Row</button>
                <button onClick={onSavePlans} className="btn-primary" disabled={savingPlans}>{savingPlans ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          <div className="mt-10" />

          <h2 className={styles.title}>Website Context</h2>
          <p className={styles.subtitle}>Provide your website URL to help the chatbot with additional context.</p>

          <WebsiteContextForm />
        </div>
      </div>
    </ProtectedRoute>
  );
}

function WebsiteContextForm() {
  const { user, updateUser } = useAuth();
  const prefix = 'https://';
  const [website, setWebsite] = useState<string>(() => {
    const raw = (user?.website || '').trim();
    if (!raw) return prefix;
    return /^https?:\/\//i.test(raw) ? raw : `${prefix}${raw}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const saveWebsite = async () => {
    if (!user?._id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      // Normalize URL: auto-prepend https:// if missing (allow empty to clear)
      let trimmed = website.trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        trimmed = `${prefix}${trimmed}`;
        setWebsite(trimmed);
      }
      const authSvc = await useAuthService();
      const res = await authSvc.updateUserProfile(user._id, { website: trimmed } as any);
      if (res.status === 'success') {
        updateUser(new User(res.data.user));
        setMessage('Website saved');
      } else {
        setError(res.message || 'Failed to save website');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save website');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const clearWebsite = async () => {
    if (!user?._id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const authSvc = await useAuthService();
      const res = await authSvc.updateUserProfile(user._id, { website: '' } as any);
      if (res.status === 'success') {
        updateUser(new User(res.data.user));
        setWebsite(prefix);
        setMessage('Website cleared');
      } else {
        setError(res.message || 'Failed to clear website');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to clear website');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  return (
    <div className={styles.table}>
      <div className={styles.headerRow}>
        <div className={styles.colQ}>Website URL</div>
        <div className={styles.colA}></div>
        <div className={styles.colActions}></div>
      </div>
      <div className={styles.dataRow}>
        <div className={styles.colQ}>
          <input
            value={website}
            onChange={(e) => {
              const val = e.target.value;
              // Strip any protocol and re-apply https://
              const noProto = val.replace(/^https?:\/\//i, '');
              setWebsite(prefix + noProto);
            }}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && !/^https?:\/\//i.test(val)) {
                setWebsite(`${prefix}${val}`);
              }
            }}
            onKeyDown={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const start = input.selectionStart ?? 0;
              const end = input.selectionEnd ?? start;
              if (e.key === 'Backspace' || e.key === 'Delete') {
                if (start < prefix.length || (e.key === 'Backspace' && start <= prefix.length)) {
                  e.preventDefault();
                  input.setSelectionRange(prefix.length, prefix.length);
                }
              } else if (e.key === 'ArrowLeft') {
                if (start <= prefix.length) {
                  e.preventDefault();
                  input.setSelectionRange(prefix.length, prefix.length);
                }
              } else if (e.key === 'Home') {
                e.preventDefault();
                input.setSelectionRange(prefix.length, prefix.length);
              }
            }}
            className={styles.input}
            placeholder="https://example.com"
          />
        </div>
        <div className={styles.colA}></div>
        <div className={styles.colActions}>
          <button onClick={clearWebsite} className="btn-secondary mr-2" disabled={saving}>Clear</button>
          <button onClick={saveWebsite} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      {error && <div className="error-message p-4">{error}</div>}
      {message && <div className="success-message p-4">{message}</div>}
    </div>
  );
}


