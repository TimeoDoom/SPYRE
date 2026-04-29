# MailApp

Client Gmail minimal (réception + envoi) via **IMAP/SMTP**, configuré dans `.env`.

Le projet peut fonctionner **sans base de données** (stockage en session cookie), mais pour “retenir” les réglages/Spaces/contacts de façon durable il faut activer PostgreSQL (Neon) via Prisma.

## Prérequis Gmail

- Activer l’IMAP dans Gmail : _Paramètres_ → _Transfert et POP/IMAP_ → **Activer IMAP**.
- Activer la **2FA** sur votre compte Google.
- Créer un **mot de passe d’application** (App Password) et l’utiliser dans l’app.

## Démarrage

1. Installer les dépendances

```bash
npm install
```

2. Créer un fichier `.env` à partir de `.env.example` et renseigner :

- `GMAIL_ADDRESS`
- `GMAIL_APP_PASSWORD`

### Base de données (Neon / PostgreSQL) — recommandé

1. Renseigner aussi dans `.env` :

- `DATABASE_URL` (connexion Postgres Neon)
- `SESSION_PASSWORD` (min 32 caractères)
- `DATA_ENCRYPTION_KEY` (32 bytes en base64/base64url ou hex)

Générer une clé de chiffrement (exemple base64url) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

2. Appliquer le schéma sur la base :

```bash
npm run prisma:migrate:dev -- --name init
```

3. Lancer

```bash
npm run dev
```

Ouvrir http://localhost:3000

## Sécurité

- L’envoi d’email est protégé contre le CSRF via vérification de l’en-tête `Origin` (basée sur `APP_BASE_URL`).
- Le contenu des emails est affiché en **texte** uniquement (pas de rendu HTML) pour éviter les risques XSS.
- Si `DATABASE_URL` est configuré, le mot de passe d’application Gmail est stocké **chiffré** en base via `DATA_ENCRYPTION_KEY`.
