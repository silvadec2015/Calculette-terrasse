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
demo-iframe.html                démo reproduisant la page Silvadec pour tester l'iframe
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

### Mode recommandé : un endpoint serveur

Renseigner `data-quote-endpoint` (sur le conteneur, ou `quoteEndpoint` dans
`mount()`) avec l'URL d'un service de formulaire (Formspree, EmailJS, route
WordPress…). Le widget y envoie le récapitulatif complet en `POST` JSON et
affiche « Votre demande a bien été transmise ». En cas d'échec réseau ou de
réponse non-OK, il retombe automatiquement sur le `mailto` décrit ci-dessous.

```html
<div id="silvadec-calculette-terrasse"
     data-quote-endpoint="https://fr.silvadec.com/wp-json/silvadec/v1/devis-terrasse"></div>
```

C'est le seul mode qui garantisse la réception : avec 50 % de visiteurs sur
mobile et une intégration en iframe, le `mailto` échoue souvent (pas de client
mail configuré, navigation bloquée par la sandbox).

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
