// Generate isometric character sprites using canvas
// Each character has 8 directional sprites (N, NE, E, SE, S, SW, W, NW)

export const CHARACTER_DIRECTIONS = Object.freeze({
  N: 0,
  NE: 1,
  E: 2,
  SE: 3,
  S: 4,
  SW: 5,
  W: 6,
  NW: 7
});

export const DIRECTION_ANGLES = Object.freeze({
  0: { dx: 0, dy: -1 },   // N
  1: { dx: 1, dy: -1 },   // NE
  2: { dx: 1, dy: 0 },    // E
  3: { dx: 1, dy: 1 },    // SE
  4: { dx: 0, dy: 1 },    // S
  5: { dx: -1, dy: 1 },   // SW
  6: { dx: -1, dy: 0 },   // W
  7: { dx: -1, dy: -1 }   // NW
});

function drawIsometricCharacter(ctx, width, height, skinColor, outfitColor, direction = 0) {
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.fillStyle = outfitColor;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 8);
  ctx.lineTo(centerX + 6, centerY - 2);
  ctx.lineTo(centerX + 6, centerY + 6);
  ctx.lineTo(centerX - 6, centerY + 6);
  ctx.lineTo(centerX - 6, centerY - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY - 10, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8B4513";
  ctx.fillRect(centerX - 3, centerY - 4, 6, 3);

  ctx.strokeStyle = outfitColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 4, centerY);
  ctx.lineTo(centerX - 6, centerY + 4);
  ctx.moveTo(centerX + 4, centerY);
  ctx.lineTo(centerX + 6, centerY + 4);
  ctx.stroke();
}

export function generateHunterSprite(width = 32, height = 32, direction = 0) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ?
    new OffscreenCanvas(width, height) :
    document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  drawIsometricCharacter(ctx, width, height, '#f4a460', '#4a7c59', direction);

  ctx.fillStyle = '#000';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H', width / 2, height / 2);

  return canvas.convertToBlob ?
    canvas.convertToBlob().then(blob => createImageBitmap(blob)) :
    canvas;
}

export function generateNPCSprite(type = 'farmer', width = 32, height = 32) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ?
    new OffscreenCanvas(width, height) :
    document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  const colors = {
    farmer: { skin: '#deb887', outfit: '#8B6F47' },
    forester: { skin: '#f4a460', outfit: '#3d5a3d' },
    expert: { skin: '#deb887', outfit: '#5a5a5a' },
    thief: { skin: '#f4a460', outfit: '#2a2a2a' },
    rival: { skin: '#deb887', outfit: '#8B0000' }
  };

  const color = colors[type] || colors.farmer;
  drawIsometricCharacter(ctx, width, height, color.skin, color.outfit, 0);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(type[0].toUpperCase(), width / 2, height / 2);

  return canvas.convertToBlob ?
    canvas.convertToBlob().then(blob => createImageBitmap(blob)) :
    canvas;
}

export function generateObjectSprite(objectType = 'rock', width = 32, height = 32) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ?
    new OffscreenCanvas(width, height) :
    document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;

  const shapes = {
    rock: () => {
      ctx.fillStyle = '#757575';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 6);
      ctx.lineTo(centerX + 5, centerY - 2);
      ctx.lineTo(centerX + 4, centerY + 4);
      ctx.lineTo(centerX - 4, centerY + 4);
      ctx.lineTo(centerX - 5, centerY - 2);
      ctx.closePath();
      ctx.fill();
    },
    tree: () => {
      ctx.fillStyle = '#558B2F';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX + 8, centerY - 2);
      ctx.lineTo(centerX + 8, centerY + 8);
      ctx.lineTo(centerX - 8, centerY + 8);
      ctx.lineTo(centerX - 8, centerY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6D4C41';
      ctx.fillRect(centerX - 2, centerY + 6, 4, 3);
    },
    bush: () => {
      ctx.fillStyle = '#689F38';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX + 7, centerY - 1);
      ctx.lineTo(centerX + 6, centerY + 5);
      ctx.lineTo(centerX - 6, centerY + 5);
      ctx.lineTo(centerX - 7, centerY - 1);
      ctx.closePath();
      ctx.fill();
    },
    dig: () => {
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 6);
      ctx.lineTo(centerX + 6, centerY);
      ctx.lineTo(centerX + 6, centerY + 6);
      ctx.lineTo(centerX - 6, centerY + 6);
      ctx.lineTo(centerX - 6, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY + 2, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const shape = shapes[objectType] || shapes.rock;
  shape();

  return canvas.convertToBlob ?
    canvas.convertToBlob().then(blob => createImageBitmap(blob)) :
    canvas;
}

export async function createCharacterTexture(THREE, spriteType = 'hunter', subType = 'default') {
  const canvas = new OffscreenCanvas(256, 32);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 32);

  for (let dir = 0; dir < 8; dir++) {
    if (spriteType === 'hunter') {
      drawIsometricCharacter(ctx, 32, 32, '#f4a460', '#4a7c59', dir);
    } else {
      const npcColors = {
        farmer: { skin: '#deb887', outfit: '#8B6F47' },
        forester: { skin: '#f4a460', outfit: '#3d5a3d' },
        expert: { skin: '#deb887', outfit: '#5a5a5a' },
        thief: { skin: '#f4a460', outfit: '#2a2a2a' },
        rival: { skin: '#deb887', outfit: '#8B0000' }
      };
      const color = npcColors[subType] || npcColors.farmer;
      ctx.save();
      ctx.translate(dir * 32 + 16, 16);
      drawIsometricCharacter(ctx, 32, 32, color.skin, color.outfit, 0);
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}
