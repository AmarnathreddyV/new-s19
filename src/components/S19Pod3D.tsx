import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface S19Pod3DProps {
  state?: 'IXX IS LISTENING' | 'IXX IS SPEAKING' | 'IXX IS THINKING' | 'IXX IS READY' | 'IXX IS CONNECTING' | 'OFFLINE';
  speechLevel?: number;
  interactive?: boolean;
  className?: string;
  onModelLoaded?: () => void;
}

/**
 * Creates the high-fidelity procedural 3D S.19 Pod model matching:
 * - Glossy white aerodynamic egg/ellipsoid body
 * - Characteristic forward-curving upward swan-neck tail fin
 * - Dark transparent bubble canopy with polished chrome rim
 * - Quilted cream/ivory luxury seat inside cockpit
 * - Small chrome cocktail table
 * - Front interior dashboard with glowing amber/gold acoustic audio waveform
 * - Thin glowing orange illuminated perimeter stripe around lower hull
 */
function buildProceduralS19Pod(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'S19_Pod_Procedural';

  // -------------------------------------------------------------
  // 1. MATERIALS (High-End Automotive Studio PBR)
  // -------------------------------------------------------------
  const hullMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xfcfcfa,
    metalness: 0.02,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8dee6,
    metalness: 0.98,
    roughness: 0.08,
  });

  const orangeStripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7b00,
    emissive: 0xff6200,
    emissiveIntensity: 2.8,
    roughness: 0.2,
  });

  const canopyGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x161a22,
    transmission: 0.88,
    opacity: 0.50,
    transparent: true,
    roughness: 0.06,
    ior: 1.52,
    thickness: 0.45,
    specularIntensity: 1.2,
    depthWrite: false,
  });

  const creamSeatMaterial = new THREE.MeshStandardMaterial({
    color: 0xede6dc,
    roughness: 0.42,
    metalness: 0.02,
  });

  const interiorTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    roughness: 0.55,
    metalness: 0.1,
  });

  const waveformMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9926,
  });

  // -------------------------------------------------------------
  // 2. MAIN HULL (Aerodynamic Smooth Egg Hull)
  // -------------------------------------------------------------
  const hullGeo = new THREE.SphereGeometry(1, 96, 72);
  const posAttr = hullGeo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);

    // Coordinate mapping:
    // +Z is the forward nose (rounded, slightly lower)
    // -Z is the rear tail (sweeps up to meet dorsal fin)
    // X is lateral width
    // Y is vertical height
    const origX = v.x;
    const origY = v.y;
    const origZ = v.z;

    // Aerodynamic length along Z: [-1.22 to +1.15]
    let z = origZ * 1.18;

    // Width tapering along Z (wider in middle-front, tapering slightly at nose and tail)
    const zNorm = origZ; // [-1 to 1]
    const widthFactor = 0.82 * (1.0 - 0.14 * zNorm * zNorm + 0.05 * zNorm);
    let x = origX * widthFactor;

    // Height & aerodynamic underbelly curvature
    let y: number;
    if (origY < 0) {
      // Underbelly: smooth rounded saucer curve with slight flatter bottom
      y = origY * 0.52 - 0.05 * (1.0 - origZ * origZ);
    } else {
      // Upper deck: aerodynamic dome with slope down towards nose
      const noseDip = 0.08 * Math.max(0, zNorm);
      y = origY * 0.64 - noseDip;
    }

    // Rear dorsal spine elevation to blend smoothly into tail fin
    if (origZ < -0.4 && origY > 0) {
      const spineBlend = Math.pow((-origZ - 0.4) / 0.6, 1.8);
      y += 0.16 * spineBlend * (1.0 - Math.min(1, Math.abs(origX) * 3));
    }

    posAttr.setXYZ(i, x, y, z);
  }
  hullGeo.computeVertexNormals();

  const hullMesh = new THREE.Mesh(hullGeo, hullMaterial);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  root.add(hullMesh);

  // -------------------------------------------------------------
  // 3. THIN ORANGE/GOLD ILLUMINATED PERIMETER STRIPE
  // -------------------------------------------------------------
  // A glowing continuous horizontal ring hugging the lower body at y ≈ -0.22
  const stripePoints: THREE.Vector3[] = [];
  const stripeSegments = 96;
  for (let i = 0; i <= stripeSegments; i++) {
    const theta = (i / stripeSegments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const z = sinT * 1.16;
    const zNorm = sinT;
    const widthFactor = 0.835 * (1.0 - 0.14 * zNorm * zNorm + 0.05 * zNorm);
    const x = cosT * widthFactor;
    const y = -0.21 + 0.02 * sinT;

    stripePoints.push(new THREE.Vector3(x, y, z));
  }
  const stripeCurve = new THREE.CatmullRomCurve3(stripePoints, true);
  const stripeGeo = new THREE.TubeGeometry(stripeCurve, 96, 0.012, 12, true);
  const stripeMesh = new THREE.Mesh(stripeGeo, orangeStripeMaterial);
  root.add(stripeMesh);

  // -------------------------------------------------------------
  // 4. SIGNATURE FORWARD-ARCHING REAR FIN / TAIL
  // -------------------------------------------------------------
  // Distinctive cresting curve: sweeps up from rear dorsal and hooks forward
  const tailSpinePoints = [
    new THREE.Vector3(0, 0.22, -0.70),
    new THREE.Vector3(0, 0.42, -0.80),
    new THREE.Vector3(0, 0.68, -0.88),
    new THREE.Vector3(0, 0.96, -0.85),
    new THREE.Vector3(0, 1.20, -0.72),
    new THREE.Vector3(0, 1.34, -0.52),
    new THREE.Vector3(0, 1.31, -0.34),
    new THREE.Vector3(0, 1.22, -0.25),
  ];

  // Custom tapered lofted geometry along the curve
  const tailSteps = 36;
  const radialSteps = 24;
  const tailCurve = new THREE.CatmullRomCurve3(tailSpinePoints);
  const tailVertices: number[] = [];
  const tailIndices: number[] = [];
  const tailUvs: number[] = [];

  for (let i = 0; i <= tailSteps; i++) {
    const t = i / tailSteps;
    const pt = tailCurve.getPointAt(t);
    const tangent = tailCurve.getTangentAt(t).normalize();

    // Normal and binormal vectors for cross-section
    const up = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (binormal.lengthSq() < 0.001) {
      binormal.set(1, 0, 0);
    }
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    // Tapering: broad blended aerodynamic base tapering to elegant slender tip
    const lateralRadius = (0.13 * (1.0 - t * 0.85) + 0.02);
    const depthRadius = (0.18 * (1.0 - t * 0.80) + 0.025);

    for (let j = 0; j <= radialSteps; j++) {
      const angle = (j / radialSteps) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Elliptical cross section
      const offsetX = binormal.x * (cosA * lateralRadius) + normal.x * (sinA * depthRadius);
      const offsetY = binormal.y * (cosA * lateralRadius) + normal.y * (sinA * depthRadius);
      const offsetZ = binormal.z * (cosA * lateralRadius) + normal.z * (sinA * depthRadius);

      tailVertices.push(pt.x + offsetX, pt.y + offsetY, pt.z + offsetZ);
      tailUvs.push(j / radialSteps, t);
    }
  }

  for (let i = 0; i < tailSteps; i++) {
    for (let j = 0; j < radialSteps; j++) {
      const a = i * (radialSteps + 1) + j;
      const b = (i + 1) * (radialSteps + 1) + j;
      const c = (i + 1) * (radialSteps + 1) + (j + 1);
      const d = i * (radialSteps + 1) + (j + 1);

      tailIndices.push(a, b, d);
      tailIndices.push(b, c, d);
    }
  }

  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tailVertices, 3));
  tailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tailUvs, 2));
  tailGeo.setIndex(tailIndices);
  tailGeo.computeVertexNormals();

  const tailMesh = new THREE.Mesh(tailGeo, hullMaterial);
  tailMesh.castShadow = true;
  root.add(tailMesh);

  // Rounded tip cap
  const tipPt = tailSpinePoints[tailSpinePoints.length - 1];
  const tipCapGeo = new THREE.SphereGeometry(0.024, 16, 12);
  const tipCapMesh = new THREE.Mesh(tipCapGeo, hullMaterial);
  tipCapMesh.position.copy(tipPt);
  root.add(tipCapMesh);

  // -------------------------------------------------------------
  // 5. COCKPIT INTERIOR & SEAT
  // -------------------------------------------------------------
  const cockpitGroup = new THREE.Group();
  cockpitGroup.name = 'Cockpit';

  // Interior floor tub
  const tubGeo = new THREE.BoxGeometry(0.85, 0.15, 1.1);
  const tubMesh = new THREE.Mesh(tubGeo, interiorTrimMaterial);
  tubMesh.position.set(0, 0.02, 0.15);
  cockpitGroup.add(tubMesh);

  // Luxury Cream Contoured Seat (Vertical channel-quilted luxury bucket seat)
  const seatGroup = new THREE.Group();
  seatGroup.name = 'LuxurySeat';
  seatGroup.position.set(0, 0.08, -0.05);
  seatGroup.rotation.x = -0.30; // ~17° recline

  // Seat Base Cushion
  const seatBaseGeo = new THREE.BoxGeometry(0.44, 0.12, 0.42);
  const seatBaseMesh = new THREE.Mesh(seatBaseGeo, creamSeatMaterial);
  seatBaseMesh.position.set(0, 0.06, 0.12);
  seatGroup.add(seatBaseMesh);

  // Backrest (contoured with side bolsters)
  const backrestGeo = new THREE.BoxGeometry(0.42, 0.58, 0.10);
  const backrestMesh = new THREE.Mesh(backrestGeo, creamSeatMaterial);
  backrestMesh.position.set(0, 0.35, -0.08);
  seatGroup.add(backrestMesh);

  // Quilted Vertical Seam Channels on backrest
  for (let s = -2; s <= 2; s++) {
    const stitchGeo = new THREE.BoxGeometry(0.015, 0.46, 0.012);
    const stitchMat = new THREE.MeshStandardMaterial({
      color: 0xd4cbbd,
      roughness: 0.6,
    });
    const stitch = new THREE.Mesh(stitchGeo, stitchMat);
    stitch.position.set(s * 0.07, 0.35, -0.03);
    seatGroup.add(stitch);
  }

  // Rounded Headrest
  const headrestGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.24, 24);
  headrestGeo.rotateZ(Math.PI / 2);
  const headrestMesh = new THREE.Mesh(headrestGeo, creamSeatMaterial);
  headrestMesh.position.set(0, 0.66, -0.10);
  seatGroup.add(headrestMesh);

  cockpitGroup.add(seatGroup);

  // Small Chrome Pedestal Drink Table (Right Console)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0.26, 0.12, 0.16);

  const tableStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.20, 16);
  const tableStem = new THREE.Mesh(tableStemGeo, chromeMaterial);
  tableStem.position.y = 0.10;
  tableGroup.add(tableStem);

  const tableTopGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.014, 24);
  const tableTop = new THREE.Mesh(tableTopGeo, chromeMaterial);
  tableTop.position.y = 0.20;
  tableGroup.add(tableTop);

  cockpitGroup.add(tableGroup);

  // Front Dashboard Shelf
  const dashGeo = new THREE.BoxGeometry(0.68, 0.08, 0.32);
  const dashMesh = new THREE.Mesh(dashGeo, interiorTrimMaterial);
  dashMesh.position.set(0, 0.12, 0.58);
  cockpitGroup.add(dashMesh);

  // Glowing Amber/Gold Acoustic Waveform on Front Dash
  const waveformGroup = new THREE.Group();
  waveformGroup.name = 'WaveformEqualizer';
  waveformGroup.position.set(0, 0.17, 0.58);

  const barCount = 19;
  for (let b = 0; b < barCount; b++) {
    const normalizedIndex = (b - (barCount - 1) / 2) / ((barCount - 1) / 2);
    // Diamond / bell-curve frequency distribution
    const height = Math.max(0.015, (1.0 - Math.abs(normalizedIndex)) * 0.08);
    const barGeo = new THREE.BoxGeometry(0.012, height, 0.01);
    const barMesh = new THREE.Mesh(barGeo, waveformMaterial);
    barMesh.position.set(normalizedIndex * 0.22, height / 2, 0);
    waveformGroup.add(barMesh);
  }
  cockpitGroup.add(waveformGroup);

  root.add(cockpitGroup);

  // -------------------------------------------------------------
  // 6. CHROME CANOPY BEZEL / RIM
  // -------------------------------------------------------------
  // Tilted elliptical chrome trim framing the cockpit cutout
  const rimGroup = new THREE.Group();
  rimGroup.position.set(0, 0.24, 0.15);
  rimGroup.rotation.x = -0.32; // Incline angle ~18° forward

  const rimPoints: THREE.Vector3[] = [];
  const rimSteps = 64;
  for (let i = 0; i <= rimSteps; i++) {
    const angle = (i / rimSteps) * Math.PI * 2;
    const rx = 0.46;
    const rz = 0.62;
    rimPoints.push(new THREE.Vector3(Math.cos(angle) * rx, 0, Math.sin(angle) * rz));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPoints, true);
  const rimGeo = new THREE.TubeGeometry(rimCurve, 64, 0.038, 16, true);
  const rimMesh = new THREE.Mesh(rimGeo, chromeMaterial);
  rimGroup.add(rimMesh);

  // Inner chrome reflector lip
  const innerLipGeo = new THREE.TubeGeometry(rimCurve, 64, 0.018, 12, true);
  const innerLipMesh = new THREE.Mesh(innerLipGeo, chromeMaterial);
  innerLipMesh.scale.set(0.97, 0.97, 0.97);
  rimGroup.add(innerLipMesh);

  root.add(rimGroup);

  // -------------------------------------------------------------
  // 7. DARK TRANSPARENT CANOPY GLASS BUBBLE
  // -------------------------------------------------------------
  const glassGroup = new THREE.Group();
  glassGroup.position.set(0, 0.24, 0.15);
  glassGroup.rotation.x = -0.32;

  // Upper dome bubble
  const glassGeo = new THREE.SphereGeometry(1, 64, 36, 0, Math.PI * 2, 0, Math.PI / 2);
  const glassPos = glassGeo.attributes.position;
  const gv = new THREE.Vector3();
  for (let i = 0; i < glassPos.count; i++) {
    gv.fromBufferAttribute(glassPos, i);
    // Scale into elongated aerodynamic dome fitting inside the chrome rim
    const gx = gv.x * 0.44;
    const gy = gv.y * 0.38;
    const gz = gv.z * 0.60;
    glassPos.setXYZ(i, gx, gy, gz);
  }
  glassGeo.computeVertexNormals();

  const glassMesh = new THREE.Mesh(glassGeo, canopyGlassMaterial);
  glassGroup.add(glassMesh);

  root.add(glassGroup);

  return root;
}

/**
 * Creates soft realistic radial floor contact shadow plane
 */
function createContactShadow(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(23, 23, 21, 0.45)');
  gradient.addColorStop(0.35, 'rgba(23, 23, 21, 0.28)');
  gradient.addColorStop(0.70, 'rgba(23, 23, 21, 0.08)');
  gradient.addColorStop(1, 'rgba(23, 23, 21, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const shadowGeo = new THREE.PlaneGeometry(3.6, 4.4);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -1.15;
  shadowMesh.name = 'ContactShadow';

  return shadowMesh;
}

export const S19Pod3D: React.FC<S19Pod3DProps> = ({
  state = 'IXX IS LISTENING',
  speechLevel = 0,
  interactive = true,
  className = '',
  onModelLoaded,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // User interaction & animation state
  const isInteractingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const dragDeltaRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef(0);

  // Rotation & camera distance
  const currentRotationRef = useRef({ x: 0.15, y: -0.65 }); // initial 3/4 front view
  const targetRotationRef = useRef({ x: 0.15, y: -0.65 });
  const cameraDistanceRef = useRef(4.1);
  const targetCameraDistanceRef = useRef(4.1);
  const idleResumeTimerRef = useRef(0);

  // Audio reactivity ref
  const speechLevelRef = useRef(speechLevel);
  speechLevelRef.current = speechLevel;

  const stateRef = useRef(state);
  stateRef.current = state;

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // -------------------------------------------------------------
    // SCENE SETUP
    // -------------------------------------------------------------
    const scene = new THREE.Scene();

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 550;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(3.0, 1.25, 3.4);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // -------------------------------------------------------------
    // STUDIO LIGHTING RIG (Automotive Showroom Lighting)
    // -------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    // Key Light (Warm, high angle right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4.5, 7.5, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill Light (Cool tinted, soft side)
    const fillLight = new THREE.DirectionalLight(0xedf4fc, 1.1);
    fillLight.position.set(-5.5, 3.5, -2.5);
    scene.add(fillLight);

    // Rim Light (Sharp back highlight to outline glossy contours and fin)
    const rimLight = new THREE.DirectionalLight(0xfffbf2, 1.8);
    rimLight.position.set(-1.0, 6.0, -6.0);
    scene.add(rimLight);

    // Ground bounce light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdfd8ce, 0.85);
    scene.add(hemiLight);

    // -------------------------------------------------------------
    // CONTACT SHADOW
    // -------------------------------------------------------------
    const contactShadow = createContactShadow();
    scene.add(contactShadow);

    // -------------------------------------------------------------
    // POD CARRIER GROUP
    // -------------------------------------------------------------
    const podGroup = new THREE.Group();
    podGroup.name = 'S19_Pod_Group';
    scene.add(podGroup);

    // Waveform reference for audio reactivity
    let waveformMeshGroup: THREE.Group | null = null;

    // -------------------------------------------------------------
    // ATTEMPT TO LOAD /models/S19.glb (IF PROVIDED) OR USE PROCEDURAL
    // -------------------------------------------------------------
    const loader = new GLTFLoader();
    loader.load(
      '/models/S19.glb',
      (gltf) => {
        // User provided the exact custom GLB model!
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Normalize model size and center
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.4 / (maxDim || 1);
        model.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));

        podGroup.add(model);
        setIsLoading(false);
        if (onModelLoaded) onModelLoaded();
      },
      undefined,
      () => {
        // Fallback: Use our handcrafted procedural high-fidelity S.19 model
        const proceduralPod = buildProceduralS19Pod();
        podGroup.add(proceduralPod);

        // Find waveform group
        waveformMeshGroup = proceduralPod.getObjectByName('WaveformEqualizer') as THREE.Group;

        setIsLoading(false);
        if (onModelLoaded) onModelLoaded();
      }
    );

    // -------------------------------------------------------------
    // ANIMATION & MOTION LOOP
    // -------------------------------------------------------------
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const delta = clock.getDelta();

      // Check if user is actively interacting
      if (!isInteractingRef.current) {
        idleResumeTimerRef.current += 0.016;

        // Auto floating rotation: smooth continuous 360° turn (~24s per revolution)
        if (!prefersReducedMotion) {
          const autoRotateSpeed = (Math.PI * 2) / 24; // ~0.26 rad/s
          targetRotationRef.current.y += autoRotateSpeed * 0.016;
        }

        // Apply drag inertia decay
        dragDeltaRef.current.x *= 0.92;
        dragDeltaRef.current.y *= 0.92;
        targetRotationRef.current.y += dragDeltaRef.current.x * 0.01;
        targetRotationRef.current.x += dragDeltaRef.current.y * 0.01;
      } else {
        idleResumeTimerRef.current = 0;
      }

      // Clamp vertical pitch tilt to avoid camera flip
      targetRotationRef.current.x = Math.max(-0.45, Math.min(0.65, targetRotationRef.current.x));

      // Smooth interpolation (lerp) for rotation
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

      // Smooth zoom lerp
      cameraDistanceRef.current += (targetCameraDistanceRef.current - cameraDistanceRef.current) * 0.08;

      // Gentle floating hover wave (from reference video: slow, subtle, organic)
      const floatY = prefersReducedMotion ? 0 : Math.sin(elapsedTime * 1.55) * 0.072;
      const pitchBreathing = prefersReducedMotion ? 0 : Math.sin(elapsedTime * 0.95) * 0.022;
      const rollBreathing = prefersReducedMotion ? 0 : Math.cos(elapsedTime * 1.25) * 0.016;

      podGroup.position.y = floatY;
      podGroup.rotation.x = currentRotationRef.current.x + pitchBreathing;
      podGroup.rotation.y = currentRotationRef.current.y;
      podGroup.rotation.z = rollBreathing;

      // Dynamic floor shadow scale & opacity reacting to floating height
      if (contactShadow) {
        const shadowScale = 1.0 + floatY * 0.65;
        contactShadow.scale.set(shadowScale, shadowScale, 1.0);
        (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.72 - floatY * 1.2;
      }

      // Audio frequency waveform bar reaction on dashboard
      if (waveformMeshGroup) {
        const isSpeaking = stateRef.current === 'IXX IS SPEAKING';
        const isListening = stateRef.current === 'IXX IS LISTENING';
        const level = speechLevelRef.current;

        waveformMeshGroup.children.forEach((child, idx) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            let dynamicScale = 1.0;
            if (isSpeaking) {
              const wave = Math.sin(elapsedTime * 18 + idx * 0.5) * 0.5 + 0.5;
              dynamicScale = 1.0 + wave * (1.8 + level * 2.2);
            } else if (isListening && level > 0.05) {
              const wave = Math.sin(elapsedTime * 14 + idx * 0.6) * 0.5 + 0.5;
              dynamicScale = 1.0 + wave * level * 2.5;
            } else {
              // Gentle ambient resting pulse
              dynamicScale = 1.0 + Math.sin(elapsedTime * 2.5 + idx * 0.3) * 0.2;
            }
            mesh.scale.y = dynamicScale;
          }
        });
      }

      // Camera position updating with distance
      const camDist = cameraDistanceRef.current;
      const camPitch = 0.32;
      camera.position.x = Math.sin(0.42) * camDist;
      camera.position.y = Math.sin(camPitch) * camDist + 0.15;
      camera.position.z = Math.cos(0.42) * camDist;
      camera.lookAt(0, 0.05, 0);

      renderer.render(scene, camera);
    };

    animate();

    // -------------------------------------------------------------
    // RESIZE OBSERVER
    // -------------------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // -------------------------------------------------------------
    // INTERACTION HANDLERS (Mouse Drag, Touch, Wheel, Pinch)
    // -------------------------------------------------------------
    const onMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isInteractingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      dragDeltaRef.current = { x: 0, y: 0 };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isInteractingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      dragDeltaRef.current = { x: dx, y: dy };
      targetRotationRef.current.y += dx * 0.008;
      targetRotationRef.current.x += dy * 0.006;
    };

    const onMouseUp = () => {
      isInteractingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.0025;
      targetCameraDistanceRef.current = Math.max(2.6, Math.min(5.8, targetCameraDistanceRef.current + zoomDelta));
    };

    // Touch events for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (!interactive) return;
      if (e.touches.length === 1) {
        isInteractingRef.current = true;
        lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dragDeltaRef.current = { x: 0, y: 0 };
      } else if (e.touches.length === 2) {
        // Pinch zoom start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistRef.current = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!interactive) return;
      if (e.touches.length === 1 && isInteractingRef.current) {
        const dx = e.touches[0].clientX - lastPointerRef.current.x;
        const dy = e.touches[0].clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        dragDeltaRef.current = { x: dx, y: dy };
        targetRotationRef.current.y += dx * 0.009;
        targetRotationRef.current.x += dy * 0.007;
      } else if (e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const pinchDelta = (touchStartDistRef.current - dist) * 0.006;
        touchStartDistRef.current = dist;
        targetCameraDistanceRef.current = Math.max(2.6, Math.min(5.8, targetCameraDistanceRef.current + pinchDelta));
      }
    };

    const onTouchEnd = () => {
      isInteractingRef.current = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);

      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (container.contains(dom)) {
        container.removeChild(dom);
      }

      // Traverse & dispose Three.js resources
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [interactive, onModelLoaded]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      {/* 3D WebGL Canvas Mounting Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
        title="Interactive 3D S.19 Pod (Drag to rotate, scroll to zoom)"
      />

      {/* Subtle loading state if asset is loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-[#F4F0E8]/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#6D6A63] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#E27D60] animate-ping" />
            <span>Calibrating S.19 Pod...</span>
          </div>
        </div>
      )}
    </div>
  );
};
