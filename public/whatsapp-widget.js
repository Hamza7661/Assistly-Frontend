(function () {
  'use strict';

  // ── Config from script tag ────────────────────────────────────────────────
  var script =
    document.currentScript ||
    document.querySelector('script[data-whatsapp-number]');

  if (!script) return;

  var rawNumber = script.getAttribute('data-whatsapp-number') || '';
  var message   = script.getAttribute('data-message')         || '';
  var label     = script.getAttribute('data-label')           || 'Chat on WhatsApp';
  // 'left' pins the tab to the left edge; default is 'right'
  var position  = script.getAttribute('data-position')        || 'right';

  if (!rawNumber) {
    console.warn('Assistly WhatsApp Widget: data-whatsapp-number is required.');
    return;
  }

  var number = rawNumber.replace(/[^\d+]/g, '');

  function buildUrl() {
    var url = 'https://wa.me/' + number;
    if (message) url += '?text=' + encodeURIComponent(message);
    return url;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  var isLeft    = position === 'left';
  var edgeSide  = isLeft ? 'left'  : 'right';
  // Rounded corners on the side that faces the page interior
  var radius    = isLeft ? '0 10px 10px 0' : '10px 0 0 10px';
  // On left tabs the label appears to the right of the icon; on right tabs to the left
  var flexDir   = isLeft ? 'row' : 'row-reverse';

  var css = [
    // Tab container
    '.assistly-wa-tab{',
      'position:fixed;',
      'top:50%;',
      edgeSide + ':0;',
      'transform:translateY(-50%);',
      'display:flex;',
      'flex-direction:' + flexDir + ';',
      'align-items:center;',
      'background:#25D366;',
      'border-radius:' + radius + ';',
      'cursor:pointer;',
      'z-index:9998;',
      'text-decoration:none;',
      'box-shadow:-3px 3px 16px rgba(37,211,102,.45);',
      'overflow:hidden;',
      'transition:box-shadow .25s ease;',
      'user-select:none;',
      '-webkit-tap-highlight-color:transparent;',
    '}',
    '.assistly-wa-tab:hover{',
      'box-shadow:-4px 4px 22px rgba(37,211,102,.6);',
    '}',

    // Icon wrapper — always visible
    '.assistly-wa-tab-icon{',
      'width:52px;',
      'height:52px;',
      'display:flex;',
      'align-items:center;',
      'justify-content:center;',
      'flex-shrink:0;',
    '}',
    '.assistly-wa-tab-icon svg{',
      'width:28px;',
      'height:28px;',
      'fill:#fff;',
      'display:block;',
      'transition:transform .25s ease;',
    '}',
    '.assistly-wa-tab:hover .assistly-wa-tab-icon svg,',
    '.assistly-wa-tab.expanded .assistly-wa-tab-icon svg{',
      'transform:scale(1.1);',
    '}',

    // Label — slides out on hover / expanded
    '.assistly-wa-tab-label{',
      'max-width:0;',
      'overflow:hidden;',
      'white-space:nowrap;',
      'color:#fff;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'font-size:14px;',
      'font-weight:600;',
      'letter-spacing:.01em;',
      'padding:0;',
      'transition:max-width .35s ease,padding .35s ease;',
    '}',
    '.assistly-wa-tab:hover .assistly-wa-tab-label,',
    '.assistly-wa-tab.expanded .assistly-wa-tab-label{',
      'max-width:180px;',
      // Add padding on the side away from the edge
      (isLeft ? 'padding:0 16px 0 4px' : 'padding:0 4px 0 16px') + ';',
    '}',

    // Pulse attention animation on load
    '@keyframes assistly-wa-tab-slide{',
      '0%{' + edgeSide + ':0;}',
      '30%{' + edgeSide + ':-8px;}',
      '60%{' + edgeSide + ':0;}',
      '80%{' + edgeSide + ':-4px;}',
      '100%{' + edgeSide + ':0;}',
    '}',
    '.assistly-wa-tab.bounce{',
      'animation:assistly-wa-tab-slide .7s ease 1.2s 1;',
    '}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── WhatsApp SVG icon ─────────────────────────────────────────────────────
  var svgIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
    '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475' +
    '-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52' +
    '.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207' +
    '-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372' +
    '-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 ' +
    '5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 ' +
    '1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m' +
    '-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648' +
    '-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 ' +
    '5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884' +
    'm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 ' +
    '1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 ' +
    '11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
    '</svg>';

  // ── Build DOM ─────────────────────────────────────────────────────────────
  var tab = document.createElement('a');
  tab.className = 'assistly-wa-tab bounce';
  tab.href = buildUrl();
  tab.target = '_blank';
  tab.rel = 'noopener noreferrer';
  tab.setAttribute('aria-label', label);

  var iconWrap = document.createElement('div');
  iconWrap.className = 'assistly-wa-tab-icon';
  iconWrap.innerHTML = svgIcon;

  var labelEl = document.createElement('span');
  labelEl.className = 'assistly-wa-tab-label';
  labelEl.textContent = label;

  tab.appendChild(iconWrap);
  tab.appendChild(labelEl);

  // ── Tap / click behaviour ─────────────────────────────────────────────────
  // Desktop: hover expands the label; clicking anywhere on the tab opens WhatsApp.
  // Mobile:  first tap expands; second tap (on the label or icon) opens WhatsApp.
  var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var touchMoved    = false;

  function openWhatsApp() {
    window.open(buildUrl(), '_blank', 'noopener,noreferrer');
  }

  if (isTouchDevice) {
    tab.addEventListener('touchmove',  function () { touchMoved = true;  });
    tab.addEventListener('touchstart', function () { touchMoved = false; });
    tab.addEventListener('click', function (e) {
      e.preventDefault(); // always prevent default; we control navigation
      if (touchMoved) return;

      if (!tab.classList.contains('expanded')) {
        // First tap: reveal the label
        tab.classList.add('expanded');
        clearTimeout(tab._collapseTimer);
        tab._collapseTimer = setTimeout(function () {
          tab.classList.remove('expanded');
        }, 4000);
      } else {
        // Second tap: open WhatsApp
        openWhatsApp();
      }
    });
  } else {
    // Desktop: single click opens WhatsApp (hover handles the expand visually)
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      openWhatsApp();
    });
  }

  // ── Mount ─────────────────────────────────────────────────────────────────
  function mount() {
    document.body.appendChild(tab);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
