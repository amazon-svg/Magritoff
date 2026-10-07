-- Les nouvelles boutiques démarrent dans le thème sombre validé. Les lignes
-- existantes et leurs éventuels choix explicites restent inchangés.
alter table public.shops
  alter column theme set default
  '{"primaryColor":"#1e3a8a","accentColor":"#f59e0b","mode":"dark","secondaryColor":"#6b7280","textColor":"#0f172a","bgColor":"#ffffff","fontPairing":"system"}'::jsonb;
