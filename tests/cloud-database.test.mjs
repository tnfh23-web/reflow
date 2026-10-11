import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// A local PostgreSQL engine; no Supabase credentials or personal database is touched.
const {PGlite} = process.env.REFLOW_PGLITE_MODULE
  ? await import(pathToFileURL(process.env.REFLOW_PGLITE_MODULE).href)
  : await import('@electric-sql/pglite');
const personA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', personB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const refId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
const sampleId = '33333333-3333-4333-8333-333333333333', hiddenId = '44444444-4444-4444-8444-444444444444';
test('cloud migration isolates users, protects snapshots and rejects stale/invalid data', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select string_to_array(name, '/') $$;
    `);
    const migration = await fs.readFile(new URL('../supabase/migrations/202610110001_reflow.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.query('insert into auth.users values ($1),($2)', [personA, personB]);
    async function as(role, userId, task) {
      await db.exec('begin');
      try {
        await db.exec(`set local role ${role}`);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || '']);
        const result = await task(); await db.exec('commit'); return result;
      } catch (error) { await db.exec('rollback'); throw error; }
    }
    const reference = {id: refId, url: 'https://example.com', sample: false, note: 'private note'};
    await t.test('each user can create own documents and foreign rows are invisible', async () => {
      await as('authenticated', personA, () => db.query('insert into public.reflow_references(id,owner,url,document) values($1,$2,$3,$4)', [refId, personA, reference.url, reference]));
      const rows = await as('authenticated', personB, () => db.query('select * from public.reflow_references'));
      assert.equal(rows.rows.length, 0);
      const changed = await as('authenticated', personB, () => db.query("update public.reflow_references set document = jsonb_set(document,'{note}','\"forged\"') where id=$1 returning id", [refId]));
      assert.equal(changed.rows.length, 0);
      await assert.rejects(as('authenticated', personB, () => db.query('insert into public.reflow_references(id,owner,url,document) values($1,$2,$3,$4)', [hiddenId, personA, reference.url, {...reference,id:hiddenId}])));
      await assert.rejects(as('anon', null, () => db.query('select * from public.reflow_references')));
    });
    await t.test('duplicate URLs and missing required JSON keys are rejected', async () => {
      await assert.rejects(as('authenticated', personA, () => db.query('insert into public.reflow_references(id,owner,url,document) values($1,$2,$3,$4)', [hiddenId, personA, reference.url, {...reference,id:hiddenId}])));
      await assert.rejects(as('authenticated', personA, () => db.query('insert into public.reflow_references(id,owner,url,document) values($1,$2,$3,$4)', [hiddenId, personA, 'https://other.example', {}])));
    });
    await t.test('only published examples are readable; visitors cannot edit examples', async () => {
      await db.query('insert into public.reflow_samples values($1,$2,true),($3,$4,false)', [sampleId,{id:sampleId,sample:true},hiddenId,{id:hiddenId,sample:true}]);
      const rows = await as('anon', null, () => db.query('select id from public.reflow_samples'));
      assert.deepEqual(rows.rows.map(r => r.id), [sampleId]);
      await assert.rejects(as('authenticated', personA, () => db.query('update public.reflow_samples set published=true')));
    });
    await t.test('a revision update invalidates stale writes and identity cannot change', async () => {
      const updated = await as('authenticated', personA, () => db.query("update public.reflow_references set document = jsonb_set(document,'{note}','\"new note\"') where id=$1 and revision=1 returning revision", [refId]));
      assert.equal(Number(updated.rows[0].revision), 2);
      const stale = await as('authenticated', personA, () => db.query('update public.reflow_references set document=document where id=$1 and revision=1 returning id', [refId]));
      assert.equal(stale.rows.length, 0);
      await assert.rejects(as('authenticated', personA, () => db.query('update public.reflow_references set owner=$2 where id=$1', [refId,personB])));
    });
    await t.test('private images require the owner path and cannot be overwritten/deleted by clients', async () => {
      const name = `${personA}/${refId}.webp`;
      await as('authenticated', personA, () => db.query("insert into storage.objects(bucket_id,name) values ('reflow-private',$1)", [name]));
      await assert.rejects(as('authenticated', personB, () => db.query("insert into storage.objects(bucket_id,name) values ('reflow-private',$1)", [name])));
      assert.equal((await as('authenticated', personB, () => db.query('select * from storage.objects'))).rows.length, 0);
      assert.equal((await as('anon', null, () => db.query('select * from storage.objects'))).rows.length, 0);
      assert.equal((await as('authenticated', personA, () => db.query('select * from storage.objects'))).rows.length, 1);
      assert.equal((await as('authenticated', personA, () => db.query('delete from storage.objects returning id'))).rows.length, 0);
      assert.equal((await as('authenticated', personA, () => db.query("update storage.objects set name='changed' returning id"))).rows.length, 0);
    });
    await t.test('capture jobs cannot attach another owner or be modified by the browser', async () => {
      await db.query('insert into public.reflow_capture_jobs(ref_id,owner) values($1,$2)', [refId,personA]);
      await assert.rejects(db.query('insert into public.reflow_capture_jobs(ref_id,owner) values($1,$2)', [refId,personB]));
      await assert.rejects(as('authenticated', personA, () => db.query("update public.reflow_capture_jobs set state='complete'")));
      assert.equal((await as('authenticated', personB, () => db.query('select * from public.reflow_capture_jobs'))).rows.length, 0);
    });
    await t.test('removing a library entry preserves a project snapshot and its image', async () => {
      const document = {id:projectId,sections:[{id:'hero',name:'Hero',items:[{id:'item',sourceId:refId,image:`${personA}/${refId}.webp`}]}]};
      await as('authenticated', personA, () => db.query('insert into public.reflow_projects(id,owner,document) values($1,$2,$3)', [projectId,personA,document]));
      await as('authenticated', personA, () => db.query('delete from public.reflow_references where id=$1', [refId]));
      const saved = await as('authenticated', personA, () => db.query('select document from public.reflow_projects where id=$1', [projectId]));
      assert.equal(saved.rows[0].document.sections[0].items[0].sourceId, refId);
      assert.equal((await as('authenticated', personA, () => db.query('select * from storage.objects'))).rows.length, 1);
      assert.equal((await db.query('select * from public.reflow_capture_jobs')).rows.length, 0);
    });
  } finally { await db.close(); }
});
