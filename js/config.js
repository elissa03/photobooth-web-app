export const FRAMES = {
  white: { border: '#ffffff', shadow: 'rgba(180,180,180,0.4)' },
  black: { border: '#1c1c1c', shadow: 'rgba(0,0,0,0.5)' },
  pink:  { border: '#c9a84c', shadow: 'rgba(201,168,76,0.4)' },
};

// Polaroid dimensions (px, @2x for crisp output)
export const PW   = 560;
export const PH   = 680;
export const PAD  = 28;
export const PTOP = 28;
export const PBOT = 110;
export const ROUNDING = 14;
export const PHOTO_W = PW - PAD * 2;
export const PHOTO_H = PH - PTOP - PBOT - PAD;

// Photo strip dimensions
export const STRIP_SIDE_PAD  = 20;
export const STRIP_PHOTO_SZ  = 340;
export const STRIP_GAP       = 10;
export const STRIP_TOP_PAD   = 24;
export const STRIP_BOT_PAD   = 80;
export const STRIP_W = STRIP_PHOTO_SZ + STRIP_SIDE_PAD * 2;
export const STRIP_H = STRIP_TOP_PAD + 4 * STRIP_PHOTO_SZ + 3 * STRIP_GAP + STRIP_BOT_PAD;
