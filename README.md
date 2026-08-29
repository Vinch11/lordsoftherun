# Conquête Urbaine

Crée une application web mobile-first appelée "Conquête" : un jeu de course en plein air pour mes cours d'EPS, façon Paper.io mais dans les rues avec le GPS réel.

RÔLES

- Un enseignant crée une "partie" et obtient un code à 4 chiffres.

- Plusieurs groupes d'élèves rejoignent la partie avec ce code, choisissent un nom d'équipe et une couleur.

- Pas besoin de mot de passe, garde la connexion la plus simple possible.

CARTE

- Carte plein écran basée sur Leaflet + OpenStreetMap (gratuit).

- Centrée sur la position de l'utilisateur.

MÉCANIQUE DE JEU (côté groupe)

- Chaque groupe a un gros bouton "Commencer ma boucle".

- Une fois lancé, sa trace GPS s'affiche en direct dans sa couleur (utilise navigator.geolocation.watchPosition avec enableHighAccuracy: true).

- Quand le groupe revient à moins de 20 m de son point de départ, APRÈS avoir parcouru au moins 100 m, la boucle se ferme automatiquement : la surface enfermée devient son territoire (utilise la librairie Turf.js pour créer le polygone et calculer sa surface en m²).

- Si un nouveau territoire recouvre celui d'un autre groupe, la zone commune passe au NOUVEau groupe (le dernier qui l'entoure l'emporte). Utilise Turf.js pour soustraire les zones.

- Score de chaque groupe = surface totale possédée en m².

VUE ENSEIGNANT (tableau de bord)

- Voit sur une seule carte : la position en direct de TOUS les groupes (un point de leur couleur), tous les territoires capturés, et un tableau des scores classé par surface, mis à jour en temps réel.

- Boutons "Démarrer la partie" et "Terminer la partie", avec un minuteur réglable.

TECHNIQUE

- Backend Supabase avec synchronisation en temps réel (realtime) : les positions et les territoires de tous les joueurs se mettent à jour en direct sur tous les écrans.

- Interface mobile-first, gros boutons lisibles en courant, pensée pour l'extérieur en plein soleil.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lordsoftherun.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18eeb041-a43b-4617-8c17-29dcd6e82085).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
