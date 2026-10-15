import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rooms, outline, GLASS, WALL_HEIGHT } from './plan';
import type { Point } from './plan';
import type { Collider } from './navigation.mjs';
import { createOakFloorMaterial, FLOOR_TILE_WIDTH, FLOOR_TILE_LENGTH } from './floor';

export function buildHome() {
  const root = new THREE.Group();
  const architecture = new THREE.Group();
  const furniture = new THREE.Group();
  const ceilings = new THREE.Group();
  root.add(architecture, furniture, ceilings);
  const colliders: Collider[] = [];
  const cutPlane = new THREE.Plane(new THREE.Vector3(0,-1,0), 1.35);
  const architecturalMaterials: THREE.Material[] = [];
  const lamps: THREE.PointLight[] = [];
  const luminous: THREE.MeshStandardMaterial[] = [];
  const floorMeshes: THREE.Mesh[] = [];
  let seed = 42;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed-1)/2147483646; };
  const mat = (color: THREE.ColorRepresentation, roughness=.75, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  function texture(kind:'wood'|'linen'|'tile') {
    const c=document.createElement('canvas'); c.width=c.height=1024;
    const ctx=c.getContext('2d')!;
    if(kind==='wood') {
      ctx.fillStyle='#cfb68f'; ctx.fillRect(0,0,1024,1024);
      for(let p=0;p<8;p++) {
        const tone=Math.floor(random()*15);
        ctx.fillStyle=`rgb(${204+tone},${179+tone},${142+tone})`;
        ctx.fillRect(p*128,0,128,1024);
        for(let j=0;j<240;j++) {
          const x=p*128+random()*128;
          ctx.strokeStyle=`rgba(95,65,35,${random()*.095})`; ctx.lineWidth=random()*2+.3;
          ctx.beginPath(); ctx.moveTo(x,0);
          for(let y=0;y<=1024;y+=32) ctx.lineTo(x+Math.sin(y/160+j)*1.7,y);
          ctx.stroke();
        }
        ctx.fillStyle='rgba(90,65,42,.15)'; ctx.fillRect(p*128,0,1.4,1024);
        const cut=(p%3)*340;
        ctx.fillRect(p*128,cut,128,1.7);
      }
    } else if(kind==='linen') {
      ctx.fillStyle='#e8e2d5';ctx.fillRect(0,0,1024,1024);
      for(let i=0;i<75000;i++) {
        ctx.fillStyle=`rgba(${random()>.5?'90,78,61':'255,255,255'},${random()*.12})`;
        ctx.fillRect(random()*1024,random()*1024,1,random()*3+1);
      }
      ctx.strokeStyle='rgba(70,65,55,.035)';
      for(let i=0;i<1024;i+=4) {ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1024);ctx.stroke();}
    } else {
      ctx.fillStyle='#d4d1c7';ctx.fillRect(0,0,1024,1024);
      for(let i=0;i<70000;i++) { ctx.fillStyle=`rgba(90,83,72,${random()*.035})`; ctx.fillRect(random()*1024,random()*1024,2,2); }
      ctx.strokeStyle='#bdbbb1';ctx.lineWidth=2;
      ctx.strokeRect(0,0,512,512);ctx.strokeRect(512,0,512,512);ctx.strokeRect(0,512,512,512);ctx.strokeRect(512,512,512,512);
    }
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    return t;
  }
  const woodTex=texture('wood'),linenTex=texture('linen'),tileTex=texture('tile');
  const floorOak=createOakFloorMaterial();
  const wood=mat('#f4e1be');wood.map=woodTex;wood.roughness=.55;
  const oak=mat('#d5b182');oak.map=woodTex;
  const darkWood=mat('#96704b');
  const white=mat('#f4f0e5');
  const fabric=mat('#f0e9d9');fabric.map=linenTex;fabric.bumpMap=linenTex;fabric.bumpScale=.012;
  const sage=mat('#8e9b79');sage.map=linenTex;
  const oatmeal=mat('#c8af89');oatmeal.map=linenTex;
  const charcoal=mat('#303735',.55);
  const metal=mat('#9d9f96',.3,.65);
  const porcelain=mat('#fffdf5',.21);
  const glass=new THREE.MeshPhysicalMaterial({color:'#c2dbd5',roughness:.08,metalness:.05,transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false});
  const wallMat=mat('#e9e3d8');
  const capMat=mat('#8f958b');
  const archWhite=white.clone(),archMetal=metal.clone(),archGlass=glass.clone();
  architecturalMaterials.push(wallMat,capMat,archWhite,archMetal,archGlass);
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=white,parent:THREE.Object3D=furniture,round=0) {
    const mesh=new THREE.Mesh(round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),m);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(x:number,y:number,z:number,r:number,h:number,m:THREE.Material=wood,parent:THREE.Object3D=furniture,r2=r) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,h,24),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function sphere(x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,parent:THREE.Object3D=furniture) {
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function obstruction(x:number,z:number,w:number,d:number,name:string) {colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,name});}
  function shapeMesh(points:Point[],y:number,m:THREE.Material,parent:THREE.Object3D=root) {
    const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
    const geo=new THREE.ShapeGeometry(s);geo.rotateX(-Math.PI/2);
    const pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');
    const tileWidth=m===floorOak?FLOOR_TILE_WIDTH:3.2;
    const tileLength=m===floorOak?FLOOR_TILE_LENGTH:3.2;
    for(let i=0;i<pos.count;i++) uv.setXY(i,pos.getX(i)/tileWidth,pos.getZ(i)/tileLength);
    const mesh=new THREE.Mesh(geo,m);mesh.position.y=y;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  // The outer contour is irregular on purpose; no rectangular envelope is substituted.
  const slabShape=new THREE.Shape();outline.forEach(([x,z],i)=>i?slabShape.lineTo(x,-z):slabShape.moveTo(x,-z));slabShape.closePath();
  const slabGeo=new THREE.ExtrudeGeometry(slabShape,{depth:.20,bevelEnabled:false});slabGeo.rotateX(-Math.PI/2);
  const slab=new THREE.Mesh(slabGeo,mat('#d0cabd'));slab.position.y=-.22;slab.receiveShadow=true;root.add(slab);
  shapeMesh(outline,.003,floorOak);
  for(const r of rooms) {
    const fm=r.id==='bathroom'||r.id==='kitchen'||r.id==='balcony'?new THREE.MeshStandardMaterial({map:tileTex,roughness:.72,color:r.id==='bathroom'?'#c6d1cb':'#eee9dd'}):floorOak;
    const mesh=shapeMesh(r.polygon,.014,fm);mesh.userData.roomId=r.id;floorMeshes.push(mesh);
    const roof=shapeMesh(r.polygon,WALL_HEIGHT,mat('#f5f1e9'),ceilings);(roof.material as THREE.Material).side=THREE.DoubleSide;
  }
  ceilings.visible=false;
  function wall(x1:number,z1:number,x2:number,z2:number,h=WALL_HEIGHT,base=0,name='wall') {
    const w=Math.abs(x2-x1)||.22,d=Math.abs(z2-z1)||.22;
    const mesh=box((x1+x2)/2,base+h/2,(z1+z2)/2,w,h,d,wallMat,architecture);
    mesh.name=name;
    box((x1+x2)/2,base+h+.003,(z1+z2)/2,w,.015,d,capMat,architecture);
    if(base<.3) {
      obstruction((x1+x2)/2,(z1+z2)/2,w,d,name);
      box((x1+x2)/2,.055,(z1+z2)/2,w+.025,.11,d+.025,archWhite,architecture);
    }
    return mesh;
  }
  function windowWall(x1:number,z1:number,x2:number,z2:number,sill=.85,top=2.28,panes=2) {
    const alongX=Math.abs(x2-x1)>.01,len=alongX?Math.abs(x2-x1):Math.abs(z2-z1);
    wall(x1,z1,x2,z2,sill);wall(x1,z1,x2,z2,WALL_HEIGHT-top,top);
    const x=(x1+x2)/2,z=(z1+z2)/2;
    box(x,(sill+top)/2,z,alongX?len:.035,top-sill,alongX?.035:len,archGlass,architecture);
    for(const y of [sill,top]) box(x,y,z,alongX?len:.12,.045,alongX?.12:len,archWhite,architecture);
    for(let i=0;i<=panes;i++) box(x1+(x2-x1)*i/panes,(sill+top)/2,z1+(z2-z1)*i/panes,alongX?.045:.12,top-sill,alongX?.12:.045,archWhite,architecture);
    box(x,sill-.025,z,alongX?len+.08:.34,.045,alongX?.34:len+.08,archWhite,architecture);
  }
  function doorGap(x1:number,z1:number,x2:number,z2:number,hingeAtEnd=false,swing=1) {
    const alongX=Math.abs(x2-x1)>.01,len=Math.hypot(x2-x1,z2-z1);
    wall(x1,z1,x2,z2,.55,2.15);
    for(const [x,z] of [[x1,z1],[x2,z2]]) box(x,1.075,z,alongX?.055:.25,2.15,alongX?.25:.055,archWhite,architecture);
    box((x1+x2)/2,2.15,(z1+z2)/2,alongX?len+.07:.25,.055,alongX?.25:len+.07,archWhite,architecture);
    const leaf=new THREE.Group();leaf.position.set(hingeAtEnd?x2:x1,0,hingeAtEnd?z2:z1);furniture.add(leaf);
    const sign=hingeAtEnd?-1:1;
    box(sign*len/2,1.04,0,len-.045,2.08,.045,oak,leaf,.015);
    box(sign*(len-.13),1.03,-.045,.13,.025,.045,metal,leaf,.008);
    leaf.rotation.y=(alongX?0:-Math.PI/2)+swing*Math.PI/2;
    // Doors stay open; their leaves are slim obstacles but the original opening is passable.
    const bounds=new THREE.Box3().setFromObject(leaf);
    colliders.push({minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,name:'open door'});
  }
  // Upper left independent guest room.
  wall(1.88,0,2.65,0);windowWall(2.65,0,4.0,0);wall(4.0,0,5.3,0);
  wall(1.88,0,1.88,1.6);windowWall(1.88,1.6,1.88,3.15);wall(1.88,3.15,1.88,4.31);
  wall(5.3,0,5.3,4.31);
  wall(1.88,4.31,4.17,4.31);doorGap(4.17,4.31,5.19,4.31,true,-1);
  // Central bathroom and original door toward the public passage.
  windowWall(5.41,0,7.02,0,1.45,2.3);
  wall(7.13,0,7.13,4.31);
  wall(5.3,4.31,5.57,4.31);doorGap(5.57,4.31,6.57,4.31,true,-1);wall(6.57,4.31,7.13,4.31);
  // Balcony, dining and enclosed kitchen.
  wall(7.13,-.91,7.13,0);windowWall(7.13,-.91,9.85,-.91,.6,2.45,3);wall(9.85,-.91,9.85,0);
  wall(9.85,0,10.45,0);windowWall(10.45,0,11.55,0);wall(11.55,0,12.22,0);
  wall(12.22,0,12.22,1.15);windowWall(12.22,1.15,12.22,2.45,1.2);wall(12.22,2.45,12.22,3.01);
  wall(9.85,0,9.85,.75);doorGap(9.85,.75,9.85,1.8,false,1);wall(9.85,1.8,9.85,3.01);
  wall(9.85,3.01,12.22,3.01);
  // Entrance, main circulation, and the living room's narrowing lower outline.
  wall(11.46,3.01,11.46,3.24);doorGap(11.46,3.24,11.46,4.26,false,1);wall(11.46,4.26,11.46,6.31);
  wall(9.85,6.31,11.46,6.31);wall(9.85,6.31,9.85,8.76);wall(8.51,8.76,9.85,8.76);
  windowWall(8.51,8.76,8.51,9.62,.85);wall(8.51,9.62,8.51,10.76);
  // Bottom opening exists in the source; its exact composition is an estimate.
  windowWall(6.33,10.76,8.51,10.76,.85,2.28,3);
  // Master bedroom with the former bathroom converted to a dressing area.
  wall(-.11,4.31,2.9,4.31);doorGap(2.9,4.31,2.9,5.33,false,1);wall(2.9,5.33,2.9,5.65);
  wall(-.11,4.31,-.11,5.1);windowWall(-.11,5.1,-.11,8.4);wall(-.11,8.4,-.11,10.76);
  wall(-.11,10.76,.65,10.76);windowWall(.65,10.76,2.3,10.76);wall(2.3,10.76,3.36,10.76);
  wall(3.36,5.65,3.36,10.76);
  // Study original access and window. Glass is NEVER an opening for walking.
  wall(3.36,5.65,5.15,5.65);doorGap(5.15,5.65,6.22,5.65,true,1);
  wall(3.36,9.77,4.55,9.77);windowWall(4.55,9.77,6.33,9.77,.84,2.25);
  wall(6.33,5.65,6.33,GLASS.z1,WALL_HEIGHT,0,'bearing-wall-upper');
  wall(6.33,GLASS.z2,6.33,10.76,WALL_HEIGHT,0,'bearing-wall-lower');
  wall(6.33,GLASS.z1,6.33,GLASS.z2,GLASS.sill,0,'glass-sill');
  wall(6.33,GLASS.z1,6.33,GLASS.z2,WALL_HEIGHT-GLASS.top,GLASS.top,'glass-lintel');
  const glassPanel=box(6.33,(GLASS.top+GLASS.sill)/2,(GLASS.z1+GLASS.z2)/2,.035,GLASS.top-GLASS.sill,GLASS.z2-GLASS.z1,archGlass,architecture);
  glassPanel.name='fixed-study-glass';glassPanel.castShadow=false;
  obstruction(6.33,(GLASS.z1+GLASS.z2)/2,.1,GLASS.z2-GLASS.z1,'fixed glass');
  for(const z of [GLASS.z1,GLASS.z2]) box(6.33,(GLASS.sill+GLASS.top)/2,z,.07,GLASS.top-GLASS.sill,.04,archWhite,architecture);
  for(const y of [GLASS.sill,GLASS.top]) box(6.33,y,(GLASS.z1+GLASS.z2)/2,.07,.04,GLASS.z2-GLASS.z1,archWhite,architecture);
  const curtain=new THREE.Group();architecture.add(curtain);
  const curtainMat=fabric.clone();curtainMat.side=THREE.DoubleSide;architecturalMaterials.push(curtainMat);
  const curtainPanels:THREE.Mesh[]=[];
  for(let i=0;i<30;i++) {
    const panel=box(6.17+Math.sin(i*Math.PI)*.025,1.41,0,.045,1.9,.058,curtainMat,curtain,.015);
    curtainPanels.push(panel);
  }
  const setCurtain=(closed:boolean)=>curtainPanels.forEach((p,i)=>{p.position.z=closed?GLASS.z1+.025+i*(GLASS.z2-GLASS.z1-.05)/30:GLASS.z1-.24+i*.012;p.position.x=6.16+Math.sin(i*2.8)*.035;});
  setCurtain(false);
  // Soft contact shadows supplement real-time directional shadows.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d')!,sg=sc.createRadialGradient(64,64,8,64,64,64);sg.addColorStop(0,'rgba(50,40,28,.26)');sg.addColorStop(.5,'rgba(50,40,28,.13)');sg.addColorStop(1,'rgba(50,40,28,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
  const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
  function contact(x:number,z:number,w:number,d:number) {const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),shadowMat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.028,z);furniture.add(mesh);}
  function rug(x:number,z:number,w:number,d:number,color='#d6ccb9') {
    const m=mat(color);m.map=linenTex;m.bumpMap=linenTex;m.bumpScale=.02;
    box(x,.036,z,w,.025,d,m,furniture,.012);
    for(let k=0;k<2;k++) {box(x,.05,z+(d/2-.08)*(k?1:-1),w-.12,.004,.012,oatmeal);}
  }
  function plant(x:number,z:number,size=.65,base=0) {
    const pot=mat('#e3ddcc');cylinder(x,base+size*.2,z,size*.22,size*.4,pot,furniture,size*.17);
    cylinder(x,base+size*.405,z,size*.185,.014,mat('#514638'));
    const leafMats=[mat('#6a8052'),mat('#8c9d67'),mat('#4f6a43')];
    for(let i=0;i<11;i++) {
      const a=i*2.4, h=size*(.65+random()*.6);
      const end=new THREE.Vector3(x+Math.sin(a)*size*.35,base+h,z+Math.cos(a)*size*.35);
      const start=new THREE.Vector3(x,base+size*.4,z),delta=end.clone().sub(start);
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(.008,.012,delta.length(),5),leafMats[2]);stem.position.copy(start.add(end).multiplyScalar(.5));stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());furniture.add(stem);
      const leaf=sphere(end.x,end.y,end.z,size*.115,size*.28,size*.045,leafMats[i%3]);leaf.rotation.set(.4*Math.cos(a),a,.8*Math.sin(a));
    }
  }
  function table(x:number,z:number,w:number,d:number,h=.74) {
    contact(x,z,w+.4,d+.4);box(x,h,z,w,.07,d,wood,furniture,.045);
    for(const dx of [-1,1])for(const dz of [-1,1]) {const leg=box(x+dx*(w/2-.09),h/2,z+dz*(d/2-.09),.055,h-.04,.055,oak);leg.rotation.z=-dx*.045;}
    obstruction(x,z,w-.08,d-.08,'table');
  }
  function chair(x:number,z:number,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;furniture.add(g);
    box(0,.45,0,.43,.09,.44,fabric,g,.045);box(0,.71,.19,.43,.45,.065,wood,g,.04);
    for(const dx of [-.16,.16])for(const dz of [-.15,.15]) box(dx,.22,dz,.036,.44,.036,oak,g);
    contact(x,z,.65,.65);obstruction(x,z,.43,.43,'chair');
  }
  function wardrobe(x:number,z:number,w:number,d=.6,h=2.35,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;furniture.add(g);
    box(0,h/2,0,w,h,d,white,g,.015);
    const n=Math.max(2,Math.round(w/.5));
    for(let i=0;i<n;i++) {const px=-w/2+(i+.5)*w/n;box(px,h/2,d/2+.009,w/n-.008,h-.035,.018,white,g,.008);box(px+w/n/2-.065,h*.49,d/2+.032,.018,.25,.025,metal,g,.008);}
    box(0,.045,0,w-.1,.09,d-.02,charcoal,g);
    const bw=Math.abs(Math.cos(rot))*w+Math.abs(Math.sin(rot))*d, bd=Math.abs(Math.sin(rot))*w+Math.abs(Math.cos(rot))*d;
    obstruction(x,z,bw,bd,'wardrobe');contact(x,z,bw+.4,bd+.35);
  }
  function bed(x:number,z:number,w:number,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;furniture.add(g);
    box(0,.23,0,w+.12,.27,2.14,oak,g,.065);
    box(0,.46,0,w,.27,2.0,fabric,g,.10);
    box(0,.64,-1.04,w+.16,1.1,.09,wood,g,.055);
    box(0,.60,.25,w+.01,.13,1.43,fabric,g,.065);
    box(0,.68,.68,w+.025,.055,.50,oatmeal,g,.025);
    for(const dx of [-w*.25,w*.25]) {const p=box(dx,.67,-.68,w*.43,.17,.45,white,g,.09);p.rotation.y=dx*.10;}
    for(let i=0;i<9;i++) box(-w/2+.12+i*(w-.24)/8,.63,.25,.006,.007,1.30,white,g);
    obstruction(x,z,w+.12,2.14,'bed');contact(x,z,w+.7,2.6);
  }
  function sideTable(x:number,z:number) {cylinder(x,.45,z,.25,.065,wood);cylinder(x,.23,z,.065,.43,oak);contact(x,z,.6,.6);}
  function lamp(x:number,z:number,y=.52,scale=1) {
    cylinder(x,y,z,.11*scale,.03,metal);cylinder(x,y+.17*scale,z,.017,.32*scale,metal);
    const m=mat('#fff0cc',.7);m.emissive=new THREE.Color('#ffcc7c');m.emissiveIntensity=.12;luminous.push(m);
    cylinder(x,y+.36*scale,z,.13*scale,.18*scale,m,furniture,.20*scale);
    const light=new THREE.PointLight('#ffe4b3',0,2.5,2);light.position.set(x,y+.35*scale,z);root.add(light);lamps.push(light);
  }
  function book(x:number,y:number,z:number,w=.22,color='#7c8c72') {box(x,y,z,w,.035,.17,mat(color),furniture,.006);box(x,y+.008,z+.002,w-.015,.018,.173,white);}
  // Revised living arrangement: a 65-inch screen and low oak console face the sofa.
  // The user prefers the middle position; it partially screens the original glass.
  rug(8.15,7.28,1.45,2.25,'#d9d0bf');
  const sofa=new THREE.Group();sofa.position.set(9.15,0,7.28);sofa.rotation.y=Math.PI/2;furniture.add(sofa);
  box(0,.24,0,2.05,.22,.87,oak,sofa,.06);
  box(0,.47,0,1.86,.27,.77,fabric,sofa,.12);
  box(0,.78,.32,2.05,.65,.22,fabric,sofa,.1);
  for(const dx of [-.95,.95])box(dx,.58,0,.19,.5,.88,fabric,sofa,.08);
  for(const dx of [-.48,.48])box(dx,.64,-.07,.89,.13,.62,fabric,sofa,.06);
  for(const [dx,material] of [[-.64,sage],[.58,oatmeal]] as const) {const p=box(dx,.91,.12,.4,.4,.16,material,sofa,.1);p.rotation.z=dx*.24;p.rotation.x=-.18;}
  obstruction(9.15,7.28,.92,2.05,'sofa');contact(9.15,7.28,1.4,2.6);
  const tv=new THREE.Group();tv.position.set(6.72,0,7.28);tv.rotation.y=Math.PI/2;furniture.add(tv);
  const consoleVeneer=floorOak.map!.clone();
  consoleVeneer.repeat.set(.11,.40);consoleVeneer.offset.set(.0075,.05);
  const consoleWood=mat('#c9ab80',.70);consoleWood.map=consoleVeneer;
  const consoleFront=mat('#d7c09d',.72);consoleFront.map=consoleVeneer;
  // Recessed feet, a slightly overhanging top, flush side doors and a central shelf.
  for(const x of [-.72,.72])for(const z of [-.12,.12])box(x,.075,z,.045,.12,.045,consoleWood,tv,.008);
  box(0,.135,0,1.76,.065,.38,consoleWood,tv,.012);
  box(0,.445,0,1.80,.05,.42,consoleFront,tv,.014);
  box(0,.29,-.177,1.75,.28,.025,consoleWood,tv);
  for(const x of [-.865,-.31,.31,.865])box(x,.29,0,.025,.28,.38,consoleWood,tv);
  for(const x of [-.59,.59]) {
    box(x,.29,.196,.53,.265,.024,consoleFront,tv,.008);
    box(x,.423,.207,.40,.006,.007,darkWood,tv);
  }
  box(0,.275,.015,.59,.022,.34,consoleWood,tv);
  box(0,.195,.06,.35,.035,.22,charcoal,tv,.008);
  box(0,.332,.04,.31,.038,.22,oatmeal,tv,.004);
  box(0,.36,.04,.29,.014,.215,white,tv,.003);
  // Two short feet sit on the console; the display is supported independently of glass.
  for(const x of [-.51,.51]) {
    box(x,.49,.015,.13,.025,.24,charcoal,tv,.008);
    box(x,.53,-.015,.028,.08,.035,charcoal,tv,.006);
  }
  box(0,.976,-.015,1.475,.85,.045,charcoal,tv,.018);
  const screen=mat('#273c38',.23);screen.emissive=new THREE.Color('#29423d');screen.emissiveIntensity=.25;
  box(0,.978,.012,1.439,.809,.007,screen,tv,.006);
  box(0,.563,.013,.028,.004,.006,metal,tv,.001);
  obstruction(6.72,7.28,.42,1.80,'TV console');contact(6.72,7.28,.76,2.12);
  sideTable(9.13,8.45);book(9.13,.505,8.45);plant(9.22,5.94,.57);
  cylinder(7.68,.28,10.02,.30,.46,fabric);contact(7.68,10.02,.8,.8);obstruction(7.68,10.02,.6,.6,'stool');
  lamp(8.10,9.85,.08,2.4);
  // Study: no large storage in front of borrowed-light glass.
  wardrobe(4.22,6.04,1.3,.55,2.25);
  table(4.73,9.35,1.70,.58,.75);chair(4.20,8.72);chair(5.18,8.72);
  const laptop=new THREE.Group();laptop.position.set(4.78,.80,9.36);furniture.add(laptop);
  box(0,0,0,.34,.016,.24,metal,laptop,.007);const lid=box(0,.12,.115,.34,.23,.012,charcoal,laptop,.007);lid.rotation.x=-.15;
  box(0,.12,.104,.30,.19,.005,screen,laptop);
  book(5.22,.81,9.35);lamp(4.03,9.38,.8,.65);plant(5.4,9.40,.20,.80);
  // A compact foldable guest bed/daybed on the left. It is not a permanent bedroom.
  box(3.96,.23,7.75,.82,.25,1.90,oak,furniture,.04);
  box(3.96,.42,7.75,.80,.20,1.86,fabric,furniture,.07);
  box(3.96,.56,7.10,.64,.17,.38,sage,furniture,.07);
  box(3.96,.54,8.25,.80,.045,.50,oatmeal,furniture,.02);
  obstruction(3.96,7.75,.82,1.9,'folding bed');contact(3.96,7.75,1.2,2.3);
  // Master bed follows the concept plan, with headboard at the lower end.
  rug(1.57,9.13,2.65,2.80,'#d9cfbd');bed(1.55,9.10,1.80,Math.PI);
  sideTable(.32,9.88);lamp(.32,9.88);sideTable(2.72,9.88);plant(2.72,9.88,.22,.5);
  wardrobe(1.22,6.55,1.75,.6,2.38);wardrobe(.25,5.3,1.32,.48,2.38,Math.PI/2);
  const mirror=new THREE.Mesh(new THREE.CircleGeometry(.35,48),mat('#b8c4be',.15,.7));mirror.position.set(1.85,1.5,4.44);furniture.add(mirror);
  box(1.85,.75,4.64,.7,.05,.28,wood,furniture,.025);plant(1.65,4.65,.18,.8);
  // Guest room / future children's room.
  rug(3.59,2.0,2.25,2.8,'#d1d1b9');bed(3.65,1.45,1.50);
  table(2.38,1.8,.50,1.18,.74);chair(2.38,2.85);book(2.39,.8,1.5);plant(2.39,1.4,.2,.8);
  wardrobe(2.98,3.88,1.6,.42,1.02,Math.PI);
  sideTable(4.7,.60);lamp(4.7,.6);
  // Dining is 1200 x 700, with left bench and right chairs.
  table(7.98,2.63,.70,1.20);
  box(7.38,.44,2.63,.35,.09,1.20,wood,furniture,.035);
  for(const z of [2.2,3.05])box(7.38,.22,z,.22,.44,.05,oak);
  obstruction(7.38,2.63,.35,1.2,'dining bench');chair(8.68,2.24,Math.PI/2);chair(8.68,3.03,Math.PI/2);
  plant(7.98,2.63,.25,.79);book(7.96,.80,3.0,.18,'#c3b697');
  cylinder(7.98,2.52,2.63,.018,.36,charcoal);
  const pendantMat=mat('#f5ead4');pendantMat.emissive=new THREE.Color('#ffd79e');pendantMat.emissiveIntensity=.18;luminous.push(pendantMat);
  const shade=new THREE.Mesh(new THREE.SphereGeometry(.25,32,16,0,Math.PI*2,0,Math.PI/2),pendantMat);shade.position.set(7.98,2.30,2.63);furniture.add(shade);
  // Kitchen cabinetry, countertop, sink, appliances.
  const counter=mat('#eeece3',.28),steel=mat('#929f9d',.25,.75);
  function cabinet(x:number,z:number,w:number,d:number,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;furniture.add(g);
    box(0,.43,0,w,.80,d,white,g,.015);box(0,.86,0,w+.02,.055,d+.03,counter,g,.012);
    const count=Math.max(1,Math.round(w/.48));
    for(let i=0;i<count;i++){box(-w/2+(i+.5)*w/count,.43,d/2+.01,w/count-.012,.74,.02,white,g,.005);box(-w/2+(i+.5)*w/count,.75,d/2+.03,.17,.012,.015,metal,g);}
    obstruction(x,z,rot?d:w,rot?w:d,'kitchen cabinet');
  }
  cabinet(11.02,.33,2.08,.6);cabinet(11.79,1.77,2.2,.6,-Math.PI/2);
  box(10.90,.894,.33,.69,.025,.43,steel,furniture,.06);box(10.90,.91,.33,.55,.025,.31,charcoal,furniture,.06);
  cylinder(11.20,1.04,.19,.018,.32,metal);box(11.12,1.20,.19,.17,.025,.025,metal,furniture,.01);
  box(11.78,.905,1.65,.46,.035,.71,charcoal,furniture,.02);
  for(const z of [1.45,1.88]) {cylinder(11.78,.93,z,.13,.013,metal);cylinder(11.78,.943,z,.09,.018,charcoal);}
  cylinder(11.78,1.04,1.88,.11,.20,steel);cylinder(11.78,1.15,1.88,.12,.015,metal);
  box(11.92,1.99,1.65,.39,.15,.74,metal,furniture,.02);box(12.02,2.28,1.65,.18,.45,.35,white);
  wardrobe(10.33,2.55,.65,.66,1.80);box(10.33,1.48,2.89,.61,.6,.035,metal,furniture,.02);box(10.33,.68,2.89,.61,.9,.035,metal,furniture,.02);
  plant(10.23,.33,.2,.9);
  // Bathroom: shower north, toilet middle, shallow basin south.
  const bathTile=mat('#bec8c0',.46);box(6.2,.05,.71,1.52,.07,1.28,bathTile,furniture,.015);
  const shower=box(5.85,1.1,1.38,.8,2.1,.025,glass);shower.castShadow=false;
  box(5.85,2.15,1.38,.83,.025,.03,metal);box(6.2,1.9,.17,.035,.95,.035,metal);
  cylinder(6.2,2.35,.38,.14,.025,metal);box(6.2,2.3,.28,.025,.1,.3,metal);
  // Shower enclosure has a walkthrough access on the right; no false full-width collision.
  obstruction(5.85,1.38,.8,.03,'shower glass');
  box(5.73,.55,2.27,.39,.72,.19,porcelain,furniture,.06);sphere(5.92,.38,2.27,.31,.19,.24,porcelain);sphere(5.97,.48,2.27,.27,.035,.21,white);
  obstruction(5.85,2.27,.70,.5,'toilet');
  box(5.72,.52,3.45,.45,.6,.65,oak,furniture,.02);box(5.72,.85,3.45,.49,.08,.69,porcelain,furniture,.03);
  sphere(5.72,.90,3.45,.18,.025,.24,mat('#bdc6bf'));box(5.55,1.02,3.45,.025,.25,.025,metal);
  box(5.43,1.55,3.45,.025,.75,.58,mat('#aab9b2',.1,.8),furniture,.04);
  obstruction(5.72,3.45,.5,.7,'basin');
  // Laundry and small plants do not fill the balcony glazing.
  box(7.65,.46,-.25,.62,.9,.64,white,furniture,.025);
  const drum=cylinder(7.65,.46,.086,.21,.025,metal);drum.rotation.x=Math.PI/2;
  const drumGlass=cylinder(7.65,.46,.11,.16,.03,charcoal);drumGlass.rotation.x=Math.PI/2;
  box(7.65,.79,.077,.5,.09,.015,white);box(7.65,.94,-.25,.66,.06,.69,wood,furniture,.01);
  obstruction(7.65,-.25,.66,.69,'laundry');plant(9.32,-.38,.65);plant(9.41,.45,.35);
  wardrobe(11.12,5.63,.85,.34,1.12,-Math.PI/2);plant(11.11,5.6,.2,1.15);
  // Framed artwork: simple relief forms, no external image dependencies.
  const art=new THREE.Group();art.position.set(9.715,1.72,7.3);art.rotation.y=-Math.PI/2;furniture.add(art);
  box(0,0,0,.84,.64,.025,oak,art,.015);box(0,0,.018,.77,.57,.008,white,art);
  const artShape=new THREE.Mesh(new THREE.CircleGeometry(.19,40),mat('#a0aa8d'));artShape.position.set(.09,.03,.025);art.add(artShape);
  box(-.15,-.1,.027,.15,.28,.005,oatmeal,art,.03);
  // Light groups are illustrative ambience, not a daylight calculation.
  for(const r of rooms) {
    const light=new THREE.PointLight('#ffe3b2',0,r.id==='living'?6:4.8,2);light.position.set(r.center[0],2.38,r.center[1]);root.add(light);lamps.push(light);
    if(r.id!=='dining') {cylinder(r.center[0],2.65,r.center[1],.17,.045,white,ceilings);}
  }
  let currentCutaway=false;
  function setCutaway(enabled:boolean) {
    if(enabled===currentCutaway)return;currentCutaway=enabled;
    architecturalMaterials.forEach(m=>{m.clippingPlanes=enabled?[cutPlane]:[];m.clipShadows=true;m.needsUpdate=true;});
  }
  function setNight(night:boolean) {lamps.forEach((l,i)=>{l.visible=night;l.intensity=night?(i<3?1.2:4.2):0;});luminous.forEach(m=>m.emissiveIntensity=night?1.25:.13);}
  setNight(false);
  // Merge static pieces by material to keep the detailed model responsive.
  function batch(group:THREE.Group,skip?:THREE.Object3D) {
    root.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    const originals:THREE.Mesh[]=[];
    group.traverse(node=>{
      if(!(node instanceof THREE.Mesh)||Array.isArray(node.material))return;
      for(let p:THREE.Object3D|null=node;p;p=p.parent)if(p===skip)return;
      const source=node.geometry.clone().applyMatrix4(node.matrixWorld);
      const geometry=source.index?source.toNonIndexed():source;
      if(source!==geometry)source.dispose();
      const list=batches.get(node.material)||[];list.push(geometry);batches.set(node.material,list);originals.push(node);
    });
    for(const node of originals)node.removeFromParent();
    for(const [material,geometries] of batches) {
      const merged=mergeGeometries(geometries,false);if(!merged)continue;
      const mesh=new THREE.Mesh(merged,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;group.add(mesh);
      geometries.forEach(g=>g.dispose());
    }
  }
  batch(furniture);batch(architecture,curtain);
  return {root,architecture,furniture,ceilings,colliders,floorMeshes,setCutaway,setNight,setCurtain,glassPanel};
}
