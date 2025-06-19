# ML1 — Learning Loop & Fine‑Tune Pipeline Specification

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Describe the end‑to‑end machine‑learning lifecycle that powers PRIA’s agent improvement loop: data extraction, feature engineering, nightly adapter fine‑tuning (QLoRA), evaluation, promotion, rollback, and cost governance.  The pipeline must be fully automated, auditable, and aligned with the lean‑team constraints (≤ 15 engineers).

---

## Table of Contents

1. Objectives & Success Metrics
2. Data Sources & Privacy Classification
3. Feature Engineering & Dataset Build
4. Model Architecture & Adapter Strategy
5. Fine‑Tune Orchestration Pipeline
6. Evaluation & Safety Filters
7. Model Registry & Promotion Policy
8. Cost Model & GPU Resource Planning
9. Prompt Blocks & Automation Scripts
10. Operational Runbook
11. Future Enhancements & Roadmap
12. Revision History

---

## 1  Objectives & Success Metrics

| Objective                               | Success Metric                                               | Target  |
| --------------------------------------- | ------------------------------------------------------------ | ------- |
| Continuous improvement of agent quality | **≥ 2 pp weekly reduction** in manual override rate          | 2 pp/wk |
| Latency preservation                    | p95 inference latency increase **≤ 5 %** vs previous adapter | ≤ +5 %  |
| Cost control                            | Training GPU cost **≤ \$150 / night** (Pilot)                | <\$150  |

---

## 2  Data Sources & Privacy Classification

| Source Table          | Data Class | Retention | Anonymisation / Masking                |
| --------------------- | ---------- | --------- | -------------------------------------- |
| `workflow_event`      | Internal   | 365 days  | Strip `workspace_id` before training   |
| `expense` (text cols) | Restricted | 180 days  | Tokenise PII fields, keep category IDs |
| `agent_trace` (JSON)  | Internal   | 90 days   | Remove user identifier fields          |
| Public eval set       | Public     | ∞         | Synthetic                              |

*Data extraction queries live in ****\`\`****.*

---

## 3  Feature Engineering & Dataset Build

1. **SQL Extraction** – GitHub Action `extract_dataset.yml` runs nightly against Supabase read‑replica.
2. **Parquet Dump** – Write to Supabase storage `s3://datasets/{{date}}/raw.parquet`.
3. **Feature Pipeline (PySpark)** – Jobs on Fly.io GPU node:
   - Tokenise text fields with `tiktoken` BPE.
   - Compute `reward = 1 – override_flag`.
   - Balance classes via up‑sampling (max 3× minority).
4. **Train/Val/Test Split:** 80 / 10 / 10 by `record_date` to avoid leakage.

---

## 4  Model Architecture & Adapter Strategy

| Component           | Choice                                   | Rationale                                 |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| **Base Model**      | `Mistral‑7B‑Instruct` (Apache 2)         | Open‑weights, good cost/perf, 8 GB quant. |
| **Adapter Method**  | QLoRA (4‑bit)                            | Minimises GPU RAM; fast nightly tunes.    |
| **Prompt Format**   | Mixture of System / User / Tool messages | Aligns with LangChain chat template.      |
| **Parameter Count** | \~85 M adapter params                    | Fits A10G 24 GB GPU in < 8 GB.            |

Hyper‑parameters (default):

```
learning_rate = 8e‑5
batch_size     = 128
epochs         = 1
warmup_steps   = 50
lora_rank      = 64
```

---

## 5  Fine‑Tune Orchestration Pipeline

```
GitHub Actions (train_adapters.yml)
└─► Fly Job (Docker) – trainer.py
      ├─ sync dataset (Supabase)
      ├─ 🤗 Accelerate fine‑tune
      ├─ eval.py on val set
      ├─ upload adapter → Supabase storage /adapters/{date}.safetensors
      └─ write run row → model_registry
```

*Estimated runtime*: 45 min (A10G), cost ≈ \$2.10/hr.

> **Prompt Block ML1‑TRAIN‑CMD** – "Generate CLI command for QLoRA fine‑tune on model {{model}}, lr {{lr}}, epochs {{ep}}."

---

## 6  Evaluation & Safety Filters

1. **Automated Metrics** – exact‑match accuracy, ROUGE‑L, mean reward.
2. **Safety Classifier** – Lightweight text‑classification head flags PII leakage, hateful content (threshold > 0.4).
3. **Regression Benchmarks** – `benchmarks/*.json` run via `lm‑eval‑harness`; must not lose > 1 pp accuracy on critical tasks.
4. **Human spot‑check** – 25 random samples reviewed by QA weekly.

Promotion rule (pseudo‑SQL):

```sql
SELECT promote_if(
  accuracy_delta  > 0.5 AND
  override_delta  < -1.0 AND
  safety_flag_pct < 0.1 AND
  latency_delta   < 0.05
);
```

---

## 7  Model Registry & Promotion Policy

| Column         | Type        | Description                     |
| -------------- | ----------- | ------------------------------- |
| `adapter_id`   | UUID        | Primary key                     |
| `created_at`   | TIMESTAMPTZ | Training completion time        |
| `metrics_json` | JSONB       | Accuracy, reward, latency, cost |
| `safety_flags` | INT         | Offending samples               |
| `status`       | TEXT        | `candidate`, `prod`, `archived` |

Promotion flow:

1. Candidate meets rule → status `prod`.
2. Supabase Edge Function rotates `MODEL_ENDPOINT` version.
3. Old prod adapter archived after 7 days.

Rollback: change status of previous adapter to `prod`; Edge Function picks up.

---

## 8  Cost Model & GPU Resource Planning

| Tier       | GPU Type | Jobs/night | GPU‑hours | \$ / night | Notes             |
| ---------- | -------- | ---------- | --------- | ---------- | ----------------- |
| Pilot      | A10G     | 1          | 0.75      | \$1.60     | On‑demand spot    |
| Growth     | A10G     | 1          | 1.25      | \$2.70     | Larger dataset    |
| Enterprise | L40S     | 1          | 2.0       | \$4.80     | 2× epochs, 16‑bit |

Budget guard‑rail Prometheus alert: `gpu_train_cost_usd_total > 200` (30‑day roll‑up).

---

## 9  Prompt Blocks & Automation Scripts

| ID                | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| ML1‑SQL‑GEN       | Generate SQL extraction query for dataset slice.              |
| ML1‑TRAIN‑CMD     | Build Hugging Face fine‑tune CLI command.                     |
| ML1‑EVAL‑PROMPT   | Draft System+User prompt for regression benchmark creation.   |
| ML1‑REGISTRY‑TEST | Produce pgTAP tests to validate model\_registry update logic. |

---

## 10  Operational Runbook

1. **Training Fail** – GitHub Action fails; alert Slack `#ml‑ops`; retry with `rerun-failed`.
2. **Safety Flag Surge** – Adapter blocked; investigate new data anomalies; patch filters.
3. **Latency Regress > 5 %** – Rollback to previous adapter; open Jira performance ticket.
4. **Cost Alert** – Review GPU utilisation; switch to spot or scale batch size down.

---

## 11  Future Enhancements & Roadmap

- Migrate to **Flash‑Attention 2** kernels to halve compute time.
- Explore **Mixture‑of‑Experts (MoE)** adapters to reduce inference latency.
- Introduce **continual learning** on streaming data (River library) for online updates.
- Add **metadata‑conditioned training** (tenant vertical) for vertical specialisation.

---

## 12  Revision History

| Version | Date       | Author         | Notes                                       |
| ------- | ---------- | -------------- | ------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of ML pipeline. |

