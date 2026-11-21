# FRANKENSTEIN

Un jeu d’arcade en 2D pour le navigateur, réalisé avec HTML Canvas, CSS et des modules JavaScript natifs. Aucun framework, aucune étape de compilation, aucun serveur et aucun service externe.

Inspiré du roman *Frankenstein* de Mary Shelley.

**Version en ligne :** https://hahuyphananh.github.io/frankenstein-game/

**État : un niveau jouable, en solo ou en duel local.** Dans **Protéger Elizabeth**, la Créature traque Elizabeth tandis que Victor tente de la capturer. Dans le mode **2 joueurs**, deux joueurs partagent le clavier : Victor défend Elizabeth avec WASD, la Créature la poursuit avec les flèches. Elizabeth se déplace dans les rues en boucle et fuit lorsque la Créature approche. Si Victor épuise les trois vies de la Créature, Elizabeth et Justine sont sauves. Sinon, la tragédie du roman se produit.

## Fonctionnalités

- Un niveau complet dans un village gothique dessiné au canvas.
- **Protéger Elizabeth** : mode solo où Victor, contrôlé avec WASD ou les flèches, doit capturer trois fois la Créature avant qu’elle n’atteigne Elizabeth.
- **2 joueurs** : duel local à deux joueurs, Victor au WASD et la Créature aux flèches. La Créature n’a qu’une vie, ne peut pas effectuer de ruée et se déplace à la même vitesse que Victor.
- Trois difficultés avec des vitesses, des ruées et des intelligences différentes.
- Elizabeth mobile : elle marche lentement, explore les rues et fuit la Créature.
- Trois vies pour la Créature en mode Protection, avec réapparition dans un coin différent après chaque contact.
- Ruée automatique de la Créature dès que sa recharge est prête, sans condition de portée, avec indicateur de recharge dans l’interface.
- La ruée est plus rapide et plus longue, et brise **tous les murs** qu’elle traverse, dans les trois difficultés.
- Elizabeth est invulnérable pendant les quatre secondes de protection qui suivent la réapparition de la Créature.
- Positions de départ aléatoires pour Victor, Elizabeth et la Créature ; chaque nouvelle partie et chaque Recommencer évite de reprendre exactement les mêmes cases.
- Carte en plein écran par défaut, avec bascule vers une carte en fenêtre.
- Interface, textes du récit, consignes et documentation entièrement en français.
- Aucune dépendance, aucun appel réseau et aucune clé d’API.

## Modes

| Mode | Joueurs | Objectif |
| ---- | ------- | -------- |
| **Protéger Elizabeth** | 1 joueur | Contrôler Victor avec WASD ou les flèches et capturer trois fois la Créature avant qu’elle n’atteigne Elizabeth. |
| **2 joueurs** | Deux joueurs sur le même clavier | La Créature (flèches) doit atteindre Elizabeth avant que Victor (WASD) ne la touche. Une seule vie, aucune ruée et aucun chronomètre ; les deux personnages vont à la même vitesse. |

En mode 2 joueurs, Elizabeth morte donne la victoire à la Créature ; un contact avec Victor donne la victoire à Victor. Le mode choisi est conservé avec les autres réglages.

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
  story.js          Elizabeth, récits, Créature à intelligence variable et Créature manuelle
  pathing.js        Champs de distance, champ de risque et champ de ruée à travers les murs
  timer.js          Compte à rebours, score par étoiles et formatage
  sprites.js        Art de pixels, orientations et portraits des personnages
  renderer.js       Canvas : rues, lueurs, acteurs, ruée et impacts
  loop.js           Boucle requestAnimationFrame avec delta limité
  game.js           Machine à états, modes, temps, vies, pause et résultats
  menu.js           Contrôleur du menu, de l’interface et des overlays
  audio.js          Sons synthétisés de l’interface et du jeu
  input.js          Clavier, correspondance WASD / flèches et contrôles séparés du duel
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
- **Elizabeth** avance à `3,2` cases/s en mode Protection et à `1,8` case/s dans le duel. Elle erre dans les rues et, lorsque la Créature entre dans un rayon de `7` cases, elle utilise un champ de distance pour choisir la direction qui laisse le plus de rues entre elles.
- La Créature est une `StoryCreature` spécifique au niveau. Son comportement dépend de la difficulté.
- En mode **Protéger Elizabeth**, Victor doit épuiser les trois vies de la Créature.
- En mode **2 joueurs**, le joueur incarné est une `PlayerCreature` : elle avance aux flèches, possède une seule vie, ne peut pas déclencher de ruée et utilise la vitesse de Victor.
- **Si la Créature atteint Elizabeth :** Elizabeth meurt. Justine Moritz est plus tard exécutée après avoir été faussement accusée de son meurtre. Justine n’est pas physiquement tuée par la Créature.
- **Si Victor capture la Créature en mode Protection :** Elizabeth survit et Justine n’est jamais accusée.
- **En duel :** un contact de Victor met fin à l’unique vie de la Créature et donne la victoire à Victor. Atteindre Elizabeth donne la victoire au joueur qui contrôle la Créature. Il n’y a pas de chronomètre en duel.
- Si le temps s’épuise en mode Protection, la Créature atteint Elizabeth et la même tragédie se produit.
- L’écran de résultat affiche l’issue et un bouton **Recommencer**. Le temps et les étoiles sont réservés au mode Protection.

## Vitesses

| Difficulté | Créature | Victor |
| ---------- | -------- | ------ |
| Facile | 1,4 case/s | 5 cases/s |
| Normal | 1,7 case/s | 5 cases/s |
| Difficile | 1,8 case/s | 5,6 cases/s |

La vitesse de base de la Créature augmente légèrement à chaque difficulté, mais reste très inférieure à celle de Victor. La pression vient surtout de la ruée et du bris de murs, pas d’une course permanente. En mode **2 joueurs**, les deux personnages utilisent `playerSpeed` : 5 cases/s en Facile et en Normal, 5,6 en Difficile. Elizabeth y utilise une vitesse réduite afin que la Créature, qui n’a pas de ruée, puisse la rattraper.

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
| Facile | 120 s | 10 s | Tous les murs traversés |
| Normal | 90 s | **5 s** | Tous les murs traversés |
| Difficile | 60 s | **2 s** | Tous les murs traversés |

- Au lancement et après chaque réapparition, la recharge démarre pleine : la première ruée attend 10 s en Facile, 5 s en Normal et 2 s en Difficile. Ensuite, la Créature déclenche automatiquement une ruée dès que la recharge est terminée, sans condition de portée ; la recharge est la seule limite.
- Une ruée dure `1,2` seconde et multiplie la vitesse par `3`. Elle laisse des silhouettes derrière elle.
- Pendant la ruée, la Créature suit le chemin le plus court en ignorant les murs et brise **chaque mur qu’elle traverse**, dans les trois difficultés. Plusieurs murs peuvent tomber pendant une même ruée.
- Les ouvertures restent jusqu’à la fin de la partie. Toutes les mémoires de chemin sont reconstruites après chaque bris.
- Il n’y a plus de limite d’un mur par vie : le bris est lié à la ruée, pas aux réapparitions.
- L’interface affiche l’état de la ruée (**Prêt**, **Actif** ou le nombre de secondes restantes) ainsi que le nombre de murs brisés pendant la dernière ruée (**Murs : brisables** ou **Murs : N brisés**). La jauge est masquée en mode 2 joueurs, puisque la Créature ne peut pas y effectuer de ruée.
- **Recommencer** restaure les murs et recrée tous les acteurs.
- Lorsqu’elle est touchée en mode Protection, la Créature réapparaît dans un coin différent : `(1,1)`, `(23,1)`, `(1,13)` ou `(23,13)`. Chaque vie utilise un coin distinct tant que des alternatives existent. La recharge de ruée repart alors à zéro. Pendant les quatre secondes de protection, Elizabeth est également invulnérable.

## Positions de départ

- En mode Protection, la Créature apparaît dans un coin aléatoire. Victor et Elizabeth apparaissent sur des cases de rue aléatoires, à distance de la Créature et l’un de l’autre.
- `chooseStartPositions()` mémorise la partie précédente et évite de replacer chaque personnage sur exactement la même case au Recommencer.
- En mode 2 joueurs, `chooseDuelStartPositions()` place la Créature dans l’un des deux coins les plus proches d’Elizabeth, puis Victor à au moins 10 cases de la Créature. Le duel commence ainsi avec une course réelle plutôt qu’avec un avantage écrasant pour Victor.
- Les trois personnages ne partagent jamais la même case au départ.
- La réapparition de la Créature après un contact reste séparée de la position de Victor.
- En mode 2 joueurs, il n’y a qu’une seule vie et aucune réapparition : le premier contact avec Victor termine la partie.

## Carte plein écran

- Le niveau s’ouvre dans une vue immersive qui remplit toute la largeur et la hauteur de l’écran, avec une interface compacte en surimpression. La carte est recadrée sur les murs extérieurs si nécessaire pour couvrir un écran de portable 16:9 ou 16:10, avec le panneau de commandes en surimpression.
- Le bouton **Fenêtré** de l’interface, la touche `F`, ou les flèches **↙** et **↗** en bas à droite basculent entre la scène encadrée et le plein écran. La flèche active est mise en évidence ; le choix est conservé avec les autres réglages.
- Sur petit écran, les libellés secondaires et le bouton de son de la scène sont masqués pour laisser toute la place au labyrinthe. Le bouton de carte devient **Carte**.
- En mode Protection, l’indicateur de ruée et le compteur de murs restent visibles sur mobile. En mode 2 joueurs, la jauge de ruée est masquée.

## Temps et score

| Difficulté | Temps | 3 étoiles | 2 étoiles |
| ---------- | ----- | --------- | --------- |
| Facile | 120 s | ≤ 60 s | ≤ 95 s |
| Normal | 90 s | ≤ 40 s | ≤ 70 s |
| Difficile | 60 s | ≤ 25 s | ≤ 45 s |

- En mode Protection, le chronomètre démarre au lancement de la partie et s’affiche dans l’interface. Le mode 2 joueurs n’a ni chronomètre ni défaite par temps écoulé.
- `P` met la partie en pause ; en mode Protection, le temps est gelé et reprend au clic sur **Reprendre**.
- En mode Protection, le temps s’arrête à la fin de la partie, victoire ou défaite.
- Une victoire en mode Protection enregistre `game.lastResult` avec les millisecondes exactes, le nombre d’étoiles et l’issue du récit. En duel, le résultat enregistre le mode et le camp vainqueur, sans étoiles ni temps.
- Le temps utilise `performance.now()` plutôt que l’addition des deltas de frames.

## Boucle de capture

- Victor est invulnérable ; la Créature possède les vies.
- En mode Protection, chaque partie commence avec **3 vies** (`CREATURE_RULES.lives`). En mode 2 joueurs, la Créature possède **1 vie**.
- Un contact retire une vie, téléporte la Créature dans un autre coin et accorde **4 secondes** d’invulnérabilité.
- Pendant ces quatre secondes, Elizabeth est aussi invulnérable : la Créature ne peut pas la tuer avant la fin de sa protection de réapparition.
- Les collisions utilisent une distance en cases (`CREATURE_RULES.hitDistance`). L’invulnérabilité est activée avant la frame suivante, ce qui empêche un seul chevauchement de retirer plusieurs vies.
- En duel, le contact avec Victor ne retire pas de vie : il termine immédiatement la partie au profit de Victor.
- Les anciennes stratégies `wander`, `evade` et `outwit` restent disponibles dans `creature.js` ; le niveau du village utilise la sous-classe `StoryCreature`, et le duel utilise `PlayerCreature`.

## Équilibrage

Après l’ajustement des vitesses de base, de la vitesse d’Elizabeth, de la protection de réapparition et du délai de première ruée, les simulations ont été relancées en mode Protection avec les positions de départ aléatoires et l’intelligence réelle du jeu, sur 32 parties par difficulté :

| Difficulté | Survie seule d’Elizabeth | Victoires du Victor automatique | Morts d’Elizabeth avec le Victor automatique |
| ---------- | ------------------------ | ------------------------------- | --------------------------------------------- |
| Facile | 89,5 s en moyenne | 91 % (29 / 32) | 3 / 32 |
| Normal | 68,9 s en moyenne | 84 % (27 / 32) | 5 / 32 |
| Difficile | 14,0 s en moyenne | 47 % (15 / 32) | 17 / 32 |

La survie seule mesure le temps qu’Elizabeth passe sans intervention de Victor. Le Victor automatique suit un chemin parfait vers la Créature ; un joueur humain peut donc obtenir des résultats différents. Le mode 2 joueurs n’est pas inclus dans ce tableau.

La courbe est désormais lisible : Facile reste accessible, Normal demande de la précision et Difficile laisse environ une chance sur deux au Victor automatique. La ruée conserve les valeurs demandées — recharges de 10, 5 et 2 secondes, durée de 1,2 seconde, multiplicateur de 3 et bris de tous les murs — mais elle ne démarre plus instantanément au lancement ou après une réapparition.

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
| `W` `A` `S` `D` | Déplacer Victor dans les deux modes |
| `↑` `↓` `←` `→` | Mode Protection : déplacer Victor. Mode 2 joueurs : déplacer la Créature. |
| `P` | Mettre le temps en pause / reprendre |
| `F` | Basculer entre carte plein écran et fenêtre |
| `Échap` | Quitter le labyrinthe / fermer la fenêtre |
| `Entrée` | Lancer la partie depuis le menu |

Le mode 2 joueurs se joue à deux sur le même clavier : une personne utilise WASD pour Victor, l’autre les flèches pour la Créature.

## Prochaines étapes

- Peaufinage final des animations et des décors gothiques.
- Niveaux supplémentaires, si demandé.
