# QA1 — Testing & Quality Assurance Strategy

**Document status:** Draft v0.1 · June 2025\
**Owner:** CEO (Per Swedenborg)\
**Purpose:** Establish a unified, automated testing and quality‑assurance framework across PRIA’s codebase—from backend micro‑services to edge front‑end, database migrations, LLM prompts, and Terraform infrastructure.  The strategy codifies test layers, tooling, metrics, and release gates that guarantee deterministic behaviour, security, and performance with a lean engineering team.

---

## Table of Contents

1. Quality Objectives & KPIs
2. Test Pyramid & Coverage Targets
3. Tooling & Frameworks
4. Test Data Management
5. Continuous Testing in CI/CD
6. Environment Strategy (Dev → Pilot → Growth → Enterprise)
7. Non‑Functional Testing (Perf, Security, Accessibility)
8. LLM‑Specific Evaluation (Prompt Regression)
9. QA Metrics, Dashboards & Alerting
10. Prompt Blocks & Test Scaffolding Generators
11. Operational Runbook
12. Future Enhancements & Roadmap
13. Revision History

---

## 1  Quality Objectives & KPIs

| Objective               | KPI / Metric                                 | Target            |
| ----------------------- | -------------------------------------------- | ----------------- |
| Functional correctness  | **Test pass rate** (CI)                      | 100 % mandatory   |
| Regression avoidance    | **Escaped defect rate** (prod bugs / sprint) | < 0.3             |
| Code health             | **Maintainability score (Semgrep)**          | ≥ A               |
| Coverage sufficiency    | **Line coverage** (unit)                     | ≥ 80 %            |
| User experience         | **Core Web Vitals** (p75)                    | LCP < 2.5 s       |
| LLM behaviour stability | **Prompt regression failure**                | 0 blocking issues |

---

## 2  Test Pyramid & Coverage Targets

```
           E2E (Playwright, Cypress)     –  200 tests, smoke + critical paths
        Integration (pytest, go‑test, testcontainers) –  600 tests
     Contract (Newman, grpcurl, Schemathesis) –  300 tests
  Unit (pytest, jest, go‑test)           – 2 000 tests
Static (Semgrep, Trivy, pip‑audit, NPM audit)
```

- **Unit** 80 % line coverage, 90 % branch on critical packages (`orchestrator`, `agent`).
- **Integration** must stub external services; target 100 % RLS policy coverage via pgTAP.
- **E2E** run hourly against Pilot environment; failure auto‑creates Jira ticket.

---

## 3  Tooling & Frameworks

| Layer           | Language      | Framework / Tool             | Notes                                            |
| --------------- | ------------- | ---------------------------- | ------------------------------------------------ |
| Static analysis | all           | **Semgrep OSS**              | PR blocker on High/CRITICAL; autofix suggestions |
| Container scan  | Docker images | **Trivy**                    | CI blocker on Critical CVEs                      |
| Unit testing    | Python        | **pytest + pytest‑asyncio**  | `pytest‑cov` for coverage                        |
|                 | TypeScript    | **ts‑jest**                  | Isolated modules, mocks via ts‑mockito           |
|                 | Go            | **go test**                  | `-race` flag enabled                             |
| Integration     | Backend       | **testcontainers‑python/go** | Spin pg, mock HTTP services                      |
| Database        | SQL           | **pgTAP**                    | 100 % RLS gates, stored procs                    |
| Contract        | REST          | **Schemathesis**             | Fuzz + schema validation                         |
|                 | gRPC          | **grpcurl + buf breaking**   | Ensures backward compat                          |
| E2E UI          | Front‑end     | **Playwright**               | Headless Chromium; retries = 2                   |
| Perf            | All services  | **k6 cloud**                 | Scenario per high‑traffic endpoint               |
| LLM eval        | Agent prompts | **lm‑eval‑harness**          | Mocks; ground‑truth fixtures                     |

---

## 4  Test Data Management

1. **Synthetic by default** – Faker‑generated PII; no prod snapshots.
2. **Tenant‑scoped fixtures** – Each test creates isolated `workspace_id`.
3. **Reset hooks** – `pytest` session fixture truncates tables & clears Redis.
4. **Versioned datasets** – Stored under `tests/fixtures/v{schema_version}/` with checksum.

---

## 5  Continuous Testing in CI/CD

- **ci.yml** pipeline stages: **lint → unit → integration → contract → build → e2e**.
- Parallelism: 4 workers for Python, 8 for JS.
- **Fail‑fast**: any red gate aborts downstream jobs except coverage upload for visibility.
- **Flaky‑test bot**: Retries failing test up to 3×; marks as flaky in Jira.

---

## 6  Environment Strategy

| Env            | Data Reset Cadence   | Test Suites Run                 | Purpose                         |
| -------------- | -------------------- | ------------------------------- | ------------------------------- |
| **Local**      | Dev owns             | Unit, partial integration       | Rapid iteration                 |
| **Dev**        | Daily (`make reset`) | Unit, Integration, Contract     | Shared dev cluster              |
| **Pilot**      | Continuous CI        | Full pipeline; smoke E2E hourly | Pre‑production, design partners |
| **Growth**     | Weekly refresh       | Perf, load tests weekly         | Paid customers staging          |
| **Enterprise** | Prod replicas        | Canary E2E pre‑deploy           | Customer prod                   |

---

## 7  Non‑Functional Testing

### 7.1  Performance & Load

- **k6** scenario: 1 000 expense inserts/sec, 15 min; p95 latency goal < 50 ms DB.
- Goal: No error ratio > 0.1 %; CPU < 70 %.

### 7.2  Security

- **OWASP ZAP** dynamic scan weekly against Preview; integrated with Semgrep alerts.
- **HackerOne** quarterly pen‑test; findings triaged with SLA (Critical 7 d).

### 7.3  Accessibility

- **axe‑playwright** asserts WCAG 2.1 AA on UI routes; no violations permitted on `main` branch.

---

## 8  LLM‑Specific Evaluation

| Eval Type         | Tool / Method          | Pass Criterion             |
| ----------------- | ---------------------- | -------------------------- |
| Prompt regression | lm‑eval‑harness custom | Score delta ≥ ‑1 pp        |
| Toxicity filter   | Detoxify classifier    | Probability toxic < 0.05   |
| Cost benchmarking | Agent metrics          | p95 cost/request ≤ \$0.002 |

- Nightly job compares new adapter vs prod baseline; blocks promotion if fails.
- **Prompt diff**: Semantic diff tool highlights changes beyond variable placeholders.

---

## 9  QA Metrics, Dashboards & Alerting

| Metric                           | Source        | Threshold / Alert     |
| -------------------------------- | ------------- | --------------------- |
| `unit_test_pass_rate`            | GitHub Action | 100 % mandatory       |
| `integration_fail_total`         | CI            | Alert if > 1 per run  |
| `e2e_latency_ms_p95`             | Playwright k6 | Alert if > 3 000 ms   |
| `llm_prompt_regression_fail_pct` | nightly job   | Alert if > 0          |
| `flaky_test_count`               | Flaky bot     | Alert if > 5 per week |

Grafana dashboard `qa_health` aggregates CI durations, pass rates, and flaky trends.

---

## 10  Prompt Blocks & Generators

| ID               | Purpose                                       |
| ---------------- | --------------------------------------------- |
| QA1‑UNIT‑GEN     | Generate skeleton `pytest` test for function. |
| QA1‑PGTAP‑GEN    | Output pgTAP assertions from table schema.    |
| QA1‑PLAY‑GEN     | Produce Playwright script for user story.     |
| QA1‑LLM‑EVAL‑GEN | Draft lm‑eval‑harness YAML for prompt.        |

### Prompt QA1‑UNIT‑GEN (example)

```
System: Generate pytest for function {{func_name}} in module {{module}} ensuring branch coverage.
```

---

## 11  Operational Runbook

1. **CI pipeline red** – Open GitHub UI; identify failing stage; if infrastructure flaky, rerun; else create Jira bug.
2. **Flaky‑test explosion** – Run `pytest --last-failed`; tag `@flaky`; schedule fix sprint.
3. **Perf regression** – k6 alert; revert commit; open performance ticket.
4. **Security scan high CVE** – Dependabot PR auto‑created; must merge within SLA.
5. **LLM eval fail** – Investigate new adapter; rollback or adjust prompt.

---

## 12  Future Enhancements & Roadmap

- Adopt **testcontainers‑compose** to parallel‑spin service graphs.
- Implement **contract‑driven mocks** auto‑generated from OpenAPI examples.
- Add **chaos testing** (network partition, DB failover) in Q2 2026.

---

## 13  Revision History

| Version | Date       | Author         | Notes                                   |
| ------- | ---------- | -------------- | --------------------------------------- |
| 0.1     | 2025‑06‑12 | Per Swedenborg | Initial comprehensive draft of QA plan. |

