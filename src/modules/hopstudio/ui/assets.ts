export const HOPSTUDIO_ASSET_ROOT = '/vendor/hopstudio/1.0.0/';

/**
 * Copie Magrit des templates HopeStudio. Ce chemin est volontairement séparé
 * du bundle vendor afin que les EJS puissent évoluer sans modifier le dist.
 */
export const HOPSTUDIO_EJS_ROOT = '/hopstudio/ejs/';

export const HOPSTUDIO_RUNTIME_URL = `${HOPSTUDIO_ASSET_ROOT}sugarcrepeHLUX.mjs`;
export const HOPSTUDIO_STYLESHEET_URL = `${HOPSTUDIO_ASSET_ROOT}css/sugarcrepeHLUX.magrit.css`;
