# Architecture distribuée

Le cœur est installé dans `agent-os/lib/outlier-bank/`. Il dépend du stockage JSON de l’hôte et embarque son propre client YouTube Data API. Celui-ci détecte les clés dans le coffre de l’utilisateur ou dans `YOUTUBE_API_KEY`/`YOUTUBE_API_KEYS`, assure leur rotation et conserve uniquement un ledger de quota sans valeur secrète. Le routeur est séparé afin de limiter le raccord à `server.js` à un import et une délégation.

La page est enregistrée via `AgentOS.register("outliers", ...)`. Ses styles résident dans une feuille séparée et utilisent le préfixe `ob-`.

`Inbox` n’est pas un enregistrement utilisateur : c’est la vue système des outliers dont `folderIds` est vide. Elle existe donc même avec une bibliothèque `{ folders: [], outliers: [] }` et ne peut pas être supprimée.

Les miniatures sont créées à la demande dans `<racine du dépôt>/medias/Outliers`. `AGENTIC_OS_MEDIA_ROOT` permet une adaptation explicite si l’hôte utilise une autre racine.

L’intégration Niche Finder et l’extension Chrome ne partagent aucune donnée privée avec le dépôt. Elles appellent uniquement l’API locale `/api/outliers`.
