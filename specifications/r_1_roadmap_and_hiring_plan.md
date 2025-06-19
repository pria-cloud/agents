# R1 — Product Roadmap & Hiring Plan

**Document status:** Draft v0.2 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Present a realistic 24‑month roadmap and lean‑team hiring plan that leverages PRIA’s AI‑driven development velocity. Targets: **80 % faster** and **80 % cheaper** module roll‑outs versus SAP, with no more than **15 engineers** at peak.

---

## Table of Contents

1. Strategic Themes
2. Roadmap Overview (Gantt Summary)
3. Feature Release Matrix (Quarterly)
4. Headcount Plan & Org Chart
5. Hiring Timeline & Budget
6. Role Descriptions & Interview Rubrics (Excerpt)
7. Dependencies & Risk Mitigation
8. KPI Targets & Milestone Acceptance
9. Future Enhancements & Iteration Loops
10. Revision History

---

## 1  Strategic Themes

| Theme                     | Description                                                   | 12‑Month Success Metric                                                  |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **AI‑Native ERP**         | Agents design workflows; deterministic engine deploys safely. | **≥ 80 % faster rollout *****and***** 80 % lower services spend vs SAP** |
| **Marketplace Fly‑Wheel** | Extensions amplify value; network effects drive ARR.          | ≥ \$1 M Marketplace ARR                                                  |
| **Compliance‑First**      | Enterprise trust via SOC 2 Type II + ISO 27001.               | Zero high‑severity audit gaps                                            |

---

## 2  Roadmap Overview *(Gantt Summary)*

*(Illustrative timeline; detailed Gantt lives in Productboard.)*

| Quarter     | Eng Capacity (sprint pts) | Major Releases / Milestones                | Go‑To‑Market Focus              |
| ----------- | ------------------------- | ------------------------------------------ | ------------------------------- |
| **Q3 2025** | 600                       | Pilot MVP – Expenses, GL, Workflow Builder | Sign 3 pilot design partners    |
| **Q4 2025** | 750                       | Marketplace v1, Schema Synthesiser GA      | Publish pricing & packaging     |
| **Q1 2026** | 850                       | SCM alpha, SOC 2 Type I report             | Formal Seed / Series A outreach |
| **Q2 2026** | 900                       | HCM alpha, Multi‑entity accounting GA      | Convert Growth‑tier customers   |
| **Q3 2026** | 950                       | AI Insight Dashboards, ISO 27001 Stage 2   | \$250 k Marketplace GMV         |
| **Q4 2026** | 1 000                     | I18n pack (EU‑5), Multi‑region deploy      | Expand sales EU & APAC          |

---

## 3  Feature Release Matrix

| Module / Capability       | Q3 25 | Q4 25 | Q1 26 | Q2 26 | Q3 26 | Q4 26 |
| ------------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| **Expense Management**    | MVP   | GA    |       |       |       |       |
| **General Ledger**        | MVP   | GA    |       |       |       |       |
| **Marketplace (Install)** |       | GA    |       |       |       |       |
| **Workflow Builder v2**   |       | Beta  | GA    |       |       |       |
| **SCM – Purchase Orders** |       |       | Alpha | Beta  | GA    |       |
| **HCM – Onboarding**      |       |       | Alpha | Beta  | GA    |       |
| **AI Insight Dashboards** |       |       |       | Beta  | GA    |       |
| **I18n (EU‑5)**           |       |       |       |       | Beta  | GA    |

---

## 4  Headcount Plan & Org Chart

### 4.1  Headcount by Function (End‑of‑Quarter)

| Function            | Q3 25  | Q4 25  | Q1 26  | Q2 26  | Q3 26  | Q4 26  |
| ------------------- | ------ | ------ | ------ | ------ | ------ | ------ |
| Engineering (FTE)   | 8      | 10     | 12     | 13     | 14     | 15     |
| Product Management  | 1      | 2      | 2      | 3      | 3      | 3      |
| Design / UX         | 1      | 1      | 1      | 2      | 2      | 2      |
| DevRel / Solutions  | 0      | 1      | 1      | 2      | 3      | 3      |
| Sales AE            | 0      | 0      | 1      | 2      | 3      | 4      |
| Customer Success    | 1      | 1      | 2      | 2      | 3      | 3      |
| G&A (Ops, Finance)  | 1      | 1      | 2      | 3      | 3      | 3      |
| **Total Headcount** | **12** | **16** | **21** | **27** | **31** | **33** |

### 4.2  Lean Org Chart Snapshot (Q4 2025)

```
CEO (Per)
 ├─ Dir. Engineering (hiring)
 │   ├─ Backend Squad (3)
 │   ├─ Frontend Squad (2)
 │   └─ Platform/DevOps (2)
 ├─ Product Lead (hiring)
 │   └─ PM (1)
 ├─ Design Lead (1)
 ├─ GTM Lead (hiring)
 │   └─ AE (1)
 └─ Finance & Ops (1)
```

---

## 5  Hiring Timeline & Budget

| Quarter           | Net New Hires | Avg FLC (USD) | Cash Outlay   |
| ----------------- | ------------- | ------------- | ------------- |
| Q3 25             | 5             | \$180 k       | \$0.90 M      |
| Q4 25             | 4             | \$185 k       | \$0.74 M      |
| Q1 26             | 5             | \$195 k       | \$0.98 M      |
| Q2 26             | 6             | \$200 k       | \$1.20 M      |
| **Total (24 mo)** | **20**        | —             | **≈ \$3.8 M** |

*Assumes 3 % COLA and 15 % equity.*

---

## 6  Role Descriptions & Interview Rubrics (Excerpt)

### 6.1  Backend Engineer — Workflow Engine

- **Stack:** Python 3.12, FastAPI, Postgres, gRPC.
- **Must‑have:** Distributed systems, async programming, Postgres perf tuning.
- **Interview Loop:** Coding (60 min) · System design (45 min) · Culture add (30 min) · Founder chat (30 min).

> **Prompt Block R1‑JD‑GEN** – “Generate JD for {{role}} at {{seniority}} level.”

---

## 7  Dependencies & Risk Mitigation

| Risk                 | Impact           | Likelihood | Mitigation                              |
| -------------------- | ---------------- | ---------- | --------------------------------------- |
| SOC 2 delay          | Enterprise deals | Medium     | Fractional CISO + weekly audit sync.    |
| LLM pricing spike    | Gross margin     | Medium     | Fine‑tune smaller open models by Q1 26. |
| Talent shortage (AI) | Feature delay    | Medium     | Remote, agency, employer branding.      |
| Cloud outage         | SLA breach       | Low        | Multi‑region deploy Q2 26.              |

---

## 8  KPI Targets & Milestone Acceptance

| Milestone                | KPI Gate                         | Acceptance Criteria                     |
| ------------------------ | -------------------------------- | --------------------------------------- |
| Marketplace GA           | ≥ 5 extensions, GMV \$50 k/mo    | Zero install failures in 30 days.       |
| SOC 2 Type I             | Readiness audit sign‑off         | No high‑severity findings.              |
| Growth Tier GA           | 10 paying customers, NRR ≥ 110 % | Billing logs match Stripe, < 1 % churn. |
| AI Insight Dashboards GA | Avg latency < 2 s; p95 < 3 s     | Perf tests + customer UAT pass.         |

---

## 9  Future Enhancements & Iteration Loops

- Quarterly OKR re‑planning post‑Series A.
- Adoption analytics to steer extension roadmap.
- Track talent density KPI to maintain engineering quality.

---

## 10  Revision History

| Version | Date       | Author         | Notes                                                        |
| ------- | ---------- | -------------- | ------------------------------------------------------------ |
| 0.2     | 2025‑06‑12 | Per Swedenborg | Headcount reduced, 80 % speed & cost target, full doc regen. |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial draft.                                               |

