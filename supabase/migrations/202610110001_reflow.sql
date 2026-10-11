-- REFLOW cloud foundation. Apply to a new Supabase project, never the local SQLite DB.
begin;

create table public.reflow_references (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  url text not null check (length(url) between 1 and 2000),
  document jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, url),
  unique (id, owner),
  constraint reference_document_valid check (
    jsonb_typeof(document) = 'object' and document ?& array['id', 'url', 'sample'] and document->>'id' = id::text
    and document->>'url' = url and document->>'sample' = 'false'
    and octet_length(document::text) <= 524288
  )
);
create index reflow_references_owner_date on public.reflow_references(owner, created_at desc);

create table public.reflow_projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_document_valid check (
    jsonb_typeof(document) = 'object' and document ?& array['id', 'sections'] and document->>'id' = id::text
    and jsonb_typeof(document->'sections') = 'array'
    and jsonb_array_length(document->'sections') <= 30
    and octet_length(document::text) <= 1048576
  )
);
create index reflow_projects_owner_updated on public.reflow_projects(owner, updated_at desc);

-- Public examples contain only explicitly published example data, never a user's library.
create table public.reflow_samples (
  id uuid primary key,
  document jsonb not null,
  published boolean not null default false,
  constraint sample_document_valid check (
    jsonb_typeof(document) = 'object' and document ?& array['id', 'sample'] and document->>'id' = id::text
    and document->>'sample' = 'true' and octet_length(document::text) <= 524288
  )
);

create table public.reflow_capture_jobs (
  id uuid primary key default gen_random_uuid(),
  ref_id uuid not null,
  owner uuid not null references auth.users(id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'working', 'complete', 'failed', 'cancelled', 'limited')),
  attempts smallint not null default 0 check (attempts between 0 and 2),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ref_id, owner) references public.reflow_references(id, owner) on delete cascade
);
create index reflow_capture_jobs_owner_date on public.reflow_capture_jobs(owner, created_at desc);
create index reflow_capture_jobs_queue on public.reflow_capture_jobs(created_at) where state = 'queued';
create unique index reflow_capture_jobs_active on public.reflow_capture_jobs(ref_id) where state in ('queued', 'working');

-- Revisions allow an API to reject stale edits instead of overwriting another device.
create function public.reflow_update_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner is distinct from old.owner then
    raise exception 'record identity cannot change' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;
create trigger reflow_reference_revision before update on public.reflow_references for each row execute function public.reflow_update_revision();
create trigger reflow_project_revision before update on public.reflow_projects for each row execute function public.reflow_update_revision();
revoke all on function public.reflow_update_revision() from public, anon, authenticated;

alter table public.reflow_references enable row level security;
alter table public.reflow_projects enable row level security;
alter table public.reflow_samples enable row level security;
alter table public.reflow_capture_jobs enable row level security;

create policy reflow_reference_owner on public.reflow_references to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy reflow_project_owner on public.reflow_projects to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy reflow_published_samples on public.reflow_samples for select to anon, authenticated
  using (published);
create policy reflow_job_read on public.reflow_capture_jobs for select to authenticated
  using (owner = (select auth.uid()));

revoke all on public.reflow_references, public.reflow_projects, public.reflow_samples, public.reflow_capture_jobs from anon, authenticated;
grant select, insert, update, delete on public.reflow_references, public.reflow_projects to authenticated;
grant select on public.reflow_samples to anon, authenticated;
grant select on public.reflow_capture_jobs to authenticated;
grant all on public.reflow_references, public.reflow_projects, public.reflow_samples, public.reflow_capture_jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('reflow-private', 'reflow-private', false, 12582912, array['image/webp']),
  ('reflow-samples', 'reflow-samples', true, 12582912, array['image/webp']);

-- Immutable media preserves project snapshots after recapture/library removal.
-- Client deletion/overwrite is deliberately absent; account cleanup uses a server-only job.
create policy reflow_media_read on storage.objects for select to authenticated
  using (bucket_id = 'reflow-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy reflow_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reflow-private' and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy reflow_sample_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'reflow-samples');

commit;
