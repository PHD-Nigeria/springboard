// Offline validation of the proposed edition migrations against the REAL
// Springboard migration history, in an in-memory Postgres (PGlite).
// Supabase-only objects (auth, storage, roles) are stubbed minimally.
// Fictional fixtures only. Nothing here touches any hosted database.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.REPO ?? process.cwd(); // run from the repo root
const db = new PGlite();
const out = [];
const ok = (name, pass, detail = '') => { out.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const q = (sql, params) => db.query(sql, params);
async function expectError(name, sql, re) {
  try { await db.exec(sql); ok(name, false, 'no error raised'); }
  catch (e) { ok(name, re.test(e.message), e.message.split('\n')[0]); }
}

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema extensions; create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const dir = path.join(REPO, 'supabase/migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
let applied = 0;
for (const f of files) {
  let sql = fs.readFileSync(path.join(dir, f), 'utf8');
  sql = sql.replace(/create extension if not exists pgcrypto with schema extensions;/gi, '-- pgcrypto: gen_random_uuid() is built in');
  try { await db.exec(sql); applied++; }
  catch (e) { ok(`apply existing migration ${f}`, false, e.message.split('\n')[0]); }
}
ok(`All ${files.length} existing migrations apply`, applied === files.length, `${applied}/${files.length}`);

// ---------- fictional fixtures (pre-M1 shape) ----------
await db.exec(`
  insert into public.publications (id, slug, title, status, published_at) values
    ('00000000-0000-0000-0000-0000000000a2','springboard-q2-26','Springboard Q2 ''26','published', now()),
    ('00000000-0000-0000-0000-0000000000a3','springboard-q3-26','Springboard Q3 ''26','draft', null);
  insert into public.sections (id, publication_id, slug, title) values
    ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a2','company','Company News'),
    ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a3','company','Company News');
  insert into public.media (id, storage_path, bucket, mime_type) values
    ('00000000-0000-0000-0000-0000000000c1','uploads/a.webp','public','image/webp');
  insert into public.content (id, publication_id, section_id, content_type, slug, title, status, published_at, cover_media_id, body) values
    ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b1','COMPANY_NEWS','story-one','Fixture story one','published', now(),'00000000-0000-0000-0000-0000000000c1','{"version":1,"blocks":[]}'),
    ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000b1','ARTICLE','story-two','Fixture embargoed story','published', now(),null,
      '{"version":1,"blocks":[{"type":"image","mediaId":"00000000-0000-0000-0000-0000000000c1"},{"type":"gallery","mediaIds":["00000000-0000-0000-0000-0000000000c1","not-a-uuid"]}]}'),
    ('00000000-0000-0000-0000-0000000000d3',null,null,'ARTICLE','loose','Fixture unassigned draft','draft', null,null,'{"version":1,"blocks":[]}');
`);
const before = await q(`select count(*)::int n, md5(string_agg(row_to_json(c)::text, '' order by id)) h from public.content c`);

// ---------- M1 ----------
const m1 = fs.readFileSync(path.join(REPO, 'docs/redesign/proposed-migrations/M1_editions_additive.sql'), 'utf8');
try { await db.exec(m1); ok('M1 applies on top of the real schema', true); } catch (e) { ok('M1 applies on top of the real schema', false, e.message); }

const after = await q(`select count(*)::int n, md5(string_agg(row_to_json(c)::text, '' order by id)) h from (select id, publication_id, content_type, slug, title, subtitle, summary, body, metadata, status, section_id, author_id, category_id, cover_media_id, display_order, publish_at, published_at, created_by, search_vector, created_at, updated_at from public.content) c`);
ok('M1 changes no existing content values', before.rows[0].h === after.rows[0].h && before.rows[0].n === after.rows[0].n);
const ev = await q(`select count(*)::int n from public.content where is_evergreen`);
ok('M1 does not classify existing unassigned content as evergreen', ev.rows[0].n === 0);

await db.exec(`update public.publications set edition_year = 2026, edition_quarter = 2 where slug = 'springboard-q2-26'`);
const p = await q(`select edition_code, period_start::text, period_end::text from public.publications where slug = 'springboard-q2-26'`);
ok('edition_code / period dates derive from year + quarter', p.rows[0].edition_code === '2026-Q2' && p.rows[0].period_start === '2026-04-01' && p.rows[0].period_end === '2026-06-30', JSON.stringify(p.rows[0]));
await expectError('Duplicate quarter is rejected', `update public.publications set edition_year = 2026, edition_quarter = 2 where slug = 'springboard-q3-26'`, /duplicate key|unique/);
await expectError('Quarter 5 is rejected', `update public.publications set edition_year = 2026, edition_quarter = 5 where slug = 'springboard-q3-26'`, /edition_quarter_range/);
await expectError('Year without quarter is rejected', `update public.publications set edition_year = 2026 where slug = 'springboard-q3-26'`, /edition_pair/);
await expectError('edition_code cannot be typed by hand', `update public.publications set edition_code = '2026-Q9'`, /generated|cannot be updated|can only be updated to DEFAULT/i);
await db.exec(`update public.publications set edition_year = 2026, edition_quarter = 3 where slug = 'springboard-q3-26'`);
const q2After = await q(`select count(*)::int n from public.content where publication_id = '00000000-0000-0000-0000-0000000000a2'`);
ok('Creating the next quarter does not move previous-quarter content', q2After.rows[0].n === 1);
await expectError('Evergreen content cannot also belong to an edition', `update public.content set is_evergreen = true where slug = 'story-one'`, /content_evergreen_has_no_edition/);
await db.exec(`update public.content set is_evergreen = true where slug = 'loose'`);
ok('Explicit evergreen choice is stored', (await q(`select is_evergreen from public.content where slug='loose'`)).rows[0].is_evergreen === true);
await db.exec(`update public.content set is_evergreen = false where slug = 'loose'`);

const usage = await q(`select usage, edition_code from public.media_edition_usage where media_id = '00000000-0000-0000-0000-0000000000c1' order by usage, edition_code`);
ok('media_edition_usage derives edition per use; reuse across editions needs no duplicate file', usage.rows.length === 3 && new Set(usage.rows.map(r => r.edition_code)).size === 2, usage.rows.map(r => `${r.usage}:${r.edition_code}`).join(', '));
ok('media_edition_usage ignores malformed ids in block JSON', true, 'the "not-a-uuid" entry produced no error');

// Latest-edition ordering (published only)
const latest = await q(`select edition_code from public.publications where status = 'published' and edition_code is not null order by edition_year desc, edition_quarter desc limit 1`);
ok('Latest published edition resolves from data', latest.rows[0]?.edition_code === '2026-Q2', latest.rows[0]?.edition_code);

// ---------- audit queries (read-only) ----------
const audit = fs.readFileSync(path.join(REPO, 'docs/redesign/audit/edition-audit.sql'), 'utf8')
  .split(/;\s*\n/).map(s => s.replace(/--.*$/gm, '').trim()).filter(Boolean);
let auditOk = 0; const auditRows = [];
for (const s of audit) { try { const r = await q(s); auditOk++; auditRows.push(r.rows.length); } catch (e) { ok('audit query runs', false, e.message.split('\n')[0] + ' :: ' + s.slice(0, 60)); } }
ok(`All ${audit.length} audit queries run and are SELECT-only`, auditOk === audit.length && audit.every(s => /^(select|with)\b/i.test(s)), `row counts ${auditRows.join('/')}`);
const emb = await q(audit[4]);
ok('Audit E finds the embargo leak (published story in a draft edition)', emb.rows.length === 1 && emb.rows[0].title === 'Fixture embargoed story');
const mis = await q(audit[2]);
ok('Audit C finds section/edition mismatch', mis.rows.length === 1);

// Embargo leak reproduced under the real RLS as anon
await db.exec(`grant select on all tables in schema public to anon`);
await db.exec(`set role anon`);
const anonList = await q(`select c.title, p.slug from public.content c left join public.publications p on p.id = c.publication_id order by c.title`);
await db.exec(`reset role`);
const leaked = anonList.rows.find(r => r.title === 'Fixture embargoed story');
ok('Confirmed under existing RLS: anon can list a published story whose edition is a draft (edition join comes back null)', !!leaked && leaked.slug === null, JSON.stringify(anonList.rows));
await db.exec(`set role anon`);
const anonInner = await q(`select c.title from public.content c join public.publications p on p.id = c.publication_id`);
await db.exec(`reset role`);
ok('App-level fix (inner join on visible edition) hides it without any RLS change', anonInner.rows.length === 1 && anonInner.rows[0].title === 'Fixture story one');

// ---------- M3 ----------
// Clean the deliberate mismatch first, as the audit process requires.
await db.exec(`update public.content set section_id = '00000000-0000-0000-0000-0000000000b2' where slug = 'story-two'`);
const m3 = fs.readFileSync(path.join(REPO, 'docs/redesign/proposed-migrations/M3_editions_enforcement.sql'), 'utf8');
try { await db.exec(m3); ok('M3 applies after audit clean-up', true); } catch (e) { ok('M3 applies after audit clean-up', false, e.message); }
await expectError('Unassigned content cannot enter review', `update public.content set status = 'review' where slug = 'loose'`, /Choose an edition/);
await db.exec(`update public.content set is_evergreen = true, status = 'review' where slug = 'loose'`);
ok('Explicit evergreen content can enter review', (await q(`select status from public.content where slug='loose'`)).rows[0].status === 'review');
await db.exec(`update public.content set is_evergreen = false, status = 'draft' where slug = 'loose'`);
ok('Unassigned drafts are still allowed (work in progress never blocked)', true);
await expectError('Section from another edition is rejected', `update public.content set section_id = '00000000-0000-0000-0000-0000000000b1' where slug = 'story-two'`, /different edition/);
await expectError('Deleting an edition with content is blocked (no silent reclassification)', `delete from public.publications where slug = 'springboard-q2-26'`, /foreign key|violates/);
await db.exec(`update public.content set status = 'published' where slug = 'story-one'`);
ok('Publishing a story does not change its edition status', (await q(`select status from public.publications where slug='springboard-q3-26'`)).rows[0].status === 'draft');

const failed = out.filter(r => !r.pass).length;
console.log(`\n${out.length - failed}/${out.length} passed`);
process.exitCode = failed ? 1 : 0;
