// Event worker du banc : journalise les evenements du superviseur
// (Shutdown : raison, cpu_time_used, memory_used ; BootFailure ; exceptions).
// @ts-ignore EventManager global de l edge-runtime
const Listener = (globalThis as any).EventManager;
const listener = new Listener();
for await (const e of listener) {
  if (!e) continue;
  if (e.event_type === 'Log') {
    const msg = String(e.event?.msg ?? '');
    if (msg.includes('magrit-order-export-runner') || msg.includes('[bench]')) console.log('EVTLOG', msg.slice(0, 400));
    continue;
  }
  console.log('EVT', JSON.stringify({ type: e.event_type, event: e.event, ctx: e.metadata?.context ?? null }));
}
