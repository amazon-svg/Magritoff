// Sonde C1a : une entree d import map explicite `fflate@0.8.2` force-t-elle
// la version TRANSITIVE resolue pour write-excel-file (^0.8.2) ?
import writeExcelFile from 'write-excel-file/node';
import { strToU8 } from 'fflate';

Deno.serve(async () => {
  const wb = writeExcelFile([[{ value: 'x', type: String }]], { sheet: 'S' });
  const buf = await wb.toBuffer();
  return Response.json({ ok: true, bytes: buf.byteLength, probe: strToU8('a').length });
});
