# O2 — FinOps & Cost Optimisation Guide

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Establish a disciplined, data‑driven FinOps practice that keeps PRIA’s multi‑cloud spend predictable, transparent, and ≤ 20 % of ARR while supporting 80 % faster rollout than legacy ERP vendors.  This guide codifies tagging standards, dashboards, alert budgets, optimisation playbooks, and governance cadences across Vercel, Supabase, Fly.io, Grafana Cloud, and AI model providers.

---

## Table of Contents

1. Objectives & KPI Targets
2. Cost‑Allocation Taxonomy & Tagging Standard
3. Budget Framework & Alert Thresholds
4. Usage & Cost Monitoring Stack
5. Optimisation Playbooks\
      5.1 Compute (Vercel, Fly)\
      5.2 Database & Storage (Supabase)\
      5.3 GPU & LLM Inference\
      5.4 Observability
6. Forecasting & Unit‑Economics Model
7. Governance, Review Cadence & RACI
8. Tooling & Automation Scripts
9. Operational Runbook
10. Future Enhancements & Roadmap
11. Revision History

---

## 1  Objectives & KPI Targets

| Objective                                | KPI / Metric                    | Target 2025‑2026 |
| ---------------------------------------- | ------------------------------- | ---------------- |
| Keep **Cloud Cost / ARR**                | (%)                             | ≤ 20 %           |
| Maintain **Gross Margin** (software)     | (%)                             | ≥ 80 %           |
| Detect cost anomaly within               | Hours                           | ≤ 2 h            |
| **Reserved / Savings Coverage**          | % eligible compute under commit | ≥ 60 %           |
| **Spot‑to‑On‑Demand Ratio** (GPU fleet)  | % GPU hrs on spot               | ≥ 50 %           |
| **Idle Resource Waste** (CPU hrs unutil) | % of total compute              | ≤ 5 %            |

---

## 2  Cost‑Allocation Taxonomy & Tagging Standard

Cost visibility starts with **consistent tags** across clouds and tools.

| Dimension   | Tag / Label Key | Example               | Applies To              |
| ----------- | --------------- | --------------------- | ----------------------- |
| Workspace   | `ws`            | `acme‑corp`           | Supabase, Fly, Logs     |
| Environment | `env`           | `pilot`, `growth`     | All resources           |
| Service     | `svc`           | `orchestrator`, `web` | Fly apps, Vercel builds |
| Module      | `mod`           | `expense`, `gl`       | LLM cost metrics        |
| Owner       | `owner`         | `backend‑team`        | Terraform `tags` blocks |
| Cost‑Center | `cc`            | `R&D`, `GTM`          | FinOps dashboard filter |

> **Terraform Rule:** Every module injects a `common_tags` locals block with keys above; CI fails if any resource lacks required tags.

---

## 3  Budget Framework & Alert Thresholds

| Cloud / Vendor    | Monthly Budget (USD) | Alert @ | Hard Cap Action                                 |
| ----------------- | -------------------- | ------- | ----------------------------------------------- |
| **Vercel**        | 200                  | 80 %    | Auto‑downgrade build concurrency                |
| **Supabase**      | 150                  | 80 %    | Scale read‑replica only; email Finance          |
| **Fly.io CPU**    | 300                  | 75 %    | Invoke `fly autoscale set min=1` for idle pods  |
| **Fly.io GPU**    | 600                  | 70 %    | Shift jobs to spot pool; pause nightly tuning   |
| **OpenAI / HF**   | 250                  | 70 %    | Switch to open‑weights adapter; tighten prompts |
| **Grafana Cloud** | 50                   | 90 %    | Trim log retention via API                      |

Prometheus metric `cost_month_to_date_usd` collected hourly via **OpenCost** + vendor APIs.  Alertmanager routes:

- **Critical** (hard cap breached) → PagerDuty P1.
- **Warning** (alert %) → Slack `#finops` & Jira ticket.

---

## 4  Usage & Cost Monitoring Stack

| Layer           | Tool / Source           | Collection Cadence | Storage Retention | Notes                                |
| --------------- | ----------------------- | ------------------ | ----------------- | ------------------------------------ |
| Cloud bills     | Vercel, Fly, Supabase   | Daily API pull     | 13 months         | Stored in `finops.cost_line_items`   |
| Usage metrics   | Prometheus (OpenCost)   | 1 min              | 30 days           | CPU, mem, GPU utilisation            |
| AI token spend  | vLLM logs → Loki        | Real‑time          | 90 days           | `agent_cost_usd` counter             |
| Cost dashboards | Grafana Cloud           | N/A (visual)       | Live              | Pre‑defined folder `FinOps`          |
| Forecast models | Python notebook in repo | Weekly             | Git tracked       | Uses Prophet; outputs CSV to Grafana |

### Key Dashboards

1. **Cost Explorer** – Daily spend per tag dimension.
2. **Unit Cost** – \$ per workflow run, \$ per 1 k tokens.
3. **Commit Coverage** – Reserved vs on‑demand graph.
4. **GPU Fleet Util** – Occupancy, spot vs on‑demand.

---

## 5  Optimisation Playbooks

### 5.1  Compute (Vercel & Fly)

- **Auto‑Idle** Vercel preview deployments older than 14 days (`vercel rm --yes`).
- **Right‑Size** Fly CPUs nightly: script queries Prometheus `cpu_utilization`; lowers `--cpu` if p95 < 35 % for 24 h.
- **Reserved Instances** – Purchase 1‑yr Fly SCALE units once 60 % utilisation sustained.

### 5.2  Database & Storage (Supabase)

- Enable **pgaudit ROF** to monitor slow queries; auto‑suggest index via pg\_stat\_statements.
- **Compression** – Use `lz4` on large JSONB columns (`workflow_event`).
- **Partition Prune** – Monthly run `CREATE TABLE ... PARTITION OF` for hot/cold.

### 5.3  GPU & LLM Inference

- **Spot Pool First** – Fly `gpu-pool-spot` handles inference; fall back to on‑demand when spot > 80 % utilisation.
- **QLoRA Adapters** – Fine‑tune smaller open models; switch routing when token cost delta > 40 %.
- **Prompt Token Optimiser** – LLM agent trims stopwords; expected 15 % token reduction.

### 5.4  Observability

- Set **Loki retention** Pilot 30 d → Growth 14 d → Enterprise 7 d.
- **Histogram pruning** – Drop high‑cardinality labels via OTEL AttributeProcessor.

---

## 6  Forecasting & Unit‑Economics Model

A lightweight Python model (stored in `/finops/forecast.ipynb`) ingests:

- Historical spend by tag dimension.
- Product roadmap milestones (R1).
- Growth assumptions (workspace CAGRs, transaction volume).

Outputs:

- 12‑month forecast table (P50, P90)
- Sensitivity: GPU price ±25 %, LLM token cost ±50 %.
- Break‑even volume vs SAP licence + 20 % margin.

Key equation:

```
UnitCost_run = (CPU_cost + GPU_cost + DB_cost + LLM_cost + Obs_cost) / runs
```

Target UnitCost\_run ≤ \$0.08 (Growth tier) as per P1 spec.

---

## 7  Governance, Review Cadence & RACI

| Meeting           | Frequency | Participants       | Agenda                                |
| ----------------- | --------- | ------------------ | ------------------------------------- |
| FinOps Stand‑up   | Weekly    | DevOps, Finance    | Budget burn, anomalies, action items. |
| Cloud Bill Review | Monthly   | CTO, CFO, Security | Variance vs forecast, commit plan.    |
| Architecture Sync | Quarterly | Eng leads          | Optimisation roadmap, GPU strategy.   |

*Decisions recorded in Confluence **``** track actions.*

---

## 8  Tooling & Automation Scripts

| Script / Job             | Schedule | Description                                  |
| ------------------------ | -------- | -------------------------------------------- |
| `collect_costs.py`       | Hourly   | ETL vendor bills → `finops.cost_line_items`. |
| `rightsize_fly.sh`       | Nightly  | Scale CPU/mem down for under‑utilised pods.  |
| `gpu_spot_rebalance.sh`  | 10 min   | Re‑queue inference to cheapest GPU pool.     |
| `notify_budget_slack.ts` | Hourly   | Slack digest if any tag > alert threshold.   |
| `reserve_planner.py`     | Monthly  | Suggest commits where savings > 7 %.         |

> **Prompt Block O2‑COST‑BOT**\
> *System:* “Given cost\_line\_items table, return Slack summary for tags exceeding 80 % budget.”

Environment variables used by scripts:

| ENV Var                       | Default / Example | Purpose                     |
| ----------------------------- | ----------------- | --------------------------- |
| `COST_ALERT_THRESHOLD_USD`    | `100`             | Budget slack notification   |
| `GPU_SPOT_MAX_PRICE_PER_HOUR` | `0.40`            | Ceiling for spot acceptance |
| `OPENAI_BILLING_API_KEY`      | `sk‑…`            | Fetches token spend         |
| `VERCEL_BILLING_TOKEN`        | `vc_…`            | Vercel cost API             |

Prometheus metrics:

- `cloud_cost_usd_total{tag="env"}`
- `gpu_spot_savings_pct` (alert if < 20 %)
- `idle_cpu_hours_total` (alert if > 5 % of total)

---

## 9  Operational Runbook

1. **Anomaly Alert** – Slack bot posts “We’re at 90 % of GPU budget.”\
      • DevOps checks Grafana cost panel → confirm spike.\
      • Run `gpu_spot_rebalance.sh`; verify cost drop next hour.\
      • If persists, downgrade model or enforce throttling.
2. **Bill Shock (Vercel)** – 300 % surge detected → Investigate preview deploy abuse; bulk delete inactive previews; enforce auto‑TTL shorter.
3. **Budget Overrun (Supabase)** – Exceeded 150 % → Upgrade plan review; consider read replica & partition pruning vs scale.
4. **OpenAI Price Hike** – CFO alert; FinOps sync → accelerate open‑weights migration; recalculate unit cost; update budgets.

---

## 10  Future Enhancements & Roadmap

- Integrate **OpenBilling v2** once Vercel releases realtime spend API (Q4 2025).
- Adopt **kubecost → OpenCost** once Fly.io GA Kubernetes Koynata (stretch).
- Implement **chargeback** reports per workspace for enterprise cross‑charging (2026).
- Evaluate **FinOps‑as‑Code** (Pulumi x Finout) for declarative budgets (Q2 2026).

---

## 11  Revision History

| Version | Date       | Author         | Notes                                               |
| ------- | ---------- | -------------- | --------------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of FinOps & Cost guide. |

