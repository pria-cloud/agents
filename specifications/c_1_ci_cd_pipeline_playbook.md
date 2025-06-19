# C1 — CI/CD Pipeline Playbook

**Document status:** Final v1.1 · June 2025\
**Owner:** CEO (Per Swedenborg)

**Purpose:** Define the end‑to‑end continuous‑integration and continuous‑deployment workflow that delivers every PRIA service—from front‑end to databases to the **A2A Router**—to Pilot, Growth, and Enterprise environments with zero manual gates.  This version removes all legacy agent‑token deployment steps and adds dedicated stages for **Google A2A** and **MCP** integration tests.

---

## Table of Contents

1. Pipeline Overview & Goals
2. Git Branching & Versioning
3. Pipeline Stages (Main Branch)
4. Environment Promotion Flow
5. Security & Compliance Gates
6. Rollback Strategy
7. Tooling Matrix
8. Self‑Service Commands
9. Future Enhancements
10. Revision History

---

## 1  Pipeline Overview & Goals

| Goal                     | Target Metric                                     |
| ------------------------ | ------------------------------------------------- |
| **Fast Feedback**        | Unit tests complete ≤ 3 min                       |
| **High Confidence**      | 100 % pipeline pass required for merge            |
| **Agent Safety**         | 0 failing A2A/MCP integration tests               |
| **Regulated Compliance** | SOC 2 controls logged on every release            |
| **1‑Click Rollback**     | Rollback script generated automatically (≤ 1 min) |

Pipeline orchestrated by **GitHub Actions** with OIDC to cloud providers.  Every commit to `main` triggers full build → deploy to Pilot.

## 2  Git Branching & Versioning

| Branch      | Purpose                           | Protected Rules                 |
| ----------- | --------------------------------- | ------------------------------- |
| `main`      | Trunk; deploys to Pilot           | 1 review + pipeline green       |
| `feat/*`    | Feature branches                  | CI lint + unit only             |
| `hotfix/*`  | Emergency patch                   | Reduced gate (skip perf)        |
| `release/*` | Release candidate for Growth/Ent. | Freeze window; require sign‑off |

Semantic tags `vX.Y.Z` created by `release.yml` on successful Growth deploy. Docker images tagged with git SHA + semver.

## 3  Pipeline Stages (Main Branch)

| Step | Job Name   | Required?   | Key Tools / Actions                                                  | Artefacts              |
| ---- | ---------- | ----------- | -------------------------------------------------------------------- | ---------------------- |
| 1    | ``         | ✔           | Checkout, cache restore, set matrix env                              | —                      |
| 2    | ``         | ✔           | Semgrep OSS, Trivy (Docker), licence checker                         | SARIF reports          |
| 3    | ``         | ✔           | Jest (TS), pytest (Py), go test, `--race` flag on Go                 | JUnit XML              |
| 4    | ``         | ✔           | testcontainers‑python/go, Supabase local, pgTAP                      | Coverage XML           |
| 5    | ``         | ✔           | W3 Test‑Harness Agent against candidate DSLs                         | HarnessResponse JSON   |
| 6    | `` *(new)* | ✔           | Spin A2A Router container → run Google A2A conformance + MCP suite   | `a2a_test_report.json` |
| 7    | ``         | ✔           | Build & scan images: web, cortex, worker, agent‑mesh, **a2a‑router** | Images pushed to GHCR  |
| 8    | ``         | ✔           | Vercel deploy, Fly deploy (`fly deploy --remote-only`)               | Deploy IDs             |
| 9    | ``         | ✔           | Playwright tests against Pilot env                                   | Trace.zip              |
| 10   | ``         | ❑ (nightly) | k6 Cloud baseline scenarios (from P1)                                | `perf_result.json`     |
| 11   | ``         | ✔           | Slack + GitHub status, Drata evidence push                           | Slack timestamp        |

*❑ = optional on **`main`** commit, mandatory nightly.*

### 3.1  Secrets Handling

- All jobs run in **GHA OIDC** context; cloud creds issued per job.
- `AWS_SECRET_MANAGER_ACCESS` for Supabase service role key.
- `FLY_TOKEN_PILOT` scoped to Pilot organisation only.

## 4  Environment Promotion Flow

```
main → Pilot (auto)
      ↳ nightly tag release/* → Growth (manual approve)
                     ↳ semver tag vX.Y.Z → Enterprise (auto after Growth green)
```

Promotion gates:

1. Growth deploy blocked if **error\_ratio** metric > 0.4 % in Pilot over last 30 min.
2. Enterprise deploy blocked until Growth smoke & A2A tests green for ≥ 60 min.

## 5  Security & Compliance Gates

| Gate ID | Check                                  | Stage              | Action on Fail          |
| ------- | -------------------------------------- | ------------------ | ----------------------- |
| **S‑1** | Critical CVEs (Trivy)                  | static\_analysis   | Cancel pipeline         |
| **S‑2** | Secrets in code (gitleaks)             | static\_analysis   | Block merge             |
| **S‑3** | A2A conformance fail (>0)              | a2a\_mcp\_tests    | Block deploy            |
| **S‑4** | Test coverage < 80 % critical packages | unit\_tests        | Block merge             |
| **S‑5** | pgTAP RLS leak observed                | integration\_tests | Block merge + alert DBA |
| **S‑6** | Drata evidence push error              | notify             | Soft fail, alert SecOps |

## 6  Rollback Strategy

On each deploy, pipeline auto‑generates `` containing:

```bash
vercel rollback $VERCEL_DEPLOY_ID
fly releases revert -a cortex-$ENV -n 1
fly releases revert -a a2a-router-$ENV -n 1
supabase db revert_schema "$SCHEMA_CHECKSUM"
```

Uploaded as artefact; stored 30 days.  Runbook **OPS1 §7.1** references the script.

## 7  Tooling Matrix

| Layer       | Tool              | Version Pin  | Notes                                 |
| ----------- | ----------------- | ------------ | ------------------------------------- |
| CI Runner   | GitHub Actions    | ubuntu-22.04 | concurrency matrix 3×                 |
| Container   | Docker Buildx     | 0.12         | multi‑arch (linux/amd64, linux/arm64) |
| IaC         | Terraform         | 1.8.x        | validated via `tflint` + `tfsec`      |
| Secrets     | AWS SecretsMgr    | API v1       | OIDC to IAM role                      |
| A2A Testing | `a2a conformance` | v0.3.1       | Upstream Google test harness          |
| Perf        | k6 Cloud          | 0.50         | triggered nightly                     |

## 8  Self‑Service Commands

| Task                      | Command                                     |
| ------------------------- | ------------------------------------------- |
| Run full pipeline locally | `act -W .github/workflows/ci.yml -j all`    |
| Trigger Growth promotion  | `gh workflow run promote.yml -f env=growth` |
| Generate rollback script  | `make rollback-preview env=pilot`           |
| Inspect A2A test results  | `gh run download --name a2a_test_report`    |

## 9  Future Enhancements

- Parallelise Playwright shards via matrix (target total E2E ≤ 4 min).
- Canary deploy Growth via **Vercel Traffic Split**.
- Integrate **Scorecards** supply‑chain security checks.
- Add **OpenTelemetry Trace‑based tests** (replay golden trace, assert spans).

## 10  Revision History

| Version | Date       | Author         | Notes                                                              |
| ------- | ---------- | -------------- | ------------------------------------------------------------------ |
| 1.1     | 2025‑06‑14 | Per Swedenborg | Added A2A/MCP stages, removed legacy agent-token deployment steps. |
| 1.0     | 2025‑06‑12 | Per Swedenborg | First complete draft (pre‑A2A).                                    |

