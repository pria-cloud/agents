# A4 — Data‑Classification & DLP Mapping

**Document status:** Final v1.1 · June 2025  
**Owner:** CEO (Per Swedenborg)

**Purpose:** Define the canonical data‑classification schema and the corresponding Data‑Loss‑Prevention (DLP) controls that apply across PRIA—including all message payloads exchanged via the **Google A2A Gateway** and **MCP** context.  This document underpins RLS policy design (D1), encryption standards (S1 §4), and scanning rules enforced by Edge Functions, Supabase, and the A2A Router.

---

## Table of Contents
1. Classification Model & Definitions  
2. Data Catalogue  
3. Control Matrix (Storage, Transit, Access)  
4. DLP Scanning Rules & Tooling  
5. A2A / MCP Payload Handling  
6. Integration with CI/CD Gates  
7. Audit & Evidence Collection  
8. Open Items / Future Enhancements  
9. Revision History

---

## 1  Classification Model & Definitions
PRIA adopts a **four‑tier classification** aligned with SOC 2 and ISO 27001.

| Class ID | Name          | Definition & Examples                                   | Handling Summary |
| -------- | ------------- | ------------------------------------------------------- | ---------------- |
| **R**    | Restricted    | PII, financial data, auth secrets, JWTs, access tokens  | AES‑256 at rest, row‑level masking, logging scrubbed |
| **I**    | Internal      | Business metadata, workflow context, intent messages    | AES‑256 at rest, RLS by `workspace_id`               |
| **P**    | Public        | Marketing collateral, open‑source code, docs           | No special control beyond checksum hash              |
| **S**    | Sensitive IP | Model weights, proprietary prompts, benchmark data      | Encrypted storage, limited agent scopes              |

> **Rule of Thumb:** Anything containing tenant business records or identifiers is at least **Internal (I)**. If it contains personal or financial info it becomes **Restricted (R)**.

## 2  Data Catalogue *(excerpt)*
| Asset                         | Class | Storage Location                        | Producer               |
| ----------------------------- | ----- | --------------------------------------- | ---------------------- |
| `expense.amount`              | R     | Supabase `expense`                      | Front‑end, Worker      |
| `workspace.name`              | I     | Supabase `workspace`                    | Front‑end              |
| `workflow_event.dag_json`     | I     | Supabase `workflow_event`               | Orchestrator           |
| **A2A Intent payload**        | I     | gRPC stream between Edge Fn ↔ A2A Router| Front‑end, Orchestrator|
| `agent_response.content`      | I/R\* | gRPC stream A2A Router → Agent          | Agent Mesh             |
| Model adapter weights         | S     | Supabase storage `adapters/`            | ML Pipeline            |
| Marketing blog post           | P     | GitHub Pages                            | Marketing              |

\* Classification depends on redaction outcome—response must be scrubbed of PII; otherwise treated as **Restricted (R)**.

## 3  Control Matrix (Storage, Transit, Access)
| Class | At Rest                              | In Transit                | Access Control                                    | Retention |
| ----- | ------------------------------------ | ------------------------- | ------------------------------------------------- | --------- |
| **R** | AES‑256 (Supabase KMS); PITR 7 d      | TLS 1.3; mTLS (gRPC)      | JWT scopes + RLS; audit every access (Loki)       | 7 years   |
| **I** | AES‑256                               | TLS 1.3; mTLS             | JWT scopes; no external logs of values            | 3 years   |
| **S** | AES‑256; envelope key in AWS KMS      | TLS 1.3; signed URL fetch | Limited to `agent` role + `schema:migrate` scope  | 3 months after superseded |
| **P** | SHA‑256 checksum only (integrity)     | HTTPS                     | Public GitHub access                              | ∞         |

## 4  DLP Scanning Rules & Tooling
| Tool / Stage                      | Scope                    | Rule Set                                     | Action on Violation                     |
| -------------------------------- | ------------------------- | ------------------------------------------- | --------------------------------------- |
| **Edge Function `dlp_scan.ts`**  | File uploads, form posts  | Regex credit‑card, IBAN, Swedish SSN        | Block upload, return 422                |
| **Supabase `pg_audit_dlp` ext**  | `INSERT/UPDATE` triggers  | Mask email, detect PII ≥ 80 % confidence    | Abort txn, raise Loki alert             |
| **CI pipeline `semgrep‑dlp`**    | Code & prompt files       | Hard‑coded secrets, JWT, private keys       | Fail PR                                 |
| **A2A Router Hook `dlp_guard`**  | Intent & MCP payloads     | Check `content` field ≤ 10 PII tokens       | Reject intent with 400; metric increment|
| **Agent artefact scanner**       | Agent-generated code & artefacts | DLP scan before PR/preview           | Block PR/preview, log violation         |

All rules reference this specification; pattern definitions live in `dlp/rules.yml`.

**All agent-generated code and artefacts must be scanned for DLP violations before PR/preview.**

## 5  A2A / MCP Payload Handling
1. **Inbound:** Edge Fn `/a2a/intent` scans payload; if PII detected, rejects unless user has `pii:unmask`.  
2. **Routing:** A2A Router labels each gRPC message with `data_class` header (`I` or `R`).  
3. **Agent Contract:** Agents *must* respond with content free of **R** data unless they own `pii:unmask`; otherwise the Router redacts and logs masked segments.  
4. **MCP Context:** Context checksum includes `data_class`; any hand‑off to an agent lacking clearance fails.

**Agents must never emit Restricted data unless they have the correct scope.**

## 6  Integration with CI/CD Gates
- **Semgrep DLP** step runs after unit tests; ruleset from `dlp/semgrep_rules.yaml`.  
- **Fail Threshold:** ≥ 1 critical finding blocks merge.  
- **A2A Contract Tests:** `make test-a2a-dlp` sends synthetic PII through intent pipeline; expect 400.

## 7  Audit & Evidence Collection
| Evidence Artifact                 | Source                       | Frequency   | Drata Control |
| --------------------------------- | ---------------------------- | ----------- | ------------- |
| DLP scan log (`dlp_violation`)    | Loki                         | Real‑time   | CC7.2         |
| Quarterly DLP effectiveness report| SQL to PDF                   | Quarterly   | A.12.6.1      |
| MCP clearance failure metric      | Prometheus `mcp_acl_deny`    | Continuous  | CC6.6         |

## 8  Open Items / Future Enhancements
- Migrate to **Google DLP API** for richer PII detection (Q1 2026).  
- Add **contextual embeddings** to reduce false positives in prompt scanning.  
- Automate **redaction feedback loop** feeding ML fine‑tune (ML1) to improve agent outputs.

## 9  Revision History
| Version | Date       | Author         | Notes                                                         |
| ------- | ---------- | -------------- | ------------------------------------------------------------- |
| 1.1     | 2025‑06‑14 | Per Swedenborg | Added A2A/MCP payload classes, new Router hook, finalised.   |
| 1.0     | 2025‑06‑12 | Per Swedenborg | First comprehensive draft.                                   |

