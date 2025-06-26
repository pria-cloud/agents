# Lessons Learned for phase_review_prompt.md

**LLM Engine:** Gemini 2.5 Pro (Assumed)

This document tracks the evolution of the prompt for the Review Phase to improve its reliability and performance as a quality gate.

---

### Iteration 1: Initial Implementation

*   **Observation:** The initial code generation phase was prone to outputting conversational text, markdown, or other non-code artifacts that would break the application.
*   **Hypothesis:** A separate, dedicated review step was needed to act as a quality gate and catch these errors before they were written to disk.
*   **Change Made:** The `phase_review` was created with a simple prompt instructing an LLM to review generated code for correctness and adherence to architectural rules.
*   **Result:** The review phase immediately began catching errors, proving its value in the agent's workflow.

---

### Iteration 2: Evolving the Commenting Standard

*   **Observation:** An early, strict rule forbidding all comments and conversational text was too blunt. The reviewer began flagging useful, valid comments in the code (e.g., in `try/catch` blocks), causing unnecessary failures in the retry loop.
*   **Hypothesis:** The rule needed to be more nuanced to distinguish between helpful code documentation and unhelpful conversational text.
*   **Change Made:** The prompt was updated to establish a professional commenting standard. It now requires TSDoc/JSDoc for exported entities while still forbidding raw, unformatted conversational text.
*   **Result:** The reviewer is now a more intelligent quality gate, enforcing a high standard of code documentation without failing on valid, helpful comments.

--- 