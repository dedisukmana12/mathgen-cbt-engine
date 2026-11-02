// Copyright (c) 2026 Dedi Sukmana - ASF (Autonomous Solution Factory). Proprietary; all rights reserved.
import React, { useState, useEffect, Fragment } from 'react';
import { 
  Plus, 
  Send, 
  Download, 
  Settings2, 
  BookOpen, 
  GraduationCap, 
  Layers, 
  FileText, 
  Languages, 
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BookOpenCheck,
  Gauge,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from './lib/utils';
import { QuestionParams, QuestionType, DifficultyLevel, CBTQuestion, QuestionGroup } from './types';

const STORAGE_KEY = 'mathgen_cbt_groups_v1';

const QUESTION_TYPES = [
  { code: '1', label: 'Multiple Choice (Single)' },
  { code: '2', label: 'Multiple Choice Complex' },
  { code: '3', label: 'Matching' },
  { code: '4', label: 'Short Answer' },
  { code: '5', label: 'Essay' },
];

const DIFFICULTY_LEVELS: Array<{
  value: DifficultyLevel;
  label: string;
  summary: string;
  badgeClass: string;
}> = [
  {
    value: 'Very Easy',
    label: 'Very Easy',
    summary: '1-step recall or direct substitution; basic sign/reading distractors.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'Easy',
    label: 'Easy',
    summary: '1–2 step routine formula application; arithmetic error distractors.',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    value: 'Intermediate',
    label: 'Intermediate',
    summary: '2–3 step contextual problem connecting concepts; procedural rule traps.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'Advanced',
    label: 'Advanced',
    summary: 'Multi-step analytical reasoning & AKM synthesis; subtle partial-solution traps.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    value: 'Very Advanced',
    label: 'Very Advanced',
    summary: 'High-order HOTS synthesis & parameter analysis; sophisticated boundary/fallacy traps.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    value: 'Mixed',
    label: 'Mixed (Balanced)',
    summary: 'Balanced distribution across Very Easy, Easy, Intermediate, Advanced, and Very Advanced.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
];

function getDifficultyBadgeClass(level?: string) {
  const found = DIFFICULTY_LEVELS.find(
    (d) => d.value.toLowerCase() === (level || '').trim().toLowerCase()
  );
  return found ? found.badgeClass : 'bg-gray-100 text-gray-600 border-gray-200';
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const INITIAL_PARAMS: QuestionParams = {
  educationLevel: 'SMA',
  major: 'IPA',
  subject: 'Matematika',
  topic: '',
  grade: '10',
  semester: 'Semester 1',
  curriculum: 'Kurikulum Merdeka',
  numQuestions: 5,
  questionType: '1',
  difficulty: 'Intermediate',
  language: 'Bahasa Indonesia',
  numOptions: 5,
};

export default function App() {
  const [params, setParams] = useState<QuestionParams>(INITIAL_PARAMS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExplainingGroup, setIsExplainingGroup] = useState(false);
  const [groups, setGroups] = useState<QuestionGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sandboxText, setSandboxText] = useState<string>('$\\sqrt{b^2 - 4ac}$');
  const [previewQuestion, setPreviewQuestion] = useState<{ question: CBTQuestion; params: QuestionParams } | null>(null);
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [includeExplanationsInCsv, setIncludeExplanationsInCsv] = useState<boolean>(true);
  const [showAllExplanations, setShowAllExplanations] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    } catch {
      // ignore quota errors
    }
  }, [groups]);

  const generateQuestions = async () => {
    if (!params.topic.trim()) {
      setError('Please enter a topic first.');
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate questions.');
      }

      const questions: CBTQuestion[] = data.questions || [];

      const newGroup: QuestionGroup = {
        id: crypto.randomUUID(),
        params: { ...params },
        questions,
        timestamp: Date.now(),
      };

      setGroups((prev) => [newGroup, ...prev]);
      setActiveGroupId(newGroup.id);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateExplanationsForActiveGroup = async () => {
    if (!activeGroup) return;
    setError(null);
    setIsExplainingGroup(true);

    try {
      const response = await fetch('/api/questions/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: activeGroup.questions,
          params: activeGroup.params,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate explanations.');
      }

      const enrichedQuestions: CBTQuestion[] = data.questions || activeGroup.questions;

      setGroups((prev) =>
        prev.map((g) =>
          g.id === activeGroup.id
            ? { ...g, questions: enrichedQuestions }
            : g
        )
      );
      setShowAllExplanations(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to generate explanations for this question set.');
    } finally {
      setIsExplainingGroup(false);
    }
  };

  const deleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (activeGroupId === id) {
      const remaining = groups.filter((g) => g.id !== id);
      setActiveGroupId(remaining[0]?.id ?? null);
    }
  };

  const toggleExplanationRow = (groupId: string, questionNo: number) => {
    const key = `${groupId}-${questionNo}`;
    setExpandedExplanations((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? showAllExplanations),
    }));
  };

  const isExplanationVisible = (groupId: string, questionNo: number) => {
    const key = `${groupId}-${questionNo}`;
    if (key in expandedExplanations) {
      return expandedExplanations[key];
    }
    return showAllExplanations;
  };

  const toggleAllExplanations = () => {
    const next = !showAllExplanations;
    setShowAllExplanations(next);
    setExpandedExplanations({});
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  // Determine whether the active group has any primary question rows missing explanations
  const activeGroupNeedsExplanations = (() => {
    if (!activeGroup) return false;
    const isMC = activeGroup.params.questionType === '1' || activeGroup.params.questionType === '2';
    const primaryRows = isMC
      ? activeGroup.questions.filter((q) => q.opsi === 'A' || Boolean(q.soal))
      : activeGroup.questions;
    return primaryRows.some((q) => !q.pembahasan || !q.pembahasan.trim());
  })();

  // Compute difficulty breakdown for active group
  const difficultyCounts = (() => {
    if (!activeGroup) return {};
    const counts: Record<string, number> = {};
    const isMC = activeGroup.params.questionType === '1' || activeGroup.params.questionType === '2';
    const seenNos = new Set<number>();
    for (const q of activeGroup.questions) {
      if (isMC && q.no && seenNos.has(q.no)) continue;
      if (q.no) seenNos.add(q.no);
      if (q.tingkat_kesulitan) {
        counts[q.tingkat_kesulitan] = (counts[q.tingkat_kesulitan] || 0) + 1;
      }
    }
    return counts;
  })();

  const selectedDifficultyMeta = DIFFICULTY_LEVELS.find((d) => d.value === params.difficulty);

  const handleExportCsv = () => {
    if (!activeGroup) return;
    const baseHeaders =
      activeGroup.params.questionType === '3'
        ? ['NO', 'SOAL', 'JENIS', 'BARIS', 'KOLOM', 'KUNCI']
        : activeGroup.params.questionType === '4' || activeGroup.params.questionType === '5'
        ? ['NO', 'SOAL', 'JENIS', 'JAWABAN']
        : ['NO', 'SOAL', 'JENIS', 'OPSI', 'JAWABAN', 'KUNCI'];

    const headers = includeExplanationsInCsv
      ? [...baseHeaders, 'TINGKAT_KESULITAN', 'PEMBAHASAN']
      : baseHeaders;

    const rows = activeGroup.questions.map((q) => {
      return headers
        .map((h) => {
          const key = h.toLowerCase();
          return escapeCsvCell((q as any)[key] ?? '');
        })
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `math_questions_${activeGroup.params.topic}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans overflow-hidden">
      {/* Sidebar - Parameters */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 370 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="bg-white border-r border-[#E5E7EB] flex flex-col shadow-sm z-20 shrink-0 overflow-hidden"
      >
        <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">MathGen CBT</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded-md lg:hidden">
            <ChevronDown className="rotate-90" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <GraduationCap size={14} />
              <span>Academic Context</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Level</label>
                <select 
                  value={params.educationLevel}
                  onChange={e => setParams({...params, educationLevel: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {['SD', 'SMP', 'SMA', 'SMK', 'University'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Grade</label>
                <input 
                  type="number"
                  value={params.grade}
                  onChange={e => setParams({...params, grade: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Major / Stream</label>
                <select 
                  value={params.major}
                  onChange={e => setParams({...params, major: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {['IPA', 'IPS', 'Bahasa', 'Kejuruan', 'None'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Subject</label>
                <input 
                  value={params.subject}
                  onChange={e => setParams({...params, subject: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Topic / Chapter</label>
              <input 
                placeholder="e.g. Logaritma, Trigonometri, Integral..."
                value={params.topic}
                onChange={e => setParams({...params, topic: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Semester</label>
                <select 
                  value={params.semester}
                  onChange={e => setParams({...params, semester: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option>Semester 1</option>
                  <option>Semester 2</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Curriculum</label>
                <select 
                  value={params.curriculum}
                  onChange={e => setParams({...params, curriculum: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option>Kurikulum Merdeka</option>
                  <option>Kurikulum 2013</option>
                  <option>Cambridge</option>
                  <option>IB</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <Settings2 size={14} />
              <span>Generation Settings</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Question Type (JENIS)</label>
              <select 
                value={params.questionType}
                onChange={e => setParams({...params, questionType: e.target.value as QuestionType})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {QUESTION_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center justify-between">
                <span>Difficulty Level</span>
                <Gauge size={13} className="text-indigo-500" />
              </label>
              <select 
                value={params.difficulty}
                onChange={e => setParams({...params, difficulty: e.target.value as DifficultyLevel})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {DIFFICULTY_LEVELS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              {selectedDifficultyMeta && (
                <p className="text-[11px] leading-snug text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2">
                  {selectedDifficultyMeta.summary}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Question Count</label>
                <input 
                  type="number"
                  min="1" max="50"
                  value={params.numQuestions}
                  onChange={e => setParams({...params, numQuestions: parseInt(e.target.value) || 1})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Language</label>
                <select 
                  value={params.language}
                  onChange={e => setParams({...params, language: e.target.value as any})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option>Bahasa Indonesia</option>
                  <option>English</option>
                </select>
              </div>
            </div>

            {(params.questionType === '1' || params.questionType === '2') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Answer Options</label>
                <select 
                  value={params.numOptions}
                  onChange={e => setParams({...params, numOptions: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value={4}>4 Options (A–D)</option>
                  <option value={5}>5 Options (A–E)</option>
                </select>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <Layers size={14} />
              <span>LaTeX Sandbox</span>
            </div>
            <div className="space-y-3">
              <textarea 
                value={sandboxText}
                onChange={e => setSandboxText(e.target.value)}
                placeholder="Type LaTeX here..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-mono"
              />
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl min-h-[60px] flex items-center justify-center text-center">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {sandboxText || '*Preview will appear here*'}
                  </ReactMarkdown>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 italic">
                Tip: Use $...$ for inline MathJax expressions.
              </p>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-[#E5E7EB] bg-gray-50/50">
          <button 
            onClick={generateQuestions}
            disabled={isGenerating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            {isGenerating ? 'Generating Questions & Explanations...' : 'Generate Questions'}
          </button>
          {error && (
            <div className="mt-3 flex items-start gap-2 text-red-600 text-xs bg-red-50 p-2.5 rounded-lg border border-red-100">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText size={16} />
              <span>CBT Import Template & Explanation Studio</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeGroup && (
              <>
                <button
                  onClick={generateExplanationsForActiveGroup}
                  disabled={isExplainingGroup}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                    activeGroupNeedsExplanations
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  )}
                  title="Generate or refresh detailed LaTeX answer & distractor explanations for all questions in this set"
                >
                  {isExplainingGroup ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isExplainingGroup
                    ? 'Generating Explanations...'
                    : activeGroupNeedsExplanations
                    ? 'Generate Detailed Explanations'
                    : 'Regenerate Explanations'}
                </button>

                <button
                  onClick={toggleAllExplanations}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  {showAllExplanations ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showAllExplanations ? 'Collapse Explanations' : 'Expand All Explanations'}
                </button>

                <label className="hidden md:flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none px-2">
                  <input
                    type="checkbox"
                    checked={includeExplanationsInCsv}
                    onChange={(e) => setIncludeExplanationsInCsv(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Include PEMBAHASAN in CSV</span>
                </label>

                <button 
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 pb-28">
          <AnimatePresence mode="wait">
            {!activeGroup ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"
              >
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                  <BookOpen size={40} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to generate?</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Configure your curriculum parameters and select from 5 granular difficulty tiers (Very Easy to Very Advanced, or Mixed) to generate CBT-ready math items complete with step-by-step LaTeX explanations.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key={activeGroup.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 max-w-7xl mx-auto"
              >
                {/* Group Header & Difficulty Distribution */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-bold tracking-tight">{activeGroup.params.topic}</h2>
                      <span className={cn(
                        'px-2.5 py-0.5 text-xs font-semibold rounded-md border',
                        getDifficultyBadgeClass(activeGroup.params.difficulty)
                      )}>
                        Target: {activeGroup.params.difficulty}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><GraduationCap size={14} /> {activeGroup.params.educationLevel} Grade {activeGroup.params.grade} ({activeGroup.params.major})</span>
                      <span className="flex items-center gap-1"><Layers size={14} /> {activeGroup.params.curriculum}</span>
                      <span className="flex items-center gap-1"><Languages size={14} /> {activeGroup.params.language}</span>
                    </div>
                  </div>

                  {Object.keys(difficultyCounts).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Distribution:</span>
                      {DIFFICULTY_LEVELS.filter((d) => d.value !== 'Mixed' && difficultyCounts[d.value]).map((d) => (
                        <span
                          key={d.value}
                          className={cn('px-2 py-0.5 text-xs font-medium rounded border', d.badgeClass)}
                        >
                          {d.label}: {difficultyCounts[d.value]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Banner for previously generated questions without explanations */}
                {activeGroupNeedsExplanations && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <BookOpenCheck className="text-amber-600 shrink-0 mt-0.5" size={20} />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900">
                          Detailed Answer & Distractor Explanations Available
                        </h4>
                        <p className="text-xs text-amber-700 mt-0.5">
                          This previously generated question set does not yet have step-by-step mathematical explanations (PEMBAHASAN) or granular difficulty tags. Click to enrich all questions with LaTeX explanations.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={generateExplanationsForActiveGroup}
                      disabled={isExplainingGroup}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
                    >
                      {isExplainingGroup ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isExplainingGroup ? 'Generating...' : 'Add Explanations Now'}
                    </button>
                  </div>
                )}

                {/* CBT Template Data Table */}
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          {activeGroup.params.questionType === '3' ? (
                            <>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">NO</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SOAL</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">JENIS</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">BARIS</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">KOLOM</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 text-center">KUNCI</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">KESULITAN</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44 text-right">PEMBAHASAN & AKSI</th>
                            </>
                          ) : (activeGroup.params.questionType === '4' || activeGroup.params.questionType === '5') ? (
                            <>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">NO</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SOAL</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">JENIS</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">JAWABAN</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">KESULITAN</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44 text-right">PEMBAHASAN & AKSI</th>
                            </>
                          ) : (
                            <>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">NO</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SOAL</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">JENIS</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">OPSI</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">JAWABAN</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 text-center">KUNCI</th>
                              <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">KESULITAN</th>
                              <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44 text-right">PEMBAHASAN & AKSI</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {activeGroup.questions.map((q, idx) => {
                          const isMC = activeGroup.params.questionType === '1' || activeGroup.params.questionType === '2';
                          const isPrimaryRow = !isMC || q.opsi === 'A' || Boolean(q.soal);
                          const nextRow = activeGroup.questions[idx + 1];
                          const isLastRowOfQuestion = !isMC || !nextRow || nextRow.opsi === 'A' || Boolean(nextRow.soal) || nextRow.no !== q.no;

                          // Find primary row for this question number to access explanation on last row of MC block
                          const primaryQuestionRow = isMC
                            ? activeGroup.questions.find((rq) => rq.no === q.no && (rq.opsi === 'A' || Boolean(rq.pembahasan))) || q
                            : q;

                          const explanationText = primaryQuestionRow.pembahasan;
                          const questionNumber = primaryQuestionRow.no || q.no || idx + 1;
                          const showExplanationPanel =
                            isLastRowOfQuestion &&
                            Boolean(explanationText) &&
                            isExplanationVisible(activeGroup.id, questionNumber);

                          const totalColSpan =
                            activeGroup.params.questionType === '3'
                              ? 8
                              : activeGroup.params.questionType === '4' || activeGroup.params.questionType === '5'
                              ? 6
                              : 8;

                          return (
                            <Fragment key={idx}>
                              <tr className={cn(
                                'hover:bg-gray-50/60 transition-colors',
                                isMC && isPrimaryRow && idx > 0 && 'border-t-2 border-gray-200'
                              )}>
                                <td className="px-5 py-4 text-sm font-semibold text-gray-900 align-top">
                                  {isPrimaryRow ? q.no : ''}
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-700 max-w-md align-top">
                                  {q.soal ? (
                                    <div className="prose prose-sm max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {q.soal}
                                      </ReactMarkdown>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-500 font-mono align-top">{q.jenis}</td>
                                
                                {activeGroup.params.questionType === '3' ? (
                                  <>
                                    <td className="px-5 py-4 text-sm text-gray-700 align-top">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {q.baris || ''}
                                      </ReactMarkdown>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-700 align-top">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {q.kolom || ''}
                                      </ReactMarkdown>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center align-top">
                                      {q.kunci === 'v' && <CheckCircle2 size={18} className="text-green-500 mx-auto" />}
                                    </td>
                                  </>
                                ) : (activeGroup.params.questionType === '4' || activeGroup.params.questionType === '5') ? (
                                  <td className="px-5 py-4 text-sm text-gray-700 align-top">
                                    <div className="prose prose-sm max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {q.jawaban || ''}
                                      </ReactMarkdown>
                                    </div>
                                  </td>
                                ) : (
                                  <>
                                    <td className="px-4 py-4 text-sm font-bold text-gray-500 align-top">{q.opsi}</td>
                                    <td className="px-5 py-4 text-sm text-gray-700 align-top">
                                      <div className="prose prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                          {q.jawaban || ''}
                                        </ReactMarkdown>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center align-top">
                                      {q.kunci === 'v' && <CheckCircle2 size={18} className="text-green-500 mx-auto" />}
                                    </td>
                                  </>
                                )}

                                {/* Difficulty Column */}
                                <td className="px-4 py-4 text-xs align-top">
                                  {isPrimaryRow && primaryQuestionRow.tingkat_kesulitan ? (
                                    <span className={cn(
                                      'inline-block px-2 py-1 rounded-md border font-medium whitespace-nowrap',
                                      getDifficultyBadgeClass(primaryQuestionRow.tingkat_kesulitan)
                                    )}>
                                      {primaryQuestionRow.tingkat_kesulitan}
                                    </span>
                                  ) : null}
                                </td>

                                {/* Explanation Toggle & Live Preview Column */}
                                <td className="px-5 py-4 text-sm text-right align-top">
                                  {isPrimaryRow && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      {explanationText ? (
                                        <button
                                          onClick={() => toggleExplanationRow(activeGroup.id, questionNumber)}
                                          className={cn(
                                            'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border',
                                            isExplanationVisible(activeGroup.id, questionNumber)
                                              ? 'bg-indigo-600 text-white border-indigo-600'
                                              : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                                          )}
                                          title="Toggle Detailed Mathematical Explanation"
                                        >
                                          <BookOpenCheck size={14} />
                                          <span>Pembahasan</span>
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-gray-400 italic mr-1">No explanation</span>
                                      )}

                                      <button 
                                        onClick={() => {
                                          if (isMC) {
                                            const related = activeGroup.questions.filter((rq) => rq.no === q.no);
                                            setPreviewQuestion({
                                              question: {
                                                ...primaryQuestionRow,
                                                soal: primaryQuestionRow.soal || q.soal,
                                                relatedOptions: related,
                                              } as any,
                                              params: activeGroup.params,
                                            });
                                          } else {
                                            setPreviewQuestion({ question: q, params: activeGroup.params });
                                          }
                                        }}
                                        className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                        title="CBT Player Live Preview"
                                      >
                                        <Send size={16} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>

                              {/* Linked CBT Explanation Drawer Row */}
                              {showExplanationPanel && (
                                <tr className="bg-indigo-50/35">
                                  <td colSpan={totalColSpan} className="px-6 py-4 border-l-4 border-l-indigo-500">
                                    <div className="flex items-start gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                                        <BookOpenCheck size={15} />
                                      </div>
                                      <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                                            Detailed Explanation & Distractor Analysis (Question #{questionNumber})
                                          </span>
                                          {primaryQuestionRow.tingkat_kesulitan && (
                                            <span className={cn(
                                              'px-2 py-0.5 text-[10px] font-semibold rounded border',
                                              getDifficultyBadgeClass(primaryQuestionRow.tingkat_kesulitan)
                                            )}>
                                              {primaryQuestionRow.tingkat_kesulitan}
                                            </span>
                                          )}
                                        </div>
                                        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed bg-white/90 p-4 rounded-xl border border-indigo-100">
                                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {explanationText || ''}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Generations Floating Bar */}
        {groups.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl p-2 flex items-center gap-2 z-30">
            <div className="px-3 text-xs font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100 mr-1">History</div>
            <div className="flex items-center gap-2 max-w-md overflow-x-auto no-scrollbar">
              {groups.map(g => (
                <button 
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 group cursor-pointer",
                    activeGroupId === g.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "hover:bg-gray-100 text-gray-600"
                  )}
                >
                  <span>{g.params.topic}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded",
                    activeGroupId === g.id ? "bg-indigo-500 text-indigo-50" : "bg-gray-200/70 text-gray-500"
                  )}>
                    {g.params.difficulty}
                  </span>
                  <Trash2 
                    size={14} 
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400",
                      activeGroupId === g.id && "text-indigo-200"
                    )} 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(g.id);
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Question Preview Modal */}
      <AnimatePresence>
        {previewQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setPreviewQuestion(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <Send size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">CBT Player Preview</h3>
                      {previewQuestion.question.tingkat_kesulitan && (
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-semibold rounded border',
                          getDifficultyBadgeClass(previewQuestion.question.tingkat_kesulitan)
                        )}>
                          {previewQuestion.question.tingkat_kesulitan}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Question #{previewQuestion.question.no}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewQuestion(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <ChevronDown className="rotate-180" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="space-y-3">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Question Stem</div>
                  <div className="text-lg leading-relaxed text-gray-800 prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {previewQuestion.question.soal}
                    </ReactMarkdown>
                  </div>
                </div>

                {(previewQuestion.params.questionType === '1' || previewQuestion.params.questionType === '2') && (previewQuestion.question as any).relatedOptions && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Answer Options</div>
                    <div className="space-y-2.5">
                      {(previewQuestion.question as any).relatedOptions.map((opt: CBTQuestion, i: number) => (
                        <div key={i} className={cn(
                          "p-4 rounded-2xl border flex items-start gap-4 transition-all group",
                          opt.kunci === 'v' ? "bg-green-50 border-green-200" : "bg-white border-gray-100"
                        )}>
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                            opt.kunci === 'v' ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
                          )}>
                            {opt.opsi}
                          </div>
                          <div className="pt-1 text-gray-700 prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {opt.jawaban}
                            </ReactMarkdown>
                          </div>
                          {opt.kunci === 'v' && (
                            <div className="ml-auto text-green-600 text-xs font-bold uppercase tracking-tighter self-center">Correct</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewQuestion.params.questionType === '3' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Matching Pair</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Left Item (BARIS)</div>
                        <div className="font-medium prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {previewQuestion.question.baris || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="text-[10px] text-indigo-400 uppercase mb-1">Right Item (KOLOM)</div>
                        <div className="font-medium prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {previewQuestion.question.kolom || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(previewQuestion.params.questionType === '4' || previewQuestion.params.questionType === '5') && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Expected Answer</div>
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 text-gray-700 prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {previewQuestion.question.jawaban}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Detailed Mathematical Explanation inside CBT Preview */}
                {previewQuestion.question.pembahasan && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest">
                      <BookOpenCheck size={15} />
                      <span>Detailed Explanation & Distractor Rationale (PEMBAHASAN)</span>
                    </div>
                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-gray-800 prose prose-sm max-w-none leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {previewQuestion.question.pembahasan}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button 
                  onClick={() => setPreviewQuestion(null)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
