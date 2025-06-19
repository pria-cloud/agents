# GitHub Naming Standards for PRIA

**Document status:** Draft v0.1 · June 2025  
**Author:** Per Swedenborg (CEO)  
**Purpose:** Recommend a clear, future‑proof naming convention for our GitHub presence—covering the organisation (user) name and the initial repository layout—so that engineers, partners, and OSS consumers can navigate PRIA code effortlessly.

---

## 1  Organisation (user) Name
| Candidate | Rationale | Decision |
|-----------|-----------|----------|
| `pria-cloud` | Matches product brand + SaaS nature; available; reads well in package names (e.g., `@pria-cloud/sdk`). | **Selected** |
| `pria` | Short, but likely squatted; ambiguous search results. | — |
| `getpria` | Common growth-hack prefix; less professional for enterprise buyers. | — |

> **Chosen handle:** **`github.com/pria-cloud`** (Organisation account).  Use GitHub Teams for role segmentation (`Backend`, `Platform`, `DevRel`, etc.).

---

## 2  Top‑Level Repository Layout
| Repository | Purpose | Visibility | Notes |
|------------|---------|------------|-------|
| `infra` | Terraform modules, bootstrap scripts, CI runners | Public | Referenced in A2 Cloud Foundation. Clone URL: `git@github.com:pria-cloud/infra.git`. |
| `web` | Next.js front‑end (`apps/web`) | Public | Mirrors Vercel build. |
| `orchestrator` | Cortex Orchestrator (Go) | Public | gRPC API, task leasing. |
| `worker` | WorkerService (Rust) | Public | Step execution runtime. |
| `agent-mesh` | AgentService (Python + vLLM) | Public | Includes ML1 fine‑tune pipeline code. |
| `docs` | Marketing & technical docs (MkDocs + Material) | Public | GitHub Pages site `docs.pria.cloud`. |
| `specs` | All Markdown specs (A‑*, S‑*, etc.) exported from canvas | Public | Source of truth; version tags align with releases. |
| `extensions` | Official marketplace connectors & samples | Public | Sub‑dirs per connector; MIT license. |
| `playbooks` | Operational runbooks, k6 scripts, incident templates | Private | Contains sensitive infra details. |

> **Monorepo vs Polyrepo:** Adopt *polyrepo* for clearer CI scopes and to keep OSS surface modular. Future consideration: aggregate via GitHub Org‑level Code Search.

---

## 3  Naming Conventions & Branch Rules
* **Repo names**: lowercase, hyphen‑separated (`agent-mesh`).
* **Branches**: `main` (protected) + `feat/*`, `fix/*`, `hotfix/*`, `release/*`—per C1 CI/CD Playbook.
* **Tags:** Semantic (`v1.2.0`); additional environment tags (`pilot‑2025‑06‑12`).

---

## 4  Next Steps
1. Register organisation *pria-cloud*; enable SSO & MFA enforcement.
2. Create the eight initial repos (public by default, except `playbooks`).
3. Import existing codebases; update CI badges & README.
4. Sync repository links in A‑series specs and C1 Playbook.

---

## Revision History
| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2025‑06‑13 | Per Swedenborg | Initial recommendation for GitHub org & repos. |

