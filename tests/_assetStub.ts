// Stub d'asset pour vitest (env node) : les imports d'images (.png/.jpg/.svg…)
// dans le code source sont résolus vers cette chaîne au lieu d'un binaire.
// Vite/Rollup les transforme en URL au build réel ; en test on n'a besoin que
// d'une valeur string non vide (P18 v2 — visuels produits pré-brandés Magrit).
export default "test-asset-stub.png";
