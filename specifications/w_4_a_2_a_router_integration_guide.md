# W4 — A2A Router Integration Guide

**Document status:** Draft v0.1 · June 2025\
**Owner:** Platform Architect Guild (lead contact: Per Swedenborg)

**Purpose:** Collect everything an engineer (or autonomous agent) needs to plug **Google A2A** Agent‑to‑Agent messaging and the **Multi‑Agent Conversation Protocol (MCP)** into any new or existing PRIA micro‑service.  While A1 describes *where* the A2A Router sits, this guide drills into *how* services authenticate, publish intents, subscribe to callbacks, and propagate MCP context end‑to‑end.

---

## Table of Contents

1. Scope & Success Criteria
2. Interaction Diagram & Sequence
3. A2A Router gRPC API Reference
4. MCP Context Object Schema
5. Authentication & JWT Scope Requirements
6. Error‑Handling & Retry Semantics
7. SDK Usage Examples (Go, Python, TypeScript)
8. Observability & Metrics
9. Security & Compliance Notes
10. Open Items & Roadmap
11. Revision History

---

## 1  Scope & Success Criteria

| Objective                            | KPI / Evidence                                |
| ------------------------------------ | --------------------------------------------- |
| **Inter‑Agent Compatibility**        | 100 % pass rate on Google A2A conformance set |
| **Latency Budget** (Router overhead) | p95 < 25 ms (same‑DC)                         |
| **Fault Isolation**                  | No single intent drop > 0.1 %                 |
| **MCP Context Integrity**            | SHA‑256 checksum stable across hops           |

The guide applies to: Cortex Orchestrator, Worker Pool, Agent Mesh services (Schema Synthesiser, Composer, UI Builder), extensions, and any third‑party agents registered via Marketplace.

## 2  Interaction Diagram & Sequence

```
Service A ──┐                                             ┌─▶ Service C
            │ 1  POST IntentMessage (gRPC)               │
            ▼                                             │
        A2A Router ──┐                                    │
            │ 2  Persist + validate JWT scopes           │
            │ 3  Enrich MCP context (trace‑id, ttl)      │
            └─▶ gRPC stream to subscribed Service B       │
                                                4  Service B republishes intent …
```

*Figure 2‑1 · Happy path with two hops; MCP context persisted at each hop.*

## 3  A2A Router gRPC API Reference (excerpt)

```proto
service A2ARouter {
  rpc PublishIntent(IntentMessage) returns (Ack);
  rpc StreamIntents(Subscription) returns (stream IntentMessage);
  rpc HealthCheck(Ping) returns (Pong);
}
```

Full `.proto` lives in `proto/a2a/v1/a2a.proto`.

## 4  MCP Context Object Schema

```jsonc
{
  "trace_id": "UUIDv4",
  "ttl_ms": 300000,
  "handoff_count": 2,
  "tags": {"workspace_id": "…", "priority": "high"},
  "checksum": "SHA‑256(payload)"
}
```

## 5  Authentication & JWT Scope Requirements

| Action        | Required Scope                | Notes                                   |
| ------------- | ----------------------------- | --------------------------------------- |
| PublishIntent | `a2a:route_intent`            | Caller’s JWT must include workspace\_id |
| StreamIntents | `can_handle:<intent>` matcher | Issued to agents registered in A3       |
| HealthCheck   | None (public)                 | Liveness only; no data exposure         |

## 6  Error‑Handling & Retry Semantics

| Error Code            | Scenario                         | Recommended Client Action             |
| --------------------- | -------------------------------- | ------------------------------------- |
| `UNAUTHENTICATED`     | Missing / expired JWT            | Refresh token                         |
| `PERMISSION_DENIED`   | Scope lacks `a2a:route_intent`   | Do not retry                          |
| `FAILED_PRECONDITION` | TTL expired or checksum mismatch | Fix payload, retry                    |
| `UNAVAILABLE`         | Router overload                  | Exponential back‑off (max 3 attempts) |

## 7  SDK Usage Examples

### 7.1  Go (Cortex Orchestrator)

```go
client.PublishIntent(ctx, &a2a.IntentMessage{
  IntentName: "workflow.start",
  Payload:    anypb.New(&v1.StartWorkflow{Id: runID}),
})
```

### 7.2  Python (Agent Mesh)

```python
router = A2ARouterClient(os.environ["A2A_ENDPOINT"], jwt=token)
async for msg in router.stream_intents(["schema.synthesise"]):
    await handler.handle(msg)
```

### 7.3  TypeScript (Next.js Edge Function)

```ts
await publishIntent("expense.categorise", { expenseId });
```

## 8  Observability & Metrics

| Metric                        | Type    | Alert Threshold |
| ----------------------------- | ------- | --------------- |
| `a2a_intent_request_total`    | counter | —               |
| `a2a_intent_latency_ms`       | hist    | p95 > 50 ms     |
| `a2a_router_error_total`      | counter | > 5 / min       |
| `mcp_checksum_mismatch_total` | counter | any → P1        |

## 9  Security & Compliance Notes

- All intents logged to `intent_log` (D1 §4.3) with MCP context.
- Router validates JWT signature and scopes; no anonymous publish allowed.
- OTEL trace attributes include `workspace_id` but **never** payload PII.

## 10  Open Items & Roadmap

- Implement **batch publish** endpoint to reduce chattiness.
- Add **schema‑driven intent validation** via JSON Schema registry.
- Evaluate **WebTransport** as alternative to gRPC stream for browser agents.

## 11  Revision History

| Version | Date       | Author                | Notes                            |
| ------- | ---------- | --------------------- | -------------------------------- |
| 0.1     | 2025‑06‑14 | Platform Architect WG | Initial draft, extracted from A1 |

