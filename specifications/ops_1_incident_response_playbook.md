# OPS1 — Incident Response & On‑Call Playbook

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Provide an end‑to‑end, actionable incident‑response framework that combines detection, triage, containment, communication, remediation, and post‑incident analysis.  This playbook extends the high‑level requirements in **S1** and augments observability hooks from **O1**, giving every PRIA engineer the exact steps, tools, and SLAs needed to resolve incidents within minutes—not hours.

---

## Table of Contents

1. Guiding Principles
2. Severity Classification Matrix
3. Incident Lifecycle (DA‑CER)
4. Roles & Responsibilities (RACI)
5. On‑Call Schedule & Escalation Paths
6. Tooling & Integrations
7. Playbooks by Incident Type
8. Communication Protocols & Templates
9. Metrics, KPIs & Continuous Improvement
10. Training, Drills & Certification
11. Prompt Blocks & Automation Scripts
12. Revision History

---

## 1  Guiding Principles

1. **Customer Centric.** Protect tenant data integrity & availability above all.
2. **Automated & Observable.** 90 % of incidents auto‑detected by metrics/log alerts rather than customer tickets.
3. **Single Source of Truth.** All evidence & communications flow through PagerDuty + Slack + Jira integrations.
4. **Time‑boxed.** Follow the SLA clock *immediately* upon alert; optimise for MTTR < 30 min (P1).
5. **Blameless Post‑Mortems.** Focus on systemic fixes, not individual fault.

---

## 2  Severity Classification Matrix

| Sev    | Impact Description                                                            | Examples                                                          | SLO Breach? | External Comms         | Target MTTA | Target MTTR |
| ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | ---------------------- | ----------- | ----------- |
| **P1** | Cross‑tenant data leak, prod outage > 5 % customers, security breach with PII | DB credential leak; workflow engine down cluster‑wide             | Yes         | Status page, CEO email | ≤ 5 min     | ≤ 30 min    |
| **P2** | Single‑tenant outage, critical feature degraded, no data loss                 | Pilot Supabase disk full; AI inference returns 5xx for 20 % calls | Possibly    | Status page (if > 1 h) | ≤ 10 min    | ≤ 2 h       |
| **P3** | Non‑critical bug, degraded performance, workaround exists                     | Billing latency 2×; Dashboard widget broken                       | No          | Optional               | ≤ 60 min    | ≤ 24 h      |
| **P4** | Informational, monitoring false‑positive                                      | Flaky Playwright alert; transient spike resolved automatically    | No          | None                   | —           | —           |

---

## 3  Incident Lifecycle — **DA‑CER Model**

1. **Detect** (auto‑alert from Grafana/PagerDuty).
2. **Acknowledge** (on‑call engineer in PagerDuty).
3. **Contain** (stop bleeding: rollback deploy, disable feature flag).
4. **Communicate** (update status page, Slack `#inc‑channel`, customer email if P1).
5. **Eradicate** (permanent fix: patch, infra scale, hot‑config).
6. **Recover** (validate SLO, smoke tests, close PagerDuty).
7. **Review** (RCA within 24 h, Jira actions, Drata evidence link).

*Checklist in ****\`\`**** generated via Prompt OPS1‑CHECKLIST‑GEN.*

---

## 4  Roles & Responsibilities (RACI)

| Role                     | Detect | Ack | Contain  | Communicate  | Eradicate | Review |
| ------------------------ | ------ | --- | -------- | ------------ | --------- | ------ |
| **On‑call Engineer**     | R      | A   | S        | C            | S         | C      |
| **DevOps Lead**          | C      | C   | A/R      | C            | A/R       | C      |
| **Security Lead**        | C      | C   | A for P1 | C\*          | C         | A      |
| **Product Manager (PM)** | I      | I   | C        | A for non‑P1 | C         | C      |
| **CEO / Exec**           | I      | I   | I        | R for P1     | I         | I      |

> *Security Lead owns customer/regulator comms for data‑breach scenarios.*

---

## 5  On‑Call Schedule & Escalation Path

- **Primary rotation:** Eng team, 1‑week shifts, follows `Europe/Stockholm` 24×7 coverage (remote).
- **Secondary:** DevOps Lead, escalated if no ack within 5 min (PagerDuty Auto‑Escalate).
- **Tertiary:** CTO pager group.
- PagerDuty schedule ID `PD12345`; overrides use `/override` Slack command.

Escalation Ladder:

```
P1  –> Primary (5 min) –> Secondary (5 min) –> CTO (pager) –> CEO SMS
P2  –> Primary (10 min) –> Secondary (10 min) –> CTO Slack mention
P3+ –> Primary (60 min) –> Jira ticket; handled next business day
```

---

## 6  Tooling & Integrations

| Tool                            | Purpose                                  | Key Config                         |
| ------------------------------- | ---------------------------------------- | ---------------------------------- |
| **PagerDuty**                   | Alert routing, on‑call scheduling        | Service = `pria‑prod`              |
| Escalation policies = `EP‑PROD` |                                          |                                    |
| **Grafana Cloud**               | Metrics & SLO alerts                     | Alertmanager route → PD Webhook    |
| **Loki & Tempo**                | Log & trace triage                       | `traceID` link in alert panel      |
| **Statuspage.io**               | Customer‑visible status updates          | Auto‑open incident from PD P1      |
| **Slack (**\`\`**)**            | Real‑time comms, /pd, /opsgenie commands | Google Chat fallback               |
| **Jira**                        | RCA template, action items               | Project `INC`, workflow `Incident` |
| **Confluence**                  | Incident post‑mortem docs                | Auto‑create by Jira automation     |
| **Drata**                       | Evidence collection                      | PD + Jira integration              |

Secrets & keys for PD, Statuspage stored in Supabase KMS.

---

## 7  Playbooks by Incident Type

### 7.1  Service Degradation (HTTP 5xx Spike)

1. **Detect** – Alert `api_error_ratio > 0.5 %`.
2. **Contain** – Rollback recent Vercel & Fly deploys (`vercel rollback`, `fly releases revert`).
3. **Communicate** – Statuspage component `API` → *“Partial Outage”*.
4. **Eradicate** – Identify root cause via trace exemplars; patch bug.
5. **Recover** – Re‑deploy, confirm p95 latency < 300 ms.
6. **Review** – RCA template filled.

### 7.2  Database Out‑of‑Storage

1. **Detect** – Alert `db_disk_usage_pct > 85 %`.
2. **Contain** – Switch Supabase plan to next tier via API; enable autovacuum FULL.
3. **Communicate** – Send customer email if downtime expected.
4. **Eradicate** – Identify bloated tables; add partitioning or VACUUM.
5. **Recover** – Smoke tests; remove read‑only flag.

### 7.3  Security Breach (Suspected JWT Theft)

1. **Detect** – Security alert `auth_failed_scope_checks > 10/min`.
2. **Contain** – Revoke suspect JWT in Supabase; force sign‑out (`global_sign_out`).
3. **Comm** – Security Lead → DPO, CEO; regulator notice timer starts.
4. **Eradicate** – Rotate secrets; patch vulnerability.
5. **Recover** – Post‑incident comms & RCA.

*(Additional playbooks in ****\`\`**** directory.)*

---

## 8  Communication Protocols & Templates

### 8.1  Internal Slack Update (P1)

```
🚨 *P1 INCIDENT* — {{title}}
Time: {{timestamp}}
Lead: <@{{oncall}}>
Impact: {{impact_summary}}
Next Update: +15 min
Root‑Cause Status: Investigating
```

### 8.2  Statuspage Template

```
We are investigating increased error rates on the PRIA API affecting ~X % of requests. Next update in 15 minutes.
```

### 8.3  Customer Email (Post‑Mortem)

```
Subject: PRIA Incident {{inc_id}} – Post‑Incident Report
Body: Timeline, impact, root cause, remediation, prevention steps.
```

---

## 9  Metrics, KPIs & Continuous Improvement

| KPI                             | Target                    | Data Source  | Review Cadence |
| ------------------------------- | ------------------------- | ------------ | -------------- |
| **Mean Time To Ack** (MTTA)     | ≤ 5 min (P1)              | PagerDuty    | Monthly        |
| **Mean Time To Recover** (MTTR) | ≤ 30 min (P1), ≤ 2 h (P2) | PD + Grafana | Monthly        |
| **Change Fail Rate**            | < 10 %                    | CI/CD logs   | Quarterly      |
| **Post‑Mortem Completion**      | 100 % P1/P2 within 24 h   | Jira         | Quarterly      |
| **Drill Participation**         | 100 % on‑call             | Confluence   | Quarterly      |

Grafana dashboard `inc_overview` tracks MTTA/MTTR trend lines and CRR (change‑related failure rate).

---

## 10  Training, Drills & Certification

- **Quarterly Tabletop** – Run through worst‑case P1 scenario with full team.
- **Bi‑annual Red/Blue Exercise** – Simulated data‑exfil attack.
- **On‑Call Certification** – Engineers complete PagerDuty University + runbook quiz.
- **Incident Commander Workshop** – For DevOps Leads and Security Leads.

---

## 11  Prompt Blocks & Automation Scripts

| ID                   | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| OPS1‑CHECKLIST‑GEN   | Generate Markdown checklist for incident {{sev}}.                               |
| OPS1‑RUNBOOK‑BOT     | LLM agent summarises Grafana + Loki logs to propose root cause during incident. |
| OPS1‑POST‑MORTEM‑GEN | Draft Confluence post‑mortem from PagerDuty JSON.                               |

> **Prompt OPS1‑POST‑MORTEM‑GEN**\
> *System:* “Given PagerDuty `incident.json` and Grafana snapshot URL, produce a post‑mortem doc including timeline, impact, root cause, corrective actions.”

---

## 12  Revision History

| Version | Date       | Author         | Notes                                       |
| ------- | ---------- | -------------- | ------------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of IR playbook. |

