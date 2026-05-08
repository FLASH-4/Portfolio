import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sphere, OrbitControls, Text, Billboard, Environment } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { Github, Mail, Linkedin, X } from 'lucide-react';

// Advanced realistic sun with procedural flames
const sunFragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for(int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 pos = vPosition;
    vec3 flowPos = vec3(vUv * 4.6, time * 0.09);
    
    float granulation = fbm(flowPos * 2.1);
    float cell = fbm(pos * 3.4 + vec3(time * 0.12));
    float plasma = fbm(pos * 1.8 + vec3(time * 0.08));
    float ribbons = sin((normal.y * 18.0) + plasma * 5.0 + time * 0.65) * 0.5 + 0.5;
    
    float combined = granulation * 0.26 + cell * 0.43 + plasma * 0.31;
    float nDotV = max(dot(normal, viewDir), 0.0);
    float limbDarkening = pow(nDotV, 0.78);
    float rimGlow = pow(1.0 - nDotV, 2.2);
    float filament = abs(sin(normal.y * 22.0 + plasma * 6.5 + time * 0.95));
    float hotspot = smoothstep(0.68, 0.98, combined + ribbons * 0.24);
    
    vec3 deep = vec3(0.44, 0.06, 0.02);
    vec3 mid = vec3(0.82, 0.22, 0.06);
    vec3 hot = vec3(1.0, 0.48, 0.12);
    vec3 core = vec3(1.0, 0.76, 0.34);

    vec3 color = mix(deep, mid, smoothstep(0.2, 0.72, combined));
    color = mix(color, hot, smoothstep(0.54, 0.9, combined));
    color = mix(color, core, hotspot);
    color *= mix(0.58, 1.16, limbDarkening);
    color += vec3(1.0, 0.32, 0.09) * rimGlow * (0.16 + filament * 0.22);
    color += vec3(1.0, 0.68, 0.24) * hotspot * 0.25;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

const sunVertexShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    
    vec3 pos = position;
    float wave = sin(position.y * 4.6 + time * 0.95) * 0.022;
    float wave2 = cos(position.x * 3.4 + time * 1.15) * 0.017;
    float wave3 = sin((position.z + position.x) * 5.0 + time * 0.75) * 0.012;
    pos += normal * (wave + wave2);
    pos += normal * wave3;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

function createSunFlameData(count, radius) {
  const up = new THREE.Vector3(0, 1, 0);
  const data = [];

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    const normal = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );

    const position = normal.clone().multiplyScalar(radius + Math.random() * 0.14);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    const tangent = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)).normalize();
    const tilt = (Math.random() - 0.5) * 0.5;
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(tangent, tilt));
    const rotation = new THREE.Euler().setFromQuaternion(quaternion);

    data.push({
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      width: 0.24 + Math.random() * 0.2,
      length: 0.32 + Math.random() * 0.58,
      speed: 0.8 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random() > 0.5,
    });
  }

  return data;
}

const planetVertexShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    vec3 pos = position;
    float displacement = noise(position * 2.0 + vec3(time * 0.01)) * 0.008;
    pos += normal * displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const planetShaderCommon = `
  float saturate(float value) {
    return clamp(value, 0.0, 1.0);
  }

  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  float fresnel(vec3 normal, vec3 viewDir, float power) {
    return pow(1.0 - saturate(dot(normal, viewDir)), power);
  }
`;

// Earth shader
const earthFragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  ${planetShaderCommon}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(0.85, 0.45, 0.75));
    vec3 pos = vPosition;

    float heightNoise = fbm(pos * 3.0 + vec3(time * 0.01));
    float continent = fbm(pos * 4.5 + vec3(1.2, 2.4, 3.6));
    float coast = fbm(pos * 10.0 + vec3(time * 0.02));
    float cloud = fbm(pos * 8.0 + vec3(time * 0.05, time * 0.03, time * 0.04));

    float landMask = smoothstep(0.45, 0.62, continent + (heightNoise - 0.5) * 0.14);
    float mountainMask = smoothstep(0.62, 0.9, heightNoise);
    float iceMask = smoothstep(0.72, 0.95, abs(pos.y));

    vec3 oceanDeep = vec3(0.03, 0.14, 0.28);
    vec3 oceanShallow = vec3(0.05, 0.28, 0.46);
    vec3 landLow = vec3(0.14, 0.34, 0.12);
    vec3 landHigh = vec3(0.24, 0.47, 0.18);
    vec3 desert = vec3(0.42, 0.38, 0.19);
    vec3 ice = vec3(0.88, 0.94, 0.98);

    vec3 oceanColor = mix(oceanDeep, oceanShallow, coast);
    vec3 landColor = mix(landLow, landHigh, continent);
    landColor = mix(landColor, desert, smoothstep(0.58, 0.82, continent) * 0.35);
    landColor = mix(landColor, ice, iceMask * 0.55);

    vec3 baseColor = mix(oceanColor, landColor, landMask);
    baseColor = mix(baseColor, vec3(0.95), mountainMask * 0.12);

    float cloudBands = smoothstep(0.63, 0.85, cloud) * smoothstep(0.18, 0.8, 1.0 - abs(pos.y));
    vec3 cloudColor = mix(vec3(0.84, 0.9, 0.98), vec3(1.0), cloudBands);
    baseColor = mix(baseColor, cloudColor, cloudBands * 0.38);

    float diffuse = max(dot(normal, lightDir), 0.0);
    float wrappedDiffuse = diffuse * 0.8 + 0.2;
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0) * 0.35;
    float atmosphere = fresnel(normal, viewDir, 3.8);

    vec3 color = baseColor * (0.32 + wrappedDiffuse * 0.95);
    color += vec3(specular * 0.9);
    color += vec3(0.16, 0.34, 0.55) * atmosphere * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Mars shader
const marsFragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  ${planetShaderCommon}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(0.85, 0.45, 0.75));
    vec3 pos = vPosition;

    float dunes = fbm(pos * 5.5 + vec3(time * 0.01));
    float crater = fbm(pos * 9.0 + vec3(3.4, 1.8, 2.1));
    float dust = fbm(pos * 2.5 + vec3(time * 0.015, 0.0, time * 0.008));
    float polar = smoothstep(0.55, 0.95, abs(pos.y));

    vec3 rust = vec3(0.50, 0.20, 0.08);
    vec3 clay = vec3(0.72, 0.34, 0.12);
    vec3 tan = vec3(0.44, 0.24, 0.10);
    vec3 ice = vec3(0.93, 0.92, 0.88);

    vec3 baseColor = mix(rust, clay, dunes);
    baseColor = mix(baseColor, tan, crater * 0.45);
    baseColor = mix(baseColor, ice, polar * 0.3);
    baseColor += vec3(0.08, 0.03, 0.01) * dust;

    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 16.0) * 0.08;
    float atmosphere = fresnel(normal, viewDir, 4.2);

    vec3 color = baseColor * (0.28 + diffuse * 1.05);
    color += vec3(specular);
    color += vec3(0.22, 0.12, 0.06) * atmosphere * 0.12;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Jupiter shader
const jupiterFragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  ${planetShaderCommon}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(0.85, 0.45, 0.75));
    vec3 pos = vPosition;

    float bandCoord = pos.y * 18.0 + fbm(pos * 1.8) * 3.0 + time * 0.025;
    float bands = sin(bandCoord) * 0.5 + 0.5;
    float turbulence = fbm(pos * 5.0 + vec3(time * 0.015, time * 0.008, time * 0.01));
    float storm = smoothstep(0.58, 0.86, turbulence);

    vec3 lightBand = vec3(0.92, 0.78, 0.54);
    vec3 midBand = vec3(0.82, 0.60, 0.32);
    vec3 darkBand = vec3(0.60, 0.41, 0.18);
    vec3 stormColor = vec3(0.88, 0.34, 0.16);

    vec3 color = mix(lightBand, midBand, bands);
    color = mix(color, darkBand, smoothstep(0.2, 0.8, turbulence) * 0.45);

    float spot = length(vec2(pos.x * 0.9, pos.y * 1.7 + 0.12));
    float greatRedSpot = smoothstep(0.45, 0.0, spot) * smoothstep(-0.15, 0.22, pos.z);
    color = mix(color, stormColor, greatRedSpot * 0.95);
    color += vec3(0.08, 0.04, 0.02) * storm;

    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 20.0) * 0.08;
    float atmosphere = fresnel(normal, viewDir, 2.8);

    vec3 litColor = color * (0.40 + diffuse * 0.95);
    litColor += vec3(specular);
    litColor += vec3(0.35, 0.20, 0.08) * atmosphere * 0.08;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

// Saturn shader
const saturnFragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  ${planetShaderCommon}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(0.85, 0.45, 0.75));
    vec3 pos = vPosition;

    float bands = sin(pos.y * 14.0 + fbm(pos * 2.0) * 2.0 + time * 0.012) * 0.5 + 0.5;
    float haze = fbm(pos * 4.5 + vec3(time * 0.01));
    float polar = smoothstep(0.55, 0.92, abs(pos.y));

    vec3 base = vec3(0.90, 0.84, 0.72);
    vec3 bandColor = mix(vec3(0.80, 0.71, 0.56), vec3(0.95, 0.90, 0.80), haze);
    vec3 poleColor = vec3(0.96, 0.95, 0.88);

    vec3 color = mix(base, bandColor, bands * 0.52);
    color = mix(color, poleColor, polar * 0.22);
    color += vec3(0.04, 0.03, 0.01) * haze;

    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 20.0) * 0.05;
    float atmosphere = fresnel(normal, viewDir, 3.0);

    vec3 litColor = color * (0.46 + diffuse * 0.86);
    litColor += vec3(specular);
    litColor += vec3(0.18, 0.15, 0.10) * atmosphere * 0.1;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

const atmosphereVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 lightPosition;
  uniform vec3 glowColor;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(lightPosition - vWorldPosition);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    float sunFacing = max(dot(normal, lightDir), 0.0);
    float glow = fresnel * (0.2 + sunFacing * 1.25);
    float alpha = glow * 0.32;

    gl_FragColor = vec4(glowColor, alpha);
  }
`;

const nightShadowVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const nightShadowFragmentShader = `
  uniform vec3 lightPosition;
  uniform float shadowStrength;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 lightDir = normalize(lightPosition - vWorldPosition);
    float lit = max(dot(normal, lightDir), 0.0);
    float night = smoothstep(0.28, -0.2, lit);
    gl_FragColor = vec4(0.0, 0.0, 0.0, night * shadowStrength);
  }
`;

const sunSpecVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const sunSpecFragmentShader = `
  uniform vec3 lightPosition;
  uniform float intensity;
  uniform vec3 specColor;
  uniform float exponent;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightPosition - vWorldPosition);
    float ndl = max(dot(N, L), 0.0);
    float spec = pow(ndl, exponent) * intensity;
    if (spec <= 0.0001) discard;
    gl_FragColor = vec4(specColor * spec, spec);
  }
`;

const planetTextureCache = new Map();
const planetSurfaceCache = new Map();

function createPlanetTexture(kind) {
  if (typeof document === 'undefined') return null;
  if (planetTextureCache.has(kind)) return planetTextureCache.get(kind);

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const addNoise = (count, color, minRadius, maxRadius, alpha = 1) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      ctx.globalAlpha = alpha * (0.35 + Math.random() * 0.65);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  if (kind === 'earth') {
    const ocean = ctx.createRadialGradient(size * 0.42, size * 0.38, size * 0.1, size * 0.5, size * 0.5, size * 0.8);
    ocean.addColorStop(0, '#1e6cb3');
    ocean.addColorStop(0.5, '#0b3564');
    ocean.addColorStop(1, '#041b33');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, size, size);

    addNoise(320, '#1f7a43', 18, 70, 0.9);
    addNoise(180, '#7b5b2d', 10, 38, 0.45);
    addNoise(260, '#2a8d4d', 8, 26, 0.55);
    addNoise(420, 'rgba(255,255,255,0.7)', 2, 7, 0.18);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 22; i++) {
      const y = Math.random() * size;
      const width = 160 + Math.random() * 380;
      const height = 16 + Math.random() * 26;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, y, width, height, Math.random() * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const poles = ctx.createLinearGradient(0, 0, 0, size);
    poles.addColorStop(0, 'rgba(255,255,255,0.65)');
    poles.addColorStop(0.12, 'rgba(255,255,255,0)');
    poles.addColorStop(0.88, 'rgba(255,255,255,0)');
    poles.addColorStop(1, 'rgba(255,255,255,0.65)');
    ctx.fillStyle = poles;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === 'mars') {
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#c65b24');
    base.addColorStop(0.45, '#8f3514');
    base.addColorStop(1, '#4c1e0d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    addNoise(240, '#d57b39', 12, 65, 0.8);
    addNoise(180, '#6e2610', 12, 42, 0.6);
    addNoise(120, '#f0c7a0', 6, 18, 0.16);

    ctx.fillStyle = 'rgba(70, 22, 8, 0.35)';
    for (let i = 0; i < 180; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 4 + Math.random() * 14;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 186, 121, 0.14)';
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.stroke();
    }
  } else if (kind === 'jupiter') {
    const jupiterBands = ['#d4b07a', '#c48e52', '#8d6231', '#e7c58c', '#b47c44'];
    ctx.fillStyle = '#ab7a43';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 34) {
      const band = jupiterBands[(y / 34) % jupiterBands.length];
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, y, size, 34);
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 80; i++) {
      const y = Math.random() * size;
      const h = 10 + Math.random() * 24;
      ctx.fillStyle = i % 2 === 0 ? '#6d4524' : '#e8c48e';
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, y, 220 + Math.random() * 180, h, Math.random() * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(180, 74, 38, 0.9)';
    ctx.beginPath();
    ctx.ellipse(size * 0.66, size * 0.55, 120, 82, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 203, 155, 0.28)';
    ctx.beginPath();
    ctx.ellipse(size * 0.66, size * 0.55, 96, 62, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'saturn') {
    const saturnBands = ['#f0e2c5', '#d8c3a1', '#c1a97d', '#ead9b9'];
    ctx.fillStyle = '#e1cfae';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 40) {
      const band = saturnBands[(y / 40) % saturnBands.length];
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, y, size, 40);
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 0.18;
    addNoise(220, '#a88f65', 10, 24, 0.7);
    ctx.globalAlpha = 1;
  }

  addNoise(1200, 'rgba(255,255,255,0.08)', 1, 2.5, 0.55);

  // Keep albedo texture neutral; sunlight should come from scene lighting, not baked-in highlights.
  const subtleVignette = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.2, size * 0.5, size * 0.5, size * 0.7);
  subtleVignette.addColorStop(0, 'rgba(255,255,255,0)');
  subtleVignette.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = subtleVignette;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  planetTextureCache.set(kind, texture);
  return texture;
}

function createPlanetSurfaceTexture(kind, mode = 'bump') {
  if (typeof document === 'undefined') return null;

  const cacheKey = `${kind}:${mode}`;
  if (planetSurfaceCache.has(cacheKey)) return planetSurfaceCache.get(cacheKey);

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const isBump = mode === 'bump';
  const fill = (v) => {
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(0, 0, size, size);
  };

  const addDots = (count, minR, maxR, minV, maxV, alpha = 1) => {
    for (let i = 0; i < count; i++) {
      const v = Math.floor(minV + Math.random() * (maxV - minV));
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.globalAlpha = alpha * (0.35 + Math.random() * 0.65);
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = minR + Math.random() * (maxR - minR);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  if (kind === 'earth') {
    fill(isBump ? 104 : 88); // smoother oceans
    addDots(420, 8, 44, isBump ? 140 : 170, isBump ? 178 : 210, 0.82); // continents
    addDots(240, 4, 20, isBump ? 165 : 190, isBump ? 205 : 230, 0.42); // mountains
    addDots(280, 2, 8, isBump ? 110 : 145, isBump ? 148 : 182, 0.18); // clouds/variation
  } else if (kind === 'mars') {
    fill(isBump ? 158 : 202);
    addDots(360, 5, 24, isBump ? 110 : 165, isBump ? 185 : 238, 0.72);
    addDots(140, 2, 10, isBump ? 92 : 146, isBump ? 132 : 178, 0.44);
  } else if (kind === 'jupiter') {
    fill(isBump ? 126 : 150);
    for (let y = 0; y < size; y += 34) {
      const jitter = Math.floor((Math.random() - 0.5) * 24);
      const v = Math.max(40, Math.min(235, (isBump ? 126 : 160) + jitter));
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(0, y, size, 34);
    }
    addDots(220, 10, 40, isBump ? 112 : 132, isBump ? 148 : 182, 0.28);
  } else {
    // saturn and fallback
    fill(isBump ? 136 : 168);
    for (let y = 0; y < size; y += 40) {
      const jitter = Math.floor((Math.random() - 0.5) * 20);
      const v = Math.max(52, Math.min(236, (isBump ? 136 : 168) + jitter));
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(0, y, size, 40);
    }
    addDots(180, 8, 22, isBump ? 126 : 152, isBump ? 162 : 194, 0.25);
  }

  addDots(1500, 1, 2.8, isBump ? 112 : 136, isBump ? 154 : 178, 0.22);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  planetSurfaceCache.set(cacheKey, texture);
  return texture;
}

function getPlanetMaterialConfig(kind) {
  const texture = createPlanetTexture(kind);
  const bumpMap = createPlanetSurfaceTexture(kind, 'bump');
  const roughnessMap = createPlanetSurfaceTexture(kind, 'roughness');

  if (kind === 'earth') {
    return {
      map: texture,
      bumpMap,
      roughnessMap,
      color: '#ffffff',
      bumpScale: 0.82,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.12,
      emissive: '#0b1f3a',
      emissiveIntensity: 0.01,
    };
  }

  if (kind === 'mars') {
    return {
      map: texture,
      bumpMap,
      roughnessMap,
      color: '#ffffff',
      bumpScale: 1.05,
      roughness: 0.99,
      metalness: 0,
      envMapIntensity: 0.08,
    };
  }

  if (kind === 'jupiter') {
    return {
      map: texture,
      bumpMap,
      roughnessMap,
      color: '#ffffff',
      bumpScale: 0.24,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.1,
    };
  }

  return {
    map: texture,
    bumpMap,
    roughnessMap,
    color: '#ffffff',
    bumpScale: 0.36,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.1,
  };
}

// Planet Component
function Planet({ 
  orbitRadius, 
  size, 
  label, 
  onClick, 
  hasRing = false,
  shaderType = 'earth',
  angle = 0,
  speed = 0.004,
  trailColor = '#4ecdc4',
  highlight = false,
  yOffset = 0
}) {
  const ref = useRef();
  const hitRef = useRef();
  const groupRef = useRef();
  const angleRef = useRef(angle);
  const trailRef = useRef([]);
  const trailGroupRef = useRef();
  const materialConfig = useMemo(() => getPlanetMaterialConfig(shaderType), [shaderType]);
  const hitRadius = useMemo(() => size * 1.3, [size]);
  const hasAtmosphere = shaderType === 'earth';
  const atmosphereUniforms = useMemo(() => ({
    lightPosition: { value: new THREE.Vector3(0, 0, 0) },
    glowColor: { value: new THREE.Color('#8bd8ff') },
  }), []);
  const shadowUniforms = useMemo(() => ({
    lightPosition: { value: new THREE.Vector3(0, 0, 0) },
    shadowStrength: { value: shaderType === 'jupiter' ? 0.28 : 0.22 },
  }), [shaderType]);
  const specUniforms = useMemo(() => ({
    lightPosition: { value: new THREE.Vector3(0, 0, 0) },
    intensity: { value: shaderType === 'earth' ? 1.8 : shaderType === 'mars' ? 1.6 : shaderType === 'jupiter' ? 1.1 : 1.4 },
    specColor: { value: new THREE.Color('#fff6df') },
    exponent: { value: shaderType === 'earth' ? 20.0 : shaderType === 'mars' ? 18.0 : shaderType === 'jupiter' ? 12.0 : 16.0 },
  }), [shaderType]);

  useFrame((state) => {
    angleRef.current += speed;
    
    const theta = angleRef.current;
    const x = Math.cos(theta) * orbitRadius;
    const z = Math.sin(theta) * orbitRadius * 0.65;

    if (groupRef.current) {
      groupRef.current.position.set(x, yOffset, z);
    }

    if (ref.current) {
      ref.current.rotation.y += 0.015;
      ref.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.5) * 0.0008;
    }

    if (hitRef.current) {
      hitRef.current.rotation.y += 0.015;
      hitRef.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.5) * 0.0008;
    }

    const trail = trailRef.current;
    trail.unshift({ x, z });
    if (trail.length > 250) trail.pop();

    if (trailGroupRef.current) {
      trailGroupRef.current.children.forEach((child, i) => {
        if (i < trail.length) {
          child.position.set(trail[i].x, 0.01, trail[i].z);
          const base = Math.pow(1 - i / trail.length, 2) * 0.7;
          const opacity = highlight ? Math.min(1, base * 1.4) : base;
          const scale = (1 - i / trail.length) * 0.5;
          child.material.opacity = opacity;
          child.scale.set(scale, 0.08, scale);
        }
      });
    }

  });

  return (
    <>
      <group ref={trailGroupRef}>
        {Array(250).fill(0).map((_, i) => (
          <mesh key={`trail-${i}`} position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.08, 8]} />
            <meshBasicMaterial color={trailColor} transparent opacity={0} />
          </mesh>
        ))}
      </group>

      <group ref={groupRef}>
        <Sphere 
          ref={ref} 
          args={[size, 256, 128]}
        >
          <meshPhysicalMaterial
            {...materialConfig}
            side={THREE.FrontSide}
            transparent={false}
          />
        </Sphere>

        {/* Night-side shadow pass for stronger day/night contrast */}
        <Sphere args={[size * 1.003, 96, 48]}>
          <shaderMaterial
            vertexShader={nightShadowVertexShader}
            fragmentShader={nightShadowFragmentShader}
            uniforms={shadowUniforms}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </Sphere>

        {/* Sun-facing specular overlay (adds directional highlights) */}
        <Sphere args={[size * 1.002, 96, 48]}> 
          <shaderMaterial
            vertexShader={sunSpecVertexShader}
            fragmentShader={sunSpecFragmentShader}
            uniforms={specUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
          />
        </Sphere>

        <Sphere
          ref={hitRef}
          args={[hitRadius, 32, 16]}
          onClick={onClick}
          onPointerEnter={() => {
            if (ref.current) {
              gsap.to(ref.current.scale, { x: 1.25, y: 1.25, z: 1.25, duration: 0.3 });
            }
          }}
          onPointerLeave={() => {
            if (ref.current) {
              gsap.to(ref.current.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
            }
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ffffff" />
        </Sphere>

        {/* Saturn rings */}
        {hasRing && (
          <mesh rotation={[Math.PI / 2.6, 0, 0]}>
            <ringGeometry args={[size * 1.38, size * 2.35, 512]} />
            <meshStandardMaterial 
              color="#e8dcc8"
              transparent 
              opacity={0.65}
              roughness={0.7}
              metalness={0.0}
              side={THREE.DoubleSide}
              emissive="#f5e6d3"
              emissiveIntensity={0.1}
            />
          </mesh>
        )}

        {/* Label */}
        <Billboard position={[0, size + 2.7, 0]}>
          <Text 
            fontSize={highlight ? 1.05 : 0.88} 
            color={highlight ? '#E6FFFF' : '#ffffff'} 
            anchorX="center"
            fontWeight="bold"
            outlineWidth={highlight ? 0.1 : 0.07}
            outlineColor="#000000"
            letterSpacing={0.06}
          >
            {label}
          </Text>
        </Billboard>
      </group>
    </>
  );
}

// Realistic Sun
function Sun() {
  const sunRef = useRef();
  const materialRef = useRef();
  const flameGroupRef = useRef();
  const flameRefs = useRef([]);
  const flameData = useMemo(() => createSunFlameData(110, 6.3), []);
  const flameGeometry = useMemo(() => {
    const geometry = new THREE.ConeGeometry(0.38, 0.72, 14, 1, false);
    geometry.translate(0, 0.36, 0);
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      flameGeometry.dispose();
    };
  }, [flameGeometry]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (sunRef.current) {
      sunRef.current.rotation.x += 0.00005;
      sunRef.current.rotation.y += 0.00085;
    }

    if (materialRef.current?.uniforms?.time) {
      materialRef.current.uniforms.time.value = t;
    }

    if (flameGroupRef.current) {
      flameGroupRef.current.rotation.y += 0.00035;
    }

    for (let i = 0; i < flameData.length; i++) {
      const mesh = flameRefs.current[i];
      const info = flameData[i];
      if (!mesh || !info) continue;

      const pulse = 0.74 + 0.26 * Math.sin(t * info.speed + info.phase);
      const flare = 0.56 + 0.44 * Math.max(0, Math.sin(t * (info.speed * 0.52) + info.phase * 1.2));

      mesh.scale.set(info.width * (0.92 + flare * 0.12), info.length * (0.86 + pulse * 0.36), info.width * (0.92 + flare * 0.08));

      if (mesh.material) {
        mesh.material.opacity = 0.16 + flare * 0.18;
        mesh.material.emissiveIntensity = 0.6 + flare * 0.7;
      }
    }
  });

  return (
    <>
      <Sphere ref={sunRef} args={[12, 512, 256]} position={[0, 0, 0]}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={sunVertexShader}
          fragmentShader={sunFragmentShader}
          uniforms={{
            time: { value: 0 }
          }}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </Sphere>

      {/* 3D flame crown around sun */}
      <group ref={flameGroupRef}>
        {flameData.map((flame, i) => (
          <mesh
            key={`solar-flame-${i}`}
            ref={(node) => {
              flameRefs.current[i] = node;
            }}
            geometry={flameGeometry}
            position={flame.position}
            rotation={flame.rotation}
          >
            <meshStandardMaterial
              color={flame.warm ? '#ff7a24' : '#ff4d1a'}
              emissive={flame.warm ? '#ff7a24' : '#ff4d1a'}
              emissiveIntensity={1.0}
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              roughness={1}
              metalness={0}
            />
          </mesh>
        ))}
      </group>

    </>
  );
}

// Main Scene
function SolarSystem({ onPlanetClick }) {
  const planets = [
    { orbitRadius: 38, size: 5.03, label: 'ABOUT', shaderType: 'earth', trailColor: '#1e90ff', speed: 0.012, angle: 0, yOffset: 0.6 },
    { orbitRadius: 60, size: 5.22, label: 'SKILLS', shaderType: 'mars', trailColor: '#d4a574', speed: 0.008, angle: 1.2, yOffset: -1.6 },
    { orbitRadius: 82, size: 5.55, label: 'PROJECTS', shaderType: 'earth', trailColor: '#1e90ff', speed: 0.005, angle: 2.5, yOffset: 0.9 },
    { orbitRadius: 106, size: 6.08, label: 'GITHUB', shaderType: 'jupiter', trailColor: '#c88b3a', speed: 0.003, angle: 3.8, yOffset: -2.8 },
    { orbitRadius: 136, size: 5.75, label: 'CONTACT', shaderType: 'saturn', hasRing: true, trailColor: '#faf0e6', speed: 0.002, angle: 5.2, yOffset: 2.4 },
    { orbitRadius: 158, size: 4.76, label: 'QUIZ', shaderType: 'earth', trailColor: '#7ad0ff', speed: 0.0028, angle: 0.6, highlight: true, yOffset: -2.4 },
    { orbitRadius: 180, size: 4.63, label: 'CHALLENGE', shaderType: 'mars', trailColor: '#ff9f6b', speed: 0.0022, angle: 2.1, highlight: true, yOffset: -1.1 },
    { orbitRadius: 202, size: 5.16, label: 'RECRUITER', shaderType: 'jupiter', trailColor: '#ffd57a', speed: 0.0018, angle: 4.0, highlight: true, yOffset: 2.8 },
  ];

  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 220, 1200]} />

      {/* Layered outer-space star fields with stronger visibility */}
      <Stars
        radius={360}
        depth={180}
        count={9000}
        factor={6}
        saturation={0.85}
        fade
        speed={0.025}
        color="#f6fbff"
        transparent
        opacity={0.6}
      />
      <Stars
        radius={900}
        depth={500}
        count={26000}
        factor={14}
        saturation={0.6}
        fade
        speed={0.02}
        color="#e6f0ff"
        transparent
        opacity={0.35}
      />
      <Stars
        radius={1300}
        depth={900}
        count={14000}
        factor={10}
        saturation={0.25}
        fade
        speed={0.01}
        color="#d5e6ff"
        transparent
        opacity={0.2}
      />

      <Sun />

      {planets.map((planet, i) => (
        <Planet
          key={i}
          {...planet}
          onClick={() => onPlanetClick(i)}
        />
      ))}

      <ambientLight intensity={0} />
      <pointLight position={[0, 0, 0]} intensity={50} color="#fff5e6" distance={1500} decay={0.8} />
    </>
  );
}

// Data Panel
function DataPanel({ type, onClose, showToast }) {
  const data = {
    0: {
      title: 'About Me',
      content: (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">Full-stack developer actively looking for opportunities in software engineering, backend systems, and AI-driven product teams. I've built production-grade systems handling real-time data, microservices, and AI integration at scale.</p>
          <p className="text-lg leading-relaxed">Passionate about scalable backends, LLM integration, and solving complex real-world problems. Interned at Ericsson building ML pipelines and GenAI prototypes.</p>
        </div>
      )
    },
    1: {
      title: 'Technical Skills',
      content: (
        <div className="space-y-6">
          {[
            { name: 'Frontend', skills: ['Next.js', 'React.js', 'TypeScript', 'Tailwind CSS', 'Three.js'] },
            { name: 'Backend', skills: ['FastAPI', 'Node.js', 'Express.js', 'PostgreSQL', 'Redis'] },
            { name: 'Cloud & DevOps', skills: ['Docker', 'GitHub Actions', 'Vercel', 'Google OAuth', 'Prometheus'] },
            { name: 'AI/ML', skills: ['LLMs', 'OpenAI API', 'DeepFace', 'FastAPI', 'RAG Pipelines'] }
          ].map(cat => (
            <div key={cat.name}>
              <h4 className="font-bold text-cyan-400 mb-3">{cat.name}</h4>
              <div className="flex flex-wrap gap-2">
                {cat.skills.map(s => (
                  <span key={s} className="px-3 py-1 bg-blue-600/40 rounded-full text-sm border border-blue-500/50 hover:border-cyan-400/70 transition">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    },
    2: {
      title: 'Projects',
      content: (
        <div>
          <ProjectsPanel />
        </div>
      )
    },
    3: {
      title: 'GitHub Profile',
      content: (
        <div>
          <GitHubStatsPanel />
        </div>
      )
    },
    4: {
      title: 'Get In Touch',
      content: (
        <div className="space-y-6">
          <ContactPanel />
        </div>
      )
    }
    ,
    5: {
      title: 'Quick Tech Quiz',
      content: (
        <div className="space-y-4">
          {/** QuizPanel */}
          <QuizPanel />
        </div>
      )
    },
    6: {
      title: 'Recruiter Challenge',
      content: (
        <div className="space-y-4">
          <ChallengePanel />
        </div>
      )
    },
    7: {
      title: 'Recruiter Toolkit',
      content: (
        <div className="space-y-4">
          <RecruiterPanel />
        </div>
      )
    }
  };

  // --- Interactive subcomponents for recruiter activities ---
  function QuizPanel() {
    const allQuestions = [
      { q: 'Which React hook is used to hold local state?', options: ['useEffect', 'useRef', 'useState'], a: 2 },
      { q: 'Which method combines two arrays without mutating them?', options: ['push', 'concat', 'splice'], a: 1 },
      { q: 'In Three.js, which object holds the mesh appearance?', options: ['Geometry', 'Material', 'Light'], a: 1 },
      { q: 'What does REST stand for?', options: ['Remote Execution Service', 'Representational State Transfer', 'Request-Event Stream Tech'], a: 1 },
      { q: 'Which database is NoSQL?', options: ['PostgreSQL', 'MongoDB', 'Oracle'], a: 1 },
      { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n^2)'], a: 1 },
      { q: 'Which CSS property controls z-axis layering?', options: ['layer', 'zindex', 'z-index'], a: 2 },
      { q: 'What does JWT stand for?', options: ['Java Web Token', 'JSON Web Token', 'JavaScript Write Token'], a: 1 },
      { q: 'Which is a frontend framework?', options: ['Django', 'React', 'Laravel'], a: 1 },
      { q: 'What is the output of 2 + "2" in JavaScript?', options: ['4', '22', 'NaN'], a: 1 },
    ];

    const getRandomQuestions = () => {
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    };

    const [questions, setQuestions] = useState(() => getRandomQuestions());
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [finished, setFinished] = useState(false);

    function choose(i) {
      const next = [...answers];
      next[idx] = i;
      setAnswers(next);
      if (idx + 1 < questions.length) setIdx(idx + 1);
      else setFinished(true);
    }

    function score() {
      let s = 0;
      for (let i = 0; i < questions.length; i++) if (answers[i] === questions[i].a) s++;
      return s;
    }

    return (
      <div>
        {!finished ? (
          <div>
            <h4 className="font-bold text-cyan-300 mb-3">{questions[idx].q}</h4>
            <div className="grid grid-cols-1 gap-2">
              {questions[idx].options.map((o, i) => (
                <button key={i} onClick={() => choose(i)} className="px-4 py-2 bg-blue-800/40 rounded hover:bg-blue-700/50">{o}</button>
              ))}
            </div>
            <p className="text-sm text-blue-200 mt-3">Question {idx+1} of {questions.length}</p>
          </div>
        ) : (
          <div>
            <h4 className="font-bold text-cyan-300">Nice! You scored {score()} / {questions.length}</h4>
            <p className="text-sm text-blue-100/70 mt-2">Thanks for trying this quick quiz—feel free to share your score when reaching out.</p>
            <button onClick={() => { setQuestions(getRandomQuestions()); setIdx(0); setAnswers([]); setFinished(false); }} className="mt-4 px-4 py-2 bg-cyan-500 rounded text-black font-bold">Try Again</button>
          </div>
        )}
      </div>
    );
  }

  function ChallengePanel() {
    const allRounds = [
      {
        prompt: 'A repo has a slow API and broken deploy. What do you fix first?',
        options: ['Rewrite the UI', 'Check logs and deploy pipeline', 'Add more animation'],
        answer: 1,
        win: 'Smart move. Find the failure point before scaling the fix.'
      },
      {
        prompt: 'Your landing page loads, but the project cards look empty. Next step?',
        options: ['Inspect data fetch / API response', 'Change all colors', 'Remove the cards'],
        answer: 0,
        win: 'Correct. Validate the data flow first.'
      },
      {
        prompt: 'Users say the portfolio feels heavy on mobile. Best move?',
        options: ['Add more 3D objects', 'Reduce expensive effects / assets', 'Increase shadows'],
        answer: 1,
        win: 'Nice. Performance first, polish second.'
      },
      {
        prompt: 'A critical bug is reported in production. Priority?',
        options: ['Write unit tests first', 'Investigate & hotfix immediately', 'Update documentation'],
        answer: 1,
        win: 'Correct. Stabilize production first, then improve.'
      },
      {
        prompt: 'Your code is 80% complete. What do you do?',
        options: ['Ship it as-is', 'Refactor & add tests', 'Skip and move to next task'],
        answer: 1,
        win: 'Good call. Quality > speed.'
      },
      {
        prompt: 'API is rate-limited. Next move?',
        options: ['Ignore limits and spam', 'Implement caching & backoff', 'Switch to a new API'],
        answer: 1,
        win: 'Smart. Respect limits and design resilience.'
      },
      {
        prompt: 'Database query is slow. First step?',
        options: ['Add more servers', 'Profile & identify the bottleneck', 'Rewrite everything'],
        answer: 1,
        win: 'Right. Measure before optimizing.'
      },
      {
        prompt: 'Security issue found. Do you?',
        options: ['Patch silently', 'Notify users & patch asap', 'Hope no one notices'],
        answer: 1,
        win: 'Excellent. Transparency builds trust.'
      },
    ];

    const getRandomRounds = () => {
      const shuffled = [...allRounds].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    };

    const [rounds, setRounds] = useState(() => getRandomRounds());
    const [roundIndex, setRoundIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState('Pick the best move to clear the stage.');
    const [streak, setStreak] = useState(0);

    const current = rounds[roundIndex];

    function choose(optionIndex) {
      if (optionIndex === current.answer) {
        const nextScore = score + 1;
        const nextStreak = streak + 1;
        setScore(nextScore);
        setStreak(nextStreak);
        setFeedback(`${current.win} +1 point`);
      } else {
        setStreak(0);
        setFeedback('Nope. Try again and pick the stronger move.');
      }
      setTimeout(() => {
        setRoundIndex((roundIndex + 1) % rounds.length);
      }, 650);
    }

    function resetGame() {
      setRounds(getRandomRounds());
      setRoundIndex(0);
      setScore(0);
      setStreak(0);
      setFeedback('Pick the best move to clear the stage.');
    }

    return (
      <div>
        <h4 className="font-bold text-cyan-300 mb-2">Neon Code Sprint</h4>
        <div className="flex items-center gap-3 mb-3 text-sm text-blue-200/80">
          <span className="px-2 py-1 rounded bg-blue-900/40 border border-blue-700/30">Score: {score}</span>
          <span className="px-2 py-1 rounded bg-blue-900/40 border border-blue-700/30">Streak: {streak}</span>
        </div>
        <p className="text-sm text-blue-100/80 p-4 bg-blue-900/20 rounded mb-3">{current.prompt}</p>
        <div className="grid grid-cols-1 gap-2">
          {current.options.map((option, i) => (
            <button key={i} onClick={() => choose(i)} className="px-4 py-2 bg-blue-800/40 rounded hover:bg-blue-700/50 text-left">
              {option}
            </button>
          ))}
        </div>
        <p className="text-sm text-cyan-200 mt-3">{feedback}</p>
        <div className="mt-3">
          <button onClick={resetGame} className="px-4 py-2 bg-cyan-500 rounded text-black font-bold">Reset Game</button>
        </div>
      </div>
    );
  }

  function GitHubStatsPanel() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let mounted = true;
      async function fetchStats() {
        setLoading(true);
        try {
          const token = import.meta.env.VITE_GITHUB_TOKEN || '';
          const headers = token ? { Authorization: `token ${token}` } : {};
          const res = await fetch('https://api.github.com/users/FLASH-4', { headers });
          if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
          const data = await res.json();
          if (!mounted) return;
          setStats({
            login: data.login,
            public_repos: data.public_repos,
            followers: data.followers,
            profile_url: data.html_url
          });
        } catch (err) {
          console.error(err);
        } finally {
          if (mounted) setLoading(false);
        }
      }
      fetchStats();
      return () => { mounted = false; };
    }, []);

    return (
      <div>
        <h4 className="text-2xl font-bold text-cyan-400 mb-3">FLASH-4</h4>
        {loading ? (
          <p className="text-blue-100/80 mb-8">Loading stats...</p>
        ) : stats ? (
          <p className="text-blue-100/80 mb-8">{stats.public_repos}+ public repositories • Active open-source contributor • {stats.followers}+ GitHub followers</p>
        ) : (
          <p className="text-blue-100/80 mb-8">Unable to load stats</p>
        )}
        <a href="https://github.com/FLASH-4" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-bold text-white transition hover:shadow-lg hover:shadow-blue-500/50">
          <Github size={20} /> Visit GitHub Profile
        </a>
      </div>
    );
  }

  function RecruiterPanel() {
    const template = `Hi Sreyansh,\n\nI enjoyed your portfolio. I'd like to schedule a quick call to discuss an opportunity.\n\nBest,\n[Your Name]`;

    // Gmail web compose link
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('vermasreyansh04@gmail.com')}&su=${encodeURIComponent('Quick chat about a role')}&body=${encodeURIComponent(template)}`;

    return (
      <div>
        <h4 className="font-bold text-cyan-300 mb-3">Quick Recruiter Tools</h4>
        <div className="space-y-4">
          <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-xl border border-blue-600/50 hover:border-cyan-400/70 hover:shadow-lg transition group">
            <Mail size={34} className="text-cyan-400 group-hover:scale-110 transition" />
            <div>
              <h5 className="font-bold text-cyan-400 text-lg">Open Gmail</h5>
              <p className="text-sm text-blue-100/70">Compose to vermasreyansh04@gmail.com</p>
            </div>
          </a>

          <div className="flex">
            <a href="https://github.com/FLASH-4" target="_blank" rel="noopener noreferrer" className="w-full px-4 py-3 bg-blue-800/40 rounded-lg text-center">GitHub</a>
          </div>
        </div>
      </div>
    );
  }

  function ContactPanel() {
    const template = `Hi Sreyansh,\n\nI found your portfolio and would love to discuss a role.\n\nBest,\n[Your Name]`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('vermasreyansh04@gmail.com')}&su=${encodeURIComponent('Quick chat about a role')}&body=${encodeURIComponent(template)}`;

    return (
      <div className="space-y-4">
        <a href="https://www.linkedin.com/in/sreyansh-verma-544758299" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-xl border border-blue-600/50 hover:border-cyan-400/70 hover:shadow-lg transition group">
          <Linkedin size={40} className="text-cyan-400 group-hover:scale-110 transition" />
          <div><h5 className="font-bold text-cyan-400 text-lg">LinkedIn</h5><p className="text-sm text-blue-100/70">@sreyansh-verma</p></div>
        </a>

        <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-xl border border-blue-600/50 hover:border-cyan-400/70 hover:shadow-lg transition group">
          <Mail size={40} className="text-cyan-400 group-hover:scale-110 transition" />
          <div><h5 className="font-bold text-cyan-400 text-lg">Email</h5><p className="text-sm text-blue-100/70">vermasreyansh04@gmail.com</p></div>
        </a>
      </div>
    );
  }

 

  // Projects panel (used by Projects planet) - fetches GitHub repos and separates deployed vs non-deployed
  function ProjectsPanel() {
    const [repos, setRepos] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('deployed'); // 'deployed' | 'non-deployed' | 'all'
    const [lastSynced, setLastSynced] = useState(null);
    const isMountedRef = useRef(true);

    const fetchRepos = async ({ showLoading = true } = {}) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const username = 'FLASH-4';
        const perPage = 100;
        const token = import.meta.env.VITE_GITHUB_TOKEN || '';
        const headers = token ? { Authorization: `token ${token}` } : {};
        const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=${perPage}&sort=updated`, { headers });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const data = await res.json();
        if (!isMountedRef.current) return;
        const filtered = data.filter(r => !r.fork).sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
        setRepos(filtered);
        setLastSynced(new Date());
      } catch (err) {
        console.error(err);
        if (!isMountedRef.current) return;
        setError(err.message || 'Failed to fetch repos');
      } finally {
        if (isMountedRef.current && showLoading) setLoading(false);
      }
    };

    useEffect(() => {
      isMountedRef.current = true;
      fetchRepos();

      const refreshInterval = setInterval(() => {
        fetchRepos({ showLoading: false });
      }, 120000);

      const handleFocus = () => fetchRepos({ showLoading: false });
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          fetchRepos({ showLoading: false });
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        isMountedRef.current = false;
        clearInterval(refreshInterval);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, []);

    // classify deployed: repo.homepage present OR has_pages true
    const deployed = (repos || []).filter(r => (r.homepage && r.homepage.trim().length > 0) || r.has_pages);
    const nonDeployed = (repos || []).filter(r => !((r.homepage && r.homepage.trim().length > 0) || r.has_pages));

    

    function RepoCard({ repo, deployedFlag }) {
      return (
        <a href={deployedFlag ? (repo.homepage || repo.html_url) : repo.html_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-900/10 rounded-lg border border-blue-700/20 hover:shadow-lg flex items-start justify-between">
          <div>
            <h5 className="font-bold text-cyan-300">{repo.name}</h5>
            <p className="text-sm text-blue-100/70">{repo.description || 'No description'}</p>
            <p className="text-xs text-blue-200/60 mt-2">Updated {new Date(repo.updated_at).toLocaleDateString()}</p>
          </div>
          <div className="text-sm text-blue-200 ml-4">★ {repo.stargazers_count}</div>
        </a>
      );
    }

    return (
      <div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('deployed')} className={`px-4 py-2 rounded ${tab==='deployed' ? 'bg-cyan-500 text-black font-bold' : 'bg-blue-800/30 text-blue-100'}`}>Deployed / Live</button>
          <button onClick={() => setTab('non-deployed')} className={`px-4 py-2 rounded ${tab==='non-deployed' ? 'bg-cyan-500 text-black font-bold' : 'bg-blue-800/30 text-blue-100'}`}>Non-deployed</button>
          <button onClick={() => setTab('all')} className={`px-4 py-2 rounded ${tab==='all' ? 'bg-cyan-500 text-black font-bold' : 'bg-blue-800/30 text-blue-100'}`}>All</button>
        </div>

        {lastSynced && (
          <p className="text-xs text-blue-200/60 mb-3">
            Auto-refreshed {lastSynced.toLocaleTimeString()} • updates every 2 minutes and on window focus
          </p>
        )}

        {loading && <p className="text-sm text-blue-200">Loading repositories...</p>}
        {error && <p className="text-sm text-rose-400">{error}</p>}

        {!loading && !repos && (
          <div className="space-y-3">
            <p className="text-sm text-blue-200">No repositories found.</p>
          </div>
        )}

        {!loading && repos && (
          <div className="grid grid-cols-1 gap-3">
            {tab === 'deployed' && (
              <>
                
                {deployed.length === 0 && <p className="text-sm text-blue-200">No deployed repos found in GitHub results.</p>}
                {deployed.map(r => <RepoCard key={r.id} repo={r} deployedFlag />)}
              </>
            )}

            {tab === 'non-deployed' && (
              <>
                {nonDeployed.length === 0 && <p className="text-sm text-blue-200">No non-deployed repos found.</p>}
                {nonDeployed.map(r => <RepoCard key={r.id} repo={r} deployedFlag={false} />)}
              </>
            )}

            {tab === 'all' && (
              <>
                
                {repos.map(r => <RepoCard key={r.id} repo={r} deployedFlag={(r.homepage && r.homepage.trim().length>0) || r.has_pages} />)}
              </>
            )}
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-900/95 to-blue-950/95 border border-cyan-500/50 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-cyan-500/20 hidden-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            {data[type].title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-900/50 rounded-lg transition hover:scale-110">
            <X size={32} className="text-cyan-400" />
          </button>
        </div>
        <div className="text-blue-100/80 space-y-4">
          {data[type].content}
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(message, timeout = 2000) {
    setToast(message);
    setTimeout(() => setToast(null), timeout);
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {/* Nebula glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl" style={{animation: 'pulse 15s ease-in-out infinite'}}></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-3xl" style={{animation: 'pulse 20s ease-in-out infinite'}}></div>
        <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" style={{animation: 'pulse 12s ease-in-out infinite'}}></div>
      </div>

      {/* Three.js Canvas */}
      <Canvas 
        camera={{ position: [0, 35, 120], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
      >
        <SolarSystem onPlanetClick={(index) => setSelectedPlanet(index)} />
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          maxDistance={400} 
          minDistance={50}
          autoRotate={false}
        />
      </Canvas>

      {/* Header (left-aligned) */}
      <div className="absolute top-0 left-0 z-30 p-6 pointer-events-auto overflow-visible">
        <div className="flex flex-col">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-xl leading-relaxed pb-2">
            Sreyansh Verma
          </h1>
          <p className="text-base sm:text-lg text-cyan-200 mt-1 font-semibold drop-shadow-lg">Full Stack Developer & AI Enthusiast</p>
        </div>
      </div>

      {/* GitHub Button (right edge) */}
      <a
        href="https://github.com/FLASH-4"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-bold text-white transition hover:shadow-lg hover:scale-105 pointer-events-auto"
      >
        <Github size={18} />
        <span className="hidden sm:inline">GitHub</span>
      </a>
      {/* Bottom Info */}
      <div className="fixed bottom-0 left-0 right-0 z-10 p-8 text-center pointer-events-none">
        <p className="text-cyan-300 font-bold text-lg mb-2">🌟 Click on planets to explore my work</p>
        <p className="text-blue-200/70 text-sm">Drag to rotate • Scroll to zoom • Immersive journey through my portfolio</p>
      </div>

      {/* Data Panel Modal */}
      {selectedPlanet !== null && (
        <DataPanel type={selectedPlanet} onClose={() => setSelectedPlanet(null)} showToast={showToast} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-60 px-4 py-2 rounded-lg bg-black/70 border border-cyan-600/40 text-cyan-200 shadow-lg">{toast}</div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.2; }
        }
        /* Hidden scrollbar for DataPanel */
        .hidden-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge legacy */
        }
        .hidden-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}