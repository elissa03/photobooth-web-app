import {
  FRAMES, ROUNDING,
  PW, PH, PAD, PTOP, PBOT, PHOTO_W, PHOTO_H,
  STRIP_W, STRIP_H, STRIP_SIDE_PAD, STRIP_PHOTO_SZ, STRIP_GAP, STRIP_TOP_PAD, STRIP_BOT_PAD,
} from './config.js';

export function composePolaroid(photoSource, frameKey, canvas) {
  const frame = FRAMES[frameKey] || FRAMES.white;

  canvas.width  = PW;
  canvas.height = PH;

  const ctx = canvas.getContext('2d');

  drawRoundRect(ctx, 0, 0, PW, PH, ROUNDING, frame.border);

  const photoX = PAD;
  const photoY = PTOP;

  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, photoX, photoY, PHOTO_W, PHOTO_H, 6);
  ctx.clip();

  const srcW = photoSource.width;
  const srcH = photoSource.height;
  const scale  = Math.max(PHOTO_W / srcW, PHOTO_H / srcH);
  const drawW  = srcW * scale;
  const drawH  = srcH * scale;
  const drawX  = photoX + (PHOTO_W - drawW) / 2;
  const drawY  = photoY + (PHOTO_H - drawH) / 2;

  ctx.drawImage(photoSource, drawX, drawY, drawW, drawH);
  ctx.restore();

  const captionY = PTOP + PHOTO_H + PAD / 2 + (PBOT - PAD / 2) / 2 + 10;
  ctx.font = '700 46px "Dancing Script", cursive';
  ctx.fillStyle = frameKey === 'black' ? '#c9a84c' : '#9a7530';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Elissa's 23rd 🎀", PW / 2, captionY);

  ctx.save();
  ctx.strokeStyle = frameKey === 'white' ? '#e0e0e0' :
                    frameKey === 'black' ? '#1c1c1c' : '#c9a84c';
  ctx.lineWidth = 10;
  roundRectPath(ctx, 0, 0, PW, PH, ROUNDING);
  ctx.stroke();
  ctx.restore();
}

export function composePhotostrip(photoSources, frameKey, canvas) {
  const frame = FRAMES[frameKey] || FRAMES.white;

  canvas.width  = STRIP_W;
  canvas.height = STRIP_H;

  const ctx = canvas.getContext('2d');

  drawRoundRect(ctx, 0, 0, STRIP_W, STRIP_H, ROUNDING, frame.border);

  for (let i = 0; i < photoSources.length; i++) {
    const src    = photoSources[i];
    const photoX = STRIP_SIDE_PAD;
    const photoY = STRIP_TOP_PAD + i * (STRIP_PHOTO_SZ + STRIP_GAP);

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, photoX, photoY, STRIP_PHOTO_SZ, STRIP_PHOTO_SZ, 4);
    ctx.clip();

    const srcMin = Math.min(src.width, src.height);
    const srcX   = (src.width  - srcMin) / 2;
    const srcY   = (src.height - srcMin) / 2;
    ctx.drawImage(src, srcX, srcY, srcMin, srcMin, photoX, photoY, STRIP_PHOTO_SZ, STRIP_PHOTO_SZ);
    ctx.restore();
  }

  const captionY = STRIP_TOP_PAD + 4 * STRIP_PHOTO_SZ + 3 * STRIP_GAP + STRIP_BOT_PAD / 2;
  ctx.font = '700 38px "Dancing Script", cursive';
  ctx.fillStyle = frameKey === 'black' ? '#c9a84c' : '#9a7530';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Elissa's 23rd 🎀", STRIP_W / 2, captionY);

  ctx.save();
  ctx.strokeStyle = frameKey === 'white' ? '#e0e0e0' :
                    frameKey === 'black' ? '#1c1c1c' : '#c9a84c';
  ctx.lineWidth = 10;
  roundRectPath(ctx, 0, 0, STRIP_W, STRIP_H, ROUNDING);
  ctx.stroke();
  ctx.restore();
}

function drawRoundRect(ctx, x, y, w, h, r, fillColor) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur  = 12;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}
