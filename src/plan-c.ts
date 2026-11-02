import * as THREE from 'three';
import { panoramaPixelRatio, verticalFov } from './panorama-rendering';
import './plan-c.css';

interface Room {
  id: string; name: string; english?: string; note?: string;
  still?: string | null; panorama?: string | null; camera_id?: string;
  panorama_mobile?: string | null; panorama_width?: number;
  dimensions?: string; area_m2?: number; panorama_yaw_rad?: number;
}
interface Artifact { label: string; path: string; size?: number | string }
interface Step { id: string; label: string; status: string; detail?: string }
interface Project {
  project_id: string; title?: string; style?: string; revision: number;
  status?: string; stage?: string; notices?: (string | { message?: string; description?: string })[];
  rooms: Room[]; artifacts?: Artifact[]; pipeline?: Step[]; metrics?: Record<string, unknown>;
  palette?: (string | { color: string; name?: string })[]; engine?: string; rendered_at?: string;
}
interface Scene {
  rooms?: { id: string; name: string; boundary_xy_m: number[][] }[];
  walls?: { id: string; path_xy_m: number[][]; thickness_m: number }[];
  openings?: { id: string; host_wall_id: string; offset_from_start_m: number; width_m: number; type: string }[];
  [key: string]: unknown;
}
type Mode = 'gallery' | 'panorama' | 'floorplan' | 'project';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]!));
const base = `${import.meta.env.BASE_URL}plan-c/`;
const asset = (path: string) => /^https?:\/\//.test(path) ? path : path.startsWith(import.meta.env.BASE_URL) ? path : `${base}${path.replace(/^\/?plan-c\//, '').replace(/^\//, '')}`;
const arrows = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h15"/></svg>';
const icons: Record<Mode, string> = {
  gallery: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="m3 16 5-5 5 5 3-3 5 4"/><circle cx="16" cy="9" r="1"/>',
  panorama: '<ellipse cx="12" cy="12" rx="9" ry="6"/><path d="m16 5 3 2-3 2M8 19l-3-2 3-2M12 6v12"/>',
  floorplan: '<path d="M3 3h18v18H3zM3 11h9V3m0 8v10m0-6h9"/>',
  project: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/>',
};
const modeLabels: Record<Mode, string> = { gallery: '空间效果', panorama: '360° 环顾', floorplan: '户型与结构', project: '项目与交付' };
const modeIcon = (mode: Mode) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${icons[mode]}</svg>`;
const statusName = (status: string) => ({ success: '已完成', pass: '已通过', passed: '已通过', completed: '已完成', ready: '已就绪', warning: '待复核', needs_confirmation: '待确认', running: '进行中', pending: '待执行', failed: '未通过', fail: '未通过', blocked: '待补齐', not_run: '未执行', preview: '预览' }[status.toLowerCase()] || status);
const statusClass = (status: string) => /^(success|pass|passed|completed|ready)$/.test(status.toLowerCase()) ? 'complete' : /fail|block/.test(status.toLowerCase()) ? 'blocked' : 'pending';

export async function startPlanC() {
  document.body.className = 'plan-c-page';
  document.title = '日光花园 · Blender 实景 | 栖光 Plan C';
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = `<div class="pc-initial"><span class="pc-logomark">栖</span><span>正在打开日光花园…</span></div>`;
  let project: Project;
  let scene: Scene | null = null;
  try {
    const [projectResponse, sceneResponse] = await Promise.allSettled([fetch(`${base}project.json`), fetch(`${base}scene.json`)]);
    if (projectResponse.status !== 'fulfilled' || !projectResponse.value.ok) throw new Error('项目清单暂未生成');
    project = await projectResponse.value.json();
    if (!Array.isArray(project.rooms) || !project.rooms.length) throw new Error('项目清单中尚无空间');
    if (sceneResponse.status === 'fulfilled' && sceneResponse.value.ok) scene = await sceneResponse.value.json();
  } catch (error) {
    app.innerHTML = `<main class="pc-start-error"><span class="pc-eyebrow">PLAN C · BLENDER ARCHVIZ</span><h1>日光花园，正在搭建。</h1><p>${esc(error instanceof Error ? error.message : '项目暂未能载入')}。请确认项目制品已导出，再重新打开。</p><button onclick="location.reload()">重新载入</button><a href="${import.meta.env.BASE_URL}?design=sunlit">${back}返回四套风格全景</a></main>`;
    return;
  }
  const query = new URLSearchParams(location.search);
  let room = project.rooms.find(item => item.id === query.get('room')) || project.rooms[0];
  let mode: Mode = Object.hasOwn(modeLabels, query.get('mode') || '') ? query.get('mode') as Mode : 'gallery';
  let disposePanorama: (() => void) | null = null;
  let disposeStructure: (() => void) | null = null;
  let structureReady = false;
  let structureObjectCount = 0;
  let actualPanoramaUrl: string | null = null;
  let actualPanoramaWidth: number | null = null;
  let mediaTicket = 0;
  const palette = project.palette?.length ? project.palette : [
    { color: '#d2b58e', name: '浅色橡木' }, { color: '#f1ede1', name: '暖白' },
    { color: '#8b9674', name: '鼠尾草绿' }, { color: '#ded5c2', name: '天然棉麻' },
  ];
  app.innerHTML = `<div class="pc-shell">
    <header class="pc-header"><a class="pc-brand" href="${import.meta.env.BASE_URL}"><span class="pc-logomark">栖</span><span>栖光<small>A QUIETER HOME</small></span></a><div class="pc-project-label"><span>PLAN C</span>真实三维 · 同源空间</div><a class="pc-back" href="${import.meta.env.BASE_URL}?design=sunlit">${back}<span>返回四套风格</span></a></header>
    <aside class="pc-sidebar"><div class="pc-side-intro"><span class="pc-eyebrow">THE SUNLIT GARDEN</span><h1>日光花园<span>让家，自然生长。</span></h1><p>浅木、暖白，和一抹植物绿。<br>从真实的空间，感受家的尺度。</p></div><div class="pc-section-label">空间导览 <span>${String(project.rooms.length).padStart(2, '0')} SPACES</span></div><nav class="pc-room-nav" aria-label="Plan C 空间导览">${project.rooms.map((item, index) => `<button class="pc-room" data-pc-room="${esc(item.id)}"><span class="pc-room-number">${String(index + 1).padStart(2, '0')}</span><span>${esc(item.name)}<small>${esc(item.english || item.id.toUpperCase())}</small></span><span class="pc-room-arrow">↗</span></button>`).join('')}</nav><div class="pc-materials"><span class="pc-eyebrow">A NATURAL PALETTE</span><div class="pc-swatches">${palette.map(item => { const swatch = typeof item === 'string' ? { color: item, name: item } : item; return `<span style="--swatch:${esc(swatch.color)}" title="${esc(swatch.name)}"></span>`; }).join('')}</div><p>原木的温度 · 棉麻的触感 · 自然的绿</p></div><a class="pc-source-shortcut" href="#" data-pc-mode="floorplan">以原始户型为起点 ${arrows}</a></aside>
    <main class="pc-main"><div class="pc-heading"><div><span class="pc-eyebrow">A HOME, IN THE MAKING</span><h2>把日光，留在家里。</h2></div><span class="pc-edition"><span></span>日光花园 · 首版方案</span></div><div class="pc-viewbar"><nav aria-label="项目查看方式">${(Object.keys(modeLabels) as Mode[]).map(item => `<button data-pc-mode="${item}">${modeIcon(item)}<span>${modeLabels[item]}</span></button>`).join('')}</nav><span class="pc-revision">SCENE ${String(project.revision).padStart(3, '0')}</span></div><section class="pc-stage" id="pc-stage" aria-label="空间效果"></section><div class="pc-room-caption"><div><span class="pc-room-caption-number" id="pc-room-index"></span><h3 id="pc-room-title"></h3><span class="pc-caption-dimensions" id="pc-room-dimensions"></span></div><p id="pc-room-note"></p></div><nav class="pc-filmstrip" aria-label="选择空间效果">${project.rooms.map(item => `<button data-pc-room="${esc(item.id)}" class="pc-thumbnail">${item.still ? `<img src="${esc(asset(item.still))}" alt="${esc(item.name)}渲染预览" loading="lazy">` : `<span class="pc-thumbnail-pending">${modeIcon('gallery')}<small>待渲染</small></span>`}<span>${esc(item.name)}<small>${item.still ? 'BLENDER RENDER' : 'SCENE READY'}</small></span></button>`).join('')}</nav><footer class="pc-footer"><span>同一场景，多个视角。</span><span>BLENDER / CYCLES <i></i> 日光花园原木</span></footer></main>
  </div>`;
  const stage = document.querySelector<HTMLElement>('#pc-stage')!;
  const conceptUpdate = document.createElement('a');
  conceptUpdate.className = 'pc-concept-update';
  conceptUpdate.href = `${import.meta.env.BASE_URL}concepts/sunlit-refined.html?room=${room.id}`;
  conceptUpdate.innerHTML = '<span>日光花园 · 整体风格优化</span><span>查看概念图与初版对照 ↗</span>';
  document.querySelector('.pc-heading')!.after(conceptUpdate);
  for (const thumbnail of document.querySelectorAll<HTMLImageElement>('.pc-thumbnail img')) thumbnail.addEventListener('error', () => {
    const placeholder = document.createElement('span'); placeholder.className = 'pc-thumbnail-pending'; placeholder.innerHTML = `${modeIcon('gallery')}<small>暂未载入</small>`; thumbnail.replaceWith(placeholder);
  }, { once: true });

  function updateUrl() {
    const url = new URL(location.href); url.searchParams.set('view', 'plan-c'); url.searchParams.set('room', room.id); url.searchParams.set('mode', mode); history.replaceState(null, '', url);
    conceptUpdate.href = `${import.meta.env.BASE_URL}concepts/sunlit-refined.html?room=${room.id}`;
  }
  function chooseRoom(id: string) { const next = project.rooms.find(item => item.id === id); if (next) { room = next; render(); } }
  function chooseMode(next: Mode) { if (Object.hasOwn(modeLabels, next)) { mode = next; render(); } }
  app.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pc-room], [data-pc-mode]');
    if (!target) return; event.preventDefault();
    if (target.dataset.pcRoom) chooseRoom(target.dataset.pcRoom);
    if (target.dataset.pcMode) chooseMode(target.dataset.pcMode as Mode);
  });

  function pending(kind: 'still' | 'panorama', failed = false) {
    stage.classList.add('pc-no-render');
    stage.innerHTML = `<div class="pc-pending"><span class="pc-pending-icon">${modeIcon(kind === 'still' ? 'gallery' : 'panorama')}</span><span class="pc-eyebrow">${failed ? 'RENDER UNAVAILABLE' : 'SCENE → RENDER'}</span><h3>${failed ? '这张效果暂未能载入' : `${room.name}${kind === 'panorama' ? '的 360°' : '效果'}正在等待渲染`}</h3><p>${failed ? '可以重新载入，也可以查看同一项目的其他空间。' : '三维场景中的空间保留在这里；完成渲染后，将显示这份工程的真实输出。'}</p><div>${failed ? '<button id="pc-retry">重新载入</button>' : ''}<button data-pc-mode="floorplan">查看户型结构 ↗</button><button data-pc-mode="project">查看项目进度 ↗</button></div></div>`;
    stage.querySelector('#pc-retry')?.addEventListener('click', render);
  }

  function gallery(ticket: number) {
    if (!room.still) { pending('still'); return; }
    stage.innerHTML = `<div class="pc-image-loading" role="status"><span></span>正在铺开空间…</div><img class="pc-hero-image" id="pc-hero-image" alt="${esc(room.name)}，日光花园 Blender 场景渲染"><div class="pc-image-top"><span class="pc-render-badge"><i></i>BLENDER · CYCLES</span><a class="pc-image-open" href="${esc(asset(room.still))}" target="_blank" rel="noopener" aria-label="打开${esc(room.name)}原始渲染">${arrows}</a></div><div class="pc-image-bottom"><span><small>THE SUNLIT GARDEN</small>${esc(room.name)}</span>${room.panorama ? `<button data-pc-mode="panorama">${modeIcon('panorama')}进入 360° 环顾 <span>↗</span></button>` : '<span class="pc-preview-tag">场景渲染预览</span>'}</div>`;
    const image = stage.querySelector<HTMLImageElement>('#pc-hero-image')!;
    image.addEventListener('load', () => { if (ticket === mediaTicket) { stage.classList.add('pc-media-ready'); stage.querySelector('.pc-image-loading')?.remove(); } }, { once: true });
    image.addEventListener('error', () => { if (ticket === mediaTicket) pending('still', true); }, { once: true });
    image.src = asset(room.still);
  }

  function floorplan() {
    const structureArtifact = project.artifacts?.find(item => /(?:^|\/)scene\.glb(?:\?|$)/.test(item.path));
    stage.innerHTML = `<div class="pc-plan"><div class="pc-plan-toolbar"><div><span class="pc-eyebrow">FROM THE ORIGINAL PLAN</span><h3>先有结构，再有生活。</h3></div><div role="group" aria-label="户型图类型"><button id="pc-plan-model" aria-pressed="true">场景户型</button><button id="pc-plan-source" aria-pressed="false">原始图纸</button><button id="pc-plan-three" aria-pressed="false" ${structureArtifact ? '' : 'disabled title="三维结构文件尚未导出"'}>查看三维结构</button></div></div><div class="pc-plan-drawing" id="pc-plan-drawing"></div><p class="pc-plan-note" id="pc-plan-note"><span></span>保留原图隔墙 · 图上尺寸含估算值，待现场复测 · 图上方不代表真实北向</p></div>`;
    const drawing = stage.querySelector<HTMLElement>('#pc-plan-drawing')!;
    const modelButton = stage.querySelector<HTMLButtonElement>('#pc-plan-model')!;
    const sourceButton = stage.querySelector<HTMLButtonElement>('#pc-plan-source')!;
    const threeButton = stage.querySelector<HTMLButtonElement>('#pc-plan-three')!;
    const note = stage.querySelector<HTMLElement>('#pc-plan-note')!;
    const show = (view: 'plan' | 'source' | 'three') => {
      disposeStructure?.(); disposeStructure = null; structureReady = false; structureObjectCount = 0;
      modelButton.setAttribute('aria-pressed', String(view === 'plan')); sourceButton.setAttribute('aria-pressed', String(view === 'source')); threeButton.setAttribute('aria-pressed', String(view === 'three'));
      note.innerHTML = `<span></span>${view === 'three' ? '拖动旋转 · 滚轮缩放 · 右键平移 · 同源结构模型，材质以 Cycles 效果图为准' : '保留原图隔墙 · 图上尺寸含估算值，待现场复测 · 图上方不代表真实北向'}`;
      if (view === 'three' && structureArtifact) { void structureModel(drawing, asset(structureArtifact.path), mediaTicket); return; }
      if (view === 'source') { drawing.innerHTML = `<img src="${base}home1.png" class="pc-original-plan" alt="home1 原始房屋结构图">`; return; }
      if (!scene?.rooms?.length) { drawing.innerHTML = `<p>场景结构数据暂未导出。可切换原始图纸查看。</p>`; return; }
      const points = scene.rooms.flatMap(item => item.boundary_xy_m);
      const minX = Math.min(...points.map(p => p[0])) - .5, maxX = Math.max(...points.map(p => p[0])) + .5;
      const minY = Math.min(...points.map(p => p[1])) - .5, maxY = Math.max(...points.map(p => p[1])) + .5;
      const y = (value: number) => maxY - value + minY;
      const wallLines = (scene.walls || []).map(wall => `<polyline points="${wall.path_xy_m.map(p => `${p[0]},${y(p[1])}`).join(' ')}" fill="none" stroke="#48513e" stroke-width="${wall.thickness_m}" stroke-linecap="square"/>`).join('');
      const openings = (scene.openings || []).map(opening => {
        const wall = scene!.walls?.find(item => item.id === opening.host_wall_id); if (!wall || wall.path_xy_m.length < 2) return '';
        const [a, b] = wall.path_xy_m, length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!length) return '';
        const point = (offset: number) => [a[0] + (b[0] - a[0]) * offset / length, a[1] + (b[1] - a[1]) * offset / length];
        const start = point(opening.offset_from_start_m), end = point(opening.offset_from_start_m + opening.width_m);
        return `<line x1="${start[0]}" y1="${y(start[1])}" x2="${end[0]}" y2="${y(end[1])}" stroke="${opening.type === 'window' ? '#a8b9a0' : '#f3f0e7'}" stroke-width="${wall.thickness_m + .025}"/>`;
      }).join('');
      drawing.innerHTML = `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="img" aria-label="Plan C 场景户型，选择房间查看效果">${scene.rooms.map(item => { const poly = item.boundary_xy_m; const cx = poly.reduce((sum, p) => sum + p[0], 0) / poly.length, cy = poly.reduce((sum, p) => sum + p[1], 0) / poly.length; const target = project.rooms.find(candidate => candidate.id === item.id); return `<g ${target ? `data-pc-room="${esc(target.id)}" role="button" tabindex="0" aria-label="选择${esc(item.name)}"` : ''} class="pc-plan-room ${room.id === item.id ? 'active' : ''}"><polygon points="${poly.map(p => `${p[0]},${y(p[1])}`).join(' ')}"/><text x="${cx}" y="${y(cy)}">${esc(item.name)}</text></g>`; }).join('')}${wallLines}${openings}</svg>`;
      drawing.querySelectorAll<HTMLElement>('[data-pc-room]').forEach(el => el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseRoom(el.dataset.pcRoom!); } }));
    };
    modelButton.addEventListener('click', () => show('plan')); sourceButton.addEventListener('click', () => show('source')); threeButton.addEventListener('click', () => show('three')); show('plan');
  }

  async function structureModel(container: HTMLElement, path: string, ticket: number) {
    container.innerHTML = '<div class="pc-structure-loading" role="status"><span></span>正在打开同源三维结构…</div>';
    let cancelled = false;
    disposeStructure = () => { cancelled = true; structureReady = false; };
    try {
      const [{ GLTFLoader }, { OrbitControls }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js')]);
      if (cancelled || ticket !== mediaTicket || !container.isConnected) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = 'pc-structure-canvas'; renderer.domElement.setAttribute('aria-label', '可旋转的三维户型结构'); container.append(renderer.domElement);
      const world = new THREE.Scene(); world.background = new THREE.Color('#efeee4');
      world.add(new THREE.HemisphereLight('#fffaf0', '#9a9b83', 2));
      const sun = new THREE.DirectionalLight('#fff3d9', 2.3); sun.position.set(-8, 18, 10); world.add(sun);
      const camera = new THREE.PerspectiveCamera(40, 1, .05, 1000);
      const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.maxPolarAngle = Math.PI * .48; controls.minDistance = 2;
      let model: THREE.Object3D | null = null, resizeObserver: ResizeObserver | null = null;
      const disposeModel = (object: THREE.Object3D) => {
        const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
        object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material); } });
        for (const material of materials) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); }
        for (const texture of textures) texture.dispose();
      };
      const paint = () => { if (!cancelled) renderer.render(world, camera); };
      const resize = () => { const { width, height } = container.getBoundingClientRect(); if (!width || !height || cancelled) return; renderer.setPixelRatio(panoramaPixelRatio(width, height, devicePixelRatio)); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); paint(); };
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); controls.addEventListener('change', paint); resize();
      disposeStructure = () => { if (cancelled) return; cancelled = true; structureReady = false; resizeObserver?.disconnect(); controls.removeEventListener('change', paint); controls.dispose(); if (model) disposeModel(model); renderer.dispose(); renderer.forceContextLoss(); };
      new GLTFLoader().load(path, gltf => {
        if (cancelled || ticket !== mediaTicket || !container.isConnected) { disposeModel(gltf.scene); return; }
        model = gltf.scene; world.add(model);
        const bounds = new THREE.Box3().setFromObject(model), sphere = bounds.getBoundingSphere(new THREE.Sphere());
        if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) { disposeStructure?.(); container.innerHTML = '<p class="pc-structure-error">三维文件中没有可显示的几何。请重新导出场景。</p>'; return; }
        controls.target.copy(sphere.center);
        const direction = new THREE.Vector3(.85, 1.15, 1.25).normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
        const up = new THREE.Vector3().crossVectors(direction, right).normalize();
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        let distance = 0;
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(sphere.center);
          distance = Math.max(distance, corner.dot(direction) + Math.max(Math.abs(corner.dot(right)) / (tangent * camera.aspect), Math.abs(corner.dot(up)) / tangent));
        }
        distance *= 1.1;
        camera.position.copy(sphere.center).add(direction.multiplyScalar(distance));
        controls.maxDistance = distance * 2.5; controls.minDistance = sphere.radius * .3; camera.far = distance * 20; camera.updateProjectionMatrix(); controls.update();
        model.traverse(child => { if (child instanceof THREE.Mesh) structureObjectCount++; });
        structureReady = true; container.querySelector('.pc-structure-loading')?.remove(); paint();
      }, undefined, () => {
        if (cancelled || ticket !== mediaTicket) return;
        disposeStructure?.(); container.innerHTML = '<p class="pc-structure-error">三维结构暂未能载入。可切换场景户型或原始图纸查看。</p>';
      });
    } catch {
      if (!cancelled && ticket === mediaTicket) { disposeStructure?.(); container.innerHTML = '<p class="pc-structure-error">此设备暂未能打开三维结构。可切换场景户型或原始图纸查看。</p>'; }
    }
  }

  function projectDetails() {
    const notices = (project.notices || []).map(item => typeof item === 'string' ? item : item.message || item.description || '').filter(Boolean);
    stage.innerHTML = `<div class="pc-evidence"><div class="pc-evidence-intro"><span class="pc-eyebrow">ONE SCENE, TRACEABLE OUTPUTS</span><h3>每个视角，都有来处。</h3><p>同一份 Scene 数据构建 Blender 工程，效果图和全景随同一场景版本输出。</p><div class="pc-project-facts"><span>项目 <strong>${esc(project.project_id)}</strong></span><span>版本 <strong>r${esc(project.revision)}</strong></span><span>当前状态 <strong>${esc(statusName(project.status || project.stage || 'preview'))}</strong></span></div></div>${project.pipeline?.length ? `<ol class="pc-pipeline">${project.pipeline.map((step, index) => `<li class="${statusClass(step.status)}"><span class="pc-step-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${esc(step.label)}</strong>${step.detail ? `<p>${esc(step.detail)}</p>` : ''}</div><span class="pc-step-status">${esc(statusName(step.status))}</span></li>`).join('')}</ol>` : ''}${notices.length ? `<div class="pc-notices"><h4>本版说明</h4>${notices.map(notice => `<p>${esc(notice)}</p>`).join('')}</div>` : ''}<div class="pc-artifacts"><h4>场景与输出文件 <span>PROJECT FILES</span></h4>${(project.artifacts || []).map(item => `<a href="${esc(asset(item.path))}" target="_blank" rel="noopener"><span>${esc(item.label)}${item.size ? `<small>${esc(typeof item.size === 'number' ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : item.size)}</small>` : ''}</span>${arrows}</a>`).join('') || '<p>交付文件尚未导出。</p>'}</div></div>`;
  }

  function panorama(ticket: number) {
    if (!room.panorama) { pending('panorama'); return; }
    stage.innerHTML = `<div class="pc-image-loading" role="status"><span></span>正在载入 360° 空间…</div><div class="pc-panorama" id="pc-panorama" tabindex="0" aria-label="360度空间，拖动或使用方向键环顾，滚轮缩放"></div><div class="pc-image-top"><span class="pc-render-badge"><i></i>360° · CYCLES RENDER</span></div><div class="pc-pano-controls"><button id="pc-pano-auto" aria-label="自动环顾" aria-pressed="false">↻</button><span></span><button id="pc-pano-in" aria-label="放大全景">＋</button><button id="pc-pano-out" aria-label="缩小全景">−</button><button id="pc-pano-reset" aria-label="恢复自然视角">⟲</button><button id="pc-pano-fullscreen" aria-label="全屏浏览">⛶</button></div><div class="pc-pano-hint">拖动环顾 <span>·</span> 滚轮缩放 <span>·</span> 方向键转动</div><div class="pc-pano-error" id="pc-pano-error" hidden></div>`;
    const container = stage.querySelector<HTMLElement>('#pc-panorama')!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { pending('panorama', true); return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = 'pc-pano-canvas'; container.append(renderer.domElement);
    const world = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, .1, 50);
    const geometry = new THREE.SphereGeometry(10, 96, 64).scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const sphere = new THREE.Mesh(geometry, material); sphere.rotation.y = -Math.PI / 2; world.add(sphere);
    let texture: THREE.Texture | null = null, yaw = room.panorama_yaw_rad || 0, pitch = 0, fov = 84, auto = false, frame = 0, lastTime = 0, disposed = false;
    const controller = new AbortController(), signal = controller.signal;
    const pointers = new Map<number, { x: number; y: number }>(); let pinchDistance = 0;
    const autoButton = stage.querySelector<HTMLButtonElement>('#pc-pano-auto')!;
    const setAuto = (value: boolean) => { auto = value; lastTime = 0; autoButton.setAttribute('aria-pressed', String(value)); autoButton.setAttribute('aria-label', value ? '暂停自动环顾' : '开始自动环顾'); requestRender(); };
    function paint(time = 0) { frame = 0; if (disposed) return; if (auto && !pointers.size) { yaw += (lastTime ? Math.min(time - lastTime, 50) : 0) * .000035; requestRender(); } lastTime = time; camera.lookAt(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); renderer.render(world, camera); }
    function requestRender() { if (!frame && !disposed) frame = requestAnimationFrame(paint); }
    function projectCamera() { camera.fov = verticalFov(fov, camera.aspect); pitch = THREE.MathUtils.clamp(pitch, -THREE.MathUtils.degToRad(85 - camera.fov / 2), THREE.MathUtils.degToRad(85 - camera.fov / 2)); camera.updateProjectionMatrix(); requestRender(); }
    function resize() { const { width, height } = container.getBoundingClientRect(); if (!width || !height || disposed) return; renderer.setPixelRatio(panoramaPixelRatio(width, height, devicePixelRatio)); renderer.setSize(width, height); camera.aspect = width / height; projectCamera(); }
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    const declaredWidth = Number.isFinite(room.panorama_width) && room.panorama_width! > 0 ? room.panorama_width! : 8192;
    const mobilePreferred = !!room.panorama_mobile && (innerWidth < 768 || renderer.capabilities.maxTextureSize < declaredWidth);
    const candidates = [...new Set((mobilePreferred ? [room.panorama_mobile!] : [room.panorama, room.panorama_mobile]).filter((path): path is string => !!path).map(asset))];
    const loader = new THREE.TextureLoader();
    const loadCandidate = (index: number) => {
      if (disposed || ticket !== mediaTicket) return;
      if (index >= candidates.length) { disposePanorama?.(); pending('panorama', true); return; }
      const url = candidates[index];
      loader.load(url, next => {
        if (disposed || ticket !== mediaTicket) { next.dispose(); return; }
        const { width, height } = next.image;
        if (width !== height * 2 || width > renderer.capabilities.maxTextureSize || height > renderer.capabilities.maxTextureSize) { next.dispose(); loadCandidate(index + 1); return; }
        next.colorSpace = THREE.SRGBColorSpace; next.wrapS = THREE.RepeatWrapping; next.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture = next; material.map = next; material.needsUpdate = true;
        actualPanoramaUrl = url; actualPanoramaWidth = width;
        stage.querySelector('.pc-image-loading')?.remove(); stage.classList.add('pc-media-ready'); requestRender();
      }, undefined, () => loadCandidate(index + 1));
    };
    loadCandidate(0);
    container.addEventListener('pointerdown', event => { container.focus({ preventScroll: true }); container.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); } }, { signal });
    container.addEventListener('pointermove', event => { const previous = pointers.get(event.pointerId); if (!previous) return; if (pointers.size === 1) { yaw -= (event.clientX - previous.x) * .003; pitch += (event.clientY - previous.y) * .003; } pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size === 2) { const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y); fov = THREE.MathUtils.clamp(fov - (distance - pinchDistance) * .09, 60, 90); pinchDistance = distance; } projectCamera(); }, { signal });
    const release = (event: PointerEvent) => { pointers.delete(event.pointerId); if (pointers.size < 2) pinchDistance = 0; };
    container.addEventListener('pointerup', release, { signal }); container.addEventListener('pointercancel', release, { signal }); container.addEventListener('lostpointercapture', release, { signal });
    container.addEventListener('wheel', event => { event.preventDefault(); fov = THREE.MathUtils.clamp(fov + event.deltaY * .025, 60, 90); projectCamera(); }, { passive: false, signal });
    container.addEventListener('keydown', event => { if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '='].includes(event.key)) return; event.preventDefault(); if (event.key === 'ArrowLeft') yaw -= .09; if (event.key === 'ArrowRight') yaw += .09; if (event.key === 'ArrowUp') pitch += .07; if (event.key === 'ArrowDown') pitch -= .07; if (['+', '='].includes(event.key)) fov = Math.max(60, fov - 3); if (event.key === '-') fov = Math.min(90, fov + 3); projectCamera(); }, { signal });
    autoButton.addEventListener('click', () => setAuto(!auto), { signal });
    stage.querySelector('#pc-pano-in')!.addEventListener('click', () => { fov = Math.max(60, fov - 3); projectCamera(); }, { signal });
    stage.querySelector('#pc-pano-out')!.addEventListener('click', () => { fov = Math.min(90, fov + 3); projectCamera(); }, { signal });
    stage.querySelector('#pc-pano-reset')!.addEventListener('click', () => { setAuto(false); yaw = room.panorama_yaw_rad || 0; pitch = 0; fov = 84; projectCamera(); }, { signal });
    stage.querySelector('#pc-pano-fullscreen')!.addEventListener('click', () => { const action = document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); action.catch(() => {}); }, { signal });
    disposePanorama = () => { if (disposed) return; disposed = true; cancelAnimationFrame(frame); controller.abort(); observer.disconnect(); texture?.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); };
  }

  function render() {
    disposePanorama?.(); disposePanorama = null; disposeStructure?.(); disposeStructure = null; structureReady = false; structureObjectCount = 0; actualPanoramaUrl = null; actualPanoramaWidth = null; const ticket = ++mediaTicket;
    updateUrl(); stage.classList.remove('pc-media-ready', 'pc-no-render'); stage.dataset.mode = mode; stage.setAttribute('aria-label', modeLabels[mode]);
    app.querySelectorAll<HTMLElement>('[data-pc-room]').forEach(element => { const active = element.dataset.pcRoom === room.id; element.classList.toggle('active', active); element.setAttribute('aria-current', String(active)); });
    app.querySelectorAll<HTMLElement>('[data-pc-mode]').forEach(element => { element.classList.toggle('active', element.dataset.pcMode === mode); if (element.tagName === 'BUTTON') element.setAttribute('aria-pressed', String(element.dataset.pcMode === mode)); });
    document.querySelector('#pc-room-index')!.textContent = String(project.rooms.indexOf(room) + 1).padStart(2, '0');
    document.querySelector('#pc-room-title')!.textContent = room.name;
    document.querySelector('#pc-room-note')!.textContent = room.note || '浅木的温暖，和自然相处的日常。';
    document.querySelector('#pc-room-dimensions')!.textContent = room.dimensions || (room.area_m2 ? `约 ${room.area_m2.toFixed(1)} ㎡` : '');
    if (mode === 'gallery') gallery(ticket); else if (mode === 'panorama') panorama(ticket); else if (mode === 'floorplan') floorplan(); else projectDetails();
  }
  Object.assign(window, { __planCDiagnostics: () => ({ projectId: project.project_id, revision: project.revision, room: room.id, mode, still: room.still || null, panorama: room.panorama || null, actualPanoramaUrl, actualPanoramaWidth, ready: stage.classList.contains('pc-media-ready'), rooms: project.rooms.length, structureReady, structureObjectCount }) });
  window.addEventListener('pagehide', () => { disposePanorama?.(); disposeStructure?.(); }, { once: true });
  render();
}
