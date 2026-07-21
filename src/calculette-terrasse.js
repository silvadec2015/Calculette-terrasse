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

  function fmt(n) { return EUR.format(round2(n)); }
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

  function defaultState() {
    return {
      step: 1,
      submitted: false,
      longueur: 4,
      largeur: 3,
      covered: false,
      chutePct: 10,
      gammeId: "elegance",
      largeurMm: 138,
      finitionId: "lisse",
      couleurId: "brun-colorado",
      lambourdeCouleur: "brune",
      jointType: "lambourdeDoublee",
      fixation: "clips",
      habillage: "jupe",
      ventilation: false,
      entretien: [],
      devis: { nom: "", email: "", telephone: "", codePostal: "", message: "" }
    };
  }

  // ---- Moteur de calcul --------------------------------------------------

  function compute(state) {
    var regles = DATA.regles;
    var gamme = getGamme(state.gammeId);
    var largeurObj = getLargeur(gamme, state.largeurMm);
    var finition = getFinition(largeurObj, state.finitionId);
    var couleur = getCouleur(finition, state.couleurId);

    var surface = round2(Math.max(0, state.longueur) * Math.max(0, state.largeur));
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
    var facteurJoint = state.jointType === "lambourdeDoublee" ? 1.15 : 1;
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

    // Nombre de rangées de lames (utile pour clips début/fin et aboutages)
    var pasLameM = (state.largeurMm + regles.jeuLargeurMm) / 1000;
    var nbRangees = Math.ceil(state.largeur / pasLameM);
    var lamesParRangee = Math.ceil(state.longueur / regles.longueurStandardLameM);
    var nbAboutages = nbRangees * Math.max(0, lamesParRangee - 1);

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

      if (nbAboutages > 0 && state.jointType === "clipAboutage") {
        var abt = DATA.fixations.clipAboutage;
        var nbSachetsAbt = Math.ceil(nbAboutages / abt.qte);
        lignes.push({ categorie: "Fixation", designation: abt.nom, code: abt.code, quantite: nbSachetsAbt, unite: "sachet(s)", prixUnitaire: abt.prix, prixTotal: nbSachetsAbt * abt.prix });
      }
    } else {
      var vis = DATA.fixations.visFinition;
      var nbVis = nbIntersections * regles.visParIntersection;
      var nbBlisters = Math.ceil(nbVis / vis.qte);
      lignes.push({ categorie: "Fixation", designation: vis.nom, code: vis.code, quantite: nbBlisters, unite: "blister(s)", prixUnitaire: vis.prix, prixTotal: nbBlisters * vis.prix });
    }

    // Habillage périphérique
    var perimetre = 2 * (state.longueur + state.largeur);
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
      var nbGrilles = Math.max(2, 2 * Math.ceil(state.largeur / g.longueur));
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
    if (nbAboutages > 0 && state.jointType !== "clipAboutage") {
      alertes.push("Votre longueur de terrasse dépasse 4 m : des lambourdes doublées ont été ajoutées aux jonctions de lames, conformément à la notice de pose.");
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
    return '<ol class="ct-stepper">' + STEP_LABELS.map(function (label, i) {
      var n = i + 1;
      var cls = n === state.step ? "is-active" : n < state.step ? "is-done" : "";
      var clickable = n <= state.step && !state.submitted;
      return '<li class="ct-stepper__item ' + cls + '">' +
        '<button type="button" class="ct-stepper__btn" ' + (clickable ? 'data-action="goto-step" data-step="' + n + '"' : "disabled") + '>' +
        '<span class="ct-stepper__num">' + n + "</span>" +
        '<span class="ct-stepper__label">' + esc(label) + "</span>" +
        "</button></li>";
    }).join("") + "</ol>";
  }

  function renderStep1(state) {
    var surface = round2(Math.max(0, state.longueur) * Math.max(0, state.largeur));
    return '<div class="ct-panel">' +
      "<h3>Les dimensions de votre terrasse</h3>" +
      '<p class="ct-hint">Longueur = sens de pose des lames. Largeur = perpendiculaire. Terrasse rectangulaire simple ; pour une forme complexe, contactez un conseiller Silvadec.</p>' +
      '<div class="ct-field-row">' +
      '<label class="ct-field"><span>Longueur (m)</span><input type="number" min="0.5" max="50" step="0.1" data-field="longueur" value="' + state.longueur + '"></label>' +
      '<label class="ct-field"><span>Largeur (m)</span><input type="number" min="0.5" max="50" step="0.1" data-field="largeur" value="' + state.largeur + '"></label>' +
      "</div>" +
      '<p class="ct-surface-live">Surface : <strong data-live="surface">' + surface.toLocaleString("fr-FR") + "</strong> m²</p>" +
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
    var longueurDepasse4m = state.longueur > 4;

    var html = '<div class="ct-panel"><h3>Structure, fixation et finitions</h3>';

    html += '<div class="ct-field"><span>Couleur des lambourdes composite</span><div class="ct-toggle">' +
      '<button type="button" class="ct-toggle__btn' + (state.lambourdeCouleur === "brune" ? " is-selected" : "") + '" data-action="select-lambourde" data-lambourde="brune">Brune</button>' +
      '<button type="button" class="ct-toggle__btn' + (state.lambourdeCouleur === "anthracite" ? " is-selected" : "") + '" data-action="select-lambourde" data-lambourde="anthracite">Gris anthracite</button>' +
      "</div></div>";

    if (longueurDepasse4m) {
      html += '<div class="ct-field"><span>Jonction des lames (longueur &gt; 4 m)</span><div class="ct-toggle">' +
        '<button type="button" class="ct-toggle__btn' + (state.jointType === "lambourdeDoublee" ? " is-selected" : "") + '" data-action="select-joint" data-joint="lambourdeDoublee">Lambourdes doublées</button>' +
        '<button type="button" class="ct-toggle__btn' + (state.jointType === "clipAboutage" ? " is-selected" : "") + '" data-action="select-joint" data-joint="clipAboutage">Clips d\'aboutage</button>' +
        "</div></div>";
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
      html += '<table class="ct-table"><thead><tr><th>Désignation</th><th>Réf.</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead><tbody>';
      parCategorie[cat].forEach(function (l) {
        html += "<tr><td>" + esc(l.designation) + "</td><td>" + esc(l.code) + "</td><td>" + l.quantite + " " + esc(l.unite) + "</td><td>" + fmt(l.prixUnitaire) + "</td><td>" + fmt(l.prixTotal) + "</td></tr>";
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
      return '<div class="ct-panel ct-confirmation">' +
        "<h3>Merci !</h3>" +
        "<p>Votre demande a bien été enregistrée. Un conseiller Silvadec revient vers vous rapidement.</p>" +
        '<button type="button" class="ct-btn ct-btn--secondary" data-action="reset">Faire une nouvelle simulation</button>' +
        "</div>";
    }
    var d = state.devis;
    return '<div class="ct-panel"><h3>Recevoir mon devis personnalisé</h3>' +
      '<p class="ct-hint">Ces informations sont transmises à un conseiller Silvadec pour affiner votre devis.</p>' +
      '<div class="ct-field-row">' +
      '<label class="ct-field"><span>Nom *</span><input type="text" data-devis="nom" value="' + esc(d.nom) + '" required></label>' +
      '<label class="ct-field"><span>Email *</span><input type="email" data-devis="email" value="' + esc(d.email) + '" required></label>' +
      "</div>" +
      '<div class="ct-field-row">' +
      '<label class="ct-field"><span>Téléphone</span><input type="tel" data-devis="telephone" value="' + esc(d.telephone) + '"></label>' +
      '<label class="ct-field"><span>Code postal</span><input type="text" data-devis="codePostal" value="' + esc(d.codePostal) + '"></label>' +
      "</div>" +
      '<label class="ct-field"><span>Message (optionnel)</span><textarea data-devis="message" rows="3">' + esc(d.message) + "</textarea></label>" +
      '<button type="button" class="ct-btn ct-btn--primary" data-action="submit-devis">Envoyer ma demande de devis</button>' +
      "</div>";
  }

  function renderNav(state) {
    var backDisabled = state.step === 1;
    var isLast = state.step === STEP_LABELS.length;
    return '<div class="ct-nav">' +
      '<button type="button" class="ct-btn ct-btn--secondary" data-action="prev" ' + (backDisabled ? "disabled" : "") + ">&larr; Précédent</button>" +
      (isLast ? "" : '<button type="button" class="ct-btn ct-btn--primary" data-action="next">Suivant &rarr;</button>') +
      "</div>";
  }

  function renderShell(state) {
    var body;
    if (state.step === 1) body = renderStep1(state);
    else if (state.step === 2) body = renderStep2(state);
    else if (state.step === 3) body = renderStep3(state);
    else if (state.step === 4) body = renderStep4(state);
    else body = renderStep5(state);

    return '<div class="ct-widget">' +
      '<div class="ct-header"><h2>Calculette Terrasse</h2><p>Estimez en quelques clics les matériaux et le budget de votre future terrasse Silvadec.</p></div>' +
      renderStepper(state) +
      body +
      (state.submitted ? "" : renderNav(state)) +
      "</div>";
  }

  // ---- Contrôleur ------------------------------------------------------

  function createInstance(root, options) {
    options = options || {};
    var instanceId = "ct" + (++instanceCounter);
    var state = defaultState();

    function render() {
      root.innerHTML = renderShell(state);
    }

    function isStepValid(step) {
      if (step === 1) {
        return state.longueur > 0 && state.largeur > 0;
      }
      return true;
    }

    function goToStep(n) {
      state.step = clamp(n, 1, STEP_LABELS.length);
      render();
    }

    function buildQuotePayload() {
      var r = compute(state);
      return {
        dimensions: { longueur: state.longueur, largeur: state.largeur, surface: r.surface, terrasseCouverte: state.covered },
        produit: { gamme: r.gamme.nom, largeurMm: state.largeurMm, finition: r.finition.nom, couleur: r.couleur.nom, code: r.couleur.code },
        materiaux: r.lignes,
        total: r.total,
        contact: state.devis
      };
    }

    function submitDevis() {
      var d = state.devis;
      if (!d.nom || !d.email || d.email.indexOf("@") === -1) {
        root.querySelector(".ct-panel").insertAdjacentHTML("afterbegin", '<p class="ct-error">Merci de renseigner au minimum votre nom et un email valide.</p>');
        return;
      }
      var payload = buildQuotePayload();

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

      state.submitted = true;
      render();
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
        case "select-lambourde":
          state.lambourdeCouleur = btn.getAttribute("data-lambourde");
          render();
          break;
        case "select-joint":
          state.jointType = btn.getAttribute("data-joint");
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
        case "reset":
          state = defaultState();
          render();
          break;
      }
    });

    root.addEventListener("input", function (e) {
      var t = e.target;
      if (t.matches('[data-field="longueur"], [data-field="largeur"]')) {
        var v = parseFloat(t.value);
        state[t.getAttribute("data-field")] = isNaN(v) ? 0 : clamp(v, 0, 100);
        var live = root.querySelector('[data-live="surface"]');
        if (live) live.textContent = round2(Math.max(0, state.longueur) * Math.max(0, state.largeur)).toLocaleString("fr-FR");
      } else if (t.matches('[data-field="chutePct"]')) {
        state.chutePct = parseInt(t.value, 10);
        var out = root.querySelector('[data-live="chutePct"]');
        if (out) out.textContent = state.chutePct + "%";
      } else if (t.matches("[data-devis]")) {
        state.devis[t.getAttribute("data-devis")] = t.value;
      }
    });

    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.matches('[data-field="covered"]')) {
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

  function autoMount() {
    var nodes = document.querySelectorAll("[data-silvadec-calculette-terrasse], #silvadec-calculette-terrasse");
    nodes.forEach(function (el) {
      if (el.getAttribute("data-ct-mounted")) return;
      el.setAttribute("data-ct-mounted", "true");
      mount(el, { contactEmail: el.getAttribute("data-contact-email") || undefined });
    });
  }

  global.SilvadecCalculetteTerrasse = { mount: mount, VERSION: "1.0.0" };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})(typeof window !== "undefined" ? window : this);
