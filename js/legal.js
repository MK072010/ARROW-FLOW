/* Legal pages: carries the "where did the player come from" hint so Back returns to the right screen.
   Without JavaScript the links still work; they simply return to the start of the app. */
(function () {
  'use strict';
  var from = '';
  try { from = new URLSearchParams(window.location.search).get('from') || ''; } catch (e) { /* ignore */ }
  var known = from === 'welcome' || from === 'settings' || from === 'me';

  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (a) {
    a.setAttribute('href', '../index.html' + (known ? '?return=' + from : ''));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sibling]'), function (a) {
    if (known) a.setAttribute('href', a.getAttribute('href').split('?')[0] + '?from=' + from);
  });
})();
