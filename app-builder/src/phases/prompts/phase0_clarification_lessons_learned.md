# Lessons Learned for phase0_clarification_prompt.md

**LLM Engine:** Gemini 2.5 Pro (Assumed)

This document tracks the evolution of the prompt for Phase 0 (Clarification) to improve its reliability and performance.

---

### Iteration 1: Initial Implementation

*   **Observation:** The prompt worked for vague, natural language inputs (e.g., "build an expense tracker"). However, when the input payload was changed to a more structured, but abstract, JSON object (e.g., just a list of pages and components), the LLM became confused and returned unrelated, conversational text instead of the required questions.
*   **Hypothesis:** The prompt is explicitly designed to ask questions about high-level concepts ("Core Thing", "Key User Actions"). It doesn't know how to handle a structured input that lacks this narrative.
*   **Change Made:** The core application logic in `index.ts` was modified to bypass this clarification phase entirely if a new `spec_version` or a detailed `description` was present in the incoming payload.
*   **Result:** This was a successful architectural change. The clarification phase is now reserved only for truly ambiguous initial requests, preventing it from failing on structured inputs.

--- 