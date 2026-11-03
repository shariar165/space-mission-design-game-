// Keep the Online Room's relay awake (spec: Online room). A free Supabase project pauses after a week without
// database activity, and the room only uses Realtime broadcast, which may not count. The daily Pages run calls this
// script: one read of one row from the `keepalive` table with the public publishable key (the same key the site
// carries). No relay set up in src/data/online.json: nothing to do. Exit 1 when the read fails, so the run shows a
// warning; the workflow step does not stop the deploy.
//
// The table (run once in the Supabase SQL editor; README "Online Room: setting up the relay"):
//   create table public.keepalive (id int primary key);
//   insert into public.keepalive values (1);
//   alter table public.keepalive enable row level security;
//   create policy "anyone may read the keepalive row" on public.keepalive for select to anon using (true);
import { readFileSync } from 'node:fs';

const { relay } = JSON.parse(readFileSync(new URL('../src/data/online.json', import.meta.url), 'utf8'));

if (!relay.url || !relay.publishableKey) {
  console.log('No room relay set up in src/data/online.json: nothing to keep awake.');
  process.exit(0);
}

const url = `${relay.url.replace(/\/$/, '')}/rest/v1/keepalive?select=id&limit=1`;
try {
  const res = await fetch(url, { headers: { apikey: relay.publishableKey, Authorization: `Bearer ${relay.publishableKey}` }, signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Relay keep-alive: HTTP ${res.status} ${body.slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`Relay keep-alive: ${body.slice(0, 100)}`);
} catch (e) {
  console.error(`Relay keep-alive failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
