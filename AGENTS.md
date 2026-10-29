# Instructions obligatoires pour les agents d’installation

Ce dépôt est un module à intégrer dans un Agentic OS existant. La sécurité des données et l’accord de l’utilisateur priment sur l’automatisation.

## Interdiction initiale

La réception d’un lien GitHub, une demande d’analyse, un audit ou la phrase « installe Outlier Bank » sans plan préalable validé ne constitue pas une autorisation suffisante pour modifier l’Agentic OS cible.

Ne lance pas `installer/install.js`, ne copie aucun fichier et ne modifie aucune configuration avant d’avoir terminé les phases 1 et 2 et reçu l’accord explicite décrit en phase 3.

## Phase 1 — Audit en lecture seule

1. Lire entièrement `README.md`, ce fichier et les sources distribuées.
2. Lire les instructions propres à l’Agentic OS cible.
3. Examiner son architecture, son état Git et ses modifications locales.
4. Lancer `node installer/preflight.js <cible> --output <rapport hors de la cible>`.
5. Vérifier manuellement les conclusions du script.
6. Ne jamais afficher la valeur d’une clé, d’un token ou d’un credential.
7. Vérifier particulièrement :
   - version de Node.js ;
   - serveur et routeur HTTP ;
   - registre frontend `AgentOS` ;
   - stockage JSON ;
   - service `/media/` ;
   - présence de clés YouTube dans le coffre de l’utilisateur ou son environnement, sans afficher leur valeur ;
   - Telegram, facultatif ;
   - Niche Finder, facultatif ;
   - installation Outlier Bank préexistante ;
   - conflits de routes, noms et styles.

## Phase 2 — Rapport à l’utilisateur

Présenter avant toute installation :

- compatibilité ou incompatibilité ;
- fichiers exacts à créer et modifier ;
- adaptations propres à la cible ;
- dépendances ou configurations manquantes ;
- avertissements YouTube, Telegram et Niche Finder ;
- sauvegarde et retour arrière ;
- tests qui seront exécutés ;
- confirmation que Title Generator, données personnelles et miniatures ne seront pas importés.

Puis s’arrêter.

## Phase 3 — Accord explicite

Demander à l’utilisateur d’approuver le plan concret présenté. Ne pas déduire cet accord d’un message antérieur ou d’une simple demande d’information.

Si le plan change après l’accord, présenter les changements et demander un nouvel accord.

## Phase 4 — Installation cloisonnée

Après accord seulement :

- utiliser le rapport datant de moins de 24 heures ;
- lancer l’installateur avec `--approve USER_APPROVED` ;
- préserver toutes les modifications locales ;
- ne jamais remplacer entièrement un fichier partagé ;
- ne jamais écraser une bibliothèque existante ;
- ne jamais copier de secrets ;
- ne jamais exposer le serveur hors loopback ;
- arrêter l’installation si l’état réel diffère du rapport ;
- ne pas installer Title Generator.

## Phase 5 — Vérification

Vérifier réellement : démarrage, page, Inbox vide, création d’un folder, ajout d’une vidéo longue approuvée par l’utilisateur, miniature locale, doublon, tri, export, suppression, persistance après redémarrage et absence de régression.

Pour l’extension, vérifier : menu d’une carte vidéo, menu de la vidéo en lecture, distinction saved/pending/duplicate/error, persistance de la file après redémarrage de Chrome et synchronisation après retour du serveur.

Pour le Niche Finder, vérifier l’action sur plusieurs résultats différents. Son absence ou son incompatibilité ne doit pas bloquer Outlier Bank.

Fournir enfin la liste des fichiers modifiés, les résultats des tests, les avertissements restants et l’emplacement de la sauvegarde.
