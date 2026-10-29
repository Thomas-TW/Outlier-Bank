# Extension Chrome Outlier Bank

1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée** et choisir ce dossier.
4. Cliquer sur l’icône de l’extension pour vérifier l’adresse locale d’Agentic OS.

Le menu des vidéos YouTube reçoit l’action **Save outlier**. Les vidéos sont enregistrées dans l’Inbox. Si Agentic OS est arrêté, la demande reste dans `chrome.storage.local` et est retentée automatiquement. Une entrée n’est retirée de la file qu’après une réponse réussie de l’API.

L’extension refuse les hôtes non locaux et n’accède qu’à YouTube, `127.0.0.1` et `localhost`.
