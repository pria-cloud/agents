# PRIA — Agent Registry Table Specification

**Document status:** Draft v0.1 · July 2025  
**Owner:** Platform Architect Guild

---

## Purpose
Persist a durable catalogue of every agent that registers with the A2A Router so that:

* The router can cold-start without losing registrations.
* Other services (UI, monitoring, deployment) can query capabilities and liveness.
* Registration and heartbeat events are auditable.

The table lives in the **`public`** schema of the Supabase project linked to *pria-cloud*.

---

## Table Definition

```sql
create table public.agent_registry (
  agent_name        text primary key,
  version           text                     not null,
  capabilities      text[]                  not null,
  endpoint_url      text                     not null,
  supports_mcp      boolean      default false,
  last_heartbeat_at timestamptz              not null default now(),
  created_at        timestamptz              not null default now(),
  updated_at        timestamptz              not null default now()
);
```

### Column semantics
| Column             | Type        | Notes                                                   |
| ------------------ | ----------- | ------------------------------------------------------- |
| `agent_name`       | text PK     | Human-readable identifier sent in `/agents/register`.   |
| `version`          | text        | Semantic version (`vMAJOR.MINOR.PATCH`).                |
| `capabilities`     | text array  | List of intents the agent can handle.                   |
| `endpoint_url`     | text        | Base URL that receives `/intent` POSTs.                 |
| `supports_mcp`     | boolean     | `true` if the agent understands MCP wrappers.           |
| `last_heartbeat_at`| timestamptz | Updated on every register/heartbeat call.               |
| `created_at`       | timestamptz | Row creation timestamp (immutable).                     |
| `updated_at`       | timestamptz | Auto-updated via trigger on upsert.                     |

---

## Upsert pattern
The router performs:
```sql
insert into public.agent_registry as ar
  (agent_name, version, capabilities, endpoint_url, supports_mcp, last_heartbeat_at)
values
  (:agent_name, :version, :capabilities, :endpoint_url, :supports_mcp, now())
on conflict (agent_name) do update set
  version           = excluded.version,
  capabilities      = excluded.capabilities,
  endpoint_url      = excluded.endpoint_url,
  supports_mcp      = excluded.supports_mcp,
  last_heartbeat_at = excluded.last_heartbeat_at,
  updated_at        = now();
```

---

## Indexes
```sql
-- Fast look-up by capability (intent → agent)
create index agent_registry_capabilities_gin on public.agent_registry using gin(capabilities);

-- Optional: query live agents (heartbeat < 5 min)
create index agent_registry_last_heartbeat_idx on public.agent_registry(last_heartbeat_at desc);
```

---

## Row-Level Security (RLS)
RLS is **enabled**; only the Router service role may mutate rows.

```sql
alter table public.agent_registry enable row level security;

-- Allow read-only access to everyone (e.g. UI)
create policy "agent_registry_read" on public.agent_registry
  for select using ( true );

-- Only the Router (identified by service role claim) can insert/update
create policy "agent_registry_upsert" on public.agent_registry
  for all using ( auth.role() = 'service_role' )
  with check ( auth.role() = 'service_role' );
```

> ⚠️  Do **not** grant `service_role` keys to clients; the Router runs server-side with the Service Role key and calls the Supabase REST API directly.

---

## Triggers
Auto-maintain `updated_at`:
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger set_agent_registry_updated_at
  before update on public.agent_registry
  for each row execute function public.set_updated_at();
```

---

## SLA & Monitoring
* `last_heartbeat_at` older than **5 minutes** → agent considered *offline*.
* Supabase Realtime broadcast can publish `insert`/`update` events → push to OTEL.
* Grafana alert: *Missing heartbeat for critical agents ≥2 mins*.

---

## Example Queries

*List active agents and their capabilities*
```sql
select agent_name, capabilities
from public.agent_registry
where last_heartbeat_at > now() - interval '5 minutes'
order by agent_name;
```

*Find agents that can handle a given intent (`app.compose`)*
```sql
select *
from public.agent_registry
where capabilities @> array['app.compose'];
```

---

## Migration script
Store as `20250707_0001_create_agent_registry.sql` in your migrations folder.
```sql
-- up
-- (include the DDL, indexes, trigger, RLS policies above)

-- down
drop table if exists public.agent_registry;
```

---

## Open Items
1. Consider TTL job to purge rows with `last_heartbeat_at < now() - interval '30 days'`.
2. Support multi-branch registrations (add composite PK on `agent_name, branch_id`). 