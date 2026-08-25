// three-viewer-helpers.js (ESM)
// Reusable helpers for the PLG Three.js viewer.
// Safe to host at: /public/custom/three-viewer-helpers.js

import * as THREE from 'three';

// --- GLB tools -------------------------------------------------------------
export function analyzeGLB(buffer){
  try{
    const dv = new DataView(buffer);
    if(dv.getUint32(0,true) !== 0x46546C67) return { ok:false, reason:'en-tête GLB invalide' };
    const version = dv.getUint32(4,true);
    if(version !== 2) return { ok:false, reason:`version ${version} non supportée` };
    const total = dv.getUint32(8,true);
    let offset = 12; let json=null, bin=null;
    while(offset + 8 <= total){
      const chunkLength = dv.getUint32(offset,true); offset+=4;
      const chunkType = dv.getUint32(offset,true); offset+=4;
      if(chunkType===0x4E4F534A){
        const bytes=new Uint8Array(buffer, offset, chunkLength);
        const text=new TextDecoder('utf8').decode(bytes);
        json=JSON.parse(text);
      } else if (chunkType===0x004E4942){
        bin=new Uint8Array(buffer, offset, chunkLength);
      }
      offset += chunkLength;
    }
    if(!json) return { ok:false, reason:'chunk JSON manquant' };
    if(!bin)  return { ok:false, reason:'chunk BIN manquant' };
    return { ok:true, json, bin };
  }catch(e){ return { ok:false, reason:'analyse GLB échouée' } }
}

export function toBase64(uint8){
  let binary='';
  for(let i=0;i<uint8.byteLength;i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}
export function utf8Encode(str){ return new TextEncoder().encode(str); }
export function pad4(n){ return (4 - (n % 4)) % 4; }

export function buildGLB(jsonObj, bin){
  const jsonText = JSON.stringify(jsonObj);
  const jsonBytes = utf8Encode(jsonText);
  const jsonPadded = new Uint8Array(jsonBytes.length + pad4(jsonBytes.length));
  jsonPadded.set(jsonBytes);
  for(let i=jsonBytes.length;i<jsonPadded.length;i++) jsonPadded[i] = 0x20; // space padding per spec
  const binPadded = new Uint8Array(bin.length + pad4(bin.length));
  binPadded.set(bin);
  const jsonLength = jsonPadded.length, binLength = binPadded.length;
  const totalLength = 12 + (8 + jsonLength) + (8 + binLength);
  const glb = new ArrayBuffer(totalLength);
  const dv = new DataView(glb); let offset=0;
  // header
  dv.setUint32(offset, 0x46546c67, true); offset+=4; // 'glTF'
  dv.setUint32(offset, 2, true);         offset+=4; // version 2
  dv.setUint32(offset, totalLength, true); offset+=4; // length
  // JSON chunk
  dv.setUint32(offset, jsonLength, true); offset+=4;
  dv.setUint32(offset, 0x4E4F534A, true); offset+=4; // 'JSON'
  new Uint8Array(glb, offset, jsonLength).set(jsonPadded); offset+=jsonLength;
  // BIN chunk
  dv.setUint32(offset, binLength, true); offset+=4;
  dv.setUint32(offset, 0x004E4942, true); offset+=4; // 'BIN\0'
  new Uint8Array(glb, offset, binLength).set(binPadded);
  return glb;
}

// Patch JSON to embed images (bufferView→data:) only; buffer remains in BIN chunk
export function embedImagesAsDataURI(json, bin){
  const patched = JSON.parse(JSON.stringify(json));
  if(Array.isArray(patched.images)){
    for(let i=0;i<patched.images.length;i++){
      const img = patched.images[i];
      if(typeof img.bufferView === 'number'){
        const view = patched.bufferViews[img.bufferView];
        const start = (view.byteOffset||0);
        const end = start + view.byteLength;
        const mime = img.mimeType || 'image/png';
        const slice = bin.subarray(start, end);
        const b64 = toBase64(slice);
        img.uri = `data:${mime};base64,${b64}`;
        delete img.bufferView; delete img.mimeType;
      } else if (img.uri && !/^data:/i.test(img.uri)) {
        throw new Error(`Image non-embed détectée dans GLB local: images[${i}].uri=${img.uri}. Réexporte en GLB (embed textures).`);
      }
    }
  }
  return { json: patched };
}

// --- Scene/camera helpers --------------------------------------------------
export async function fitCameraToObject(object, camera, controls, offset = 1.2){
  const THREEglobal = (await import('https://unpkg.com/three@0.160.0/build/three.module.js'));
  const THREE = THREEglobal;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = (maxDim/2) / Math.tan(fov/2);
  const dirVec = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(center.clone().add(dirVec.multiplyScalar(dist*offset)));
  camera.near = Math.max(0.01, dist/100);
  camera.far  = Math.max(100, dist*100);
  camera.updateProjectionMatrix();
  if(controls){ controls.target.copy(center); controls.update(); }
}

// --- Anchor-relative helpers (make presets relative to HERO)
export function pickAnchor(root,selection){
  // Prefer current selection; else an object named 'Hero' or 'Source'; else first selectable
  if(selection) return selection;
  const byName = root.children.find(c=>/^(hero|source)$/i.test(c.name));
  if(byName) return byName;
  return root.children.find(c=>c.userData.selectable) || null;
}

export function computeAnchorFrame(anchor){
  // Returns {center, diag, quat} in world space
  const box = new THREE.Box3().setFromObject(anchor);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diag = size.length();
  const quat = new THREE.Quaternion(); anchor.getWorldQuaternion(quat);
  return { center, diag: (diag>0?diag:1), quat };
}

export function relToWorld(offsetArr, frame){
  // offsetArr in hero-diag units, oriented by hero quaternion
  const v = new THREE.Vector3().fromArray(offsetArr).multiplyScalar(frame.diag);
  v.applyQuaternion(frame.quat);
  return frame.center.clone().add(v);
}

export function setEnvIntensity(root, intensity=1){
  root.traverse(obj=>{
    if(obj.isMesh && obj.material){
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m=>{ if('envMapIntensity' in m) { m.envMapIntensity = intensity; m.needsUpdate = true; } });
    }
  });
}

// --- Diagnostics -----------------------------------------------------------
export function explainFetchError(url, err){
  const tips = [
    '- URL valide et accessible en HTTPS',
    "- CORS activé côté serveur (Access-Control-Allow-Origin: *)",
    '- Pas de mélange http/https (mixed content)',
    '- Pas de restriction referer/origin côté CDN',
    '- Réseau d’entreprise / ad-block ?',
  ];
  // Consumer side will route to its logger
  console.warn(`[Fetch error] ${url} -> ${err?.message||err}\nPistes:\n  ${tips.join('\n  ')}`);
}

// Optional: disable createImageBitmap path (helps with CSP on data:/blob:)
export function cspDisableImageBitmap(logFn){
  try {
    if (typeof createImageBitmap !== 'undefined') {
      try { delete window.createImageBitmap; } catch(e){ window.createImageBitmap = undefined; }
      logFn && logFn('CSP: createImageBitmap désactivé (évite Fetch sur data:/blob:).');
    }
  } catch(e) { logFn && logFn('WARN: impossible de désactiver createImageBitmap: '+(e.message||e)); }
}


// Expose on window for non-import usage (optional)
const __helpers = { analyzeGLB, toBase64, utf8Encode, pad4, buildGLB, embedImagesAsDataURI, fitCameraToObject, setEnvIntensity, explainFetchError, cspDisableImageBitmap };
if (typeof window !== 'undefined') { window.Helpers = __helpers; }
export default __helpers;
