# A2 — Cloud Foundation Playbook

**Document status:** Final v1.1 · June 2025\
**Owner:** CEO (Per Swedenborg)

**Purpose:** Supply a single, reproducible Terraform baseline that provisions every cloud resource PRIA needs—Vercel, Supabase, Fly.io, Grafana Cloud—plus the **A2A Gateway** and supporting secrets.  Running `make bootstrap env=pilot` produces a working Pilot‑tier environment in < 20 minutes.

---

## Table of Contents

1. Scope & Guiding Principles
2. High‑Level Module Graph
3. Account & IAM Strategy
4. Networking & DNS
5. Terraform Modules\
   5.1 `vercel_team`\
   5.2 `supabase_project`\
   5.3 `fly_app` (Cortex, Worker, Agent Mesh)\
   5.4 `fly_app_a2a_router`\
   5.5 `grafana_cloud_stack`
6. Secrets & Parameter Store
7. Bootstrap Workflow
8. Post‑Bootstrap Validation
9. Open Items / Future Enhancements
10. Revision History

---

## 1  Scope & Guiding Principles

- **One‑Button Bootstrap.** Scriptable foundation that a new engineer can run without manual console clicks.
- **Least Privilege by Default.** Each module scopes cloud API tokens to its exact resource set.
- **Immutable Infrastructure.** All resources tagged and versioned; zero drift tolerated.
- **A2A‑Native.** The Agent‑to‑Agent Gateway (`a2a-router`) is a first‑class service in every environment.

## 2  High‑Level Module Graph

```
root
├── vercel_team
│   └── vercel_project (web)
├── supabase_project
│   ├── supabase_db (Postgres 16)
│   ├── supabase_storage
│   └── supabase_edge_fn (a2a_intent)
├── fly_org
│   ├── fly_app_cortex
│   ├── fly_app_worker
│   ├── fly_app_agent_mesh
│   └── fly_app_a2a_router  <-- NEW
└── grafana_cloud_stack
```

All modules share the same tag set: `env`, `svc`, `owner`, `version`.

## 3  Account & IAM Strategy

| Cloud         | Identity Model                                         | Notes                               |
| ------------- | ------------------------------------------------------ | ----------------------------------- |
| Vercel        | Team `pria` with SSO‑enforced members                  | Only GitHub OIDC deploy keys.       |
| Supabase      | Service Role tokens stored in AWS Secrets Manager      | Row‑Level Security ON by default.   |
| Fly.io        | Org `pria` with two personal access tokens (CI, human) | mTLS cert rotation via Fly secrets. |
| Grafana Cloud | API Keys scoped to stack → Prometheus, Loki, Tempo     | Provisioned via Terraform provider. |

**IAM Boundary:** Terraform Cloud runs with a restricted environment‑specific service account; no human credentials embedded.

## 4  Networking & DNS

- **Vercel Edge:** Automatic TLS, wildcard `*.pilot.pria.cloud`.
- **Fly Apps:** Anycast IP, CNAME `api.pilot.pria.cloud` → Cortex load balancer, `agents.pilot.pria.cloud` → A2A Router.
- **Supabase:** Private sub‑domain `db.pilot.pria.internal` (no public SQL).
- **Grafana:** Public; secured by SSO, IP allow‑list for admin panel.

## 5  Terraform Modules

### 5.1  `vercel_team`

Creates team + project `pria‑web`; sets Env Vars: `NEXT_PUBLIC_SUPABASE_URL`, etc.

### 5.2  `supabase_project`

- Plan size variable (`tier = "medium"` for pilot).
- Enables PITR (7 days) and pgmq extension.
- Bootstraps database with `supabase_db_seed_url` pointing to migration artifacts.

### 5.3  `fly_app`

Reusable module parameterised by `name`, `cpu`, `memory`, `docker_image`, `secrets`. Used for `cortex`, `worker`, `agent‑mesh`.

### 5.4  `fly_app_a2a_router`

```hcl
module "a2a_router" {
  source        = "./modules/fly_app"
  name          = "a2a-router-${var.env}"
  docker_image  = "ghcr.io/pria-cloud/a2a-router:${var.version}"
  cpu           = 1
  memory        = 512
  regions       = ["yyz"]
  mounts        = []
  secrets = {
    SUPABASE_URL          = module.supabase_project.rest_url
    SUPABASE_SERVICE_ROLE = data.aws_secretsmanager_secret_version.srv_role.secret_string
    JWT_SECRET            = data.aws_secretsmanager_secret_version.jwt.secret_string
  }
}
```

Health check: `/healthz` returns `200 OK` with JSON `{"status":"ok"}`.

### 5.5  `grafana_cloud_stack`

Creates Tempo, Loki, and Prometheus instances.  Adds API keys for CI agent to push dashboards.

## 6  Secrets & Parameter Store

| Name                                                                                        | Source              | Scope                | Rotation |
| ------------------------------------------------------------------------------------------- | ------------------- | -------------------- | -------- |
| `SUPABASE_SERVICE_ROLE`                                                                     | AWS Secrets Manager | Fly apps             | 90 days  |
| `JWT_SECRET`                                                                                | AWS Secrets         | Edge Fns, A2A Router | 90 days  |
| `GRAFANA_API_KEY`                                                                           | AWS Secrets         | CI only              | 180 days |
| All secrets injected at deploy time; no secret in state file (uses `vaulted` provider).\</n |                     |                      |          |

## 7  Bootstrap Workflow

```bash
make bootstrap env=pilot \
  supabase_token=$SUPABASE_TOKEN \
  vercel_token=$VERCEL_TOKEN \
  fly_token=$FLY_TOKEN
```

Steps executed:

1. `terraform init && terraform apply -auto-approve`
2. Wait for Supabase database endpoint to be reachable.
3. Run initial migrations (`supabase db reset --linked`).
4. Deploy Vercel project via GitHub Actions OIDC.
5. Deploy Fly apps, including `a2a-router`.
6. Seed `agent_registry` with Echo Agent via `POST /agents/register`.
7. Smoke test runner hits `/a2a/intent` intent=`hello.world`.

## 8  Post‑Bootstrap Validation

| Check              | Command                                                         | Expected          |
| ------------------ | --------------------------------------------------------------- | ----------------- |
| Web build green    | `vercel ls`                                                     | status `READY`    |
| A2A Router healthy | `curl https://agents.pilot.pria.cloud/healthz`                  | `{"status":"ok"}` |
| Grafana ingest     | `curl -s $PROM_URL/api/v1/query?query=a2a_intent_request_total` | non‑empty         |

## 9  Open Items / Future Enhancements

- Add HashiCorp Boundary for short‑lived human DB sessions.
- Auto‑purchase Fly SCALE units when CPU usage > 60 % for 30 days.

## 10  Revision History

| Version | Date       | Author         | Notes                                                              |
| ------- | ---------- | -------------- | ------------------------------------------------------------------ |
| 1.1     | 2025‑06‑14 | Per Swedenborg | Added A2A Router module, finalised bootstrap script; marked Final. |
| 1.0     | 2025‑06‑12 | Per Swedenborg | First complete draft.                                              |

