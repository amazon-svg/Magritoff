# TF-AF0 — La CI refuse une nouvelle dépendance Supabase dans le front

- **Parcours** : Transverse architecture
- **Persona** : Développeur Magrit
- **Précondition** : branche basée sur `main`, dépendances installées
- **Type d'exécution** : CI / terminal
- **Statut** : À publier dans Notion

## Étapes

1. Créer temporairement un fichier `src/app/__architecture_probe__.ts` important `/utils/supabase/client`.
2. Exécuter `pnpm test:architecture`.
3. Vérifier que le test signale une « nouvelle dépendance Supabase ».
4. Supprimer le fichier temporaire.
5. Relancer `pnpm test:architecture`.

## Résultat attendu

Le premier lancement échoue en nommant le fichier fautif ; le second est vert. Aucun changement fonctionnel ni appel réseau n'est nécessaire.
