# Lessons Learned for phase2_codegen_prompt.md

**LLM Engine:** Gemini 2.5 Pro (Assumed)

This document tracks the evolution of the prompt for Phase 2 (Code Generation) to improve its reliability and performance.

---

### Iteration 1: Initial Implementation

*   **Observation:** When given a vague plan from Phase 1, the codegen LLM would fail to produce any output wrapped in the required `<pria-write>` tags. Sometimes the output was empty, other times it was a conversational refusal.
*   **Hypothesis:** The prompt was too complex and strict for a simple input. The LLM didn't have a clear path to follow when the request was not a detailed, multi-file feature.
*   **Change Made:** Added a "How to Handle Vague Requests" section to the user prompt template. This explicitly instructed the LLM to generate simple, functional placeholder components if the input `featureDescription` was high-level.
*   **Result:** This gave the LLM a valid path to follow for simple inputs, preventing it from failing silently.

---

### Iteration 2: Preventing Hallucinated Files

*   **Observation:** When faced with a vague request, the LLM generated a `README.md` file explaining the problem instead of a code file. This was correctly caught by the Review phase, but it was still incorrect behavior.
*   **Hypothesis:** The "How to Handle Vague Requests" section was not strict enough.
*   **Change Made:** Added a rule explicitly forbidding the creation of markdown (`.md`) or any other non-`.tsx` file type.
*   **Result:** This further constrained the LLM to produce only the desired code file outputs.

---

### Iteration 3: Including Canonical Examples

*   **Observation:** The LLM was generating code for core files like `middleware.ts` from scratch. While functional, this introduced unnecessary variance.
*   **Hypothesis:** Providing a complete, canonical example of core files in the prompt would be more reliable than asking the LLM to recreate them.
*   **Change Made:** Added full-file examples for `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `middleware.ts` directly into the system prompt's context block.
*   **Result:** The LLM now consistently reproduces the exact, correct code for these core files, improving reliability and consistency.

---

### Iteration 4: Evolving the Commenting Standard

*   **Observation:** The initial prompt had a strict "no comments" rule to prevent conversational output. This was too blunt and caused the reviewer to flag useful comments in `try/catch` blocks.
*   **Hypothesis:** A more nuanced rule was needed.
*   **Change Made:** The rule was evolved to require professional TSDoc/JSDoc comments (`/** ... */`) for all exported functions and types. This encourages good documentation while still forbidding the problematic conversational text. The review prompt was updated in sync.
*   **Result:** A higher standard for code quality and documentation is now enforced.

---

### Iteration 5: Enforcing Security Compliance

*   **Observation:** The agent was generating code that passed the initial code review but failed the final compliance check. The generated Server Actions were not filtering database queries by `workspace_id`, creating a critical multi-tenancy security flaw.
*   **Hypothesis:** The existing instructions about tenant isolation in the system prompt's context were not prominent enough to be followed consistently.
*   **Change Made:** A new, all-caps "Security Requirements: THIS IS NOT OPTIONAL" section was added to the end of the user prompt template. This makes the security rules the last, most immediate instruction the LLM receives before generating code.
*   **Result:** This forces the agent to prioritize and correctly implement security-critical code, enabling it to pass the final compliance gate.

--- 