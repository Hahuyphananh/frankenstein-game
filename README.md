# FRANKENSTEIN

Un jeu d’arcade en 2D pour le navigateur, réalisé avec HTML Canvas, CSS et des modules JavaScript natifs. Aucun framework, aucune étape de compilation, aucun serveur et aucun service externe.

Inspiré du roman *Frankenstein* de Mary Shelley.

**Version en ligne :** https://hahuyphananh.github.io/frankenstein-game/

**État : un niveau jouable.** La Créature traque Elizabeth dans un village victorien tandis que Victor tente de la capturer. Elizabeth se déplace dans les rues en boucle et fuit lorsque la Créature approche. Si Victor épuise les trois vies de la Créature, Elizabeth et Justine sont sauves. Sinon, la tragédie du roman se produit.

## Fonctionnalités

- Un niveau complet dans un village gothique dessiné au canvas.
- Trois difficultés avec des vitesses, des ruées et des intelligences différentes.
- Elizabeth mobile : elle marche lentement, explore les rues et fuit la Créature.
- Trois vies pour la Créature, avec réapparition dans un coin différent après chaque contact.
- Ruée automatique de la Créature, avec indicateur de recharge dans l’interface.
- En Difficile, un mur peut être brisé par vie ; l’indicateur précise s’il est prêt ou utilisé.
- Positions de départ aléatoires pour Victor, Elizabeth et la Créature ; chaque nouvelle partie et chaque Recommencer évite de reprendre exactement les mêmes cases.
- Carte en plein écran par défaut, avec bascule vers une carte en fenêtre.
- Interface, textes du récit, consignes et documentation entièrement en français.
- Aucune dépendance, aucun appel réseau et aucune clé d’API.

## Structure du projet

```text
index.html          Menu, interface, pauses, résultats et instructions
css/
  base.css          Variables, remise à zéro, calques et boutons communs
  menu.css          Menu simplifié, interface, surimpressions et fenêtre modale
js/
  main.js           Démarrage : réglages, audio, clavier, rendu et jeu
  config.js         Réglages, difficultés, ruées et règles de capture
  maze.js           Labyrinthe 25×15, murs, coins et positions de départ
  camera.js         Caméra qui adapte le labyrinthe à la fenêtre
  actor.js          Déplacement commun, sûr et aligné sur la grille
  player.js         Contrôleur de Victor et virages mémorisés
  creature.js       Créature de base, ruée, bris de mur et réapparitions
  story.js          Elizabeth, récits et Créature à intelligence variable
  pathing.js        Champs de distance, champ de risque et prévision
  timer.js          Compte à rebours, score par étoiles et formatage
  sprites.js        Art de pixels, orientations et portraits des personnages
  renderer.js       Canvas : rues, lueurs, acteurs, ruée et impacts
  loop.js           Boucle requestAnimationFrame avec delta limité
  game.js           Machine à états, temps, vies, pause et résultats
  menu.js           Contrôleur du menu, de l’interface et des overlays
  audio.js          Sons synthétisés de l’interface et du jeu
  input.js          Clavier et correspondance WASD / flèches
  storage.js        Sauvegarde locale protégée des réglages
```

## Direction visuelle

- Les rues pavées claires contrastent avec les blocs de pierre sombres, leurs arêtes claires et leurs ombres profondes.
- Brume, clair de lune, vignettage froid et réverbères vacillants installent l’atmosphère du village.
- Cinq personnages sont dessinés en art de pixels sur une grille de 32×32, puis agrandis sans lissage :
  - **Victor** — longue blouse de laboratoire ivoire, revers, poche, crayons, pantalon sombre et lunettes.
  - **La Créature** — plus grande, peau verte, coutures, boulons et yeux ambrés.
  - **Justine** — robe ardoise, tablier blanc et coiffe.
  - **Henry** — manteau brun, gilet vert et montre de poche.
  - **Elizabeth** — robe bordeaux, châle, longs cheveux auburn et médaillon doré.
- Victor, la Créature et Elizabeth ont des cycles de marche directionnels ; les images tournées vers la droite reprennent le dessin de gauche en miroir.
- Une ruée laisse des silhouettes de vitesse et un anneau de braise autour de la Créature. Le bris de mur projette des éclats de pierre et reconstruit la rue autour de l’ouverture.
- Un contact réussi déclenche un éclat doré ; la capture finale est plus large. Une vie perdue fait vibrer le compteur et rougit les bords de l’écran.

## Le niveau du village

- Le labyrinthe est une grille de 25×15 formée de blocs de pierre séparés. Chaque bloc possède une rue d’une case sur son pourtour, ce qui crée de nombreux circuits et permet à la Créature de contourner un pâté de maisons.
- **Elizabeth** avance à `1,3` case par seconde. Elle erre dans les rues et, lorsque la Créature entre dans un rayon de `7` cases, elle utilise un champ de distance pour choisir la direction qui laisse le plus de rues entre elles.
- La Créature est une `StoryCreature` spécifique au niveau. Son comportement dépend de la difficulté.
- Victor doit épuiser les trois vies de la Créature.
- **Si la Créature atteint Elizabeth :** Elizabeth meurt. Justine Moritz est plus tard exécutée après avoir été faussement accusée de son meurtre. Justine n’est pas physiquement tuée par la Créature.
- **Si Victor capture la Créature :** Elizabeth survit et Justine n’est jamais accusée.
- Si le temps s’épuise, la Créature atteint Elizabeth et la même tragédie se produit.
- L’écran de résultat affiche l’issue, le temps, les étoiles et un bouton **Recommencer**.

## Intelligence de la Créature

Le profil de difficulté contrôle la reconnaissance des chemins et la peur de Victor.

| Difficulté | Reconnaissance des chemins | Comportement face à Victor |
| ---------- | -------------------------- | -------------------------- |
| Facile | Aucune : poursuite directe vers la case d’Elizabeth | Ignore Victor |
| Normal | Bonne : champ de distance, puis champ de risque modéré près de Victor | Évite les cases situées à moins d’une case de Victor |
| Difficile | Très bonne : champ de risque pondéré qui cherche le chemin le plus rapide vers Elizabeth tout en s’éloignant de Victor | Évite fortement Victor et refuse de s’en approcher à moins de deux cases lorsqu’une autre sortie existe |

En Normal et en Difficile, `buildRiskField()` construit un champ de coût de type Dijkstra depuis Elizabeth. Chaque case proche de Victor coûte plus cher, ce qui permet de trouver un itinéraire rapide mais prudent plutôt qu’un simple couloir vers elle. Le champ est mis en cache jusqu’au changement de case d’Elizabeth ou de Victor, puis reconstruit après un bris de mur ou une réapparition.

## Pouvoirs de la Créature

| Difficulté | Temps | Recharge de la ruée | Murs |
| ---------- | ----- | ------------------- | ---- |
| Facile | 120 s | 16 s | Non |
| Normal | 90 s | **10 s** | Non |
| Difficile | 60 s | 8 s | **Un mur par vie** |

- La Créature déclenche automatiquement une ruée lorsque Elizabeth est à portée et que la recharge est terminée. Sa vitesse augmente temporairement et laisse des silhouettes derrière elle.
- En Difficile, une vie permet de briser un mur adjacent. L’ouverture reste jusqu’à la fin de la partie et toutes les mémoires de chemin sont reconstruites.
- Le bris de mur n’est pas rechargeable à chaque ruée : il faut perdre une vie pour en obtenir un nouveau.
- L’interface affiche l’état de la ruée (**Prêt**, **Actif** ou le nombre de secondes restantes) ainsi que l’état du mur (**Mur : prêt** ou **Mur : utilisé**).
- **Recommencer** restaure les murs et recrée tous les acteurs.
- Lorsqu’elle est touchée, la Créature réapparaît dans un coin différent : `(1,1)`, `(23,1)`, `(1,13)` ou `(23,13)`. Chaque vie utilise un coin distinct tant que des alternatives existent.

## Positions de départ

- Au lancement d’une partie, la Créature apparaît dans un coin aléatoire.
- Victor et Elizabeth apparaissent sur des cases de rue aléatoires, à distance de la Créature et l’un de l’autre.
- La fonction `chooseStartPositions()` mémorise la partie précédente et évite de replacer chaque personnage sur exactement la même case au Recommencer.
- Les trois personnages ne partagent jamais la même case au départ.
- La réapparition de la Créature après un contact reste séparée de la position de Victor.

## Carte plein écran

- Le niveau s’ouvre dans une vue immersive qui remplit la fenêtre, avec une interface compacte en surimpression.
- Le bouton **Fenêtré** de l’interface, ou la touche `F`, bascule vers la scène encadrée. Le bouton affiche alors **Plein écran** ; le choix est conservé avec les autres réglages.
- Sur petit écran, les libellés secondaires et le bouton de son de la scène sont masqués pour laisser toute la place au labyrinthe. Le bouton de carte devient **Carte**.
- L’indicateur de ruée et l’indicateur de mur restent visibles sur mobile.

## Temps et score

| Difficulté | Temps | 3 étoiles | 2 étoiles |
| ---------- | ----- | --------- | --------- |
| Facile | 120 s | ≤ 60 s | ≤ 95 s |
| Normal | 90 s | ≤ 40 s | ≤ 70 s |
| Difficile | 60 s | ≤ 25 s | ≤ 45 s |

- Le chronomètre démarre au lancement de la partie et s’affiche dans l’interface.
- `P` met la partie en pause ; le temps est gelé et reprend au clic sur **Reprendre**.
- Le temps s’arrête à la fin de la partie, victoire ou défaite.
- Une victoire enregistre `game.lastResult` avec les millisecondes exactes, le nombre d’étoiles et l’issue du récit.
- Le temps utilise `performance.now()` plutôt que l’addition des deltas de frames.

## Boucle de capture

- Victor est invulnérable ; la Créature possède les vies.
- Chaque vague commence avec **3 vies** (`CREATURE_RULES.lives`).
- Un contact retire une vie, téléporte la Créature dans un autre coin et accorde **2 secondes** d’invulnérabilité.
- Les collisions utilisent une distance en cases (`CREATURE_RULES.hitDistance`). L’invulnérabilité est activée avant la frame suivante, ce qui empêche un seul chevauchement de retirer plusieurs vies.
- Les anciennes stratégies `wander`, `evade` et `outwit` restent disponibles dans `creature.js` ; le niveau du village utilise la sous-classe `StoryCreature`.

## Équilibrage

Les simulations finales ont été lancées avec les positions de départ aléatoires et l’intelligence réelle du jeu, sur 48 parties par difficulté :

| Difficulté | Survie seule d’Elizabeth | Victoires du Victor automatique | Morts d’Elizabeth avec le Victor automatique |
| ---------- | ------------------------ | ----------------------- | ----------------------------- |
| Facile | 27,1 s en moyenne | 88 % | 6 / 48 |
| Normal | 19,1 s en moyenne | 90 % | 5 / 48 |
| Difficile | 17,1 s en moyenne | 48 % | 21 / 48 |

La survie seule mesure le temps qu’Elizabeth passe sans intervention de Victor. Le Victor automatique suit un chemin parfait vers la Créature ; un joueur humain peut donc obtenir des résultats différents. En Difficile, l’évitement de Victor par la Créature fait nettement baisser le taux de victoire du bot, ce qui correspond à l’objectif de la difficulté.

## Lancer le jeu localement

Les modules ES ne peuvent pas être chargés depuis `file://`. Il faut servir le dossier en HTTP :

```bash
python -m http.server 8080
```

Ouvrez ensuite l’adresse locale affichée (généralement le port 8080). Ajoutez `?debug=1` pour exposer `window.__FRANKENSTEIN_GAME__` pendant les vérifications automatisées.

## Déployer sur GitHub Pages

1. Poussez le dépôt sur GitHub.
2. Ouvrez **Réglages → Pages**.
3. Choisissez **Déployer depuis une branche**, puis la branche `main` et le dossier `/ (root)`.
4. Enregistrez, attendez la compilation de Pages, puis ouvrez `https://<utilisateur>.github.io/<dépôt>/`.

Le jeu est entièrement statique : le HTML, le CSS, les modules JavaScript, les sprites et le favicon utilisent des chemins relatifs ou des données intégrées. Il n’y a ni compilation, ni code serveur, ni clé d’API, ni service externe.

## Commandes

| Touche | Action |
| ------ | ------ |
| `W` `A` `S` `D` | Déplacer Victor |
| `↑` `↓` `←` `→` | Déplacer Victor |
| `P` | Mettre le temps en pause / reprendre |
| `F` | Basculer entre carte plein écran et fenêtre |
| `Échap` | Quitter le labyrinthe / fermer la fenêtre |
| `Entrée` | Lancer la partie depuis le menu |

## Prochaines étapes

- Peaufinage final des animations et des décors gothiques.
- Niveaux supplémentaires, si demandé.
