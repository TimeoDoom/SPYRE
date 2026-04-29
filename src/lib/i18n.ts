export type AppLanguage = "fr" | "en";

export const DEFAULT_LANGUAGE: AppLanguage = "fr";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "fr" || value === "en";
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  if (isAppLanguage(value)) return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "fr" || v === "fr-fr") return "fr";
    if (v === "en" || v === "en-us" || v === "en-gb") return "en";
  }
  return DEFAULT_LANGUAGE;
}

export const MESSAGES = {
  fr: {
    "nav.inbox": "Boîte de réception",
    "nav.settings": "Paramètres",
    "nav.home": "Accueil",

    "settings.title": "Paramètres",
    "settings.saved": "Paramètres enregistrés.",
    "settings.desc":
      "Configure ton compte Gmail ici. Le mot de passe d’application est stocké chiffré dans la base de données (pas dans le fichier .env).",
    "settings.gmailAddress": "Adresse Gmail",
    "settings.appPassword": "Mot de passe d’application",
    "settings.keepExisting":
      "Laisse vide pour conserver celui déjà enregistré.",
    "settings.optionalAdvanced": "Paramètres IMAP/SMTP (optionnel)",
    "settings.save": "Enregistrer",
    "settings.clear": "Effacer",
    "settings.diagnose": "Diagnostiquer",
    "settings.diagnoseDesc":
      "Clique sur le bouton ci-dessous pour tester si ta connexion IMAP fonctionne. Cela t'aidera à identifier exactement quel est le problème.",

    "settings.language": "Langue",
    "settings.languageHint": "Choisis la langue de l’interface.",

    "common.cancel": "Annuler",
    "common.create": "Créer",

    "spaces.createSpace": "Créer un Space",
    "spaces.createTitle": "Créer un Space",
    "spaces.createSubtitle": "Nom • Main • Accent • Icône",
    "spaces.name": "Nom",
    "spaces.main": "Main",
    "spaces.accent": "Accent",
    "spaces.icon": "Icône",
    "spaces.options": "Options",

    "search.close": "Fermer la recherche",
    "search.placeholder": "Rechercher dans les mails…",
    "search.aria": "Rechercher dans les mails",
    "search.hint": "Tape pour rechercher (Entrée ouvre le premier résultat).",
    "search.noResults": "Aucun résultat.",
    "mail.noSubject": "(sans sujet)",
    "mail.notConfigured":
      "Compte non configuré. Ouvre /settings pour renseigner Gmail.",
    "mail.errorTitle": "Erreur",
    "mail.configureSettings": "Configurer les paramètres",
    "mail.selectEmailTitle": "Sélectionne un email",
    "mail.selectEmailSubtitle": "pour l’afficher ici",

    "home.desc":
      "Client Gmail minimal (IMAP pour lire, SMTP pour envoyer) configuré via la page /settings.",
    "home.configured": "Compte configuré :",
    "home.notConfiguredPrefix": "Aucun compte configuré. Va dans",
    "home.notConfiguredSuffix": ".",
    "home.openInbox": "Ouvrir la boîte de réception",
  },
  en: {
    "nav.inbox": "Inbox",
    "nav.settings": "Settings",
    "nav.home": "Home",

    "settings.title": "Settings",
    "settings.saved": "Settings saved.",
    "settings.desc":
      "Configure your Gmail account here. The app password is stored encrypted in the database (not in the .env file).",
    "settings.gmailAddress": "Gmail address",
    "settings.appPassword": "App password",
    "settings.keepExisting": "Leave empty to keep the existing one.",
    "settings.optionalAdvanced": "IMAP/SMTP settings (optional)",
    "settings.save": "Save",
    "settings.clear": "Clear",
    "settings.diagnose": "Diagnose",
    "settings.diagnoseDesc":
      "Click the button below to test whether your IMAP connection works. It helps pinpoint exactly what’s wrong.",

    "settings.language": "Language",
    "settings.languageHint": "Choose the UI language.",

    "common.cancel": "Cancel",
    "common.create": "Create",

    "spaces.createSpace": "Create a Space",
    "spaces.createTitle": "Create a Space",
    "spaces.createSubtitle": "Name • Main • Accent • Icon",
    "spaces.name": "Name",
    "spaces.main": "Main",
    "spaces.accent": "Accent",
    "spaces.icon": "Icon",
    "spaces.options": "Options",

    "search.close": "Close search",
    "search.placeholder": "Search emails…",
    "search.aria": "Search emails",
    "search.hint": "Type to search (Enter opens the first result).",
    "search.noResults": "No results.",
    "mail.noSubject": "(no subject)",
    "mail.notConfigured":
      "Account not configured. Open /settings to set up Gmail.",
    "mail.errorTitle": "Error",
    "mail.configureSettings": "Configure settings",
    "mail.selectEmailTitle": "Select an email",
    "mail.selectEmailSubtitle": "to display it here",

    "home.desc":
      "Minimal Gmail client (IMAP read, SMTP send) configured via /settings.",
    "home.configured": "Configured account:",
    "home.notConfiguredPrefix": "No account configured. Go to",
    "home.notConfiguredSuffix": ".",
    "home.openInbox": "Open inbox",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["fr"];

export function t(language: AppLanguage, key: MessageKey): string {
  return (
    (MESSAGES as any)[language]?.[key] ??
    (MESSAGES as any)[DEFAULT_LANGUAGE]?.[key] ??
    String(key)
  );
}
