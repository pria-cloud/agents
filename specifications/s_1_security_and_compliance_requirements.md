# S1 — Security & Compliance Requirements

**Document status:** Final v1.0 · June 2025  
**Owner:** CEO (Per Swedenborg)  
**Purpose:** Establish mandatory security controls, evidence‑collection procedures, and audit mappings that govern every layer of PRIA, ensuring we achieve and maintain SOC 2 Type II and ISO 27001 certifications on schedule.  This specification is the canonical source for risk assessment, control objectives, and implementation tasks that subordinate specs (A1, A2, D1, W1–W3, etc.) must satisfy.

---

## Table of Contents
1. Scope & Objectives
2. ISMS Scope Statement
3. Control Matrix
4. Encryption Standards
5. Logging & Monitoring
6. Vulnerability & Patch Management
7. Incident‑Response Plan
8. Change‑Management & Release Controls
9. Audit Timeline & Assessor Engagement
10. Open Items / Future Enhancements

---

## 1  Scope & Objectives
1. Define the Information‑Security Management System (ISMS) scope and control set.  
2. Map technical controls to SOC 2 Trust Services Criteria (Security, Availability, Confidentiality, Processing Integrity, Privacy) and ISO 27001 Annex A.  
3. Specify control owners, evidence types, collection frequency, and storage location (Drata).  
4. Document incident‑response, vulnerability‑management, and change‑management procedures.  
5. Provide baseline configurations for MFA, logging, encryption, and network segmentation.  
6. Outline the audit timeline and external assessor engagement plan.

## 2  ISMS Scope Statement
**In scope:**  All PRIA production services hosted on Vercel, Supabase, Fly.io, Grafana Cloud, GitHub repositories (`pria‑cloud/*`), CI pipelines, corporate Google Workspace, and employee‑managed endpoints that access production.  
**Out of scope (Phase 1):**  Marketing website (static), contractor laptops, non‑production sandboxes older than 90 days.

## 3  Control Matrix (excerpt)
| #  | SOC 2 TSC | ISO 27001 Control | Control Name                               | Description / Implementation Reference                                       | Control Owner | Evidence Frequency | Tool / Location |
| -- | --------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------- | ------------------ | --------------- |
| S1 | CC6.1     | A.8.1.1           | Multi‑Factor Authentication                | All privileged access (Okta, Supabase admin, Vercel team) requires MFA.     | Security Lead | Continuous via Drata | Okta > Drata   |
| S2 | CC6.6     | A.12.6.1          | Vulnerability Scanning                     | Monthly Semgrep SaaS scan; critical CVEs patched within 7 days.              | DevOps Lead   | Monthly            | Semgrep > Jira  |
| S3 | CC7.2     | A.13.2.1          | Encryption in Transit                      | TLS 1.3 enforced for external endpoints; mTLS for Cortex ↔ Worker gRPC.      | Backend Lead  | Quarterly sample   | Vercel TLS logs |
| S4 | CC8.1     | A.8.2.3           | Data Classification & RLS Enforcement      | `Data‑Flow Matrix` classes; RLS policies audited via pgAudit weekly.         | DBA           | Weekly             | Grafana panel   |
| S5 | PI1.4     | A.12.4.1          | Change‑Management Workflow                 | GitHub PR + 1 review; `ci.yml` enforces tests; `release.yml` tags.           | CTO           | Continuous         | GitHub API      |
| S6 | A1.2      | A.16.1.5          | Incident‑Response SLA                      | Page within 5 min, resolution summary ≤ 24 h, root cause Jira ticket.         | On‑call Eng   | Per incident       | PagerDuty / Jira |
| S7 | CONF1     | A.9.2.1           | Least‑Privilege IAM                        | Okta group mapping matrix (A2 §4.2) enforced; quarterly access review.       | CFO           | Quarterly          | Drata review    |
| S8 | AVAIL1    | CC3.3             | SLO Monitoring & Alerting                 | p95 latency & uptime dashboards, alert if error ratio > 0.1 %.               | DevOps Lead   | Continuous         | Grafana         |
| S9 | PRIV1     | A.18.1.4          | Data Subject Request (DSR) Handling        | Edge Function `/admin/workspace/:id` fulfills export/delete ≤ 30 days.       | Data Officer  | Per request        | Supabase logs   |

*(Full control matrix lives in Drata; IDs above cross‑reference Drata control IDs.)*

## 4  Encryption Standards
| Asset Class                  | At Rest                                     | In Transit          | Key Rotation Policy | Notes |
| ---------------------------- | ------------------------------------------- | ------------------- | ------------------- | ----- |
| Postgres data | AES‑256 (Supabase KMS) + 7‑day WAL PITR | TLS 1.3 / pgwire | Rotate keys every 365 days | Column‑level AES via pgcrypto for PII |
| Object storage (receipts) | AES‑256 (Supabase storage) | HTTPS | Rotate keys every 180 days | S3‑compatible bucket, server‑side |
| LLM prompts & outputs | Supabase KV (AES‑256‑GCM) | gRPC (mTLS) | Rotate adapters every 90 days | Prompts redacted of PII |
| Secrets (API tokens, JWT) | Supabase Secrets KV (AES‑256) | — | Rotate every 30 days via script | Rotated by A2‑SECRET‑GEN script |
| Object storage (receipts)   | AES‑256 (Supabase storage)                  | HTTPS               | 180 days            | S3‑compatible bucket, server‑side. |
| LLM prompts & outputs        | Supabase KV encrypted w/ AES‑256‑GCM        | gRPC (mTLS)         | 90 days             | Prompts redacted of PII. |
| Secrets (API tokens, JWT)   | Supabase Secrets KV (AES‑256)               | N/A                 | 30 days via script  | Rotated by A2‑SECRET‑GEN script. |

## 5  Logging & Monitoring
| Source             | Transport       | Retention | Alert Thresholds           |
| ------------------ | -------------- | --------- | --------------------------- |
| Vercel Edge logs   | Loki (Grafana) | 30 days   | 5xx > 1 % requests/min      |
| Supabase DB audit  | pgAudit → Loki | 90 days   | RLS violation events > 0    |
| Fly app logs       | OTEL → Loki    | 30 days   | Panic / traceback > 0       |
| OTLP traces        | OTEL → Tempo   | 14 days   | Unmatched spans > 2 %       |
| Prometheus metrics | OTLP → Prometheus Remote Write | 13 months | SLO breach, Perf regressions

## 6  Vulnerability & Patch Management
1. **Static Analysis** – Semgrep SaaS, OWASP profile, run on every PR; block merge on High findings.  
2. **Dependency Scanning** – Dependabot auto‑PRs weekly; GitHub Action runs `pip‑audit` and `npm audit`.  
3. **Container Scans** – Trivy scan in `ci.yml`; block if Critical.  
4. **Patch SLAs** – Critical 7 days, High 14 days, Medium 30 days.

## 7  Incident‑Response Plan

### 7.1  Phases & Targets
| Phase ID | Phase Name                 | Target Time (SLA)             | Primary Owner  | Key Activities                                                         |
|---------|---------------------------|------------------------------|----------------|------------------------------------------------------------------------|
| **D**  | **Detect**                | *Continuous* (via alerts)    | Monitoring (DevOps) | Grafana/Loki/PagerDuty alert triggers; verify signal validity. |
| **A**  | **Acknowledge & Triage**  | ≤ 5 min from alert           | On‑call Engineer | Acknowledge PagerDuty; gather initial metrics; classify severity (P1–P3). |
| **C**  | **Contain & Communicate** | ≤ 15 min for P1, ≤ 30 min for P2 | Security Lead   | Disable compromised keys; flip feature flag; open incident Slack channel; inform CEO if P1. |
| **E**  | **Eradicate & Recover**   | ≤ 4 h for P1, ≤ 12 h for P2  | DevOps Lead     | Patch, hot‑fix, or roll‑back deployment; validate via smoke tests; restore SLO. |
| **R**  | **Review & Improve**      | Draft RCA ≤ 24 h; closed ≤ 14 d | Incident Manager (rotating) | Write post‑mortem in Confluence; file Jira actions; update runbooks; Drata evidence. |

> **Severity Definition:**  
> • **P1** – Data breach, multi‑tenant leakage, or > 5 % customer impact.  
> • **P2** – SLO breach for single tenant or security control failure without data leak.  
> • **P3** – Non‑customer‑visible bug or tooling outage.

### 7.2  Communication Matrix (RACI)
| Role              | Detect | Acknowledge | Contain | Recover | Review |
|-------------------|--------|-------------|---------|---------|--------|
| On‑call Engineer  | R      | A           | S       | S       | C |
| Security Lead     | C      | C           | A/R     | C       | A |
| DevOps Lead       | C      | C           | C       | A/R     | C |
| CEO (Exec Comms)  | I      | I           | I       | C       | C |
| Data‑Protection Officer | I | I           | C       | C       | R |

*R = Responsible, A = Accountable, C = Consulted, I = Informed, S = Support.*

### 7.3  Tooling & Evidence Collection
| Artifact                    | Captured Where                | Retention | Audit Mapping |
|-----------------------------|-------------------------------|-----------|---------------|
| PagerDuty timeline          | PagerDuty API                 | 2 years   | SOC 2 CC7.1   |
| Slack incident channel logs | Loki (Slack export pipeline)  | 1 year    | ISO 27001 A.16.1 |
| Grafana metrics snapshot    | Grafana Cloud snapshot API    | 1 year    | CC3.3         |
| Post‑mortem document        | Confluence “Incidents” space  | Permanent | CC3.2, A.16.1.6 |
| Drata evidence entry        | Linked to incident ticket     | Permanent | All relevant TSC |

### 7.4  Escalation & External Notification
* **Breach involving PII or cross‑tenant data** → Notify Data‑Protection Officer within 30 min; initial regulator notice within 72 h (GDPR Art.33).  
* **Major outage > 4 h** → Customer email update every 2 h and status page.  
* **Third‑party sub‑processor incident** → Engage vendor CISO hotline; reference vendor DPAs.

### 7.5  Training & Drills
* **Quarterly** – Table‑top exercise covering P1 data‑leak scenario.  
* **Bi‑annual** – Full red‑team / blue‑team incident simulation with metric capture.

---
## 8  Change‑Management & Release Controls

Effective change management reduces production incidents, enforces segregation‑of‑duties, and supplies an auditable trail for SOC 2 and ISO 27001 assessors.

### 8.1  Policy Overview
1. **Infrastructure‑as‑Code (IaC) Only** — All cloud resources are provisioned via Terraform (A2). Manual console changes are forbidden; CI lints state drift daily.
2. **Peer Review** — Every pull request must receive one approving review from an engineer *not* authoring the change. GitHub branch‑protection enforces this.
3. **Automated Gates** — CI must pass unit, integration, pgTAP, Harness tests; coverage ≥ 80 %. Release workflow blocks if any check fails.
4. **Separation of Duties** — Only DevOps role can merge infra PRs; only Security Lead can approve production secrets rotation.
5. **Rollback First‑Class** — Release workflow auto‑builds a `*‑rollback.sh` script that reverts web + agents + DB migrations.
6. **Change Calendar Freeze** — No non‑urgent production changes Thursday 18:00 UTC → Monday 06:00 UTC during quarter‑close windows.

### 8.2  Release Workflow (`release.yml`)
| Step | Job | Required? | Evidence |
|------|-----|-----------|----------|
| 1 | `build` – Docker, Vercel preview | ✔ | GitHub Action logs (Drata) |
| 2 | `test` – unit, Jest, pgTAP | ✔ | JUnit XML artifact |
| 3 | `harness` – run W3 agent | ✔ | `HarnessResponse JSON` compressed & uploaded |
| 4 | `security_scan` – Semgrep, Trivy | ✔ | SARIF artefact; High/Critical = fail |
| 5 | `tag_release` – Git tag `vX.Y.Z` | ✔ | Git tag sig + SHA256 |
| 6 | `deploy_web` – `vercel deploy --prod` | ✔ | Vercel deployment ID |
| 7 | `deploy_agents` – `fly deploy` | ✔ | Fly release ID |
| 8 | `apply_migrations` – `supabase db push` | Conditional (DDL) | Migration ID in `schema_versions` |
| 9 | `post_release_smoke` – `make smoke` | ✔ | Prometheus push metric |
| 10 | `notify` – Slack & Email | ✔ | Slack message link |

### 8.3  Emergency Patch Flow (P1‑P2)
* **E‑branch** prefixed branch bypasses freeze but still requires reviewer acknowledgment and automated gates minus load tests. PagerDuty ticket cross‑linked.

### 8.4  Change Approval Matrix (RACI)
| Change Type                       | Engineer | DevOps Lead | Security Lead | CTO | CEO |
|----------------------------------|----------|-------------|---------------|-----|-----|
| **Code (non‑security)**          | A        | C           | I             | R   | I   |
| **Code (security hot‑fix)**      | C        | C           | A             | R   | I   |
| **Database migration**           | C        | A           | C             | R   | I   |
| **Secrets rotation**             | C        | C           | A             | R   | I   |
| **Infra (Terraform)**            | C        | A           | C             | R   | I   |
| **Policy / Config freeze**       | I        | C           | A             | R   | A   |

### 8.5  Evidence Collection
| Evidence Type               | Source                 | Frequency | Drata Control ID |
|-----------------------------|------------------------|-----------|------------------|
| Pull‑request review log     | GitHub GraphQL API     | Per PR    | CC8.1.2          |
| CI build artefact checksum  | GitHub Action upload   | Per build | CC8.1.3          |
| Migration SHA & checksum    | `schema_versions` table| Per deploy| PI1.4            |
| Release sign‑off Slack card | Slack incident channel | Per release| CC6.2            |

---
## 9  Audit Timeline & Assessor Engagement
| Month | Milestone                                  | External Partner | Deliverable |
|-------|--------------------------------------------|------------------|-------------|
| 0     | ISMS kickoff                               | BARR Advisory    | Gap‑analysis report |
| 2     | Policies ratified; evidence streams live   | —                | Drata board review |
| 4     | SOC 2 Type I field‑work                    | BARR             | Type I report |
| 10    | Observation window close                   | —                | Evidence compiled |
| 11    | SOC 2 Type II field‑work                   | BARR             | Type II report |
| 12    | ISO 27001 Stage 1 audit                    | Schellman        | Stage 1 report |
| 18    | ISO 27001 Stage 2 audit (certification)    | Schellman        | ISO certificate |

### 9.1  Budget Snapshot (18 mo)
| Item                          | Cost (USD) |
|-------------------------------|------------|
| BARR SOC audits (Type I & II) | 32 000     |
| Schellman ISO 27001           | 28 000     |
| Drata subscription            | 9 600      |
| Pen‑tests (HackerOne)         | 8 000      |
| **Total**                     | **77 600** |

---
## 10  Open Items / Future Enhancements
- Implement `pg_audit` extension log‑shipping to BigQuery for long‑term (7 year) retention (SOX).  
- Add SCIM user‑provisioning drift checks weekly.  
- Formalise Business Continuity Plan (BCP) & Disaster Recovery playbook with RPO ≤ 5 min, RTO ≤ 30 min (links to A1).  
- Migrate mTLS certificates to automated cert‑manager (Fly.io) before SOC 2 Type II window.

---
**Revision History**
| Version | Date       | Author         | Notes                              |
| ------- | ---------- | -------------- | ---------------------------------- |
| 0.2     | 2025-06-12 | Per Swedenborg | Completed Change Mgmt & Audit Timeline |
| 1.0 | 2025-06-12 | Per Swedenborg | Marked Final; added TOC and cleaned encryption table |
| 0.3 | 2025-06-12 | Per Swedenborg | Updated status to v0.2; added Prometheus retention & WAL PITR |

