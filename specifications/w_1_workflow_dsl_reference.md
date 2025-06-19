# W1 — Cortex Workflow DSL Reference

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Define the JSON-based domain‑specific language (DSL) that describes every PRIA workflow.  The DSL must be deterministic, version‑controlled, testable, and extensible.  This reference is the authoritative source for Orchestrator validation logic and for LLM prompt templates used by the Workflow Composer Agent.

---

## 1  Scope & Objectives

1. Provide a machine‑readable JSON Schema for workflow definitions (`workflow_def.dag_json`).
2. Enumerate reserved step types, their required/optional fields, idempotency rules, and failure semantics.
3. Specify versioning and checksum rules that tie a workflow to UI revisions and audit trails.
4. Describe validation grammar the Orchestrator must enforce before accepting a new workflow version.
5. Embed LLM prompt templates that the Composer Agent uses to generate and mutate DSL snippets safely.
6. Supply examples: minimal “Hello World,” finance approval flow, and hybrid AI‑assisted step.

## 2  High‑Level Principles

- **Deterministic First.**  All side‑effects must be enumerated; AI steps produce data but may not decide control‑flow unilaterally.
- **No Hidden State.**  Inputs, outputs, retries, and compensation logic are explicit in JSON.
- **Forward‑Compatible.**  Unknown fields are ignored by the engine but preserved in storage for future use.
- **Auditable.**  Each DAG has a `checksum` = SHA‑256 of canonicalised JSON (**excluding** signature) to guarantee immutability.

## 3  Top‑Level JSON Schema (draft)

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.pria.cloud/workflow-def.json",
  "title": "PRIA Workflow Definition",
  "type": "object",
  "required": ["schemaVersion", "name", "version", "steps"],
  "properties": {
    "schemaVersion": {"type": "string", "pattern": "^1\\.\\d+"},
    "name": {"type": "string", "minLength": 3, "maxLength": 120},
    "version": {"type": "string", "pattern": "^v\\d+\\.\\d+"},
    "description": {"type": "string"},
    "steps": {
      "type": "array",
      "items": {"$ref": "#/definitions/step"},
      "minItems": 1
    },
    "signature": {"type": "string"}
  },
  "definitions": {
    "step": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9_-]{3,40}$"},
        "type": {"type": "string", "enum": ["sql", "http", "script", "ai", "branch", "sleep"]},
        "params": {"type": "object"},
        "onSuccess": {"$ref": "#/definitions/edge"},
        "onFailure": {"$ref": "#/definitions/edge"},
        "retry": {
          "type": "object",
          "properties": {
            "count": {"type": "integer", "minimum": 0, "maximum": 5},
            "delaySeconds": {"type": "integer", "minimum": 0, "maximum": 300}
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "edge": {
      "type": ["string", "null"],
      "description": "ID of the next step or null to end."
    }
  },
  "additionalProperties": false
}
```

*Delivered as ****\`\`**** in the repo root; Orchestrator validates against it.*

## 4  Reserved Step Types

| Type ID  | Purpose                                                 | Mandatory `params` Keys                    | Idempotency Rule                                                               | Failure Semantics                                       |
| -------- | ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `sql`    | Execute single SQL statement via Supabase service role. | `statement`, `args`                        | Statement must be deterministic; no `now()` or random unless passed in as arg. | Fail = transaction rollback; proceed to `onFailure`.    |
| `http`   | Call external REST/GraphQL.                             | `method`, `url`, `headers`, `bodyTemplate` | Must include `idempotencyKey` header.                                          | Retry if 5xx; fail if 4xx.                              |
| `script` | Run JS/TS snippet in Deno isolate (edge function).      | `code`                                     | Must not access network unless via `fetch` wrapper that respects allow‑list.   | Fail bubbles.                                           |
| `ai`     | Call LLM for generation/classification.                 | `promptTemplate`, `model`, `schema`        | Output validated against JSON Schema referenced in `schema`.                   | On validation fail → `onFailure`; no partial DB commit. |
| `branch` | Conditional route.                                      | `expression` (SQL boolean)                 | Pure function of workflow state.                                               | Expression error = fail.                                |
| `sleep`  | Pause for period.                                       | `seconds`                                  | n/a                                                                            | Retry not applicable.                                   |

> **Prompt Block W1‑STEP‑SCAFFOLD**\
> *System:* “Generate a JSON snippet for a ‘sql’ step that inserts into `expense_audit` with args {{args}}.  Include onSuccess and retry default.”

## 5  Versioning & Checksum

- **Semantic Versioning** `vMAJOR.MINOR` increments on any DAG change.
- **Checksum** = SHA‑256 of the canonical JSON (UTF‑8, sorted keys, no whitespace) **excluding** the `signature` property.  Stored in `workflow_def.checksum`.
- The Test‑Harness Agent recomputes checksum post‑migration; mismatch = reject.

## 6  Validation Grammar (Engine‑Level)

1. Validate against JSON Schema.
2. Detect cycles (DAG must be acyclic).
3. Ensure exactly one entry step (`steps[0]`).
4. Ensure all `onSuccess` / `onFailure` edges point to valid IDs.
5. Verify each `sql.statement` references **only** allowed tables/columns (static allow‑list).
6. For `ai` steps, ensure `schema` exists in `prompt_templates`.
7. Total DAG size ≤ 64 KB; total steps ≤ 100.

## 7  Example Workflows

### 7.1  Minimal “Hello World”

```jsonc
{
  "schemaVersion": "1.0",
  "name": "hello",
  "version": "v1.0",
  "steps": [
    {
      "id": "say-hi",
      "type": "script",
      "params": {
        "code": "console.log('hello from PRIA');"
      },
      "onSuccess": null,
      "onFailure": null
    }
  ],
  "signature": ""
}
```

### 7.2  Expense Approval Flow (truncated)

```jsonc
{
  "schemaVersion": "1.0",
  "name": "expense-basic",
  "version": "v1.3",
  "steps": [
    { "id": "fraud-score", "type": "ai", "params": { "promptTemplate": "expense_fraud", "model": "gpt-4o", "schema": "fraudScore" }, "onSuccess": "branch-approve", "onFailure": "mark-fail" },
    { "id": "branch-approve", "type": "branch", "params": { "expression": "{{fraudScore}} < 0.7 AND {{amount}} <= 1000" }, "onSuccess": "auto-approve", "onFailure": "manager-approve" },
    { "id": "auto-approve", "type": "sql", "params": { "statement": "UPDATE expense SET status='approved' WHERE id={{expenseId}}", "args": [] }, "onSuccess": null, "onFailure": "mark-fail", "retry": { "count": 2, "delaySeconds": 5 } },
    { "id": "manager-approve", "type": "http", "params": { "method": "POST", "url": "https://slack.com/api/chat.postMessage", "headers": { "Authorization": "Bearer ..." }, "bodyTemplate": "slack_approval" }, "onSuccess": null, "onFailure": "mark-fail" },
    { "id": "mark-fail", "type": "sql", "params": { "statement": "UPDATE expense SET status='failed' WHERE id={{expenseId}}", "args": [] }, "onSuccess": null, "onFailure": null }
  ],
  "signature": ""
}
```

## 8  LLM Prompt Templates

| ID               | Purpose                                              | Output JSON Schema Ref |
| ---------------- | ---------------------------------------------------- | ---------------------- |
| `expense_fraud`  | Score risk of expense description vs receipt amount. | `fraudScore`           |
| `slack_approval` | Build Slack message for manager approval.            | n/a (string)           |
| `ddl_add_column` | Generate safe `ALTER TABLE` statements.              | n/a                    |

> **Prompt Block W1‑COMPOSER‑GEN**\
> *System:* “You are Workflow Composer. Given requirement {{req}}, output valid DSL JSON conforming to schema https\://….”

## 9  Test‑Harness Rules

- Harness enumerates permutations of branches (`branch-*`) and generates synthetic context.
- Asserts runtime DAG matches checksum pre‑publish.
- Fails build if any SQL step hits forbidden table or if AI step output fails JSON validation.

## 10  Open Items / TBD

- Define `graph‑hash` optimisation for partial DAG re‑execution.
- Formal spec for step‑level compensation/undo semantics (Wave 2).
- Decide on multi‑parent DAG edges (fan‑in) vs serialisation requirement.

---

**Revision History**

| Version | Date       | Author         | Notes                                        |
| ------- | ---------- | -------------- | -------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of Workflow DSL. |

