/**
 * Calculette Terrasse Silvadec — chargeur d'iframe pour la page hôte.
 *
 * À poser sur https://fr.silvadec.com/projet-devis/la-calculette-terrasse :
 *
 *   <div id="silvadec-calculette-terrasse"></div>
 *   <script src="https://VOTRE-CDN/calculette-terrasse/embed.js" defer></script>
 *
 * Le script crée l'iframe, puis :
 *  - ajuste sa hauteur à chaque changement de contenu (aucune barre de défilement
 *    imbriquée, aucun grand vide blanc) ;
 *  - ramène l'iframe en haut de l'écran quand le visiteur change d'étape, mais
 *    seulement si elle est sortie du champ de vision ;
 *  - remplace l'iframe par un lien de réouverture si le visiteur ferme la calculette ;
 *  - expose les étapes et les demandes de devis à la couche analytics du site
 *    (dataLayer / gtag), sans jamais transporter de donnée personnelle.
 *
 * Attributs facultatifs sur la balise <script> :
 *   data-target="#mon-conteneur"   sélecteur du conteneur (défaut : #silvadec-calculette-terrasse)
 *   data-src="…/embed.html"        URL du document embarqué (défaut : embed.html à côté de ce script)
 *   data-min-height="520"          hauteur avant le premier message de l'iframe
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var base = script.src.replace(/[^/]*$/, "");
  var SRC = script.getAttribute("data-src") || base + "embed.html";
  var SELECTOR = script.getAttribute("data-target") || "#silvadec-calculette-terrasse";
  var MIN_HEIGHT = parseInt(script.getAttribute("data-min-height"), 10) || 520;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var host = document.querySelector(SELECTOR);
    if (!host) {
      console.error("Calculette Terrasse Silvadec : conteneur introuvable (" + SELECTOR + ").");
      return;
    }

    var iframe;
    var lastStep = 0;

    function track(event, params) {
      if (window.dataLayer && typeof window.dataLayer.push === "function") {
        window.dataLayer.push(Object.assign({ event: event }, params || {}));
      }
      if (typeof window.gtag === "function") window.gtag("event", event, params || {});
    }

    function createIframe() {
      host.textContent = "";
      iframe = document.createElement("iframe");
      iframe.src = SRC;
      iframe.title = "Calculette Terrasse Silvadec";
      iframe.loading = "eager";
      iframe.setAttribute("scrolling", "no");
      iframe.style.cssText = "display:block;width:100%;border:0;overflow:hidden;height:" + MIN_HEIGHT + "px;";
      host.appendChild(iframe);
      lastStep = 0;
    }

    function renderClosed() {
      host.textContent = "";
      var p = document.createElement("p");
      p.style.cssText = "margin:0;padding:24px 0;text-align:center;font-family:Montserrat,Arial,sans-serif;color:#6b7a8d;";
      var link = document.createElement("button");
      link.type = "button";
      link.textContent = "Relancer la calculette terrasse";
      link.style.cssText = "font:inherit;font-weight:600;color:#23354b;background:none;border:0;cursor:pointer;text-decoration:underline;";
      link.addEventListener("click", createIframe);
      p.appendChild(link);
      host.appendChild(p);
    }

    window.addEventListener("message", function (event) {
      // Seuls les messages émis par NOTRE iframe sont pris en compte : une autre
      // iframe de la page ne peut pas piloter la hauteur ni le défilement.
      if (!iframe || event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;

      switch (data.type) {
        case "silvadec:ct:height":
          if (typeof data.height === "number" && data.height > 0) {
            iframe.style.height = Math.max(data.height, MIN_HEIGHT) + "px";
          }
          break;

        case "silvadec:ct:step":
          // Le premier message correspond au rendu initial : pas de scroll au chargement.
          if (lastStep !== 0 && data.step !== lastStep) {
            var box = iframe.getBoundingClientRect();
            // On ne repositionne que si le haut du widget est sorti de l'écran,
            // sinon le défilement automatique serait plus gênant qu'utile.
            if (box.top < 0) {
              iframe.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
          lastStep = data.step;
          track("calculette_terrasse_etape", { etape: data.step, libelle: data.label });
          break;

        case "silvadec:ct:quote":
          track("calculette_terrasse_devis", { transport: data.transport, montant: data.total, surface: data.surface });
          break;

        case "silvadec:ct:close":
          renderClosed();
          break;
      }
    });

    createIframe();
  });
})();
