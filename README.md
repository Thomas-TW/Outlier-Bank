# Outlier Bank pour Agentic OS

Outlier Bank est une bibliothèque locale de vidéos YouTube ayant surperformé par rapport aux vidéos habituelles de leur chaîne. Elle permet d’enregistrer, classer, rechercher, trier, actualiser et exporter ces références sans base de données : les données restent dans un fichier JSON local.

Cette distribution contient uniquement **Outlier Bank et ses intégrations**. Elle ne contient pas Title Generator, aucune vidéo personnelle, aucun folder personnel, aucune miniature et aucun secret.

## Fonctionnement

- Ajout d’une vidéo longue par URL YouTube.
- Récupération du titre, de la chaîne, des vues, des abonnés et de la date de publication.
- Calcul d’un score fondé sur les vues des vidéos précédentes de la chaîne.
- Téléchargement automatique de la miniature dans `<racine Agentic OS>/medias/Outliers/`.
- Détection des doublons par identifiant vidéo.
- Classement dans des folders personnalisés.
- **Inbox système toujours présente** : toute vidéo sans folder explicite y apparaît automatiquement.
- Tri, recherche, mise à jour des statistiques, export des titres et suppression avec confirmation.
- Stockage JSON local, sans base de données supplémentaire.

## Composants

```text
package/agent-os/                    moteur et interface Outlier Bank
package/extensions/outlier-bank/     extension Chrome Manifest V3
integrations/niche-finder/            intégration facultative Niche Finder
installer/preflight.js                audit en lecture seule
installer/install.js                  installation après accord explicite
installer/verify.js                   vérification statique post-installation
templates/library.empty.json          exemple strictement vide
```

## Dépendances techniques

- Node.js 18 ou supérieur (`fetch` natif requis).
- Agentic OS disposant de son stockage JSON et d’un service média local.
- Un service YouTube exposant une fonction `dataApi` compatible avec la YouTube Data API v3.
- Au moins une clé YouTube appartenant à l’utilisateur. Aucune clé n’est fournie ici.
- Telegram est facultatif : son absence désactive seulement les notifications.
- Niche Finder est facultatif : son absence ne bloque ni la banque ni l’extension.

## Installation : audit obligatoire avant toute modification

Une IA ne doit jamais installer ce projet dès réception du lien. Elle doit d’abord lire [AGENTS.md](AGENTS.md), analyser les deux architectures et produire un rapport : compatibilité, fichiers concernés, adaptations, dépendances manquantes, sauvegarde et retour arrière.

Audit en lecture seule :

```powershell
node installer/preflight.js W:\chemin\vers\Agentic-OS --output preflight-report.json
```

L’audit ne modifie pas l’Agentic OS cible. Après présentation du rapport, l’IA doit s’arrêter. L’installation n’est autorisée qu’après un accord explicite de l’utilisateur portant sur les changements décrits.

Après cet accord seulement :

```powershell
node installer/install.js --plan preflight-report.json --approve USER_APPROVED
node installer/verify.js W:\chemin\vers\Agentic-OS
```

L’installateur sauvegarde les fichiers partagés qu’il modifie. Il refuse une architecture inconnue, une installation existante ou un rapport incompatible/périmé.

## YouTube Data API

Outlier Bank ne contient et ne copie aucune clé. L’adaptateur réutilise le service YouTube et le coffre de l’Agentic OS hôte. L’audit vérifie l’interface du service et, lorsque cela peut être fait sans révéler les valeurs, le nombre de clés configurées.

Si aucune clé n’est trouvée, l’utilisateur doit être informé avant installation. Une clé absente empêche l’ajout et l’actualisation des vidéos, mais ne doit jamais conduire l’IA à inventer, demander d’afficher ou publier un secret.

## Telegram

Les notifications de mise à jour utilisent Telegram lorsqu’un service `send` compatible est disponible. L’absence de Telegram est signalée mais ne bloque aucune fonction de la banque.

## Intégration Niche Finder

Le module facultatif ajoute **Save outlier** dans le menu `+` des cartes vidéo. Il n’est chargé que si l’audit reconnaît le contrat d’interface attendu. Si le Niche Finder diffère, l’IA doit expliquer l’adaptation et obtenir un nouvel accord avant de toucher à son code.

## Extension Chrome

Après installation et démarrage d’Agentic OS :

1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Choisir `package/extensions/outlier-bank`.
5. Cliquer sur l’icône de l’extension et tester l’adresse locale d’Agentic OS.

Sur YouTube, **Save outlier** apparaît uniquement dans les menus des vidéos compatibles. Si Agentic OS est arrêté, la vidéo est conservée dans une file persistante de l’extension. Elle n’en est retirée qu’après confirmation de l’API. La file évite les doublons par identifiant YouTube.

L’adresse par défaut est `http://127.0.0.1:4100`. Seules les adresses loopback `127.0.0.1` et `localhost` sont acceptées.

## Données et confidentialité

Les fichiers suivants ne doivent jamais être publiés :

- `data/outliers/` ;
- `medias/Outliers/*` à l’exception éventuelle de `.gitkeep` ;
- `vault.json`, `.vaultkey`, `.env*`, credentials OAuth et clés API ;
- sauvegardes, journaux ou jeux de tests issus d’une vraie bibliothèque.

Avant toute publication, exécuter les contrôles de [docs/release-checklist.md](docs/release-checklist.md). Le dossier préparé ne contient aucune miniature personnelle.

## Prompt à donner à Codex ou Claude

```text
Analyse ce dépôt Outlier Bank et mon Agentic OS sans rien modifier.

Lis intégralement AGENTS.md et README.md. Effectue d’abord l’audit de compatibilité demandé : architecture serveur et frontend, stockage JSON, service média, service YouTube et présence de clés sans jamais les afficher, Telegram, Niche Finder, routes existantes et risques de conflit.

Présente-moi ensuite :
1. si l’installation est compatible ;
2. les fichiers qui seraient créés ou modifiés ;
3. les adaptations nécessaires ;
4. les éléments manquants ;
5. la sauvegarde, les tests et le retour arrière prévus.

Arrête-toi après ce rapport. N’installe rien et ne modifie aucun fichier tant que je ne t’ai pas donné un accord explicite sur le plan présenté.
```

## Licence

Aucune licence de redistribution n’est encore sélectionnée dans cette préparation. Le propriétaire devra choisir une licence avant la publication du dépôt GitHub.
