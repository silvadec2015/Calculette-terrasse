/**
 * Données produits & tarifaires Silvadec — Tarif public 2026 (TTC France métropolitaine,
 * éco-participation incluse). Source : "Tarif 2026 prix public" + "Notice de montage
 * lames de terrasse 138 et 180 x 23mm" (PU 7V27 - 12/2025).
 *
 * Pour mettre à jour les prix chaque année : modifier uniquement les champs `prix`
 * (et les codes article si Silvadec les fait évoluer). Les règles de calepinage
 * (jeux, entraxe lambourde, ratios) sont documentées dans REGLES ci-dessous.
 */
(function (global) {
  "use strict";

  var GAMMES = [
    {
      id: "elegance",
      nom: "Élégance",
      accroche: "Composite monoextrudé, aspect bois naturel évolutif",
      usage: "exterieur",
      largeurs: [
        {
          mm: 138,
          finitions: [
            {
              id: "lisse",
              nom: "Lisse",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM0507L4", prix: 52.13 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM0509L4", prix: 52.13 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM0904L4", prix: 52.13 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM0508L4", prix: 52.13 }
              ]
            },
            {
              id: "structuree",
              nom: "Structurée",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM1001L4", prix: 52.13 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM1002L4", prix: 52.13 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM1004L4", prix: 52.13 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM1003L4", prix: 52.13 }
              ]
            },
            {
              id: "rainuree",
              nom: "Rainurée",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM0501L4", prix: 52.13 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM0503L4", prix: 52.13 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM0903L4", prix: 52.13 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM0502L4", prix: 52.13 }
              ]
            }
          ],
          plancheFinition: [
            { id: "brun-colorado", code: "SIPLCH0906", prix: 59.60 },
            { id: "brun-exotique", code: "SIPLCH0908", prix: 59.60 },
            { id: "gris-anthracite", code: "SIPLCH0910", prix: 59.60 },
            { id: "gris-iroise", code: "SIPLCH0907", prix: 59.60 }
          ]
        },
        {
          mm: 180,
          finitions: [
            {
              id: "lisse",
              nom: "Lisse",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM1201L4", prix: 67.99 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM1202L4", prix: 67.99 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM1204L4", prix: 67.99 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM1203L4", prix: 67.99 }
              ]
            },
            {
              id: "structuree",
              nom: "Structurée",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM1313L4", prix: 67.99 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM1314L4", prix: 67.99 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM1316L4", prix: 67.99 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM1315L4", prix: 67.99 }
              ]
            },
            {
              id: "rainuree",
              nom: "Rainurée",
              couleurs: [
                { id: "brun-colorado", nom: "Brun Colorado", hex: "#6b4226", code: "SILAM1205L4", prix: 67.99 },
                { id: "brun-exotique", nom: "Brun Exotique", hex: "#8a5a3c", code: "SILAM1206L4", prix: 67.99 },
                { id: "gris-anthracite", nom: "Gris Anthracite", hex: "#3b3b3b", code: "SILAM1208L4", prix: 67.99 },
                { id: "gris-iroise", nom: "Gris Iroise", hex: "#9aa0a0", code: "SILAM1207L4", prix: 67.99 }
              ]
            }
          ],
          plancheFinition: [
            { id: "brun-colorado", code: "SIPLCH1302", prix: 77.73 },
            { id: "brun-exotique", code: "SIPLCH1301", prix: 77.73 },
            { id: "gris-anthracite", code: "SIPLCH1304", prix: 77.73 },
            { id: "gris-iroise", code: "SIPLCH1303", prix: 77.73 }
          ]
        }
      ],
      jupe: [
        { id: "brun-colorado", code: "SIJUP0301", prix: 18.94 },
        { id: "brun-exotique", code: "SIJUP0401", prix: 18.94 },
        { id: "gris-anthracite", code: "SIJUP0901", prix: 18.94 },
        { id: "gris-iroise", code: "SIJUP0302", prix: 18.94 }
      ]
    },
    {
      id: "atmosphere",
      nom: "Atmosphère",
      accroche: "Composite coextrudé brossé, couleur stable et garantie",
      usage: "tous",
      largeurs: [
        {
          mm: 138,
          finitions: [
            {
              id: "brossee",
              nom: "Brossée",
              couleurs: [
                { id: "brun-lima", nom: "Brun Lima", hex: "#7a5230", code: "SILAM1607L4", prix: 62.50 },
                { id: "brun-rio", nom: "Brun Rio", hex: "#8a5a34", code: "SILAM1812L4", prix: 62.50 },
                { id: "brun-sao-paulo", nom: "Brun Sao Paulo", hex: "#5e3d24", code: "SILAM1602L4", prix: 62.50 },
                { id: "gris-cayenne", nom: "Gris Cayenne", hex: "#6b6b66", code: "SILAM1603L4", prix: 62.50 },
                { id: "gris-ushuaia", nom: "Gris Ushuaia", hex: "#9a9690", code: "SILAM1609L4", prix: 62.50 },
                { id: "gris-belem", nom: "Gris Belem", hex: "#4d4d4a", code: "SILAM1601L4", prix: 62.50 }
              ]
            }
          ],
          plancheFinition: [
            { id: "brun-lima", code: "SIPLCH1602", prix: 71.47 },
            { id: "brun-rio", code: "SIPLCH1801", prix: 71.47 },
            { id: "brun-sao-paulo", code: "SIPLCH1601", prix: 71.47 },
            { id: "gris-cayenne", code: "SIPLCH1604", prix: 71.47 },
            { id: "gris-ushuaia", code: "SIPLCH1605", prix: 71.47 },
            { id: "gris-belem", code: "SIPLCH1603", prix: 71.47 }
          ]
        },
        {
          mm: 180,
          finitions: [
            {
              id: "brossee",
              nom: "Brossée",
              couleurs: [
                { id: "brun-lima", nom: "Brun Lima", hex: "#7a5230", code: "SILAM1808L4", prix: 81.52 },
                { id: "brun-rio", nom: "Brun Rio", hex: "#8a5a34", code: "SILAM1811L4", prix: 81.52 },
                { id: "brun-sao-paulo", nom: "Brun Sao Paulo", hex: "#5e3d24", code: "SILAM1809L4", prix: 81.52 },
                { id: "gris-cayenne", nom: "Gris Cayenne", hex: "#6b6b66", code: "SILAM1810L4", prix: 81.52 },
                { id: "gris-ushuaia", nom: "Gris Ushuaia", hex: "#9a9690", code: "SILAM1610L4", prix: 81.52 },
                { id: "gris-belem", nom: "Gris Belem", hex: "#4d4d4a", code: "SILAM1807L4", prix: 81.52 }
              ]
            }
          ],
          plancheFinition: [
            { id: "brun-lima", code: "SIPLCH1806", prix: 93.22 },
            { id: "brun-rio", code: "SIPLCH1807", prix: 93.22 },
            { id: "brun-sao-paulo", code: "SIPLCH1805", prix: 93.22 },
            { id: "gris-cayenne", code: "SIPLCH1804", prix: 93.22 },
            { id: "gris-ushuaia", code: "SIPLCH1802", prix: 93.22 },
            { id: "gris-belem", code: "SIPLCH1803", prix: 93.22 }
          ]
        }
      ],
      jupe: [
        { id: "brun-lima", code: "SIJUP1605", prix: 22.69 },
        { id: "brun-rio", code: "SIJUP1801", prix: 22.69 },
        { id: "brun-sao-paulo", code: "SIJUP1601", prix: 22.69 },
        { id: "gris-cayenne", code: "SIJUP1602", prix: 22.69 },
        { id: "gris-ushuaia", code: "SIJUP1603", prix: 22.69 },
        { id: "gris-belem", code: "SIJUP1604", prix: 22.69 }
      ]
    },
    {
      id: "atmosphere-nuances",
      nom: "Atmosphère Nuances",
      accroche: "Composite coextrudé, imitation essences précieuses",
      usage: "tous",
      largeurs: [
        {
          mm: 138,
          finitions: [
            {
              id: "brossee",
              nom: "Brossée",
              couleurs: [
                { id: "nuances-ipe", nom: "Nuances Ipé", hex: "#5a3a26", code: "B0035", prix: 69.42 },
                { id: "chene-clair", nom: "Chêne clair", hex: "#c9a876", code: "D0373", prix: 69.42 },
                // Nuances Acacia : tarifé comme Chêne clair. Codes article à confirmer
                // au prochain tarif Silvadec (laisser vide affiche « à confirmer »).
                { id: "nuances-acacia", nom: "Nuances Acacia", hex: "#c39a62", code: "", prix: 69.42 }
              ]
            }
          ],
          plancheFinition: [
            { id: "nuances-ipe", code: "B0038", prix: 79.38 },
            { id: "chene-clair", code: "D0374", prix: 79.38 },
            { id: "nuances-acacia", code: "", prix: 79.38 }
          ]
        }
      ],
      jupe: [
        { id: "nuances-ipe", code: "B0037", prix: 25.20 },
        { id: "chene-clair", code: "D0369", prix: 25.20 },
        { id: "nuances-acacia", code: "", prix: 25.20 }
      ]
    }
  ];

  var LAMBOURDES = [
    { id: "anthracite-3m", nom: "Lambourde composite gris anthracite 3 m", couleur: "anthracite", longueur: 3, code: "SILAMB1501", prix: 28.33 },
    { id: "anthracite-4m", nom: "Lambourde composite gris anthracite 4 m", couleur: "anthracite", longueur: 4, code: "SILAMB1102", prix: 37.77 }
  ];

  var FIXATIONS = {
    clipSimpleSachet: { nom: "Clip simple + vis inox — sachet de 30", code: "SICLIP0501", qte: 30, prix: 25.51 },
    clipSimpleCarton: { nom: "Clip simple + vis inox — carton de 360", code: "SICLIP0801", qte: 360, prix: 305.38 },
    clipAboutage: { nom: "Clips d'aboutage inox — sachet de 10", code: "SICLIP0502", qte: 10, prix: 15.20 },
    clipDebutFin: { nom: "Clips début & fin inox — sachet de 10", code: "SICLIP0601", qte: 10, prix: 12.68 },
    // Prix identique pour les 4 coloris (SIVIS1701 brun foncé, SIVIS1702 brun clair, SIVIS1703 gris foncé, SIVIS1704 gris métal) ; SIVIS1704 utilisé par défaut.
    visFinition: { nom: "Vis de finition inox 5x50mm — blister de 50 (gris métal)", code: "SIVIS1704", qte: 50, prix: 15.71 }
  };

  var GRILLE_VENTILATION = { nom: "Grille de ventilation (2 m posé / 1,995 m)", code: "E0296", longueur: 1.995, prix: 93.12 };

  var ENTRETIEN = [
    { id: "silvanet", nom: "Silvanet — traces de pollution et végétaux (1 L)", code: "SINET1201", prix: 33.19 },
    { id: "antimousse", nom: "Antimousse SILVAction (5 L)", code: "SINET1801", prix: 27.15 }
  ];

  /**
   * Règles de calepinage issues de la notice de montage Silvadec PU 7V27 (12/2025) :
   * - jeu de 5 mm en largeur ET en longueur entre lames
   * - entraxe lambourde maximal : 40 cm (0,4 m)
   * - jeu mini 15 mm / maxi 25 mm en périphérie (mur, obstacle)
   * - pour 1 m² : lame 138 -> 7 ml de lame / lame 180 -> 5,4 ml de lame
   * - pour 1 m² : ~3 ml de lambourde (quelle que soit la largeur de lame)
   * - pour 1 m² : ~19 clips (138, moyenne 18-20) / ~14 clips (180)
   * - vis apparente : 2 vis à chaque intersection lame/lambourde
   */
  var REGLES = {
    jeuLargeurMm: 5,
    jeuLongueurMm: 5,
    entraxeLambourdeM: 0.4,
    mlLameParM2: { 138: 7.0, 180: 5.4 },
    mlLambourdeParM2: 3.0,
    clipsParM2: { 138: 19, 180: 14 },
    visParIntersection: 2,
    longueurStandardLameM: 4,
    hauteurMinSousLameMm: 50
  };

  global.SILVADEC_DATA = {
    gammes: GAMMES,
    lambourdes: LAMBOURDES,
    fixations: FIXATIONS,
    grilleVentilation: GRILLE_VENTILATION,
    entretien: ENTRETIEN,
    regles: REGLES,
    meta: {
      tarif: "Tarif public Silvadec 2026, TTC France métropolitaine, éco-participation incluse",
      dateApplication: "2026-01-01",
      avertissement: "Estimation indicative de matériaux et de budget, hors pose et hors mesure sur site. Tarifs susceptibles d'évoluer, voir conditions générales de vente Silvadec."
    }
  };
})(typeof window !== "undefined" ? window : this);
