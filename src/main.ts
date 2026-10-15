import './style.css';
import { createIcons, House, PanelsTopLeft, CircleHelp, Box, ArrowUpRight, Ruler, Sun, Moon, RotateCcw, Plus, Minus, Camera, Maximize, ChevronDown, Footprints, Scan, Layers2, MapPin, Blinds, Mouse, PanelLeft, X, MonitorX, ArrowRight, ChevronUp, ChevronLeft, ChevronRight, SunMoon, Sofa, BookOpen, BedDouble, Sprout, Utensils, CookingPot, Bath, Flower2, DoorOpen } from 'lucide';
const icons = {House, PanelsTopLeft, CircleHelp, Box, ArrowUpRight, Ruler, Sun, Moon, RotateCcw, Plus, Minus, Camera, Maximize, ChevronDown, Footprints, Scan, Layers2, MapPin, Blinds, Mouse, PanelLeft, X, MonitorX, ArrowRight, ChevronUp, ChevronLeft, ChevronRight, SunMoon, Sofa, BookOpen, BedDouble, Sprout, Utensils, CookingPot, Bath, Flower2, DoorOpen};
import { HomeViewer } from './viewer';
import type { Mode } from './viewer';
import { rooms, outline, roomById } from './plan';
import type { RoomId } from './plan';

const icon=(name:string,cls='')=>`<i data-lucide="${name}" class="${cls}"></i>`;
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<header class="topbar">
  <a class="brand" href="/" aria-label="栖光首页"><span class="brand-mark">${icon('house')}</span><span>栖光<span class="brand-en">LIGHTWOOD HOME</span></span></a>
  <div class="project-title"><span class="project-separator"></span>采光优化 · 方案 B <span class="version">空间概念版</span></div>
  <div class="header-actions"><span class="live-badge"><span></span>实时 3D</span><button id="reference-btn" class="quiet-btn">${icon('panels-top-left')}<span>设计依据</span></button><button id="help-btn" class="icon-btn" aria-label="操作帮助">${icon('circle-help')}</button></div>
</header>
<div class="workspace">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-intro"><div class="eyebrow">A HOME, MADE FOR LIVING</div><h1>让光，住进家。</h1><p>轻原木 · 暖白 · 日常的温度</p></div>
    <div class="section-label">空间导览 <span>09 SPACES</span></div>
    <nav class="room-nav" aria-label="空间导览">
      <button class="room-button active" data-nav="all">${icon('box')}<span>全屋概览<small>看见家的完整模样</small></span>${icon('arrow-up-right','room-arrow')}</button>
      ${rooms.map((r,i)=>`<button class="room-button" data-nav="${r.id}">${icon(r.icon)}<span>${r.name}</span><span class="room-number">${String(i+1).padStart(2,'0')}</span></button>`).join('')}
    </nav>
    <div class="palette-section"><div class="section-label">家的材质 <span>MATERIALS</span></div><div class="palette"><div><span style="--swatch:#eeece3"></span><small>暖白墙面</small></div><div><span class="wood-swatch" style="--swatch:#c9beab"></span><small>哑光浅橡木</small></div><div><span class="fabric-swatch" style="--swatch:#d8d0bb"></span><small>燕麦织物</small></div><div><span style="--swatch:#94a181"></span><small>鼠尾草绿</small></div></div></div>
    <div class="sidebar-note">${icon('ruler')}<p>按方案资料建立的概念模型<br>尺寸与玻璃高度待现场复测</p></div>
  </aside>
  <main class="viewport" id="viewport">
    <div class="viewport-heading"><div><span class="eyebrow" id="view-eyebrow">EXPLORE YOUR HOME</span><h2 id="view-title">家的每一面，都值得看看。</h2></div><span class="view-chip" id="view-chip">全屋鸟瞰</span></div>
    <div class="lighting-control" role="group" aria-label="光照氛围"><button id="day-btn" class="active" aria-pressed="true">${icon('sun')}日间</button><button id="night-btn" aria-pressed="false">${icon('moon')}夜间</button></div>
    <div id="loading" class="loading"><span class="loading-logo">${icon('house')}</span><strong>正在构建你的家</strong><span>铺上木地板，让光照进来…</span><div class="loading-line"></div></div>
    <div class="vertical-tools"><button id="reset-btn" aria-label="重置视角" title="重置视角">${icon('rotate-ccw')}</button><button id="zoom-in" aria-label="放大" title="放大">${icon('plus')}</button><button id="zoom-out" aria-label="缩小" title="缩小">${icon('minus')}</button><span></span><button id="capture-btn" aria-label="保存当前视角图片" title="保存当前视角图片">${icon('camera')}</button><button id="fullscreen-btn" aria-label="全屏显示" title="全屏显示">${icon('maximize')}</button></div>
    <section class="detail-card" id="detail-card"><div class="detail-kicker"><span id="detail-en">THE DESIGN IDEA</span><span class="small-dot"></span></div><h3 id="detail-title">通透有度，自在有光</h3><p id="detail-description">低饱和浅橡木铺开日常，木质矮柜与大屏电视正对沙发，让家更适合真实生活。</p><div class="detail-bottom" id="detail-bottom"><span>三间房 · 一处独立卫浴</span><button id="enter-btn">开始漫游 ${icon('arrow-up-right')}</button></div></section>
    <section class="minimap" aria-label="户型定位"><div class="minimap-heading"><span>户型定位</span><span>图纸上方 ↑</span><button id="map-toggle" aria-label="收起户型图">${icon('chevron-down')}</button></div><div class="map-body"><svg id="map" viewBox="-0.7 -1.5 13.6 13" role="img" aria-label="可点击的户型小地图"><path class="map-base" d="M${outline.map(p=>p.join(',')).join(' L')} Z"/>${rooms.map(r=>`<path tabindex="0" role="button" aria-label="前往${r.name}" data-map="${r.id}" d="M${r.polygon.map(p=>p.join(',')).join(' L')} Z"/><text x="${r.center[0]}" y="${r.center[1]+.1}">${r.name.split(' / ')[0].replace('卫生间','卫浴').replace('玄关','玄关')}</text>`).join('')}<g id="map-person" style="display:none"><circle r=".24"/><path d="M-.17 -.30 L0 -.65 L.17 -.30"/></g></svg><div class="map-caption"><span class="legend-dot"></span>点击房间快速前往</div></div></section>
    <div class="walking-hint" id="walking-hint" hidden>${icon('footprints')}<span><b>W A S D</b> 或方向键移动 · 拖动环顾 · <b>Esc</b> 退出</span></div>
    <div class="walk-pad" id="walk-pad" hidden><button data-key="KeyW" aria-label="向前走">${icon('chevron-up')}</button><div><button data-key="KeyA" aria-label="向左走">${icon('chevron-left')}</button><button data-key="KeyS" aria-label="向后走">${icon('chevron-down')}</button><button data-key="KeyD" aria-label="向右走">${icon('chevron-right')}</button></div></div>
    <div class="view-bottom">
      <div class="mode-switch" role="group" aria-label="查看模式"><button class="active" data-mode="orbit" aria-pressed="true">${icon('box')}<span>全屋鸟瞰</span></button><button data-mode="walk" aria-pressed="false">${icon('footprints')}<span>室内漫游</span></button><button data-mode="plan" aria-pressed="false">${icon('scan')}<span>平面俯视</span></button></div>
      <div class="display-options"><button id="cutaway-btn" aria-pressed="false">${icon('layers-2')}<span>降低墙体</span></button><button id="labels-btn" class="active" aria-pressed="true">${icon('map-pin')}<span>空间标签</span></button><button id="curtain-btn" aria-pressed="false">${icon('blinds')}<span>合上隐私帘</span></button></div>
    </div>
    <div class="interaction-hint" id="interaction-hint">${icon('mouse')}左键旋转 <span>·</span> 滚轮缩放 <span>·</span> 右键平移</div>
    <div id="toast" class="toast" role="status"></div>
    <button id="mobile-menu" aria-label="打开空间导览">${icon('panel-left')}</button>
  </main>
</div>
<footer class="statusbar"><div><span class="status-dot"></span><span id="status-text">基于 B-1 布局 · 保留承重墙与原始房间关系</span></div><span>概念可视化 · 非施工图 / 非照度模拟</span></footer>
<dialog id="reference-modal" class="reference-modal"><div class="modal-header"><div><span class="eyebrow">DESIGN REFERENCES</span><h2>每个空间，都有依据。</h2></div><button class="icon-btn close-modal" aria-label="关闭设计依据">${icon('x')}</button></div><div class="reference-tabs" role="tablist"><button data-ref="plan" class="active" role="tab" aria-selected="true">方案 B 布局</button><button data-ref="lighting" role="tab" aria-selected="false">借光与灯光</button><button data-ref="day" role="tab" aria-selected="false">日间材质参考</button><button data-ref="night" role="tab" aria-selected="false">夜间氛围参考</button><button data-ref="original" role="tab" aria-selected="false">原始户型</button></div><div class="reference-content"><div class="reference-image"><img id="reference-image" src="/references/plan.png" alt="采光优化方案B家具布置图" /></div><aside><h3>资料与当前调整</h3><p>房间结构以《采光优化方案 B》和 B-1 图为基础。当前版本按你的调整改用低饱和哑光浅橡木地板，并重新布置电视区；这里的原始图纸保留供对照。图纸上下不代表已确认的地理朝向。</p><ul><li>书房与客厅的两端承重段保留，固定清玻璃只位于中段。</li><li>沙发靠右墙，约 65 英寸电视配 1.80 × 0.42 m 木质矮柜，居中正对沙发；原房门仍可通行。</li><li>中央卫生间保留，左下旧卫浴区域改为衣帽收纳。</li><li>电视摆放在木柜上，遮住部分中段玻璃，借光面积相应减少；玻璃与两端实体墙仍保留。</li></ul><h3>模型中的估算</h3><p>房间净宽采用资料的参考尺寸；资料并非统一比例施工图，其余位置按房间关系估算。层高暂取 2.70 m，书房景窗窗台暂取 0.42 m、上沿 2.36 m，均待实测。</p><p>日夜切换用于体验材质与照明氛围，不表示实测照度、真实日照方向或采光改善幅度。</p><p class="source-name">来源：docs / 采光优化方案B_完整资料.zip<br>及 docs 中三张效果参考图</p></aside></div></dialog>
<dialog id="help-modal" class="help-modal"><div class="modal-header"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>慢慢逛，就像在家。</h2></div><button class="icon-btn close-modal" aria-label="关闭操作帮助">${icon('x')}</button></div><div class="help-grid"><div>${icon('mouse')}<h3>从外面看看</h3><p>左键拖动旋转，滚轮缩放，右键平移。触屏可单指旋转、双指缩放与平移。</p></div><div>${icon('footprints')}<h3>走进房间</h3><p>选择「室内漫游」，用 WASD 或方向键行走，拖动画面环顾。Shift 加速，Esc 返回鸟瞰。屏幕方向键同样可用。</p></div><div>${icon('map-pin')}<h3>随处停留</h3><p>点左侧空间、模型标签或户型图快速切换房间。漫游时会直接到达该房间。</p></div><div>${icon('sun-moon')}<h3>感受不同氛围</h3><p>切换日夜，展开或合上书房隐私帘。用「降低墙体」查看布置，用相机保存当前 3D 画面。</p></div></div><button id="help-start" class="primary-button">开始探索 ${icon('arrow-right')}</button></dialog>
`;
createIcons({icons,attrs:{'stroke-width':1.6}});
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
let viewer:HomeViewer;
let selected='all';
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function onRoom(id:string) {
  selected=id;
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===id);el.setAttribute('aria-current',el.dataset.nav===id?'true':'false');});
  document.querySelectorAll<SVGElement>('[data-map]').forEach(el=>el.classList.toggle('active',el.dataset.map===id));
  const r=roomById(id);
  $('#view-eyebrow').textContent=r?r.english:'EXPLORE YOUR HOME';
  $('#view-title').textContent=r?r.subtitle:'家的每一面，都值得看看。';
  $('#detail-en').textContent=r?r.english:'THE DESIGN IDEA';$('#detail-title').textContent=r?r.name:'通透有度，自在有光';
  $('#detail-description').textContent=r?r.description:'低饱和浅橡木铺开日常，木质矮柜与大屏电视正对沙发，让家更适合真实生活。';
  $('#detail-bottom > span').textContent=r?r.dimension:'三间房 · 一处独立卫浴';
  $('#enter-btn').innerHTML=`${r?'走进这里':'开始漫游'} ${icon('arrow-up-right')}`;createIcons({icons,attrs:{'stroke-width':1.6}});
  $('#status-text').textContent=r?r.features.join(' · '):'基于 B-1 布局 · 保留承重墙与原始房间关系';
}
function onMode(mode:Mode) {
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(el=>{const active=el.dataset.mode===mode;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  $('#view-chip').textContent={orbit:'全屋鸟瞰',walk:'室内漫游 · 视高 1.58 m',plan:'平面俯视'}[mode];
  $('#walking-hint').hidden=mode!=='walk';$('#walk-pad').hidden=mode!=='walk';$('#interaction-hint').hidden=mode==='walk';
  $('#viewport').classList.toggle('is-walking',mode==='walk');
  $('#map-person').style.display=mode==='walk'?'':'none';
  for(const id of ['cutaway-btn','zoom-in','zoom-out'])$<HTMLButtonElement>('#'+id).disabled=mode==='walk';
}
try {
  viewer=new HomeViewer($('#viewport'),{onRoom,onMode,onMove:(x,z,yaw)=>{$('#map-person').setAttribute('transform',`translate(${x} ${z}) rotate(${-yaw*180/Math.PI})`);},onReady:()=>{$('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),450);}});
} catch(err) {
  console.error(err);
  $('#loading').innerHTML=`${icon('monitor-x')}<strong>当前浏览器无法初始化 3D</strong><span>请启用硬件加速，使用支持 WebGL 2 的浏览器重新打开。</span><button id="reload-btn" class="primary-button">重新加载</button><button id="fallback-reference" class="quiet-btn">查看方案原图</button>`;
  $('#reload-btn').onclick=()=>location.reload();$('#fallback-reference').onclick=()=>$<HTMLDialogElement>('#reference-modal').showModal();
}
function choose(id:string) {viewer?.selectRoom(id);$('#sidebar').classList.remove('mobile-open');}
for(const el of document.querySelectorAll<HTMLElement>('[data-nav]'))el.onclick=()=>choose(el.dataset.nav!);
for(const el of document.querySelectorAll<SVGElement>('[data-map]')){el.addEventListener('click',()=>choose(el.dataset.map!));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(el.dataset.map!);}});}
for(const el of document.querySelectorAll<HTMLElement>('[data-mode]'))el.onclick=()=>viewer?.setMode(el.dataset.mode as Mode);
$('#enter-btn').onclick=()=>viewer?.enterRoom((selected==='all'?'entry':selected) as RoomId);
$('#reset-btn').onclick=()=>{viewer?.reset();toast('已回到全屋视角');};
$('#zoom-in').onclick=()=>viewer?.zoom(.85);$('#zoom-out').onclick=()=>viewer?.zoom(1.18);
$('#capture-btn').onclick=()=>{viewer?.screenshot();toast('当前视角已保存为 PNG');};
$('#fullscreen-btn').onclick=async()=>{try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch {toast('当前环境不支持全屏，可使用浏览器全屏功能');}};
function lighting(night:boolean) {viewer?.setNight(night);document.body.classList.toggle('night',night);$('#day-btn').classList.toggle('active',!night);$('#night-btn').classList.toggle('active',night);$('#day-btn').setAttribute('aria-pressed',String(!night));$('#night-btn').setAttribute('aria-pressed',String(night));}
$('#day-btn').onclick=()=>lighting(false);$('#night-btn').onclick=()=>lighting(true);
$('#cutaway-btn').onclick=()=>{if(!viewer)return;viewer.setCutaway(!viewer.cutaway);$('#cutaway-btn').classList.toggle('active',viewer.cutaway);$('#cutaway-btn').setAttribute('aria-pressed',String(viewer.cutaway));toast(viewer.cutaway?'墙体剖切至 1.35 m 便于观察，实际墙体完整保留':'已恢复完整墙高');};
$('#labels-btn').onclick=()=>{if(!viewer)return;viewer.labelsVisible=!viewer.labelsVisible;$('#labels-btn').classList.toggle('active',viewer.labelsVisible);$('#labels-btn').setAttribute('aria-pressed',String(viewer.labelsVisible));};
$('#curtain-btn').onclick=()=>{if(!viewer)return;viewer.setCurtain(!viewer.curtainClosed);$('#curtain-btn span').textContent=viewer.curtainClosed?'收起隐私帘':'合上隐私帘';$('#curtain-btn').classList.toggle('active',viewer.curtainClosed);$('#curtain-btn').setAttribute('aria-pressed',String(viewer.curtainClosed));toast(viewer.curtainClosed?'书房隐私帘已合上':'隐私帘已收至玻璃侧边');};
$('#map-toggle').onclick=()=>{$('.minimap').classList.toggle('collapsed');$('#map-toggle').setAttribute('aria-label',$('.minimap').classList.contains('collapsed')?'展开户型图':'收起户型图');};
$('#mobile-menu').onclick=()=>$('#sidebar').classList.toggle('mobile-open');
function showModal(id:string) {viewer?.keys.clear();$<HTMLDialogElement>(id).showModal();}
$('#reference-btn').onclick=()=>showModal('#reference-modal');$('#help-btn').onclick=()=>showModal('#help-modal');
for(const el of document.querySelectorAll<HTMLElement>('.close-modal'))el.onclick=()=>el.closest('dialog')?.close();
$('#help-start').onclick=()=>$<HTMLDialogElement>('#help-modal').close();
for(const d of document.querySelectorAll<HTMLDialogElement>('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
for(const el of document.querySelectorAll<HTMLElement>('[data-ref]'))el.onclick=()=>{
  document.querySelectorAll<HTMLElement>('[data-ref]').forEach(b=>{b.classList.toggle('active',el===b);b.setAttribute('aria-selected',String(el===b));});
  $<HTMLImageElement>('#reference-image').src=`/references/${el.dataset.ref}.png`;$<HTMLImageElement>('#reference-image').alt=el.textContent!;
};
for(const el of document.querySelectorAll<HTMLElement>('[data-key]')){
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);viewer?.keys.add(el.dataset.key!);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,()=>viewer?.keys.delete(el.dataset.key!));
}
