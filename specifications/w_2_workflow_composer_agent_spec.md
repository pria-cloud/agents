# W2 — Workflow Composer Agent Specification

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Define the behaviour, APIs, prompt strategies, safety filters, and operational metrics for the **Workflow Composer Agent**—the LLM‑powered service that transforms high‑level business requirements into valid Cortex Workflow DSL (see W1).  This spec ensures every generated workflow is deterministic, auditable, policy‑compliant, and accompanied by exhaustive test fixtures.

---

## 1  Scope & Objectives

1. Specify gRPC and REST endpoints exposed by the Composer to user interfaces and integration partners.
2. Provide the multi‑stage prompt architecture used to draft, refine, and self‑critique DSL output.
3. Enumerate guard‑rails (static and semantic) that prevent unsafe actions, infinite loops, or policy violations.
4. Describe integration with **Test‑Harness Agent** (W3) and Schema Synthesiser (D2) for end‑to‑end CI gating.
5. List operational metrics and alert thresholds for Composer latency, error rate, and override frequency.
6. Include full examples—from “Expense Approval Lite” to a hybrid human‑in‑the‑loop flow—and corresponding test harness context.

## 2  System Context & Interaction Flow

```
 Product Manager                                 Compliance Reviewer
      │                                                 ▲
  (1) Requirement JSON                                 │(6) comments
      ▼                                                 │
┌──────────────┐   (2) ProposeDSL   ┌───────────────────┴─────────────┐
│  Front‑End   │ ────────────────► │      Composer Agent (Fly)       │
└──────────────┘                   ├───────┐                        │
                                   │  (3)  │Prompt chain (LLM)      │
                                   │       ▼                        │
                                   │  Draft DSL JSON               │
                                   │       │(4) Validation          │
                                   │       ▼                        │
                                   │  Static + Semantic checks     │
                                   │       │                        │
                                   └───────┴─▶ Test‑Harness Agent   │
                                            (5) fixtures run        │
                                                                  DB + Orchestrator
```

## 3  API Definition

### 3.1  gRPC Service

```proto
service WorkflowComposer {
  rpc ProposeDSL(ProposeRequest) returns (ProposeResponse);
  rpc ValidateDSL(ValidateRequest) returns (ValidateResponse);
}

message ProposeRequest {
  string workspace_id = 1;          // Tenant context
  string requirement_json = 2;      // Business requirement
  optional string template_id = 3;  // seed from best‑practice
}

message ProposeResponse {
  string draft_dsl = 1;             // JSON conforming to W1 Schema
  string explanation_markdown = 2;  // Rationale for each step
  repeated string review_questions = 3; // Ask user to clarify ambiguities
  string checksum = 4;
}
```

### 3.2  REST Facade *(Edge Function)*

- \*\*POST \*\*\`\` – mirrors gRPC but returns HTTP 201 with JSON payload.  Rate‑limited to 10 req/min per workspace.

## 4  Prompt Architecture

The Composer uses a *three‑stage chain* with self‑reflection:

| Stage | Prompt Block      | Model         | Output                               | Guard‑Rail                            |
| ----- | ----------------- | ------------- | ------------------------------------ | ------------------------------------- |
| **1** | `W2‑STRUCT‑DRAFT` | `gpt‑4o‑128k` | Step skeletons (no SQL)              | Token count < 8 k, no external calls  |
| **2** | `W2‑FILL‑DETAIL`  | `gpt‑4o‑128k` | Complete DSL with params             | Calls `validate_schema` function tool |
| **3** | `W2‑SELF‑CRITIC`  | `gpt‑4o‑128k` | Explanation + mitigation suggestions | Must not increase token count > 10 k  |

### 4.1  Prompt Block W2‑STRUCT‑DRAFT (excerpt)

```
System: You are Workflow Designer. Draft high‑level steps only. Each step must list:
  – id, type, onSuccess/onFailure.
User Requirement: {{requirement_json}}
Known Modules: {{template_id}}

Respond with JSON array of steps.
```

### 4.2  Prompt Block W2‑FILL‑DETAIL

```
System: Fill in missing params for each step. SQL must reference allowed tables only. Use idempotency keys.
Previous draft: {{draft}}
...
```

### 4.3  Prompt Block W2‑SELF‑CRITIC

```
System: Review DSL for determinism, RLS safety, and AI step validation. Return:
  • corrected DSL (if needed)
  • explanation
  • open questions to user.
```

## 5  Static Guard‑Rails

| ID | Check                                   | Action on Fail        |
| -- | --------------------------------------- | --------------------- |
| G1 | DSL exceeds 64 KB                       | Truncate & ask user   |
| G2 | Cyclic graph detected                   | Reject draft          |
| G3 | `sql.statement` touches forbidden table | Reject + warn         |
| G4 | AI step missing schema validation       | Auto‑insert fail path |
| G5 | Missing `workspace_id` RLS predicate    | Insert predicate      |

## 6  Integration with Test‑Harness Agent

- Composer packs `draft_dsl` + context into `HarnessRequest`.
- Harness generates fixtures → returns pass/fail + coverage metrics.
- If coverage < 90 % branches, Composer may auto‑add additional test cases.

## 7  Operational Metrics

| Metric                                   | Type | Threshold / Alert                     |
| ---------------------------------------- | ---- | ------------------------------------- |
| `composer_requests_total`                | cnt  | —                                     |
| `composer_latency_ms`                    | hist | p95 < 2 000 ms                        |
| `composer_self_critic_corrections_total` | cnt  | > 20 % of drafts indicates spec drift |
| `composer_validation_fail_total`         | cnt  | Alert if > 5/min                      |
| `composer_harness_fail_total`            | cnt  | Alert immediately                     |

## 8  Example — “Invoice Three‑Way Match”

**Requirement (truncated):**

```json
{"flow":"invoice_match","threshold":1000,"approval":"manager","receipt_required":true}
```

**Stage‑1 Draft (steps only):**

```jsonc
[
  {"id":"extract‑po","type":"ai","onSuccess":"match‑items","onFailure":"fail"},
  {"id":"match‑items","type":"sql","onSuccess":"branch‑approve","onFailure":"fail"},
  {"id":"branch‑approve","type":"branch", ... },
  {"id":"approve","type":"sql", ...},
  {"id":"fail","type":"sql", ...}
]
```

*… Stage‑2 filled details and Stage‑3 explanation omitted for brevity.*

## 9  Runbook

1. **Draft fails validation** – Composer returns 400 with error message, UI shows inline.
2. **Continuous overrides > 10 %** – Investigate prompt drift; fine‑tune LLM adapter.
3. **Latency alert** – scale Fly CPUs or add GPU inference if AI step dominates.

## 10  Open Items / TBD

- Support interactive chat refinement loop (LLM conversational memory) post‑MVP.
- Add retrieval‑augmented context for industry‑specific templates.
- Rate‑limit per workspace per hour (tuning pending pilot usage).

---

**Revision History**

| Version | Date       | Author         | Notes                                    |
| ------- | ---------- | -------------- | ---------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of Composer. |

