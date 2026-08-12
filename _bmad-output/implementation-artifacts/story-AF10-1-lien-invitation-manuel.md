---
id: AF10.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF10]
---

# AF10.1 — Rendre visible le lien manuel d’invitation

## Incident

Quand Resend n’était pas configuré, le serveur créait correctement
l’invitation avec `sent=false`, mais le lien était présenté par
`window.prompt`. Ce dialogue pouvait être bloqué ou passer inaperçu, puis la
modale se fermait automatiquement.

## Correction

- suppression de `window.prompt` ;
- conservation de la modale après une création sans email ;
- état de succès explicite avec motif, destinataire et lien sélectionnable ;
- bouton de copie avec confirmation visuelle ;
- repli vers la copie manuelle si l’API Clipboard est indisponible ;
- fermeture volontaire par l’administrateur après récupération du lien.

## Validation

- garde-fou d’architecture interdisant le retour de `prompt` ;
- typecheck modulaire, suite complète et build de production.
