# D2 — Schema Synthesiser Agent Contract

**Document status:** Final v1.1 · June 2025\
**Owner:** CEO (Per Swedenborg)

**Purpose:** Specify the API contract, prompt strategy, guard‑rails, and operational metrics for the **Schema Synthesiser Agent**—the autonomous service that converts high‑level schema change requests into safe Postgres DDL **and** posts those changes to the continuous‑integration pipeline.  Version 1.1 makes the agent fully **A2A‑native**: it registers its capability set with the A2A Router, receives `IntentMessage`s (`schema.synthesise`, `schema.rollback`), and propagates **MCP** context through every hand‑off.

---

## Table of Contents

1. Scope & Objectives
2. Architecture & Interaction Flow
3. A2A Capability Registration
4. gRPC Service Definition
5. Prompt Architecture
6. Guard‑Rails & Validation Pipeline
7. Operational Metrics & Alerts
8. Error Handling & Retry Logic
9. Security & Compliance Considerations
10. Open Items / Future Enhancements
11. Revision History

---

## 1  Scope & Objectives

1. Turn **natural‑language** or **JSON** schema‑change requirements into deterministic, idempotent DDL and pgTAP tests.
2. Support **multi‑tenant** Postgres with `workspace_id` RLS and masking policies (see D1).
3. Expose a deterministic **gRPC** API + **A2A** capability so other agents (e.g., Workflow Composer) can chain schema changes in real time.
4. Guarantee **zero data loss**: every migration must be backward‑compatible until explicitly finalised.

## 2  Architecture & Interaction Flow

```
 UI → A2A Router → Schema Synthesiser Agent → Supabase Admin API
      ▲                 │                                 │
      │  Intent:        │ 3  ApplyDDL (service role JWT)  ▼
  (1)  │  schema.synthesise
      │                 └── 4  pgTAP tests via CI Runner
      │
      └─ 2  Exchange.Response (DDL, checksum, test artefacts)
```

**All schema changes must come via A2A sub-intents from App-Builder or Workflow Composer. The agent must never mutate the database directly except in response to a valid intent.**

*Numbers denote sequence; MCP context is propagated automatically between the A2A Router and the agent.*

## 3  A2A Capability Registration

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| `agent_name`     | `SchemaSynthesiser`                                          |
| `capabilities[]` | `can_handle:schema.synthesise`, `can_handle:schema.rollback` |
| `supports_mcp`   | `TRUE`                                                       |
| `endpoint_url`   | `grpc://agent-mesh/schema-synthesiser:9504`                  |

Agents POST the above payload to `` on the A2A Router at startup.  JWT **must** include the scopes declared above.

## 4  gRPC Service Definition

```proto
syntax = "proto3";

package pria.schema.v1;

service SchemaSynthesiser {
  // Draft and validate DDL without executing.
  rpc ProposeDDL(ProposeRequest) returns (ProposeResponse);

  // Apply a previously‑validated migration inside a transaction.
  rpc ApplyDDL(ApplyRequest) returns (ApplyResponse);

  // Roll back to a checkpointed schema version.
  rpc Rollback(RollbackRequest) returns (RollbackResponse);
}

message ProposeRequest {
  string workspace_id   = 1;  // Tenant context.
  string requirement    = 2;  // Natural‑language or JSON spec.
  string baseline_hash  = 3;  // Checksum from `schema_versions`.
  bool   dry_run_tests  = 4;  // Optional: run pgTAP only.
}

message ProposeResponse {
  string ddl_sql              = 1; // Canonicalised SQL statements.
  string pgtap_tests          = 2; // pgTAP file contents.
  string checksum             = 3; // SHA‑256 of ddl_sql.
  repeated string clarifications = 4; // Questions back to caller.
}

message ApplyRequest {
  string workspace_id = 1;
  string ddl_sql      = 2;
  string checksum     = 3;
}

message ApplyResponse {
  bool   success          = 1;
  string new_schema_hash  = 2;
  string migration_id     = 3;
}

message RollbackRequest {
  string workspace_id  = 1;
  string target_hash   = 2;
}

message RollbackResponse {
  bool success = 1;
}
```

### REST Facade

Edge Function `POST /schema/synthesise` forwards to gRPC `ProposeDDL`; requires scope `schema:synthesise`.

## 5  Prompt Architecture

Three‑stage chain executed with **GPT‑4o‑128k** adapters (fine‑tuned nightly via ML1):

| Stage | Prompt Block         | Output                           | Guard‑Rail                      |
| ----- | -------------------- | -------------------------------- | ------------------------------- |
| 1     | `D2‑STRUCT‑SKELETON` | Table/column list, comments      | ≤ 4 k tokens                    |
| 2     | `D2‑GEN‑DDL`         | Canonical DDL SQL + annotations  | Validates via `validate_sql` fn |
| 3     | `D2‑PGTAP‑GEN`       | pgTAP tests covering new objects | Coverage ≥ 90 % branches        |

*All prompt blocks templated and version‑controlled in **`/prompts/d2/`**.*

## 6  Guard‑Rails & Validation Pipeline

| ID | Check                                              | Action on Fail                      |
| -- | -------------------------------------------------- | ----------------------------------- |
| G1 | DDL references forbidden schema (`auth.*`, `pg_*`) | Reject proposal                     |
| G2 | Missing `workspace_id` FK on shared table          | Auto‑add column, regenerate check   |
| G3 | DDL not idempotent (detected via `IF NOT EXISTS`)  | Fix auto or reject                  |
| G4 | pgTAP coverage < 90 %                              | Prompt Stage‑3 regenerates tests    |
| G5 | RLS policy absent for new table                    | Insert default policy template      |
| G6 | Migration runtime > 5 s in CI container            | Mark warning, require manual review |
| G7 | **DDL not validated for compliance or data-classification** | Reject proposal or require fix |

**The agent must validate all DDL for compliance and data-classification (see A4) before applying.**

## 7  Operational Metrics & Alerts

| Metric                              | Type    | Threshold / Alert                   |
| ----------------------------------- | ------- | ----------------------------------- |
| `synth_requests_total`              | counter | —                                   |
| `synth_fail_total`                  | counter | Alert if > 1 per workspace per hour |
| `synth_generation_latency_ms`       | hist    | p95 < 2 000 ms                      |
| `synth_apply_success_total`         | counter | —                                   |
| `synth_schema_drift_detected_total` | counter | Any triggers PagerDuty P1           |

Grafana dashboard **Schema Synthesiser Health** shows latency histograms and drift events.

## 8  Error Handling & Retry Logic

| Error Class      | Example              | Retry Strategy                      |
| ---------------- | -------------------- | ----------------------------------- |
| ValidationError  | Forbidden table name | **No retry.** Return `400`          |
| TransientNetwork | Supabase Admin 503   | Exponential back‑off ×3 (1s→8s)     |
| LockTimeout      | DDL lock contention  | Wait 5 s, retry once                |
| pgTAPFail        | Test failure         | **No retry.** Caller must fix input |

All failures emit `span.status=ERROR` in OTEL traces with `error_type` attribute.

## 9  Security & Compliance Considerations

- JWT scope `schema:synthesise` required; Supabase service‑role token needed for `ApplyDDL`.
- Agent runs in Fly.io VM with read‑only FS; outbound network restricted to Supabase Admin & Grafana.
- Every applied migration inserts a row in `schema_versions` with checksum **and** MCP trace‑ID for audit linkage.
- **All DDL proposals and applications must be logged with MCP context for auditability.**
- Drata evidence connector pulls `schema_versions` diff nightly.

## 10  Open Items / Future Enhancements

- Support **Liquibase‑formatted Changelogs** as alternate output (Q4 2025).
- Add **down‑migrations** via `ROLLBACK TEMPLATE` generation.
- Integrate **GPT‑Guardrails** policy LLM once OSS licence permits.

## 11  Revision History

| Version | Date       | Author         | Notes                                                                 |
| ------- | ---------- | -------------- | --------------------------------------------------------------------- |
| 1.1     | 2025‑06‑14 | Per Swedenborg | Converted to A2A capability model; added MCP ctx, gRPC contract v1.1. |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft.                                          |

