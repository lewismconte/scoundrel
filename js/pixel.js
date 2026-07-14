/* ============================================================
   PIX — pixel-art sprite pipeline.
   Emoji are rasterized onto a tiny canvas, alpha-crunched and
   posterized, then scaled up with image-rendering: pixelated.
   Suit symbols are hand-drawn 8×8 pixel maps.
   ============================================================ */
const PIX = (() => {

  const cache = new Map();

  /* rasterize an emoji at `base` px and pixel-crunch it */
  function emojiURL(emoji, base = 14) {
    const key = emoji + '@' + base;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = base;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = (base - 1) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    x.fillText(emoji, base / 2, base / 2 + 0.5);
    try {
      const img = x.getImageData(0, 0, base, base);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i + 3] = d[i + 3] > 100 ? 255 : 0;      // hard alpha edge
        if (d[i + 3]) {                             // posterize to 6 levels
          d[i]     = Math.round(d[i] / 51) * 51;
          d[i + 1] = Math.round(d[i + 1] / 51) * 51;
          d[i + 2] = Math.round(d[i + 2] / 51) * 51;
        }
      }
      x.putImageData(img, 0, 0);
    } catch (e) { /* keep un-crunched raster */ }
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
  }

  /* <img> tag for template strings */
  function emojiImg(emoji, base, disp, cls = '') {
    return `<img class="pix ${cls}" src="${emojiURL(emoji, base)}" width="${disp}" height="${disp}" alt="${emoji}" draggable="false">`;
  }

  /* ---------- hand-drawn 8×8 suit sprites ---------- */
  const SUIT_MAPS = {
    S: [ // spade: pointed top, flared stem
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '...XX...',
      '..XXXX..',
    ],
    C: [ // club: round top, lobes, stem
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '...XX...',
      '...XX...',
      '..XXXX..',
    ],
    H: [ // heart
      '.XX..XX.',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
      '........',
    ],
    D: [ // diamond
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
    ],
  };
  const SUIT_COLORS = { S: '#2b2b35', C: '#2b2b35', H: '#d94848', D: '#d94848' };

  function suitURL(suit) {
    const key = 'suit:' + suit;
    if (cache.has(key)) return cache.get(key);
    const map = SUIT_MAPS[suit];
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = SUIT_COLORS[suit];
    map.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'X') x.fillRect(rx, ry, 1, 1);
      }
    });
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
  }

  function suitImg(suit, disp, cls = '') {
    if (suit === 'X') return emojiImg('🃏', 10, disp, cls);
    return `<img class="pix ${cls}" src="${suitURL(suit)}" width="${disp}" height="${disp}" alt="${suit}" draggable="false">`;
  }

  return { emojiURL, emojiImg, suitURL, suitImg };
})();
