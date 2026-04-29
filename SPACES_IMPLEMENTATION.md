# 📦 Architecture Spaces - Documentation Complète

## 1. Concept Fondamental

**Un seul Space actif à la fois** avec navigation fluide et contexte immersif.

### Structure d'un Space

```typescript
type Space = {
  id: string; // Identifiant unique (ex: "default-inbox", "abc123")
  name: string; // Nom du Space (ex: "Inbox", "Client X", "Projet Y")
  color?: string; // Couleur accent (hex, ex: "#3B82F6")
  bgColor?: string; // Couleur de fond (hex, ex: "#F0F4FF")
  textColor?: string; // Couleur du texte (hex)
  icon?: string; // Emoji représentatif (ex: "📥", "🚀", "📊")
  createdAt: Date; // Date de création
};
```

## 2. Space Spécial : Inbox Global

### Caractéristiques

- **Toujours présent** : Créé automatiquement au premier chargement du layout
- **Non supprimable** : Impossible à supprimer pour préserver l'accès à tous les emails
- **Vue globale** : Affiche **TOUS** les emails du compte
- **Point de référence** : ID fixe = `"default-inbox"`

### Identification

- Icône : 📥
- Couleur : Bleu (#3B82F6)
- BackgroundColor : Bleu léger (#F0F4FF)
- TextColor : Gris foncé (#1E293B)

## 3. Sidebar - Navigation Spaces

### Structure

```
┌─────────────────────────┐
│  Inbox                  │  ← Nom du Space actif (avec icône)
│ ─────────────────────── │
│                         │
│  (Liste des Spaces)     │
│  • Work  🚀             │
│  • Client X  💼        │
│  • Projet Y  📊        │
│                         │
│ ─────────────────────── │
│  + Nouveau Space        │  ← Créer un Space
└─────────────────────────┘
```

### Contraintes Implémentées

- ❌ **Pas de bouton "Tous les mails" séparé** : L'Inbox est le point de référence
- ❌ **Pas d'onglets visibles** : Un seul Space actif visible en header
- ❌ **Navigation classique Gmail absente** : Uniquement basée sur le Space actif

## 4. Navigation Entre Spaces

### A. Gestes (Implémenté ✅)

```
Trackpad / Tactile :
  ← Swipe left  → Aller au Space suivant
  → Swipe right → Aller au Space précédent
```

### B. Clavier (Implémenté ✅)

```
  Cmd + ←  → Space précédent
  Cmd + →  → Space suivant
```

### C. Interface (Implémenté ✅)

```
  • Dropdown menu dans le header du Space actif
  • Clic direct sur un Space dans la liste
  • Les transitions utilisent le query param `?space=SPACEID`
```

### Comportement

- **Transition fluide** : 300ms CSS transition sur tous les changements
- **Changement instantané** : Le contexte change immédiatement (thème + emails)

## 5. Thème Dynamique (Implémenté ✅)

### Propriétés CSS Appliquées

```css
--space-accent    /* Couleur principale du Space */
--space-bg        /* Couleur de fond du sidebar */
--space-text      /* Couleur du texte */
```

### Timing

- **Application** : Instantanée quand tu navigues vers un nouveau Space
- **Transition** : 300ms smooth fade sur le sidebar
- **Scope** : Le thème s'applique à :
  - Sidebar background
  - Accent colors des boutons
  - Borders et accents

### Exemple

```
Space "Work" 🚀
  - Accent: #10B981 (vert)
  - BgColor: #ECFDF5
  - TextColor: #065F46

Space "Personal" 👤
  - Accent: #F59E0B (orange)
  - BgColor: #FFFBEB
  - TextColor: #78350F
```

## 6. Gestion des Emails dans les Spaces

### Ajout d'Emails (V1 MVP)

- **Méthode** : Manuel uniquement
- **Processus** :
  1. Ouvre un email depuis l'Inbox
  2. Clic sur "➕ Ajouter à un Space"
  3. Sélectionne les Spaces (multi-select)
  4. Clic "Ajouter"

### Appartenance Multiple

```
Un email peut être dans plusieurs Spaces :
  Email "Devis Client X" ∈ {Space: "Client X", Space: "Q1 2026"}
```

### Structure en Mémoire

```typescript
session.spaceEmails = {
  "default-inbox": [], // Inbox global (pas de filtrage)
  "client-x": ["uid1", "uid2"], // Space personnalisé avec 2 emails
  "project-y": ["uid3"], // Space personnalisé avec 1 email
};
```

## 7. Affichage d'un Space

### Cas 1 : Space Vide

```
📭 Aucun mail dans ce Space

Les emails ajoutés au Space "Client X" apparaîtront ici
```

### Cas 2 : Space avec Emails

```
🚀 Work
timeo@gmail.com
5 emails dans ce Space

[Liste des emails du Space]
```

### Statuts

- **Inbox global** : Affiche toujours les emails du dossier INBOX du compte
- **Space perso** : Affiche uniquement les emails ajoutés au Space

## 8. Sous-Sections par Space (V1 MVP)

### Structure Actuelle

**Navigation par dossiers visible UNIQUEMENT dans Inbox global** :

#### Inbox Global

- 📥 Inbox
- 📤 Sent / Envoyés
- ✏️ Drafts / Brouillons
- 🗑️ Trash / Corbeille

#### Spaces Personnalisés

- 📌 Affichage uniquement des emails du Space
- Navigation par dossier : **masquée** (pour éviter la confusion)

### Futures Améliorations (V2)

```
V2 Roadmap :
  [ ] Ajouter une base de données pour mapper emails ↔ metadata
  [ ] Implémenter les sous-sections complètes par Space
  [ ] Support des Sent/Drafts/Trash filtrés par Space
  [ ] Permettre la rédaction d'emails "within" un Space
```

## 9. Logique Principale

### Principle de Filtrage

```
┌─────────────────────────────────────┐
│  Inbox Global (default-inbox)       │
│  ├─ Affiche : TOUS les emails       │
│  ├─ Dossiers : INBOX, SENT,...      │
│  └─ Actions : Globales              │
│                                     │
│  Space Personnalisé ("Client X")    │
│  ├─ Affiche : Emails du Space       │
│  ├─ Dossiers : Masqués v1           │
│  └─ Actions : Restent globales      │
└─────────────────────────────────────┘
```

### Actions

- **Immuable** : Les actions (envoyer, supprimer, etc.) restent **globales**
- **Visualisation** : Dépend du **Space actif**
- **Exemple** : Un email supprimé dans un Space est supprimé globalement

## 10. UX - Immersion dans un Contexte

### Workflow Typique

```
1️⃣  Arrive sur /mail
    ↓ (automatiquement redirigé)
2️⃣  → /mail?space=default-inbox
    ↓
3️⃣  Affiche Inbox avec thème bleu + tous les emails du compte
    ↓
4️⃣  Crée un Space "Client X" (couleur verte 🟢)
    ↓
5️⃣  Navigue vers "Client X" (Cmd+→ ou swipe ou clic)
    ↓ → /mail?space=client-x
6️⃣  Thème change (vert), sidebar update
    ↓
7️⃣  Affiche "Aucun mail dans ce Space" (vide)
    ↓
8️⃣  Ouvre un email depuis Inbox, clic "Ajouter à Space"
    ↓
9️⃣  Sélectionne "Client X" et ajoute
    ↓
🔟  Retour à Space "Client X", affiche l'email maintenant
```

## 11. Implémentation Technique

### Files Principaux

```
/src/
  lib/
    ├─ session.ts           # Session management + Space structures
    │   └─ ensureDefaultSpace()  # Crée Inbox par défaut
    │
  app/
    ├─ mail/
    │   ├─ layout.tsx        # Initialise le Space par défaut
    │   ├─ page.tsx          # Filtre emails par Space actif
    │   └─ message/[id]/     # Affichage d'un email
    │
    ├─ components/
    │   ├─ SpacesSidebar.tsx     # Navigation + thème dynamique
    │   ├─ AddToSpaceButton.tsx  # Modal d'ajout aux Spaces
    │
    └─ api/spaces/
        ├─ create          # POST: Créer un Space
        ├─ [id]/
        │   ├─ add-email       # POST: Ajouter email au Space
        │   ├─ remove-email    # POST: Retirer email du Space
        │   └─ emails          # GET: Récupérer emails du Space
        └─ route.ts        # GET: Lister tous les Spaces
```

### Query Parameters

```
/mail?space=SPACEID&folder=FOLDERNAME&page=1

Exemples :
  /mail?space=default-inbox           # → Inbox global, INBOX folder
  /mail?space=default-inbox&folder=SENT
  /mail?space=client-x                # → Space "Client X"
  /mail?space=client-x&page=2         # Pagination dans le Space
```

## 12. Tests Pratiques

### ✅ Test 1 : Inbox Global

1. Ouvre `/mail`
2. Vérifie qu'on redirige vers `/mail?space=default-inbox`
3. Vois tous les emails du compte, thème bleu

### ✅ Test 2 : Créer un Space

1. Clic "+ Novo Space"
2. Nom: "Test Space"
3. Couleur: Rouge (#EF4444)
4. Confirme création
5. Redirigé vers le Space (vide = "Aucun mail")

### ✅ Test 3 : Ajouter un Email

1. Ouvre un email de l'Inbox
2. Clic "➕ Ajouter à un Space"
3. Sélectionne "Test Space"
4. Clic "Ajouter"
5. Retour au Space "Test Space"
6. L'email est affiché

### ✅ Test 4 : Navigation

1. Cmd+→ → Change de Space (fluid)
2. Thème suit le Space
3. Emails changent

### ✅ Test 5 : Suppression

1. Sélectionne un Space
2. Clic option menu "Supprimer"
3. Confirme
4. Redirigé à l'Inbox (ou Space suivant)

## 13. API Endpoints

### Spaces Management

```
GET    /api/spaces                   # Liste tous les Spaces
POST   /api/spaces/create            # Crée un nouveau Space
DELETE /api/spaces/[id]              # Supprime un Space
```

### Email-Space Relations

```
GET    /api/spaces/[id]/emails              # Récupère emails du Space
POST   /api/spaces/[id]/add-email           # Ajoute email au Space
POST   /api/spaces/[id]/remove-email        # Retire email du Space
```

### Payload Examples

```bash
# Créer un Space
POST /api/spaces/create
{
  "name": "Client X",
  "color": "#EF4444",
  "bgColor": "#FEE2E2",
  "icon": "💼"
}

# Ajouter email au Space
POST /api/spaces/client-x/add-email
{
  "emailId": "123"
}

# Retirer email du Space
POST /api/spaces/client-x/remove-email
{
  "emailId": "123"
}
```

## 14. Résumé : V1 vs Futures Versions

### V1 (MVP - Actuel)

✅ Un seul Space actif avec navigation fluide
✅ Inbox global (tous les emails)
✅ Spaces personnalisés (emails filtrés)
✅ Navigation clavier/swipe/dropdown
✅ Thème dynamique par Space
✅ Ajout manuel d'emails aux Spaces
✅ U X immersive

Limitations :

- Sous-sections (Sent/Drafts/Trash) **globales** uniquement
- Pas de base de données (données en session)

### V2 / V3 Roadmap

- [ ] Base de données pour persistance des Spaces
- [ ] Sous-sections complètes par Space
- [ ] Règles automatiques (auto-assign emails)
- [ ] Collaboration / Shared Spaces
- [ ] Tags et colors pour emails au sein du Space
- [ ] Archive par Space
- [ ] Exportation des Spaces

---

**Status** : ✅ MVP complétement fonctionnel et prêt pour testing
**Dernière mise à jour** : 17 April 2026
