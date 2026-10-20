import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHome } from './model';
import { rooms, outline, roomById } from './plan';
import { moveWithCollision, pointInPolygon, canOccupy } from './navigation.mjs';
import type { RoomId } from './plan';
import { HOME_STYLE } from './style-palette';
import { MEASUREMENTS, WALL_THICKNESS, X, Z } from './dimensions';

export type Mode = 'orbit' | 'walk' | 'plan';
export class HomeViewer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40,1,.06,130);
  controls: OrbitControls;
  model = buildHome();
  mode: Mode = 'orbit';
  activeRoom: string = 'all';
  night = false;
  cutaway = false;
  labelsVisible = true;
  keys = new Set<string>();
  yaw=0;pitch=0;
  private hemisphere = new THREE.HemisphereLight(HOME_STYLE.skyLight,HOME_STYLE.reflectedLight,1.55);
  private sun = new THREE.DirectionalLight(HOME_STYLE.daylight,1.75);
  private fill = new THREE.DirectionalLight(HOME_STYLE.fillLight,.65);
  private ground:THREE.Mesh;
  private labels: {element:HTMLButtonElement;position:THREE.Vector3}[]=[];
  private transition: {time:number;from:THREE.Vector3;to:THREE.Vector3;fromTarget:THREE.Vector3;toTarget:THREE.Vector3;done?:()=>void}|null=null;
  private pointer: {x:number;y:number;id:number;moved:boolean}|null=null;
  private raycaster = new THREE.Raycaster();
  private lastFrame=0;
  private frameCount=0;
  private dirty=true;
  private lastCameraMatrix=new THREE.Matrix4();
  private hooks: {onRoom:(id:string)=>void;onMode:(mode:Mode)=>void;onMove:(x:number,z:number,yaw:number)=>void;onReady:()=>void};
  constructor(private container:HTMLElement, hooks:HomeViewer['hooks']) {
    this.hooks=hooks;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    const gl=this.renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
    const software=debug && /swiftshader|llvmpipe|software|softpipe/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    this.renderer.setPixelRatio(software?.65:Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.localClippingEnabled=true;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.98;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','可旋转、缩放和漫游的装修房屋三维模型');
    this.renderer.domElement.setAttribute('tabindex','0');
    this.scene.background=new THREE.Color('#e7e7df');
    const pmrem=new THREE.PMREMGenerator(this.renderer),environment=new RoomEnvironment();
    this.scene.environment=pmrem.fromScene(environment,.04).texture;
    this.scene.environmentIntensity=.28;environment.dispose();pmrem.dispose();
    this.scene.add(this.hemisphere,this.sun,this.fill,this.model.root);
    this.sun.position.set(-3,15,8);this.sun.target.position.set(5,0,5);this.scene.add(this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-11;this.sun.shadow.camera.right=11;this.sun.shadow.camera.top=11;this.sun.shadow.camera.bottom=-11;
    this.sun.shadow.camera.far=40;this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00012;this.sun.shadow.radius=4;
    this.fill.position.set(14,9,-6);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#e1e2da',roughness:1}));
    this.ground.rotation.x=-Math.PI/2;this.ground.position.set(5,-.25,5);this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.maxPolarAngle=Math.PI/2-.05;this.controls.minDistance=3;this.controls.maxDistance=70;
    this.controls.target.set(6,.3,4.27);this.camera.position.set(16,23,24);
    this.controls.addEventListener('start',()=>this.transition=null);
    this.addLabels();this.addEvents();
    new ResizeObserver(()=>this.resize()).observe(container);this.resize();
    this.reset(false);
    this.renderer.setAnimationLoop(t=>this.animate(t));
    const diagnostics=()=>({mode:this.mode,room:this.activeRoom,night:this.night,cutaway:this.cutaway,layout:this.model.layout,sizing:{source:'newStructure.jpg',measurements:MEASUREMENTS,wallThickness:WALL_THICKNESS,anchors:{X,Z}},windows:this.model.windows,walls:this.model.walls,transitioning:!!this.transition,frame:this.frameCount,keys:[...this.keys],outline,rooms:rooms.map(r=>({id:r.id,spawn:r.spawn})),position:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},yaw:this.yaw,meshes:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,colliders:this.model.colliders,spawnChecks:rooms.map(r=>({id:r.id,valid:canOccupy(...r.spawn,outline,this.model.colliders)}))});
    Object.assign(window,{__homeDiagnostics:diagnostics});
  }
  private resize() {const {clientWidth:w,clientHeight:h}=this.container;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.dirty=true;}
  private addLabels() {
    const layer=document.createElement('div');layer.className='room-labels';layer.setAttribute('aria-label','房间快捷导航');this.container.append(layer);
    for(const r of rooms) {
      const el=document.createElement('button');el.className='room-label';el.dataset.room=r.id;el.innerHTML=`<span class="label-dot"></span>${r.name.split(' / ')[0]}<span class="label-arrow">↗</span>`;
      el.addEventListener('click',()=>this.selectRoom(r.id));layer.append(el);
      this.labels.push({element:el,position:new THREE.Vector3(r.center[0],.85,r.center[1])});
    }
  }
  private addEvents() {
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      this.pointer={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};
      if(this.mode==='walk') {canvas.setPointerCapture(e.pointerId);canvas.focus();}
    });
    canvas.addEventListener('pointermove',e=>{
      if(!this.pointer)return;
      const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;
      if(Math.abs(dx)+Math.abs(dy)>3)this.pointer.moved=true;
      if(this.mode==='walk') {
        this.yaw-=dx*.004;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*.004,-1.25,1.25);
        this.pointer.x=e.clientX;this.pointer.y=e.clientY;this.orient();
      }
    });
    canvas.addEventListener('pointerup',e=>{
      if(this.pointer&&!this.pointer.moved&&this.mode!=='walk') {
        const rect=canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
        const hits=this.raycaster.intersectObjects(this.model.floorMeshes);
        if(hits[0])this.selectRoom(hits[0].object.userData.roomId);
      }
      this.pointer=null;
    });
    canvas.addEventListener('pointercancel',()=>this.pointer=null);
    window.addEventListener('keydown',e=>{
      if((e.target as HTMLElement).matches('input,textarea,select')||document.querySelector('dialog[open]'))return;
      if(e.code==='Escape'&&this.mode==='walk'){this.setMode('orbit');return;}
      if(this.mode==='walk'&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.keys.clear();this.pointer=null;});
    document.addEventListener('visibilitychange',()=>this.keys.clear());
  }
  private orient() {this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);}
  private animate(t:number) {
    const elapsed=(t-this.lastFrame)/1000,dt=Math.min(elapsed,.15);this.lastFrame=t;
    if(this.transition) {
      const tr=this.transition;tr.time+=elapsed;const p=Math.min(tr.time/.85,1),k=1-Math.pow(1-p,3);
      this.camera.position.lerpVectors(tr.from,tr.to,k);this.controls.target.lerpVectors(tr.fromTarget,tr.toTarget,k);
      this.camera.lookAt(this.controls.target);
      if(p===1){this.transition=null;tr.done?.();}
    } else if(this.mode==='walk') {
      const forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0);
      const side=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);
      if(forward||side) {
        const speed=(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?2.5:1.45)*dt/Math.max(1,Math.hypot(forward,side));
        const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*speed;
        const dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*speed;
        const p=moveWithCollision(this.camera.position,dx,dz,outline,this.model.colliders);
        this.camera.position.set(p.x,1.58,p.z);
        const r=rooms.find(r=>pointInPolygon(p.x,p.z,r.polygon));
        if(r&&r.id!==this.activeRoom){this.activeRoom=r.id;this.hooks.onRoom(r.id);}
      }
      this.orient();
    } else this.controls.update();
    // Labels are DOM buttons, so room navigation also works with keyboard and screen readers.
    for(const label of this.labels) {
      const visible=this.labelsVisible&&this.mode!=='walk';label.element.hidden=!visible;
      if(visible) {
        const p=label.position.clone().project(this.camera);
        label.element.style.transform=`translate(-50%,-50%) translate(${(p.x*.5+.5)*this.container.clientWidth}px,${(-p.y*.5+.5)*this.container.clientHeight}px)`;
        label.element.style.opacity=p.z>1||p.z< -1?'0':'1';
        label.element.classList.toggle('selected',label.element.dataset.room===this.activeRoom);
      }
    }
    if(this.frameCount%6===0)this.hooks.onMove(this.camera.position.x,this.camera.position.z,this.yaw);
    this.camera.updateMatrixWorld();
    if(this.dirty || !this.camera.matrixWorld.equals(this.lastCameraMatrix) || this.renderer.shadowMap.needsUpdate) {
      this.renderer.render(this.scene,this.camera);this.lastCameraMatrix.copy(this.camera.matrixWorld);this.dirty=false;
    }
    if(this.frameCount++===2)this.hooks.onReady();
  }
  private go(position:THREE.Vector3,target:THREE.Vector3,done?:()=>void) {
    this.transition={time:0,from:this.camera.position.clone(),to:position,fromTarget:this.controls.target.clone(),toTarget:target,done};
  }
  selectRoom(id:string) {
    if(id==='all'){this.reset();return;}
    const r=roomById(id);if(!r)return;
    this.activeRoom=id;this.hooks.onRoom(id);
    if(this.mode==='walk'){this.enterRoom(id as RoomId);return;}
    const [x,z]=r.center;
    if(this.mode==='plan')this.go(new THREE.Vector3(x,15,z+.001),new THREE.Vector3(x,0,z));
    else this.go(new THREE.Vector3(x+4.4,9.6,z+6.2),new THREE.Vector3(x,.65,z));
  }
  reset(animate=true) {
    this.mode='orbit';this.activeRoom='all';this.camera.fov=40;this.camera.updateProjectionMatrix();this.controls.enabled=true;this.controls.enableRotate=true;this.model.ceilings.visible=false;this.renderer.shadowMap.needsUpdate=true;
    this.model.setCutaway(this.cutaway);this.hooks.onRoom('all');this.hooks.onMode('orbit');this.keys.clear();
    const aspect=this.container.clientWidth/this.container.clientHeight;
    const compact=aspect<1.1;
    const target=new THREE.Vector3(6,compact?-2.3:.35,4.27);
    const distanceScale=Math.max(1.25,1.1/aspect);
    const pos=compact?target.clone().add(new THREE.Vector3(5.5,20.5,14).multiplyScalar(distanceScale)):new THREE.Vector3(11.5,19.5,16.87);
    if(animate)this.go(pos,target);else{this.camera.position.copy(pos);this.controls.target.copy(target);this.camera.lookAt(target);}
  }
  setMode(mode:Mode) {
    this.keys.clear();
    if(mode==='walk'){this.enterRoom((this.activeRoom==='all'?'entry':this.activeRoom) as RoomId);return;}
    this.mode=mode;this.camera.fov=40;this.camera.updateProjectionMatrix();this.controls.enabled=true;this.controls.enableRotate=mode!=='plan';this.model.ceilings.visible=false;this.renderer.shadowMap.needsUpdate=true;
    this.model.setCutaway(this.cutaway||mode==='plan');this.hooks.onMode(mode);
    if(mode==='plan'){this.go(new THREE.Vector3(6,23,4.271),new THREE.Vector3(6,0,4.27));}
    else this.reset();
  }
  enterRoom(id:RoomId) {
    const r=roomById(id)!;this.transition=null;this.keys.clear();this.mode='walk';this.activeRoom=id;this.controls.enabled=false;this.camera.fov=68;this.camera.updateProjectionMatrix();
    this.model.setCutaway(false);this.model.ceilings.visible=true;this.renderer.shadowMap.needsUpdate=true;
    this.camera.position.set(r.spawn[0],1.58,r.spawn[1]);
    this.yaw=Math.atan2(-(r.look[0]-r.spawn[0]),-(r.look[1]-r.spawn[1]));this.pitch=id==='living'?-.33:-.03;this.orient();
    this.hooks.onRoom(id);this.hooks.onMode('walk');this.renderer.domElement.focus({preventScroll:true});
  }
  setNight(night:boolean) {
    this.dirty=true;this.night=night;this.model.setNight(night);this.hemisphere.intensity=night?.40:1.55;this.sun.intensity=night?.20:1.75;this.fill.intensity=night?.17:.65;
    this.sun.color.set(night?'#c3d1e3':HOME_STYLE.daylight);this.scene.environmentIntensity=night?.12:.28;
    this.scene.background=new THREE.Color(night?'#242c32':'#e7e7df');(this.ground.material as THREE.MeshStandardMaterial).color.set(night?'#252e34':'#e1e2da');
    this.renderer.toneMappingExposure=night?1.20:.98;
  }
  setCutaway(value:boolean) {this.renderer.shadowMap.needsUpdate=true;this.cutaway=value;this.model.setCutaway(this.mode==='walk'?false:this.mode==='plan'||value);}
  zoom(amount:number) {if(this.mode==='walk')return;this.camera.position.sub(this.controls.target).multiplyScalar(amount).add(this.controls.target);}
  screenshot() {
    this.renderer.render(this.scene,this.camera);
    const a=document.createElement('a');a.download=`栖光-方案B-${this.night?'夜间':'日间'}-${this.activeRoom}.png`;a.href=this.renderer.domElement.toDataURL('image/png');a.click();
  }
}
