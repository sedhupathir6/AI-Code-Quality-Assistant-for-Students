// mentor.ts — Precise AI Real-Time Code Mentor Engine
// Highly predictive analyzer for Correctness and Advanced Data Structure Recommendations.

export interface MentorFeedback {
    status: 'Correct' | 'Incorrect' | 'Optimal' | 'Suboptimal'
    logicIssue: string
    recommendation: {
        dataStructure: string
        timeComplexity: string
        spaceComplexity: string
        reason: string
    } | null
    fix: string | null
}

interface PreciseRule {
    test: (code: string, lang: string) => boolean
    status: 'Incorrect' | 'Suboptimal' | 'Optimal'
    logicIssue: string
    dsRec: string
    timeComp: string
    spaceComp: string
    reason: string
    fix: string
}

const PRECISE_RULES: PreciseRule[] = [
    // ─── 0. TREE DETECTION (Priority) ──────────────────────────────────────────
    {
        test: (c) => /\b(node|root|left|right|val)\b/i.test(c) && /\.(left|right)\b/.test(c),
        status: 'Optimal',
        logicIssue: 'Tree structure detected. Implementation looks standard.',
        dsRec: 'Tree / Binary Tree',
        timeComp: 'O(log n) for balanced operations',
        spaceComp: 'O(h) stack depth',
        reason: 'You are using a hierarchical structure (Tree) which is ideal for nested or sorted data relationships.',
        fix: 'If this is a BST, ensure it remains balanced (AVL/Red-Black) to avoid O(n) worst-case scenarios.'
    },
    // ─── 1. STACK: Balanced Parentheses / Monotonic Stack ─────────────────────
    {
        test: (c) => {
            // Refined: only trigger on "parentheses/brackets" keywords + looping logic
            // Avoid triggering on simple function calls like print("hi")
            const isTree = /\b(node|root|left|right)\b/i.test(c);
            if (isTree) return false; // Don't suggest stack for trees unless specialized

            const containsKeywords = /\b(parentheses|brackets|brace|balanced)\b/i.test(c);
            const manuallyIterating = /\b(for|while)\b/.test(c);
            const noStackUsed = !/\b(Stack|push|pop|append|deque)\b/i.test(c);

            return containsKeywords && manuallyIterating && noStackUsed;
        },
        status: 'Suboptimal',
        logicIssue: 'Manual character tracking detected where a Stack is safer.',
        dsRec: 'Stack (Last-In-First-Out)',
        timeComp: 'O(n) linear',
        spaceComp: 'O(n) for the stack',
        reason: 'A stack is the most efficient structure for tracking balanced nested levels or reversing sequences as you process them.',
        fix: 'Use a list as a Stack to push opening symbols and pop them to match when closing symbols are found.'
    },
    // ─── 2. QUEUE: BFS / Sliding Window ────────────────────────────────────────
    {
        test: (c, lang) => {
            // Suggest queue if BFS keywords are used WITH an inefficient list operation
            // even if it's a tree (Tree BFS)
            const hasQueueLogic = /\b(bfs|levelOrder|queue|breadthFirst|level_order)\b/i.test(c);
            const isUsingInefficientList = lang === 'python' ? /\.pop\(0\)/.test(c) : /\.\w+\[0\]/.test(c);
            return hasQueueLogic && isUsingInefficientList;
        },
        status: 'Suboptimal',
        logicIssue: 'Inefficient removal from the front of a list (O(n)) detected in BFS/Queue logic.',
        dsRec: 'Queue (collections.deque in Python / LinkedList in Java)',
        timeComp: 'O(1) for both enqueue and dequeue',
        spaceComp: 'O(n)',
        reason: 'Using a standard list for BFS makes removal from the front O(n) as all other elements must shift. A Deque provides O(1) front removals.',
        fix: 'Import deque from collections: `from collections import deque`. Use `queue = deque([root])` and `queue.popleft()`.'
    },
    // ─── 3. HEAP / PRIORITY QUEUE: Top K / Min-Max tracking ─────────────────────
    {
        test: (c) => {
            const isTree = /\b(node|root|left|right)\b/i.test(c);
            if (isTree) return false;

            return /\b(max|min|topK|k_smallest|k_largest|priority)\b/i.test(c) && /\.sort\(/.test(c) && /\b(for|while)\b/.test(c);
        },
        status: 'Suboptimal',
        logicIssue: 'Repeated sorting to find extremes is slow (O(n log n)).',
        dsRec: 'Heap / Priority Queue',
        timeComp: 'O(log n) per insertion/removal',
        spaceComp: 'O(k) or O(n)',
        reason: 'A Min-Heap or Max-Heap allows you to track the k-th element without re-sorting the entire list on every update.',
        fix: 'Use a Heap (heapq in Python / PriorityQueue in Java) to maintain the smallest/largest elements efficiently.'
    },
    // ─── 4. HASH TABLE: Search Efficiency (O(n²) detected) ─────────────────────
    {
        test: (c) => {
            const isTree = /\b(node|root|left|right)\b/i.test(c);
            if (isTree) return false; // Nested loops in trees might be traversals, don't flag as O(n^2) hash candidates generically
            return /\b(for|while)\b[\s\S]*?\b(for|while)\b/s.test(c) && !/\b(set|dict|Map|Set|HashSet|HashMap|unordered_set|unordered_map)\b/i.test(c);
        },
        status: 'Suboptimal',
        logicIssue: 'Nested loops detected causing O(n²) complexity.',
        dsRec: 'Hash Table (Set / Dictionary)',
        timeComp: 'O(n) (down from O(n²))',
        spaceComp: 'O(n)',
        reason: 'Hashing reduces member lookups from O(n) scan to O(1) constant time.',
        fix: 'Convert the secondary lookup loop into a pre-computed Set/Dictionary check.'
    },
    // ─── 5. TREE UPGRADE: Unbalanced Tree Recommendation ──────────────────────
    {
        test: (c) => /\b(insert|search)\b/i.test(c) && /\b(node|left|right)\b/i.test(c) && !/\b(avl|height|balance|color)\b/i.test(c),
        status: 'Suboptimal',
        logicIssue: 'Standard BST implementation detected without balancing logic.',
        dsRec: 'Balanced BST (AVL / Red-Black)',
        timeComp: 'Guaranteed O(log n)',
        spaceComp: 'O(n)',
        reason: 'Skewed trees can degrade to O(n) time. Balancing ensures O(log n) even in the worst case.',
        fix: 'Add height tracking and rotation logic (AVL) to keep the tree heights consistent.'
    },
    // ─── 6. Python String Concat Bottleneck ────────────────────────────────────
    {
        test: (c, lang) => lang === 'python' && /\b(for|while)\b[\s\S]*?\+=\s*\w+/.test(c) && /""/.test(c),
        status: 'Suboptimal',
        logicIssue: 'Quadratic string building in a loop.',
        dsRec: 'List (Intermediate Character Storage)',
        timeComp: 'O(n) (vs O(n²))',
        spaceComp: 'O(n)',
        reason: 'Strings are immutable. Each += copies the entire string. List .append is O(1).',
        fix: 'Append items to a list and use " "".join(list)" at the very end.'
    },
    {
        test: (c) => /while\s+True\b|while\s*\(true\)/i.test(c) && !/break|return/i.test(c),
        status: 'Incorrect',
        logicIssue: 'Infinite loop detected with no exit condition.',
        dsRec: 'N/A',
        timeComp: 'N/A (Infinite)',
        spaceComp: 'N/A',
        reason: 'The loop will never terminate and will freeze the execution environment.',
        fix: 'Implement a termination condition or a break statement inside the loop.'
    },
    {
        test: (c, lang) => lang === 'python' && /def\s+(\w+)\s*\(.*\):[\s\S]*?\b\1\s*\(/.test(c) && !/cache|lru_cache/.test(c),
        status: 'Suboptimal',
        logicIssue: 'Exponential complexity via un-memoized recursion.',
        dsRec: 'Hash Map (Memoization Table)',
        timeComp: 'O(n) (vs O(2ⁿ))',
        spaceComp: 'O(n)',
        reason: 'Recursion without caching results in massive redundant work for overlapping subproblems.',
        fix: 'Enable memoization using @lru_cache or a local dictionary to store results.'
    }
];

export function analyzeMentor(code: string, language: string): MentorFeedback {
    if (!code || code.trim().length < 10) {
        return {
            status: 'Incomplete' as any,
            logicIssue: 'Awaiting logic heavy code...',
            recommendation: null,
            fix: null
        };
    }

    for (const rule of PRECISE_RULES) {
        if (rule.test(code, language)) {
            return {
                status: rule.status as any,
                logicIssue: rule.logicIssue,
                recommendation: {
                    dataStructure: rule.dsRec,
                    timeComplexity: rule.timeComp,
                    spaceComplexity: rule.spaceComp,
                    reason: rule.reason
                },
                fix: rule.fix
            };
        }
    }

    return {
        status: 'Optimal',
        logicIssue: 'No structural bottlenecks found in the current fragment.',
        recommendation: {
            dataStructure: 'Effective use of primitive structures',
            timeComplexity: 'Linear O(n) or Constant O(1)',
            spaceComplexity: 'Minimal static allocation',
            reason: 'The code avoids common nested search or allocation pitfalls.'
        },
        fix: null
    };
}
