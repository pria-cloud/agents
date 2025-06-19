# API2 — South‑Bound (Internal) API Contract

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Define the *internal* gRPC and event interfaces that connect PRIA’s micro‑services: Cortex Orchestrator, Worker Pool, Python Agent Mesh, and supporting system services (Test‑Harness, Fine‑Tune jobs).  This spec ensures consistent message schemas, back‑pressure, observability, and backward compatibility across internal deployments, while remaining invisible to third‑party clients covered by API1.

---

## Table of Contents

1. Design Principles & Versioning Strategy
2. Transport, Authentication & Observability
3. Core gRPC Services
   - 3.1 `CortexOrchestrator`
   - 3.2 `WorkerService`
   - 3.3 `AgentService`
   - 3.4 `HarnessService`
4. Common Protobuf Types & Conventions
5. Event Topics (pgmq & LISTEN/NOTIFY)
6. Error Semantics & Retries
7. Message Ordering, Idempotency & Deduplication
8. Circuit‑Breaking & Flow Control
9. Compatibility Guarantees & Deprecation Policy
10. Testing, Mocking & Contract Validation
11. Metrics & Tracing
12. Future Extensions & Roadmap

---

## 1  Design Principles & Versioning Strategy

- **Binary‑efficient:** gRPC/Protobuf chosen for low‑latency internal hops.
- **mTLS everywhere:** Certificates issued by Fly.io’s cert‑manager; CN = service account.
- **SemVer in Protobuf:** Package version suffix (`v1`). Minor/patch additions must be backward‑compatible (field adds with new tag numbers).
- **One transport, many languages:** Go (Orchestrator), Rust (Worker), Python (Agent) share the same `.proto` files generated via `buf.build` workflow.

## 2  Transport, Authentication & Observability

| Layer         | Implementation                             | Notes                                                  |
| ------------- | ------------------------------------------ | ------------------------------------------------------ |
| **Transport** | HTTP/2 (gRPC) over ALPN h2c                | Internal private WireGuard network (Fly.io).           |
| **Auth**      | mTLS (cert‑manager)                        | Client cert CN = `service:<name>`; Role in SPIFFE URI. |
| **Tracing**   | OpenTelemetry gRPC interceptors            | TraceID propagated via gRPC metadata.                  |
| **Metrics**   | Prometheus gRPC server/client interceptors | Export histogram `rpc_duration_seconds`.               |

---

## 3  Core gRPC Services

### 3.1  `CortexOrchestrator` (Go)

```proto
service CortexOrchestrator {
  // Start a new workflow run.
  rpc StartWorkflow (StartRequest) returns (StartResponse);

  // Stream step execution requests to workers.
  rpc StreamTasks (stream TaskLease) returns (stream TaskAck);
}

message StartRequest {
  string workspace_id = 1;
  string workflow_id  = 2;
  string run_id       = 3; // UUID v7 – idempotency key
  google.protobuf.Struct context = 4;
}

message StartResponse {
  string run_id = 1;
  string status = 2; // PENDING
}
```

*Back‑pressure:* Orchestrator only leases tasks if queue depth for worker pool < `lease_window`.

### 3.2  `WorkerService` (Rust)

```proto
service WorkerService {
  // Execute a single step and return result / error.
  rpc Execute (StepRequest) returns (StepResult);
}

message StepRequest {
  string task_id      = 1;
  StepSpec step       = 2;
  google.protobuf.Any payload = 3; // marshalled params
}

message StepResult {
  string task_id   = 1;
  oneof result {
    google.protobuf.Any ok = 2;
    ErrorDetail error      = 3;
  }
  int64 latency_ms = 4;
}
```

*Deadline:* Client sets gRPC deadline = step timeout + 1 s buffer; Worker must respect.

### 3.3  `AgentService` (Python)

```proto
service AgentService {
  rpc CallLLM (LLMRequest) returns (LLMResponse);
  rpc FineTune (FineTuneRequest) returns (FineTuneStatus);
}

message LLMRequest {
  string prompt_id   = 1;
  repeated string variables = 2;
  string model_name  = 3;
  string schema_id   = 4; // JSON schema for validation
}

message LLMResponse {
  string json_output = 1;
  float  prompt_cost_usd = 2;
  float  latency_ms      = 3;
}
```

*Schema validation:* Agent validates `json_output` against `schema_id`; returns gRPC `INVALID_ARGUMENT` if fail.

### 3.4  `HarnessService` (Go)

Reuse definition from W3 but expose **internal** streaming logs channel.

---

## 4  Common Protobuf Types & Conventions

- All times are `google.protobuf.Timestamp` UTC.
- Monetary values use `google.type.Money` where precision needed.
- Repeated fields encoded as `packed = true` when numeric.

---

## 5  Event Topics (pgmq & LISTEN/NOTIFY)

| Topic / Queue        | Protocol | Producer          | Consumer         | Payload Str         | Notes                                  |
| -------------------- | -------- | ----------------- | ---------------- | ------------------- | -------------------------------------- |
| `start_workflow`     | pgmq     | Front‑end Edge Fn | Orchestrator     | `StartRequest` JSON | Back‑pressure enforced via pgmq depth. |
| `workflow_events`    | LISTEN   | Orchestrator      | Observability Fn | compact JSON        | Feeds Grafana, learning loop.          |
| `fine_tune_complete` | LISTEN   | AgentService      | DevOps channel   | run stats           | Triggers model promotion.              |

---

## 6  Error Semantics & Retries

| gRPC Code           | Meaning                            | Worker Retry?      | Orchestrator Action                           |
| ------------------- | ---------------------------------- | ------------------ | --------------------------------------------- |
| `OK`                | Success                            | —                  | Proceed onSuccess edge.                       |
| `INVALID_ARGUMENT`  | Validation error (caller bug)      | No                 | Fail path if defined else terminate run.      |
| `DEADLINE_EXCEEDED` | Step exceeded timeout              | Auto               | Increment retry count; if > retry.max → fail. |
| `UNAVAILABLE`       | Worker crashed / network partition | Auto (exponential) | Re‑queue task for another worker.             |
| `INTERNAL`          | Unexpected exception               | Auto once          | After second fail mark run error.             |

---

## 7  Message Ordering, Idempotency & Deduplication

- Orchestrator stores `(task_id, run_id)` PK in `workflow_tasks`. Duplicate lease attempts result in `UNIQUE_VIOLATION` ignored.
- `run_id` is UUID v7 incorporating timestamp to aid ordering.
- Workers verify idempotency key; if duplicate `Execute` received, return cached `StepResult`.

## 8  Circuit‑Breaking & Flow Control

- Workers expose `/healthz` (HTTP) returning 200 and queue size.
- Orchestrator drops connections > 50 % error rate with 1 min cooldown.
- AgentService has token‑bucket (100 req/s per pod) enforced via Envoy sidecar.

## 9  Compatibility Guarantees & Deprecation Policy

- **Minor fields** may be added; clients must ignore unknown fields.
- **Breaking changes** require new package `pria.api.v2` and version bump in `.proto` filename.
- Deprecation window ≥ 6 months with telemetry on field usage.

## 10  Testing, Mocking & Contract Validation

- **buf‑breaking** CI task enforces no wire‑incompatible changes.
- **grpcurl** smoke tests validate service health.
- **Hoverfly** runs snapshot‑replay for integration tests; mocks AgentService for deterministic CI.

## 11  Metrics & Tracing

| Metric                            | Type  | Threshold / Alert                       |
| --------------------------------- | ----- | --------------------------------------- |
| `grpc_server_handled_total{code}` | cnt   | Alert if `INTERNAL` > 0.1 %             |
| `rpc_duration_seconds_bucket`     | hist  | p95 < 300 ms Orchestrator; 500 ms Agent |
| `task_leases_inflight`            | gauge | Alert if > queue size × 2               |
| `model_inference_cost_usd_total`  | cnt   | Budget variance alert                   |
| Trace sampling rate               | —     | 1 % (Prod); 100 % (Dev)                 |

## 12  Future Extensions & Roadmap

- Add **Reactive Streams** (gRPC streaming) for long‑running AI calls (v1.1).
- Support **bidirectional health probes** w/ gRPC HealthCheck API.
- Integrate **NATS JetStream** as alternative to pgmq when queue throughput > 1 000 tasks/s.

---

**Revision History**

| Version | Date       | Author         | Notes                                          |
| ------- | ---------- | -------------- | ---------------------------------------------- |
| 0.1     | 2025-06-12 | Per Swedenborg | Initial comprehensive draft of South‑Bound API |

