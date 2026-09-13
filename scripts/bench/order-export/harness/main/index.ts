// Main service du banc : cree un USER WORKER par requete (forceCreate),
// avec memoryLimitMb comme la plateforme, sur l Edge Function REELLE
// (index.ts + deno.json du depot, copie instantanee dans /proj).
const FAKE = 'http://host.docker.internal:54410';
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const p = url.searchParams.get('proj');
  const proj = p === 'proj-nolimit' ? '/proj-nolimit' : p === 'proj-noop' ? '/proj-noop' : p === 'proj-cachedtz' ? '/proj-cachedtz' : '/proj';
  const SERVICE = p === 'lib-only' ? '/lib-only' : `${proj}/supabase/functions/magrit-order-export-runner`;
  const rows = url.searchParams.get('rows') ?? '10';
  const gran = url.searchParams.get('gran') ?? 'line';
  const format = url.searchParams.get('format') ?? 'csv';
  const mem = Number(url.searchParams.get('mem') ?? '256');

  const reset = await (await fetch(`${FAKE}/reset?rows=${rows}&gran=${gran}&format=${format}&claims=${url.searchParams.get('claims') ?? '1'}`)).json();

  const envVars = [
    ['SUPABASE_URL', FAKE],
    ['SUPABASE_SERVICE_ROLE_KEY', 'bench-service-role-key'],
    ['MAGRIT_ORDER_EXPORT_RUN_SECRET', 'bench-secret'],
  ];
  const t0 = performance.now();
  let status = 0;
  let body = '';
  let error: string | null = null;
  try {
    // @ts-ignore EdgeRuntime global
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: SERVICE,
      memoryLimitMb: mem,
      workerTimeoutMs: 300_000,
      // Mode "plateforme" : cpuSoft=1000&cpuHard=2000 (valeurs EXACTES du
      // main.ts de la CLI Supabase). Par defaut : genereux, pour mesurer.
      cpuTimeSoftLimitMs: Number(url.searchParams.get('cpuSoft') ?? '60000'),
      cpuTimeHardLimitMs: Number(url.searchParams.get('cpuHard') ?? '120000'),
      noModuleCache: false,
      envVars,
      forceCreate: true,
      context: { bench: `${format}-${gran}-${rows}-${mem}` },
    });
    const inner = new Request(p === 'lib-only' ? `http://localhost/?rows=${rows}` : 'http://localhost/', { method: 'POST', headers: { 'x-magrit-order-export-run-secret': 'bench-secret' } });
    // @ts-ignore EdgeRuntime global — meme geste que le main de la CLI (Ht())
    EdgeRuntime.applySupabaseTag(req, inner);
    const res = await worker.fetch(inner);
    status = res.status;
    body = await res.text();
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  const wallMs = Math.round(performance.now() - t0);
  const last = await (await fetch(`${FAKE}/last`)).json();
  return Response.json({ tag: `${format}-${gran}-${rows}-mem${mem}`, reset, status, body: body.slice(0, 300), error, wallMs, last });
});
