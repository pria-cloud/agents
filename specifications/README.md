# PRIA Specification Suite — Master Index

**Document status:** Living Document · Generated June 2025  
**Maintainer:** Architecture Guild  
**Purpose:** Provide a single, navigable catalogue of every formal specification that governs the PRIA platform. Each entry links to the authoritative canvas document, its current version, owner, and change‑control status.

---

## 1  Architecture (A‑Series)

| ID  | Title                                          | Version | Owner | Notes |
|-----|------------------------------------------------|---------|-------|-------|
| A1  | Platform Architecture Overview                | **Final v1.0** | CEO | End‑to‑end context & trust boundaries |
| A2  | Cloud Foundation Playbook                      | Draft v0.1 | CEO | Terraform modules & bootstrap scripts |
| A3  | Access‑Control & Role Catalogue                | **Final v1.0** | CEO | Roles → Scopes → RLS matrix |
| A4* | **(TBD)** Data Classification & Masking        | —       | CISO | Planned Q3 2025 |

## 2  Workflow & Agent Layer (W‑Series)

| ID  | Title                                   | Version | Owner | Notes |
|-----|-----------------------------------------|---------|-------|-------|
| W1  | Cortex Workflow DSL Reference           | Draft v0.1 | CEO | JSON Schema & step semantics |
| W2  | Workflow Composer Agent Spec            | Draft v0.1 | CEO | LLM prompt architecture |
| W3  | Test‑Harness Agent Spec                 | Draft v0.1 | CEO | Coverage & pgTAP integration |

## 3  Data & ML Layer (D‑ & ML‑Series)

| ID  | Title                                   | Version | Owner | Notes |
|-----|-----------------------------------------|---------|-------|-------|
| D1  | Data Model & Tenancy Spec               | Draft v0.2 | CEO | Logical & physical schema |
| D2  | Schema Synthesiser Agent Contract       | Draft v0.1 | CEO | Safe DDL generation |
| ML1 | Learning Loop & Fine‑Tune Pipeline Spec | Draft v0.1 | CEO | Nightly QLoRA adapters |

## 4  Operations & Quality (O‑, QA‑, OPS‑Series)

| ID  | Title                                 | Version | Owner | Notes |
|-----|---------------------------------------|---------|-------|-------|
| O1  | Observability & Telemetry Spec        | Draft v0.1 | CEO | OTEL → Grafana Cloud |
| O2  | FinOps & Cost Optimisation Guide      | Draft v0.1 | CEO | Tag taxonomy & budget alerts |
| QA1 | Testing & QA Strategy                 | Draft v0.1 | CEO | Test pyramid & CI gates |
| OPS1| Incident Response & On‑Call Playbook  | Draft v0.1 | CEO | DA‑CER lifecycle |

## 5  Security & Compliance (S‑Series)

| ID  | Title                              | Version | Owner | Notes |
|-----|------------------------------------|---------|-------|-------|
| S1  | Security & Compliance Requirements | **Final v1.0** | CEO | SOC 2 / ISO control matrix |
| S2  | Business Continuity & DR Plan      | Draft v0.1 | CEO | RTO/RPO & fail‑over drills |

## 6  API Layer (API‑Series & C‑Series)

| ID   | Title                               | Version | Owner | Notes |
|------|-------------------------------------|---------|-------|-------|
| API1 | North‑Bound API Contract            | Draft v0.1 | CEO | REST + GraphQL surface |
| API2 | South‑Bound Internal API Contract   | Draft v0.1 | CEO | gRPC micro‑service APIs |
| C1   | CI/CD Pipeline Playbook             | Draft v0.1 | CEO | GitHub Actions & promotion flow |

## 7  Marketplace & Extensions (M‑ & I‑Series)

| ID  | Title                                   | Version | Owner | Notes |
|-----|-----------------------------------------|---------|-------|-------|
| M1  | Marketplace & Extensibility Framework   | Draft v0.1 | CEO | Extension manifest & install flow |
| I1  | Integration & Connector Inventory       | Draft v0.1 | CEO | Wave 1–3 connectors catalogue |

---

### Legend
* **Final** — baseline frozen; changes via formal RFC.  
* **Draft** — subject to rapid iteration; AI agent may auto‑update.  
* **TBD** — placeholder; not yet authored.

> **Change‑Control:** Update *this index* whenever a spec is added, version‑bumped, or status changes.  Include link to canvas ID for traceability.



