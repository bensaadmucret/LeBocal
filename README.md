# Le Bocal

Le Bocal est une application desktop (Tauri + Vue 3) pensée pour l’écriture de notes structurées au format Editor.js, avec synchronisation locale et gestion d’états (statut, checklist, tags, blocs, etc.).

## Fonctionnalités principales

- **Tableau de bord** : statistiques agrégées et flux rapide (notes en revue, blocs en attente, dernière synchro)
- **Notes structurées** : édition via Editor.js (texte, headers, listes, checklist, blocs code)
- **Checklist & tâches** : suivi des “to-do” par note avec statut “done / pending”
- **Duplication & suppression** : gestion CRUD complète via store + Tauri backend
- **Modale d’édition dédiée** : focus mode pour éditer la note active
- **Confirmation de suppression** : overlay personnalisé pour éviter les suppressions accidentelles
- **Page Paramètres (placeholder)** : base pour les préférences futures

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

## À venir

- Duplication intelligente (sélection des éléments à copier)
- Historique des versions / snapshots
- Palette de commandes (⌘K) pour accélérer la saisie

Contributions bienvenues (issues, PR). Ouvre simplement une branche et propose un changelog clair.
