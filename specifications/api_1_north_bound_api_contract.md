# API1 — North‑Bound API Contract

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Specify the external (“north‑bound”) API surface that third‑party clients, extensions, and customer integrations use to interact with PRIA.  This includes REST/GraphQL endpoints, rate limits, authentication headers, pagination, error semantics, and OpenAPI/GraphQL schemas.  Internal Cortex and Agent APIs are covered in separate specs (W2, W3).

---

## 1  Scope & Objectives

1. Define **REST** resources for Wave 1 modules (Expense, GL, Workflow).
2. Provide **GraphQL** schema that mirrors REST but supports flexible joins.
3. Detail authentication (JWT Bearer) and fine‑grained **scope** requirements (see A3).
4. Establish pagination, filtering, sorting, and idempotency patterns.
5. Describe rate‑limit strategy and error‑response model.
6. Supply machine‑readable **OpenAPI 3.1** and **GraphQL SDL** files plus code‑gen hints.

## 2  Base URL & Versioning

```
Production   https://api.pria.cloud/v1/
Sandbox      https://sandbox.pria.cloud/v1/
GraphQL      POST https://api.pria.cloud/v1/graphql
```

*Versioning* – Semantic path version (`/v1/`); breaking changes bump major.

## 3  Authentication & Headers

| Header               | Required | Example                  | Notes                                         |
| -------------------- | -------- | ------------------------ | --------------------------------------------- |
| `Authorization`      | ✔        | `Bearer eyJ…`            | Supabase JWT (see A3).                        |
| `X‑PRIA‑Idempotency` | PUT/POST | `6f54e0cb‑invoice‑12345` | SHA‑256 keyed to user action; retries safe.   |
| `X‑PRIA‑Workspace`   | Optional | `dc9e…41ba`              | Overrides workspace (Admin only).             |
| `Content‑Type`       | ✔        | `application/json`       | All endpoints accept JSON; GraphQL uses JSON. |
| `Accept`             | Optional | `application/json`       | or `text/csv` for bulk export.                |

## 4  REST Resources (summary)

| Path                      | Verb  | Scope(s)              | Description                                   |
| ------------------------- | ----- | --------------------- | --------------------------------------------- |
| `/expense`                | GET   | `expense:read`        | List expenses (RLS enforced).                 |
| `/expense`                | POST  | `expense:write`       | Create expense.                               |
| `/expense/{id}`           | PATCH | `expense:write`       | Update own expense (self) or any (Finance).   |
| `/workflow`               | GET   | `workflow:read`       | List workflows.                               |
| `/workflow`               | POST  | `workflow:publish`    | Publish new workflow (Harness pass required). |
| `/gl/journal`             | POST  | `gl:post`             | Post journal entry.                           |
| `/logs`                   | GET   | `log:read`            | Stream Loki query (server‑sent events).       |
| `/marketplace/extensions` | POST  | `marketplace:install` | Install extension.                            |
| `/marketplace/sandbox`    | POST  | `marketplace:dev`     | Upload dev extension for testing.             |

*(Full path list in OpenAPI file.)*

## 5  GraphQL Schema (SDL excerpt)

```graphql
schema {
  query: Query
  mutation: Mutation
}

type Query {
  expenses(filter: ExpenseFilter!, limit: Int = 50, after: String): ExpenseConnection!
  workflows(filter: WorkflowFilter, limit: Int = 20): [Workflow!]!
}

type Mutation {
  createExpense(input: ExpenseInput!): Expense!
  updateExpense(id: ID!, patch: ExpensePatch!): Expense!
  publishWorkflow(input: WorkflowInput!): Workflow!
}

type Expense {
  id: ID!
  employeeId: ID!
  amount: Float!
  currency: String!
  status: ExpenseStatus!
  createdAt: DateTime!
}
```

*Relay‑style pagination* via `Connection` pattern.

## 6  Filtering, Sorting & Pagination

- **Paging:** Limit ≤ 250; cursor‐based (`after`).
- **Filter operators:** `eq`, `neq`, `gt`, `lt`, `in`, `like`.  Example:

```
GET /expense?filter=status:eq:submitted,amount:gt:100
```

- **Sorting:** `sort=-createdAt,amount` (- for DESC).

## 7  OpenAPI 3.1 Document

*File:* `openapi/pria.v1.yaml`\
Generated via **Prompt Block API1‑OPENAPI‑GEN** and validated by `spectral lint` in CI.  Clients may code‑gen using `openapi‑generator‑cli` (`typescript‑axios`, `python‑aiohttp`).

> **Prompt Block API1‑OPENAPI‑GEN**\
> *System:* “Given REST table and schema {{json}}, output OpenAPI 3.1 YAML with security scheme bearerAuth.”

## 8  Error Model

```jsonc
{
  "error": {
    "code": "validation_error",
    "message": "amount must be > 0",
    "details": [
      {"field":"amount","msg":"expected positive"}
    ],
    "requestId": "req_b21e498…"
  }
}
```

| Code               | HTTP | Meaning                               |
| ------------------ | ---- | ------------------------------------- |
| `invalid_token`    | 401  | JWT expired / bad signature           |
| `forbidden_scope`  | 403  | Missing required scope                |
| `not_found`        | 404  | Resource not in workspace             |
| `validation_error` | 422  | JSON body fails schema                |
| `rate_limited`     | 429  | Exceeded per‑workspace quota          |
| `conflict`         | 409  | Idempotency key reused with diff body |
| `internal_error`   | 500  | Unhandled exception                   |

## 9  Rate‑Limiting & Quotas

| Tier       | Limit                | Burst | Headers Returned                       |
| ---------- | -------------------- | ----- | -------------------------------------- |
| Pilot      | 60 req/min/workspace | 30    | `X‑RateLimit‑Remaining`, `Retry‑After` |
| Growth     | 300 req/min          | 100   | same                                   |
| Enterprise | 1200 req/min         | 300   | same                                   |

- Limits enforced at **Vercel Edge** via middleware; secondary quota in Supabase rate‑limiter.
- GraphQL shares pool with REST.

## 10  Idempotency Guidelines

`X‑PRIA‑Idempotency` header required for any **POST/PUT/PATCH** creating or mutating state. Same key returns 201 Created on first call, 409 Conflict on body mismatch, 200 OK on retry with same body.

## 11  SDKs & Code Generation

| Language   | Package                        | Build Process                               | Release Cycle                   |
| ---------- | ------------------------------ | ------------------------------------------- | ------------------------------- |
| TypeScript | `@pria/sdk`                    | `openapi-generator-cli ‑g typescript-axios` | Automatic on each OpenAPI merge |
| Python     | `pria_sdk`                     | `openapi-generator-cli ‑g python-aiohttp`   | Automatic                       |
| Go         | `github.com/pria-cloud/sdk-go` | `oapi-codegen`                              | Manual tag                      |

## 12  Testing & Validation

- **Contract Tests** – Postman/Newman runs for every deployment; collection stored in repo.
- **Fuzz Tests** – Schemathesis fuzzes OpenAPI; fails CI if panic or 500 with malformed body.
- **Smoke Tests** – `make smoke` inserts expense, retrieves list, asserts 200.

## 13  Observability & Metrics

| Metric                    | Type  | Threshold / Alert                       |
| ------------------------- | ----- | --------------------------------------- |
| `api_request_total`       | cnt   | —                                       |
| `api_request_duration_ms` | hist  | p95 < 300 ms (REST), < 500 ms (GraphQL) |
| `api_rate_limited_total`  | cnt   | Alert if > 1 % requests                 |
| `api_error_ratio`         | ratio | Alert if > 0.5 % (5xx)                  |

## 14  Security Considerations

- All endpoints require JWT; guest access not supported.
- CORS restricted to configured origins per workspace.
- Payloads validated with `pydantic‑v2` models; explicit 4 MB body limit.
- API keys for server‑to‑server flows—scoped, rotatable, tied to role `Developer`.

## 15  Open Items / Future Enhancements

- Webhook signatures in HTTP / REST table (planned v1.1).
- GraphQL subscription endpoint for realtime streams (post GA).
- Bulk ingest endpoints (`/expense/import`) with CSV → staged table pattern.

---

**Revision History**

| Version | Date       | Author         | Notes                       |
| ------- | ---------- | -------------- | --------------------------- |
| 0.1     | 2025-06-12 | Per Swedenborg | Initial comprehensive draft |

