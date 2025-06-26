# App-Builder Agent: `app.compose` End-to-End Flow

This document outlines the step-by-step logic of the `app.compose` intent within the App-Builder agent, based on a review of the code and prompts as of the latest commit.

## 1. Intent Reception & Orchestration (`index.ts`)

The process begins when the `app-builder` Express server receives a POST request to the `/intent` endpoint with the intent `app.compose`. The `handleAppComposeIntent` function orchestrates the entire flow.

## 2. Phase 0: Clarification (Conditional)

-   **Trigger:** This phase runs only if the initial `appSpec` from the user is vague (specifically, if it lacks both a `spec_version` and a `description`).
-   **File:** `phases/phase0_clarification.ts`
-   **Logic:**
    1.  The user's raw input (e.g., "build me an expense tracker") is passed to `runPhase0Clarification`.
    2.  The function uses `phase0_clarification_prompt.md` to ask the LLM to act as a Product Manager and generate a list of clarifying questions.
    3.  The goal is to elicit the core entities, user actions, and primary goals needed for an MVP.
    4.  The list of questions is returned to the user, and the process stops, awaiting a more detailed request.

## 3. Phase 1: Planning & Classification

-   **Trigger:** Runs if Phase 0 is skipped. This is the primary starting point for a valid request.
-   **File:** `phases/phase1_plan.ts`
-   **Logic:**
    1.  If a `domain` is specified in the `appSpec`, the agent first attempts to fetch a "Best Practice Catalogue" from an external service. This is optional and the process continues if it fails.
    2.  The `runPhase1Plan` function is called with the user's `appSpec` and the (optional) catalogue.
    3.  It uses `phase1_plan_prompt.md`, which instructs the LLM to act as a core planner.
    4.  The LLM's task is to analyze the spec and output a single, structured JSON object containing:
        -   `classification`: "domain" or "custom".
        -   `actionPlan`: An array of objects, where each object **must** have a `filePath` and a `description`. This is the blueprint for the entire application.
        -   `schema`: A JSON object describing the required database tables, or `{}` if none are needed.
    5.  The code includes robust error handling to parse the LLM's JSON output, cleaning it of markdown fences and retrying the parse if necessary.

## 4. Phase 2: Holistic Code Generation

-   **File:** `phases/phase2_codegen.ts`
-   **Logic:**
    1.  The `actionPlan` from Phase 1 and the `description` from the original `appSpec` are passed to `runPhase2Codegen`.
    2.  It uses `phase2_codegen_prompt.md`, which instructs the LLM to act as an expert Next.js developer. The prompt contains extensive context on the project scaffold, forbidden files, and critical Supabase data access patterns (e.g., mandatory `workspace_id` filtering).
    3.  The LLM's task is to generate **all files** from the `actionPlan` in a single response.
    4.  Each generated file must be wrapped in a `<pria-write filename="...">...</pria-write>` block. Dependencies can be specified with `<pria-dependency>...</pria-dependency>`.
    5.  The raw string output from the LLM is passed to the next step.

## 5. Phase 'Review' and the Retry Loop

-   **File:** `phases/phase_review.ts` and `index.ts`
-   **Logic:**
    1.  **Parsing:** The raw output from Phase 2 is parsed by `parsePriaWriteBlocks` to extract the content for each file.
    2.  **Initial Review:** The list of generated files and the database `schema` from Phase 1 are passed to `runPhaseReview`. This function iterates through each file and calls the LLM using `phase_review_prompt.md`. This consolidated prompt asks the LLM to act as a senior code reviewer and check for:
        -   Correctness, completeness, and adherence to the PRIA architecture.
        -   Compliance with the database schema.
        -   Violations of a critical security checklist (tenancy, hardcoded secrets, PII, etc.).
    3.  **Retry Loop:** If any files fail the review, a `while` loop begins (max 2 retries).
        -   The failed files are mapped back to their original steps in the `actionPlan`.
        -   The `description` for each failed step is augmented with the feedback from the review (e.g., "...This file previously failed a review with the following feedback: [feedback]").
        -   `runPhase2Codegen` is called again, but this time with the smaller `retryActionPlan` containing only the failed files and a new `brief` indicating this is a retry attempt.
        -   The newly generated files replace the old failed ones in the master list.
        -   The process repeats: the new files are reviewed (with schema context), and the loop continues if any still fail.
    4.  **Final Check:** After the loop, if any files still have a `pass: false` status, the entire `app.compose` intent fails and throws an error.

## 6. Phase 4: Test Generation (Currently Disabled)

-   **File:** `phases/phase4_testgen.ts`
-   **Logic:** The code in `index.ts` for this phase is commented out. If it were active, it would iterate through the generated files and call `runPhase4TestGen` to create a basic Vitest/RTL smoke test for each component to ensure it renders without crashing.

## 7. Final Steps: GitHub Integration & Response

-   **File:** `index.ts`
-   **Logic:**
    1.  If all generated files pass the review phase, and if `TARGET_REPO` and `GITHUB_TOKEN` environment variables are set, the agent proceeds with GitHub integration.
    2.  A new branch is created (e.g., `pria-app-builder-167...`).
    3.  All the generated file contents are committed to the new branch.
    4.  A draft Pull Request is opened on GitHub, pointing from the new branch to the `main` branch.
    5.  The final success response is sent back, including the status, a success message, a list of the generated files, and the URL of the GitHub PR. 

## 8. Future Direction: Evolving Phase 0 into Product Discovery

The current `app.compose` flow is effective but reactive. The agent takes a detailed specification and builds it. The future vision is to evolve Phase 0 from a simple "Clarification" step into a proactive, iterative "Product Discovery" dialogue.

-   **Goal:** To partner with the user to define and refine the application specification *before* the planning and generation phases begin. This will reduce errors, minimize retries, and result in a final product that is more aligned with the user's true needs.

-   **Proposed Logic:**
    1.  **Initiation:** The flow will still be triggered by a high-level user request (e.g., "build an expense tracker").
    2.  **Iterative Dialogue:** Instead of returning a one-off list of questions, the agent will enter a stateful conversational loop. It will act as a Product Manager, asking targeted questions to understand the user's goals.
    3.  **Suggestion and Refinement:** The agent will not just ask questions, but also *propose* features, entities, and user roles. For example:
        -   "Should expenses have categories? I can add a `categories` table."
        -   "Should there be different user roles, like 'Employee' and 'Manager'?"
        -   "I recommend adding features for receipt uploads and approval workflows. Is that something you need for the MVP?"
    4.  **Stateful `appSpec`:** Throughout this dialogue, the agent will progressively build and refine the `appSpec` JSON object in the background.
    5.  **User Confirmation:** Once the dialogue concludes, the agent will present the final, detailed `appSpec` to the user for confirmation.
    6.  **Handoff:** Only after the user confirms the spec will the agent proceed to Phase 1 (Planning) with a much more robust and validated blueprint for the application. 