## Backend Implementation Plan – `app.compose` Flow (A2A-router + App-Builder)

**Audience:** backend/DevOps maintainers of the PRIA platform.  This plan walks through the concrete engineering work required to expose the file-streaming `app.compose` flow described in `app_compose_frontend_integration.md`.

### 0. High-Level Objectives
1. **Return generated files & dependencies** from App-Builder in the final JSON.
2. **Handle large payloads** (≤ 25 MB) in both directions.
3. Add a **`skip_github` fast-path** to bypass PR creation for WebContainer previews.
4. Keep the existing GitHub workflow for production callers untouched (feature-flagged).
5. Ensure A2A-router transparently relays the new fields while maintaining its conversation cache.

---

### 1. Work Breakdown
| ID | Component | Change | Owner |
|----|-----------|--------|-------|
| **AB-1** | App-Builder | Include `files` & `dependencies` arrays in response after Phase 4 | backend team |
| **AB-2** | App-Builder | `express.json({ limit: '25mb' })` global body parser | backend team |
| **AB-3** | App-Builder | Accept `skip_github` boolean request flag; wrap branch/PR section with `if (!skip_github)` | backend team |
| **AB-4** | App-Builder | Update unit tests & mocks for new response schema | QA |
| **AR-1** | A2A-router | Switch to `express.json({ limit: '25mb' })` | backend team |
| **AR-2** | A2A-router | No changes to caching logic needed; verify it stores/forwards `files` untouched (edge case: **do not** cache them) | backend team |
| **AR-3** | A2A-router | Add basic CORS + gzip middleware (beneficial but optional) | DevOps |
| **OPS-1** | Helm/PM2 etc. | Increase container memory limit (payloads bigger) | DevOps |

Dependencies: AB-1 before AB-4; AR-1 before AR-2.

---

### 2. Detailed App-Builder Changes
1. **Phase Orchestration (`src/index.ts`)**
   ```ts
   // after gathering allGeneratedFiles & dependencies…
   const resultPayload = {
     status: 'completed',
     message: 'Application composition complete.',
     files: allGeneratedFiles.map(f => ({ path: f.filePath, content: f.content })),
     dependencies,
     ...(skipGithub ? {} : { github_pr_url: prUrl })
   };
   return resultPayload;
   ```

2. **Body Size Limit**
   ```ts
   app.use(express.json({ limit: '25mb' }));
   ```

3. **`skip_github` Flag**
   * Parse with `const { skip_github = false } = requestBody;` (default false)
   * Wrap `createBranch / commitFiles / openDraftPR` block with `if (!skip_github)`.

4. **Test Updates**
   * Snapshot of `files` + `dependencies`.
   * New cases: `skip_github=true` returns no `github_pr_url`.

---

### 3. Detailed A2A-router Changes
1. **Body Parser Limit**
   ```ts
   app.use(express.json({ limit: '25mb' }));
   ```

2. **Conversation Cache Update**
   * **Do not** cache `files` / `dependencies` blobs. Current logic only caches `updatedAppSpec`; keep that.
   * When `data.status === 'AWAITING_USER_INPUT'` → cache spec (unchanged).

3. **Pass-Through Logic**
   * Ensure `res.json({ ...data, conversationId })` includes new fields automatically.

4. **Compression / CORS** (optional)
   * `app.use(require('compression')());`
   * `app.use(require('cors')());`

---

### 4. Acceptance Criteria
- [ ] End-to-end manual test: chat → build → WebContainer receives ≥ 1 file.
- [ ] Payload ≤ 25 MB round-trips without 413 error.
- [ ] `skip_github=true` completes in < 10 s; no branch created.
- [ ] Legacy GitHub path still works when flag is omitted.
- [ ] Router cache memory stays bounded (< 1 MB per conversation).

---

### 5. Roll-Out Plan
1. Deploy router & app-builder to staging with new environment variable `JSON_LIMIT=25mb`.
2. Update front-end to use new spec.
3. Run integration test suite; measure latency.
4. Deploy to production behind a **feature flag header** `x-pria-version: 1.0` for 1 week.
5. Remove flag after confidence.

---

### 6. Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Large JSON causes memory spike | 25 MB cap, monitor heap, reject >25 MB early |
| GitHub API rate-limit during dev demos | Encourage `skip_github`; rate-limit backoff logic unchanged |
| Router caches large blobs | Only cache `updatedAppSpec`; ensure purge on `completed` |

---

### 7. Time Estimation
* **App-Builder**: 1½ days (coding + tests)
* **Router**: 0.5 day
* **End-to-end QA**: 1 day

_total ≈ 3 dev-days_

---

### 8. Versioning & Docs
* `app-builder` bumps to **v1.1.0** (semver minor).
* Update `CHANGELOG.md` in both repos.
* Tag Docker images `pria/app-builder:v1.1.0` and `pria/a2a-router:v1.1.0`. 