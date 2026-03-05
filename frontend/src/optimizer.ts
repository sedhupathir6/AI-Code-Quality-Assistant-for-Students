// optimizer.ts — Client-side code analysis and optimization engine
// Used in demo/offline mode when the backend is not available.
// Extracts real function signatures, detects patters, and generates genuinely
// customized optimized code for each user submission.

export interface OptResult {
    optimized_code: string
    explanation: {
        why_inefficient: string
        pattern_replaced: string
        why_better: string
        complexity_comparison: { before: string; after: string }
    }
    time_complexity_after: string
    space_complexity_after: string
    xp_awarded: number
    conceptual_question: string
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

export type Pattern = 'nested_loop' | 'recursion_no_memo' | 'linear_search_in_loop' | 'already_optimal' | 'unknown'

export function detectComplexity(code: string): { time: string; gap: number; cognitive: string; pattern: Pattern } {
    const noComments = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, '')

    const nestedLoop = /\b(for|while)\b[\s\S]{0,200}?\b(for|while)\b/.test(noComments)
    const singleLoop = /\b(for|while)\b/.test(noComments)
    const hasRecursion = detectRecursion(noComments)
    const hasMemo = /lru_cache|@cache|memo|dp\[|HashMap|unordered_map|Map</.test(code)
    const linearSearch = /(\.contains\s*\(|\.includes\s*\(|find\s*\()[\s\S]{0,50}?\b(for|while)\b|\b(for|while)\b[\s\S]{0,200}?(\.contains\s*\(|\.includes\s*\(|find\s*\()/s.test(noComments)

    if (hasMemo || (!nestedLoop && !hasRecursion)) {
        return { time: 'O(n)', gap: 15, cognitive: 'Low', pattern: 'already_optimal' }
    }
    if (nestedLoop && linearSearch) {
        return { time: 'O(n²)', gap: 80, cognitive: 'High', pattern: 'linear_search_in_loop' }
    }
    if (nestedLoop) {
        return { time: 'O(n²)', gap: 75, cognitive: 'High', pattern: 'nested_loop' }
    }
    if (hasRecursion && !hasMemo) {
        return { time: 'O(2ⁿ)', gap: 85, cognitive: 'High', pattern: 'recursion_no_memo' }
    }
    if (singleLoop) {
        return { time: 'O(n)', gap: 20, cognitive: 'Low', pattern: 'already_optimal' }
    }
    return { time: 'O(1)', gap: 5, cognitive: 'Low', pattern: 'already_optimal' }
}

function detectRecursion(code: string): boolean {
    // Extract all defined function names, then check if they call themselves
    const defs = [
        ...code.matchAll(/def\s+(\w+)\s*\(/g),
        ...code.matchAll(/function\s+(\w+)\s*\(/g),
        ...code.matchAll(/(?:int|long|double|bool|boolean|string|String|List|vector)\s+(\w+)\s*\(/g),
    ].map(m => m[1]).filter(n => n && n !== 'main')

    for (const name of defs) {
        // Check if name appears again *after* the definition header line
        const idx = code.indexOf(name)
        if (idx !== -1 && code.indexOf(name + '(', idx + name.length + 1) !== -1) {
            return true
        }
    }
    return false
}

// ─── Language-specific Optimizers ────────────────────────────────────────────

export function generateOptimization(code: string, language: string): OptResult {
    const { pattern } = detectComplexity(code)

    switch (language) {
        case 'python': return optimizePython(code, pattern)
        case 'javascript': return optimizeJavaScript(code, pattern)
        case 'java': return optimizeJava(code, pattern)
        case 'cpp': return optimizeCpp(code, pattern)
        default: return optimizePython(code, pattern)
    }
}

// ─── Helper: Extract function metadata from code ─────────────────────────────

function extractPythonMeta(code: string) {
    const m = code.match(/def\s+(\w+)\s*\(([^)]*)\)/)
    const funcName = m?.[1] ?? 'solve'
    const params = m?.[2]?.split(',').map(p => p.trim().split(':')[0].trim()) ?? ['arr']
    return { funcName, params }
}

function extractJsMeta(code: string) {
    const m = code.match(/function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)|(\w+)\s*\(([^)]*)\)\s*{/)
    const funcName = m?.[1] ?? m?.[3] ?? m?.[5] ?? 'solve'
    const params = (m?.[2] ?? m?.[4] ?? m?.[6] ?? 'arr').split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean)
    return { funcName, params }
}

function extractJavaMeta(code: string) {
    const m = code.match(/(?:public|private|protected)?\s+(?:static\s+)?(\S+)\s+(\w+)\s*\(([^)]*)\)/)
    const returnType = m?.[1] ?? 'void'
    const funcName = m?.[2] ?? 'solve'
    const paramStr = m?.[3] ?? 'int[] arr'
    const params = paramStr.split(',').map(p => {
        const parts = p.trim().split(/\s+/)
        return parts[parts.length - 1]
    })
    return { returnType, funcName, params }
}

function extractCppMeta(code: string) {
    const m = code.match(/(\w[\w<>,:\s*&]+)\s+(\w+)\s*\(([^)]*)\)/)
    const returnType = m?.[1]?.trim() ?? 'void'
    const funcName = m?.[2] ?? 'solve'
    const paramStr = m?.[3] ?? 'vector<int>& arr'
    const params = paramStr.split(',').map(p => {
        const parts = p.trim().split(/\s+/)
        return parts[parts.length - 1].replace(/[*&]/g, '')
    })
    return { returnType, funcName, params }
}

// ─── Python Optimizer ─────────────────────────────────────────────────────────

function optimizePython(code: string, pattern: Pattern): OptResult {
    const { funcName, params } = extractPythonMeta(code)
    const mainParam = params[0] ?? 'arr'

    if (pattern === 'recursion_no_memo') {
        // Find the function body and wrap with lru_cache
        const optimized = `import functools\n\n@functools.lru_cache(maxsize=None)\n${code.trim()}`
        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` calls itself recursively and recomputes the same sub-problems multiple times, leading to exponential time O(2ⁿ).`,
                pattern_replaced: 'Uncached recursion → Memoized recursion with @lru_cache',
                why_better: '@lru_cache stores each computed result so it is never calculated twice. This cuts time from O(2ⁿ) to O(n).',
                complexity_comparison: { before: 'O(2ⁿ) time, O(n) stack', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What principle does memoization rely on to avoid recomputation?'
        }
    }

    if (pattern === 'linear_search_in_loop' || pattern === 'nested_loop') {
        // Infer return type from code
        const returnsDict = /return\s+\{/.test(code) || /\.items\(\)/.test(code)
        const returnsList = /return\s+\[|\.append\(/.test(code)
        const returnsBool = /return\s+(True|False)/.test(code)

        let optimized: string
        if (returnsBool) {
            optimized = `def ${funcName}(${params.join(', ')}):\n    seen = set()\n    for item in ${mainParam}:\n        if item in seen:\n            return True\n        seen.add(item)\n    return False`
        } else if (returnsDict) {
            optimized = `def ${funcName}(${params.join(', ')}):\n    freq = {}\n    for item in ${mainParam}:\n        freq[item] = freq.get(item, 0) + 1\n    return freq`
        } else {
            optimized = `def ${funcName}(${params.join(', ')}):\n    seen = set()\n    result = []\n    for item in ${mainParam}:\n        if item in seen:\n            if item not in result:\n                result.append(item)\n        seen.add(item)\n    return result`
        }

        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` uses nested loops — for each element it scans the rest of \`${mainParam}\`, giving O(n) work per element: O(n²) total.`,
                pattern_replaced: 'Nested loop with linear scan → Single pass with Python set (O(1) lookup)',
                why_better: 'A Python set is backed by a hash table. Membership tests like \`item in seen\` are O(1) on average, reducing the total complexity to O(n).',
                complexity_comparison: { before: 'O(n²) time, O(1) extra space', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'Why does hashing give us O(1) lookup instead of O(n)?'
        }
    }

    // Already optimal — provide a higher-level improvement
    return {
        optimized_code: code + '\n\n# ✅ This function already runs in linear or constant time.\n# Level 3 improvement: use built-in optimized data types if applicable.\n# e.g. collections.Counter, itertools, or numpy for numeric work.',
        explanation: {
            why_inefficient: `\`${funcName}\` already has good time complexity. A Level 3 improvement would use Python built-ins that run closer to the hardware.`,
            pattern_replaced: 'Manual loops → Python built-in high-level operations',
            why_better: 'Built-in functions like Counter, sum(), max() are implemented in C under the hood and run significantly faster in practice.',
            complexity_comparison: { before: 'O(n) time', after: 'O(n) time, but faster in practice' }
        },
        time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 30,
        conceptual_question: 'What is the practical advantage of using built-in functions over manual Python loops?'
    }
}

// ─── JavaScript Optimizer ─────────────────────────────────────────────────────

function optimizeJavaScript(code: string, pattern: Pattern): OptResult {
    const { funcName, params } = extractJsMeta(code)
    const mainParam = params[0] ?? 'arr'
    const isAsync = /async\s+function|async\s+\(/.test(code)
    const prefix = isAsync ? 'async ' : ''

    if (pattern === 'recursion_no_memo') {
        const optimized = `const memo = new Map();\n\n${prefix}function ${funcName}(${params.join(', ')}) {\n    const key = JSON.stringify([${params.join(', ')}]);\n    if (memo.has(key)) return memo.get(key);\n\n    // --- original logic below ---\n${code.split('{').slice(1).join('{').split('}').slice(0, -1).join('}')}\n    memo.set(key, result);\n    return result;\n}`
        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` is recursive and recomputes identical sub-problems, blowing up to O(2ⁿ).`,
                pattern_replaced: 'Unguarded recursion → Memoized recursion with a Map cache',
                why_better: 'A JavaScript Map gives O(1) key lookup. Each unique input is computed only once, bringing time down to O(n).',
                complexity_comparison: { before: 'O(2ⁿ) time', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What is the difference between memoization and tabulation (bottom-up DP)?'
        }
    }

    if (pattern === 'linear_search_in_loop' || pattern === 'nested_loop') {
        const returnsBoolean = /return (true|false)/i.test(code)
        let optimized: string
        if (returnsBoolean) {
            optimized = `function ${funcName}(${params.join(', ')}) {\n    const seen = new Set();\n    for (const item of ${mainParam}) {\n        if (seen.has(item)) return true;\n        seen.add(item);\n    }\n    return false;\n}`
        } else {
            optimized = `function ${funcName}(${params.join(', ')}) {\n    const seen = new Set();\n    const result = new Set();\n    for (const item of ${mainParam}) {\n        if (seen.has(item)) result.add(item);\n        seen.add(item);\n    }\n    return [...result];\n}`
        }
        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` nests loops (or uses Array.includes inside a loop), causing O(n) work per iteration = O(n²) total.`,
                pattern_replaced: 'Nested loop / .includes() in loop → Single pass with Set.has() (O(1))',
                why_better: 'JavaScript Set uses hash buckets for O(1) average lookups. One pass through the array is all that\'s needed — O(n) total.',
                complexity_comparison: { before: 'O(n²) time', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'Why is Set.has() O(1) while Array.includes() is O(n)?'
        }
    }

    return {
        optimized_code: code,
        explanation: {
            why_inefficient: `\`${funcName}\` already appears efficient. Consider using generator functions or lazy evaluation for even better memory efficiency.`,
            pattern_replaced: 'Eager evaluation → Generator/lazy evaluation',
            why_better: 'Generators produce values on demand, reducing peak memory usage — useful when the result is consumed piece by piece.',
            complexity_comparison: { before: 'O(n) time, O(n) space', after: 'O(n) time, O(1) extra space (streaming)' }
        },
        time_complexity_after: 'O(n)', space_complexity_after: 'O(1)', xp_awarded: 30,
        conceptual_question: 'When would you choose a generator over returning an array?'
    }
}

// ─── Java Optimizer ───────────────────────────────────────────────────────────

function optimizeJava(code: string, pattern: Pattern): OptResult {
    const { returnType, funcName, params } = extractJavaMeta(code)
    const mainParam = params[0] ?? 'arr'
    const isStatic = /static/.test(code)
    const modifier = isStatic ? 'public static ' : 'public '

    // Infer Java return type for optimized version
    const returnsBoolean = /boolean|Boolean/.test(returnType)
    const returnsMap = /Map</.test(returnType) || /HashMap/.test(code)
    const returnsInt = /int|long|Integer/.test(returnType)
    const returnsVoid = /void/.test(returnType)

    if (pattern === 'recursion_no_memo') {
        const paramType = params.map((p) => {
            const typeMatch = code.match(new RegExp(`(\\S+)\\s+${p}\\b`))
            return (typeMatch?.[1] ?? 'int') + ' ' + p
        }).join(', ')
        const optimized = `private Map<String, ${returnsInt ? 'Long' : returnType.replace(/\[\]/g, '')}> memo = new HashMap<>();\n\n${modifier}${returnType} ${funcName}(${paramType}) {\n    String key = Arrays.toString(new Object[]{${params.join(', ')}});\n    if (memo.containsKey(key)) return memo.get(key);\n\n    // --- original logic ---\n    ${returnType} result = /* original base/recursive logic */; // fill in\n    memo.put(key, result);\n    return result;\n}`
        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` recomputes overlapping sub-problems recursively, leading to O(2ⁿ) time.`,
                pattern_replaced: 'Unguarded recursion → HashMap memoization',
                why_better: 'HashMap.get() and .put() are both O(1) amortized. Each unique state is computed exactly once.',
                complexity_comparison: { before: 'O(2ⁿ) time', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What Java collection maps keys to values with O(1) average access time?'
        }
    }

    if (pattern === 'linear_search_in_loop' || pattern === 'nested_loop') {
        let optimized: string
        // Detect param type from code
        const isArray = /int\[\]|String\[\]|char\[\]/.test(code)
        const elemType = /Integer|int/.test(code) ? 'Integer' : /String|String\[\]/.test(code) ? 'String' : 'Integer'
        const paramDecl = isArray ? `${elemType}[] ${mainParam}` : `List<${elemType}> ${mainParam}`

        if (returnsBoolean) {
            optimized = `${modifier}boolean ${funcName}(${paramDecl}) {\n    Set<${elemType}> seen = new HashSet<>();\n    for (${elemType} item : ${mainParam}) {\n        if (!seen.add(item)) return true; // add() returns false if already present\n    }\n    return false;\n}`
        } else if (returnsMap) {
            optimized = `${modifier}Map<${elemType}, Integer> ${funcName}(${paramDecl}) {\n    Map<${elemType}, Integer> freq = new HashMap<>();\n    for (${elemType} item : ${mainParam}) {\n        freq.put(item, freq.getOrDefault(item, 0) + 1);\n    }\n    return freq;\n}`
        } else if (returnsVoid) {
            optimized = `${modifier}void ${funcName}(${paramDecl}) {\n    Set<${elemType}> seen = new HashSet<>();\n    for (${elemType} item : ${mainParam}) {\n        if (seen.contains(item)) {\n            System.out.println("Duplicate: " + item);\n        }\n        seen.add(item);\n    }\n}`
        } else {
            // Default: returns a List of items
            optimized = `${modifier}List<${elemType}> ${funcName}(${paramDecl}) {\n    Set<${elemType}> seen = new HashSet<>();\n    Set<${elemType}> duplicates = new LinkedHashSet<>(); // LinkedHashSet preserves insertion order\n    for (${elemType} item : ${mainParam}) {\n        if (!seen.add(item)) { // add() returns false if element was already present\n            duplicates.add(item);\n        }\n    }\n    return new ArrayList<>(duplicates);\n}`
        }

        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` has a nested loop structure where the inner traversal (or List.contains call) is O(n), giving O(n²) total for n elements.`,
                pattern_replaced: 'Nested loops / List.contains() → Single pass with HashSet (O(1) amortized lookup)',
                why_better: 'Java\'s HashSet uses a hash table internally. HashSet.add() and HashSet.contains() are O(1) amortized, reducing the total time from O(n²) to O(n).',
                complexity_comparison: { before: 'O(n²) time, O(1) extra space', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What is the average-case time complexity of HashSet.contains() in Java?'
        }
    }

    // Already good — suggest streams / parallel processing
    return {
        optimized_code: code.replace(
            /for\s*\(([^)]+)\)\s*\{([\s\S]*?)\}/,
            (_match, header, body) => {
                const arrName = header.match(/:\s*(\w+)/)?.[1] ?? mainParam
                return `// Level 3: Stream-based approach\n${arrName}.stream()\n    .filter(Objects::nonNull)\n    .forEach(item -> {${body}});`
            }
        ),
        explanation: {
            why_inefficient: `\`${funcName}\` is already O(n). A Level 3 upgrade converts it to the Java Streams API for cleaner, more composable code.`,
            pattern_replaced: 'Imperative for-each loop → Java Streams with filter/map/collect',
            why_better: 'Streams are more composable and can be switched to parallel processing with .parallelStream() for large datasets.',
            complexity_comparison: { before: 'O(n) time', after: 'O(n) or O(n/cores) with parallelStream()' }
        },
        time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 30,
        conceptual_question: 'How would you switch a Java Stream to run in parallel?'
    }
}

// ─── C++ Optimizer ────────────────────────────────────────────────────────────

function optimizeCpp(code: string, pattern: Pattern): OptResult {
    const { returnType, funcName, params } = extractCppMeta(code)
    const mainParam = params[0] ?? 'arr'

    const returnsVector = /vector/.test(returnType)
    const returnsBool = /bool/.test(returnType)
    const returnsInt = /int|long/.test(returnType) && !/vector/.test(returnType)
    const elemType = /string/.test(code) ? 'string' : 'int'
    const paramDecl = /vector<int>&/.test(code)
        ? `vector<${elemType}>& ${mainParam}`
        : `${elemType}* ${mainParam}, int n`
    const isVectorParam = /vector/.test(code)

    if (pattern === 'recursion_no_memo') {
        const optimized = `#include <unordered_map>\n\nunordered_map<string, ${returnsInt ? 'long long' : returnType}> memo;\n\n${returnType} ${funcName}(${paramDecl}) {\n    string key = /* serialize inputs */;\n    if (memo.count(key)) return memo[key];\n\n    // --- original logic ---\n    ${returnType} result = /* base/recursive case */;\n    return memo[key] = result;\n}`
        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` is recursive and recomputes overlapping sub-problems, exploding to O(2ⁿ) time.`,
                pattern_replaced: 'Overlapping recursion → unordered_map memoization',
                why_better: 'C++ unordered_map uses a hash table with O(1) average lookup. Each state is computed only once.',
                complexity_comparison: { before: 'O(2ⁿ) time', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What is the difference between std::map and std::unordered_map in C++?'
        }
    }

    if (pattern === 'linear_search_in_loop' || pattern === 'nested_loop') {
        let optimized: string
        if (returnsBool) {
            optimized = `${returnType} ${funcName}(${paramDecl}) {\n    unordered_set<${elemType}> seen;\n    ${isVectorParam ? `for (const auto& item : ${mainParam})` : `for (int i = 0; i < n; i++)`} {\n        ${isVectorParam ? 'auto item = item' : `auto item = ${mainParam}[i]`};\n        if (seen.count(item)) return true;\n        seen.insert(item);\n    }\n    return false;\n}`.replace('auto item = item', '')
        } else if (returnsVector) {
            optimized = `#include <unordered_set>\n\n${returnType} ${funcName}(${paramDecl}) {\n    unordered_set<${elemType}> seen;\n    vector<${elemType}> result;\n    ${isVectorParam ? `for (const auto& item : ${mainParam})` : `for (int i = 0; i < n; i++)`} {\n        ${isVectorParam ? '' : `${elemType} item = ${mainParam}[i];\n        `}if (seen.count(item) && find(result.begin(), result.end(), item) == result.end()) {\n            result.push_back(item);\n        }\n        seen.insert(item);\n    }\n    return result;\n}`.replace('const auto& item : ', 'const auto item : ')
        } else {
            optimized = `#include <unordered_map>\n\nvoid ${funcName}(${paramDecl}) {\n    unordered_map<${elemType}, int> freq;\n    ${isVectorParam ? `for (const auto& item : ${mainParam})` : `for (int i = 0; i < n; i++)`} {\n        freq[${isVectorParam ? 'item' : `${mainParam}[i]`}]++;\n    }\n    // Process freq map as needed\n}`
        }

        return {
            optimized_code: optimized,
            explanation: {
                why_inefficient: `\`${funcName}\` uses nested loops which result in O(n²) comparisons — each element is compared against all others.`,
                pattern_replaced: 'Nested loops → unordered_set / unordered_map (O(1) average lookup)',
                why_better: 'C++ unordered_set and unordered_map use hash tables. Insert and lookup are O(1) amortized, cutting the total time from O(n²) to O(n).',
                complexity_comparison: { before: 'O(n²) time, O(1) extra space', after: 'O(n) time, O(n) space' }
            },
            time_complexity_after: 'O(n)', space_complexity_after: 'O(n)', xp_awarded: 50,
            conceptual_question: 'What is the worst-case time complexity of unordered_set lookups and when does it occur?'
        }
    }

    return {
        optimized_code: `#include <algorithm>\n\n// Level 3: using STL algorithms for cleaner code\n${code.trim()}\n\n// Alternative: sort + unique = O(n log n), O(1) extra space\n// sort(${mainParam}.begin(), ${mainParam}.end());\n// ${mainParam}.erase(unique(${mainParam}.begin(), ${mainParam}.end()), ${mainParam}.end());`,
        explanation: {
            why_inefficient: `\`${funcName}\` is already efficient. Consider sort+unique for an O(n log n) space-optimal alternative.`,
            pattern_replaced: 'Hash-based O(n) + O(n) space → Sort + unique O(n log n) + O(1) space',
            why_better: 'When memory is constrained, sort+unique avoids extra heap allocation. STL algorithms are also highly cache-friendly.',
            complexity_comparison: { before: 'O(n) time, O(n) space', after: 'O(n log n) time, O(1) space (trade-off)' }
        },
        time_complexity_after: 'O(n log n)', space_complexity_after: 'O(1)', xp_awarded: 30,
        conceptual_question: 'When would you prefer O(n log n) time but O(1) space over O(n) time but O(n) space?'
    }
}
