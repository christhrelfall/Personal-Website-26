import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let mainFormation;
const clock = new THREE.Clock();
const activePaletteIndex = 0;
let pointer = new THREE.Vector2();
let isMouseActive = false;

const PARTICLE_COUNT_MAIN = 75000;
const CYLINDER_RADIUS = 15;
const FORMATION_RADIUS = 25;
const SHOCKWAVE_SPEED = 40.0;
const SHOCKWAVE_THICKNESS = 5.0;
const BLOOM_PARAMS = { strength: 0.02, radius: 0.1, threshold: 0.85 };
const MOUSE_REPEL_RADIUS = 8.0;
const MOUSE_REPEL_STRENGTH = 1.5;

const colorPalettes = [
  [ new THREE.Color(0x00adc7), new THREE.Color(0x0055ff), new THREE.Color(0x00d4ff), new THREE.Color(0x3b00c7), new THREE.Color(0xc7009f) ]
];

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 35, 0);
camera.lookAt(0, 0, 0);

const canvas = document.getElementById('particleCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.5;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.target.set(0, 0, 0);
controls.update();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), BLOOM_PARAMS.strength, BLOOM_PARAMS.radius, BLOOM_PARAMS.threshold);
composer.addPass(bloomPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

const raycaster = new THREE.Raycaster();
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const interactionPoint = new THREE.Vector3();
const mouseInteractionPoint = new THREE.Vector3();

const outerInteractionUniforms = {
  uOuterClickPos: { value: new THREE.Vector3(0, 0, 0) },
  uOuterClickTime: { value: -1000.0 },
  uWaveSpeed: { value: SHOCKWAVE_SPEED },
  uWaveThickness: { value: SHOCKWAVE_THICKNESS },
  uMousePos: { value: new THREE.Vector3(0, 0, 0) },
  uMouseActive: { value: 0.0 },
  uMouseRepelRadius: { value: MOUSE_REPEL_RADIUS },
  uMouseRepelStrength: { value: MOUSE_REPEL_STRENGTH }
};

const noiseFunctionsGLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy ); vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m; return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }
  float fbm(vec3 p, float time) {
    float value = 0.0; float amplitude = 0.5; float frequency = 0.8; int octaves = 3;
    for (int i = 0; i < octaves; i++) {
      value += amplitude * snoise(p * frequency + time * 0.10 * frequency);
      amplitude *= 0.5; frequency *= 2.0;
    } return value;
  }
`;

const _step = (edge, x) => new THREE.Vector3(
  x.x < edge.x ? 0.0 : 1.0, x.y < edge.y ? 0.0 : 1.0, x.z < edge.z ? 0.0 : 1.0
);
const _step4 = (edge, x) => new THREE.Vector4(
  x.x < edge.x ? 0.0 : 1.0, x.y < edge.y ? 0.0 : 1.0, x.z < edge.z ? 0.0 : 1.0, x.w < edge.w ? 0.0 : 1.0
);
const abs4 = (v) => new THREE.Vector4(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z), Math.abs(v.w));
const _mod289_3 = (x) => x.sub(x.clone().multiplyScalar(1.0 / 289.0).floor().multiplyScalar(289.0));
const _mod289_4 = (x) => x.sub(x.clone().multiplyScalar(1.0 / 289.0).floor().multiplyScalar(289.0));
const _permute_4 = (x) => _mod289_4(x.clone().multiplyScalar(34.0).addScalar(1.0).multiply(x));
const _taylorInvSqrt_4 = (r) => r.clone().multiplyScalar(-0.85373472095314).addScalar(1.79284291400159);
const _snoise_3 = (v) => {
  const C = new THREE.Vector2(1.0 / 6.0, 1.0 / 3.0); const D = new THREE.Vector4(0.0, 0.5, 1.0, 2.0);
  const v_dot_Cyyy = v.dot(new THREE.Vector3(C.y, C.y, C.y)); let i = v.clone().add(new THREE.Vector3(v_dot_Cyyy, v_dot_Cyyy, v_dot_Cyyy)).floor();
  const i_dot_Cxxx = i.dot(new THREE.Vector3(C.x, C.x, C.x)); let x0 = v.clone().sub(i).add(new THREE.Vector3(i_dot_Cxxx, i_dot_Cxxx, i_dot_Cxxx));
  let g = _step(x0.clone().set(x0.y, x0.z, x0.x), x0); let l = new THREE.Vector3(1.0, 1.0, 1.0).sub(g);
  let i1 = g.clone().min(l.clone().set(l.z, l.x, l.y)); let i2 = g.clone().max(l.clone().set(l.z, l.x, l.y));
  let x1 = x0.clone().sub(i1).addScalar(C.x); let x2 = x0.clone().sub(i2).addScalar(C.y); let x3 = x0.clone().subScalar(D.y);
  i = _mod289_3(i);
  let p = _permute_4(_permute_4(_permute_4(new THREE.Vector4(0.0, i1.z, i2.z, 1.0).addScalar(i.z)).add(new THREE.Vector4(0.0, i1.y, i2.y, 1.0).addScalar(i.y))).add(new THREE.Vector4(0.0, i1.x, i2.x, 1.0).addScalar(i.x)));
  let n_ = 0.142857142857; let nsVec = new THREE.Vector3(D.w, D.y, D.z); let ns = nsVec.clone().multiplyScalar(n_).sub(new THREE.Vector3(D.x, D.z, D.x));
  let j = p.clone().sub(p.clone().multiplyScalar(ns.z * ns.z).floor().multiplyScalar(49.0));
  let x_ = j.clone().multiplyScalar(ns.z).floor(); let y_ = j.clone().sub(x_.clone().multiplyScalar(7.0)).floor();
  let x = x_.clone().multiplyScalar(ns.x).addScalar(ns.y); let y = y_.clone().multiplyScalar(ns.x).addScalar(ns.y);
  let h = new THREE.Vector4(1.0, 1.0, 1.0, 1.0).sub(abs4(x)).sub(abs4(y));
  let b0 = new THREE.Vector4(x.x, x.y, y.x, y.y); let b1 = new THREE.Vector4(x.z, x.w, y.z, y.w);
  let s0 = b0.clone().floor().multiplyScalar(2.0).addScalar(1.0); let s1 = b1.clone().floor().multiplyScalar(2.0).addScalar(1.0);
  let sh = _step4(new THREE.Vector4(0.0, 0.0, 0.0, 0.0), h).multiplyScalar(-1.0);
  let a0 = b0.clone().set(b0.x, b0.z, b0.y, b0.w).add(s0.clone().set(s0.x, s0.z, s0.y, s0.w).multiply(sh.clone().set(sh.x, sh.x, sh.y, sh.y)));
  let a1 = b1.clone().set(b1.x, b1.z, b1.y, b1.w).add(s1.clone().set(s1.x, s1.z, s1.y, s1.w).multiply(sh.clone().set(sh.z, sh.z, sh.w, sh.w)));
  let p0 = new THREE.Vector3(a0.x, a0.y, h.x); let p1 = new THREE.Vector3(a0.z, a0.w, h.y); let p2 = new THREE.Vector3(a1.x, a1.y, h.z); let p3 = new THREE.Vector3(a1.z, a1.w, h.w);
  let norm = _taylorInvSqrt_4(new THREE.Vector4(p0.dot(p0), p1.dot(p1), p2.dot(p2), p3.dot(p3)));
  p0.multiplyScalar(norm.x); p1.multiplyScalar(norm.y); p2.multiplyScalar(norm.z); p3.multiplyScalar(norm.w);
  let m = new THREE.Vector4(x0.dot(x0), x1.dot(x1), x2.dot(x2), x3.dot(x3)).multiplyScalar(-1.0).addScalar(0.6).max(new THREE.Vector4(0.0, 0.0, 0.0, 0.0));
  m.multiply(m);
  return 42.0 * m.dot(new THREE.Vector4(p0.dot(x0), p1.dot(x1), p2.dot(x2), p3.dot(x3)));
};
const _fbm_3 = (p) => {
  let value = 0.0; let amplitude = 0.5; let frequency = 0.8; const octaves = 3;
  for (let i = 0; i < octaves; i++) { value += amplitude * _snoise_3(p.clone().multiplyScalar(frequency)); amplitude *= 0.5; frequency *= 2.0; }
  return value;
};

const particleShader = {
  vertexShader: `
    attribute float size;
    attribute float originalHue;
    varying vec3 vColor;
    varying float vDistance;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vWaveFactor;
    varying float vOriginalHue;

    uniform float time;
    uniform vec3 uOuterClickPos;
    uniform float uOuterClickTime;
    uniform float uWaveSpeed;
    uniform float uWaveThickness;
    uniform vec3 uMousePos;
    uniform float uMouseActive;
    uniform float uMouseRepelRadius;
    uniform float uMouseRepelStrength;

    ${noiseFunctionsGLSL}

    void main() {
      vColor = color;
      vNormal = normal;
      vWaveFactor = 0.0;
      vOriginalHue = originalHue;

      vec3 pos = position;
      float t = time;

      float noiseScale = 0.4;
      float noiseStrength = 1.2;
      float displacement = fbm(position * noiseScale * 0.1, t * 0.3) * noiseStrength;
      vec3 animatedModulation = vNormal * displacement;

      vec3 shockwavePushForce = vec3(0.0);
      float shockwaveSizeIncrease = 0.0;
      if (uOuterClickTime > 0.0) {
        float timeSinceClick = t - uOuterClickTime;
        if(timeSinceClick >= 0.0 && timeSinceClick < 2.5) {
          float waveRadius = timeSinceClick * uWaveSpeed;
          vec4 worldPos4Base = modelMatrix * vec4(position, 1.0);
          vec3 worldPosBase = worldPos4Base.xyz / worldPos4Base.w;
          float distToClick = length(worldPosBase - uOuterClickPos);
          float waveProximity = abs(distToClick - waveRadius);
          vWaveFactor = smoothstep(uWaveThickness, 0.0, waveProximity);
          if (vWaveFactor > 0.0) {
            float shockwaveStrength = 7.0;
            vec3 pushDir = normalize(worldPosBase - uOuterClickPos);
            if (length(pushDir) < 0.001) { pushDir = vNormal; }
            shockwavePushForce = pushDir * vWaveFactor * shockwaveStrength;
            shockwaveSizeIncrease = vWaveFactor * 1.5;
          }
        }
      }

      vec3 mouseRepelForce = vec3(0.0);
      if (uMouseActive > 0.5) {
        vec4 worldPos4Current = modelMatrix * vec4(position + animatedModulation, 1.0);
        vec3 worldPosCurrent = worldPos4Current.xyz / worldPos4Current.w;
        vec3 diff = worldPosCurrent - uMousePos;
        float distToMouse = length(diff);
        if (distToMouse < uMouseRepelRadius) {
          float repelFactor = smoothstep(uMouseRepelRadius, 0.0, distToMouse);
          mouseRepelForce = normalize(diff) * repelFactor * uMouseRepelStrength;
        }
      }

      pos += animatedModulation + shockwavePushForce + mouseRepelForce;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vDistance = length(mvPosition.xyz);
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      float sizeModulation = size * (1.0 + sin(t * 2.5 + length(position) * 0.1) * 0.05);
      gl_PointSize = (sizeModulation + shockwaveSizeIncrease) * (900.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vDistance;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vWaveFactor;
    varying float vOriginalHue;
    uniform float time;
    uniform float uFormationRadius;

    vec3 gradientMix(vec3 c1, vec3 c2, vec3 c3, float t) {
      return mix(mix(c1, c2, smoothstep(0.0, 0.5, t)), mix(c2, c3, smoothstep(0.5, 1.0, t)), step(0.5, t));
    }

    void main() {
      vec2 uv = gl_PointCoord;
      vec2 cxy = 2.0 * uv - 1.0;
      float r2 = dot(cxy, cxy);
      if (r2 > 1.0) discard;
      float r = sqrt(r2);
      float glowFalloff = 0.15;
      float alpha = smoothstep(glowFalloff, 0.0, r);

      vec3 baseColor = vColor;

      if (vWaveFactor > 0.0) {
        vec3 fieryColor1 = vec3(0.0, 0.5, 0.55);
        vec3 fieryColor2 = vec3(0.0, 0.35, 0.4);
        vec3 fieryColor3 = vec3(0.0, 0.2, 0.25);
        float gradientT = vWaveFactor;
        vec3 fieryColor = gradientMix(fieryColor3, fieryColor2, fieryColor1, gradientT);
        baseColor = mix(baseColor, fieryColor, vWaveFactor * 0.85);
        baseColor *= (1.0 + vWaveFactor * 1.5);
      }

      float distanceFade = smoothstep(uFormationRadius * 1.8, uFormationRadius * 0.9, vDistance);
      alpha *= distanceFade;
      baseColor = clamp(baseColor, 0.0, 1.0);

      gl_FragColor = vec4(baseColor, alpha);
    }
  `
};

function createParticleSystem(count, radius, creationFunc, isOuterLayer = false) {
  const geometry = creationFunc(count, radius, colorPalettes[activePaletteIndex]);
  if (!geometry || !geometry.attributes.position || geometry.attributes.position.count === 0) {
    console.error("Geometry creation failed or resulted in empty geometry.");
    return null;
  }
  let materialUniforms = { time: { value: 0 } };
  if (isOuterLayer) {
    materialUniforms = {
      ...materialUniforms,
      ...THREE.UniformsUtils.clone(outerInteractionUniforms),
      uFormationRadius: { value: FORMATION_RADIUS },
      uMousePos: outerInteractionUniforms.uMousePos,
      uMouseActive: outerInteractionUniforms.uMouseActive,
      uMouseRepelRadius: outerInteractionUniforms.uMouseRepelRadius,
      uMouseRepelStrength: outerInteractionUniforms.uMouseRepelStrength
    };
  }
  const material = new THREE.ShaderMaterial({
    uniforms: materialUniforms,
    vertexShader: particleShader.vertexShader,
    fragmentShader: particleShader.fragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geometry, material);
}

function createCylinderGeometry(particleCount, cylinderRadius, palette) {
  const geometry = new THREE.BufferGeometry();
  const positions = []; const colors = []; const sizes = []; const normals = []; const originalHues = [];
  const tempPos = new THREE.Vector3(); const normal = new THREE.Vector3();
  const tempColor = new THREE.Color();
  const baseHSL = {};
  const cylinderHeight = 30;
  const displacementStrength = 3.0;
  for (let i = 0; i < particleCount; i++) {
    const phi = Math.random() * Math.PI * 2;
    const h = (Math.random() - 0.5) * cylinderHeight;
    const x = cylinderRadius * Math.cos(phi);
    const z = cylinderRadius * Math.sin(phi);
    const y = h;
    tempPos.set(x, y, z);
    normal.set(x, 0, z).normalize();
    const noiseInput = tempPos.clone().multiplyScalar(1.0 / cylinderRadius * 1.2);
    const displacement = _fbm_3(noiseInput) * displacementStrength;
    tempPos.addScaledVector(normal, displacement);
    positions.push(tempPos.x, tempPos.y, tempPos.z);
    normals.push(normal.x, normal.y, normal.z);
    const hueProgress = (phi / (Math.PI * 2)) % 1.0;
    const c1Index = Math.floor(hueProgress * (palette.length - 1));
    const c2Index = Math.min(c1Index + 1, palette.length - 1);
    tempColor.lerpColors(palette[c1Index], palette[c2Index], (hueProgress * (palette.length - 1)) % 1);
    tempColor.getHSL(baseHSL);
    originalHues.push(baseHSL.h);
    tempColor.offsetHSL(Math.random() * 0.02 - 0.01, Math.random() * 0.05 - 0.02, Math.random() * 0.05 - 0.02);
    colors.push(tempColor.r, tempColor.g, tempColor.b);
    const sizeFactor = 1.0 - Math.abs(displacement) / (displacementStrength + 1e-6);
    sizes.push(Math.max(0.3, sizeFactor) * (Math.random() * 0.4 + 0.7));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('originalHue', new THREE.Float32BufferAttribute(originalHues, 1));
  return geometry;
}

mainFormation = createParticleSystem(PARTICLE_COUNT_MAIN, CYLINDER_RADIUS, createCylinderGeometry, true);
if (mainFormation) scene.add(mainFormation);

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = clock.getDelta();

  if (isMouseActive && mainFormation?.material?.uniforms?.uMousePos) {
    interactionPlane.normal.copy(camera.position).normalize();
    interactionPlane.constant = 0;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, mouseInteractionPoint)) {
      outerInteractionUniforms.uMousePos.value.copy(mouseInteractionPoint);
    }
    outerInteractionUniforms.uMouseActive.value = 1.0;
  } else if (mainFormation?.material?.uniforms?.uMouseActive) {
    outerInteractionUniforms.uMouseActive.value = 0.0;
  }

  if (mainFormation?.material?.uniforms?.time) mainFormation.material.uniforms.time.value = elapsedTime;

  if (mainFormation?.geometry) {
    mainFormation.rotation.y += 0.0003;
    mainFormation.rotation.x += 0.0005;
    mainFormation.rotation.z -= 0.0002;
  }

  controls.update();
  composer.render(deltaTime);
}

function triggerShockwave(clientX, clientY) {
  if (!mainFormation?.material?.uniforms?.uOuterClickPos) return;
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  interactionPlane.normal.copy(camera.position).normalize();
  interactionPlane.constant = 0;
  if (raycaster.ray.intersectPlane(interactionPlane, interactionPoint)) {
    const currentTime = clock.getElapsedTime();
    mainFormation.material.uniforms.uOuterClickPos.value.copy(interactionPoint);
    mainFormation.material.uniforms.uOuterClickTime.value = currentTime;
  }
}

function onMouseMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  isMouseActive = true;
}

function onMouseLeave() { isMouseActive = false; }

function onMouseClick(event) {
  if (event.target.closest('#instructions-container')) return;
  triggerShockwave(event.clientX, event.clientY);
}

function onTouchStart(event) {
  if (event.target.closest('#instructions-container')) return;
  event.preventDefault();
  if (event.touches.length > 0) triggerShockwave(event.touches[0].clientX, event.touches[0].clientY);
}

function onWindowResize() {
  const width = window.innerWidth; const height = window.innerHeight;
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height); composer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}

window.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseleave', onMouseLeave);
window.addEventListener('click', onMouseClick);
window.addEventListener('touchstart', onTouchStart, { passive: false });
window.addEventListener('resize', onWindowResize);

animate();
