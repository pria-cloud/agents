# P1 — Performance & Cost Benchmark Specification

**Document status:** Draft v0.1 · June 2025  
**Owner:** CEO (Per Swedenborg)  
**Purpose:** Establish the methodologies, target metrics, tooling, and acceptance gates that demonstrate PRIA’s commitment to **80 % faster** functional rollout and **80 % lower total cost of ownership (TCO)** compared with legacy ERP platforms such as SAP S/4HANA.  The benchmarks herein are referenced by the Roadmap (R1), FinOps Guide (O2), Testing Strategy (QA1), and Investor Materials.

---

## Table of Contents
1. Benchmark Objectives & Success Criteria  
2. KPI Taxonomy & Target Thresholds  
3. Benchmark Environment & Data Sets  
4. Workload Profiles & Test Scenarios  
5. Tooling Stack & Automation Pipeline  
6. Baseline Results (Pilot Tier, June 2025)  
7. Cost Model & TCO Comparison  
8. Regression Gates & Alerting  
9. Prompt Blocks & Automation Scripts  
10. Operational Runbook  
11. Future Enhancements & Roadmap  
12. Revision History

---

## 1  Benchmark Objectives & Success Criteria
| Objective                                   | Metric / Evidence                            | Target  |
| ------------------------------------------- | -------------------------------------------- | ------- |
| **Speed Advantage** vs SAP rollout          | Avg man‑days to deploy core module           | ≤ 20 % of SAP baseline |
| **Cost Advantage** vs SAP implementation    | \$ / module over 3 yrs (licence+services)    | ≤ 20 % of SAP baseline |
| Application performance (Pilot tier)        | p95 latency, error ratio                    | See §2  |
| Elastic scalability                         | Linear throughput ↑ with ≤ +10 % latency p95 | Up to 5× baseline |
| GPU/LLM efficiency                          | \$ per 1 k tokens                            | ≤ \$0.002 |
| Observability overhead                      | Telemetry CPU %                              | ≤ 5 %   |

Success = all KPIs met or exceeded in **Growth** reference run and no regression > 5 % across CI release gates.

---

## 2  KPI Taxonomy & Target Thresholds
| KPI ID | Metric                                    | Pilot Target | Growth Target | Enterprise Target |
| ------ | ----------------------------------------- | ------------ | ------------- | ----------------- |
| **P95_API_LAT** | API request latency (REST p95)            | < 300 ms     | < 350 ms      | < 500 ms          |
| **P95_DAG_LAT** | Workflow run latency p95 (50 steps)       | < 2 000 ms   | < 3 000 ms    | < 5 000 ms        |
| **ERR_RATIO**   | 5xx / total REST                       | < 0.5 %     | < 0.5 %      | < 0.7 %          |
| **THROUGHPUT**  | Expense inserts/sec sustained           | 1 000       | 5 000         | 15 000           |
| **LLM_COST**    | \$ per workflow AI call                 | ≤ 0.002     | ≤ 0.0018      | ≤ 0.0015         |
| **UNIT_COST**   | \$ per workflow run (all‑in)            | ≤ 0.08      | ≤ 0.06        | ≤ 0.04           |
| **CPU_UTIL**    | Peak app CPU utilisation @ p95 latency  | ≤ 70 %      | ≤ 75 %        | ≤ 80 %           |
| **COST/ARR**    | Cloud cost / ARR                       | —           | ≤ 20 %        | ≤ 18 %           |

---

## 3  Benchmark Environment & Data Sets
| Layer           | Pilot Setup                            | Growth Setup                           |
| --------------- | -------------------------------------- | -------------------------------------- |
| Supabase DB     | Medium plan (2 vCPU, 8 GB, PITR 7 d)   | Large plan (4 vCPU, 16 GB)             |
| Fly.io Apps     | 3× `c3.large` orchestrators            | 6× `c3.large` + 2× `A10G` GPU pool     |
| Vercel Web      | Pro plan, concurrency = 4              | Pro plan, concurrency = 8              |
| Dataset Size    | 1 M expense rows (100 workspaces)      | 10 M expense rows (500 workspaces)     |
| Traffic Driver  | k6 cloud runners (8 VUs)               | k6 cloud (64 VUs)                      |
| LLM Model       | Mistral‑7B‑Instr @ vLLM (A10G spot)    | Same + QLoRA adapter v1.3              |

Synthetic data generated via **faker.js**; receipts images from unsplash placeholders (to avoid PII).

---

## 4  Workload Profiles & Test Scenarios
| Scenario ID | Description                                   | Duration | KPI Focus        |
|------------ | --------------------------------------------- | -------- | ---------------- |
| **T1**      | Steady‑state 1 k inserts/sec expense flow     | 15 min   | Latency, CPU     |
| **T2**      | Burst 10 k inserts/sec for 60 sec             | 60 sec   | Elasticity       |
| **T3**      | 20 concurrent workflow runs w/ AI steps (p95) | 15 min   | LLM cost, p95    |
| **T4**      | Tenant‑sprawl: 1 000 workspaces, light usage   | 30 min   | Memory, RLS perf |
| **T5**      | Full module mix (GL + Expense + SCM)          | 30 min   | End‑to‑end unit cost |

Each scenario uses k6 scripts in `benchmarks/k6/` and outputs JSON summary consumed by `parse_bench.py` (see §9).

---

## 5  Tooling Stack & Automation Pipeline
| Stage            | Tool / Action                          | Artifact / Evidence                          |
| ---------------- | ---------------------------------------| -------------------------------------------- |
| Data gen         | `make generate_dataset` (Python Faker) | Parquet files in `benchmarks/datasets/`      |
| Load driver      | **k6 cloud**                           | JSON result, Grafana metrics                 |
| GPU telemetry    | `nvidia‑smi --query` + Prometheus      | `gpu_util_pct`, `gpu_cost_usd_total`         |
| Parsing & upload | `python parse_bench.py` → Prometheus   | `bench_` prefixed metrics                    |
| Report builder   | GitHub Action `bench_report.yml` uses `python‑docx` | PDF summary in build artefacts            |

All stages executed via `./scripts/run_bench.sh`; triggered nightly (`23:00 UTC`) on `main` branch.

---

## 6  Baseline Results (June 12 2025)
| KPI ID             | Pilot Result | Pilot Target | Growth Result | Growth Target |
| ------------------ | ------------ | ------------ | ------------- | ------------- |
| **P95_API_LAT**    | 250 ms       | ✅           | 310 ms        | ✅            |
| **P95_DAG_LAT**    | 1 800 ms     | ✅           | 2 850 ms      | ✅            |
| **THROUGHPUT**     | 1 050 req/s  | ✅           | 5 200 req/s   | ✅            |
| **LLM_COST**       | \$0.0019     | ✅           | \$0.0017      | ✅            |
| **UNIT_COST**      | \$0.075      | ✅           | \$0.058       | ✅            |
| **CPU_UTIL**       | 65 %         | ✅           | 72 %          | ✅            |
| **ERR_RATIO**      | 0.23 %       | ✅           | 0.28 %        | ✅            |

*Full result CSV in `benchmarks/reports/2025‑06‑12_pilot_growth.csv`.*

---

## 7  Cost Model & TCO Comparison
### 7.1  Methodology
1. **PRIA Costs** – Sum of cloud invoices (Vercel, Supabase, Fly, Grafana) + 15 engineer salary amortised over 5 yrs + 20 % gross margin buffer.  
2. **SAP Baseline** – Public list price for S/4HANA Cloud ERP modules + 30 consultant man‑years (PwC rate \$185/hr) + support.

### 7.2  Findings *(per customer, 3‑year horizon)*
| Platform | Licence + Infra (\$) | Services (\$) | Total (\$) | % of SAP | Rollout Time (months) |
| -------- | ------------------- | ------------- | ---------- | -------- | --------------------- |
| PRIA     | 480 k               | 270 k         | **750 k**  | **20 %** | **6**                 |
| SAP      | 1 600 k             | 2 200 k       | 3 800 k    | 100 %    | 30                    |

### 7.3  Sensitivity Analysis
- **LLM price +50 %** → UnitCost rises to \$0.09, still 70 % cheaper than SAP.  
- **GPU spot unavailability** (on‑demand fallback) adds \$0.02 to UnitCost; mitigated by QLoRA.

---

## 8  Regression Gates & Alerting
| Gate ID | Metric                         | Threshold                               | Action                                     |
| ------- | ------------------------------ | ---------------------------------------- | ------------------------------------------ |
| G‑P95   | `bench_workflow_latency_ms`    | p95 Pilot ≥ +10 % vs baseline           | Block merge; open Jira P1                  |
| G‑COST  | `bench_unit_cost_usd`          | > \$0.10 (pilot)                        | PagerDuty P2; trigger FinOps playbook      |
| G‑ERR   | `bench_error_ratio`            | > 0.5 %                                 | Fail CI; auto‑rollback release             |
| G‑GPU   | `gpu_cost_usd_total`           | 30‑day burn > budget                    | Slack `#finops`; auto‑scale down batch     |

Grafana dashboard **Benchmark Health** visualises last 30 runs; anomalies highlighted.

---

## 9  Prompt Blocks & Automation Scripts
| ID                 | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| P1‑K6‑SCRIPT‑GEN   | Generate k6 script from YAML workload descriptor.              |
| P1‑REPORT‑BOT      | Summarise benchmark CSV into 3‑paragraph Slack post.           |
| P1‑COST‑SIM        | Monte‑Carlo simulate cost sensitivity: GPU price, LLM tokens.  |

> **Prompt P1‑K6‑SCRIPT‑GEN (example)**  
> *System:* “Produce k6 JS script that POSTs to `/expense` with body payload {{json}}, ramping to {{vus}} VUs over {{duration}}.”

---

## 10  Operational Runbook
1. **Nightly run fails** – GitHub Action red; on‑call reviews `results.json`; if gate breached, open Jira incident `BENCH‑<date>`.  
2. **Cost regression** – FinOps Slack alert; DevOps pauses non‑critical workflows; evaluate QLoRA adapter reductions.  
3. **Throughput plateau** – Check Supabase CPU, Fly orchestrator queue depth; add replicas or partition tables.

---

## 11  Future Enhancements & Roadmap
- Add **Real‑Customer Replay** harness once ≥ 10 growth tenants live (Q2 2026).  
- Integrate **GPU time‑series prediction** using Prophet to pre‑empt spot interruptions.  
- Publish **public performance dashboard** for marketing transparency.  
- Establish **cross‑cloud failover benchmark** aligning with S2 RPO 5 min target.

---

## 12  Revision History
| Version | Date       | Author         | Notes                                           |
| ------- | ---------- | -------------- | ----------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of perf & cost spec |

