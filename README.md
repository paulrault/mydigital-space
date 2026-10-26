# MyDigital Space

Espace personnel pour organiser tâches, projets, habitudes, objectifs et focus (Pomodoro).

## Contenu

- `index.html` — structure de l’app
- `css/styles.css` — styles (thème clair / sombre)
- `js/app.js` — logique (tâches, Kanban, sous-tâches, calendrier, habitudes, objectifs, Pomodoro, graphiques)
- `manifest.json` — PWA
- `sw.js` — service worker (mode hors-ligne basique)

## Utilisation

1. Ouvre le dossier dans un navigateur **via un serveur local** (nécessaire pour le service worker) :
   ```bash
   # Exemple avec Python
   cd mydigital-space
   python3 -m http.server 8080
   ```
   Puis va sur http://localhost:8080

2. Ou ouvre simplement `index.html` (tout fonctionne sauf le cache offline avancé).

## Fonctionnalités

- Tâches avec sous-tâches, priorités, projets liés, vue liste / Kanban, drag & drop
- Projets, objectifs, habitudes (streaks), calendrier
- Mode Focus (Pomodoro) avec widget flottant
- Statistiques et graphiques
- Thème clair / sombre
- Export / import JSON
- Données 100 % locales (localStorage)
- Installable (PWA)

## Sauvegarde

Paramètres → Exporter mes données. Le fichier JSON peut être réimporté plus tard ou sur un autre appareil.
