# Lessons Learned for phase1_plan_prompt.md

**LLM Engine:** Gemini 2.5 Pro (Assumed)

This document tracks the evolution of the prompt for Phase 1 (Planning) to improve its reliability and performance.

---

### Iteration 1: Initial Implementation

*   **Observation:** The LLM was returning a valid JSON object, but it was wrapped in markdown code fences (e.g., ` ```json ... ``` `), causing parsing to fail.
*   **Hypothesis:** The LLM is trying to be helpful by indicating the language of the code block.
*   **Change Made:** The parsing logic in `phase1_plan.ts` was updated to strip the markdown fences before attempting to parse the JSON.
*   **Result:** This made the parsing logic more robust.

---

### Iteration 2: Handling Abstract Input

*   **Observation:** When given a minimal, abstract `appSpec` (e.g., just a list of pages), the LLM would not return valid JSON. Instead, it would often return a conversational explanation of why it couldn't create a full plan.
*   **Hypothesis:** The prompt was too rigid and didn't guide the LLM on how to handle specs that weren't fully detailed.
*   **Change Made:** Added a "User Prompt Template" section with explicit instructions on how to interpret the simplified `appSpec` and generate a basic plan from it.
*   **Result:** The LLM began producing valid JSON plans for abstract inputs.

---

### Iteration 3: Enforcing Output Schema

*   **Observation:** The LLM started hallucinating its own schema for the output JSON object, ignoring the one specified in the prompt (e.g., creating a `scaffold` array instead of an `actionPlan` array). This caused the codegen phase to generate incorrect and forbidden files.
*   **Hypothesis:** The negative constraint ("Do not add any properties not listed here") was not strong enough.
*   **Change Made:** The prompt was updated to be more forceful.
    1.  A direct command was added to the start of the user prompt: "Your ONLY task is to generate a JSON object matching the schema...".
    2.  The example JSON in the `OUTPUT FORMAT` section was annotated with `MUST` statements to reinforce the types and constraints (e.g., `"classification": "MUST be 'domain' or 'custom'"`).
*   **Result:** The LLM began adhering to the specified JSON schema.

---

### Iteration 4: Ensuring Plan-to-Code Traceability

*   **Observation:** The code review retry loop was failing because it couldn't map a failed generated file back to the step in the action plan that created it. This happened when the codegen LLM created multiple files from a single plan step.
*   **Hypothesis:** The link between the plan and the code was implicit. It needed to be explicit.
*   **Change Made:** The prompt was updated with a "CRITICAL RULE" making the `filePath` property mandatory for every single step in the `actionPlan`. The rule was emphasized multiple times.
*   **Result:** This creates a reliable, explicit link between the plan and the generated files, enabling a robust review and retry mechanism. This is a cornerstone of a reliable generation process.

---

### Iteration 5: Aggressive Rule Enforcement

*   **Observation:** The LLM would still occasionally omit the `filePath` property from a plan step, causing the review/retry loop to fail.
*   **Hypothesis:** The "CRITICAL RULE" was still not forceful enough to overcome all LLM variance.
*   **Change Made:** The rule was made even more aggressive. The `OUTPUT FORMAT` example was updated to include an all-caps "CRITICAL" warning, and the rule was re-written to state that the "entire system will crash" if the `filePath` is omitted.
*   **Result:** This represents the most forceful instruction possible to ensure the `filePath` is always present, which is the final key to unlocking a fully automated, self-healing code generation workflow.

--- 