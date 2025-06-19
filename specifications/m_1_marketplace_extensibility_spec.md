# M1 — Marketplace & Extensibility Framework

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Define the architecture, packaging standard, security model, and commercial workflow of PRIA’s in‑product Marketplace—enabling third‑party and customer‑developed extensions (apps, workflow steps, reports, AI agents) to be discovered, installed, billed, and lifecycle‑managed without compromising tenant isolation or platform integrity.

---

## Table of Contents

1. Scope & Goals
2. Marketplace Architecture Overview
3. Extension Types & Runtime Sandboxes
4. Extension Manifest Schema
5. Publishing Workflow & Review Process
6. Installation & Configuration Flow
7. Billing & Revenue Sharing
8. Security Model & Permission System
9. API Surface for Extensions
10. Observability & Support
11. Prompt Blocks for Extension Scaffolding
12. Operational Runbook
13. Future Enhancements & Roadmap

---

## 1  Scope & Goals

- **Plug‑and‑Play Extensibility:** Empower partners and customers to add vertical features (e.g., industry‑specific reports, custom workflow steps) without forking core code.
- **Secure by Default:** Enforce namespace isolation and explicit permission grants; extensions run in sandboxed environments.
- **Discoverability:** Curated marketplace UI with search, ratings, version badges, and compliance attestations.
- **Monetisation:** Provide in‑platform billing backed by Stripe Connect; support free, flat‑fee, and usage‑based SKUs.
- **Lifecycle Management:** Enable automatic updates, rollback, telemetry, and end‑of‑life deprecation notices.

## 2  Marketplace Architecture Overview

```
┌──────────────┐             ┌──────────────────────┐
│  Marketplace │  GraphQL   │  Extension Registry   │
│    Frontend  │◀──────────▶│  (Supabase tables)    │
└──────────────┘             └──────────────────────┘
        ▲                           ▲
        │Installer API REST         │Webhooks (publish, update)
        │                           │
  ┌─────┴─────┐               ┌─────┴─────┐
  │  Cortex   │ gRPC sandbox  │  Builder   │
  │ Orchestr. │◀─────────────▶│  API (Fly) │
  └───────────┘               └────────────┘
        │                           ▲
        │Step call_out gRPC         │Upload .tar.gz
        ▼                           │
┌──────────────┐             ┌─────┴─────┐
│  Extension   │   OTLP      │  CI/CD    │
│  Runtime Pod │────────────▶│  Pipeline │
└──────────────┘  metrics    └───────────┘
```

*High‑level view showing registry, installer API, runtime sandbox, and builder pipeline.*

## 3  Extension Types & Runtime Sandboxes

| Type ID         | Purpose                         | Runtime       | Isolation                                                                        |
| --------------- | ------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| `ui-app`        | Custom Next.js pages/components | Vercel Edge   | Served via Vercel middleware under `/ext/{slug}`; CSP to limit origin access.    |
| `workflow-step` | New step executable in DAG      | Deno (JS/TS)  | Runs in edge‑function sandbox; 1 s CPU, 128 MB mem.                              |
| `ai-agent`      | Custom LLM prompt / toolset     | Python (Fly)  | Docker container with strict egress allow‑list; signed image; resources metered. |
| `report`        | Pre‑built Grafana dashboard     | Grafana Cloud | Imported JSON with variable scoping to workspace\_id.                            |

## 4  Extension Manifest Schema (`extension_manifest.json`)

```jsonc
{
  "$schema": "https://schemas.pria.cloud/extension-manifest.json",
  "id": "com.example.expenseAI",
  "version": "1.0.2",
  "type": "ai-agent",
  "name": "Expense Auto‑Categoriser",
  "description": "ML agent that classifies expense GL codes via GPT‑4.",
  "permissions": [
    "expense:read",
    "expense:write",
    "pii:unmask"
  ],
  "billing": {
    "model": "usage",
    "metric": "expense_categorise_calls",
    "price_per_unit_usd": 0.002
  },
  "assets": {
    "icon": "icon.png",
    "sourceArchive": "build/artifacts/expenseAI_1.0.2.tar.gz"
  },
  "compatibility": {
    "platform": ">=1.0",
    "schema": "v1"
  }
}
```

## 5  Publishing Workflow & Review Process

1. **Developer CLI:** `pria ext init` → scaffold repo.
2. **CI Build:** GitHub Action builds and signs `tar.gz`; pushes to PRIA Builder API.
3. **Automated Scans:** Semgrep (security), npm audit / pip audit, binary diff scan.
4. **Manual Review (optional tiers):** Security Lead reviews permissions > `log:read` or `pii:unmask`.
5. **Registry Publish:** Builder writes manifest row; sets status `pending` → `approved`.
6. **Marketplace Refresh:** Front‑end polls Registry, shows new extension.

> **Prompt Block M1-PUBLISH‑GUIDE**\
> *Generate a step‑by‑step instruction set for publishing extension {{name}} version {{ver}} targeting runtime {{type}}.*

## 6  Installation & Configuration Flow

1. Tenant Admin clicks **Install** → Installer API creates row in `workspace_extensions` with `status=pending`.
2. Secrets & env‑vars collected via modal; stored encrypted in Supabase KMS.
3. Runtime Pod deployed (Fly) or edge function provisioned (Vercel) using IaC module.
4. Health check hits `/healthz`; status set to `active`.
5. On update, Installer triggers rolling deploy; old pod kept for 5 min rollback window.

## 7  Billing & Revenue Sharing

- Stripe Connect **destination charges**; PRIA retains 20 % fee.
- Daily usage metrics (`extension_usage_total`) pushed to Grafana → metered billing job runs hourly.
- Invoice line item: `com.example.expenseAI – 10 000 calls × $0.002 = $20`.

## 8  Security Model & Permission System

- **Least Privilege:** Extensions declare permission scopes; Installer requests Admin grant; runtime JWT contains only granted scopes.
- **Signed Artifacts:** Builder CLI signs artifact with maintainer GPG key; signature stored in registry row; runtime verify on startup.
- **Runtime Restrictions:** egress allow‑list (`*.supabase.co`, `*.pria.cloud`); filesystem read‑only; memory/CPU cgroups.
- **Audit:** All extension invocations logged to Loki with `extension_id`, `workspace_id`.

## 9  API Surface for Extensions

### 9.1  REST Helper (`/ext-api/v1`)

| Endpoint              | Method | Auth       | Description                      |
| --------------------- | ------ | ---------- | -------------------------------- |
| `/query`              | POST   | JWT Bearer | SQL query with RLS enforced      |
| `/publish-event`      | POST   | JWT Bearer | Emit custom event to bus         |
| `/fetch-secret/{key}` | GET    | JWT Bearer | Retrieve extension‑scoped secret |

### 9.2  gRPC Helper (`pria.ext.v1.ExtService`)

```proto
rpc StreamExpense(ExpenseFilter) returns (stream Expense);
```

## 10  Observability & Support

- Extensions auto‑emit OTEL metrics/logs with `extension_id` label.
- Dev console shows last 24 h error ratio, p95 latency, cost graph.
- Support flow: “Report issue” creates Jira ticket with extension logs.

## 11  Prompt Blocks for Extension Scaffolding

- **M1‑MANIFEST‑GEN** – Generate starter `extension_manifest.json` from natural‑language description.
- **M1‑TEST‑GEN** – Generate Playwright tests to validate UI app extension.

## 12  Operational Runbook

1. **Extension crash loop** – Installer sets `status=degraded`; auto‑rolls back to previous version; notifies Dev via webhook.
2. **High cost spike** – Billing alert triggers; Finance contacts extension maintainer.
3. **Security CVE** – Registry flags extension; Installer suspends installs; sends advisory email.

## 13  Future Enhancements & Roadmap

- Private (workspace‑only) extension channel for enterprise customers.
- Extension analytics dashboard with conversion / churn metrics.
- Sandboxed Python runtime (Pyodide) for lightweight transformation extensions.

---

**Revision History**

| Version | Date       | Author         | Notes                        |
| ------- | ---------- | -------------- | ---------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft. |

