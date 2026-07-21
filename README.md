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
index.html                      démo / page de test locale
src/data.js                     catalogue produits + tarifs + règles de calepinage
src/calculette-terrasse.js      logique de calcul + interface (vanilla JS)
src/calculette-terrasse.css     styles, isolés sous la classe .ct-widget
```

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

### 3. Dans une iframe (si nécessaire pour un CMS qui l'impose)

Héberger `index.html` (avec `src/` à côté) et l'inclure via
`<iframe src="https://VOTRE-CDN/calculette-terrasse/index.html" style="width:100%;border:0" height="900"></iframe>`.
Ajuster la hauteur manuellement ou intégrer une librairie de redimensionnement
d'iframe côté site (non fournie ici, pour rester sans dépendance).

## Récupération des demandes de devis

Le widget n'a **aucun backend**. À l'étape 5, quand l'utilisateur valide le
formulaire :

1. Si l'option `onQuoteRequest` a été passée à `mount()`, elle est appelée
   avec le récapitulatif complet (dimensions, produit choisi, liste de
   matériaux, total, coordonnées).
2. Dans tous les cas, un événement `silvadec:quote-request` est déclenché
   (`bubbles: true`) sur l'élément monté ET sur `window`, avec le même
   payload dans `event.detail`. C'est le point d'intégration à utiliser
   pour brancher le CRM/formulaire de contact existant du site (appel API,
   Google Tag Manager, etc.).

**Il faut câbler l'un de ces deux mécanismes côté site pour que les demandes
de devis soient effectivement transmises à un conseiller** — sans cela,
les demandes ne sont ni envoyées ni stockées nulle part.

## Mettre à jour le tarif

Toutes les données commerciales sont dans `src/data.js` :

- `gammes` : une entrée par gamme (Élégance, Émotion, Atmosphère, Atmosphère
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
