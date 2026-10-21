import * as THREE from 'three';
import { createIcons, ArrowUpRight, ArrowLeft, RotateCw, Pause, Plus, Minus, Maximize, Camera, Map as MapIcon, X, Move, ChevronRight } from 'lucide';
import { rooms, outline } from './plan';
import { panoramaRooms, panoramaAsset, panoramaThumbnail } from './panorama-data';
import type { PanoramaId } from './panorama-data';
import './panorama.css';
import { designSchemes, schemeFromSearch } from './design-schemes';
import type { SchemeId } from './design-schemes';

const icons={ArrowUpRight,ArrowLeft,RotateCw,Pause,Plus,Minus,Maximize,Camera,Map:MapIcon,X,Move,ChevronRight};
const icon=(name:string)=>`<i data-lucide="${name}"></i>`;
const find=(id:PanoramaId)=>panoramaRooms.find(r=>r.id===id)!;
export function startPanoramaTour() {
  let schemeId:SchemeId=schemeFromSearch(location.search);
  const scheme=()=>designSchemes[schemeId];
  const samples=()=>scheme().samples.map(sample=>`<figure><div class="tour-sample ${sample.wood?'sample-oak':''}" style="background-color:${sample.color}"></div><figcaption>${sample.name}<small>${sample.note}</small></figcaption></figure>`).join('');
  document.body.classList.add('panorama-page');
  document.querySelector('#app')!.innerHTML=`
  <div class="tour-shell">
    <header class="tour-header"><a class="tour-brand" href="${import.meta.env.BASE_URL}"><span class="tour-mark">栖</span><span>栖光<span class="tour-brand-sub">A QUIETER HOME</span></span></a><div class="tour-project">我的家 · <span id="tour-project-name">${scheme().name}</span><span id="tour-project-en">${scheme().english}</span></div><div class="tour-scheme-switch" role="group" aria-label="设计风格">${Object.values(designSchemes).map(item=>`<button data-scheme="${item.id}" aria-pressed="false">${item.name}</button>`).join('')}</div><a class="tour-model" href="?view=model">尺寸户型模型 ${icon('arrow-up-right')}</a></header>
    <aside class="tour-sidebar"><div class="tour-intro"><span class="tour-eyebrow" id="tour-style-eyebrow">${scheme().eyebrow}</span><h1 id="tour-style-title">${scheme().title[0]}<br>${scheme().title[1]}</h1><p id="tour-style-intro">${scheme().introduction[0]}<br>${scheme().introduction[1]}</p></div><div class="tour-nav-label">空间导览 <span>07 ROOMS</span></div><nav aria-label="全景空间导览">${panoramaRooms.map((r,i)=>`<button data-room="${r.id}" class="tour-nav"><span class="tour-num">0${i+1}</span><span>${r.name}<small>${r.english}</small></span>${icon('arrow-up-right')}</button>`).join('')}</nav><div class="tour-materials"><span class="tour-eyebrow">THE MATERIAL PALETTE</span><div id="tour-palette-dots">${scheme().samples.map(sample=>`<i style="background:${sample.color}"></i>`).join('')}</div><p id="tour-palette-label">${scheme().paletteLabel}</p><button id="tour-materials-open" class="tour-material-button">查看材质本色 ↗</button><a class="tour-source-link" hidden target="_blank" rel="noopener">查看参考视频 ↗</a></div><a class="tour-review-link" href="${import.meta.env.BASE_URL}review/summary.md" target="_blank" rel="noopener">查看设计复核 ↗</a><button class="tour-map-button" id="tour-map-open">${icon('map')}查看户型位置 ${icon('arrow-up-right')}</button></aside>
    <main class="tour-stage" id="tour-stage" tabindex="0" aria-label="360度全景，拖动或按方向键环顾"><div class="tour-shade"></div><div class="tour-scene-title"><span id="tour-room-en" class="tour-eyebrow"></span><h2 id="tour-room-name"></h2><p id="tour-room-note"></p></div><span class="tour-badge">360° 全景</span><div class="tour-hotspots" id="tour-hotspots"></div><div class="tour-load" id="tour-load" role="status"><span class="tour-spinner"></span><strong>正在铺开空间…</strong></div><div class="tour-error" id="tour-error" hidden role="alert"><strong>这个空间暂时未能载入</strong><p>请检查网络后重试，也可以先看其他房间。</p><button id="tour-retry">重新载入</button><a href="?view=model">查看尺寸户型模型</a></div><div class="tour-tools"><button id="tour-auto" aria-label="开始自动环顾" aria-pressed="false">${icon('rotate-cw')}</button><span></span><button id="tour-zoom-in" aria-label="放大全景">${icon('plus')}</button><button id="tour-zoom-out" aria-label="缩小全景">${icon('minus')}</button><span></span><button id="tour-capture" aria-label="保存全景当前视角">${icon('camera')}</button><button id="tour-fullscreen" aria-label="全屏浏览">${icon('maximize')}</button><button id="tour-materials-mobile" aria-label="查看材质本色"><span class="tour-color-icon">色</span></button><button id="tour-mobile-map" aria-label="查看户型位置">${icon('map')}</button></div><div class="tour-caption"><span id="tour-material"></span><span>${icon('move')}拖动环顾 · 滚轮缩放 · 方向键转动</span></div><div class="tour-disclosure">AI 全景效果 · 尺寸见户型模型</div><div class="tour-toast" id="tour-toast" role="status"></div></main>
    <footer class="tour-bottom"><div class="tour-bottom-heading"><span>慢慢看，慢慢住。</span><small>选择一个空间，继续探索</small></div><nav class="tour-thumbnails" aria-label="全景缩略图">${panoramaRooms.map(r=>`<button data-room="${r.id}" class="tour-thumb" aria-label="前往${r.name}"><img src="${panoramaThumbnail(r.id,schemeId)}" alt="" loading="lazy"><span>${r.name}</span></button>`).join('')}</nav></footer>
  </div><dialog class="tour-map-modal" id="tour-map-modal"><div class="tour-map-heading"><div><span class="tour-eyebrow">THE FLOOR PLAN</span><h2>在家里的位置</h2></div><button id="tour-map-close" aria-label="关闭户型图">${icon('x')}</button></div><p>点击房间进入全景；图纸上方不代表地理北向。</p><svg viewBox="-0.7 -1.5 14 12" role="img" aria-label="当前户型空间选择"><path class="tour-map-base" d="M${outline.map(p=>p.join(',')).join(' L')} Z"/>${rooms.map(r=>{const id=r.id==='entry'?'living':r.id==='balcony'?'dining':r.id;return `<g data-map-room="${id}" tabindex="0" role="button" aria-label="前往${r.name}"><path d="M${r.polygon.map(p=>p.join(',')).join(' L')} Z"/><text x="${r.center[0]}" y="${r.center[1]}">${r.name.split(' / ')[0]}</text></g>`;}).join('')}</svg><small>全景中的跳转标记为导览入口，不代表精确门洞位置。全景为 AI 概念效果，家具与洞口尺寸请对照模型及复测结果。</small><a href="?view=model">打开尺寸户型模型 ${icon('arrow-up-right')}</a><a href="${import.meta.env.BASE_URL}review/summary.md" target="_blank" rel="noopener">查看设计复核摘要 ${icon('arrow-up-right')}</a></dialog><dialog class="tour-map-modal tour-material-modal" id="tour-material-modal"><div class="tour-map-heading"><div><span class="tour-eyebrow">TRUE MATERIAL COLOURS</span><h2>先看本色，再看空间。</h2></div><button id="tour-materials-close" aria-label="关闭材质本色">${icon('x')}</button></div><p id="tour-material-intro">${scheme().materialIntro}</p><div class="tour-sample-grid" id="tour-sample-grid">${samples()}</div><a class="tour-source-link" hidden target="_blank" rel="noopener">查看参考视频 ↗</a><small>这里展示方案底色，避开场景光干扰。屏幕与实物会有色差，墙漆和木材最终放在一起看现场样板。</small></dialog>`;
  createIcons({icons,attrs:{'stroke-width':1.5}});
  const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
  const stage=$('#tour-stage'), loading=$('#tour-load'), error=$('#tour-error');
  let current:PanoramaId='living', loaded:PanoramaId|null=null, request=0, yaw=0,pitch=0,auto=false,drag=false,lastX=0,lastY=0,raf=0,lastTime=0;
  let texture:THREE.Texture|null=null;
  let renderer:THREE.WebGLRenderer;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,1,.1,100);
  const material=new THREE.MeshBasicMaterial({color:0xffffff});
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(20,80,40).scale(-1,1,1),material);
  sphere.rotation.y=-Math.PI/2;
  scene.add(sphere);
  let hotspotButtons: {button:HTMLButtonElement; direction:THREE.Vector3}[]=[];
  let toastTimer:ReturnType<typeof setTimeout>;
  function toast(message:string){$('#tour-toast').textContent=message;$('#tour-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#tour-toast').classList.remove('show'),3200);}
  function render(time=0){raf=0;if(auto&&!drag){yaw+=(lastTime?Math.min(time-lastTime,50):0)*.000045;requestRender();}lastTime=time;
    camera.lookAt(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));camera.updateMatrixWorld();
    renderer.render(scene,camera);
    for(const h of hotspotButtons){const p=h.direction.clone().project(camera);const visible=p.z<1&&p.z>-1&&Math.abs(p.x)<.88&&Math.abs(p.y)<.75&&loaded===current;h.button.hidden=!visible;if(visible){h.button.style.left=`${(p.x+1)*50}%`;h.button.style.top=`${(-p.y+1)*50}%`;}}
  }
  function requestRender(){if(!raf)raf=requestAnimationFrame(render);}
  function setAuto(value:boolean){auto=value;lastTime=0;$('#tour-auto').setAttribute('aria-pressed',String(auto));$('#tour-auto').setAttribute('aria-label',auto?'暂停自动环顾':'开始自动环顾');$('#tour-auto').innerHTML=icon(auto?'pause':'rotate-cw');createIcons({icons});requestRender();}
  function zoom(delta:number){camera.fov=THREE.MathUtils.clamp(camera.fov+delta,40,95);camera.updateProjectionMatrix();requestRender();}
  function choose(id:PanoramaId){if(!renderer)return;current=id;loaded=null;const ticket=++request;const room=find(id);loading.hidden=false;error.hidden=true;stage.classList.add('is-loading');
    $('#tour-room-name').textContent=room.name;$('#tour-room-en').textContent=`0${panoramaRooms.indexOf(room)+1} / ${room.english}`;$('#tour-room-note').textContent=scheme().roomNotes[id]??room.note;$('#tour-material').textContent=scheme().roomMaterials[id];
    document.querySelectorAll<HTMLElement>('[data-room]').forEach(el=>{const active=el.dataset.room===id;el.classList.toggle('active',active);el.setAttribute('aria-current',String(active));});
    document.querySelectorAll('[data-map-room]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-map-room')===id));
    $('#tour-hotspots').replaceChildren();hotspotButtons=[];
    new THREE.TextureLoader().load(panoramaAsset(id,schemeId),next=>{if(ticket!==request){next.dispose();return;}next.colorSpace=THREE.SRGBColorSpace;next.minFilter=THREE.LinearFilter;next.generateMipmaps=false;material.map=next;material.needsUpdate=true;texture?.dispose();texture=next;loaded=id;yaw=(schemeId==='sunlit'&&id==='living'?.15:({living:-.25,dining:0,master:-.33,study:-.35,guest:-.08,kitchen:0,bathroom:-.18}[id]))*Math.PI*2;pitch=id==='living'?(schemeId==='sunlit'?-.22:-.15):0;camera.fov=id==='living'?(schemeId==='sunlit'?90:80):72;camera.updateProjectionMatrix();loading.hidden=true;stage.classList.remove('is-loading');
      hotspotButtons=room.links.map(link=>{const from=rooms.find(r=>r.id===id)!,to=rooms.find(r=>r.id===link)!;const origin=id==='master'?[2.75,6.6]:from.spawn;const angle=id==='living'?({study:-1.6,dining:0,master:-.6} as Record<string,number>)[link]:Math.atan2(to.center[0]-origin[0],origin[1]-to.center[1]);const button=document.createElement('button');button.className='tour-hotspot';button.dataset.target=link;button.setAttribute('aria-label',`导览至${find(link).name}`);button.innerHTML=`<span>↗</span>${find(link).name}<small>空间跳转</small>`;button.onclick=()=>choose(link);$('#tour-hotspots').append(button);return {button,direction:new THREE.Vector3(Math.sin(angle)*10,-4.2,-Math.cos(angle)*10)};});requestRender();
    },undefined,()=>{if(ticket!==request)return;loading.hidden=true;error.hidden=false;stage.classList.remove('is-loading');});
  }
  function applyScheme(id:SchemeId){
    schemeId=id;
    document.body.classList.toggle('forest-scheme',id==='forest');
    document.body.classList.toggle('japanese-scheme',id==='japanese');
    document.body.classList.toggle('french-scheme',id==='french');
    document.body.classList.toggle('sunlit-scheme',id==='sunlit');
    document.querySelectorAll<HTMLButtonElement>('[data-scheme]').forEach(button=>{
      const active=button.dataset.scheme===id;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('#tour-project-name').textContent=scheme().name;
    $('#tour-project-en').textContent=scheme().english;
    $('#tour-style-eyebrow').textContent=scheme().eyebrow;
    $('#tour-style-title').innerHTML=`${scheme().title[0]}<br>${scheme().title[1]}`;
    $('#tour-style-intro').innerHTML=`${scheme().introduction[0]}<br>${scheme().introduction[1]}`;
    $('#tour-palette-label').textContent=scheme().paletteLabel;
    $('#tour-palette-dots').innerHTML=scheme().samples.map(sample=>`<i style="background:${sample.color}"></i>`).join('');
    $('#tour-material-intro').textContent=scheme().materialIntro;
    $('#tour-sample-grid').innerHTML=samples();
    for(const link of document.querySelectorAll<HTMLAnchorElement>('.tour-source-link')){
      const source=scheme().source;
      link.hidden=!source;
      if(source){link.href=source.url;link.title=source.title;}else{link.removeAttribute('href');link.removeAttribute('title');}
    }
    for(const button of document.querySelectorAll<HTMLButtonElement>('.tour-thumb')){
      const image=button.querySelector('img')!;
      image.src=panoramaThumbnail(button.dataset.room as PanoramaId,id);
    }
    const url=new URL(location.href);
    if(id==='cream')url.searchParams.delete('design');else url.searchParams.set('design',id);
    history.replaceState(null,'',url);
    document.title=`栖光 · ${scheme().name}全景之家`;
    choose(current);
  }
  try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.className='tour-canvas';renderer.domElement.setAttribute('aria-label','沉浸式全景画面');stage.prepend(renderer.domElement);}
  catch{loading.hidden=true;error.hidden=false;$('#tour-error strong').textContent='浏览器暂时无法显示全景';$('#tour-error p').textContent='请启用硬件加速后重新载入。';$('#tour-retry').onclick=()=>location.reload();return;}
  const resize=new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();requestRender();});resize.observe(stage);
  const pointers=new Map<number,{x:number;y:number}>();let pinch=0;
  renderer.domElement.addEventListener('pointerdown',e=>{stage.focus({preventScroll:true});renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag=true;lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  renderer.domElement.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],next=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);zoom((pinch-next)*.1);pinch=next;}else{yaw-=(e.clientX-lastX)*.0035;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.0035,-1.35,1.35);}lastX=e.clientX;lastY=e.clientY;requestRender();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{pointers.delete((e as PointerEvent).pointerId);drag=pointers.size>0;const remaining=[...pointers.values()][0];if(remaining){lastX=remaining.x;lastY=remaining.y;}});
  stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.035);},{passive:false});
  stage.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Escape'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yaw-=.08;if(e.key==='ArrowRight')yaw+=.08;if(e.key==='ArrowUp')pitch=Math.min(1.35,pitch+.06);if(e.key==='ArrowDown')pitch=Math.max(-1.35,pitch-.06);if(e.key==='+')zoom(-5);if(e.key==='-')zoom(5);if(e.key==='Escape')setAuto(false);requestRender();}});
  document.querySelectorAll<HTMLElement>('[data-room]').forEach(el=>el.onclick=()=>choose(el.dataset.room as PanoramaId));
  document.querySelectorAll<HTMLButtonElement>('[data-scheme]').forEach(button=>button.onclick=()=>{if(button.dataset.scheme!==schemeId)applyScheme(button.dataset.scheme as SchemeId);});
  const modal=$<HTMLDialogElement>('#tour-map-modal');
  for(const id of ['#tour-map-open','#tour-mobile-map'])$(id).onclick=()=>{setAuto(false);modal.showModal();};
  const materials=$<HTMLDialogElement>('#tour-material-modal');
  for(const id of ['#tour-materials-open','#tour-materials-mobile'])$(id).onclick=()=>{setAuto(false);materials.showModal();};
  $('#tour-materials-close').onclick=()=>materials.close();
  materials.addEventListener('click',e=>{if(e.target===materials){const r=materials.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)materials.close();}});
  $('#tour-map-close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
  document.querySelectorAll<SVGElement>('[data-map-room]').forEach(el=>{const go=()=>{choose(el.dataset.mapRoom as PanoramaId);modal.close();};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
  $('#tour-retry').onclick=()=>choose(current);$('#tour-auto').onclick=()=>setAuto(!auto);$('#tour-zoom-in').onclick=()=>zoom(-7);$('#tour-zoom-out').onclick=()=>zoom(7);
  $('#tour-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏');}};
  $('#tour-capture').onclick=()=>{if(!loaded){toast('请等待全景载入后保存');return;}render();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(renderer.domElement,0,0);ctx.fillStyle='rgba(30,30,25,.65)';ctx.fillRect(0,canvas.height-54,canvas.width,54);ctx.font='18px sans-serif';ctx.fillStyle='#fff';ctx.fillText(`栖光 · ${scheme().name} · ${find(loaded).name} · AI 全景效果 / 尺寸见户型模型`,24,canvas.height-20);const link=document.createElement('a');link.download=`栖光-${schemeId}-${loaded}-AI全景效果.png`;link.href=canvas.toDataURL('image/png');link.click();toast('当前视角已保存');};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setAuto(false);});
  (window as unknown as {__panoramaDiagnostics:()=>unknown}).__panoramaDiagnostics=()=>({room:current,loaded,scheme:schemeId,yaw,pitch,fov:camera.fov,auto,loading:!loading.hidden,error:!error.hidden,hotspots:hotspotButtons.length});
  window.addEventListener('pagehide',e=>{if(e.persisted){setAuto(false);return;}++request;cancelAnimationFrame(raf);resize.disconnect();texture?.dispose();sphere.geometry.dispose();material.dispose();renderer.dispose();},{once:true});
  applyScheme(schemeId);
}
