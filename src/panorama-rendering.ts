import * as THREE from 'three';

// Limit the longer screen dimension, rather than a fixed vertical angle that
// becomes an extreme wide-angle lens on desktop and ultrawide displays.
export const panoramaView = {
  defaultFov: 86,
  minFov: 60,
  maxFov: 90,
  poleLimit: 85,
  maxPixelRatio: 2,
  maxPixels: 8_000_000,
  sharpness: 0.15,
};

export function verticalFov(longEdgeFov: number, aspect: number) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(
    Math.tan(THREE.MathUtils.degToRad(longEdgeFov) / 2) / Math.max(aspect, 1),
  ));
}

export function panoramaPixelRatio(width: number, height: number, deviceRatio: number) {
  return Math.min(deviceRatio || 1, panoramaView.maxPixelRatio,
    Math.sqrt(panoramaView.maxPixels / Math.max(1, width * height)));
}

export function createPanoramaMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const texelSize = { value: new THREE.Vector2(1, 1) };

  // Catmull–Rom uses a 4 × 4 texel neighbourhood. Only its middle two
  // weights are positive, so combine those with bilinear sampling; the
  // negative outer weights remain separate. This gives the exact separable
  // cubic reconstruction in nine fetches, before the anti-ringing clamp.
  // Derivation / reference: https://gist.github.com/TheRealMJP/c83b8c0f46b63f3a88a5986f4fa982b1
  // Reconstruct only magnified images; leave Three's mipmap/anisotropic path
  // untouched when even one projected texture direction is minified.
  material.onBeforeCompile = shader => {
    shader.uniforms.panoramaTexelSize = texelSize;
    shader.uniforms.panoramaSharpness = { value: panoramaView.sharpness };
    shader.fragmentShader = `uniform vec2 panoramaTexelSize;
uniform float panoramaSharpness;
#if defined(USE_MAP) && !defined(DECODE_VIDEO_TEXTURE)
vec4 panoramaBicubic(sampler2D image, vec2 uv, out vec4 rangeMin, out vec4 rangeMax) {
  vec2 texelPosition = uv / panoramaTexelSize - 0.5;
  vec2 cell = floor(texelPosition);
  vec2 t = texelPosition - cell;
  vec2 t2 = t * t;
  vec2 t3 = t2 * t;
  vec2 outerBefore = -0.5 * t * (t - 1.0) * (t - 1.0);
  vec2 innerBefore = 1.0 - 2.5 * t2 + 1.5 * t3;
  vec2 innerAfter = 0.5 * t + 2.0 * t2 - 1.5 * t3;
  vec2 outerAfter = 0.5 * t2 * (t - 1.0);
  vec2 innerWeight = innerBefore + innerAfter;
  vec2 middle = cell + 0.5 + innerAfter / innerWeight;
  vec3 positionsX = vec3(cell.x - 0.5, middle.x, cell.x + 2.5) * panoramaTexelSize.x;
  vec3 positionsY = vec3(cell.y - 0.5, middle.y, cell.y + 2.5) * panoramaTexelSize.y;
  vec3 weightsX = vec3(outerBefore.x, innerWeight.x, outerAfter.x);
  vec3 weightsY = vec3(outerBefore.y, innerWeight.y, outerAfter.y);
  vec4 reconstructed = vec4(0.0);
  rangeMin = vec4(1.0e20);
  rangeMax = vec4(-1.0e20);
  for (int row = 0; row < 3; row++) {
    for (int column = 0; column < 3; column++) {
      // U repeats across the panorama seam; T extends the pole edge texel.
      // Explicit level zero is necessary: offset taps must share one LOD,
      // rather than acquiring inconsistent implicit derivatives.
      vec2 sampleUv = vec2(positionsX[column], clamp(positionsY[row],
        0.5 * panoramaTexelSize.y, 1.0 - 0.5 * panoramaTexelSize.y));
      vec4 sampleColor = textureLod(image, sampleUv, 0.0);
      reconstructed += sampleColor * weightsX[column] * weightsY[row];
      rangeMin = min(rangeMin, sampleColor);
      rangeMax = max(rangeMax, sampleColor);
    }
  }
  // The cubic's negative lobes can ring around high-contrast objects. Keep
  // the result inside the sampled neighbourhood's actual channel range.
  return clamp(reconstructed, rangeMin, rangeMax);
}
#endif
${shader.fragmentShader}`;
    const mapFragment = THREE.ShaderChunk.map_fragment.replace(
      'diffuseColor *= sampledDiffuseColor;',
      `#ifndef DECODE_VIDEO_TEXTURE
      vec2 derivativeX = dFdx(vMapUv) / panoramaTexelSize;
      vec2 derivativeY = dFdy(vMapUv) / panoramaTexelSize;
      float axisX = dot(derivativeX, derivativeX);
      float crossAxis = dot(derivativeX, derivativeY);
      float axisY = dot(derivativeY, derivativeY);
      // Largest singular value of the screen-to-texel Jacobian. Testing
      // only individual derivative components misses diagonal minification.
      float footprint = sqrt(0.5 * (axisX + axisY + sqrt(
        (axisX - axisY) * (axisX - axisY) + 4.0 * crossAxis * crossAxis)));
      if (footprint < 1.0) {
        vec4 rangeMin, rangeMax;
        vec4 reconstructed = panoramaBicubic(map, vMapUv, rangeMin, rangeMax);
        vec3 correction = clamp(reconstructed.rgb - sampledDiffuseColor.rgb,
          vec3(-0.025), vec3(0.025));
        reconstructed.rgb = clamp(reconstructed.rgb + correction * panoramaSharpness,
          rangeMin.rgb, rangeMax.rgb);
        float magnified = 1.0 - smoothstep(0.7, 1.0, footprint);
        sampledDiffuseColor = mix(sampledDiffuseColor, reconstructed, magnified);
      }
      #endif
      diffuseColor *= sampledDiffuseColor;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment);
  };
  material.customProgramCacheKey = () => 'panorama-clarity-bicubic-v2';
  return { material, texelSize };
}
