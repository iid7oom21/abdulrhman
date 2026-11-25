// Ink, screentone and character helpers for the two drawn Ink Nights workshops. Everything is drawn here; no external art.
export const INK = '#16191b';
export const PAPER = '#f4ecdc';
export const AMBER = '#e2b45c';

export function paper(c, w, h, tone = PAPER) {
  c.fillStyle = tone; c.fillRect(0, 0, w, h);
}

// Screentone: a dot grid clipped to a rectangle. Spacing and radius set the grey value.
export function screentone(c, x, y, w, h, spacing = 7, radius = 1.4, color = INK) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = color;
  for (let row = 0, py = y; py < y + h + spacing; row++, py += spacing * .87) {
    for (let px = x + (row % 2 ? spacing / 2 : 0); px < x + w + spacing; px += spacing) {
      c.beginPath(); c.arc(px, py, radius, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

export function frame(c, x, y, w, h, line = 4) {
  c.save(); c.lineWidth = line; c.strokeStyle = INK; c.strokeRect(x, y, w, h); c.restore();
}


// Horizontal motion lines trailing behind a moving object.
export function motionLines(c, x, y, w, h, count, direction = 1, seed = 3) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = INK;
  for (let i = 0; i < count; i++) {
    const r = ((i + 1) * 9301 * seed + 49297) % 233280 / 233280;
    const ly = y + r * h, len = w * (.25 + ((i * 7) % 10) / 16);
    const lx = direction > 0 ? x + w * ((i * 13) % 10) / 20 : x + w - w * ((i * 13) % 10) / 20 - len;
    c.lineWidth = 1 + (i % 3) * .7;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + len, ly); c.stroke();
  }
  c.restore();
}

// Original characters of the coastal cinema: Layan (usher, cap) and Salem (projectionist, glasses).
export function person(c, who, x, y, s = 1, pose = 'front', fill = PAPER) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineWidth = 3 / s * s; c.strokeStyle = INK; c.fillStyle = fill; c.lineJoin = 'round'; c.lineCap = 'round';
  // body
  c.beginPath(); c.moveTo(-30, 120); c.quadraticCurveTo(-34, 40, 0, 34); c.quadraticCurveTo(34, 40, 30, 120); c.closePath(); c.fill(); c.stroke();
  if (who === 'layan') { screentone(c, -30, 40, 60, 80, 6, 1.3); c.beginPath(); c.moveTo(-30, 120); c.quadraticCurveTo(-34, 40, 0, 34); c.quadraticCurveTo(34, 40, 30, 120); c.stroke(); }
  // head
  c.beginPath(); c.arc(0, 0, 26, 0, Math.PI * 2); c.fill(); c.stroke();
  const look = pose === 'back' ? -1 : pose === 'side' ? .6 : 0;
  if (who === 'layan') {
    c.fillStyle = INK; c.beginPath(); c.ellipse(0, -14, 30, 13, 0, Math.PI, 0); c.fill();
    c.fillRect(-32, -16, 64, 6);
    c.beginPath(); c.moveTo(-24, -6); c.quadraticCurveTo(-30, 18, -18, 22); c.lineTo(-20, -4); c.fill();
  } else {
    c.fillStyle = INK; c.beginPath(); c.arc(0, -6, 27, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(20, -10); c.lineTo(-20, -10); c.fill();
    c.lineWidth = 2.5; c.strokeRect(-17 + look * 6, -2, 13, 9); c.strokeRect(4 + look * 6, -2, 13, 9);
    c.beginPath(); c.moveTo(-4 + look * 6, 2); c.lineTo(4 + look * 6, 2); c.stroke();
  }
  if (pose !== 'back') {
    c.fillStyle = INK;
    if (who === 'layan') { c.beginPath(); c.arc(-9 + look * 7, 3, 3.2, 0, Math.PI * 2); c.arc(9 + look * 7, 3, 3.2, 0, Math.PI * 2); c.fill(); }
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(-5 + look * 7, 14); c.quadraticCurveTo(look * 7, 17, 5 + look * 7, 14); c.stroke();
  }
  c.restore();
}

export function ticket(c, x, y, s = 1, angle = 0) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(s, s);
  c.fillStyle = AMBER; c.strokeStyle = INK; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-26, -14); c.lineTo(26, -14); c.lineTo(26, -5); c.arc(26, 0, 5, -Math.PI / 2, Math.PI / 2, true);
  c.lineTo(26, 14); c.lineTo(-26, 14); c.lineTo(-26, 5); c.arc(-26, 0, 5, Math.PI / 2, -Math.PI / 2, true); c.closePath(); c.fill(); c.stroke();
  c.setLineDash([3, 3]); c.beginPath(); c.moveTo(12, -12); c.lineTo(12, 12); c.stroke(); c.restore();
}

export function marquee(c, x, y, w, h, word = 'MARSA') {
  c.save(); c.fillStyle = INK; c.fillRect(x, y + h * .35, w, h * .65);
  c.fillStyle = PAPER; c.fillRect(x + w * .08, y + h * .45, w * .84, h * .22);
  c.fillStyle = INK; c.font = 'bold ' + Math.round(h * .17) + 'px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(word, x + w / 2, y + h * .56);
  c.fillStyle = AMBER; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(x + w * (.1 + i * .1), y + h * .4, 3.5, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x + w * .15, y + h * .35); c.lineTo(x + w * .5, y); c.lineTo(x + w * .85, y + h * .35); c.stroke();
  c.restore();
}

// A speech bubble with a tail pointing at (tx, ty). Text is wrapped by the caller's font.
export function bubble(c, x, y, w, h, tx, ty, text, rtl = true, size = 19) {
  c.save(); c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 3;
  const cx = x + w / 2, cy = y + h / 2;
  c.beginPath(); c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  const a = Math.atan2(ty - cy, tx - cx), side = .22;
  const bx1 = cx + Math.cos(a - side) * w * .42, by1 = cy + Math.sin(a - side) * h * .42;
  const bx2 = cx + Math.cos(a + side) * w * .42, by2 = cy + Math.sin(a + side) * h * .42;
  c.beginPath(); c.moveTo(bx1, by1); c.lineTo(tx, ty); c.lineTo(bx2, by2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(bx1, by1); c.lineTo(tx, ty); c.lineTo(bx2, by2); c.stroke();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = rtl ? 'rtl' : 'ltr';
  c.font = '600 ' + size + 'px "IBM Plex Sans Arabic", system-ui, sans-serif';
  wrap(c, text, cx, cy, w * .76, Math.round(size * 1.18));
  c.restore();
}

export function wrap(c, text, cx, cy, max, lineHeight) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const word of words) { const next = line ? line + ' ' + word : word; if (c.measureText(next).width > max && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  lines.forEach((l, i) => c.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lineHeight));
}

