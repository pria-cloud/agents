# O1 — Observability & Telemetry Specification

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Define the end‑to‑end observability architecture—metrics, logs, traces, dashboards, SLOs, and alerting—that allows PRIA engineers to detect, triage, and resolve issues in minutes.  This specification standardises OpenTelemetry usage across all services, prescribes Grafana Cloud conventions, and links directly to compliance requirements in S1.

---

## Table of Contents

1. Scope & Objectives
2. Instrumentation Strategy (Metrics, Logs, Traces)
3. Metrics Catalogue & Naming Conventions
4. Logging Pipeline & Retention
5. Distributed Tracing Configuration
6. Dashboards, SLOs & Alert Policies
7. Implementation Guide (Code Snippets & Terraform)
8. LLM Prompt Blocks
9. Operational Runbook
10. Future Enhancements & Roadmap

---

## 1  Scope & Objectives

1. Establish a *single* OpenTelemetry pipeline feeding **Prometheus, Loki, Tempo** in Grafana Cloud.
2. Define mandatory metrics, log labels, and trace attributes for all micro‑services.
3. Provide SLO targets (latency, error ratio, task backlog) and corresponding alert thresholds.
4. Deliver reusable Terraform and YAML snippets to bootstrap exporters, dashboards, and alert rules.
5. Supply LLM prompt templates that auto‑generate instrumentation scaffolding for new services.

## 2  Instrumentation Strategy

| Signal      | Library / Agent                       | Export Path                    | Cardinality Guard‑Rail             |
| ----------- | ------------------------------------- | ------------------------------ | ---------------------------------- |
| **Metrics** | OTEL SDK (Go, Rust, Python)           | OTLP → Prometheus Remote Write | ≤ 10 label permutations per metric |
| **Logs**    | OTEL log SDK / Winston (Next.js)      | OTLP → Loki (Grafana Cloud)    | 30‑day retention, 1 GB/day quota   |
| **Traces**  | OTEL SDK + auto‑instr (http/grpc/sql) | OTLP → Tempo (Grafana Cloud)   | 1 % sampling prod, 100 % dev       |

> **Sampling Rule:** Tail‑sampling keeps 100 % of spans with status != `OK` or latency > 1 000 ms.

## 3  Metrics Catalogue & Naming Conventions

### 3.1  Global Conventions

- snake_case metric names: `<service>_<resource>_<unit>`  (e.g., `orchestrator_task_backlog`).
- `workspace_id` label *only* on tenant‑level metrics (never high‑cardinality random IDs).
- Histogram buckets follow SRE defaults (0.01 → 10 s).

### 3.2  Core Metrics Table (excerpt)

| Service          | Metric Name                  | Type    | Labels                | SLO / Alert                              |
| ---------------- | ---------------------------- | ------- | --------------------- | ---------------------------------------- |
| **Orchestrator** | `orchestrator_task_backlog`  | gauge   | `tier`                | Alert if > 200 (Pilot); > 1 000 (Growth) |
|                  | `workflow_latency_ms`        | hist    | `workflow_id`, `tier` | p95 < 2 000 ms Pilot                     |
| **Worker**       | `worker_execute_duration_ms` | hist    | `step_type`           | p95 < 1 500 ms                           |
| **Agent**        | `agent_inference_cost_usd`   | counter | `model`               | Budget alert if ↑ 20 % week‑over‑week    |
|                  | `agent_best_practice_enforced_total` | counter | `agent_name` | Count of best-practice catalogue enforcement actions |
|                  | `agent_compliance_validation_total` | counter | `agent_name` | Count of compliance validation checks |
|                  | `agent_sub_intent_hand_off_total` | counter | `agent_name`, `intent` | Count of sub-intent hand-offs |
| **Supabase**     | `db_cpu_percent`             | gauge   | `instance`            | Alert > 75 % for 10 min                  |

Full catalogue lives in `otel/metrics_catalogue.yaml`.

**All agent actions, sub-intents, and compliance checks must be traceable and logged.**

## 4  Logging Pipeline & Retention

1. **Edge (Vercel)** → Vercel log drains → Loki via Promtail Lambda.
2. **Supabase** → `pgAudit` logs shipped through `fluent‑bit` container sidecar.
3. **Fly.io apps** → Docker stdout → vector → OTLP logs → Loki.
4. **Log Labels:** `service`, `level`, `workspace_id` (if available), `request_id`.

**Retention Policy:**

- 30 days for application logs (default).
- 90 days for security/audit logs (`source=audit`).
- 7 days for high‑volume debug logs (`level=debug`).

## 5  Distributed Tracing Configuration

- **Propagation:** W3C TraceContext (`traceparent`, `tracestate`).
- **Baggage:** `workspace_id`, `run_id`, `step_id`.
- **Root Span Naming:** `<service> <rpc.method>` (e.g., `orchestrator StartWorkflow`).
- **Linking:** Worker spans link back to Orchestrator TaskLease span via `span_id`.

## 6  Dashboards, SLOs & Alert Policies

### 6.1  Dashboards

| Dashboard ID         | Panels                                         | Audience |
| -------------------- | ---------------------------------------------- | -------- |
| `saas_exec_overview` | MRR vs error heat‑map; top 5 latency offenders | CEO, PM  |
| `workflow_health`    | Task backlog, fail ratio, latency hist         | DevOps   |
| `db_perf`            | CPU, WAL lag, slow query list                  | DBA      |
| `cost_guardrails`    | Inference cost, Fly spend, Supabase credits    | Finance  |

### 6.2  Service‑Level Objectives

| SLO ID                  | Description                      | Target   | Alerting Window | Threshold |
| ----------------------- | -------------------------------- | -------- | --------------- | --------- |
| `workflow_latency`      | p95 run latency (Pilot tier)     | ≤ 2 s    | 5 min / hour    | 5 %       |
| `workflow_availability` | Successful runs / total runs     | ≥ 99.5 % | 1 h / 24 h      | 1 % abs   |
| `api_error_ratio`       | 5xx responses / total REST calls | ≤ 0.5 %  | 5 min / hour    | 0.2 %     |

### 6.3  Alert Routing

- **Critical (P1)** → PagerDuty; auto‑create Jira Sev‑1.
- **Warning (P2)** → Slack `#alerts`; auto‑create Jira Sev‑2 if persists > 15 min.
- **Info (P3)** → Grafana Annotated event only.

## 7  Implementation Guide

### 7.1  Service‑Side Code Snippet (Go)

```go
// go.opentelemetry.io/otel/sdk
otelExporter := otelgrpc.NewExporter("tempo.pria.cloud:4318")
resource := resource.NewWithAttributes(
  semconv.ServiceNameKey.String("orchestrator"),
  attribute.String("tier", os.Getenv("TIER")),
)
tracerProvider := sdktrace.NewTracerProvider(
  sdktrace.WithBatcher(otelExporter),
  sdktrace.WithResource(resource),
)
otel.SetTracerProvider(tracerProvider)
```

### 7.2  Terraform Snippet – Grafana Alert Rule

```hcl
resource "grafana_cloud_alert_rule" "api_error_ratio" {
  uid         = "api-error-ratio"
  name        = "API Error Ratio > 0.5 %"
  data_source = grafana_cloud_prometheus.main.id
  condition {
    expr  = "sum(rate(api_error_total{code=~\"5..\"}[5m])) / sum(rate(api_request_total[5m])) > 0.005"
    relative_time_range = 5m
  }
  annotations = {
    runbook = "https://runbooks.pria.cloud/api-error"
  }
  labels = {
    severity = "critical"
  }
}
```

## 8  LLM Prompt Blocks

### 8.1  Prompt Block O1‑METRIC‑GEN

```
System: Generate OpenTelemetry metric code for service {{service}} with name {{metric}}, unit {{unit}}, description {{desc}}, labels {{labels}}. Use language {{lang}}.
```

### 8.2  Prompt Block O1‑DASHBOARD‑GEN

```
System: Produce Grafana dashboard JSON with panels for metrics {{metric_list}} and template variable workspace_id.
```

## 9  Operational Runbook

1. **Alert fires** – On‑call reviews Grafana; correlate trace exemplars; identify high‑latency step.
2. **Log spike** – Check Loki label `level=error`; inspect recent deploy tag; roll back if necessary.
3. **Tempo sampling drift** – Verify OTEL config map; restart pods with new sampling ratio.
4. **Grafana quota breach** – Increase plan or trim log verbosity; escalate to Finance.

## 10  Future Enhancements & Roadmap

- Migrate to **OpenTelemetry Collector 0.100** with WASM filter for PII redaction.
- Auto‑generate **Grafana OnCall** rotas linked to PagerDuty schedules.
- Evaluate **Parca** for continuous profiling in GPU clusters.

---

**Revision History**

| Version | Date       | Author         | Notes                        |
| ------- | ---------- | -------------- | ---------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft. |

