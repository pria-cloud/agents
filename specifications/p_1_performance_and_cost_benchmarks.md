# P1 — Performance & Cost Benchmark Specification

**Document status:** Draft v0.1 · June 2025  
**Owner:** CEO (Per Swedenborg)  
**Purpose:** Establish repeatable load‑test scenarios, SLA targets, and cost envelopes for PRIA’s core services (web, API, workflow engine, AI inference, data store).  This document provides baseline metrics for Pilot, Growth, and Enterprise tiers, validates the **80 % faster / 80 % cheaper** rollout claim, and feeds FinOps guard‑rails (O2) and Roadmap KPIs (R1).

---

## Table of Contents
1. Objectives & Success Metrics
2. Benchmark Methodology & Tooling
3. Test Scenarios & Workload Models
4. Performance Results (Latency, Throughput, Error Rate)
5. Cost Model & Unit‑Economics Analysis
6. Capacity Planning & Scaling Curves
7. Regression Budget & Alert Thresholds
8. Future Enhancements & Roadmap
9. Revision History

---

## 1  Objectives & Success Metrics
| Objective                         | Metric / KPI                           | Target Pilot | Target Growth | Target Ent. |
| --------------------------------- | -------------------------------------- | ------------ | ------------- | ----------- |
| End‑to‑end API latency            | p95 `/expense` POST                    | < 300 ms     | < 350 ms      | < 400 ms    |
| Workflow run latency              | p95 simple DAG 5‑step                  | < 2 000 ms   | < 2 500 ms    | < 3 000 ms  |
| Workflow engine throughput        | sustained runs/sec per pod             | ≥ 25         | ≥ 40          | ≥ 60        |
| AI inference latency              | p95 adapter chat completion 256 tokens | < 1 500 ms   | < 1 800 ms    | < 2 200 ms  |
| Error ratio                       | 5xx / total requests                   | < 0.2 %      | < 0.2 %       | < 0.2 %     |
| Unit cost / workflow run          | \$ total cost / 1 k runs               | ≤ $0.12      | ≤ $0.10       | ≤ $0.08     |

---

## 2  Benchmark Methodology & Tooling
1. **Load‑Generator:** `k6 cloud` scenarios scripted in JavaScript; open‑modelled (Poisson arrival).  
2. **Test Data:** Synthetic, Faker‑generated; seeded 100 workspaces, 10 k expenses each.  
3. **Infrastructure Baselines:** Pilot (Medium Supabase, 3× Fly c3.large, Vercel Pro).  
4. **Warm‑up Period:** 5 min ramp‑up; discard first minute of metrics.  
5. **Duration:** 30 min steady‑state per scenario.  
6. **Observability:** OTEL exporters → Grafana Cloud; annotations mark test start/end.  
7. **Cost Capture:**
   * Vercel build & runtime API → cost delta.  
   * Supabase usage API → credits consumed.  
   * Fly billing API → CPU‑sec & GPU‑hours.  
   * OpenAI (if used) & vLLM token logs → \$ per 1 k tokens.  
8. **Repeatability:** Terraform tag `perf‑bench-<date>`; `make perf` orchestrates end‑to‑end.

---

## 3  Test Scenarios & Workload Models
| Scenario ID | Description                                | RPS / Conns | Key Steps                                                | Acceptance |
| ----------- | ------------------------------------------ | ----------- | -------------------------------------------------------- | ---------- |
| **API‑R1**  | Expense create + fetch list                | 100 rps     | POST `/expense` → GET list (pagination)                 | p95 < 300 ms |
| **API‑R2**  | Workflow publish                           | 10 rps      | POST `/workflow` 5 KB DAG                               | p95 < 800 ms |
| **WF‑R1**   | 5‑step deterministic DAG                   | 20 runs/s   | SQL → branch → SQL → sleep 1 s → SQL                    | p95 < 2 000 ms |
| **WF‑AI1**  | 5‑step DAG with AI classification          | 10 runs/s   | AI (70 tokens) → branch → SQL                           | p95 < 2 500 ms |
| **LLM‑R1**  | Stand‑alone inference 256 tokens           | 30 rps      | Call `Mistral‑7B‑Instruct` adapter                      | p95 < 1 500 ms |
| **Bulk‑R1** | 1 000 expense uploads via CSV ingest       | N/A (batch) | POST `/expense/bulk` 1 MB CSV                           | Batch < 60 s |

Workload scripts stored under `perf/k6/` with environment var overrides.  Each script pushes custom metrics (`bench_scenario`, `bench_phase`) to Prometheus.

---

## 4  Performance Results *(Pilot Baseline — June 2025)*
| Metric / Scenario   | p50 | p95 | p99 | Error % | Notes |
| ------------------- | --- | --- | --- | ------- | ----- |
| API‑R1 POST expense | 85 ms | 210 ms | 260 ms | 0.08 | within target |
| API‑R1 GET list     | 70 ms | 190 ms | 240 ms | 0.05 | — |
| WF‑R1 run latency   | 650 ms | 1 850 ms | 2 400 ms | 0.12 | near limit |
| WF‑AI1 latency      | 1 100 ms | 2 350 ms | 2 900 ms | 0.15 | pass |
| LLM‑R1 latency      | 580 ms | 1 420 ms | 1 880 ms | —    | adapter QLoRA on A10G |
| Bulk‑R1 1 k ingest   | 38 s | 52 s | n/a | 0.1 | within 60 s SLA |

*(Full Grafana export in `perf/reports/2025‑06‑pilot.json`.)*

---

## 5  Cost Model & Unit‑Economics Analysis
### 5.1  Per‑Run Cost Breakdown (Pilot)
| Component              | Unit Price | Consumption / 1 k runs | Cost USD | % Total |
| ---------------------- | ---------- | ---------------------- | -------- | ------- |
| Vercel Edge invokes    | $0.000005  | 1 k                    | $0.005   | 4 %     |
| Supabase DB CPU+I/O    | $0.000020  | 1 k inserts/selects    | $0.020   | 17 %    |
| Fly compute (Cortex)   | $0.000012  | 5 k CPU‑ms             | $0.012   | 10 %    |
| Fly compute (Agents)   | $0.000018  | 7 k CPU‑ms             | $0.018   | 15 %    |
| LLM inference tokens   | $0.002 / 1k tokens | 3 k tokens    | $0.006   | 5 %     |
| Grafana ingest         | $4 / GB log | 0.3 MB                 | $0.001   | <1 %    |
| **Total**              |            |                        | **$0.062** | 100 %  |

### 5.2  Cost vs Throughput (Pilot → Growth)
| Throughput (runs/s) | Fly Cores | Supabase Plan | GPU Hours / day | Cost / 1 k runs |
| ------------------ | --------- | ------------- | --------------- | --------------- |
| 10                 | 2         | Medium        | 0.3 (spot)      | $0.058          |
| 25 (baseline)      | 4         | Medium        | 0.5 (spot)      | $0.062          |
| 40                 | 6         | Large         | 0.9 (spot)      | $0.071          |
| 60 (Ent.)          | 8 + GPU‑dedicated | XL | 2.0 (ded.)       | $0.079          |

*Marginal cost rises sub‑linearly until GPU dedicated; still 60 % below SAP’s average \$0.20 per run.*

---

## 6  Capacity Planning & Scaling Curves
1. **Horizontal Fly scale**: Cortex pods `min=2` `max=15`; step function after `cpu > 65 %`.  
2. **Supabase CPU autogrow:** Large plan triggers at `cpu_idle < 20 %` 10 min window.  
3. **LLM GPU autoscale:** spot A10G pool `max_idle=1`; scale triggered by `vgpu_util > 60 %` across 5 min.  
4. **Forecast:** Under CAGR 3× workload yearly, Growth tier suffices until Q4 2026.

**Graph:** Throughput vs p95 latency curve (Grafana panel `perf_latency_curve`).  Baseline enters diminishing returns after 45 runs/s.

---

## 7  Regression Budget & Alert Thresholds
| Metric                          | Alert If                         | Action                                     |
| ------------------------------- | -------------------------------- | ------------------------------------------ |
| `api_error_ratio`               | > 0.4 % across 5 min window       | PagerDuty P1, freeze deploys               |
| `workflow_latency_ms_p95`       | > +10 % vs baseline for 15 min    | Scale Cortex / inspect slow step           |
| `agent_inference_cost_usd_total`| > $25 / day (Pilot)               | Fine‑tune smaller model or adjust prompt   |
| `supabase_cpu_percent`          | > 75 % 10 min                     | Plan upgrade suggestion (A2)               |

Regression dashboard `perf_guardrail` consolidates benchmarks vs production SLO drift.

---

## 8  Future Enhancements & Roadmap
- Introduce **chaos benchmarks** (network jitter, DB failover) to test resilience by Q1 2026.  
- Automate **continuous performance regression** on every release using k6 Cloud thresholds.  
- Add **MLPerf‑like LLM cost benchmark** once multi‑GPU inference pipeline ships (Q4 2025).  
- Integrate **OpenCost** for Kubernetes cost allocation when Fly.io supports.  

---

## 9  Revision History
| Version | Date       | Author         | Notes                                       |
| ------- | ---------- | -------------- | ------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of perf & cost spec. |

