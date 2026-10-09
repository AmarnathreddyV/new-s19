import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Polyfill minimal browser globals if needed for GLTFExporter in Node
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer() {}
  } as any;
}

function buildS19PodForExport(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'S19_Pod';

  // 1. Materials
  const hullMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Glossy_White_Hull',
    color: 0xfcfcfa,
    metalness: 0.05,
    roughness: 0.12,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Polished_Chrome',
    color: 0xd8dee6,
    metalness: 0.98,
    roughness: 0.08,
  });

  const orangeStripeMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Orange_Illuminated_Stripe',
    color: 0xff7b00,
    emissive: 0xff6200,
    emissiveIntensity: 2.5,
    roughness: 0.2,
  });

  const canopyGlassMaterial = new THREE.MeshPhysicalMaterial({
    name: 'S19_Dark_Canopy_Glass',
    color: 0x161a22,
    transmission: 0.88,
    opacity: 0.50,
    transparent: true,
    roughness: 0.06,
    ior: 1.52,
    thickness: 0.45,
  });

  const creamSeatMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Cream_Luxury_Seat',
    color: 0xede6dc,
    roughness: 0.42,
    metalness: 0.02,
  });

  const interiorTrimMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Interior_Dark_Trim',
    color: 0x1a1a1e,
    roughness: 0.55,
  });

  const waveformMaterial = new THREE.MeshStandardMaterial({
    name: 'S19_Dashboard_Waveform',
    color: 0xff9926,
    emissive: 0xff8818,
    emissiveIntensity: 2.8,
  });

  // 2. Main Egg Hull
  const hullGeo = new THREE.SphereGeometry(1, 64, 48);
  const posAttr = hullGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const origX = v.x;
    const origY = v.y;
    const origZ = v.z;

    let z = origZ * 1.18;
    const zNorm = origZ;
    const widthFactor = 0.82 * (1.0 - 0.14 * zNorm * zNorm + 0.05 * zNorm);
    let x = origX * widthFactor;

    let y: number;
    if (origY < 0) {
      y = origY * 0.52 - 0.05 * (1.0 - origZ * origZ);
    } else {
      const noseDip = 0.08 * Math.max(0, zNorm);
      y = origY * 0.64 - noseDip;
    }

    if (origZ < -0.4 && origY > 0) {
      const spineBlend = Math.pow((-origZ - 0.4) / 0.6, 1.8);
      y += 0.16 * spineBlend * (1.0 - Math.min(1, Math.abs(origX) * 3));
    }

    posAttr.setXYZ(i, x, y, z);
  }
  hullGeo.computeVertexNormals();

  const hullMesh = new THREE.Mesh(hullGeo, hullMaterial);
  root.add(hullMesh);

  // 3. Orange Perimeter Stripe
  const stripePoints: THREE.Vector3[] = [];
  const stripeSegments = 72;
  for (let i = 0; i <= stripeSegments; i++) {
    const theta = (i / stripeSegments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const z = sinT * 1.16;
    const widthFactor = 0.835 * (1.0 - 0.14 * sinT * sinT + 0.05 * sinT);
    const x = cosT * widthFactor;
    const y = -0.21 + 0.02 * sinT;
    stripePoints.push(new THREE.Vector3(x, y, z));
  }
  const stripeCurve = new THREE.CatmullRomCurve3(stripePoints, true);
  const stripeGeo = new THREE.TubeGeometry(stripeCurve, 72, 0.012, 10, true);
  const stripeMesh = new THREE.Mesh(stripeGeo, orangeStripeMaterial);
  root.add(stripeMesh);

  // 4. Tail Fin
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
  const tailSteps = 28;
  const radialSteps = 16;
  const tailCurve = new THREE.CatmullRomCurve3(tailSpinePoints);
  const tailVertices: number[] = [];
  const tailIndices: number[] = [];

  for (let i = 0; i <= tailSteps; i++) {
    const t = i / tailSteps;
    const pt = tailCurve.getPointAt(t);
    const tangent = tailCurve.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (binormal.lengthSq() < 0.001) binormal.set(1, 0, 0);
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    const lateralRadius = 0.13 * (1.0 - t * 0.85) + 0.02;
    const depthRadius = 0.18 * (1.0 - t * 0.80) + 0.025;

    for (let j = 0; j <= radialSteps; j++) {
      const angle = (j / radialSteps) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const offsetX = binormal.x * (cosA * lateralRadius) + normal.x * (sinA * depthRadius);
      const offsetY = binormal.y * (cosA * lateralRadius) + normal.y * (sinA * depthRadius);
      const offsetZ = binormal.z * (cosA * lateralRadius) + normal.z * (sinA * depthRadius);
      tailVertices.push(pt.x + offsetX, pt.y + offsetY, pt.z + offsetZ);
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
  tailGeo.setIndex(tailIndices);
  tailGeo.computeVertexNormals();
  const tailMesh = new THREE.Mesh(tailGeo, hullMaterial);
  root.add(tailMesh);

  // 5. Cockpit Seat & Table
  const seatGroup = new THREE.Group();
  seatGroup.position.set(0, 0.08, -0.05);
  seatGroup.rotation.x = -0.30;

  const seatBaseGeo = new THREE.BoxGeometry(0.44, 0.12, 0.42);
  const seatBaseMesh = new THREE.Mesh(seatBaseGeo, creamSeatMaterial);
  seatBaseMesh.position.set(0, 0.06, 0.12);
  seatGroup.add(seatBaseMesh);

  const backrestGeo = new THREE.BoxGeometry(0.42, 0.58, 0.10);
  const backrestMesh = new THREE.Mesh(backrestGeo, creamSeatMaterial);
  backrestMesh.position.set(0, 0.35, -0.08);
  seatGroup.add(backrestMesh);

  const headrestGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.24, 16);
  headrestGeo.rotateZ(Math.PI / 2);
  const headrestMesh = new THREE.Mesh(headrestGeo, creamSeatMaterial);
  headrestMesh.position.set(0, 0.66, -0.10);
  seatGroup.add(headrestMesh);

  root.add(seatGroup);

  // Cockpit Console
  const dashGeo = new THREE.BoxGeometry(0.68, 0.08, 0.32);
  const dashMesh = new THREE.Mesh(dashGeo, interiorTrimMaterial);
  dashMesh.position.set(0, 0.12, 0.58);
  root.add(dashMesh);

  // Audio Equalizer on dash
  const waveformGeo = new THREE.BoxGeometry(0.32, 0.04, 0.02);
  const waveformMesh = new THREE.Mesh(waveformGeo, waveformMaterial);
  waveformMesh.position.set(0, 0.18, 0.58);
  root.add(waveformMesh);

  // 6. Chrome Canopy Rim
  const rimPoints: THREE.Vector3[] = [];
  const rimSteps = 48;
  for (let i = 0; i <= rimSteps; i++) {
    const angle = (i / rimSteps) * Math.PI * 2;
    rimPoints.push(new THREE.Vector3(Math.cos(angle) * 0.46, 0, Math.sin(angle) * 0.62));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPoints, true);
  const rimGeo = new THREE.TubeGeometry(rimCurve, 48, 0.038, 12, true);
  const rimMesh = new THREE.Mesh(rimGeo, chromeMaterial);
  rimMesh.position.set(0, 0.24, 0.15);
  rimMesh.rotation.x = -0.32;
  root.add(rimMesh);

  // 7. Canopy Glass
  const glassGeo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const gPos = glassGeo.attributes.position;
  const gv = new THREE.Vector3();
  for (let i = 0; i < gPos.count; i++) {
    gv.fromBufferAttribute(gPos, i);
    gPos.setXYZ(i, gv.x * 0.44, gv.y * 0.38, gv.z * 0.60);
  }
  glassGeo.computeVertexNormals();
  const glassMesh = new THREE.Mesh(glassGeo, canopyGlassMaterial);
  glassMesh.position.set(0, 0.24, 0.15);
  glassMesh.rotation.x = -0.32;
  root.add(glassMesh);

  return root;
}

async function run() {
  const model = buildS19PodForExport();
  const exporter = new GLTFExporter();

  await new Promise<void>((resolve, reject) => {
    exporter.parse(
      model,
      (gltf) => {
        const outputDir = path.resolve('/public/models');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, 'S19.glb');

        if (gltf instanceof ArrayBuffer) {
          fs.writeFileSync(outputPath, Buffer.from(gltf));
          console.log('Successfully saved binary GLB to', outputPath);
        } else {
          const gltfText = JSON.stringify(gltf, null, 2);
          fs.writeFileSync(path.join(outputDir, 'S19.gltf'), gltfText);
          console.log('Successfully saved GLTF to', path.join(outputDir, 'S19.gltf'));
        }
        resolve();
      },
      (error) => {
        console.error('An error happened during export:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

