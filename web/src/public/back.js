'use strict';

/**
 * Botón "Volver" para las distintas secciones del sitio.
 *
 * Cada pestaña del navegador tiene su propio historial: si hay una página
 * anterior, `history.back()` vuelve a ella. Si no la hay (por ejemplo, se abrió
 * la página directamente), se sigue el `href` de respaldo del enlace.
 *
 * Se usa un archivo externo (y no `onclick`) porque la política CSP de Helmet
 * bloquea los manejadores inline.
 */
(function initBackLinks() {
  var links = document.querySelectorAll('[data-back]');

  for (var i = 0; i < links.length; i += 1) {
    links[i].addEventListener('click', function onBackClick(event) {
      if (window.history && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
      // Sin historial previo, el navegador sigue el href del enlace.
    });
  }
})();
