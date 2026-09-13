// Sonde C1b : un deno.lock (v4, format Deno 2.1) qui epingle fflate 0.8.2
// comme dependance de write-excel-file 4.1.1 est-il honore par
// edge-runtime v1.69.12 ? (0.8.3 est la plus haute version satisfaisant ^0.8.2)
import writeExcelFile from 'write-excel-file/node';

Deno.serve(async () => {
  const wb = writeExcelFile([[{ value: 'x', type: String }]], { sheet: 'S' });
  const buf = await wb.toBuffer();
  return Response.json({ ok: true, bytes: buf.byteLength });
});
