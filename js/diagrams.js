/*
 * diagrams.js: shared SVG diagrams (tutorial + printable review sheet)
 * Plane diagrams: a front-view figure with the plane drawn through it and
 * its axis drawn at 90° to the plane.
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});

  const FIGURE = `
    <g class="fig" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="80" cy="26" r="13"/>
      <path d="M80 39 L80 44"/>
      <path d="M62 48 Q80 42 98 48 L95 92 Q80 98 65 92 Z"/>
      <path d="M62 50 L50 78 L46 104"/>
      <path d="M98 50 L110 78 L114 104"/>
      <path d="M70 95 L67 140 L66 182 L58 186"/>
      <path d="M90 95 L93 140 L94 182 L102 186"/>
    </g>`;

  const PLANES = {
    sagittal: {
      poly: '58,8 102,30 102,198 58,176',
      axis: '<line x1="14" y1="98" x2="146" y2="98" class="ax"/><path d="M14 98 l9 -5 v10 z M146 98 l-9 -5 v10 z" class="axh"/>',
      axisLabel: [118, 90],
    },
    frontal: {
      poly: '22,14 130,6 138,192 30,200',
      axis: '<line x1="58" y1="122" x2="104" y2="76" class="ax"/><circle cx="81" cy="99" r="6" class="axo"/><circle cx="81" cy="99" r="1.8" class="axh"/><path d="M104 76 l-3 9 l-6 -6 z" class="axh"/>',
      axisLabel: [100, 128],
    },
    transverse: {
      poly: '10,112 116,112 150,86 44,86',
      axis: '<line x1="80" y1="2" x2="80" y2="198" class="ax"/><path d="M80 2 l-5 9 h10 z M80 198 l-5 -9 h10 z" class="axh"/>',
      axisLabel: [86, 14],
    },
  };

  function planeSVG(planeId, opts) {
    opts = opts || {};
    const d = PLANES[planeId];
    const col = opts.color || '#56e0ff';
    return `<svg viewBox="0 0 160 205" class="plane-svg" role="img" aria-label="${planeId} plane diagram" style="color:${opts.ink || '#cfe3f2'}">
      <style>
        .ax{stroke:${col};stroke-width:2.5;stroke-dasharray:6 4}
        .axh{fill:${col}}
        .axo{fill:none;stroke:${col};stroke-width:2}
      </style>
      ${planeId === 'transverse' ? '' : `<polygon points="${d.poly}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1.5"/>`}
      ${FIGURE}
      ${planeId === 'transverse' ? `<polygon points="${d.poly}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.5"/>` : ''}
      ${d.axis}
    </svg>`;
  }

  SEHS.diagrams = { planeSVG };
})();
