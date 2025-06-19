# I1 — Integration & Connector Inventory

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Catalogue every first‑class integration and connector that PRIA supports—covering SaaS applications, messaging platforms, finance systems, and generic protocols—together with authentication flows, rate limits, webhook contracts, and operational metrics.  This document acts as the single source of truth for product, engineering, GTM, and support teams when prioritising, building, or troubleshooting integrations.

---

## Table of Contents

1. Strategic Goals & Connector Model
2. Integration Architecture Overview
3. Connector Taxonomy & Definitions
4. Core Connector Inventory (Wave 1 – Wave 3)
5. Authentication & Security Patterns
6. Rate Limit Strategy & Back‑Off Policies
7. Webhook & Eventing Standards
8. Observability & Support Playbooks
9. Prompt Blocks & Scaffolding Generators
10. Operational Runbook
11. Future Enhancements & Roadmap
12. Revision History

---

## 1  Strategic Goals & Connector Model

| Goal                         | KPI / Success Metric                          | Target 2025‑2026 |
| ---------------------------- | --------------------------------------------- | ---------------- |
| **90 % Use‑Case Coverage**   | % prospects whose top 5 systems are supported | ≥ 90 %           |
| **Rapid Connector Delivery** | Avg days to GA a net‑new connector            | ≤ 30 days        |
| **Low MTTR** (Integrations)  | Mean time to resolve connector incident (P2)  | ≤ 2 h            |
| **Marketplace Fly‑Wheel**    | 3rd‑party connector share of catalogue        | ≥ 30 % by Q4 26  |

**Connector Model:** Connectors are packaged as **Marketplace extensions** (see M1).  Each connector may expose **Sources** (event producers), **Sinks** (actions), or **Bidirectional Sync**.  Runtime options:

- **Edge Function** (Vercel) for lightweight REST/webhook adapters.
- **Fly.io pod** for stateful or heavy‑CPU connectors (SAP, S/4HANA OData).
- **On‑Prem Bridge** (Docker agent) for private‑network ERP.

---

## 2  Integration Architecture Overview

```
┌────────────────┐     Webhooks      ┌──────────────────────┐
│  SaaS Vendor   │ ────────────────▶ │  PRIA Ingest Gateway │
└────────────────┘                  ├─────────┬────────────┘
        ▲ OAuth / API               │         │ OTEL Metrics
        │                           ▼         ▼
  PRIA Extension Runtime   (Edge Fn / Fly pod)  ──▶  Cortex Events Bus
                                                 ▶   Supabase Tables
```

*Ingest Gateway* standardises signature verification, JSON canonicalisation, and enqueue to **pgmq**.  Outbound calls are proxied via **Rate‑Limiter Middleware**.

---

## 3  Connector Taxonomy & Definitions

| Category         | Sub‑Type       | Description                             | Examples                             |
| ---------------- | -------------- | --------------------------------------- | ------------------------------------ |
| **Messaging**    | ChatOps        | Trigger PRIA workflows from chat        | Slack, Microsoft Teams, Discord      |
| **Finance**      | ERP / GL       | Sync journals, vendors, invoices        | Netsuite, SAP S/4, QuickBooks Online |
|                  | Payments       | Initiate payouts / reconcile statements | Stripe, Adyen, Wise                  |
| **HR**           | HCM            | Sync employee directory, PTO            | Workday, BambooHR                    |
| **SCM**          | Inventory      | PO, goods receipt, stock level events   | SAP MM, Oracle NetSuite Inventory    |
| **Productivity** | Docs & Storage | Attach receipts, fetch files            | Google Drive, OneDrive               |
| **Generic**      | Webhook Only   | Custom inbound JSON                     | Any HTTP producer                    |

Connector Versioning: `connector_id@vMAJOR.MINOR.PATCH` aligns with Semantic Versioning.

---

## 4  Core Connector Inventory

### 4.1  Wave 1 (Pilot Tier)

| Connector ID        | Vendor          | Capabilities                   | Auth Method    | Runtime | Rate Limit Guard      | Status |
| ------------------- | --------------- | ------------------------------ | -------------- | ------- | --------------------- | ------ |
| `slack.chatops`     | Slack           | Slash‑command → Workflow start | OAuth 2.0      | Edge    | Slack 3 r/s           | GA     |
| `netsuite.erp`      | Oracle NetSuite | Journals, vendors, receipts    | OAuth 1.0a     | Fly     | 10 r/s, back‑off      | Beta   |
| `quickbooks.online` | Intuit QBO      | Expenses → GL journals         | OAuth 2.0      | Edge    | 500 req/day, back‑off | GA     |
| `stripe.payments`   | Stripe          | Webhook events, payout trigger | Webhook + Keys | Edge    | Event retries (3×)    | GA     |
| `google.drive`      | Google Drive    | Receipt image fetch            | OAuth 2.0      | Edge    | 100 req/100 s         | Beta   |

### 4.2  Wave 2 (Growth Tier)

| Connector ID       | Vendor  | Capabilities                 | Runtime | ETA     |
| ------------------ | ------- | ---------------------------- | ------- | ------- |
| `sap.s4hana.odata` | SAP     | Purchase orders, GL journals | Fly GPU | Q1 2026 |
| `workday.hcm`      | Workday | Employee sync, PTO webhooks  | Edge    | Q4 2025 |
| `xero.gl`          | Xero    | Journals, currency rates     | Edge    | Q4 2025 |
| `microsoft.teams`  | MS 365  | Adaptive cards approval      | Edge    | Q1 2026 |

### 4.3  Wave 3 (Enterprise Tier)

To be prioritised via customer discovery.  Candidates: Salesforce CPQ, Oracle EBS, JD Edwards, ServiceNow.

---

## 5  Authentication & Security Patterns

| Pattern ID       | When Used            | Flow Summary                                                                         | Secrets Storage               | Token Rotation Policy     |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------ | ----------------------------- | ------------------------- |
| **OAUTH‑PKCE**   | Slack, Google, Teams | Front‑end initiates PKCE; callback hits `/oauth/callback`; exchange stored encrypted | Supabase `oauth_tokens` table | 6 months auto‑refresh     |
| **OAUTH‑1**      | Netsuite             | Edge Fn signs with consumer key + token; signatures generated per request            | Supabase KMS                  | Manual 12 mo rotate       |
| **API‑KEY**      | Stripe, Xero         | Static secret key in Supabase KMS; passed as `Authorization: Bearer`                 | Supabase KMS                  | 30 day rotate via script  |
| **Webhook‑HMAC** | All inbound          | Vendor signs request body; Gateway validates `X‑Signature` header (SHA‑256)          | n/a                           | Shared secret rotate 90 d |

> **Prompt Block I1‑AUTH‑DOC** – "Generate OAuth 2 PKCE setup instructions for vendor {{vendor}}; include redirect URI & scopes list."

---

## 6  Rate Limit Strategy & Back‑Off Policies

- **Token‑Bucket** per connector instance; config in `connector_config.rate_limit` (default 2 r/s burst 10).
- **Exponential Back‑Off** `1, 2, 4, 8 s` on `429` or vendor error codes list.
- Prometheus metric `connector_backoff_seconds_total` increments; alert if back‑off > 60 s median.

---

## 7  Webhook & Eventing Standards

### 7.1  Inbound Webhooks

- Must deliver **JSON** with top‑level `event_type`, `event_ts`, `payload` fields.
- Gateway validates HMAC; 4 s max processing before 202 Accepted.
- Duplicate delivery guarded by **Idempotency Key** header hashed to `event_dedup`.

### 7.2  Outbound Events (to Cortex)

- Translated to **pgmq** message `{type, workspace_id, payload}`.
- Retry policy: max 5 attempts with back‑off; DLQ `connector_dead_letter`.

---

## 8  Observability & Support Playbooks

| Metric                            | Type  | Threshold / Alert             |
| --------------------------------- | ----- | ----------------------------- |
| `connector_request_total`         | cnt   | —                             |
| `connector_error_ratio`           | ratio | Alert if > 1 % @ 5 min window |
| `connector_latency_ms_p95`        | hist  | Alert if > 2 000 ms           |
| `connector_backoff_seconds_total` | cnt   | Alert if > 300 s / 15 min     |
| `webhook_validation_fail_total`   | cnt   | Any triggers PagerDuty P2     |

Support runbook includes:

1. **Customer reports sync gap** → Check Grafana panel `connector_latency`; inspect DLQ.
2. **Vendor rotates client ID** → Use `rotate_secret.sh` (Prompt A2‑SECRET‑GEN derivative).
3. **Rate‑limit throttle** → Switch to queued mode; schedule re‑sync window.

---

## 9  Prompt Blocks & Scaffolding Generators

| ID                | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| I1‑CONNECTOR‑GEN  | Generate starter code & manifest for new connector.      |
| I1‑OAUTH‑DOC      | Draft vendor OAuth setup guide (teams, scopes, redirect) |
| I1‑RATE‑LIMIT‑CFG | Produce YAML policy entry for token‑bucket config.       |

### Prompt I1‑CONNECTOR‑GEN (example)

```
System: Generate TypeScript Edge Function that ingests webhook for {{vendor}}, validates HMAC header {{header}}, and enqueues message to pgmq.
```

---

## 10  Operational Runbook

1. **Connector Error Spike** – Grafana alert triggers; on‑call reviews Loki logs; if vendor 4xx, back‑off.
2. **Token Expiry** – OAuth refresh fails; Gateway marks connector `degraded`; email tenant admin via Postmark.
3. **Schema Drift** – Vendor field removed; Connector version bumps MINOR; mapping updated; run W3 Test‑Harness on workflows using connector.
4. **DLQ Growth** – If `connector_dead_letter` > 100 msgs, escalate to Connector Owner; run replay script after fix.

---

## 11  Future Enhancements & Roadmap

- **Connector SDK** (Go + TS) with typed models and retry helpers (Q1 2026).
- **GUI Connector Builder** that packages Edge Function + manifest (Q2 2026).
- **Event Replay UI** for DLQ messages (Q2 2025).
- **Private Connector Channel**—enterprise customers upload proprietary connectors with signed artefacts.

---

## 12  Revision History

| Version | Date       | Author         | Notes                                               |
| ------- | ---------- | -------------- | --------------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of connector catalogue. |

