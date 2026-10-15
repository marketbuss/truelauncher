# truelauncher

Launcher terminal style hacker avec titre en pixel art et intro Matrix.

```
npm install -g github:marketbuss/truelauncher
truelauncher
```

Sous Windows, si PowerShell bloque les scripts : `truelauncher.cmd`.

## Touches

| Touche | Action |
|---|---|
| ← → | changer d'onglet (★ TOP / JEUX / APPS / SCRIPTS) |
| ↑ ↓ | choisir |
| Entrée | lancer |
| / | recherche instantanée dans tous les onglets |
| f | favori (★ TOP = favoris puis les plus lancés) |
| s | scan auto : Steam, Epic, raccourcis Bureau / Menu Démarrer (espace cocher, * tout, Entrée ajouter) |
| a / d | ajouter un fichier / un dossier |
| r | renommer |
| x | retirer de la liste |
| q | quitter |

Config : `~/.truelauncher.json` (champ `title` pour changer le titre). `truelauncher --config` affiche son chemin.
