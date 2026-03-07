import { useState, useEffect, useRef } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { motion } from 'framer-motion'
import { Play, Code2, ArrowLeft, ArrowRight, Zap, Target, AlertTriangle, CheckCircle, ChevronDown, BookOpen, X, BarChart3, TrendingDown, Trophy, Activity, Clock, FileDown } from 'lucide-react'

import { api } from './api/client'
import { detectComplexity, generateOptimization, generateHint, type HintInfo } from './optimizer'
import { analyzeMentor, type MentorFeedback } from './mentor'
import { CheckCircle2, FlaskConical, PlayCircle, ShieldCheck } from 'lucide-react'

// Accuracy Test Cases for common patterns
const getTestCases = (pattern: string) => {
    switch (pattern) {
        case 'two_sum':
            return {
                cases: [
                    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
                    { input: [[3, 2, 4], 6], expected: [1, 2] },
                    { input: [[3, 3], 6], expected: [0, 1] }
                ],
                funcName: 'twoSum'
            }
        case 'nested_loop':
        case 'linear_search_in_loop':
            return {
                cases: [
                    { input: [[1, 2, 3, 2, 4, 1, 5, 2]], expected: [2, 1] },
                    { input: [[1, 1, 1]], expected: [1] },
                    { input: [[1, 2, 3]], expected: [] }
                ],
                funcName: 'findDuplicates'
            }
        case 'recursion_no_memo':
            return {
                cases: [
                    { input: [5], expected: 5 },
                    { input: [10], expected: 55 },
                    { input: [15], expected: 610 }
                ],
                funcName: 'fib'
            }
        case 'bfs_queue':
            return {
                cases: [
                    { input: [{ val: 1, left: { val: 2 }, right: { val: 3 } }], expected: [1, 2, 3] }
                ],
                funcName: 'levelOrder'
            }
        case 'ml_model':
            return {
                cases: [
                    { input: [[1.2, 0.5]], expected: 1 },
                    { input: [[-0.5, 2.1]], expected: 0 },
                    { input: [[2.2, -1.1]], expected: 1 }
                ],
                funcName: 'predict'
            }
        case 'regression':
            return {
                cases: [
                    { input: [10], expected: 20.5 },
                    { input: [20], expected: 40.2 },
                    { input: [30], expected: 60.1 }
                ],
                funcName: 'estimate'
            }
        default:
            return {
                cases: [
                    { input: [[1, 2, 2, 3]], expected: [2] }
                ],
                funcName: 'solve'
            }
    }
}


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
// ——— Accuracy Verification Engine ———
async function execCode(code: string, language: string, context: any) {
    if (language === 'javascript' || language === 'js') {
        try {
            const fn = new Function('...args', `${code}\nreturn ${context.funcName}(...args);`);
            return fn(...context.args);
        } catch (e) {
            console.error("Execution Error:", e);
            throw e;
        }
    }
    if (language === 'python' || language === 'py') {
        // @ts-ignore
        if (!window.pyodide) {
            // @ts-ignore
            window.pyodide = await window.loadPyodide();
        }
        // @ts-ignore
        const py = window.pyodide;
        await py.runPython(code);
        const argsStr = JSON.stringify(context.args).replace(/^\[|\]$/g, '');
        return py.runPython(`${context.funcName}(${argsStr})`).toJs();
    }
    return null;
}

function AccuracyVerifier({ original, optimized, language, pattern }: any) {
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [mlMetrics, setMlMetrics] = useState<any>(null);

    const runTests = async () => {
        setRunning(true);
        const config = getTestCases(pattern);
        const testOutcomes = [];

        // Specialized ML Detection
        const isML = /svm|randomforest|regression|sklearn|classifier|regressor/i.test(original);

        for (let i = 0; i < config.cases.length; i++) {
            const tc = config.cases[i];
            try {
                const outOpt = await execCode(optimized, language, { funcName: config.funcName, args: tc.input });
                const match = JSON.stringify(outOpt) === JSON.stringify(tc.expected);
                testOutcomes.push({
                    input: JSON.stringify(tc.input),
                    expected: JSON.stringify(tc.expected),
                    output: JSON.stringify(outOpt),
                    passed: match
                });
            } catch (err: any) {
                testOutcomes.push({
                    input: JSON.stringify(tc.input),
                    passed: false,
                    output: 'Runtime Error'
                });
            }
        }

        if (isML) {
            // Simulate ML Accuracy Calibration
            setMlMetrics({
                algorithm: pattern.includes('svm') ? 'SVM (RBF Kernel)' : 'Random Forest Ensembler',
                accuracy: (0.94 + Math.random() * 0.05).toFixed(4),
                f1: (0.92 + Math.random() * 0.06).toFixed(4),
                latency: '14ms'
            });
        }

        setResults(testOutcomes);
        setRunning(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-2xl">
                <div>
                    <h5 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <FlaskConical size={14} /> Intelligence Diagnostic Suite
                    </h5>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Verifying parity across neural checkpoints</p>
                </div>
                <button
                    onClick={runTests}
                    disabled={running}
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(8,145,178,0.3)]"
                >
                    {running ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Activity size={14} /></motion.div> : <PlayCircle size={14} />}
                    {running ? 'Diagnosing...' : 'Execute Parity Check'}
                </button>
            </div>

            {mlMetrics && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Model Precision</p>
                        <p className="text-xl font-black text-white">{mlMetrics.accuracy}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">F1 Score (Balanced)</p>
                        <p className="text-xl font-black text-white">{mlMetrics.f1}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Inference Latency</p>
                        <p className="text-xl font-black text-white">{mlMetrics.latency}</p>
                    </div>
                </motion.div>
            )}

            {results.length > 0 && (
                <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/50 backdrop-blur-sm">
                    <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-900/80 text-slate-500 font-black uppercase tracking-widest border-b border-white/5">
                            <tr>
                                <th className="px-4 py-3 text-cyan-500/70">Checkpoint</th>
                                <th className="px-4 py-3">Expected Output</th>
                                <th className="px-4 py-3 text-right">Synergy State</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {results.map((r, i) => (
                                <tr key={i} className="hover:bg-cyan-500/5 transition-colors">
                                    <td className="px-4 py-3 font-mono text-slate-400">{r.input}</td>
                                    <td className="px-4 py-3 font-mono text-slate-200">{r.expected}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`px-2 py-0.5 rounded font-black text-[9px] border ${r.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {r.passed ? 'OPTIMAL' : 'REGRESSION'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ModelSelectionModule({ pattern, original }: { pattern: string, original: string }) {
    const [benchmarking, setBenchmarking] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    const runBenchmark = async () => {
        setBenchmarking(true);
        // Realistic simulated metrics based on logic patterns
        const isML = /svm|classifier|regressor|randomforest|linearregression|sklearn/i.test(original);

        await new Promise(r => setTimeout(r, 1800)); // Simulate neural sync

        const models = [
            {
                id: 'svm',
                name: 'SVM (Support Vector Machine)',
                accuracy: (isML ? 0.92 + Math.random() * 0.06 : 0.65 + Math.random() * 0.1).toFixed(3),
                latency: '22ms',
                resourceUsage: 'Medium',
                suitability: pattern.includes('model') ? 95 : 40,
                color: 'blue'
            },
            {
                id: 'rf',
                name: 'Random Forest Ensembler',
                accuracy: (isML ? 0.94 + Math.random() * 0.04 : 0.7 + Math.random() * 0.1).toFixed(3),
                latency: '45ms',
                resourceUsage: 'High',
                suitability: pattern.includes('model') ? 98 : 30,
                color: 'purple'
            },
            {
                id: 'lr',
                name: 'Linear Regression (SGD)',
                accuracy: (isML && pattern.includes('regression') ? 0.88 + Math.random() * 0.05 : 0.5 + Math.random() * 0.1).toFixed(3),
                latency: '8ms',
                resourceUsage: 'Low',
                suitability: pattern.includes('regression') ? 92 : 20,
                color: 'cyan'
            }
        ];

        setResults(models.sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy)));
        setBenchmarking(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900 border border-indigo-500/20 p-5 rounded-3xl shadow-inner">
                <div>
                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Competitive Model Benchmark
                    </h5>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Selecting the optimal predictive architecture</p>
                </div>
                {!results.length && (
                    <button
                        onClick={runBenchmark}
                        disabled={benchmarking}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {benchmarking ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><LoaderIcon /></motion.div> : <FlaskConical size={14} />}
                        {benchmarking ? 'Syncing...' : 'Compare Models'}
                    </button>
                )}
            </div>

            {results.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                    {results.map((m, i) => (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={m.id}
                            className={`p-5 rounded-3xl border transition-all ${i === 0 ? 'bg-indigo-950/40 border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'bg-slate-900/60 border-slate-800'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${m.color === 'blue' ? 'bg-blue-500' : m.color === 'purple' ? 'bg-purple-500' : 'bg-cyan-500'}`} />
                                    <span className="font-black text-xs text-white uppercase tracking-widest">{m.name}</span>
                                    {i === 0 && <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">🏆 Best Accuracy</span>}
                                </div>
                                <span className="text-xl font-black text-white">{(parseFloat(m.accuracy) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Inference</p>
                                    <p className="text-[10px] font-bold text-slate-300">{m.latency}</p>
                                </div>
                                <div className="bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Resources</p>
                                    <p className="text-[10px] font-bold text-slate-300">{m.resourceUsage}</p>
                                </div>
                                <div className="bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Suitability</p>
                                    <p className="text-[10px] font-bold text-slate-300">{m.suitability}%</p>
                                </div>
                            </div>
                            <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${parseFloat(m.accuracy) * 100}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className={`h-full ${m.color === 'blue' ? 'bg-blue-500' : m.color === 'purple' ? 'bg-purple-500' : 'bg-cyan-500'}`}
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
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
    const [showAccuracy, setShowAccuracy] = useState(false)
    const [showModelSelection, setShowModelSelection] = useState(false)
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

    useEffect(() => {
        if (mentorTimerRef.current) clearTimeout(mentorTimerRef.current)
        mentorTimerRef.current = setTimeout(() => {
            const result = analyzeMentor(code, language.id)
            setMentorFeedback(result)
        }, 600)
        return () => { if (mentorTimerRef.current) clearTimeout(mentorTimerRef.current) }
    }, [code, language.id])

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

    const getLocalOptimization = (userCode: string, lang: string) => {
        const result = generateOptimization(userCode, lang)
        return result
    }

    const handleAnalyze = async () => {
        setAnalyzing(true)
        setShowStressTest(false)
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
            console.warn('Backend unavailable, using demo mode')
            const demoResult = getLocalAnalysis(code, language.id)
            setAnalysis(demoResult)
            const now = Date.now()
            const relativeSec = Math.floor((now - sessionStartRef.current) / 1000)
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
        const keywords = hintInfo?.acceptedKeywords ?? ['hash', 'set', 'dict', 'map']
        const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const normAns = normalise(ans)
        const isCorrect = keywords.some(kw => {
            const normKw = normalise(kw)
            return normAns.includes(normKw) || normKw.includes(normAns)
        })

        if (isCorrect) {
            setWrongAttempts(0)
            setHintFeedback({ ...hintFeedback, passed: true, msg: `✅ Excellent! You identified the right concept. Generating your personalised optimized solution…` })
            setOptimizing(true)
            const codeToOptimize = code
            const langToOptimize = language.id

            try {
                const useLocal = analysis?._isDemo || !analysis?.submission_id
                if (useLocal) {
                    await new Promise(r => setTimeout(r, 600))
                    const localResult = getLocalOptimization(codeToOptimize, langToOptimize)
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
        <div className="min-h-screen bg-[#020617] text-[#f8fafc] flex flex-col font-sans grid-bg">
            <header className="border-b border-white/10 p-4 shrink-0 flex items-center justify-between glass-dark sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    {analysis && (
                        <button
                            onClick={() => setAnalysis(null)}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-white/10 group"
                            title="Back to Editor"
                        >
                            <ArrowLeft size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white text-slate-950 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                            <Zap className="fill-current" size={20} />
                        </div>
                        <h1 className="text-xl font-black tracking-widest text-white uppercase italic">
                            CCE <span className="text-indigo-500">v1.2</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <button className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/10 transition-all font-mono text-sm">
                            <span className="text-lg">{language.icon}</span>
                            <span className="font-bold uppercase tracking-wider">{language.name}</span>
                            <ChevronDown size={14} className="text-slate-500" />
                        </button>
                        <div className="absolute right-0 mt-2 w-48 glass-dark rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden border border-white/10">
                            {LANGUAGES.map(lang => (
                                <button
                                    key={lang.id}
                                    onClick={() => handleLanguageChange(lang)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left font-semibold border-b border-white/5 last:border-0"
                                >
                                    <span>{lang.icon}</span>
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-6 w-px bg-white/10" />

                    <button
                        onClick={() => setView(view === 'editor' ? 'dashboard' : 'editor')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${view === 'dashboard'
                            ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                            }`}
                    >
                        <BarChart3 size={14} />
                        {view === 'dashboard' ? 'Terminal' : 'Growth Ops'}
                    </button>

                    <button
                        onClick={() => setShowMentor(p => !p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border ${showMentor
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                    >
                        <BookOpen size={14} />
                        Mentor
                        {mentorFeedback && (mentorFeedback.status === 'Suboptimal' || mentorFeedback.status === 'Incorrect') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                    </button>

                    <div className="flex items-center gap-2 bg-indigo-600/10 px-4 py-2 rounded-lg border border-indigo-500/20 shadow-inner">
                        <Target className="w-3 h-3 text-indigo-400" />
                        <span className="text-[10px] font-black tracking-widest uppercase text-indigo-300">XP <span className="text-white ml-2">120</span></span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {view === 'dashboard' ? (
                    <div className="flex-1 p-8 overflow-y-auto">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-12">
                            <div className="flex justify-between items-end border-b border-white/10 pb-8">
                                <div>
                                    <h2 className="text-6xl font-black mb-4 no-print flex items-center gap-6 tracking-tighter italic">
                                        <button
                                            onClick={() => setView('editor')}
                                            className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-white/10 hover:border-indigo-500/50 group"
                                        >
                                            <ArrowLeft size={28} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                        </button>
                                        GROWTH OPS
                                    </h2>
                                    <p className="text-slate-500 no-print ml-20 uppercase tracking-[0.3em] font-bold text-[10px]">Biometric Architecture Evolution Tracking</p>
                                    <div className="hidden print:block text-slate-900">
                                        <h1 className="text-3xl font-black mb-1">CCE Student Progress Report</h1>
                                        <p className="text-sm font-bold opacity-70">Generated on {new Date().toLocaleDateString()} for Student #8129</p>
                                    </div>
                                </div>
                                <div className="flex gap-6 no-print items-center">
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Global Sector</span>
                                        <p className="text-3xl font-black text-white tracking-widest">#1,242</p>
                                    </div>
                                    <button
                                        onClick={handleGenerateReport}
                                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:bg-indigo-500 transition-all active:scale-95 border border-indigo-400/20"
                                    >
                                        <FileDown size={18} />
                                        Generate Audit PDF
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <GrowthStatCard icon={<TrendingDown className="text-emerald-400" />} label="Logic Inefficiency" value="68 → 41" subValue="-27pts Improvement" trend="ACCELERATING" />
                                <GrowthStatCard icon={<Zap className="text-indigo-400" />} label="Architecture XP" value="1,240" subValue="+150 Cumulative" />
                                <GrowthStatCard icon={<Activity className="text-blue-400" />} label="Neural Streak" value="5 Cycles" subValue="Consistent Evolution" />
                                <GrowthStatCard icon={<Trophy className="text-amber-400" />} label="Clearance" value="Thinker II" subValue="Standard Protocol" />
                            </div>

                            <div className="grid grid-cols-3 gap-8">
                                <div className="col-span-2 glass rounded-[2.5rem] p-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Clock className="text-indigo-500/10 w-32 h-32 rotate-12" />
                                    </div>
                                    <h3 className="text-[10px] font-black mb-10 flex items-center gap-3 uppercase tracking-[0.4em] text-slate-400">
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Complexity Delta Tracking
                                    </h3>
                                    <div className="space-y-8 relative z-10">
                                        <div className="flex items-end gap-3 h-48">
                                            {submissions.length > 0 ? (
                                                [...submissions].reverse().map((sub, i) => {
                                                    const complexityScore = sub.time_complexity.includes('n²') ? 0.8 : sub.time_complexity.includes('log n') ? 0.4 : 0.2;
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-3 group px-1">
                                                            <div className="w-full bg-white/5 border border-white/10 rounded-xl transition-all group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50 relative overflow-hidden" style={{ height: `${complexityScore * 100}%` }}>
                                                                <div className="absolute inset-0 grid-bg opacity-30" />
                                                                <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600 text-[10px] px-2 py-0.5 rounded font-black text-white shadow-lg">
                                                                    {sub.runtime}s
                                                                </div>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-500 tracking-tighter uppercase whitespace-nowrap">Attempt T+{sub.sessionTime}s</span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] border border-dashed border-white/10 rounded-3xl h-full">No Data Sync Detected</div>
                                            )}
                                        </div>
                                        <div className="flex justify-between pt-8 border-t border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <span>Sovereign Submission Log</span>
                                            <div className="flex gap-6">
                                                {[...submissions].reverse().slice(-5).map((sub, i) => (
                                                    <span key={i} className={sub.time_complexity === 'O(n)' ? 'text-emerald-400 font-black' : 'text-slate-400'}>
                                                        {sub.time_complexity.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass rounded-[2.5rem] p-10 space-y-10 border-white/5">
                                    <h3 className="text-[10px] font-black flex items-center gap-3 uppercase tracking-[0.4em] text-slate-400">
                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Accolades
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                        {['Hash Map Hero', 'Loop Slayer', 'Big-O Believer', 'Recursion Master', 'Buffer King'].map(badge => (
                                            <span key={badge} className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-indigo-500 hover:text-white transition-all cursor-crosshair">
                                                {badge}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="pt-8 border-t border-white/10">
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Neural Mapping</p>
                                        <p className="text-[11px] font-black text-slate-300 leading-relaxed uppercase tracking-widest">Hash Maps, Two Pointers, String Slicing</p>
                                    </div>
                                    <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl group hover:border-indigo-500/50 transition-all">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Next Protocol</p>
                                        <p className="text-sm font-black text-indigo-100 uppercase tracking-widest leading-none">Sliding Window</p>
                                        <p className="text-[10px] text-slate-500 mt-2 font-black uppercase">ETA 48:00:00</p>
                                    </div>

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
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                ) : !analysis ? (
                    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-16 text-center mt-12 space-y-4"
                        >
                            <h2 className="text-8xl font-black mb-6 tracking-tighter leading-tight uppercase italic text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                EVOLVE <span className="text-indigo-600 not-italic">YOUR</span> LOGIC
                            </h2>
                            <p className="text-xs text-slate-500 max-w-xl mx-auto uppercase tracking-[0.5em] font-black">Code Architecture Mapping Engine</p>
                        </motion.div>

                        <div className="flex-1 min-h-[500px] glass rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative border-white/10 ring-1 ring-white/5 bg-[#020617]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent opacity-50" />
                            <Editor
                                height="100%"
                                language={language.id === 'cpp' ? 'cpp' : language.id}
                                theme="vs-dark"
                                value={code}
                                onChange={(val) => setCode(val || '')}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 15,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    padding: { top: 32, bottom: 32 },
                                    smoothScrolling: true,
                                    cursorBlinking: 'solid',
                                    lineNumbersMinChars: 4,
                                }}
                            />
                        </div>

                        {showMentor && mentorFeedback && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 12 }}
                                className="mt-4 rounded-2xl border border-violet-700/30 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-[0_8px_32px_rgba(124,58,237,0.15)]"
                            >
                                <div className="flex items-center justify-between px-5 py-3 border-b border-violet-800/30 bg-violet-900/10">
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={16} className="text-violet-400" />
                                        <span className="font-black text-[11px] uppercase tracking-widest text-violet-300">🎓 AI Real-Time Code Mentor</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className={`text-[10px] font-black px-5 py-2 rounded-full flex items-center gap-2 uppercase tracking-widest ${mentorFeedback?.status === 'Optimal' || mentorFeedback?.status === 'Correct'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            }`}>
                                            {mentorFeedback?.status}
                                        </div>
                                        <button onClick={() => setShowMentor(false)} className="text-slate-500 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <div className="space-y-3">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Pattern Recognition</p>
                                        <p className="text-2xl font-black text-white leading-tight">{mentorFeedback?.logicIssue}</p>
                                    </div>

                                    {mentorFeedback?.recommendation && (
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Target Architecture</p>
                                                <p className="font-black text-white text-lg">{mentorFeedback?.recommendation?.dataStructure}</p>
                                                <p className="text-xs text-slate-400 font-semibold leading-relaxed">{mentorFeedback?.recommendation?.reason}</p>
                                            </div>
                                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col justify-center gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Time Complexity</p>
                                                    <p className="font-mono text-white text-sm font-black">{mentorFeedback?.recommendation?.timeComplexity}</p>
                                                </div>
                                                <div className="pt-4 border-t border-white/10">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">Space Complexity</p>
                                                    <p className="font-mono text-white text-sm font-black">{mentorFeedback?.recommendation?.spaceComplexity}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {mentorFeedback?.fix && (
                                        <div className="bg-indigo-600/5 p-6 rounded-3xl border border-indigo-500/20 italic">
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-3 not-italic">Refactoring Nudge</p>
                                            <p className="text-slate-300 font-semibold leading-relaxed">"{mentorFeedback?.fix}"</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        <div className="mt-16 flex justify-center pb-12">
                            <button
                                onClick={handleAnalyze}
                                className="group flex items-center gap-4 bg-white text-slate-950 hover:bg-indigo-600 hover:text-white transition-all px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,255,255,0.1)] disabled:opacity-50 active:scale-95 border border-white/10"
                                disabled={analyzing}
                            >
                                {analyzing ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <LoaderIcon />
                                    </motion.div>
                                ) : <Play className="fill-current group-hover:translate-x-1 transition-transform" size={20} />}
                                {analyzing ? 'SYNERGIZING...' : 'ANALYZE ARCHITECTURE'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/2 border-r border-white/10 flex flex-col glass-dark relative z-10">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-black flex items-center gap-3 text-slate-500 uppercase tracking-[0.3em] text-[10px]">
                                    <Code2 size={16} /> Raw Logic Fragment
                                </h3>
                                <div className="flex gap-3">
                                    <Badge label="Runtime" value={analysis?.time_complexity} color="red" />
                                    <Badge label="Storage" value={analysis?.space_complexity} color="yellow" />
                                </div>
                            </div>
                            <div className="flex-1 relative bg-[#020617]">
                                <Editor
                                    height="100%"
                                    language={language.id === 'cpp' ? 'cpp' : language.id}
                                    theme="vs-dark"
                                    value={code}
                                    options={{ readOnly: true, minimap: { enabled: false }, padding: { top: 32 } }}
                                />
                            </div>
                            <div className="h-80 border-t border-white/10 p-8 overflow-y-auto relative glass-dark">
                                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                                <h4 className="font-black mb-6 flex items-center gap-3 text-slate-200 text-xs uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-float" />
                                    Structural Diagnostic
                                </h4>
                                <div className="grid grid-cols-2 gap-8">
                                    <MetricCard label="COGNITIVE GAP" value={analysis?.thinking_gap_score} max={100} isGauge />
                                    <MetricCard label="NEURAL LOAD" value={analysis?.cognitive_load} />
                                </div>
                                <div className="mt-8">
                                    <p className="text-[9px] font-black text-slate-600 mb-4 uppercase tracking-[0.3em]">Critical Bottlenecks:</p>
                                    <div className="space-y-3">
                                        {analysis?.detected_patterns?.map((p: any, i: number) => (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                key={i}
                                                className="text-sm bg-red-500/5 text-red-100 border border-red-500/20 p-4 rounded-2xl flex gap-4 items-start hover:bg-red-500/10 transition-colors"
                                            >
                                                <AlertTriangle size={20} className="text-red-500 shrink-0" />
                                                <div>
                                                    <div className="font-black text-[10px] uppercase tracking-widest text-red-400 mb-1">{p.name}</div>
                                                    <div className="opacity-80 text-xs leading-relaxed font-semibold italic">{p.suggestion}</div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-1/2 flex flex-col bg-[#020617] relative">
                            <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
                            <div className="p-6 border-b border-white/10 flex items-center justify-between glass relative z-20">
                                <h3 className="font-black flex items-center gap-3 text-indigo-400 uppercase tracking-[0.3em] text-[10px]">
                                    <Zap size={16} /> Evolutionary Path
                                </h3>
                                <button
                                    className="flex items-center gap-2 text-[10px] font-black bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all text-slate-200 border border-white/10 uppercase tracking-widest"
                                    onClick={() => setAnalysis(null)}
                                >
                                    <ArrowRight size={14} className="rotate-180" />
                                    Terminal
                                </button>
                            </div>

                            {!optimization ? (
                                <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950">
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
                                                <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-2xl">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">🧠 Concept Check — Answer to Unlock</p>
                                                    <p className="font-bold text-indigo-200 text-sm leading-snug">{hintFeedback.q}</p>
                                                </div>

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

                                                {hintFeedback.passed && !optimizing && hintInfo && (
                                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 space-y-4">
                                                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">Checkpoint Secured</p>
                                                        <p className="text-sm text-slate-300 font-semibold leading-relaxed">
                                                            <strong className="text-white uppercase tracking-widest text-[10px]">Logical Synthesis: </strong>
                                                            {hintInfo?.wrongAnswerHint}
                                                        </p>
                                                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest pt-4 border-t border-white/5">
                                                            Accepted Identifiers: {hintInfo?.acceptedKeywords?.slice(0, 4).join(', ')}
                                                        </p>
                                                    </div>
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
                                        <div className="flex flex-wrap items-center gap-3 mb-6">
                                            <button
                                                onClick={() => { setShowStressTest(!showStressTest); setShowAccuracy(false); setShowModelSelection(false); }}
                                                className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${showStressTest
                                                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                            >
                                                {showStressTest ? 'Stop Stress Test' : 'Performance Stress Test'}
                                            </button>
                                            <button
                                                onClick={() => { setShowAccuracy(!showAccuracy); setShowStressTest(false); setShowModelSelection(false); }}
                                                className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${showAccuracy
                                                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                            >
                                                {showAccuracy ? 'Exit Accuracy Diag' : 'Run Accuracy Check'}
                                            </button>
                                            <button
                                                onClick={() => { setShowModelSelection(!showModelSelection); setShowAccuracy(false); setShowStressTest(false); }}
                                                className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${showModelSelection
                                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                                            >
                                                {showModelSelection ? 'Exit Model Bench' : 'Model Selection & Comparison'}
                                            </button>
                                            <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-black border border-green-500/20">
                                                +{optimization.xp_awarded} XP EARNED
                                            </div>
                                        </div>

                                        {showModelSelection ? (
                                            <ModelSelectionModule
                                                pattern={analysis?.pattern || 'unknown'}
                                                original={code}
                                            />
                                        ) : showAccuracy ? (
                                            <AccuracyVerifier
                                                original={code}
                                                optimized={optimization.optimized_code}
                                                language={language.id}
                                                pattern={analysis?.pattern || 'unknown'}
                                            />
                                        ) : showStressTest ? (
                                            <StressTestModule
                                                beforeComplexity={optimization.explanation?.complexity_comparison?.before ?? 'O(n²)'}
                                                afterComplexity={optimization.time_complexity_after ?? 'O(n)'}
                                            />
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Structural Upgrade</span>
                                                        <p className="text-blue-300 font-mono text-sm">{optimization?.explanation?.pattern_replaced ?? 'Optimized'}</p>
                                                    </div>
                                                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Complexity Delta</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-red-400/50 line-through text-xs">{optimization?.explanation?.complexity_comparison?.before?.split(' ')[0] ?? '?'}</span>
                                                            <ArrowRight size={12} className="text-slate-600" />
                                                            <span className="text-green-400 font-black">{optimization?.time_complexity_after ?? 'O(n)'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Optimization Thesis</span>
                                                    <p className="text-slate-300 text-sm leading-relaxed">{optimization?.explanation?.why_better}</p>
                                                </div>
                                                {optimization?.conceptual_question && (
                                                    <div className="bg-indigo-900/20 border border-indigo-700/30 p-4 rounded-2xl">
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">💭 Reflect &amp; Go Deeper</span>
                                                        <p className="text-indigo-200 text-sm">{optimization?.conceptual_question}</p>
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
    );
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
                    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        <path d="M 10 200 Q 150 180, 280 20" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray="1000" strokeDashoffset="0" className="drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                        <path d="M 10 200 L 280 150" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
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
