### **Project Plan: `app.compose` Product Discovery Phase**

The goal of this project is to replace the current, one-shot "Clarification" phase with a stateful, interactive "Product Discovery" dialogue. The agent will act as a Product Manager, collaborating with the user to define a detailed application specification (`appSpec`) *before* committing to the planning and code generation phases.

---

#### **Phase 1: Foundational Changes (API & State Management)**

This phase lays the groundwork for supporting multi-turn conversations.

*   **Task 1.1: Evolve the Agent-to-Agent (A2A) Communication Protocol**
    *   **Requirement:** The current fire-and-forget `/intent` endpoint is insufficient. We need a way to maintain conversational context across multiple user interactions.
    *   **Specification:**
        *   The `app.compose` intent payload will be updated to include an optional `conversationId`. Its absence signifies the start of a new discovery session.
        *   The agent's response will be updated to include a `status` field and the `conversationId`.
            *   `status: 'AWAITING_USER_INPUT'`: Indicates the conversation is ongoing and the agent has sent a question or suggestion to the user.
            *   `status: 'COMPLETED'`: Indicates the entire `app.compose` flow is finished (i.e., PR is created).
        *   The A2A Router or a similar stateful service will be responsible for storing the in-progress `appSpec` associated with the `conversationId`.

*   **Task 1.2: Design the State Management Strategy**
    *   **Requirement:** The `appSpec` will be built incrementally. We need to decide where this state lives.
    *   **Specification:**
        *   The A2A Router will cache the `appSpec` object.
        *   On each turn, the App-Builder will receive the latest user input and the current `appSpec` from the cache.
        *   The App-Builder will return the *newly updated* `appSpec` along with its response, and the A2A Router will update the cache.

---

#### **Phase 2: The "Product Manager" LLM Core**

This phase focuses on crafting the "brain" of the Product Discovery agent.

*   **Task 2.1: Author the Product Discovery Prompt**
    *   **Requirement:** A new, highly-detailed prompt is needed to guide the LLM's behavior.
    *   **Specification:**
        *   **File:** `app-builder/src/phases/prompts/phase0_discovery_prompt.md`.
        *   **Persona:** "You are an expert Product Manager and Solutions Architect. Your mission is to collaborate with a user to define the complete specification for a new web application. Guide the user from a vague idea to a concrete, buildable plan."
        *   **Process Flow within the Prompt:**
            1.  **Identify Core Entities:** Start by asking for the primary "thing" the app manages (e.g., "expenses," "projects," "customers").
            2.  **Propose Schema:** Based on the entity, propose a database schema with standard fields.
            3.  **Suggest Features:** Proactively suggest features and user actions (e.g., "Should managers be able to approve expenses?", "Do you need different user roles?").
            4.  **Iterate:** Refine the `appSpec` based on the user's feedback.
            5.  **Seek Confirmation:** Conclude by summarizing the plan and asking for approval.
        *   **Output Constraint:** The LLM's output **must** be a JSON object containing:
            *   `updatedAppSpec`: The complete, modified `appSpec` object.
            *   `responseToUser`: The text to display to the user (the next question or summary).
            *   `isComplete`: A boolean flag indicating if the discovery phase is finished and ready for user confirmation.

---

#### **Phase 3: Implementation & Orchestration**

This phase involves writing the TypeScript code to drive the new process.

*   **Task 3.1: Implement the Discovery Orchestrator**
    *   **Requirement:** A new module is needed to manage the conversational loop.
    *   **Specification:**
        *   **File:** `app-builder/src/phases/phase0_discovery.ts`.
        *   **Primary Function:** `runPhase0ProductDiscovery(userInput, existingSpec)`.
        *   **Logic:** This function will take the user's latest message and the current `appSpec`, call the LLM with the new discovery prompt, parse the JSON response, and return the `updatedAppSpec`, `responseToUser`, and `isComplete` flag to the main handler.

*   **Task 3.2: Refactor the Main Intent Handler**
    *   **Requirement:** `handleAppComposeIntent` in `app-builder/src/index.ts` must be updated to orchestrate the new flow.
    *   **Specification:**
        1.  Check for a `conversationId` in the incoming request.
        2.  **If new session:** Call `runPhase0ProductDiscovery` with only the user input. Return the agent's first question and the new `conversationId`.
        3.  **If existing session:** Fetch the `existingSpec` from the cache, then call `runPhase0ProductDiscovery`.
        4.  Check the `isComplete` flag from the response.
        5.  **If `false`:** Update the cached `appSpec` and return the agent's next question.
        6.  **If `true`:** This is the handoff point. Proceed to the final confirmation step.

*   **Task 3.3: Implement the Final Confirmation Step**
    *   **Requirement:** The user must give explicit approval before the expensive code generation phases are triggered.
    *   **Specification:**
        *   When `isComplete` is true, the `handleAppComposeIntent` function will present the final `appSpec` summary (the `responseToUser` from the last turn) and await a final "yes/no" from the user.
        *   Only upon receiving a positive confirmation will the handler pass the completed `appSpec` to `runPhase1Plan` and continue the rest of the existing build process. 