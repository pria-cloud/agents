# A3 — Access‑Control & Role Catalogue

**Document status:** Final v1.1 · June 2025\
**Owner:** CEO (Per Swedenborg)

**Purpose:** Define PRIA's canonical roles, permission scopes, and JWT claim structure—ensuring every human user, service, and autonomous agent gets **least‑privilege** access to data and APIs.  All communication between services uses Google **A2A** messaging and **MCP** context propagation; therefore, every agent receives its capability set via JWT scopes rather than legacy internal tokens.

---

## Table of Contents

1. Principles & Scope
2. Role Catalogue
3. Permission Scope Reference
4. Role → Scope Mapping Matrix
5. JWT Claim Structure
6. RLS Policy Integration
7. On‑/Off‑boarding Workflow
8. Audit & Evidence Collection
9. Open Items / Future Enhancements
10. Revision History

---

## 1  Principles & Scope

1. **Least Privilege** – grant only the scopes needed for a job or capability.
2. **Single Source of Truth** – roles and scopes stored in Supabase `role_assignment` table (D1).
3. **Stateless Tokens** – access tokens are short‑lived JWTs signed by Supabase Auth.
4. **Agent‑Aware** – autonomous agents authenticate exactly like humans and services, using *capability scopes* (`can_handle:<intent>`).
5. Applies to: Next.js Front‑End, Edge Functions, Cortex Orchestrator, Worker Pool, Agent Mesh, A2A Gateway, and any third‑party extension.

## 2  Role Catalogue

| Role ID        | Audience | Typical User / Service | Description                                         |
| -------------- | -------- | ---------------------- | --------------------------------------------------- |
| `owner`        | Human    | Workspace founder      | Full control over workspace settings, billing, IAM. |
| `admin`        | Human    | IT admin, DevOps       | Manage users, secrets, quotas; no billing.          |
| `finance_mgr`  | Human    | Controller, CFO        | Approve expenses, close periods, view GL.           |
| `employee`     | Human    | All end‑users          | Submit expenses, view self‑service dashboards.      |
| `api_client`   | Service  | External integration   | Access via API keys limited to granted scopes.      |
| `orchestrator` | Service  | Cortex engine          | Execute DAG steps, publish intents.                 |
| `worker`       | Service  | Worker pool            | Run deterministic steps (`sql`, `http`, `script`).  |
| `agent`        | Service  | Any LLM or tool agent  | Handle specific intents via A2A.                    |
| `viewer`       | Human    | Auditors, read‑only    | No mutations, view data & logs.                     |

## 3  Permission Scope Reference

Scopes are additive, flat strings checked by API, Edge Functions, and Postgres RLS.  Syntax: `<resource>:<action>`; wildcard `*` allowed only for `owner`.

### 3.1  Core Scopes (excerpt)

| Scope             | Resource  | Action        | Notes                                                  |
| ----------------- | --------- | ------------- | ------------------------------------------------------ |
| `workspace:read`  | workspace | SELECT        | Required for most UI routes.                           |
| `workspace:write` | workspace | UPDATE        | Only `owner`, `admin`.                                 |
| `expense:read`    | expense   | SELECT        | `employee` accesses own rows via RLS predicate.        |
| `expense:write`   | expense   | INSERT/UPDATE | Submit or edit expense.                                |
| `gl:post`         | journal   | INSERT        | Close period batch job.                                |
| `schema:migrate`  | DDL       | EXECUTE       | Used only by Schema Synthesiser.                       |
| `rls:bypass`      | *         | ALL           | Service role token for migrations; never in human JWT. |
| `best_practice:enforce` | system | ENFORCE      | Required for agents enforcing best-practice catalogue. |
| `compliance:validate` | system | VALIDATE      | Required for compliance validation agents.             |
| `dlp:scan`        | system    | SCAN          | Required for DLP scanning agents.                      |

### 3.2  A2A / MCP Scopes

| Scope                 | Purpose                                                                    | Consumer                |
| --------------------- | -------------------------------------------------------------------------- | ----------------------- |
| `a2a:route_intent`    | Send IntentMessage to A2A Gateway.                                         | Front‑end, Orchestrator |
| `mcp:orchestrate`     | Manage MCP context & hand‑offs.                                            | A2A Gateway             |
| `can_handle:<intent>` | Capability to accept given intent (e.g., `can_handle:expense.categorise`). | Agents                  |

**Compliance and DLP agents may have `pii:unmask` only if required for their function. All agents must have the correct `can_handle:*` scopes for their registered capabilities.**

## 4  Role → Scope Mapping Matrix

| Role         | workspace:\* | expense:\*            | gl:\* | schema\:migrate | a2a\:route\_intent | mcp\:orchestrate | can\_handle:\*            |
| ------------ | ------------ | --------------------- | ----- | --------------- | ------------------ | ---------------- | ------------------------- |
| owner        | read,write   | read,write            | post  | —               | ✓                  | ✓                | —                         |
| admin        | read,write   | read,write            | —     | —               | ✓                  | ✓                | —                         |
| finance\_mgr | read         | read,write            | post  | —               | ✓                  | —                | —                         |
| employee     | read         | read,write (RLS self) | —     | —               | ✓                  | —                | —                         |
| api\_client  | Configurable | Configurable          | —     | —               | ✓                  | —                | —                         |
| orchestrator | read         | read                  | —     | —               | ✓                  | —                | —                         |
| worker       | read         | read,write            | —     | —               | —                  | —                | —                         |
| agent        | read (min)   | read                  | —     | —               | —                  | —                | `can_handle:*` (specific) |
| viewer       | read         | read                  | read  | —               | —                  | —                | —                         |

*Dashes indicate scope not granted. Wildcards only appear for capability scopes.*

## 5  JWT Claim Structure

```jsonc
{
  "sub": "uuid-user-or-service",
  "role": "employee",
  "workspace_id": "uuid-workspace",
  "scopes": [
    "workspace:read",
    "expense:write",
    "a2a:route_intent"
  ],
  "exp": 1718370000,
  "iat": 1718366400,
  "iss": "https://auth.pria.cloud"
}
```

- **Agents** receive `role = "agent"` and one or more `can_handle:*` scopes.
- Tokens are 15‑minute lifetime; refresh via Supabase Auth.

## 6  RLS Policy Integration

Every shared table includes `workspace_id`.  Generic predicate:

```sql
USING (workspace_id = current_setting('request.jwt.claims.workspace_id')::uuid);
```

Additional column masking predicates reference JWT `scopes` array. Example:

```sql
CREATE POLICY mask_amount ON expense FOR SELECT
  USING (workspace_id = jwt.workspace_id)
  WITH CHECK (TRUE)
  USING (
    CASE WHEN 'expense:read' = ANY (jwt.scopes) THEN TRUE ELSE FALSE END
  );
```

`rls:bypass` scope disables policies for migration tasks.

## 7  On‑/Off‑boarding Workflow

1. **Add User** – Admin UI → invites user email → Supabase magic link.
2. **Assign Role** – Row in `role_assignment` (`user_id`, `role`, `scopes[]`).
3. **Service Account** – `pria create-api-key --role api_client --scopes "expense:read"`.
4. **Agent Registration** – Agent POST `/agents/register` with public key; receives JWT with `agent` role + capability scopes.
5. **Off‑board** – Delete `role_assignment`, revoke refresh token, rotate API keys.

## 8  Audit & Evidence Collection

| Evidence                | Source                        | Frequency      | Drata Control |
| ----------------------- | ----------------------------- | -------------- | ------------- |
| Role assignment delta   | Supabase audit trigger → Loki | Real‑time      | CC6.1         |
| Quarterly access review | SQL export → PDF              | Quarterly      | CC6.3         |
| Scope usage logs        | Edge Fn & A2A Gateway         | 30‑day roll‑up | CC7.2         |

## 9  Open Items / Future Enhancements

- Auto‑generate least‑privilege scope suggestions based on audit logs.
- SCIM integration for Okta to Supabase.
- Signed JWTs with Key Rotation via JWKS endpoint (Q4 2025).

## 10  Revision History

| Version | Date       | Author         | Notes                                                            |
| ------- | ---------- | -------------- | ---------------------------------------------------------------- |
| 1.1     | 2025‑06‑14 | Per Swedenborg | Added A2A/MCP scopes, removed legacy agent tokens, marked Final. |
| 1.0     | 2025‑06‑12 | Per Swedenborg | First Final release.                                             |

