# Checklist avant publication GitHub

- [ ] Choisir et ajouter une licence.
- [ ] Vérifier que le dépôt à publier est ce dossier de distribution, pas le monorepo personnel.
- [ ] Vérifier `git status` et `git diff --cached` avant chaque commit.
- [ ] Confirmer l’absence de `data/outliers/library.json` et `title-analyses.json`.
- [ ] Confirmer l’absence de fichiers dans `medias/Outliers/`, hors `.gitkeep` éventuel.
- [ ] Rechercher `.env`, `vault.json`, `.vaultkey`, credentials, tokens et clés API.
- [ ] Rechercher les chemins personnels (`C:\\Users\\`, `W:\\WebDev\\`) et noms d’utilisateur.
- [ ] Vérifier que les fixtures ne contiennent aucune vraie vidéo ou niche personnelle.
- [ ] Exécuter `node --test tests/*.test.js`.
- [ ] Tester l’audit et l’installation sur une copie jetable d’un Agentic OS compatible.
- [ ] Tester Chrome avec Agentic OS actif puis arrêté.
- [ ] Inspecter tout l’historique Git avant de rendre le dépôt public.

Commandes de contrôle suggérées :

```powershell
git ls-files
rg -n -i "api[_-]?key|token|secret|credential|vault|C:\\\\Users\\\\|W:\\\\WebDev\\\\" .
git grep -n "medias/Outliers"
```
