# Le Bocal

Le Bocal est une application desktop (Tauri + Vue 3) pensée pour l’écriture de notes structurées au format Editor.js, avec synchronisation locale et gestion d’états (statut, checklist, tags, blocs, etc.).

## Fonctionnalités principales

- **Tableau de bord** : statistiques agrégées et flux rapide (notes en revue, blocs en attente, dernière synchro)
- **Notes structurées** : édition via Editor.js (texte, headers, listes, checklist, blocs code)
- **Checklist & tâches** : suivi des “to-do” par note avec statut “done / pending”
- **Duplication & suppression** : gestion CRUD complète via store + Tauri backend
- **Modale d’édition dédiée** : focus mode pour éditer la note active
- **Confirmation de suppression** : overlay personnalisé pour éviter les suppressions accidentelles
- **Palette de commandes clavier** : raccourcis globaux configurables pour créer/dupliquer des notes et insérer des blocs Editor.js
- **Page Paramètres** : gestion des raccourcis personnalisés (capture, détection des conflits, reset)

## Stack technique

- **Frontend** : Vue 3 (`<script setup>`), TypeScript, Tailwind CSS
- **Editor** : [Editor.js](https://editorjs.io/)
- **Backend** : Tauri + Rust, SQLite embarqué
- **State management** : store maison (`useNotesStore`) synchronisé avec Tauri

## Démarrage

```bash
npm install
npm run tauri:dev
```

Ce script lance Vite (frontend) et Tauri (shell desktop). Assure-toi d’avoir Rust et la toolchain Tauri installés (voir [Docs Tauri](https://tauri.app/v1/guides/getting-started/prerequisites)).

## Structure

- `src/` : frontend Vue (composants, store, stylage)
- `src/components/editor` : intégration Editor.js
- `src-tauri/` : backend Rust (state, commandes Tauri)

## Licence / ouverture

Le projet est publié sous **GPL-3.0** (copyleft fort) : toute redistribution doit conserver la même licence et rester open source.

## Raccourcis clavier

| Action | macOS | Windows/Linux | Description |
| --- | --- | --- | --- |
| Créer une note | `⌘⇧N` | `Ctrl+Shift+N` | Ajoute une note vide et ouvre l’éditeur |
| Dupliquer la note active | `⌘⇧D` | `Ctrl+Shift+D` | Clone la note actuelle et ouvre la copie |
| Insérer un bloc texte | `⌘⌥T` | `Ctrl+Alt+T` | Ajoute un paragraphe directement dans Editor.js |
| Insérer un bloc checklist | `⌘⌥L` | `Ctrl+Alt+L` | Ajoute une checklist préremplie |
| Insérer un bloc code | `⌘⌥C` | `Ctrl+Alt+C` | Crée un bloc code prêt à être édité |

Ces combinaisons peuvent être modifiées dans **Paramètres → Raccourcis clavier** :

1. Cliquer sur « Modifier » en face d’une action, puis appuyer sur la nouvelle combinaison.
2. L’interface signale immédiatement tout conflit avec une autre commande.
3. Utiliser « Réinitialiser » pour revenir à la valeur par défaut (ou « Réinitialiser tout » pour restaurer l’ensemble).

Les raccourcis sont stockés dans `localStorage` côté client (mode mock) et seront synchronisés avec Tauri lorsque le backend sera disponible.

## À venir

- Duplication intelligente (sélection des éléments à copier)
- Historique des versions / snapshots
- Gestion de compte (profil, connexions cloud, notifications)

Contributions bienvenues (issues, PR). Ouvre simplement une branche et propose un changelog clair.
