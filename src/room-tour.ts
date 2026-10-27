import {createIcons,ArrowUpRight,Plus,Minus,RotateCcw,Camera,Maximize,X,Map as MapIcon} from 'lucide';
import {designSchemes,schemeFromSearch,roomDesignDetails} from './design-schemes';
import type {SchemeId} from './design-schemes';
import {panoramaRooms} from './panorama-data';
import type {PanoramaId} from './panorama-data';
import {craftReferences,dailyPlacements,roomViewAsset,roomViewThumbnail} from './craft-guides';
import './panorama.css';
import './room-tour.css';

const icons={ArrowUpRight,Plus,Minus,RotateCcw,Camera,Maximize,X,Map:MapIcon};
const icon=(name:string)=>`<i data-lucide="${name}"></i>`;
export function startRoomTour(){
 const params=new URLSearchParams(location.search);
 let style=schemeFromSearch(location.search);
 let room:PanoramaId=panoramaRooms.some(r=>r.id===params.get('room'))?params.get('room') as PanoramaId:'living';
 let loaded:PanoramaId|null=null,ticket=0,scale=1,panX=0,panY=0;
 let drag:{x:number;y:number}|null=null;
 let toastTimer:ReturnType<typeof setTimeout>;
 const scheme=()=>designSchemes[style];
 const samples=()=>scheme().samples.map(s=>`<figure><div class="tour-sample ${s.wood?'sample-oak':''}" style="background-color:${s.color}"></div><figcaption>${s.name}<small>${s.note}</small></figcaption></figure>`).join('');
 document.body.classList.add('panorama-page','room-view-page');
 document.querySelector('#app')!.innerHTML=`<div class="tour-shell">
 <header class="tour-header"><a class="tour-brand" href="${import.meta.env.BASE_URL}"><span class="tour-mark">栖</span><span>栖光<span class="tour-brand-sub">A QUIETER HOME</span></span></a><div class="tour-project">我的家 · <span id="room-project-name"></span><span>生活细节修订</span></div><div class="tour-scheme-switch" role="group" aria-label="设计风格">${Object.values(designSchemes).map(s=>`<button data-scheme="${s.id}" aria-pressed="false">${s.name}</button>`).join('')}</div><a class="tour-model" id="room-model-link">尺寸户型模型 ${icon('arrow-up-right')}</a></header>
 <aside class="tour-sidebar"><div class="tour-intro"><span class="tour-eyebrow">MATERIALS · LIGHT · EVERYDAY LIFE</span><h1>把日常，<br>安放妥帖。</h1><p id="room-style-note"></p></div><div class="tour-nav-label">空间导览 <span>07 ROOMS</span></div><nav aria-label="空间效果导览">${panoramaRooms.map((r,i)=>`<button class="tour-nav" data-room="${r.id}"><span class="tour-num">0${i+1}</span><span>${r.name}<small>${r.english}</small></span>${icon('arrow-up-right')}</button>`).join('')}</nav><div class="room-reference"><span class="tour-eyebrow">DESIGN REFERENCE</span><a id="room-reference-link" target="_blank" rel="noopener"></a><p id="room-reference-note"></p></div><div class="tour-materials"><div id="room-palette"></div><button id="room-materials-open" class="tour-material-button">查看材质本色 ↗</button><button id="room-details-open" class="tour-material-button">摆放与装修细节 ↗</button></div></aside>
 <main class="tour-stage room-stage" id="room-stage" tabindex="0" aria-label="空间效果图，放大后可拖动查看细节"><figure class="room-photo-frame"><img id="room-photo" alt="" draggable="false" hidden></figure><div class="tour-shade"></div><div class="tour-scene-title"><span class="tour-eyebrow" id="room-number"></span><h2 id="room-title"></h2><p id="room-note"></p></div><nav class="tour-scene-modes" aria-label="空间查看方式"><span class="active" aria-current="page">空间效果</span><a id="room-panorama-link">360° 环顾 ↗</a></nav><div class="tour-load" id="room-loading" role="status"><span class="tour-spinner"></span><strong>正在打开空间…</strong></div><div class="tour-error" id="room-error" role="alert" hidden><strong>这张空间效果暂时未能载入</strong><p>请检查网络后重试，或切换其他房间。</p><button id="room-retry">重新载入</button><a id="room-fallback">打开 360° 空间参考</a></div><div class="tour-tools"><button id="room-zoom-in" aria-label="放大空间细节">${icon('plus')}</button><button id="room-zoom-out" aria-label="缩小空间效果">${icon('minus')}</button><button id="room-reset" aria-label="恢复完整视角">${icon('rotate-ccw')}</button><span></span><button id="room-save" aria-label="保存当前空间效果">${icon('camera')}</button><button id="room-fullscreen" aria-label="全屏查看空间效果">${icon('maximize')}</button><button id="room-materials-mobile" aria-label="查看材质本色">色</button></div><button class="room-details-button" id="room-details-mobile">摆放与装修细节 ↗</button><div class="tour-caption"><span id="room-materials"></span><span>放大后可拖动查看 · 恢复完整视角返回全图</span></div><div class="tour-disclosure">AI 空间效果 · 尺寸见户型模型</div><div class="tour-toast" id="room-toast" role="status"></div></main>
 <footer class="tour-bottom"><div class="tour-bottom-heading">细节，落在日常。<small>选择房间，继续看看</small></div><nav class="tour-thumbnails" aria-label="空间效果缩略图">${panoramaRooms.map(r=>`<button class="tour-thumb" data-room="${r.id}" aria-label="前往${r.name}"><img src="${roomViewThumbnail(r.id,style)}" loading="lazy" alt=""><span>${r.name}</span></button>`).join('')}</nav></footer></div>
 <dialog class="tour-map-modal tour-details-modal" id="room-details-modal"><div class="tour-map-heading"><div><span class="tour-eyebrow">A PLACE FOR EVERYDAY THINGS</span><h2 id="room-details-title"></h2></div><button id="room-details-close" aria-label="关闭摆放与装修细节">${icon('x')}</button></div><p id="room-details-subtitle"></p><div id="room-details-body"></div><a id="room-details-model">在尺寸模型中核对布局 ↗</a><small>本项目参考设计师公开作品中的方法，保留已确认的户型与使用需求。空间效果与 360° 参考的局部细节可能不同；尺寸和通行请核对模型。<a id="room-details-source" target="_blank" rel="noopener"></a></small></dialog>
 <dialog class="tour-map-modal tour-material-modal" id="room-materials-modal"><div class="tour-map-heading"><div><span class="tour-eyebrow">THE MATERIAL PALETTE</span><h2>先看本色，再看空间。</h2></div><button id="room-materials-close" aria-label="关闭材质本色">${icon('x')}</button></div><p id="room-material-intro"></p><div class="tour-sample-grid" id="room-samples"></div><small>这里是方案底色；屏幕、场景灯光与实物会有差异，最终需结合现场样板。</small></dialog>`;
 createIcons({icons,attrs:{'stroke-width':1.5}});
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
 const photo=$<HTMLImageElement>('#room-photo'),stage=$('#room-stage');
 function toast(message:string){$('#room-toast').textContent=message;$('#room-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#room-toast').classList.remove('show'),2600);}
 function transform(){photo.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`;stage.classList.toggle('is-zoomed',scale>1);}
 function reset(){scale=1;panX=panY=0;transform();}
 function zoom(factor:number){scale=Math.max(1,Math.min(3,scale*factor));if(scale===1){panX=panY=0;}clampPan();transform();}
 function clampPan(){const x=stage.clientWidth*(scale-1)/2,y=stage.clientHeight*(scale-1)/2;panX=Math.max(-x,Math.min(x,panX));panY=Math.max(-y,Math.min(y,panY));}
 function choose(id:PanoramaId){
  room=id;loaded=null;const ownTicket=++ticket;reset();photo.hidden=true;$('#room-loading').hidden=false;$('#room-error').hidden=true;
  const r=panoramaRooms.find(r=>r.id===id)!,reference=craftReferences[style];
  $('#room-project-name').textContent=scheme().name;$('#room-style-note').textContent=reference.material;
  $('#room-number').textContent=`0${panoramaRooms.indexOf(r)+1} / ${r.english}`;$('#room-title').textContent=r.name;$('#room-note').textContent=scheme().roomNotes[id]??r.note;
  $('#room-materials').textContent=scheme().roomMaterials[id];
  const model=`?view=model&design=${style}&room=${id}`,panorama=`?scene=panorama&design=${style}&room=${id}`;
  $<HTMLAnchorElement>('#room-model-link').href=model;$<HTMLAnchorElement>('#room-details-model').href=model;
  for(const s of ['#room-panorama-link','#room-fallback'])$<HTMLAnchorElement>(s).href=panorama;
  $('#room-reference-link').textContent=reference.name+' ↗';$<HTMLAnchorElement>('#room-reference-link').href=reference.url;$('#room-reference-note').textContent=reference.lesson;
  $('#room-details-title').textContent=r.name+' · 物品各有位置';$('#room-details-subtitle').textContent=scheme().name+' / '+reference.name+' 的方法参考';
  const detail=[...dailyPlacements[id],...roomDesignDetails(style,id)];
  $('#room-details-body').innerHTML=detail.map(d=>`<section><h3>${d.title}</h3><p>${d.text}</p></section>`).join('');
  $('#room-details-source').textContent='查看设计参考：'+reference.name+' ↗';$<HTMLAnchorElement>('#room-details-source').href=reference.url;
  $('#room-palette').innerHTML=scheme().samples.map(s=>`<i style="background:${s.color}" title="${s.name}"></i>`).join('');
  $('#room-samples').innerHTML=samples();$('#room-material-intro').textContent=scheme().materialIntro;
  for(const el of document.querySelectorAll<HTMLElement>('[data-room]')){const active=el.dataset.room===id;el.classList.toggle('active',active);el.setAttribute('aria-current',String(active));}
  for(const el of document.querySelectorAll<HTMLElement>('[data-scheme]')){const active=el.dataset.scheme===style;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}
  for(const s of ['forest','japanese','french','sunlit'])document.body.classList.toggle(s+'-scheme',style===s);
  for(const thumb of document.querySelectorAll<HTMLImageElement>('.tour-thumb img'))thumb.src=roomViewThumbnail(thumb.closest<HTMLElement>('[data-room]')!.dataset.room as PanoramaId,style);
  const url=new URL(location.href);url.searchParams.set('design',style);url.searchParams.set('room',id);url.searchParams.set('scene','room');history.replaceState(null,'',url);
  document.title=`栖光 · ${scheme().name} · ${r.name}`;
  const next=new Image();next.decoding='async';
  next.onload=async()=>{try{await next.decode();}catch{}if(ownTicket!==ticket)return;photo.src=next.src;photo.alt=`${scheme().name} · ${r.name}，独立空间效果视角`;photo.hidden=false;loaded=id;$('#room-loading').hidden=true;};
  next.onerror=()=>{if(ownTicket!==ticket)return;$('#room-loading').hidden=true;$('#room-error').hidden=false;};next.src=roomViewAsset(id,style);
 }
 for(const el of document.querySelectorAll<HTMLElement>('[data-room]'))el.onclick=()=>choose(el.dataset.room as PanoramaId);
 for(const el of document.querySelectorAll<HTMLElement>('[data-scheme]'))el.onclick=()=>{if(el.dataset.scheme!==style){style=el.dataset.scheme as SchemeId;choose(room);}};
 $('#room-zoom-in').onclick=()=>zoom(1.25);$('#room-zoom-out').onclick=()=>zoom(.8);$('#room-reset').onclick=reset;$('#room-retry').onclick=()=>choose(room);
 stage.addEventListener('wheel',e=>{if((e.target as Element).closest('button,a'))return;e.preventDefault();zoom(e.deltaY<0?1.12:.89);},{passive:false});
 photo.addEventListener('pointerdown',e=>{if(scale===1)return;drag={x:e.clientX,y:e.clientY};photo.setPointerCapture(e.pointerId);});
 photo.addEventListener('pointermove',e=>{if(!drag)return;panX+=e.clientX-drag.x;panY+=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};clampPan();transform();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])photo.addEventListener(event,()=>drag=null);
 stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}if(e.key==='-'){e.preventDefault();zoom(.8);}if(e.key==='Escape')reset();});
 new ResizeObserver(()=>{clampPan();transform();}).observe(stage);
 const details=$<HTMLDialogElement>('#room-details-modal'),materials=$<HTMLDialogElement>('#room-materials-modal');
 for(const s of ['#room-details-open','#room-details-mobile'])$(s).onclick=()=>details.showModal();$('#room-details-close').onclick=()=>details.close();
 for(const s of ['#room-materials-open','#room-materials-mobile'])$(s).onclick=()=>materials.showModal();$('#room-materials-close').onclick=()=>materials.close();
 for(const modal of [details,materials])modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();});
 $('#room-save').onclick=()=>{if(!loaded){toast('请等待空间效果载入');return;}const a=document.createElement('a');a.href=photo.src;a.download=`栖光-${style}-${room}-空间效果.jpg`;a.click();};
 $('#room-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏');}};
 Object.assign(window,{__roomViewDiagnostics:()=>({room,loaded,scheme:style,projection:'rectilinear',scale,imageWidth:photo.naturalWidth,imageHeight:photo.naturalHeight,loading:!$('#room-loading').hidden,error:!$('#room-error').hidden})});
 choose(room);
}
