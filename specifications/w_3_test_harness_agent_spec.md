# W3 — Test‑Harness Agent Specification

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Describe the architecture, APIs, fixture‑generation strategy, and pass/fail semantics of the **Test‑Harness Agent**—the gatekeeper that validates every new or modified workflow before publish.  The harness executes generated fixtures against a sandbox clone of the tenant schema, measures branch coverage, and blocks promotion if any assertion fails.

---

## 1  Scope & Objectives

1. Provide a deterministic test framework for **Cortex Workflow DSL** (see W1) irrespective of AI or human author.
2. Guarantee ≥ 90 % branch coverage for all conditional paths (`branch` steps).
3. Validate SQL effects, RLS enforcement, AI step schema conformance, and compensation logic.
4. Output machine‑readable coverage and latency metrics to CI pipelines and Composer UI.
5. Fail fast—maximum harness runtime 60 s per workflow; abort on first critical error.

## 2  Interaction Flow

```
Composer Agent ──┐                       ▽
                 │ 1  Workspace + DSL JSON
                 ▼
          Test‑Harness Agent (Fly.io)
                 │ 2  Generate fixtures via Prompt chain
                 │ 3  Exec DSL in sandbox schema (__test_ws_...)
                 │ 4  Record events & assertions
                 ▼
        Coverage Report JSON  (to Composer & CI)
```

## 3  gRPC Service Definition

```proto
service Harness {
  rpc RunTests(HarnessRequest) returns (HarnessResponse);
}

message HarnessRequest {
  string workspace_id = 1;      // Tenant context
  string dsl_json     = 2;      // Candidate workflow
  string checksum     = 3;      // Must match DSL
  int32  max_fixtures = 4;      // default 100
}

message HarnessResponse {
  bool   success               = 1;
  string coverage_json         = 2; // Branch coverage per step
  string latency_json          = 3; // Step latency distribution
  string failure_reason        = 4; // Empty if success
  bytes  harness_logs_gzip     = 5; // Optional compressed log
}
```

### REST Facade *(Edge Function)*

`POST /harness/run` → same payload, JWT‑authenticated.

## 4  Fixture‑Generation Strategy

### 4.1  Prompt Chain

| Stage | Prompt ID          | Model       | Output                             |
| ----- | ------------------ | ----------- | ---------------------------------- |
| F1    | `W3‑ENUM‑BRANCHES` | gpt‑4o‑128k | List of branch paths (string list) |
| F2    | `W3‑GEN‑CONTEXT`   | gpt‑4o‑128k | Input context JSON per branch      |
| F3    | `W3‑CRITIC`        | gpt‑4o‑128k | Self‑review; ensure SQL validity   |

#### Prompt W3‑ENUM‑BRANCHES (excerpt)

```
System: Enumerate every unique branch path in the given DSL. Respond as JSON array of path strings.
DSL: {{dsl_json}}
```

#### Prompt W3‑GEN‑CONTEXT

```
System: For branch {{path}}, output a JSON object of input parameters that will drive the workflow down this path. Use realistic values. Ensure required foreign keys exist.
```

### 4.2  Context Injection

Fixtures are inserted into `workflow_context` table inside sandbox schema; Orchestrator reads context when executing the DAG.

## 5  Sandbox Execution Environment

1. **Clone tenant schema** → `create schema __test_ws_{{id}} like public;`
2. **Disable external side‑effects** by stubbing step types:
   - `http` → mocked; returns 200 JSON `{}`.
   - `ai` → runs model but records output without external calls.
3. **Run DAG** via Cortex Orchestrator in **transaction**—rolled back at end to leave DB clean.

## 6  Assertion Rules

| Aspect           | Assertion                                              | Severity |
| ---------------- | ------------------------------------------------------ | -------- |
| Branch coverage  | ≥ 90 % of `branch` permutations executed               | Fail     |
| RLS isolation    | No rows leaked across workspaces (`workspace_id` diff) | Fail     |
| SQL side‑effects | Row counts match expected diffs (defined per fixture)  | Fail     |
| AI schema        | Output validates against JSON Schema                   | Fail     |
| Latency          | p95 latency per step < 1 500 ms                        | Warn     |

## 7  Report Schema (coverage\_json)

```jsonc
{
  "total_branches": 12,
  "covered_branches": 11,
  "coverage_pct": 91.7,
  "uncovered": ["fraud‑score->branch‑reject"]
}
```

Latency JSON mirrors Prometheus histogram format.

## 8  Prometheus Metrics

| Metric                        | Type | Threshold / Alert         |
| ----------------------------- | ---- | ------------------------- |
| `harness_runs_total`          | cnt  | —                         |
| `harness_fail_total`          | cnt  | alert if > 1 per workflow |
| `harness_duration_ms`         | hist | p95 < 15 000 ms           |
| `harness_branch_coverage_pct` | hist | alert if < 90             |
| `harness_rls_leak_total`      | cnt  | any triggers PagerDuty    |

## 9  Operational Runbook

1. **Harness failure** – Composer UI shows error; CI pipeline marks build red.  Investigate `failure_reason`, inspect logs.
2. **Coverage dip** – If branch coverage alert fires, Composer revises prompts or asks user for more input context.
3. **Latency alert** – Check Fly CPU usage; horizontal‑scale if saturation > 70 %.

## 10  Security & Compliance

- Sandbox database user has `USAGE` on test schema only; cannot touch prod rows.
- All fixtures and logs auto‑purged after 24 h via `pg_cron`.
- Harness uses Okta SSO; audit logs written to Loki.

## 11  Open Items / TBD

- Add chaos tests (network failure, DB lock) to measure DAG retry behaviour.
- Integrate differential privacy noise when using production data as fixture seed.
- Support fan‑in coverage metrics once W1 decides on multi‑parent edges.

---

**Revision History**

| Version | Date       | Author         | Notes                                  |
| ------- | ---------- | -------------- | -------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of Harness |

