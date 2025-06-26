# PRIA App-Builder Agent

## Overview
The App-Builder agent transforms workspace specifications into production-ready Next.js 15 codebases, wires up Supabase Auth/RLS, opens draft PRs, and generates live previews. It is fully A2A-compliant and leverages Gemini 2.5 Flash as its main LLM for all codegen, clarification, and planning tasks.

## Architecture
- **Language:** TypeScript (Node.js)
- **LLM:** Gemini 2.5 Flash (via HTTP API adapter)
- **A2A Protocol:** Registers with the A2A Router, receives and emits intents using the IntentMessage envelope
- **Observability:** OpenTelemetry (metrics, logs, traces) per [O1 Observability Spec](../specifications/o_1_observability_and_telemetry_spec.md)

## Setup
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Environment variables:**
   - `GEMINI_API_KEY` (for Gemini 2.5 Flash)
   - `A2A_ROUTER_URL` (A2A router endpoint)
   - `GITHUB_TOKEN` (for GitHub integration)
   - `TARGET_REPO` (e.g., `org/repo`)
   - `PREVIEW_API_URL` (optional, for remote preview)
   - `OTEL_EXPORTER_OTLP_ENDPOINT` (optional, for OTEL traces)
   - `PORT` (default: 4001)

3. **Run the agent:**
   ```sh
   npx ts-node src/index.ts
   ```

## Endpoints
- `POST /intent` — Receives A2A intents (e.g., `app.compose`)
- OTEL metrics: `http://localhost:9464/metrics` (Prometheus scrape)

## Observability
- **Metrics:**
  - `agent_inference_cost_usd` (counter)
  - `agent_intent_latency_ms` (histogram)
  - `agent_error_total` (counter)
- **Logs:** Structured, labeled with `service`, `trace_id`, `workspace_id`, `request_id`
- **Traces:** All major flows instrumented with OTEL spans
- **Dashboards & Alerts:** Compatible with Grafana Cloud (see O1 spec)

## Example Intent Payload
```json
{
  "intent": "app.compose",
  "payload": {
    "spec_version": "1.0",
    "pages": ["Home", "About"],
    "components": ["Button", "Header"],
    "workspace_id": "ws1",
    "request_id": "req1"
  },
  "trace_id": "abc123",
  "jwt": "..."
}
```

## Example Response
```json
{
  "ok": true,
  "trace_id": "abc123",
  "result": {
    "generatedCode": { "Home": "...", "About": "..." },
    "generatedComponents": { "Button": "...", "Header": "..." },
    "prUrl": "https://github.com/org/repo/pull/123",
    "previewUrl": "https://preview.pria.app/workspace/app/session",
    "build_ms": 1234
  }
}
```

## Example: Best-Practice Layout Prompt

When generating a page for a domain app, the agent will prompt the LLM like:

```
Generate a Next.js page named "Home".
Use this best-practice layout: [{"component": "ExpenseForm"}, {"component": "SubmitButton"}].
Page spec: "Home"
```

This ensures the generated page follows the organization's best-practice layout for that domain.

## Example Response (extended)
```json
{
  "ok": true,
  "trace_id": "abc123",
  "result": {
    "appType": "domain",
    "bestPracticeTemplate": { "sharedModels": ["Expense"], "sharedWorkflows": ["ExpenseApproval"] },

    "schemaSynthResult": { "ok": true, "schema": "..." },
    "workflowSynthResult": { "ok": true, "workflow": "..." },
    "compliancePassed": true,
    "dlpScanPassed": true,
    "generatedCode": { "Home": "...", "About": "..." },
    "generatedComponents": { "Button": "...", "Header": "..." },
    "prUrl": "https://github.com/org/repo/pull/123",
    "previewUrl": "https://preview.pria.app/workspace/app/session",
    "build_ms": 1234
  }
}
```

## Testing
- **Run tests:**
  ```sh
  npx jest
  ```
- Tests cover:
  - App classification and best-practice enforcement
  - Sub-intent emission and result handling
  - Compliance/DLP validation block
  - All previous flows (clarification, codegen, error handling)

## Extending the Agent
- Add new intent handlers in `src/index.ts`
- Add new metrics in `src/otelMetrics.ts`
- Add new API integrations as needed
- See [O1 Observability Spec](../specifications/o_1_observability_and_telemetry_spec.md) for telemetry requirements

---

© PRIA Engineering, 2025

## Main Responsibilities
- Parse incoming `app.compose` intents and break down workspace specs
- Clarify ambiguities using Gemini 2.5 Flash (domain Q&A)
- **Classify apps as domain or custom using the best-practice catalogue (enforced)**
- **For domain apps, always use shared models, workflows, and per-page UI layouts from the best-practice catalogue**
  - When generating code for each page in a domain app, the agent fetches the best-practice layout for that page (if available) and includes a prompt like `Use this best-practice layout: [...]` in the codegen request to the LLM.
  - This ensures generated pages follow organization standards for structure and UX.
- **Emit sub-intents to Schema Synthesiser (`schema.synthesise`) and Workflow Composer (`workflow.compose`) for all schema/workflow changes (never mutate directly)**
- **Run compliance and DLP validation before preview/PR; block if not passed**
- **Log all sub-intents, compliance checks, and DLP scans for audit**
- Generate Next.js code, Tailwind, shadcn/ui components, and env scaffolding
- Commit, push, and open draft PRs
- Launch WebContainer previews (fallback to remote preview if needed)
- Run unit tests and enforce coverage thresholds
- Emit `app.preview` intents with preview/pr URLs

## A2A Compliance
- Registers capabilities and endpoint with the A2A Router on startup
- Handles all communication via the IntentMessage envelope
- Preserves JWT scopes and handoff counts
- Emits and consumes sub-intents as needed (e.g., `schema.synthesise`, `workflow.compose`)

## LLM Usage
- All prompt chains, codegen, and clarification steps use Gemini 2.5 Flash
- Prompts are structured for optimal performance with Gemini 2.5 Flash

## PRIA Compliance & Auditability
- **All schema and workflow changes are delegated via sub-intents; never direct mutation**
- **All sub-intents, compliance checks, and DLP scans are logged and traceable (see [D1 Data Model & Tenancy Spec](../specifications/d_1_data_model_and_tenancy_spec%20(1).md))**
- **Compliance and DLP validation is enforced before any preview or PR is created**
- **All generated code and artefacts are tagged with workspace_id and data-class**

## Getting Started
1. Install dependencies: `npm install` 