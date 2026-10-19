import * as THREE from 'three';
import { HOME_STYLE } from './style-palette';

// The texture covers 1.60 × 2.40 m: 200 mm boards with staggered 1.20 m ends.
// A warm medium-brown wood-look tile, paired with natural oak furniture.
export const FLOOR_TILE_WIDTH = 1.6;
export const FLOOR_TILE_LENGTH = 2.4;

export function createOakFloorMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const floorContext = canvas.getContext('2d')!;
  const boardWidth = canvas.width / 8;
  const boardLength = canvas.height / 2;
  let seed = 1867;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Only gentle board-to-board changes; seams and grain never become dark stripes.
  for (let column = 0; column < 8; column++) {
    const offset = [0, .5, .25, .75, .25, .75, 0, .5][column] * boardLength;
    for (let row = 0; row < 2; row++) {
      const board = document.createElement('canvas');
      board.width = boardWidth;
      board.height = boardLength;
      const ctx = board.getContext('2d')!;
      const x = 0;
      const y = 0;
      const tone = (random() - .5) * 6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, boardWidth, boardLength);
      ctx.clip();
      const { red, green, blue } = HOME_STYLE.floor;
      ctx.fillStyle = `rgb(${red + tone},${green + tone},${blue + tone})`;
      ctx.fillRect(x, y, boardWidth, boardLength);

      // Broad, feathered variations give the oak depth without a printed pinstripe look.
      const wash = ctx.createLinearGradient(x, y, x + boardWidth, y);
      wash.addColorStop(0, 'rgba(255,245,224,.045)');
      wash.addColorStop(.32, 'rgba(135,97,56,.025)');
      wash.addColorStop(.72, 'rgba(255,245,224,.055)');
      wash.addColorStop(1, 'rgba(135,97,56,.018)');
      ctx.fillStyle = wash;
      ctx.fillRect(x, y, boardWidth, boardLength);

      const phase = random() * Math.PI * 2;
      const bend = 2 + random() * 5;
      for (let line = 0; line < 35; line++) {
        const start = x + random() * boardWidth;
        const brightness = line % 3 === 0;
        ctx.strokeStyle = brightness
          ? `rgba(255,249,231,${.035 + random() * .045})`
          : `rgba(102,84,60,${.025 + random() * .035})`;
        ctx.lineWidth = .55 + random() * 1.25;
        ctx.beginPath();
        for (let step = 0; step <= 32; step++) {
          const t = step / 32;
          const gx = start + Math.sin(t * 6 + phase) * bend
            + Math.sin(t * 13 + phase) * 1.1;
          const gy = y + t * boardLength;
          if (step === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
      }

      // Some planks have the open, elongated arches characteristic of oak grain.
      if (random() > .36) {
        const centerX = x + boardWidth * (.28 + random() * .44);
        const centerY = y + boardLength * (.2 + random() * .6);
        for (let ring = 0; ring < 9; ring++) {
          const width = 6 + ring * 3.5;
          const length = 140 + ring * 38;
          ctx.strokeStyle = `rgba(115,94,67,${.04 - ring * .002})`;
          ctx.lineWidth = .7;
          ctx.beginPath();
          ctx.moveTo(centerX - width, centerY + length);
          ctx.bezierCurveTo(
            centerX - width * .8, centerY - length * .15,
            centerX, centerY - length,
            centerX + width, centerY + length,
          );
          ctx.stroke();
        }
      }

      ctx.strokeStyle = 'rgba(109,94,75,.16)';
      ctx.lineWidth = .9;
      ctx.strokeRect(x + .45, y + .45, boardWidth - .9, boardLength - .9);
      ctx.strokeStyle = 'rgba(255,249,235,.20)';
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.moveTo(x + 1.3, y + boardLength);
      ctx.lineTo(x + 1.3, y + 1.3);
      ctx.lineTo(x + boardWidth, y + 1.3);
      ctx.stroke();
      ctx.restore();
      // Wrap the same complete board at the texture boundary so grain and tone
      // continue across repeats, including columns with staggered end joints.
      for (const wrap of [-canvas.height, 0, canvas.height]) {
        floorContext.drawImage(board, column * boardWidth, row * boardLength + offset + wrap);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // A separate linear texture keeps the relief much subtler than the color pattern.
  const bumpMap = new THREE.CanvasTexture(canvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 8;

  return new THREE.MeshStandardMaterial({
    name: '暖棕木色柔光木纹砖 · 200 × 1200 mm 概念规格',
    color: '#ffffff',
    map,
    bumpMap,
    bumpScale: .00065,
    roughness: .78,
    metalness: 0,
  });
}
