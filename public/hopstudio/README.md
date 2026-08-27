# Templates HopeStudio personnalisés par Magrit

Le dossier `ejs/` contient la copie des templates livrés avec le runtime
HopeStudio. Le runtime JavaScript, les images, les langues et les autres assets
restent dans `/vendor/hopstudio/1.0.0/`.

L’intégration Magrit fournit explicitement `/hopstudio/ejs/` dans
`options.root_ejs.base` lors de l’initialisation du `div` HLUX. Les templates de
ce dossier peuvent donc être adaptés à l’UX Magrit sans modifier le dist
HopeStudio.

Lors d’une mise à jour du runtime HopeStudio, comparer le contenu de
`public/vendor/hopstudio/<version>/ejs/` avec ce dossier avant de reporter les
nouveaux templates ou changements amont.
