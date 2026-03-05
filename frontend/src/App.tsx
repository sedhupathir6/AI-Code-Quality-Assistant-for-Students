import { useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { motion } from 'framer-motion'
import { Play, Code2, ArrowRight, Zap, Target, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react'

import { api } from './api/client'
import { detectComplexity, generateOptimization } from './optimizer'

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
    const [optimization, setOptimization] = useState<any>(null)
    const [optimizing, setOptimizing] = useState(false)

    const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
        setLanguage(lang)
        if (code === DEFAULT_CODES[language.id]) {
            setCode(DEFAULT_CODES[lang.id])
        }
    }

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
        try {
            const res = await api.post('/api/analyze', { code, language: language.id })
            setAnalysis(res.data)
            setOptimization(null)
            setHintLevel(0)
            setHintFeedback(null)
        } catch (_err) {
            // Backend not available — run local demo analysis
            console.warn('Backend unavailable, using demo mode')
            const demoResult = getLocalAnalysis(code, language.id)
            setAnalysis(demoResult)
            setOptimization(null)
            setHintLevel(0)
            setHintFeedback(null)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleHint = async () => {
        if (hintLevel === 0) {
            setHintLevel(1)
            setHintFeedback({ q: 'What data structure gives you O(1) lookup time instead of O(n)?' })
        }
    }

    const submitHint = async () => {
        const ans = hintAnswer.toLowerCase()
        if (ans.includes('hash') || ans.includes('dict') || ans.includes('set') || ans.includes('map')) {
            setHintFeedback({ ...hintFeedback, passed: true, msg: 'Great job! Hash maps give O(1) lookup. Level 2 Optimization Unlocked.' })

            setOptimizing(true)
            try {
                if (analysis?._isDemo) {
                    // Demo/offline mode — use local optimization on the actual user code
                    await new Promise(r => setTimeout(r, 800))
                    setOptimization(getLocalOptimization(analysis._code ?? code, language.id))
                } else {
                    const res = await api.post('/api/optimize', {
                        submission_id: analysis.submission_id,
                        level: 2
                    })
                    setOptimization(res.data)
                }
            } catch (_err) {
                // If backend fails during optimization, use local fallback on user's actual code
                setOptimization(getLocalOptimization(analysis?._code ?? code, language.id))
            } finally {
                setOptimizing(false)
            }
        } else {
            setHintFeedback({ ...hintFeedback, passed: false, msg: 'Not quite. Think about key-value stores like HashSets or Dictionaries.' })
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            <header className="border-b border-slate-800 p-4 shrink-0 flex items-center justify-between bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                        <Zap className="text-white fill-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        CCE
                    </h1>
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

                    <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800 shadow-inner">
                        <Target className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-black text-slate-300">XP: <span className="text-white">120</span></span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {!analysis ? (
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
                                <button className="text-xs font-bold bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded-full transition-all text-slate-300" onClick={() => setAnalysis(null)}>
                                    Discard & Redesign
                                </button>
                            </div>

                            {!optimization ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950">
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-md w-full shadow-2xl space-y-6"
                                    >
                                        <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                            <Target className="text-yellow-500" size={32} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black mb-2">Complexity Warning</h4>
                                            <p className="text-slate-400">The current solution likely uses suboptimal nested iterations.</p>
                                        </div>

                                        {!hintFeedback ? (
                                            <button
                                                onClick={handleHint}
                                                className="bg-indigo-600 hover:bg-indigo-500 w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                Unlock Concept Hint <ArrowRight size={20} />
                                            </button>
                                        ) : (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-left space-y-4">
                                                <div className="bg-indigo-600/10 border border-indigo-600/30 p-4 rounded-2xl">
                                                    <p className="font-bold text-indigo-300 text-lg leading-snug">
                                                        {hintFeedback.q}
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none ring-4 ring-transparent focus:ring-indigo-500/10 transition-all font-mono"
                                                        placeholder="Enter technical concept..."
                                                        value={hintAnswer}
                                                        onChange={e => setHintAnswer(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && submitHint()}
                                                    />
                                                    <button
                                                        onClick={submitHint}
                                                        disabled={optimizing}
                                                        className="bg-blue-600 hover:bg-blue-500 w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                                                    >
                                                        {optimizing ? 'Generating Solution...' : 'Verify Answer'}
                                                    </button>
                                                </div>

                                                {hintFeedback.msg && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 ${hintFeedback.passed ? 'bg-green-950/30 text-green-400 border border-green-900/50' : 'bg-red-950/30 text-red-400 border border-red-900/50'}`}
                                                    >
                                                        {hintFeedback.passed ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                                        {hintFeedback.msg}
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
                                        <div className="flex items-center justify-between mb-6">
                                            <h4 className="font-black text-green-400 flex items-center gap-2 text-lg">
                                                <CheckCircle size={24} /> Evolution Completed
                                            </h4>
                                            <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-black border border-green-500/20">
                                                +{optimization.xp_awarded} XP EARNED
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Structural Upgrade</span>
                                                    <p className="text-blue-300 font-mono text-sm">{optimization.explanation.pattern_replaced}</p>
                                                </div>
                                                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Complexity Delta</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-400/50 line-through text-xs">{optimization.explanation.complexity_comparison.before.split(' ')[0]}</span>
                                                        <ArrowRight size={12} className="text-slate-600" />
                                                        <span className="text-green-400 font-black">{optimization.time_complexity_after}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Optimization Thesis</span>
                                                <p className="text-slate-300 text-sm leading-relaxed">{optimization.explanation.why_better}</p>
                                            </div>
                                        </div>
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

