// Sonde C1d : entree d import map fflate@0.8.2 SANS AUCUN import de fflate.
import writeExcelFile from 'write-excel-file/node';
Deno.serve(async () => Response.json({ ok: true, bytes: (await writeExcelFile([[{ value: 'x', type: String }]], { sheet: 'S' }).toBuffer()).byteLength }));
