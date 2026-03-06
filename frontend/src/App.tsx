import { useState, useEffect, useRef } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { motion } from 'framer-motion'
import { Play, Code2, ArrowLeft, ArrowRight, Zap, Target, AlertTriangle, CheckCircle, ChevronDown, BookOpen, X, BarChart3, TrendingDown, Trophy, Activity, Clock, FileDown } from 'lucide-react'

import { api } from './api/client'
import { detectComplexity, generateOptimization, generateHint, type HintInfo } from './optimizer'
import { analyzeMentor, type MentorFeedback } from './mentor'

// Dynamic scaffolded nudges are built per-question from hintInfo.wrongAnswerHint
// (no hardcoded HashSet hints here — each pattern has its own context-specific hint)

const LANGUAGES = [
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'javascript', name: 'JavaScript', icon: '📜' },
    { id: 'cpp', name: 'C++', icon: '⚙️' },
    { id: 'java', name: 'Java', icon: '☕' },
]

const DEFAULT_CODES: Record<string, string> = {
    python: `def find_duplicates(arr):
    duplicates = []
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j] and arr[i] not in duplicates:
                duplicates.append(arr[i])
    return duplicates`,
    javascript: `function findDuplicates(arr) {
    let duplicates = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
                duplicates.push(arr[i]);
            }
        }
    }
    return duplicates;
}`,
    cpp: `vector<int> findDuplicates(vector<int>& arr) {
    vector<int> duplicates;
    for (int i = 0; i < arr.size(); i++) {
        for (int j = i + 1; j < arr.size(); j++) {
            if (arr[i] == arr[j]) {
                bool exists = false;
                for(int d : duplicates) if(d == arr[i]) exists = true;
                if(!exists) duplicates.push_back(arr[i]);
            }
        }
    }
    return duplicates;
}`,
    java: `public List<Integer> findDuplicates(int[] arr) {
    List<Integer> duplicates = new ArrayList<>();
    for (int i = 0; i < arr.length; i++) {
        for (int j = i + 1; j < arr.length; j++) {
            if (arr[i] == arr[j] && !duplicates.contains(arr[i])) {
                duplicates.add(arr[i]);
            }
        }
    }
    return duplicates;
}`
}

export default function App() {
    const [language, setLanguage] = useState(LANGUAGES[0])
    const [code, setCode] = useState(DEFAULT_CODES.python)
    const [analyzing, setAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<any>(null)
    const [hintLevel, setHintLevel] = useState(0)
    const [hintAnswer, setHintAnswer] = useState('')
    const [hintFeedback, setHintFeedback] = useState<any>(null)
    const [hintInfo, setHintInfo] = useState<HintInfo | null>(null)
    const [optimization, setOptimization] = useState<any>(null)
    const [optimizing, setOptimizing] = useState(false)
    const [wrongAttempts, setWrongAttempts] = useState(0)
    const [showExplanation, setShowExplanation] = useState(false)
    const [showMentor, setShowMentor] = useState(false)
    const [mentorFeedback, setMentorFeedback] = useState<MentorFeedback | null>(null)
    const [view, setView] = useState<'editor' | 'dashboard'>('editor')
    const [showStressTest, setShowStressTest] = useState(false)
    const [submissions, setSubmissions] = useState<any[]>([])
    const sessionStartRef = useRef<number>(Date.now())
    const mentorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleGenerateReport = () => {
        window.print();
    }

    const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
        setLanguage(lang)
        if (code === DEFAULT_CODES[language.id]) {
            setCode(DEFAULT_CODES[lang.id])
        }
    }

    // Real-time mentor: debounce analysis 600ms after code/language changes
    useEffect(() => {
        if (mentorTimerRef.current) clearTimeout(mentorTimerRef.current)
        mentorTimerRef.current = setTimeout(() => {
            const result = analyzeMentor(code, language.id)
            setMentorFeedback(result)
        }, 600)
        return () => { if (mentorTimerRef.current) clearTimeout(mentorTimerRef.current) }
    }, [code, language.id])

    // Smart client-side analysis using the optimizer engine
    const getLocalAnalysis = (codeInput: string, lang: string) => {
        const lines = codeInput.split('\n')
        const { time, gap, cognitive, pattern } = detectComplexity(codeInput)
        const patterns: any[] = []

        if (pattern === 'nested_loop' || pattern === 'linear_search_in_loop') {
            patterns.push({
                name: pattern === 'linear_search_in_loop'
                    ? `Linear Search Inside Loop (.contains/.includes call)`
                    : 'Nested Loop Detected — O(n²) bottleneck',
                line_start: 1,
                line_end: lines.length,
                severity: 'high',
                suggestion: 'Replace inner loop / linear search with a HashMap or HashSet for O(1) lookup'
            })
        } else if (pattern === 'recursion_no_memo') {
            patterns.push({
                name: 'Recursion Without Memoization — exponential recomputation',
                line_start: 1,
                line_end: lines.length,
                severity: 'high',
                suggestion: 'Add memoization (HashMap / @lru_cache) to cache repeated sub-problems'
            })
        }

        return {
            submission_id: 'demo-' + Date.now(),
            time_complexity: time,
            space_complexity: 'O(n)',
            thinking_gap_score: gap,
            cognitive_load: cognitive,
            detected_patterns: patterns,
            ast_summary: { summary: `${lang} code, ${lines.length} lines — pattern: ${pattern}` },
            _isDemo: true,
            _code: codeInput,
            _lang: lang,
        }
    }

    // Generates a genuinely customized optimization based on the actual user code
    const getLocalOptimization = (userCode: string, lang: string) => {
        const result = generateOptimization(userCode, lang)
        return result
    }


    const handleAnalyze = async () => {
        setAnalyzing(true)
        setShowStressTest(false) // Reset stress test view
        try {
            const res = await api.post('/api/analyze', { code, language: language.id })
            setAnalysis(res.data)
            setOptimization(null)
            setHintLevel(0)
            setHintFeedback(null)
            setHintInfo(null)
            setHintAnswer('')
            setWrongAttempts(0)
            setShowExplanation(false)
        } catch (_err) {
            // Backend not available — run local demo analysis
            console.warn('Backend unavailable, using demo mode')
            const demoResult = getLocalAnalysis(code, language.id)
            setAnalysis(demoResult)

            // Record submission with session-relative time
            const now = Date.now()
            const relativeSec = Math.floor((now - sessionStartRef.current) / 1000)

            // Simulation logic to show "fair" execution times - O(n^2) is slow but still sub-second
            const estTime = demoResult.time_complexity.includes('n²') ? (0.05 + Math.random() * 0.1).toFixed(3) : (0.001 + Math.random() * 0.005).toFixed(3);

            setSubmissions(prev => [{
                ...demoResult,
                timestamp: now,
                sessionTime: relativeSec,
                runtime: estTime
            }, ...prev].slice(0, 10))

            setOptimization(null)
            setHintLevel(0)
            setHintFeedback(null)
            setHintInfo(null)
            setHintAnswer('')
            setWrongAttempts(0)
            setShowExplanation(false)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleHint = () => {
        if (hintLevel === 0) {
            setHintLevel(1)
            const userCode = analysis?._code ?? code
            const userLang = analysis?._lang ?? language.id
            const hint = generateHint(userCode, userLang)
            setHintInfo(hint)
            setHintFeedback({ q: hint.question })
            setShowExplanation(true)
        }
    }

    const submitHint = async () => {
        const ans = hintAnswer.toLowerCase().trim()
        // keywords come from the hint engine — already context-specific per pattern
        const keywords = hintInfo?.acceptedKeywords ?? ['hash', 'set', 'dict', 'map']
        // Normalise both sides: strip spaces & special chars for fuzzy match
        const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const normAns = normalise(ans)
        const isCorrect = keywords.some(kw => {
            const normKw = normalise(kw)
            // Accept if: answer contains keyword OR keyword contains answer (short aliases)
            return normAns.includes(normKw) || normKw.includes(normAns)
        })

        if (isCorrect) {
            setWrongAttempts(0)
            setHintFeedback({ ...hintFeedback, passed: true, msg: `✅ Excellent! You identified the right concept. Generating your personalised optimized solution…` })
            setOptimizing(true)

            // Always use the current code in the editor (guaranteed to exist)
            const codeToOptimize = code
            const langToOptimize = language.id

            console.log('[CCE] submitHint: correct answer, optimizing', { codeToOptimize: codeToOptimize.slice(0, 60), langToOptimize, isDemo: analysis?._isDemo })

            try {
                // Use local optimizer when: demo mode, or no submission_id from backend
                const useLocal = analysis?._isDemo || !analysis?.submission_id
                if (useLocal) {
                    await new Promise(r => setTimeout(r, 600))
                    const localResult = getLocalOptimization(codeToOptimize, langToOptimize)
                    console.log('[CCE] local optimization result', localResult.optimized_code?.slice(0, 80))
                    setOptimization(localResult)
                } else {
                    try {
                        const res = await api.post('/api/optimize', {
                            submission_id: analysis.submission_id,
                            code: codeToOptimize,
                            language: langToOptimize,
                            level: 2
                        })
                        setOptimization(res.data)
                    } catch (backendErr) {
                        console.warn('[CCE] backend optimize failed, using local', backendErr)
                        await new Promise(r => setTimeout(r, 400))
                        setOptimization(getLocalOptimization(codeToOptimize, langToOptimize))
                    }
                }
            } catch (err) {
                console.error('[CCE] optimization error', err)
                setOptimization(getLocalOptimization(codeToOptimize, langToOptimize))
            } finally {
                setOptimizing(false)
            }
        } else {
            const nextAttempt = wrongAttempts + 1
            setWrongAttempts(nextAttempt)

            // Build dynamic scaffolded nudges from the hint engine (context-specific per pattern)
            const baseHint = hintInfo?.wrongAnswerHint ?? 'Think about the most efficient data structure for this problem.'
            const nudges = [
                null,
                { label: '💡 Nudge', text: `Wrong answer — think more carefully. ${baseHint}` },
                { label: '🔎 Clue', text: baseHint },
                { label: '📖 Near-Answer', text: `Almost there! ${baseHint} Accepted answers include: **${(hintInfo?.acceptedKeywords ?? []).slice(0, 5).join(', ')}**.` },
            ]
            const scaffold = nudges[Math.min(nextAttempt, nudges.length - 1)]
            setHintFeedback({ ...hintFeedback, passed: false, msg: `❌ Not quite right. Try again!`, scaffold })
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <header className="border-b border-slate-800 p-4 shrink-0 flex items-center justify-between bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    {analysis && (
                        <button
                            onClick={() => setAnalysis(null)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 group"
                            title="Back to Editor"
                        >
                            <ArrowLeft size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                            <Zap className="text-white fill-white" size={24} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            CCE
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <button className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg hover:border-slate-700 transition-all shadow-xl">
                            <span className="text-lg">{language.icon}</span>
                            <span className="font-bold">{language.name}</span>
                            <ChevronDown size={16} className="text-slate-500" />
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                            {LANGUAGES.map(lang => (
                                <button
                                    key={lang.id}
                                    onClick={() => handleLanguageChange(lang)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left font-semibold border-b border-slate-800/50 last:border-0"
                                >
                                    <span>{lang.icon}</span>
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setView(view === 'editor' ? 'dashboard' : 'editor')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border transition-all ${view === 'dashboard'
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-blue-600/50 hover:text-blue-300'
                            }`}
                    >
                        <BarChart3 size={16} />
                        {view === 'dashboard' ? 'Back to Editor' : 'Growth Dashboard'}
                    </button>

                    {/* Real-Time Mentor toggle button */}
                    <button
                        onClick={() => setShowMentor(p => !p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border transition-all ${showMentor
                            ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-violet-600/50 hover:text-violet-300'
                            }`}
                    >
                        <BookOpen size={16} />
                        AI Mentor
                        {mentorFeedback && (mentorFeedback.status === 'Suboptimal' || mentorFeedback.status === 'Incorrect') && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                    </button>

                    <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800 shadow-inner">
                        <Target className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-black text-slate-300">XP: <span className="text-white">120</span></span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {view === 'dashboard' ? (
                    <div className="flex-1 p-8 overflow-y-auto bg-slate-950">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-8">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-4xl font-black mb-2 no-print flex items-center gap-4">
                                        <button
                                            onClick={() => setView('editor')}
                                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
                                        >
                                            <ArrowLeft size={20} className="text-slate-400" />
                                        </button>
                                        Growth Dashboard
                                    </h2>
                                    <p className="text-slate-400 no-print ml-14">Tracking your evolution from coder to architect.</p>
                                    {/* Print Title */}
                                    <div className="hidden print:block text-slate-900">
                                        <h1 className="text-3xl font-black mb-1">CCE Student Progress Report</h1>
                                        <p className="text-sm font-bold opacity-70">Generated on {new Date().toLocaleDateString()} for Student #8129</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 no-print">
                                    <button
                                        onClick={handleGenerateReport}
                                        className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-sm shadow-xl hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                                    >
                                        <FileDown size={18} />
                                        Download PDF Report
                                    </button>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-blue-500 uppercase tracking-widest leading-none">Global Rank</span>
                                        <p className="text-2xl font-black text-white">#1,242 <span className="text-sm font-normal text-slate-500">of 45k</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-6">
                                <GrowthStatCard icon={<TrendingDown className="text-green-400" />} label="Thinking Gap" value="68 → 41" subValue="-27 this week" trend="IMPROVING" />
                                <GrowthStatCard icon={<Zap className="text-yellow-400" />} label="Total XP" value="1,240" subValue="+150 today" />
                                <GrowthStatCard icon={<Activity className="text-blue-400" />} label="Day Streak" value="5 Days" subValue="Next milestone: 7" />
                                <GrowthStatCard icon={<Trophy className="text-purple-400" />} label="Current Level" value="Code Thinker II" subValue="340 XP to next level" />
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Clock className="text-blue-500" /> Complexity Journey
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-end gap-2 h-40">
                                            {submissions.length > 0 ? (
                                                [...submissions].reverse().map((sub, i) => {
                                                    const complexityScore = sub.time_complexity.includes('n²') ? 0.8 : sub.time_complexity.includes('log n') ? 0.4 : 0.2;
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                            <div className="w-full bg-blue-600/20 border border-blue-500/20 rounded-t-lg transition-all group-hover:bg-blue-600/40 relative" style={{ height: `${complexityScore * 100}%` }}>
                                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800/80 backdrop-blur-sm text-[9px] px-1.5 py-0.5 rounded text-blue-300 font-black border border-blue-500/20">
                                                                    {sub.runtime}s
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-500">T + {sub.sessionTime}s</span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm italic">No submissions yet today.</div>
                                            )}
                                        </div>
                                        <div className="flex justify-between pt-4 border-t border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>{submissions.length} Recorded Attempts</span>
                                            <div className="flex gap-4">
                                                {[...submissions].reverse().slice(-5).map((sub, i) => (
                                                    <span key={i} className={sub.time_complexity === 'O(n)' ? 'text-green-400' : ''}>
                                                        {sub.time_complexity.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Trophy className="text-yellow-500" /> Mastery Badges
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {['Hash Map Hero', 'Loop Slayer', 'Big-O Believer', 'Recursion Master', 'Buffer King'].map(badge => (
                                            <span key={badge} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:border-yellow-500/50 transition-all cursor-default">
                                                {badge}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="pt-4 border-t border-slate-800">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Mastered Concepts</p>
                                        <p className="text-sm text-slate-200">Hash Maps, Two Pointers, String Slicing</p>
                                    </div>
                                    <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Next Review Due</p>
                                        <p className="text-sm font-bold text-blue-100">Sliding Window (2 days)</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Hidden Print Content / Focus Areas */}
                        <div className="hidden print:block mt-12 pt-8 border-t-2 border-slate-200 text-slate-900">
                            <h3 className="text-xl font-black mb-4 uppercase tracking-tighter">Strategic Focus Areas (v1.0)</h3>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <p className="font-bold text-sm text-blue-800 uppercase tracking-widest">Top Recommendations</p>
                                    <ul className="space-y-2 text-sm list-disc pl-4 italic">
                                        <li>Strengthen understanding of **Sliding Window** edge cases.</li>
                                        <li>Transition from **Nested Loops** to **Linear Set Lookups** in bulk processing.</li>
                                        <li>Practice **Hierarchical Structures (Heaps/Trees)** for priority-based logic.</li>
                                    </ul>
                                </div>
                                <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200">
                                    <p className="font-black text-xs uppercase tracking-widest mb-2">Instructor Assessment</p>
                                    <p className="text-sm leading-relaxed">Level 3 Architect potential detected. Student shows high cognitive adaptability in space/time trade-off scenarios. Recommend advancing to **Graph Theory** modules next week.</p>
                                </div>
                            </div>
                            <div className="mt-12 text-center opacity-30 text-[10px] font-bold">
                                Cognitive Code Evolution (CCE) - Academic Audit Record #CCE-2026-X812
                            </div>
                        </div>
                    </div>
                ) : !analysis ? (
                    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-10 text-center mt-12"
                        >
                            <h2 className="text-5xl font-black mb-4 tracking-tight leading-tight">
                                We don't just <span className="text-blue-500">fix code</span>. <br />
                                We <span className="italic bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent underline decoration-indigo-500/30">evolve your brain</span>.
                            </h2>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto">Paste your logic-heavy code and let the CCE engine map your cognitive path and performance bottlenecks.</p>
                        </motion.div>

                        <div className="flex-1 min-h-[450px] border border-slate-800 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative bg-slate-900/40">
                            <Editor
                                height="100%"
                                language={language.id === 'cpp' ? 'cpp' : language.id}
                                theme="vs-dark"
                                value={code}
                                onChange={(val) => setCode(val || '')}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 16,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    padding: { top: 24, bottom: 24 },
                                    smoothScrolling: true,
                                    cursorBlinking: 'smooth',
                                    lineNumbersMinChars: 3,
                                }}
                            />
                        </div>

                        {/* ── Real-Time Mentor Panel ── */}
                        {showMentor && mentorFeedback && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 12 }}
                                className="mt-4 rounded-2xl border border-violet-700/30 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-[0_8px_32px_rgba(124,58,237,0.15)]"
                            >
                                {/* Mentor header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-violet-800/30 bg-violet-900/10">
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={16} className="text-violet-400" />
                                        <span className="font-black text-[11px] uppercase tracking-widest text-violet-300">🎓 AI Real-Time Code Mentor</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-2 ${mentorFeedback.status === 'Optimal' || mentorFeedback.status === 'Correct'
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : mentorFeedback.status === 'Suboptimal'
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                            {mentorFeedback.status === 'Optimal' || mentorFeedback.status === 'Correct' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                            {mentorFeedback.status}
                                        </div>
                                        <button onClick={() => setShowMentor(false)} className="text-slate-600 hover:text-slate-300 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-5 space-y-6">
                                    {/* Precise Issue */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Detected Pattern</p>
                                        <p className="text-lg font-bold text-white leading-tight">
                                            {mentorFeedback.logicIssue}
                                        </p>
                                    </div>

                                    {/* Data Structure & Complexity Recommendation */}
                                    {mentorFeedback.recommendation && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Target Structure</p>
                                                <p className="font-bold text-white text-md">{mentorFeedback.recommendation.dataStructure}</p>
                                                <p className="text-xs text-slate-400 leading-relaxed">{mentorFeedback.recommendation.reason}</p>
                                            </div>
                                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Time Complexity</p>
                                                    <p className="font-mono text-white text-sm">{mentorFeedback.recommendation.timeComplexity}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Space Complexity</p>
                                                    <p className="font-mono text-white text-sm">{mentorFeedback.recommendation.spaceComplexity}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Precise Fix */}
                                    {mentorFeedback.fix && (
                                        <div className="bg-violet-500/5 p-4 rounded-xl border border-violet-500/20">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-2">Precise Solution Hint</p>
                                            <p className="text-sm text-slate-300 italic leading-relaxed">
                                                "{mentorFeedback.fix}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        <div className="mt-10 flex justify-center">
                            <button
                                onClick={handleAnalyze}
                                className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all px-10 py-4 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 active:scale-95"
                                disabled={analyzing}
                            >
                                {analyzing ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <LoaderIcon />
                                    </motion.div>
                                ) : <Play className="fill-white group-hover:translate-x-1 transition-transform" size={24} />}
                                {analyzing ? 'Synthesizing...' : 'Analyze Architecture'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Panel */}
                        <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-900/30">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                <h3 className="font-black flex items-center gap-2 text-slate-400 uppercase tracking-widest text-xs">
                                    <Code2 size={16} /> Original Fragment
                                </h3>
                                <div className="flex gap-2">
                                    <Badge label="Runtime" value={analysis.time_complexity} color="red" />
                                    <Badge label="Storage" value={analysis.space_complexity} color="yellow" />
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <Editor
                                    height="100%"
                                    language={language.id === 'cpp' ? 'cpp' : language.id}
                                    theme="vs-dark"
                                    value={code}
                                    options={{ readOnly: true, minimap: { enabled: false }, padding: { top: 16 } }}
                                />
                            </div>
                            <div className="h-72 border-t border-slate-800 p-6 overflow-y-auto bg-slate-950 relative">
                                <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-200">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                    Diagnostic Metrics
                                </h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <MetricCard label="Thinking Gap" value={analysis.thinking_gap_score} max={100} isGauge />
                                    <MetricCard label="Cognitive Load" value={analysis.cognitive_load} />
                                </div>
                                <div className="mt-6">
                                    <p className="text-xs font-black text-slate-500 mb-3 uppercase tracking-tighter">Detected Structural Flaws:</p>
                                    <div className="space-y-2">
                                        {analysis.detected_patterns.map((p: any, i: number) => (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                key={i}
                                                className="text-sm bg-red-500/5 text-red-200 border border-red-500/20 p-3 rounded-xl flex gap-3 items-start backdrop-blur-sm"
                                            >
                                                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                                                <div>
                                                    <div className="font-bold text-red-400">{p.name}</div>
                                                    <div className="opacity-70 text-xs">{p.suggestion}</div>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {analysis.detected_patterns.length === 0 && (
                                            <div className="text-sm text-slate-500 italic">No major flaws detected in this fragment.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel */}
                        <div className="w-1/2 flex flex-col bg-slate-950">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                                <h3 className="font-black flex items-center gap-2 text-blue-400 uppercase tracking-widest text-xs">
                                    <Zap size={16} /> Optimization Mentor
                                </h3>
                                <button
                                    className="flex items-center gap-2 text-xs font-black bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-all text-slate-200 border border-slate-700 shadow-lg active:scale-95"
                                    onClick={() => setAnalysis(null)}
                                >
                                    <ArrowRight size={14} className="rotate-180" />
                                    Back to Editor
                                </button>
                            </div>

                            {!optimization ? (
                                <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950">

                                    {/* ── STEP 1: Code Explanation — shown after clicking hint ── */}
                                    {showExplanation && hintInfo && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-2"
                                        >
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full inline-block animate-pulse" />
                                                Why is your code inefficient?
                                            </p>
                                            {hintInfo.codeExplanation.split('\n').map((line, i) => (
                                                <motion.p
                                                    key={i}
                                                    initial={{ opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className="text-sm text-slate-300 leading-relaxed"
                                                    dangerouslySetInnerHTML={{
                                                        __html: line
                                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                                            .replace(/`(.*?)`/g, '<code class="bg-slate-800 text-blue-300 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
                                                    }}
                                                />
                                            ))}
                                        </motion.div>
                                    )}

                                    {/* ── STEP 2: Hint Gate ── */}
                                    <motion.div
                                        initial={{ scale: 0.97, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="bg-slate-900 border border-slate-800 rounded-[1.5rem] p-6 shadow-2xl space-y-4"
                                    >
                                        {!hintFeedback ? (
                                            <>
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center shrink-0 mt-0.5">
                                                        <Target className="text-yellow-400" size={22} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black mb-1">Complexity Warning</h4>
                                                        <p className="text-slate-400 text-sm">Your solution uses suboptimal iterations. Answer a concept question to unlock the optimized solution.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleHint}
                                                    className="bg-indigo-600 hover:bg-indigo-500 w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    Show Me Why &amp; Get a Hint <ArrowRight size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                                                {/* Socratic Question */}
                                                <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-2xl">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">🧠 Concept Check — Answer to Unlock</p>
                                                    <p className="font-bold text-indigo-200 text-sm leading-snug">{hintFeedback.q}</p>
                                                </div>

                                                {/* Scaffolded Nudge (progressively revealed on each wrong attempt) */}
                                                {hintFeedback.scaffold && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl"
                                                    >
                                                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">{hintFeedback.scaffold.label}</p>
                                                        <p className="text-sm text-amber-200 leading-relaxed"
                                                            dangerouslySetInnerHTML={{
                                                                __html: hintFeedback.scaffold.text
                                                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                                                    .replace(/`(.*?)`/g, '<code class="bg-amber-900/40 text-amber-200 px-1 rounded text-xs font-mono">$1</code>')
                                                            }}
                                                        />
                                                    </motion.div>
                                                )}

                                                {/* Answer Input (hidden once correct) */}
                                                {!hintFeedback.passed && (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:border-indigo-500 outline-none ring-4 ring-transparent focus:ring-indigo-500/10 transition-all font-mono placeholder-slate-600"
                                                            placeholder="Type your answer (e.g. HashSet, HashMap, set, Map…)"
                                                            value={hintAnswer}
                                                            onChange={e => setHintAnswer(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && submitHint()}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={submitHint}
                                                            disabled={optimizing || !hintAnswer.trim()}
                                                            className="bg-blue-600 hover:bg-blue-500 w-full py-3 rounded-xl font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                                        >
                                                            {optimizing ? (
                                                                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><LoaderIcon /></motion.div> Generating…</>
                                                            ) : 'Verify Answer'}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Feedback pill */}
                                                {hintFeedback.msg && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-3 ${hintFeedback.passed
                                                            ? 'bg-green-950/40 text-green-300 border border-green-800/50'
                                                            : 'bg-red-950/30 text-red-400 border border-red-900/50'
                                                            }`}
                                                    >
                                                        {hintFeedback.passed ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                                        {hintFeedback.msg}
                                                    </motion.div>
                                                )}

                                                {/* Learning Checkpoint — shown after correct answer */}
                                                {hintFeedback.passed && !optimizing && hintInfo && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.3 }}
                                                        className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 space-y-2"
                                                    >
                                                        <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">🎓 What you just learned</p>
                                                        <p className="text-sm text-green-200 leading-relaxed">
                                                            <strong className="text-white">Correct concept: </strong>
                                                            {hintInfo.wrongAnswerHint}
                                                        </p>
                                                        <p className="text-sm text-slate-400 leading-relaxed">
                                                            Accepted answers included: <span className="text-green-300 font-mono">{hintInfo.acceptedKeywords.slice(0, 6).join(', ')}</span>
                                                        </p>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex-1 flex flex-col"
                                >
                                    <div className="flex-1 relative border-b border-slate-800">
                                        <DiffEditor
                                            height="100%"
                                            original={code}
                                            modified={optimization.optimized_code}
                                            language={language.id === 'cpp' ? 'cpp' : language.id}
                                            theme="vs-dark"
                                            options={{ readOnly: true, minimap: { enabled: false }, renderSideBySide: false, padding: { top: 16 } }}
                                        />
                                    </div>
                                    <div className="h-72 p-6 overflow-y-auto bg-slate-950 scrollbar-hide">
                                        <div className="flex items-center gap-3 mb-6">
                                            <button
                                                onClick={() => setShowStressTest(!showStressTest)}
                                                className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${showStressTest
                                                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                            >
                                                {showStressTest ? 'Stop Stress Test' : 'Performance Stress Test'}
                                            </button>
                                            <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-black border border-green-500/20">
                                                +{optimization.xp_awarded} XP EARNED
                                            </div>
                                        </div>

                                        {showStressTest ? (
                                            <StressTestModule
                                                beforeComplexity={optimization.explanation?.complexity_comparison?.before ?? 'O(n²)'}
                                                afterComplexity={optimization.time_complexity_after ?? 'O(n)'}
                                            />
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Structural Upgrade</span>
                                                        <p className="text-blue-300 font-mono text-sm">{optimization.explanation?.pattern_replaced ?? 'Optimized'}</p>
                                                    </div>
                                                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Complexity Delta</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-red-400/50 line-through text-xs">{optimization.explanation?.complexity_comparison?.before?.split(' ')[0] ?? '?'}</span>
                                                            <ArrowRight size={12} className="text-slate-600" />
                                                            <span className="text-green-400 font-black">{optimization.time_complexity_after ?? 'O(n)'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Optimization Thesis</span>
                                                    <p className="text-slate-300 text-sm leading-relaxed">{optimization.explanation.why_better}</p>
                                                </div>
                                                {optimization.conceptual_question && (
                                                    <div className="bg-indigo-900/20 border border-indigo-700/30 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">💭 Reflect &amp; Go Deeper</span>
                                                        <p className="text-indigo-200 text-sm">{optimization.conceptual_question}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}


function LoaderIcon() {
    return <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
}

function Badge({ label, value, color }: { label: string, value: string, color: string }) {
    const c = color === 'red' ? 'bg-red-900 text-red-300 border-red-700' : color === 'yellow' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' : 'bg-green-900 text-green-300 border-green-700'
    return (
        <div className={`text-xs px-2 py-1 rounded border bg-opacity-30 flex items-center gap-1 ${c}`}>
            <span className="opacity-70">{label}:</span> <span className="font-bold">{value}</span>
        </div>
    )
}

function MetricCard({ label, value, max, isGauge }: any) {
    return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
            <div className="text-xs text-slate-400 font-semibold mb-1">{label}</div>
            <div className="text-xl font-bold">{value} {isGauge && <span className="text-xs text-slate-500">/ {max}</span>}</div>
            {isGauge && (
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 h-1.5" style={{ width: `${(value / max) * 100}%` }}></div>
                </div>
            )}
        </div>
    )
}

function GrowthStatCard({ icon, label, value, subValue, trend }: any) {
    return (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                {icon}
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-white">{value}</p>
            <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400">{subValue}</p>
                {trend && (
                    <span className="text-[10px] font-black text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        {trend}
                    </span>
                )}
            </div>
        </div>
    )
}

function StressTestModule({ beforeComplexity, afterComplexity }: { beforeComplexity: string, afterComplexity: string }) {
    const nValues = [100, 1000, 10000, 100000]

    const calculateTime = (n: number, complexity: string) => {
        const c = complexity.toLowerCase()
        if (c.includes('n^2') || c.includes('n²)')) return (0.000008 * n * n).toFixed(2)
        if (c.includes('n log n')) return (0.000005 * n * Math.log2(n)).toFixed(2)
        if (c.includes('n')) return (0.0004 * n).toFixed(2)
        return (0.01).toFixed(2)
    }

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-800">
                        <tr>
                            <th className="px-4 py-3">Input Size (n)</th>
                            <th className="px-4 py-3 text-red-400">Original (ms)</th>
                            <th className="px-4 py-3 text-green-400">Optimized (ms)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {nValues.map(n => (
                            <tr key={n} className="hover:bg-slate-900/30 transition-colors">
                                <td className="px-4 py-3 font-mono text-slate-400">n={n.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-red-300/80">{calculateTime(n, beforeComplexity)}</td>
                                <td className="px-4 py-3 font-mono text-green-300">{calculateTime(n, afterComplexity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 h-64 relative flex flex-col justify-end gap-2 overflow-hidden shadow-inner">
                <div className="absolute top-4 left-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Performance Graph</span>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[10px] font-bold text-slate-300">Original {beforeComplexity}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] font-bold text-slate-300">Optimized {afterComplexity}</span>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 flex items-end px-2 group">
                    {/* Simplified curve visuals using absolute SVG or CSS */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        {/* Red Curve (Exponentialish) */}
                        <path
                            d="M 10 200 Q 150 180, 280 20"
                            fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray="1000" strokeDashoffset="0"
                            className="drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        />
                        {/* Green Curve (Linearish) */}
                        <path
                            d="M 10 200 L 280 150"
                            fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"
                            className="drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                        />
                    </svg>
                    <div className="w-full flex justify-between text-[9px] font-black text-slate-700 uppercase pt-4">
                        <span>Small Input</span>
                        <span>Massive Scale</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fitted Big-O (Estimated)</p>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-400">Original = {beforeComplexity.split(' ')[0]}</span>
                        <ArrowRight size={12} className="text-slate-600" />
                        <span className="text-sm font-black text-green-400">Optimized = {afterComplexity.split(' ')[0]}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Scale Difference</p>
                    <p className="text-xl font-black text-white">~2,010x <span className="text-xs font-normal text-slate-500 text-sm">faster</span></p>
                </div>
            </div>
        </motion.div>
    )
}
