# Test d'intégration HopeStudio réel

Ce test vérifie l'adaptateur Magrit contre un serveur HopeStudio réel. Il est
séparé de la suite standard afin que `pnpm test` ne déclenche aucun appel
réseau, aucune session et aucun coût IA.

## Configuration locale

```bash
cp .env.hopstudio.test.example .env.hopstudio.test.local
```

Renseigner ensuite dans `.env.hopstudio.test.local` :

- `HOPSTUDIO_TEST_URL` ;
- `HOPSTUDIO_TEST_TENANT_ID` ;
- `HOPSTUDIO_TEST_USER_ID` ;
- éventuellement le couple `HOPSTUDIO_TEST_CLARIPRINT_USER` et
  `HOPSTUDIO_TEST_CLARIPRINT_PASS` ;
- éventuellement `HOPSTUDIO_TEST_CLARIPRINT_URL` et un jeton Bearer.

L'identifiant et le mot de passe Clariprint ne sont pas obligatoires. S'ils
sont utilisés, ils doivent être fournis ensemble. Le fichier `.local` est
ignoré par Git et les tests n'affichent jamais ces valeurs.

## Exécution

```bash
pnpm test:hopstudio:live
```

Avec `HOPSTUDIO_TEST_TRACE=1`, le terminal affiche :

- l'URL et la méthode HTTP ;
- les en-têtes envoyés, avec les identifiants et jetons remplacés par
  `[MASQUÉ]` ;
- le formulaire décodé, notamment `action`, `id` et `parameters_value` ;
- le statut HTTP et le corps complet de la réponse HopeStudio.

La réponse peut contenir des références de session et des données métier. La
trace doit donc rester locale et ne pas être publiée telle quelle dans un log
public.

## Traces du chat depuis l'UX locale

Pour afficher les 30 dernières minutes de traces structurées :

```bash
pnpm logs:hopstudio:recent
```

Pour suivre les nouveaux appels en direct :

```bash
pnpm logs:hopstudio
```

Pour isoler ensuite un appel à partir du `traceId` affiché dans l'UX :

```bash
pnpm logs:hopstudio:recent -- --trace VOTRE_TRACE_ID
```

Chaque appel conserve le même `traceId` de l'UX jusqu'aux requêtes `CallAI` et
`loadSessionParts`. Les traces indiquent les étapes, statuts, durées et forme
des réponses. Les mots de passe, jetons et valeurs d'en-têtes
d'authentification ne sont jamais journalisés.

Le premier test envoie une requête `CallAI`, hydrate les éventuelles cartes
DBK avec `loadSessionParts`, puis valide le contrat normalisé consommé par
Magrit.

Pour tester également un second échange avec continuité de session, définir
`HOPSTUDIO_TEST_CONTINUATION=1`. Cela déclenche un appel IA supplémentaire.
