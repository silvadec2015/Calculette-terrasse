# Calculette Terrasse Silvadec

Widget web autonome (HTML/CSS/JS, aucune dépendance externe) qui remplace le
formulaire `la-calculette-terrasse` par un configurateur en 5 étapes :
dimensions → choix de la lame → structure & finitions → estimation
matériaux/prix → demande de devis.

Les données produits (gammes, coloris, dimensions, prix) et les règles de
calepinage (jeux de pose, entraxe lambourde, ratios lames/clips/lambourdes
au m²) proviennent du **Tarif public Silvadec 2026** et de la **Notice de
montage lames de terrasse 138 et 180×23mm (PU 7V27, 12/2025)**.

## Fichiers

```
index.html                      démo / page de test locale (injection directe)
demo-drupal.html                démo du composant Drupal : iframe nue, sans script
demo-iframe.html                démo de l'intégration div + script (autre domaine)
embed.html                      document chargé dans l'iframe (police + widget)
embed.js                        à poser sur le site : crée l'iframe et la synchronise
src/data.js                     catalogue produits + tarifs + règles de calepinage
src/calculette-terrasse.js      logique de calcul + interface (vanilla JS)
src/calculette-terrasse.css     styles, isolés sous la classe .ct-widget
```

Le CSS applique la charte Silvadec (« Nouveaux codes de marque », juillet
2020) : Bleu Nocturne `#23354B` pour les titres et l'action principale, Vert
Lichen `#91AE8F` pour les états sélectionnés et la progression, palette
lifestyle pour les encarts, typographie Montserrat avec fallback Arial.

Aucun bundler n'est requis : ce sont 3 fichiers statiques à héberger tels
quels (CDN, dossier `wp-content/uploads`, etc.).

## Intégration sur le site

### 1. Widget en injection directe (recommandé)

```html
<link rel="stylesheet" href="https://VOTRE-CDN/calculette-terrasse/calculette-terrasse.css">
<div id="silvadec-calculette-terrasse"></div>
<script src="https://VOTRE-CDN/calculette-terrasse/data.js"></script>
<script src="https://VOTRE-CDN/calculette-terrasse/calculette-terrasse.js"></script>
```

Le widget se monte automatiquement sur tout élément portant l'id
`silvadec-calculette-terrasse` ou l'attribut `data-silvadec-calculette-terrasse`.
Cette méthode est préférable à une iframe : elle hérite des polices du site,
reste indexable, et n'a pas de problème de hauteur d'iframe à gérer.

### 2. Montage manuel / plusieurs instances

```html
<div id="mon-conteneur"></div>
<script>
  SilvadecCalculetteTerrasse.mount("#mon-conteneur", {
    onQuoteRequest: function (payload) {
      // payload = { dimensions, produit, materiaux, total, contact }
      fetch("/api/devis-terrasse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  });
</script>
```

### 3. Dans une iframe (mode retenu pour fr.silvadec.com)

#### 3a. Composant « Iframe » de Drupal — le plus simple

Le composant Drupal ne demande que deux valeurs :

| Champ du back-office | Valeur |
| --- | --- |
| **Iframe URL** | `/sites/default/files/calculette-terrasse/embed.html` |
| **Iframe height** | `520` |
| **Embed code** | *(laisser vide)* |

**Condition indispensable : héberger les fichiers sur le domaine du site**
(`fr.silvadec.com`), pas sur un CDN externe. Le document embarqué est alors en
*same-origin* et le widget ajuste lui-même la hauteur de sa balise `<iframe>`
via `window.frameElement` — la valeur « Iframe height » ne sert que d'amorce
avant le premier rendu, et aucun script n'est à ajouter sur la page.

Si les fichiers devaient être servis depuis un autre domaine, cet accès est
interdit par le navigateur : il faudrait alors passer par 3b.

`demo-drupal.html` reproduit exactement ce cas (iframe nue, hauteur fixe, aucun
script) pour le vérifier en local.

#### 3b. Div + script — si les fichiers sont sur un autre domaine

Deux lignes à poser sur la page, à l'endroit où la calculette doit apparaître :

```html
<div id="silvadec-calculette-terrasse"></div>
<script src="https://VOTRE-CDN/calculette-terrasse/embed.js" defer></script>
```

`embed.js` crée l'iframe (vers `embed.html`, qu'il cherche à côté de lui) et
gère tout ce qui casse habituellement une iframe :

| Problème classique | Traitement |
| --- | --- |
| Hauteur figée → double ascenseur ou grand vide | L'iframe publie sa hauteur à chaque rendu, `embed.js` redimensionne |
| Changement d'étape invisible (le parent ne défile pas) | L'iframe signale l'étape, le parent la remonte à l'écran si elle en est sortie |
| Polices du site non héritées | `embed.html` charge Montserrat (charte Silvadec) |
| Tunnel invisible pour l'analytics du site | Événements `dataLayer`/`gtag` par étape et à la demande de devis |
| Fermeture laissant un trou blanc | L'iframe est remplacée par un lien « Relancer la calculette » |

Attributs facultatifs sur la balise `<script>` :

| Attribut | Défaut | Rôle |
| --- | --- | --- |
| `data-target` | `#silvadec-calculette-terrasse` | Sélecteur du conteneur |
| `data-src` | `embed.html` à côté du script | URL du document embarqué |
| `data-min-height` | `520` | Hauteur avant le premier message de l'iframe |

**Aucune donnée personnelle ne transite par `postMessage`** : les messages se
limitent à une hauteur, un numéro d'étape et un montant. Les coordonnées du
visiteur partent uniquement vers `data-quote-endpoint` (ou le `mailto`).
Côté parent, seuls les messages émis par l'iframe créée par `embed.js` sont
pris en compte (`event.source` vérifié).

Si une politique impose l'attribut `sandbox` sur l'iframe, il lui faut au
minimum `allow-scripts allow-same-origin allow-popups allow-forms
allow-top-navigation-by-user-activation`, faute de quoi le `mailto:` est
bloqué silencieusement.

`demo-iframe.html` reproduit la page Silvadec en local pour vérifier le
comportement (hauteur, défilement, fermeture) avant de toucher au site.

#### RGPD / Montserrat

`embed.html` charge Montserrat depuis Google Fonts. Pour éviter tout appel
vers Google côté visiteur, télécharger les `.woff2` et remplacer le bloc
`<link>` par un `@font-face` local — le reste fonctionne à l'identique
(fallback Arial prévu dans la charte).

## Récupération des demandes de devis

### Mode cible : Freshsales via un relais côté serveur

Renseigner `data-quote-endpoint` sur le conteneur de `embed.html` (ou
`quoteEndpoint` dans `mount()`). Le widget y envoie le récapitulatif complet en
`POST` JSON et affiche « Votre demande a bien été transmise ». En cas d'échec
réseau ou de réponse non-OK, il retombe sur le `mailto` décrit plus bas.

```html
<div id="silvadec-calculette-terrasse"
     data-quote-endpoint="https://fr.silvadec.com/api/devis-terrasse"></div>
```

> **La clé d'API Freshsales ne doit jamais figurer dans cet endpoint côté
> navigateur.** Tout ce que charge la page est lisible par n'importe quel
> visiteur : une clé posée ici serait publique et permettrait de lire et
> modifier le CRM. `data-quote-endpoint` doit pointer vers un **relais hébergé
> par Silvadec** (route Drupal, fonction serverless…) qui, lui seul, détient la
> clé et appelle l'API Freshsales.

Le relais a trois responsabilités :

1. **Authentifier l'appel à Freshsales** avec la clé stockée côté serveur.
2. **Filtrer les envois abusifs** : le endpoint est public, il faut au minimum
   une limitation de débit et un contrôle d'origine (`Origin`/`Referer`).
3. **Archiver la preuve de consentement** (bloc `consentement` du payload) avec
   la date de création du lead, pour pouvoir la produire en cas de contrôle.

Mapping suggéré vers un lead Freshsales :

| Payload widget | Champ Freshsales |
| --- | --- |
| `contact.nom` | `last_name` (ou découpage prénom/nom) |
| `contact.email` | `email` |
| `contact.telephone` | `mobile_number` |
| `contact.codePostal` | `zipcode` |
| `contact.typeDemandeurLibelle` | champ personnalisé « Type de demandeur » |
| `total`, `dimensions.surface` | champs personnalisés (budget estimé, surface) |
| `produit.*`, `materiaux[]` | note ou champ texte long attaché au lead |
| `source` | `lead_source` = `calculette-terrasse` |
| `consentement.*` | champs personnalisés d'audit (date, durée, finalité) |

C'est le seul mode qui garantisse la réception : avec 50 % de visiteurs sur
mobile et une intégration en iframe, le `mailto` échoue souvent (pas de client
mail configuré, navigation bloquée par la sandbox).

### Conformité RGPD

Le formulaire de devis met en œuvre :

- **une qualification obligatoire du demandeur** (particulier, distributeur,
  prescripteur, autre — avec précision libre si « autre ») ;
- **une case de consentement décochée par défaut**, obligatoire : tant qu'elle
  n'est pas cochée, aucune donnée n'est émise (ni vers l'endpoint, ni vers le
  `mailto`, ni via l'événement `silvadec:quote-request`) ;
- **les mentions d'information** affichées sous le formulaire : responsable,
  finalité, destinataires (Silvadec seul, sans transmission à des tiers),
  **conservation 36 mois** à compter du dernier contact, et les droits d'accès,
  rectification, effacement, opposition, limitation et portabilité avec
  l'adresse pour les exercer ;
- **une preuve de consentement horodatée** jointe au payload :

```json
"consentement": {
  "accepte": true,
  "date": "2026-09-15T09:56:21.118Z",
  "finalite": "traiter ma demande de devis et me recontacter à ce sujet",
  "destinataires": "les équipes Silvadec uniquement, sans transmission à des tiers",
  "dureeConservationMois": 36
}
```

Ces textes sont centralisés dans `DATA.rgpd` (`src/data.js`) : y renseigner
`politiqueUrl` fait apparaître un lien vers la politique de confidentialité
Silvadec sous le formulaire.

Deux points restent à traiter **côté Silvadec**, hors du périmètre du widget :
la **purge effective à 36 mois** dans Freshsales (le widget déclare la durée, il
ne peut pas l'appliquer), et la mention de la calculette dans la politique de
confidentialité du site.

### Repli : `mailto:`

Sans endpoint configuré, à l'étape 5 quand l'utilisateur valide le
formulaire, trois choses se produisent :

1. **Un email pré-rempli s'ouvre automatiquement** dans le client mail par
   défaut du visiteur (via un lien `mailto:`), adressé à
   **`question@silvadec.com`**, avec en corps de message le récapitulatif
   complet (dimensions, produit choisi, liste de matériaux avec quantités
   et prix, total estimatif, coordonnées du client). L'écran de
   confirmation affiche aussi un lien cliquable de secours, au cas où
   l'ouverture automatique soit bloquée par le navigateur ou qu'aucun
   client mail ne soit configuré sur l'appareil (fréquent sur mobile).
   Pour changer l'adresse de destination : attribut `data-contact-email`
   sur le conteneur, ou option `contactEmail` passée à `mount()`.
2. Si l'option `onQuoteRequest` a été passée à `mount()`, elle est appelée
   avec le récapitulatif complet.
3. Un événement `silvadec:quote-request` est déclenché (`bubbles: true`)
   sur l'élément monté ET sur `window`, avec le même payload dans
   `event.detail`.

**Limite à connaître :** le `mailto:` dépend du client mail du visiteur —
il doit lui-même cliquer sur « Envoyer » dans son application, et rien ne
part si son appareil n'a pas de messagerie configurée (cas fréquent sur
certains mobiles/navigateurs), et il peut être bloqué sans erreur visible par
une iframe sandboxée. C'est pourquoi le mode endpoint ci-dessus est à
privilégier dès que possible ; le `mailto` ne doit rester qu'un filet de
sécurité.

## Mettre à jour le tarif

Toutes les données commerciales sont dans `src/data.js` :

- `gammes` : une entrée par gamme (Élégance, Atmosphère, Atmosphère
  Nuances), avec par largeur de lame (138/180mm) les finitions, les coloris,
  le code article et le prix TTC de chaque lame de 4m, ainsi que les
  planches de finition associées.
- `lambourdes`, `fixations`, `grilleVentilation`, `entretien` : accessoires
  et leurs prix/conditionnements.
- `regles` : jeux de pose (5mm), entraxe lambourde (40cm), ratios
  officiels/m² (7 ml de lame 138mm, 5,4 ml de lame 180mm, ~3 ml de
  lambourde, ~19 ou ~14 clips selon la largeur) — issus de la notice de
  montage. Ne pas modifier sans revalider avec le bureau d'études Silvadec.

Chaque campagne tarifaire, il suffit de mettre à jour les champs `prix`
(et les codes article si Silvadec les fait évoluer) dans ce seul fichier.

## Limites connues / hors périmètre volontaire

- Terrasses rectangulaires uniquement (pas de formes en L ou complexes).
- Estimation indicative : hors pose, hors mesure sur site, tarifs
  susceptibles d'évoluer (mention affichée dans le widget).
- Ne couvre que la terrasse (lames, lambourdes, fixation, habillage,
  ventilation) : claustras, portillons, bardages de façade et lames
  claire-voie ne sont pas inclus, ce sont des familles de produits
  distinctes dans le tarif Silvadec.
- Aucun envoi d'email n'est effectué par le widget lui-même (voir
  "Récupération des demandes de devis" ci-dessus).
