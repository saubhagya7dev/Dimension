import * as THREE from 'three';

interface OrbitProject { image: string; cell: number | null; title: string; }
interface FloatingTile {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  phase: number;
  lane: number;
  speed: number;
  scale: number;
}

/** Optional decoration only: links and the complete gallery live in accessible HTML. */
export async function initOrbitalHero(stage: HTMLElement) {
  const host = stage.querySelector<HTMLElement>('[data-orbital-world]');
  const toggle = stage.querySelector<HTMLButtonElement>('[data-orbit-toggle]');
  if (!host || stage.dataset.orbitInitialized) return;
  stage.dataset.orbitInitialized = 'true';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    stage.dataset.orbitState = 'fallback';
    return;
  }
  renderer.setClearColor(0x111214, 0);
  // Preserve the original crispness; retain the slow-device fallback below.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.setAttribute('role', 'presentation');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 60);
  camera.position.set(0, 0, 12);
  const world = new THREE.Group();
  scene.add(world);
  const accent = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5e5e');
  const projects = JSON.parse(host.dataset.projects || '[]') as OrbitProject[];
  const textures = new Map<string, THREE.Texture>();
  const loader = new THREE.TextureLoader();
  let disposed = false;

  // One request per source image, shared by all orbital cards.
  await Promise.all([...new Set(projects.map(project => project.image))].map(async source => {
    try {
      const texture = await loader.loadAsync(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.set(source, texture);
    } catch { /* Keep the HTML composition if media cannot load. */ }
  }));

  if (!textures.size) {
    renderer.dispose();
    renderer.domElement.remove();
    stage.dataset.orbitState = 'fallback';
    return;
  }

  const tiles: FloatingTile[] = [];
  const count = 15;
  for (let index = 0; index < count; index++) {
    const project = projects[index % projects.length];
    const texture = textures.get(project.image);
    if (!texture) continue;
    const tileAspect = 1.4 + (index % 3) * .13;
    const geometry = new THREE.PlaneGeometry(1.85, 1.85 / tileAspect, 18, 8);
    const positions = geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      // A shallow curved surface gives the artwork physical presence.
      positions.setZ(vertex, -.12 * x * x);
    }
    geometry.computeVertexNormals();
    const sheet = project.cell !== null;
    const image = texture.image as { width: number; height: number };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: texture },
        uOffset: { value: new THREE.Vector2(sheet ? (project.cell! % 3) / 3 : 0, sheet ? (2 - Math.floor(project.cell! / 3)) / 3 : 0) },
        uScale: { value: sheet ? 1 / 3 : 1 },
        uImageAspect: { value: sheet ? 1 : image.width / image.height },
        uTileAspect: { value: tileAspect },
        uOpacity: { value: .8 },
      },
      vertexShader: `
        varying vec2 vLocalUv;
        void main() {
          vLocalUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec2 uOffset;
        uniform float uScale;
        uniform float uOpacity;
        uniform float uImageAspect;
        uniform float uTileAspect;
        varying vec2 vLocalUv;
        void main() {
          vec2 box = abs(vLocalUv - .5) - vec2(.445);
          float distance = length(max(box, 0.0)) + min(max(box.x, box.y), 0.0) - .055;
          float mask = 1.0 - smoothstep(-.006, .004, distance);
          if (mask < .01) discard;
          vec2 crop = vLocalUv;
          float ratio = uTileAspect / uImageAspect;
          if (ratio > 1.0) crop.y = (crop.y - .5) / ratio + .5;
          else crop.x = (crop.x - .5) * ratio + .5;
          vec4 color = texture2D(uMap, uOffset + crop * uScale);
          float edge = smoothstep(-.016, -.004, distance);
          color.rgb = mix(color.rgb, vec3(.8), edge * .25);
          gl_FragColor = vec4(color.rgb, color.a * mask * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = index;
    world.add(mesh);
    tiles.push({ mesh, phase: (index / count) * Math.PI * 2, lane: index % 3, speed: index % 2 ? .032 : .026, scale: .83 + (index % 4) * .13 });
  }

  const rings: THREE.Line[] = [];
  for (let lane = 0; lane < 3; lane++) {
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 160; step++) {
      const angle = step / 160 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * (7.1 + lane * .65), Math.sin(angle) * (3.45 + lane * .4), -1.1 + Math.sin(angle * 2) * .5));
    }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: lane === 1 ? 0x727a87 : accent, transparent: true, opacity: lane === 1 ? .13 : .22 }));
    ring.rotation.z = (lane - 1) * .23;
    ring.rotation.y = (lane - 1) * .18;
    world.add(ring);
    rings.push(ring);
  }
  const tickPoints: number[] = [];
  for (let tick = 0; tick < 90; tick++) {
    const angle = tick / 90 * Math.PI * 2;
    const length = tick % 5 === 0 ? .14 : .055;
    tickPoints.push(Math.cos(angle) * 6.7, Math.sin(angle) * 3.2, -.9);
    tickPoints.push(Math.cos(angle) * (6.7 + length), Math.sin(angle) * (3.2 + length), -.9);
  }
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tickPoints, 3)), new THREE.LineBasicMaterial({ color: 0x93979c, transparent: true, opacity: .19 }));
  world.add(ticks);

  let elapsed = 0;
  let previousTime = 0;
  let inView = true;
  let manuallyPaused = false;
  let contextLost = false;
  let running = false;
  let scrollPhase = 0;
  let targetScrollPhase = 0;
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  let width = 0;
  let sectionTop = 0;
  let stageHeight = 1;
  let headerHeight = 0;
  let pointerBounds = { left: 0, top: 0, width: 1, height: 1 };
  let frameCost = 0;
  let slowFrames = 0;
  let resolutionScale = 1;

  function draw(time: number) {
    if (disposed) return;
    const started = performance.now();
    const delta = previousTime ? Math.min((time - previousTime) / 1000, .08) : 0;
    previousTime = time;
    if (running) {
      elapsed += delta;
      // Position-based rotation is reversible: scrolling back retraces the orbit.
      // Ambient drift remains deliberately slower than the scroll contribution.
      scrollPhase += (targetScrollPhase - scrollPhase) * (1 - Math.exp(-9 * delta));
    }
    smoothPointer.lerp(pointer, 1 - Math.exp(-5 * delta));
    camera.position.x = smoothPointer.x * .35;
    camera.position.y = smoothPointer.y * .22;
    camera.lookAt(0, 0, 0);
    const horizontalScale = width < 950 ? .78 : Math.min(1.12, width / 1280);
    tiles.forEach((tile, index) => {
      const angle = tile.phase + elapsed * tile.speed + scrollPhase * (1 + tile.lane * .06);
      const radiusX = (7.0 + tile.lane * .55) * horizontalScale;
      const radiusY = 3.30 + tile.lane * .35;
      tile.mesh.position.set(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, Math.sin(angle + tile.lane) * 1.15 - .2);
      tile.mesh.rotation.set(Math.sin(angle) * .12, Math.cos(angle) * -.22, Math.sin(angle + index) * .09);
      tile.mesh.scale.setScalar(tile.scale);
      tile.mesh.material.uniforms.uOpacity.value = .55 + (tile.mesh.position.z + 1.35) / 2.5 * .35;
    });
    rings.forEach((ring, index) => { ring.scale.x = horizontalScale; ring.rotation.z = (index - 1) * .23 + Math.sin(elapsed * .045) * .035 + scrollPhase * .10; });
    ticks.scale.x = horizontalScale;
    ticks.rotation.z = scrollPhase * .08;
    renderer.render(scene, camera);
    // Lower the buffer once if rendering repeatedly exceeds a frame budget.
    // Animation keeps following display refresh rather than skipping alternate frames.
    frameCost = frameCost * .95 + (performance.now() - started) * .05;
    if (running && frameCost > 12) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && resolutionScale > .7) {
      resolutionScale = .7;
      renderer.setPixelRatio(resolutionScale);
      stage.dataset.orbitQuality = 'balanced';
    }
  }

  function syncPlayback() {
    if (disposed) return;
    const staticMode = reduced.matches || width <= 600;
    stage.dataset.orbitState = contextLost ? 'fallback' : staticMode ? 'static' : 'ready';
    running = !staticMode && !contextLost && inView && !document.hidden && !manuallyPaused;
    stage.dataset.orbitPlayback = running ? 'running' : 'paused';
    stage.closest('.orbital-hero')?.classList.toggle('is-motion-suspended', !running);
    previousTime = 0;
    renderer.setAnimationLoop(running ? draw : null);
    if (!contextLost && !staticMode) draw(performance.now());
    const video = stage.querySelector<HTMLVideoElement>('.hero-video');
    if (video) {
      if (running) void video.play().catch(() => {});
      else video.pause();
    }
  }
  function resize() {
    const bounds = host!.getBoundingClientRect();
    const section = stage.closest<HTMLElement>('.tracked-section');
    sectionTop = (section?.getBoundingClientRect().top || 0) + window.scrollY;
    stageHeight = Math.max(1, stage.clientHeight);
    headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
    const stageBounds = stage.getBoundingClientRect();
    pointerBounds = { left: stageBounds.left, top: stageBounds.top + window.scrollY, width: stageBounds.width, height: stageBounds.height };
    width = bounds.width;
    camera.aspect = bounds.width / Math.max(1, bounds.height);
    camera.updateProjectionMatrix();
    renderer.setSize(bounds.width, bounds.height, false);
    updateScrollPhase();
    syncPlayback();
  }
  function updateScrollPhase() {
    const travel = Math.max(0, window.scrollY - sectionTop + headerHeight);
    targetScrollPhase = Math.min(1.6, travel / stageHeight) * 2.1;
  }
  function pointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    pointer.set((event.clientX - pointerBounds.left) / pointerBounds.width * 2 - 1, -((event.clientY + window.scrollY - pointerBounds.top) / pointerBounds.height * 2 - 1));
  }
  function resetPointer() { pointer.set(0, 0); }
  function toggleMotion() {
    manuallyPaused = !manuallyPaused;
    toggle?.setAttribute('aria-pressed', String(manuallyPaused));
    toggle?.setAttribute('aria-label', manuallyPaused ? 'Resume orbital animation' : 'Pause orbital animation');
    const label = toggle?.querySelector('[data-orbit-toggle-label]');
    if (label) label.textContent = manuallyPaused ? 'Resume motion' : 'Pause motion';
    const icon = toggle?.querySelector('span');
    if (icon) icon.textContent = manuallyPaused ? '▷' : 'Ⅱ';
    stage.closest('.orbital-hero')?.classList.toggle('is-motion-paused', manuallyPaused);
    syncPlayback();
  }
  const resizeObserver = new ResizeObserver(resize);
  headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
  const visibilityObserver = new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? false;
    stage.closest('.orbital-hero')?.classList.toggle('is-offscreen', !inView);
    syncPlayback();
  }, { threshold: 0, rootMargin: `-${headerHeight}px 0px 0px 0px` });
  resizeObserver.observe(host);
  visibilityObserver.observe(stage);
  stage.addEventListener('pointermove', pointerMove, { passive: true });
  stage.addEventListener('pointerleave', resetPointer);
  window.addEventListener('scroll', updateScrollPhase, { passive: true });
  toggle?.addEventListener('click', toggleMotion);
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', syncPlayback);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    syncPlayback();
  });
  function cleanup(event: PageTransitionEvent) {
    if (event.persisted) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    stage.removeEventListener('pointermove', pointerMove);
    stage.removeEventListener('pointerleave', resetPointer);
    window.removeEventListener('scroll', updateScrollPhase);
    toggle?.removeEventListener('click', toggleMotion);
    document.removeEventListener('visibilitychange', syncPlayback);
    reduced.removeEventListener('change', syncPlayback);
    tiles.forEach(tile => { tile.mesh.geometry.dispose(); tile.mesh.material.dispose(); });
    rings.forEach(ring => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); });
    ticks.geometry.dispose(); (ticks.material as THREE.Material).dispose();
    textures.forEach(texture => texture.dispose());
    renderer.dispose();
  }
  window.addEventListener('pagehide', cleanup, { once: true });
  resize();
}
