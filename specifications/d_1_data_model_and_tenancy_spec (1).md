# D1 — Data‑Model & Tenancy Specification

**Document status:** Final v1.1 · June 2025\
**Owner:** CEO (Per Swedenborg)

**Purpose:** Define PRIA's canonical relational schema, tenant-isolation rules, and extension mechanisms—updated for the fully **A2A-native** architecture.  This spec now includes the `` and `` tables required by the Google A2A Gateway and MCP.  All legacy agent-token tables have been removed.

---

## Table of Contents

1. Scope & Objectives
2. Glossary
3. Naming & Datatype Conventions
4. Core ER‑Diagram
5. Row‑Level Security Catalogue
6. Partitioning & Index Strategy
7. Extension Columns & Tables
8. Migration & Rollback Process
9. Performance & Sizing Targets
10. Testing Strategy
11. Revision History

---

## 1  Scope & Objectives

1. Enumerate all *shared* base tables required for Wave 1 modules (GL, Expense, A2A).
2. Introduce `agent_registry` and `intent_log` to support A2A capability routing & audit.
3. Maintain tenant isolation via `workspace_id` RLS predicates and column masking.
4. Provide extension workflow for customer-added tables/columns.
5. Supply reference pgTAP tests executed in CI.

## 2  Glossary

| Term               | Meaning                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Workspace**      | Tenant boundary. `workspace_id` UUID primary key.                                   |
| **RLS**            | Postgres Row-Level Security enforcing tenant isolation.                             |
| **Capability**     | String `can_handle:<intent>` registered by an agent.                                |
| **MCP Token**      | Opaque JSONB context propagated across agents; stored in `intent_log` for audit.    |
| **Schema Version** | SHA-256 checksum of ordered DDL run for a workspace, recorded in `schema_versions`. |

## 3  Naming & Datatype Conventions

| Element   | Convention                                              | Example                       |
| --------- | ------------------------------------------------------- | ----------------------------- |
| Table     | snake_case singular                                    | `expense`, `agent_registry`   |
| PK        | `id UUID DEFAULT gen_random_uuid()`                     | `expense.id`                  |
| Tenant FK | `workspace_id UUID NOT NULL`                            | present in every shared table |
| Audit     | `created_at TIMESTAMPTZ DEFAULT now()` and `updated_at` |                               |
| JSON      | `JSONB`                                                 | `intent_log.mcp_json`         |
| Monetary  | `NUMERIC(18,2)`                                         | `expense.amount`              |

## 4  Core ER‑Diagram *(textual)*

```
workspace (1)───<  user
workspace (1)───<  role_assignment
workspace (1)───<  expense  >──(N) currency_rate
workspace (1)───<  workflow_def  >(1)──—<  workflow_event
workspace (1)───<  agent_registry >──(N) intent_log
```

**All agent hand-offs and sub-intents must be logged in the `intent_log` table for auditability.**

### 4.1  Workspace

```sql
CREATE TABLE workspace (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    industry   TEXT,
    tier       TEXT CHECK (tier IN ('pilot','growth','enterprise')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: `id = jwt.workspace_id`.

### 4.2  Agent Registry *(new)*

Registers every autonomous agent capable of receiving A2A intents.

```sql
CREATE TABLE agent_registry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspace(id),
    agent_name     TEXT NOT NULL,
    endpoint_url   TEXT NOT NULL,
    capabilities   TEXT[] NOT NULL,         -- e.g. {'can_handle:expense.categorise'}
    supports_mcp   BOOLEAN DEFAULT FALSE,
    public_key_pem TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);
```

RLS identical to other workspace tables.

### 4.3  Intent Log *(new)*

Audit every IntentMessage and MCP hand-off. **All sub-intents and agent-to-agent messages must be recorded here.**

```sql
CREATE TABLE intent_log (
    id             BIGSERIAL PRIMARY KEY,
    workspace_id   UUID NOT NULL REFERENCES workspace(id),
    intent_name    TEXT NOT NULL,
    source_agent   UUID REFERENCES agent_registry(id),
    target_agent   UUID REFERENCES agent_registry(id),
    mcp_json       JSONB NOT NULL,
    status         TEXT CHECK (status IN ('routed','completed','error')),
    latency_ms     INTEGER,
    data_class     TEXT NOT NULL, -- Tag with data-class (A4)
    created_at     TIMESTAMPTZ DEFAULT now()
);
```

Indexes: `(workspace_id, intent_name)`, `(target_agent, status)`.

**All artefacts and generated code must be tagged with their data-class (see A4).**

### 4.4  Existing Tables

`app_user`, `role_assignment`, `expense`, `workflow_def`, `workflow_event` unchanged except:

- `workflow_event` gains column `mcp_handoff_count INTEGER DEFAULT 0` for latency analytics.

## 5  Row‑Level Security (RLS) Catalogue

| Table           | Predicate                         | Column Masks                                  |
| --------------- | --------------------------------- | --------------------------------------------- |
| workspace       | `id = jwt.workspace_id`           | —                                             |
| app_user        | `workspace_id = jwt.workspace_id` | mask `email` unless `user:read`.              |
| expense         | idem                              | mask `amount` unless `expense:read`.          |
| workflow_def    | idem                              | —                                             |
| workflow_event  | idem                              | —                                             |
| agent_registry  | idem                              | mask `endpoint_url` unless `admin`.           |
| intent_log      | idem                              | mask `mcp_json` unless `admin` or agent owner |

**All tables and queries must use `workspace_id` for tenant isolation and RLS enforcement.**

## 6  Partitioning & Index Strategy

| Table           | Partition Key  | Strategy      | When to Enable | Indexes                       |
| --------------- | -------------- | ------------- | -------------- | ----------------------------- |
| intent_log      | `workspace_id` | HASH 32 parts | ≥ 100 M rows   | local idx `(created_at DESC)` |
| workflow_event  | none           | —             | n/a            | `(workflow_id, occurred_at)`  |

## 7  Extension Columns & Tables

Unchanged from v1.0. Extension mechanism inherits `workspace_id` RLS and must not reference **Restricted (R)** columns without corresponding scopes.

## 8  Migration & Rollback Process

1. Migrations generated by Schema Synthesiser Agent now include `agent_registry.sql` and `intent_log.sql`.
2. CI pgTAP verifies new RLS predicates (`agent_registry`, `intent_log`).
3. Rollback script drops the two tables **only** if empty to avoid data loss.

## 9  Performance & Sizing Targets

| Metric                             | Pilot   | Growth  | Scale-Up |
| ---------------------------------- | ------- | ------- | -------- |
| p95 intent insert latency          | < 40 ms | < 45 ms | < 60 ms  |
| intent_log rows/day @ 500 tenants   | 200 k   | 1.2 M   | 5 M      |
| agent_registry look-up p95          | < 5 ms  | < 6 ms  | < 8 ms   |

## 10  Testing Strategy

- **pgTAP**: 100 % RLS coverage on new tables.
- **Hypothesis**: property tests ensuring `capabilities` array never empty.
- Load-test harness adds 200 IntentMessage inserts/sec sustained.

## 11  Revision History

| Version | Date       | Author         | Notes                                                                   |
| ------- | ---------- | -------------- | ----------------------------------------------------------------------- |
| 1.1     | 2025-06-14 | Per Swedenborg | Added `agent_registry`, `intent_log`, removed legacy agent auth tables. |
| 0.1     | 2025-06-12 | Per Swedenborg | Initial comprehensive draft.                                            |

