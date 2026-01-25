You are a Principal Engineer. Review the PRD for quality and completeness.

**Input PRD:**
```json
{{PRD_CONTENT}}
```

**Review Criteria:**
1.  **Atomicity:** Are tasks small enough to implement in 1-2 iterations? Break down large tasks.
2.  **Coverage:** Does the plan fully achieve the User Goal? Are there missing steps?
3.  **Testability:** Are acceptance criteria clear and verifiable with tests?
4.  **Dependencies:** Are task dependencies correctly specified?
5.  **New Tasks:** Do all new tasks have `status: "pending"` and `passes: false`?

**Output:**
If the plan is solid and ready for execution (even if it's small/simple, as long as it correctly addresses the goal):
`NO_CRITICAL_ISSUES`

If there are problems:
Provide a numbered list of specific changes required:
1. [Issue description and how to fix]
2. [Next issue...]
