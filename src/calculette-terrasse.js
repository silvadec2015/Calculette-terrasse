/**
 * Calculette Terrasse Silvadec — widget embarquable (vanilla JS, sans dépendance).
 * Charger après src/data.js. Se monte automatiquement sur tout élément portant
 * l'attribut [data-silvadec-calculette-terrasse] ou l'id #silvadec-calculette-terrasse.
 *
 * API manuelle :
 *   SilvadecCalculetteTerrasse.mount(elementOuSelecteur, {
 *     contactEmail: "devis@silvadec.com",
 *     onQuoteRequest: function (payload) { ... } // reçoit le récapitulatif + les coordonnées
 *   });
 *
 * Événement émis à la soumission du formulaire de devis (bulle sur l'élément monté et sur window) :
 *   "silvadec:quote-request" — event.detail = { dimensions, produit, materiaux, total, contact }
 */
(function (global) {
  "use strict";

  if (!global.SILVADEC_DATA) {
    console.error("Calculette Terrasse Silvadec : src/data.js doit être chargé avant ce script.");
    return;
  }

  var DATA = global.SILVADEC_DATA;
  var EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var instanceCounter = 0;
  var DEFAULT_CONTACT_EMAIL = "question@silvadec.com";
  var VERSION = "1.2.0";

  function fmt(n) { return EUR.format(round2(n)); }
  // Un coloris récent peut ne pas encore avoir de code article au tarif en vigueur.
  function codeLabel(code) { return code ? code : "à confirmer"; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var STEP_LABELS = ["Dimensions", "Lames", "Pose & finitions", "Estimation", "Devis"];

  function getGamme(id) { return DATA.gammes.filter(function (g) { return g.id === id; })[0]; }
  function getLargeur(gamme, mm) { return gamme.largeurs.filter(function (l) { return l.mm === mm; })[0]; }
  function getFinition(largeurObj, id) { return largeurObj.finitions.filter(function (f) { return f.id === id; })[0]; }
  function getCouleur(finition, id) { return finition.couleurs.filter(function (c) { return c.id === id; })[0]; }
  function getLambourde(id) { return DATA.lambourdes.filter(function (l) { return l.id === id; })[0]; }

  // Sans longueur/largeur saisies séparément, on estime le périmètre et le nombre
  // de rangées de lames en assimilant la terrasse à un carré de même surface.
  // Cette estimation est affichée et modifiable à l'étape 3 pour les postes qui en dépendent
  // (habillage périphérique, grilles de ventilation).
  function estimatePerimetre(surface) { return round2(4 * Math.sqrt(Math.max(0, surface))); }

  function buildMailtoUrl(payload, contactEmail) {
    var d = payload.dimensions, p = payload.produit, c = payload.contact;
    var lines = [
      "Nouvelle demande de devis via la Calculette Terrasse Silvadec",
      "",
      "Surface : " + d.surface + " m²",
      "Terrasse couverte / abritée : " + (d.terrasseCouverte ? "oui" : "non"),
      "Produit : " + p.gamme + " " + p.finition + " " + p.largeurMm + "mm " + p.couleur + " (" + codeLabel(p.code) + ")",
      "",
      "Matériel estimé :"
    ];
    payload.materiaux.forEach(function (l) {
      lines.push("- " + l.quantite + " " + l.unite + " " + l.designation + " (" + codeLabel(l.code) + ") — " + fmt(l.prixTotal));
    });
    lines.push("");
    lines.push("Total estimatif : " + fmt(payload.total));
    lines.push("");
    lines.push("Coordonnées du client :");
    lines.push("Nom : " + c.nom);
    lines.push("Email : " + c.email);
    lines.push("Téléphone : " + (c.telephone || "-"));
    lines.push("Code postal : " + (c.codePostal || "-"));
    lines.push("Message : " + (c.message || "-"));

    var subject = "Demande de devis Calculette Terrasse (" + d.surface + " m²)";
    return "mailto:" + contactEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  // Raccourcis de saisie de la surface : sur mobile, taper un chiffre au pouce est
  // le premier frein du parcours, ces puces couvrent la majorité des projets.
  var SURFACES_RAPIDES = [10, 15, 20, 30, 40];

  function defaultState() {
    return {
      step: 1,
      submitted: false,
      sending: false,
      sendResult: null,
      surface: 0,
      perimetre: 0,
      covered: false,
      chutePct: 5,
      gammeId: "elegance",
      largeurMm: 138,
      finitionId: "lisse",
      couleurId: "brun-colorado",
      lambourdeCouleur: "anthracite",
      fixation: "clips",
      habillage: "jupe",
      ventilation: false,
      entretien: [],
      devis: {
        typeDemandeur: "",
        typeDemandeurAutre: "",
        nom: "", email: "", telephone: "", codePostal: "", message: "",
        consentement: false
      }
    };
  }

  // ---- Moteur de calcul --------------------------------------------------

  function compute(state) {
    var regles = DATA.regles;
    var gamme = getGamme(state.gammeId);
    var largeurObj = getLargeur(gamme, state.largeurMm);
    var finition = getFinition(largeurObj, state.finitionId);
    var couleur = getCouleur(finition, state.couleurId);

    var surface = round2(Math.max(0, state.surface));
    var lignes = [];
    var alertes = [];

    if (gamme.usage === "exterieur" && state.covered) {
      alertes.push("La gamme " + gamme.nom + " est réservée aux terrasses extérieures non couvertes. Pour une zone couverte ou semi-abritée, choisissez Atmosphère ou Atmosphère Nuances.");
    }

    if (surface <= 0) {
      return { surface: 0, lignes: [], total: 0, alertes: alertes, invalid: true };
    }

    // Lames de terrasse
    var mlParM2 = regles.mlLameParM2[state.largeurMm];
    var mlAvecChute = surface * mlParM2 * (1 + state.chutePct / 100);
    var nbLames = Math.ceil(mlAvecChute / regles.longueurStandardLameM);
    var prixLames = nbLames * couleur.prix;
    lignes.push({
      categorie: "Lames de terrasse",
      designation: "Lame " + gamme.nom + " " + finition.nom + " " + state.largeurMm + "mm " + couleur.nom + " 4 m",
      code: couleur.code,
      quantite: nbLames,
      unite: "pièce(s)",
      prixUnitaire: couleur.prix,
      prixTotal: prixLames
    });

    // Lambourdes
    var lambourdeId = state.lambourdeCouleur + "-4m";
    var lambourde = getLambourde(lambourdeId) || DATA.lambourdes[0];
    var mlLambourde = surface * regles.mlLambourdeParM2;
    var facteurJoint = Math.sqrt(surface) > regles.longueurStandardLameM ? 1.15 : 1;
    var nbLambourdes = Math.ceil((mlLambourde * facteurJoint) / lambourde.longueur);
    var prixLambourdes = nbLambourdes * lambourde.prix;
    lignes.push({
      categorie: "Structure",
      designation: lambourde.nom,
      code: lambourde.code,
      quantite: nbLambourdes,
      unite: "pièce(s)",
      prixUnitaire: lambourde.prix,
      prixTotal: prixLambourdes
    });

    // Sans longueur/largeur distinctes, on assimile la terrasse à un carré de même
    // surface pour estimer le nombre de rangées de lames (utile pour les clips
    // début/fin et les aboutages). Cette approximation est indépendante de la forme
    // réelle et reste cohérente avec le périmètre estimé/ajusté ci-dessous.
    var pasLameM = (state.largeurMm + regles.jeuLargeurMm) / 1000;
    var coteEstime = Math.sqrt(surface);
    var nbRangees = Math.max(1, Math.ceil(coteEstime / pasLameM));
    var nbAboutages = Math.max(0, nbLames - nbRangees);
    // Au-delà de la longueur standard d'une lame, l'aboutage est imposé par la notice
    // de pose : on double automatiquement les lambourdes aux jonctions plutôt que de
    // demander un arbitrage au visiteur (la calculette se veut simple et rapide).
    var jonctionNecessaire = coteEstime > regles.longueurStandardLameM;

    // Fixation
    var clipsParM2 = regles.clipsParM2[state.largeurMm];
    var nbIntersections = Math.ceil(surface * clipsParM2);

    if (state.fixation === "clips") {
      var carton = DATA.fixations.clipSimpleCarton;
      var sachet = DATA.fixations.clipSimpleSachet;
      var nbCartons = Math.floor(nbIntersections / carton.qte);
      var reste = nbIntersections - nbCartons * carton.qte;
      var nbSachets = Math.ceil(reste / sachet.qte);
      if (nbCartons > 0) {
        lignes.push({ categorie: "Fixation", designation: carton.nom, code: carton.code, quantite: nbCartons, unite: "carton(s)", prixUnitaire: carton.prix, prixTotal: nbCartons * carton.prix });
      }
      if (nbSachets > 0) {
        lignes.push({ categorie: "Fixation", designation: sachet.nom, code: sachet.code, quantite: nbSachets, unite: "sachet(s)", prixUnitaire: sachet.prix, prixTotal: nbSachets * sachet.prix });
      }

      var debutFin = DATA.fixations.clipDebutFin;
      var nbDebutFin = nbRangees * 2;
      var nbSachetsDebutFin = Math.ceil(nbDebutFin / debutFin.qte);
      lignes.push({ categorie: "Fixation", designation: debutFin.nom, code: debutFin.code, quantite: nbSachetsDebutFin, unite: "sachet(s)", prixUnitaire: debutFin.prix, prixTotal: nbSachetsDebutFin * debutFin.prix });

      // Les aboutages sont traités par lambourdes doublées (facteurJoint ci-dessus),
      // solution retenue par défaut : pas de clips d'aboutage à chiffrer.
    } else {
      var vis = DATA.fixations.visFinition;
      var nbVis = nbIntersections * regles.visParIntersection;
      var nbBlisters = Math.ceil(nbVis / vis.qte);
      lignes.push({ categorie: "Fixation", designation: vis.nom, code: vis.code, quantite: nbBlisters, unite: "blister(s)", prixUnitaire: vis.prix, prixTotal: nbBlisters * vis.prix });
    }

    // Habillage périphérique (périmètre estimé pour une terrasse carrée, ajustable à l'étape 3)
    var perimetre = state.perimetre > 0 ? state.perimetre : estimatePerimetre(surface);
    if (state.habillage === "jupe") {
      var jupe = gamme.jupe.filter(function (j) { return j.id === couleur.id; })[0];
      if (jupe) {
        var nbJupes = Math.ceil(perimetre / 2) + 4;
        lignes.push({ categorie: "Habillage périphérique", designation: "Jupe de finition " + gamme.nom + " " + couleur.nom + " 2 m", code: jupe.code, quantite: nbJupes, unite: "pièce(s)", prixUnitaire: jupe.prix, prixTotal: nbJupes * jupe.prix });
        var visJupe = Math.ceil(perimetre / 0.4);
        var blistersJupe = Math.ceil(visJupe / DATA.fixations.visFinition.qte);
        lignes.push({ categorie: "Habillage périphérique", designation: DATA.fixations.visFinition.nom, code: DATA.fixations.visFinition.code, quantite: blistersJupe, unite: "blister(s)", prixUnitaire: DATA.fixations.visFinition.prix, prixTotal: blistersJupe * DATA.fixations.visFinition.prix });
      }
    } else if (state.habillage === "planche") {
      var planche = largeurObj.plancheFinition.filter(function (p) { return p.id === couleur.id; })[0];
      if (planche) {
        var nbPlanches = Math.ceil(perimetre / regles.longueurStandardLameM) + 4;
        lignes.push({ categorie: "Habillage périphérique", designation: "Planche de finition " + gamme.nom + " " + state.largeurMm + "mm " + couleur.nom + " 4 m", code: planche.code, quantite: nbPlanches, unite: "pièce(s)", prixUnitaire: planche.prix, prixTotal: nbPlanches * planche.prix });
        var visPlanche = Math.ceil(perimetre / 0.4) * 2;
        var blistersPlanche = Math.ceil(visPlanche / DATA.fixations.visFinition.qte);
        lignes.push({ categorie: "Habillage périphérique", designation: DATA.fixations.visFinition.nom, code: DATA.fixations.visFinition.code, quantite: blistersPlanche, unite: "blister(s)", prixUnitaire: DATA.fixations.visFinition.prix, prixTotal: blistersPlanche * DATA.fixations.visFinition.prix });
      }
    }

    // Ventilation périphérique (optionnelle)
    if (state.ventilation) {
      var g = DATA.grilleVentilation;
      var longueurVentilee = perimetre / 2;
      var nbGrilles = Math.max(2, Math.ceil(longueurVentilee / g.longueur));
      lignes.push({ categorie: "Ventilation", designation: g.nom, code: g.code, quantite: nbGrilles, unite: "pièce(s)", prixUnitaire: g.prix, prixTotal: nbGrilles * g.prix });
    }

    // Entretien (optionnel)
    state.entretien.forEach(function (id) {
      var item = DATA.entretien.filter(function (e) { return e.id === id; })[0];
      if (item) {
        lignes.push({ categorie: "Entretien", designation: item.nom, code: item.code, quantite: 1, unite: "pièce(s)", prixUnitaire: item.prix, prixTotal: item.prix });
      }
    });

    var total = lignes.reduce(function (sum, l) { return sum + l.prixTotal; }, 0);

    if (surface > 30 && !state.ventilation) {
      alertes.push("Terrasse de plus de 30 m² : Silvadec recommande d'ajouter des grilles de ventilation en périphérie (option disponible à l'étape précédente).");
    }
    if (jonctionNecessaire) {
      alertes.push("Votre terrasse dépasse 4 m dans un sens : les lames doivent être aboutées. Des lambourdes doublées ont été ajoutées aux jonctions, conformément à la notice de pose Silvadec.");
    }

    return {
      surface: surface,
      gamme: gamme, largeurObj: largeurObj, finition: finition, couleur: couleur,
      lambourde: lambourde,
      nbRangees: nbRangees,
      lignes: lignes,
      total: total,
      alertes: alertes,
      invalid: false
    };
  }

  // ---- Rendu ---------------------------------------------------------------

  function renderSwatch(c, selected) {
    return '<button type="button" class="ct-swatch' + (selected ? " is-selected" : "") + '" data-action="select-couleur" data-couleur="' + esc(c.id) + '" title="' + esc(c.nom) + '">' +
      '<span class="ct-swatch__color" style="background:' + esc(c.hex) + '"></span>' +
      '<span class="ct-swatch__label">' + esc(c.nom) + "</span></button>";
  }

  function renderStepper(state) {
    var total = STEP_LABELS.length;
    var html = '<ol class="ct-stepper">' + STEP_LABELS.map(function (label, i) {
      var n = i + 1;
      var cls = n === state.step ? "is-active" : n < state.step ? "is-done" : "";
      var clickable = n <= state.step && !state.submitted;
      return '<li class="ct-stepper__item ' + cls + '">' +
        '<button type="button" class="ct-stepper__btn" ' + (clickable ? 'data-action="goto-step" data-step="' + n + '"' : "disabled") + '>' +
        '<span class="ct-stepper__num">' + n + "</span>" +
        '<span class="ct-stepper__label">' + esc(label) + "</span>" +
        "</button></li>";
    }).join("") + "</ol>";

    // Sous 640px, les libellés du fil d'étapes ne tiennent pas : cette barre les
    // remplace (une seule des deux est affichée, cf. media query du CSS).
    html += '<div class="ct-progress">' +
      '<div class="ct-progress__text">' +
      '<span class="ct-progress__step">Étape ' + state.step + " / " + total + "</span>" +
      '<span class="ct-progress__label">' + esc(STEP_LABELS[state.step - 1]) + "</span>" +
      "</div>" +
      '<span class="ct-progress__bar"><span class="ct-progress__fill" style="width:' + Math.round((state.step / total) * 100) + '%"></span></span>' +
      "</div>";
    return html;
  }

  // Dès qu'on connaît une surface et une lame, on sait chiffrer : afficher le total
  // pendant que le visiteur choisit ses options tient la promesse d'« estimation
  // rapide » de la page, au lieu de la repousser à l'étape 4.
  function renderRunningTotal(state) {
    if (state.step !== 2 && state.step !== 3) return "";
    if (!(state.surface > 0)) return "";
    var r = compute(state);
    if (r.invalid) return "";
    return '<div class="ct-running">' +
      '<span class="ct-running__label">Estimation en cours</span>' +
      '<span class="ct-running__value">' + fmt(r.total) + "</span>" +
      '<span class="ct-running__hint">Mise à jour en direct — total TTC indicatif pour ' + r.surface.toLocaleString("fr-FR") + " m², hors pose.</span>" +
      "</div>";
  }

  function renderStep1(state) {
    var chips = SURFACES_RAPIDES.map(function (m2) {
      var sel = state.surface === m2;
      return '<button type="button" class="ct-chip' + (sel ? " is-selected" : "") + '" data-action="set-surface" data-surface="' + m2 + '">' + m2 + " m²</button>";
    }).join("");

    return '<div class="ct-panel">' +
      "<h3>La surface de votre terrasse</h3>" +
      '<p class="ct-hint">Terrasse rectangulaire simple ; pour une forme complexe (angles, découpes), contactez un conseiller Silvadec pour un devis sur mesure.</p>' +
      '<label class="ct-field"><span>Surface (m²)</span>' +
      '<input type="number" inputmode="decimal" min="1" max="1000" step="0.5" placeholder="Ex. 20" data-field="surface" value="' + (state.surface > 0 ? state.surface : "") + '"></label>' +
      '<div class="ct-chips">' + chips + "</div>" +
      '<label class="ct-field"><span>Marge de chute / découpes (%)</span><input type="range" min="0" max="25" step="1" data-field="chutePct" value="' + state.chutePct + '"><output data-live="chutePct">' + state.chutePct + "%</output></label>" +
      '<label class="ct-checkbox"><input type="checkbox" data-field="covered" ' + (state.covered ? "checked" : "") + '> Terrasse couverte ou semi-abritée (véranda, pergola pleine, balcon couvert...)</label>' +
      "</div>";
  }

  function renderStep2(state) {
    var gamme = getGamme(state.gammeId);
    var gammesDisponibles = DATA.gammes.filter(function (g) { return !state.covered || g.usage === "tous"; });
    var largeurObj = getLargeur(gamme, state.largeurMm);
    var finition = getFinition(largeurObj, state.finitionId);

    var html = '<div class="ct-panel"><h3>Choisissez votre lame de terrasse</h3>';
    html += '<div class="ct-gamme-grid">' + gammesDisponibles.map(function (g) {
      var sel = g.id === state.gammeId;
      return '<button type="button" class="ct-gamme-card' + (sel ? " is-selected" : "") + '" data-action="select-gamme" data-gamme="' + esc(g.id) + '">' +
        "<strong>" + esc(g.nom) + "</strong><span>" + esc(g.accroche) + "</span></button>";
    }).join("") + "</div>";

    html += '<div class="ct-field-row">';
    html += '<div class="ct-field"><span>Largeur de lame</span><div class="ct-toggle">' + gamme.largeurs.map(function (l) {
      var sel = l.mm === state.largeurMm;
      return '<button type="button" class="ct-toggle__btn' + (sel ? " is-selected" : "") + '" data-action="select-largeur" data-largeur="' + l.mm + '">' + l.mm + " mm</button>";
    }).join("") + "</div></div>";

    if (largeurObj.finitions.length > 1) {
      html += '<div class="ct-field"><span>Finition</span><div class="ct-toggle">' + largeurObj.finitions.map(function (f) {
        var sel = f.id === state.finitionId;
        return '<button type="button" class="ct-toggle__btn' + (sel ? " is-selected" : "") + '" data-action="select-finition" data-finition="' + esc(f.id) + '">' + esc(f.nom) + "</button>";
      }).join("") + "</div></div>";
    }
    html += "</div>";

    html += '<div class="ct-field"><span>Coloris</span><div class="ct-swatch-grid">' +
      finition.couleurs.map(function (c) { return renderSwatch(c, c.id === state.couleurId); }).join("") +
      "</div></div>";

    var couleur = getCouleur(finition, state.couleurId) || finition.couleurs[0];
    html += '<p class="ct-price-hint">' + esc(couleur.nom) + " — " + fmt(couleur.prix) + " / lame de 4 m (" + fmt(couleur.prix / (4 * (state.largeurMm / 1000))) + " / m² de lame, hors jeux de pose)</p>";
    html += "</div>";
    return html;
  }

  function renderStep3(state) {
    var gamme = getGamme(state.gammeId);
    var largeurObj = getLargeur(gamme, state.largeurMm);
    var hasPlanche = largeurObj.plancheFinition.length > 0;
    var perimetreNecessaire = state.habillage !== "aucun" || state.ventilation;

    var html = '<div class="ct-panel"><h3>Structure, fixation et finitions</h3>';

    html += '<p class="ct-hint">Lambourdes composite : gris anthracite standard</p>';

    if (perimetreNecessaire) {
      html += '<label class="ct-field"><span>Périmètre de la terrasse (m)</span><input type="number" min="1" max="400" step="0.1" data-field="perimetre" value="' + state.perimetre + '"></label>' +
        '<p class="ct-hint">Estimé automatiquement pour une terrasse carrée d\'environ ' + round2(Math.sqrt(state.surface)) + ' m de côté à partir de votre surface. Ajustez cette valeur si votre terrasse est plus rectangulaire, pour un habillage/une ventilation plus précis.</p>';
    }

    html += '<div class="ct-field"><span>Type de fixation</span><div class="ct-toggle">' +
      '<button type="button" class="ct-toggle__btn' + (state.fixation === "clips" ? " is-selected" : "") + '" data-action="select-fixation" data-fixation="clips">Clips inox (invisible, recommandé)</button>' +
      '<button type="button" class="ct-toggle__btn' + (state.fixation === "vis" ? " is-selected" : "") + '" data-action="select-fixation" data-fixation="vis">Vis apparentes</button>' +
      "</div></div>";

    html += '<div class="ct-field"><span>Habillage périphérique</span><div class="ct-toggle">' +
      '<button type="button" class="ct-toggle__btn' + (state.habillage === "aucun" ? " is-selected" : "") + '" data-action="select-habillage" data-habillage="aucun">Aucun</button>' +
      '<button type="button" class="ct-toggle__btn' + (state.habillage === "jupe" ? " is-selected" : "") + '" data-action="select-habillage" data-habillage="jupe">Jupe de finition (70 mm)</button>' +
      (hasPlanche ? '<button type="button" class="ct-toggle__btn' + (state.habillage === "planche" ? " is-selected" : "") + '" data-action="select-habillage" data-habillage="planche">Planche de finition (' + state.largeurMm + ' mm)</button>' : "") +
      "</div></div>";

    html += '<label class="ct-checkbox"><input type="checkbox" data-field="ventilation" ' + (state.ventilation ? "checked" : "") + '> Ajouter des grilles de ventilation en périphérie (recommandé)</label>';

    html += '<div class="ct-field"><span>Entretien (optionnel)</span>' +
      DATA.entretien.map(function (e) {
        var checked = state.entretien.indexOf(e.id) !== -1;
        return '<label class="ct-checkbox"><input type="checkbox" data-field="entretien" data-entretien-id="' + esc(e.id) + '" ' + (checked ? "checked" : "") + "> " + esc(e.nom) + " — " + fmt(e.prix) + "</label>";
      }).join("") +
      "</div>";

    html += "</div>";
    return html;
  }

  function renderStep4(state) {
    var r = compute(state);
    if (r.invalid) {
      return '<div class="ct-panel"><p>Merci de renseigner des dimensions valides à l\'étape 1.</p></div>';
    }
    var parCategorie = {};
    r.lignes.forEach(function (l) {
      parCategorie[l.categorie] = parCategorie[l.categorie] || [];
      parCategorie[l.categorie].push(l);
    });

    var html = '<div class="ct-panel"><h3>Votre estimation</h3>';
    html += '<p class="ct-surface-live">Surface : <strong>' + r.surface.toLocaleString("fr-FR") + '</strong> m² — ' + esc(r.gamme.nom) + " " + esc(r.finition.nom) + " " + state.largeurMm + "mm " + esc(r.couleur.nom) + "</p>";

    if (r.alertes.length) {
      html += '<div class="ct-alertes">' + r.alertes.map(function (a) { return "<p>⚠️ " + esc(a) + "</p>"; }).join("") + "</div>";
    }

    Object.keys(parCategorie).forEach(function (cat) {
      html += '<h4 class="ct-cat-title">' + esc(cat) + "</h4>";
      // Les data-label alimentent la bascule en cartes sous 640px (voir CSS) :
      // une seule structure, aucun contenu dupliqué, aucun scroll horizontal.
      html += '<table class="ct-table"><thead><tr><th>Désignation</th><th>Réf.</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead><tbody>';
      parCategorie[cat].forEach(function (l) {
        html += "<tr>" +
          "<td>" + esc(l.designation) + "</td>" +
          '<td data-label="Réf.">' + esc(codeLabel(l.code)) + "</td>" +
          '<td data-label="Qté">' + l.quantite + " " + esc(l.unite) + "</td>" +
          '<td data-label="Prix unitaire">' + fmt(l.prixUnitaire) + "</td>" +
          '<td data-label="Total">' + fmt(l.prixTotal) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table>";
    });

    html += '<p class="ct-total">Total estimatif : <strong>' + fmt(r.total) + "</strong></p>";
    html += '<p class="ct-hint">' + esc(DATA.meta.avertissement) + "</p>";
    html += "</div>";
    return html;
  }

  function renderStep5(state) {
    if (state.submitted) {
      var corps;
      if (state.sendResult === "endpoint") {
        corps = "<p>Votre demande a bien été transmise à un conseiller Silvadec. Vous serez recontacté sous 48 h ouvrées.</p>";
      } else {
        // Repli mailto : en iframe et sur mobile, l'ouverture automatique échoue
        // souvent, le lien explicite est donc mis en avant et non en note de bas.
        corps = "<p>Votre messagerie a dû s'ouvrir avec un email pré-rempli à destination de <strong>" + esc(state.lastContactEmail) + "</strong> : il ne vous reste qu'à cliquer sur Envoyer.</p>" +
          '<p><a class="ct-btn ct-btn--secondary" href="' + esc(state.lastMailto) + '">Rien ne s\'est ouvert ? Ouvrir l\'email</a></p>';
      }
      return '<div class="ct-panel ct-confirmation">' +
        "<h3>Merci !</h3>" + corps +
        '<p><button type="button" class="ct-btn ct-btn--tertiary" data-action="reset">Faire une nouvelle simulation</button></p>' +
        "</div>";
    }
    if (state.sending) {
      return '<div class="ct-panel ct-confirmation"><h3>Envoi en cours…</h3><p class="ct-hint">Merci de patienter quelques secondes.</p></div>';
    }
    var d = state.devis;
    var rgpd = DATA.rgpd;

    var types = DATA.typesDemandeur.map(function (t) {
      var sel = d.typeDemandeur === t.id;
      return '<button type="button" class="ct-toggle__btn' + (sel ? " is-selected" : "") + '" data-action="select-demandeur" data-demandeur="' + esc(t.id) + '">' + esc(t.nom) + "</button>";
    }).join("");

    var html = '<div class="ct-panel"><h3>Recevoir mon devis personnalisé</h3>' +
      '<p class="ct-hint">Ces informations sont transmises à un conseiller Silvadec pour affiner votre devis.</p>' +
      '<div class="ct-field"><span>Vous êtes *</span><div class="ct-toggle">' + types + "</div></div>";

    if (d.typeDemandeur === "autre") {
      html += '<label class="ct-field"><span>Précisez *</span><input type="text" data-devis="typeDemandeurAutre" value="' + esc(d.typeDemandeurAutre) + '" placeholder="Ex. collectivité, bureau de contrôle…"></label>';
    }

    html += '<div class="ct-field-row">' +
      '<label class="ct-field"><span>Nom *</span><input type="text" data-devis="nom" value="' + esc(d.nom) + '" required></label>' +
      '<label class="ct-field"><span>Email *</span><input type="email" data-devis="email" value="' + esc(d.email) + '" required></label>' +
      "</div>" +
      '<div class="ct-field-row">' +
      '<label class="ct-field"><span>Téléphone</span><input type="tel" data-devis="telephone" value="' + esc(d.telephone) + '"></label>' +
      '<label class="ct-field"><span>Code postal</span><input type="text" data-devis="codePostal" value="' + esc(d.codePostal) + '"></label>' +
      "</div>" +
      '<label class="ct-field"><span>Message (optionnel)</span><textarea data-devis="message" rows="3">' + esc(d.message) + "</textarea></label>";

    // Information et recueil du consentement (RGPD). Le consentement est horodaté
    // et joint au payload transmis au CRM, pour pouvoir en apporter la preuve.
    html += '<div class="ct-rgpd">' +
      '<label class="ct-checkbox"><input type="checkbox" data-devis="consentement" ' + (d.consentement ? "checked" : "") + ">" +
      "<span>J'accepte que " + esc(rgpd.responsable) + " utilise les informations ci-dessus pour " + esc(rgpd.finalite) + ". *</span></label>" +
      '<p class="ct-rgpd__mentions">Destinataires : ' + esc(rgpd.destinataires) + ". " +
      "Vos données sont conservées <strong>" + rgpd.dureeConservationMois + " mois</strong> à compter du dernier contact, puis supprimées. " +
      "Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, " +
      'que vous pouvez exercer à <a href="mailto:' + esc(rgpd.contactDroits) + '">' + esc(rgpd.contactDroits) + "</a>." +
      (rgpd.politiqueUrl ? ' <a href="' + esc(rgpd.politiqueUrl) + '" target="_blank" rel="noopener">Politique de confidentialité</a>.' : "") +
      "</p></div>";

    html += '<button type="button" class="ct-btn ct-btn--primary" data-action="submit-devis">Envoyer ma demande de devis</button>' +
      "</div>";
    return html;
  }

  function renderNav(state, options) {
    var backDisabled = state.step === 1;
    var isLast = state.step === STEP_LABELS.length;
    var nav = '<div class="ct-nav">' +
      '<button type="button" class="ct-btn ct-btn--secondary" data-action="prev" ' + (backDisabled ? "disabled" : "") + ">&larr; Précédent</button>" +
      '<span class="ct-nav__end">';

    if (state.step === 4) {
      // Trois sorties : le devis (conversion), l'impression (sans laisser ses
      // coordonnées) et la fermeture — pour ne pas enfermer le visiteur.
      nav += '<button type="button" class="ct-btn ct-btn--tertiary" data-action="print">Imprimer l\'estimation</button>' +
        '<button type="button" class="ct-btn ct-btn--primary" data-action="goto-step" data-step="5">Demander un devis</button>';
      if (options.showClose) {
        nav += '<button type="button" class="ct-btn ct-btn--tertiary" data-action="close-widget">Fermer</button>';
      }
    } else if (!isLast) {
      var nextDisabled = state.step === 1 && !(state.surface > 0);
      nav += '<button type="button" class="ct-btn ct-btn--primary" data-action="next" ' + (nextDisabled ? "disabled" : "") + ">Suivant &rarr;</button>";
    }
    return nav + "</span></div>";
  }

  function renderShell(state, options) {
    var body;
    if (state.step === 1) body = renderStep1(state);
    else if (state.step === 2) body = renderStep2(state);
    else if (state.step === 3) body = renderStep3(state);
    else if (state.step === 4) body = renderStep4(state);
    else body = renderStep5(state);

    // En iframe, la page hôte affiche déjà le titre « La Calculette terrasse » et
    // son chapô : réafficher les nôtres ferait doublon et coûterait ~80px sur mobile.
    var header = options.hideHeader ? "" :
      '<div class="ct-header"><h2>Calculette Terrasse</h2><p>Estimez en quelques clics les matériaux et le budget de votre future terrasse Silvadec.</p></div>';

    return '<div class="ct-widget' + (options.embedded ? " ct-widget--embedded" : "") + '">' +
      header +
      renderStepper(state) +
      renderRunningTotal(state) +
      body +
      (state.submitted || state.sending ? "" : renderNav(state, options)) +
      "</div>";
  }

  // ---- Contrôleur ------------------------------------------------------

  function createInstance(root, options) {
    options = options || {};
    var instanceId = "ct" + (++instanceCounter);
    var state = defaultState();

    var isFramed = false;
    try { isFramed = !!global.parent && global.parent !== global; } catch (e) { isFramed = true; }
    var lastPostedHeight = 0;

    /**
     * Messages émis vers la page hôte quand le widget tourne en iframe.
     * Aucune donnée personnelle ne transite jamais par postMessage : les
     * coordonnées du visiteur partent uniquement vers `quoteEndpoint` (ou le
     * mailto). L'origine cible reste "*" parce que le widget ne peut pas
     * connaître l'origine du parent — c'est sans risque tant que le contenu
     * des messages se limite à une hauteur, un n° d'étape et un montant.
     */
    function postToHost(message) {
      if (!isFramed) return;
      try { global.parent.postMessage(message, "*"); } catch (e) { /* parent inaccessible */ }
    }

    /**
     * Redimensionne directement la balise <iframe> qui nous contient.
     * Ne fonctionne que si le document embarqué est servi depuis la MÊME origine
     * que la page hôte — dans ce cas l'intégration ne demande aucun script côté
     * page, ce qui permet d'utiliser un composant CMS « URL + hauteur » tel quel
     * (Drupal, WordPress…). Sinon l'accès lève une erreur et on retombe sur
     * postMessage, géré par embed.js.
     */
    function resizeOwnFrame(height) {
      try {
        var frame = global.frameElement;
        if (!frame) return false;
        frame.style.height = height + "px";
        frame.setAttribute("scrolling", "no");
        return true;
      } catch (e) {
        return false; // iframe cross-origin : postMessage prend le relais
      }
    }

    function postHeight(force) {
      if (!isFramed) return;
      var h = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );
      if (!force && Math.abs(h - lastPostedHeight) < 2) return;
      lastPostedHeight = h;
      resizeOwnFrame(h);
      postToHost({ type: "silvadec:ct:height", instance: instanceId, height: h });
    }

    function render() {
      root.innerHTML = renderShell(state, options);
      // La hauteur est mesurée après que le navigateur a appliqué la mise en page.
      if (global.requestAnimationFrame) global.requestAnimationFrame(function () { postHeight(false); });
      else postHeight(false);
    }

    function isStepValid(step) {
      if (step === 1) {
        return state.surface > 0;
      }
      return true;
    }

    function goToStep(n) {
      var previous = state.step;
      state.step = clamp(n, 1, STEP_LABELS.length);
      render();
      if (state.step !== previous) {
        // En same-origin, on repositionne nous-mêmes la page hôte ; sinon c'est
        // embed.js qui le fait à la réception du message. Sans ça, en iframe,
        // changer d'étape ne bouge pas le scroll de la page et le visiteur se
        // retrouve au milieu de l'étape suivante (surtout sur mobile).
        try {
          var frame = global.frameElement;
          if (frame && frame.getBoundingClientRect().top < 0) {
            frame.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch (e) { /* cross-origin : embed.js s'en charge */ }
        postToHost({
          type: "silvadec:ct:step",
          instance: instanceId,
          step: state.step,
          steps: STEP_LABELS.length,
          label: STEP_LABELS[state.step - 1]
        });
      }
    }

    // Met à jour les puces de surface sans re-rendre tout le panneau, pour ne pas
    // faire perdre le focus au champ pendant la frappe.
    function syncSurfaceUi() {
      var chips = root.querySelectorAll("[data-action='set-surface']");
      Array.prototype.forEach.call(chips, function (chip) {
        var on = parseFloat(chip.getAttribute("data-surface")) === state.surface;
        chip.classList.toggle("is-selected", on);
      });
      var next = root.querySelector("[data-action='next']");
      if (next) next.disabled = !(state.surface > 0);
    }

    function buildQuotePayload() {
      var r = compute(state);
      var d = state.devis;
      var type = DATA.typesDemandeur.filter(function (t) { return t.id === d.typeDemandeur; })[0];
      return {
        source: "calculette-terrasse",
        version: VERSION,
        dateDemande: new Date().toISOString(),
        dimensions: { surface: r.surface, perimetreEstime: state.perimetre, terrasseCouverte: state.covered },
        produit: { gamme: r.gamme.nom, largeurMm: state.largeurMm, finition: r.finition.nom, couleur: r.couleur.nom, code: r.couleur.code },
        materiaux: r.lignes,
        total: r.total,
        contact: {
          typeDemandeur: d.typeDemandeur,
          typeDemandeurLibelle: type ? type.nom : "",
          typeDemandeurAutre: d.typeDemandeur === "autre" ? d.typeDemandeurAutre : "",
          nom: d.nom,
          email: d.email,
          telephone: d.telephone,
          codePostal: d.codePostal,
          message: d.message
        },
        // Preuve de consentement horodatée, à conserver côté CRM avec la demande.
        consentement: {
          accepte: d.consentement === true,
          date: new Date().toISOString(),
          finalite: DATA.rgpd.finalite,
          destinataires: DATA.rgpd.destinataires,
          dureeConservationMois: DATA.rgpd.dureeConservationMois
        }
      };
    }

    function finishSubmit(result, payload, mailtoUrl, contactEmail) {
      state.sending = false;
      state.submitted = true;
      state.sendResult = result;
      state.lastMailto = mailtoUrl;
      state.lastContactEmail = contactEmail;
      render();
      // Signal de conversion pour la page hôte — volontairement sans coordonnées.
      postToHost({
        type: "silvadec:ct:quote",
        instance: instanceId,
        transport: result,
        total: payload.total,
        surface: payload.dimensions.surface
      });
      if (result === "mailto") {
        // En iframe, la navigation mailto: peut être bloquée sans erreur ;
        // l'écran de confirmation affiche de toute façon le lien explicite.
        try { global.location.href = mailtoUrl; } catch (e) { /* bloqué par la sandbox */ }
      }
    }

    function validationError() {
      var d = state.devis;
      if (!d.typeDemandeur) return "Merci d'indiquer si vous êtes un particulier, un distributeur, un prescripteur ou autre.";
      if (d.typeDemandeur === "autre" && !d.typeDemandeurAutre.trim()) return "Merci de préciser votre qualité.";
      if (!d.nom.trim()) return "Merci de renseigner votre nom.";
      if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Merci de renseigner un email valide.";
      // Sans consentement, aucune donnée ne part : c'est la base légale du traitement.
      if (!d.consentement) return "Merci d'accepter l'utilisation de vos données pour traiter votre demande de devis.";
      return null;
    }

    function submitDevis() {
      var message = validationError();
      if (message) {
        var panel = root.querySelector(".ct-panel");
        if (panel) {
          var existing = panel.querySelector(".ct-error");
          if (existing) existing.textContent = message;
          else panel.insertAdjacentHTML("afterbegin", '<p class="ct-error">' + esc(message) + "</p>");
          postHeight(true);
        }
        return;
      }
      var payload = buildQuotePayload();
      var contactEmail = options.contactEmail || DEFAULT_CONTACT_EMAIL;
      var mailtoUrl = buildMailtoUrl(payload, contactEmail);

      if (typeof options.onQuoteRequest === "function") {
        options.onQuoteRequest(payload);
      }

      var evt;
      try {
        evt = new CustomEvent("silvadec:quote-request", { detail: payload, bubbles: true });
      } catch (e) {
        evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("silvadec:quote-request", true, false, payload);
      }
      root.dispatchEvent(evt);
      global.dispatchEvent(evt);

      // Envoi serveur si un endpoint est configuré : c'est le seul mode qui
      // garantisse la réception (le mailto dépend du client mail du visiteur,
      // souvent absent sur mobile et bloqué en iframe sandboxée).
      if (options.quoteEndpoint && global.fetch) {
        state.sending = true;
        render();
        global.fetch(options.quoteEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (res) {
          finishSubmit(res && res.ok ? "endpoint" : "mailto", payload, mailtoUrl, contactEmail);
        })["catch"](function () {
          finishSubmit("mailto", payload, mailtoUrl, contactEmail);
        });
        return;
      }

      finishSubmit("mailto", payload, mailtoUrl, contactEmail);
    }

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn || btn.disabled) return;
      var action = btn.getAttribute("data-action");

      switch (action) {
        case "next":
          if (isStepValid(state.step)) goToStep(state.step + 1);
          break;
        case "prev":
          goToStep(state.step - 1);
          break;
        case "goto-step":
          goToStep(parseInt(btn.getAttribute("data-step"), 10));
          break;
        case "select-gamme": {
          var gamme = getGamme(btn.getAttribute("data-gamme"));
          state.gammeId = gamme.id;
          if (!getLargeur(gamme, state.largeurMm)) state.largeurMm = gamme.largeurs[0].mm;
          var lo = getLargeur(gamme, state.largeurMm);
          if (!getFinition(lo, state.finitionId)) state.finitionId = lo.finitions[0].id;
          var fi = getFinition(lo, state.finitionId);
          if (!getCouleur(fi, state.couleurId)) state.couleurId = fi.couleurs[0].id;
          if (lo.plancheFinition.length === 0 && state.habillage === "planche") state.habillage = "jupe";
          render();
          break;
        }
        case "select-largeur": {
          state.largeurMm = parseInt(btn.getAttribute("data-largeur"), 10);
          var g2 = getGamme(state.gammeId), lo2 = getLargeur(g2, state.largeurMm);
          if (!getFinition(lo2, state.finitionId)) state.finitionId = lo2.finitions[0].id;
          var fi2 = getFinition(lo2, state.finitionId);
          if (!getCouleur(fi2, state.couleurId)) state.couleurId = fi2.couleurs[0].id;
          if (lo2.plancheFinition.length === 0 && state.habillage === "planche") state.habillage = "jupe";
          render();
          break;
        }
        case "select-finition":
          state.finitionId = btn.getAttribute("data-finition");
          render();
          break;
        case "select-couleur":
          state.couleurId = btn.getAttribute("data-couleur");
          render();
          break;
        case "select-fixation":
          state.fixation = btn.getAttribute("data-fixation");
          render();
          break;
        case "select-habillage":
          state.habillage = btn.getAttribute("data-habillage");
          render();
          break;
        case "submit-devis":
          submitDevis();
          break;
        case "select-demandeur":
          state.devis.typeDemandeur = btn.getAttribute("data-demandeur");
          render();
          break;
        case "set-surface":
          state.surface = parseFloat(btn.getAttribute("data-surface"));
          state.perimetre = estimatePerimetre(state.surface);
          render();
          break;
        case "print":
          // Dans une iframe, window.print() n'imprime que le document du widget :
          // c'est exactement le récapitulatif voulu (cf. règles @media print).
          global.print();
          break;
        case "reset":
          state = defaultState();
          render();
          break;
        case "close-widget":
          root.innerHTML = "";
          postToHost({ type: "silvadec:ct:close", instance: instanceId });
          break;
      }
    });

    root.addEventListener("input", function (e) {
      var t = e.target;
      if (t.matches('[data-field="surface"]')) {
        var v = parseFloat(t.value);
        state.surface = isNaN(v) ? 0 : clamp(v, 0, 2000);
        state.perimetre = estimatePerimetre(state.surface);
        syncSurfaceUi();
      } else if (t.matches('[data-field="perimetre"]')) {
        var vp = parseFloat(t.value);
        state.perimetre = isNaN(vp) ? 0 : clamp(vp, 0, 2000);
      } else if (t.matches('[data-field="chutePct"]')) {
        state.chutePct = parseInt(t.value, 10);
        var out = root.querySelector('[data-live="chutePct"]');
        if (out) out.textContent = state.chutePct + "%";
      } else if (t.matches("[data-devis]")) {
        // La case de consentement est un checkbox : lire .checked, pas .value.
        state.devis[t.getAttribute("data-devis")] = t.type === "checkbox" ? t.checked : t.value;
      }
    });

    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.matches('[data-devis]') && t.type === "checkbox") {
        // Filet pour les navigateurs qui n'émettraient pas "input" sur un checkbox.
        state.devis[t.getAttribute("data-devis")] = t.checked;
      } else if (t.matches('[data-field="covered"]')) {
        state.covered = t.checked;
        var gamme = getGamme(state.gammeId);
        if (state.covered && gamme.usage === "exterieur") {
          state.gammeId = "atmosphere";
          var lo = getLargeur(getGamme("atmosphere"), state.largeurMm) || getGamme("atmosphere").largeurs[0];
          state.largeurMm = lo.mm;
          state.finitionId = lo.finitions[0].id;
          state.couleurId = lo.finitions[0].couleurs[0].id;
        }
        render();
      } else if (t.matches('[data-field="ventilation"]')) {
        state.ventilation = t.checked;
        render();
      } else if (t.matches('[data-field="entretien"]')) {
        var id = t.getAttribute("data-entretien-id");
        var idx = state.entretien.indexOf(id);
        if (t.checked && idx === -1) state.entretien.push(id);
        if (!t.checked && idx !== -1) state.entretien.splice(idx, 1);
        render();
      }
    });

    render();

    if (isFramed) {
      // Le chargement de Montserrat et la rotation de l'écran changent la hauteur
      // sans qu'aucun render() n'ait lieu : on resynchronise la page hôte.
      if (global.ResizeObserver && document.body) {
        new global.ResizeObserver(function () { postHeight(false); }).observe(document.body);
      }
      global.addEventListener("load", function () { postHeight(true); });
      global.addEventListener("resize", function () { postHeight(false); });
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { postHeight(true); });
      }
    }

    return {
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      destroy: function () { root.innerHTML = ""; }
    };
  }

  function mount(target, options) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) {
      console.error("Calculette Terrasse Silvadec : élément de montage introuvable pour", target);
      return null;
    }
    return createInstance(el, options);
  }

  function boolAttr(el, name) {
    var v = el.getAttribute(name);
    return v !== null && v !== "false";
  }

  function autoMount() {
    var nodes = document.querySelectorAll("[data-silvadec-calculette-terrasse], #silvadec-calculette-terrasse");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute("data-ct-mounted")) return;
      el.setAttribute("data-ct-mounted", "true");
      mount(el, {
        contactEmail: el.getAttribute("data-contact-email") || undefined,
        quoteEndpoint: el.getAttribute("data-quote-endpoint") || undefined,
        hideHeader: boolAttr(el, "data-hide-header"),
        embedded: boolAttr(el, "data-embedded"),
        showClose: boolAttr(el, "data-show-close")
      });
    });
  }

  global.SilvadecCalculetteTerrasse = { mount: mount, VERSION: VERSION };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})(typeof window !== "undefined" ? window : this);
