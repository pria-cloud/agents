# F2 — Workspace App Preview Requirements Specification

**Document status:** Draft v1.0 · June 2025\
**Author:** Per Swedenborg

**Purpose:** Define the functional, non‑functional, and technical requirements that allow every customer workspace in **PRIA** to launch a live **"npm run dev"‑style preview** of its generated app straight from the Admin Console.  The preview should run **inside the customer's browser via StackBlitz WebContainers** whenever possible, with an automatic fallback to PRIA's Remote Preview service (Docker/K8s) for projects that cannot execute in‑browser.

---

## Table of Contents

1. Scope & Objectives
2. Technology Stack
3. Architecture Overview
4. Functional Requirements
5. Non‑Functional Requirements
6. System Components
7. Security & Hardening
8. Operational Considerations
9. Acceptance Criteria
10. Revision History

---

## 1  Scope & Objectives

- **One‑click preview** — Customers click **Preview** next to any workspace app and see the dev server in ≤ 2 s on a desktop Chromium browser.
- **Primary path:** Run the dev server (Vite, Next.js, etc.) **entirely in‑browser** via WebContainers to eliminate backend compute cost and provide instant hot‑reload.
- **Fallback path:** Seamlessly redirect to a **Remote Preview** pod (Docker on K8s) when the project exceeds WebContainer limits (native Node add‑ons, > 512 MB snapshot, or unsupported browser).
- **Zero data leakage** — All previews must respect workspace‑level auth (JWT with `workspace_id`) and Supabase RLS.

---

## 2  Technology Stack

| Layer                   | Choice / Version                       | Rationale                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------ |
| In‑browser runtime      | **StackBlitz WebContainers • Node 20** | Boots dev server in <1 s; HMR included.    |
| Preview Controller (UI) | React 19 hook in PRIA Admin Console    | Orchestrates boot/mount, streams logs.     |
| Snapshot Builder        | Node (AWS Lambda)                      | Assembles project tarball; filters assets. |
| Remote Preview service  | Docker • Kubernetes • Vite/Next.js     | Identical dev environment for heavy apps.  |
| Auth & Data             | Supabase JWT • RLS                     | Same model as production apps.             |
| Observability           | OpenTelemetry JS SDK → Grafana Cloud   | Track boot ms, mount ms, errors.           |

---

## 3  Architecture Overview

```mermaid
graph TD
  A["Admin Console / Preview Button"] -->|1 request| B["Preview Controller"]
  B -->|2 boot() + mount()| WC["WebContainer Runtime"]
  WC -->|3 server-ready:url| B
  B -->|4 iframe.src = url| IFRAME["Preview Iframe"]
  B -->|error / timeout| RP["Remote Preview Service"]
  RP -->|5 signed URL| IFRAME
```

- **Happy path (1‑4):** The dev server runs in‑browser; iframe shows the WebContainer URL.
- **Fallback (5):** Controller spins up a Docker pod and reloads the iframe with a signed preview URL.

---

## 4  Functional Requirements

| Ref      | Requirement                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **F‑01** | Preview loads inside the iframe within **2 seconds** (p75) for projects ≤ 150 KB snapshot.                                                    |
| **F‑02** | WebContainer `stdout/stderr` stream to a console pane in real time.                                                                           |
| **F‑03** | Edits in PRIA's editor call `webcontainer.fs.writeFile` and trigger HMR < 250 ms.                                                             |
| **F‑04** | Preview iframe origin is `https://preview.pria.app/<workspace>/<app>/<session>` and is valid only while the tab is open (no permanent links). |
| **F‑05** | If `server‑ready` has not fired after **20 s** or emits `error`, the system falls back to Remote Preview automatically.                       |
| **F‑06** | Remote Preview pods auto‑terminate **60 min** after last request.                                                                             |
| **F‑07** | Administrators can toggle WebContainers on/off per workspace (feature flag).                                                                  |

**All previews, whether in-browser or remote, must enforce workspace isolation, Supabase RLS, and compliance checks.**

---

## 5  Non‑Functional Requirements

- **Performance** — < 2 s Time‑to‑First‑Frame (TTFF) median; < 250 ms HMR latency mean.
- **Browser support** — Desktop Chrome ≥ 115, Edge ≥ 115, Safari ≥ 16.4, Firefox Dev Edition. Mobile = best‑effort.
- **Resource limits** — Warn at 400 MB snapshot; hard fail to Remote Preview at 512 MB or when native `.node` add‑ons are detected.
- **Availability** — 99.5 % monthly success rate (includes fallback path).
- **Compliance** — Self‑hosted StackBlitz Enterprise deployment must operate inside PRIA's VPC when required by governance.

---

## 6  System Components

| Component                | Technology / Key APIs        | Responsibilities                                                                            |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------- |
| **WebContainer Runtime** | `@webcontainer/api`          | Boot Node 20, mount FS, spawn `npm run dev`, emit `server‑ready`.                           |
| **Preview Controller**   | React hook (`useWebPreview`) | Orchestrate boot/mount, debounce writes, handle fallback, stream logs.                      |
| **Snapshot Builder**     | Lambda (`node18.x`)          | Build tarball from repo path; exclude `.git`, tests, large media; return buffer to browser. |
| **Remote Preview Pods**  | Docker • Vite/Next.js in K8s | Provide dev server for heavy/native projects; register URL in Redis; sign short‑lived JWT.  |
| **Auth Gateway**         | CloudFront + Lambda\@Edge    | Validate preview JWT; inject `workspace_id` header to upstream preview path.                |
| **Telemetry Collector**  | OTEL JS SDK → Grafana        | Capture `boot_ms`, `mount_ms`, `first_frame_ms`, memory, errors.                            |

---

## 7  Security & Hardening

- **Cross‑origin isolation** — Host page sets `COOP: same-origin` & `COEP: require-corp`; preview origin served from credentialless sub‑domain.
- **Iframe sandbox** — `sandbox="allow-scripts allow-top-navigation-by-user-activation"` with CSP `default-src 'self'`.
- **Native add‑on guard** — WebContainer spawned with `--no-addons`; detecting `require('*.node')` triggers fallback.
- **Rate limiting** — Max 5 parallel previews per workspace; excess returns HTTP 429.
- **Secrets hygiene** — `.env.preview` contains only public keys; server‑side secrets remain in Supabase & RLS‑protected Edge Functions.

---

## 8  Operational Considerations

- **Telemetry & Alerting** — Page DevOps if fallback error‑rate > 2 % over 30 min.
- **Browser guards** — Unsupported browsers receive a dialog with upgrade instructions.
- **Version pinning** — Lock `@webcontainer/api`; upgrade only after regression suite passes.
- **Self‑hosting** — StackBlitz Enterprise Helm chart deployed in the same EKS cluster as core PRIA services.

---

## 9  Acceptance Criteria

1. **Happy‑path test:** 150 KB React/Vite snapshot loads & HMR works in < 2 s on Chrome 120.
2. **Heavy project test:** 600 MB monorepo triggers Remote Preview; iframe reloads in ≤ 30 s.
3. **Native module test:** Project importing `sharp` falls back automatically; console warns clearly.
4. **Header test:** Removing COOP/COEP causes WebContainer boot failure; UI displays actionable error.
5. **Security test:** Tampered preview JWT returns HTTP 401 and blocks access.

---

## 10  Revision History

| Version | Date       | Author         | Notes                                            |
| ------- | ---------- | -------------- | ------------------------------------------------ |
| 1.0‑d   | 2025‑06‑18 | Per Swedenborg | Initial draft derived from architectural outline |

