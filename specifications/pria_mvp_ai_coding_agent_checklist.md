# PRIA MVP — AI Coding Agent Master Checklist

**Document status:** Draft v0.1 · 12 June 2025  
**Owner:** Per Swedenborg (CEO)  
**Purpose:** An exhaustive, step‑by‑step to‑do list for an autonomous coding agent to ship PRIA MVP v0.1. Each task is atomic, ordered, and references the spec document (Markdown) needed for context.

---

## Executive Snapshot
* **Product:** PRIA — AI‑native ERP replacing consultant‑heavy SAP roll‑outs.  
* **MVP Scope:** Expense Mgmt, General Ledger, AI Workflow Builder, Wave‑1 Connectors, Marketplace.  
* **Stack:** Next.js 13/15 (front‑end), Supabase (Postgres + Auth), Fly machines & GPUs, Vercel Edge, Grafana Cloud OTEL.  
* **Targets:** ≤ 15‑eng team • 80 % faster rollout • 80 % lower TCO vs SAP.

---

## Phase 1 — Foundation & Environments  
*(Reference: **A2 Cloud Foundation Playbook**)*
- [ ] **1.1** Clone infra repo `git@github.com:pria-cloud/infra.git` and run lints.  
- [ ] **1.2** Create `.env.bootstrap` with AWS keys, Supabase admin JWT, Okta client (A2 §9).  
- [ ] **1.3** Generate Terraform backend/provider blocks via Prompt `A2-IAC-GEN`; commit under `infra/tf/`.  
- [ ] **1.4** Implement `scripts/bootstrap.sh` exactly per A2 §9; include smoke‑test cURL.  
- [ ] **1.5** Execute `./scripts/bootstrap.sh pilot`; confirm smoke test.  
- [ ] **1.6** Git tag `infra-bootstrap-v1`.

---

## Phase 2 — Data Layer & Tenancy  
*(Refs: **D1**, **A3**, **A4**)*
- [ ] **2.1** Author `sql/001_init.sql` using D1 schema; add `data_class` comments.  
- [ ] **2.2** Implement RLS policies from A3 role ⇄ scope matrix.  
- [ ] **2.3** Generate PII masking policies via Prompt `A4-MASK-POLICY-GEN`.  
- [ ] **2.4** Write pgTAP tests (`tests/rls_test.sql`) to hit 100 % table coverage.  
- [ ] **2.5** Integrate Flyway/Supabase migration step in CI (`ci.yml`).

---

## Phase 3 — Backend Services  
*(Refs: **API2**, **W1**, **W2**)*
- [ ] **3.1** Scaffold **Cortex Orchestrator** (Go) implementing `CortexOrchestrator` (API2 §3.1).  
- [ ] **3.2** Scaffold **WorkerService** (Rust) with `Execute` RPC (API2 §3.2).  
- [ ] **3.3** Scaffold **AgentService** (Python + vLLM) (API2 §3.3).  
- [ ] **3.4** Build W1 JSON‑Schema validator for Workflow DSL.  
- [ ] **3.5** Implement Composer Agent prompt chain (W2 §4) + sanitiser (A4 §3.4).  
- [ ] **3.6** Dockerise services; add Fly `fly.toml` (autoscale min=2).

---

## Phase 4 — Front‑End & Public API  
*(Refs: **API1**, **A3**)*
- [ ] **4.1** Init Next.js project `apps/web` with Supabase Auth.  
- [ ] **4.2** Sidebar nav gated by JWT scopes (A3 §5).  
- [ ] **4.3** Implement REST handlers `/expense`, `/workflow`, etc. (API1 §4).  
- [ ] **4.4** Publish GraphQL endpoint using API1 SDL.  
- [ ] **4.5** Add ts‑jest unit tests (≥ 80 % coverage).

---

## Phase 5 — Marketplace & Connectors  
*(Refs: **M1**, **I1**)*
- [ ] **5.1** Build Installer API (`/installer`) per M1 §6.  
- [ ] **5.2** Generate Slack connector via Prompt `I1-CONNECTOR-GEN`; commit manifest & Edge Fn.  
- [ ] **5.3** Generate Stripe connector likewise.  
- [ ] **5.4** Implement Deno sandbox runtime (M1 §3).  
- [ ] **5.5** Create `/marketplace` page listing Wave‑1 connectors.

---

## Phase 6 — AI Learning Loop  
*(Refs: **ML1**, **O2**)*
- [ ] **6.1** Add nightly GitHub Action `train_adapters.yml` executing ML1 pipeline.  
- [ ] **6.2** Upload adapter weights; insert row into `model_registry` (ML1 §7).  
- [ ] **6.3** Auto‑reload Composer Agent on promotion.  
- [ ] **6.4** Emit metric `model_inference_cost_usd_total` (O2 §4).

---

## Phase 7 — CI/CD & Quality Gates  
*(Refs: **C1**, **QA1**, **P1**)*
- [ ] **7.1** Implement full `ci.yml`: lint → unit → integration → pgTAP → build → e2e.  
- [ ] **7.2** Add nightly k6 benchmark pipeline (P1 scenarios).  
- [ ] **7.3** Integrate Semgrep & Trivy scanners (fail on High).  
- [ ] **7.4** Publish OpenAPI & GraphQL docs to GitHub Pages.

---

## Phase 8 — Observability & FinOps  
*(Refs: **O1**, **O2**)*
- [ ] **8.1** Embed OTEL exporters in services; route to Grafana Cloud.  
- [ ] **8.2** Generate dashboards using Prompt `O1-DASHBOARD-GEN`.  
- [ ] **8.3** Deploy OpenCost agent (Fly) collecting `cloud_cost_usd_total`.  
- [ ] **8.4** Configure cost alerts (GPU budget > 70 %).

---

## Phase 9 — Security & Compliance  
*(Refs: **S1**, **A4**, **OPS1**)*
- [ ] **9.1** Apply encryption standards (S1 §4).  
- [ ] **9.2** Enable pgAudit → Loki pipeline.  
- [ ] **9.3** Schedule nightly DLP scan (`dlp_scan.py`).  
- [ ] **9.4** Hook security alerts into PagerDuty using OPS1 templates.

---

## Phase 10 — BCP / DR & Benchmarks  
*(Refs: **S2**, **P1**)*
- [ ] **10.1** Script `promote_replica.sh` (Supabase fail‑over).  
- [ ] **10.2** Schedule semi‑annual fail‑over drill in GitHub Actions.  
- [ ] **10.3** Enable nightly performance run `run_bench.sh` streaming to Grafana.

---

## Phase 11 — Documentation & Developer Portal
- [ ] **11.1** Build Storybook site for UI components.  
- [ ] **11.2** Publish `/docs` index linking all spec Markdown files.  
- [ ] **11.3** Export OPS1 & S2 runbooks to Confluence.

---

## Phase 12 — Governance & Release Closure
- [ ] **12.1** Run classification linter ensuring 100 % A4 coverage.  
- [ ] **12.2** Update all Draft specs to **Final v1.0** once validated.  
- [ ] **12.3** Git tag `mvp-v0.1` and generate changelog from C1 workflow.

---

## Milestone Acceptance Criteria
1. All Phase 1‑12 tasks checked ✅.  
2. CI pipeline green; nightly benchmarks meet P1 targets.  
3. Fail‑over drill within RTO/RPO targets (S2).

---

## Revision History
| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2025‑06‑12 | Per Swedenborg | Fresh, complete checklist replacing earlier partial draft. |

