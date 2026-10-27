import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rooms, outline, LAYOUT, WALL_HEIGHT } from './plan';
import type { Point } from './plan';
import type { Collider } from './navigation.mjs';
import { createOakFloorMaterial, FLOOR_TILE_WIDTH, FLOOR_TILE_LENGTH } from './floor';
import { HOME_STYLE } from './style-palette';
import { modelPalettes } from './design-schemes';
import type { SchemeId } from './design-schemes';
import { X, Z, relocateFurniture } from './dimensions';
import { buildKitchenDoors } from './kitchen-doors';

export function buildHome() {
  const root = new THREE.Group();
  const architecture = new THREE.Group();
  const furniture = new THREE.Group();
  const ceilings = new THREE.Group();
  root.add(architecture, furniture, ceilings);
  const colliders: Collider[] = [];
  const cutPlane = new THREE.Plane(new THREE.Vector3(0,-1,0), 1.35);
  const architecturalMaterials: THREE.Material[] = [];
  const lamps: { light: THREE.PointLight; nightIntensity: number }[] = [];
  const luminous: THREE.MeshStandardMaterial[] = [];
  const floorMeshes: THREE.Mesh[] = [];
  const windows: {x1:number;z1:number;x2:number;z2:number}[]=[];
  const walls: {name:string;x1:number;z1:number;x2:number;z2:number;base:number;height:number;opaque:boolean;color:string}[]=[];
  let seed = 42;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed-1)/2147483646; };
  const mat = (color: THREE.ColorRepresentation, roughness=.75, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  function texture(kind:'wood'|'linen'|'tile') {
    const c=document.createElement('canvas'); c.width=c.height=1024;
    const ctx=c.getContext('2d')!;
    if(kind==='wood') {
      // Furniture veneer has long quiet fibers, with no floorboard joints.
      ctx.fillStyle='#ebeae6'; ctx.fillRect(0,0,1024,1024);
      const wash=ctx.createLinearGradient(0,0,1024,0);
      wash.addColorStop(0,'rgba(80,73,62,.015)');
      wash.addColorStop(.4,'rgba(255,255,253,.05)');
      wash.addColorStop(.75,'rgba(80,73,62,.020)');
      wash.addColorStop(1,'rgba(255,255,253,.035)');
      ctx.fillStyle=wash;ctx.fillRect(0,0,1024,1024);
      for(let j=0;j<175;j++) {
        const x=random()*1024,phase=random()*6;
        ctx.strokeStyle=`rgba(80,73,62,${.018+random()*.033})`;ctx.lineWidth=.6+random()*1.4;
        ctx.beginPath();ctx.moveTo(x,0);
        for(let y=0;y<=1024;y+=32)ctx.lineTo(x+Math.sin(y/230+phase)*5+Math.sin(y/410+phase)*8,y);
        ctx.stroke();
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
  const wood=mat(HOME_STYLE.whiteOak,.70);wood.map=woodTex;
  const oak=mat(HOME_STYLE.whiteOakEdge,.72);oak.map=woodTex;
  const cherry=mat(HOME_STYLE.cherry,.69);cherry.map=woodTex;
  const cherryEdge=mat(HOME_STYLE.cherryEdge,.72);cherryEdge.map=woodTex;
  const cherryFront=mat(HOME_STYLE.cherryFront,.71);cherryFront.map=woodTex;
  for(const material of [wood,oak,cherry,cherryEdge,cherryFront]){material.bumpMap=woodTex;material.bumpScale=.00045;}
  const darkWood=mat('#8e5c3e');
  const white=mat(HOME_STYLE.cabinet);
  const fabric=mat(HOME_STYLE.linen);fabric.map=linenTex;fabric.bumpMap=linenTex;fabric.bumpScale=.0008;
  const sage=mat(HOME_STYLE.sage);sage.map=linenTex;
  const oatmeal=mat(HOME_STYLE.oatmeal);oatmeal.map=linenTex;
  const charcoal=mat('#303735',.55);
  const metal=mat('#9d9f96',.3,.65);
  const porcelain=mat('#fffdf5',.21);
  const glass=new THREE.MeshPhysicalMaterial({color:'#c2dbd5',roughness:.08,metalness:.05,transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false});
  const wallMat=mat(HOME_STYLE.wall,.93);
  const ceilingMat=mat(HOME_STYLE.ceiling,.94);
  const guestAccent=mat(HOME_STYLE.sage,.92);
  const capMat=mat('#b8ac99');
  const archWhite=mat(HOME_STYLE.trim),archMetal=metal.clone(),archGlass=glass.clone();
  const windowFrame=mat(HOME_STYLE.windowFrame,.57,.12);windowFrame.name='黑色窗框';
  const doorFrame=mat(HOME_STYLE.doorFrame,.48);doorFrame.name='白色细框玻璃门骨架';
  // Opaque frosting: no transparency or transmission, including at night.
  const doorGlass=mat(HOME_STYLE.doorGlass,.88);doorGlass.name='不透明乳白磨砂门玻璃';
  architecturalMaterials.push(guestAccent,wallMat,capMat,archWhite,archMetal,archGlass,windowFrame,doorFrame,doorGlass);
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
  function obstruction(x:number,z:number,w:number,d:number,name:string,relocate=true) {
    const [px,pz]=relocate?relocateFurniture(x,z):[x,z];
    colliders.push({minX:px-w/2,maxX:px+w/2,minZ:pz-d/2,maxZ:pz+d/2,name});
  }
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
    const fm=r.id==='bathroom'?new THREE.MeshStandardMaterial({map:tileTex,roughness:.83,color:'#d6d2c8'}):floorOak;
    const mesh=shapeMesh(r.polygon,.014,fm);mesh.userData.roomId=r.id;floorMeshes.push(mesh);
    const roof=shapeMesh(r.polygon,WALL_HEIGHT,ceilingMat,ceilings);(roof.material as THREE.Material).side=THREE.DoubleSide;
  }
  ceilings.visible=false;
  function wall(x1:number,z1:number,x2:number,z2:number,h=WALL_HEIGHT,base=0,name='wall') {
    const w=Math.abs(x2-x1)||.22,d=Math.abs(z2-z1)||.22;
    const mesh=box((x1+x2)/2,base+h/2,(z1+z2)/2,w,h,d,wallMat,architecture);
    mesh.name=name;
    walls.push({name,x1,z1,x2,z2,base,height:h,opaque:!wallMat.transparent,color:`#${wallMat.color.getHexString()}`});
    box((x1+x2)/2,base+h+.003,(z1+z2)/2,w,.015,d,capMat,architecture);
    if(base<.3) {
      obstruction((x1+x2)/2,(z1+z2)/2,w,d,name,false);
      box((x1+x2)/2,.055,(z1+z2)/2,w+.025,.11,d+.025,archWhite,architecture);
    }
    return mesh;
  }
  function windowWall(x1:number,z1:number,x2:number,z2:number,sill=.85,top=2.28,panes=2) {
    windows.push({x1,z1,x2,z2});
    const alongX=Math.abs(x2-x1)>.01,len=alongX?Math.abs(x2-x1):Math.abs(z2-z1);
    wall(x1,z1,x2,z2,sill);wall(x1,z1,x2,z2,WALL_HEIGHT-top,top);
    const x=(x1+x2)/2,z=(z1+z2)/2;
    box(x,(sill+top)/2,z,alongX?len:.035,top-sill,alongX?.035:len,archGlass,architecture);
    for(const y of [sill,top]) box(x,y,z,alongX?len:.12,.045,alongX?.12:len,windowFrame,architecture);
    for(let i=0;i<=panes;i++) box(x1+(x2-x1)*i/panes,(sill+top)/2,z1+(z2-z1)*i/panes,alongX?.045:.12,top-sill,alongX?.12:.045,windowFrame,architecture);
    box(x,sill-.025,z,alongX?len+.08:.34,.045,alongX?.34:len+.08,archWhite,architecture);
  }
  function doorGap(x1:number,z1:number,x2:number,z2:number,hingeAtEnd=false,swing=1) {
    const alongX=Math.abs(x2-x1)>.01,len=Math.hypot(x2-x1,z2-z1);
    wall(x1,z1,x2,z2,.55,2.15);
    for(const [x,z] of [[x1,z1],[x2,z2]]) box(x,1.075,z,alongX?.055:.25,2.15,alongX?.25:.055,doorFrame,architecture);
    box((x1+x2)/2,2.15,(z1+z2)/2,alongX?len+.07:.25,.055,alongX?.25:len+.07,doorFrame,architecture);
    const leaf=new THREE.Group();leaf.userData.calibrated=true;leaf.position.set(hingeAtEnd?x2:x1,0,hingeAtEnd?z2:z1);furniture.add(leaf);
    const sign=hingeAtEnd?-1:1;
    const width=len-.045,height=2.08,bottom=.015,border=.034,bar=.022,cx=sign*len/2;
    // One central vertical bar and three horizontal bars form exactly 2 × 4 panes.
    for(const dx of [-1,1]) box(cx+dx*(width-border)/2,bottom+height/2,0,border,height,.045,doorFrame,leaf,.003);
    for(const y of [bottom+border/2,bottom+height-border/2]) box(cx,y,0,width,border,.045,doorFrame,leaf,.003);
    box(cx,bottom+height/2,0,bar,height-border*2,.045,doorFrame,leaf,.002);
    const paneWidth=(width-border*2-bar)/2,paneHeight=(height-border*2-bar*3)/4;
    for(let row=0;row<4;row++) {
      const y=bottom+border+paneHeight/2+row*(paneHeight+bar);
      for(const side of [-1,1]) box(cx+side*(paneWidth+bar)/2,y,0,paneWidth,paneHeight,.018,doorGlass,leaf);
      if(row<3) box(cx,bottom+border+paneHeight+bar/2+row*(paneHeight+bar),0,width-border*2,bar,.045,doorFrame,leaf,.002);
    }
    box(sign*(len-.13),1.03,-.045,.13,.025,.045,metal,leaf,.008);
    leaf.rotation.y=(alongX?0:-Math.PI/2)+swing*Math.PI/2;
    // Doors stay open; their leaves are slim obstacles but the original opening is passable.
    const bounds=new THREE.Box3().setFromObject(leaf);
    colliders.push({minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,name:'open door'});
  }
  // Dimensions are taken from newStructure.jpg; partitions follow the accepted design.
  // Guest and master side walls have no windows, as confirmed by the user.
  wall(X.guestWest,0,2.685,0);windowWall(2.685,0,4.035,0);wall(4.035,0,X.bathroomWest,0);
  wall(X.guestWest,0,X.guestWest,Z.upperSouth);
  wall(X.bathroomWest,0,X.bathroomWest,Z.upperSouth);
  wall(X.guestWest,Z.upperSouth,4.13,Z.upperSouth);doorGap(4.13,Z.upperSouth,5.15,Z.upperSouth,true,-1);
  // One central bathroom; no old bathroom partitions are copied from the size image.
  windowWall(X.bathroomWest+.11,0,X.diningWest-.11,0,1.45,2.3);
  wall(X.diningWest,0,X.diningWest,Z.upperSouth);
  // Offset the concept doorway so its open leaf parks against the east wall.
  wall(X.bathroomWest,Z.upperSouth,6.15,Z.upperSouth);doorGap(6.15,Z.upperSouth,7.02,Z.upperSouth,true,-1);wall(7.02,Z.upperSouth,X.diningWest,Z.upperSouth);
  // Dining and its upper balcony share the confirmed 3.45 m clear depth.
  wall(X.diningWest,Z.upperBalconyNorth,X.diningWest,0);
  windowWall(X.diningWest,Z.upperBalconyNorth,X.livingEast,Z.upperBalconyNorth,.6,2.45,3);
  wall(X.livingEast,Z.upperBalconyNorth,X.livingEast,0);
  wall(X.livingEast,0,10.685,0);windowWall(10.685,0,11.785,0);wall(11.785,0,X.kitchenEast,0);
  wall(X.kitchenEast,0,X.kitchenEast,.975);windowWall(X.kitchenEast,.975,X.kitchenEast,2.10,1.2);wall(X.kitchenEast,2.10,X.kitchenEast,Z.kitchenSouth);
  // Both interior kitchen partitions are removed. The short southeast return
  // is part of the exterior outline, so it remains a complete exterior wall.
  wall(X.entranceEast,Z.kitchenSouth,X.kitchenEast,Z.kitchenSouth,WALL_HEIGHT,0,'kitchen-exterior-return');
  // Entrance and the existing stepped living-room contour.
  wall(X.entranceEast,Z.kitchenSouth,X.entranceEast,2.89);doorGap(X.entranceEast,2.89,X.entranceEast,3.91,false,1);wall(X.entranceEast,3.91,X.entranceEast,Z.entranceSouth);
  wall(X.livingEast,Z.entranceSouth,X.entranceEast,Z.entranceSouth);
  wall(X.livingEast,Z.entranceSouth,X.livingEast,Z.livingStep);
  wall(X.lowerAlcoveEast,Z.livingStep,X.livingEast,Z.livingStep);
  windowWall(X.lowerAlcoveEast,Z.livingStep,X.lowerAlcoveEast,Z.livingStep+.86,.85);
  wall(X.lowerAlcoveEast,Z.livingStep+.86,X.lowerAlcoveEast,Z.livingSouth);
  windowWall(X.studyEast,Z.livingSouth,X.lowerAlcoveEast,Z.livingSouth,.85,2.28,3);
  // Master retains the open entrance / dressing zone, without restoring its old bathroom.
  wall(X.masterWest,Z.upperSouth,2.9,Z.upperSouth);doorGap(2.9,Z.upperSouth,2.9,Z.upperSouth+1.02,false,1);
  wall(2.9,Z.upperSouth+1.02,2.9,Z.studyNorth);
  wall(X.masterWest,Z.upperSouth,X.masterWest,Z.masterSouth);
  wall(X.masterWest,Z.masterSouth,.65,Z.masterSouth);windowWall(.65,Z.masterSouth,2.3,Z.masterSouth);wall(2.3,Z.masterSouth,X.studyWest,Z.masterSouth);
  wall(X.studyWest,Z.studyNorth,X.studyWest,Z.masterSouth);
  // Study uses its original upper door; the TV backdrop is a complete solid wall.
  wall(X.studyWest,Z.studyNorth,5.15,Z.studyNorth);doorGap(5.15,Z.studyNorth,6.22,Z.studyNorth,true,1);
  wall(X.studyWest,Z.studySouth,4.55,Z.studySouth);windowWall(4.55,Z.studySouth,X.studyEast,Z.studySouth,.84,2.25);
  const sharedWall=LAYOUT.studyLivingWall;
  wall(X.studyEast,Z.studyNorth,X.studyEast,sharedWall.infillFrom,WALL_HEIGHT,0,'bearing-wall-upper');
  wall(X.studyEast,sharedWall.infillTo,X.studyEast,Z.livingSouth,WALL_HEIGHT,0,'bearing-wall-lower');
  wall(X.studyEast,sharedWall.infillFrom,X.studyEast,sharedWall.infillTo,WALL_HEIGHT,0,'solid-tv-backdrop');
  // Soft contact shadows supplement real-time directional shadows.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d')!,sg=sc.createRadialGradient(64,64,8,64,64,64);sg.addColorStop(0,'rgba(50,40,28,.26)');sg.addColorStop(.5,'rgba(50,40,28,.13)');sg.addColorStop(1,'rgba(50,40,28,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
  const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
  function contact(x:number,z:number,w:number,d:number) {const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),shadowMat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.028,z);furniture.add(mesh);return mesh;}
  function rug(x:number,z:number,w:number,d:number,color='#d6ccb9') {
    const m=mat(color);m.map=linenTex;m.bumpMap=linenTex;m.bumpScale=.02;
    box(x,.036,z,w,.025,d,m,furniture,.012);
    for(let k=0;k<2;k++) {box(x,.05,z+(d/2-.08)*(k?1:-1),w-.12,.004,.012,oatmeal);}
  }
  const plantPot=mat('#eeece4',.94),plantSoil=mat('#46372b'),plantBark=mat('#786046');
  const plantStem=mat('#45603a');
  const leafMats=['#315d37','#547949','#77915b'].map(color=>{
    const m=mat(color,.53);m.side=THREE.DoubleSide;return m;
  });
  function plant(x:number,z:number,size=.65,base=0,kind:'bengal'|'coffee'|'pothos'='pothos') {
    // Keep each complete plant together when the room coordinates are calibrated.
    const group=new THREE.Group();group.position.set(x,0,z);group.name=`plant-${kind}`;furniture.add(group);
    const potHeight=size*.30,potRadius=size*.17;
    cylinder(0,base+potHeight/2,0,potRadius,potHeight,plantPot,group,potRadius*.78);
    cylinder(0,base+potHeight+.003,0,potRadius*.88,.008,plantSoil,group);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(potRadius*.96,size*.009,8,32),plantPot);
    rim.rotation.x=Math.PI/2;rim.position.y=base+potHeight;rim.castShadow=true;group.add(rim);
    function stem(start:THREE.Vector3,end:THREE.Vector3,radius:number,material=plantStem) {
      const middle=start.clone().lerp(end,.5);middle.y+=size*.035;
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start,middle,end]),7,radius,5,false),material);
      mesh.castShadow=true;group.add(mesh);
    }
    function leaf(start:THREE.Vector3,end:THREE.Vector3,width:number,material:THREE.Material) {
      // A thin, curved surface with pointed ends and a raised midrib reads as a
      // real broad leaf from both sides, instead of a thick upright ellipsoid.
      const direction=end.clone().sub(start),length=direction.length();
      const side=new THREE.Vector3(direction.z,0,-direction.x).normalize();
      if(side.lengthSq()<.01)side.set(1,0,0);
      const normal=direction.clone().cross(side).normalize();
      const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
      const centerAt=(t:number)=>start.clone().addScaledVector(direction,t).add(new THREE.Vector3(0,Math.sin(t*Math.PI)*length*.13,0));
      for(let row=0;row<=10;row++) {
        const t=row/10,outline=Math.pow(Math.sin(t*Math.PI),.72);
        for(let column=0;column<=4;column++) {
          const across=column/2-1;
          const point=centerAt(t).addScaledVector(side,across*width*outline)
            .addScaledVector(normal,(1-Math.abs(across))*outline*length*.055);
          vertices.push(point.x,point.y,point.z);uv.push(column/4,t);
          if(row<10&&column<4) {
            const i=row*5+column;indices.push(i,i+5,i+1,i+1,i+5,i+6);
          }
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      const veinCurve=new THREE.CatmullRomCurve3([start,centerAt(.5).addScaledVector(normal,length*.055+size*.001),end]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(veinCurve,10,size*.0018,4,false),plantStem));
    }
    if(kind==='bengal') {
      // Ficus benghalensis: slender branching trunk and spaced oval leaves.
      stem(new THREE.Vector3(0,base+potHeight*.8,0),new THREE.Vector3(size*.025,base+size*.87,0),size*.012,plantBark);
      for(let branch=0;branch<3;branch++) {
        const angle=branch*2.1+.35;
        const start=new THREE.Vector3(size*.02,base+size*(.62+branch*.09),0);
        const tip=new THREE.Vector3(Math.sin(angle)*size*.26,base+size*(.91+branch*.13),Math.cos(angle)*size*.26);
        stem(start,tip,size*.007,plantBark);
        for(let i=0;i<4;i++) {
          const joint=start.clone().lerp(tip,.43+i*.18);
          const direction=angle+(i%2?1:-1)*1.05;
          const leafTip=joint.clone().add(new THREE.Vector3(Math.sin(direction)*size*.25,size*(.05-i*.008),Math.cos(direction)*size*.25));
          leaf(joint,leafTip,size*.075,leafMats[(branch+i)%3]);
        }
      }
      leaf(new THREE.Vector3(size*.025,base+size*.87,0),new THREE.Vector3(size*.08,base+size*1.25,size*.02),size*.065,leafMats[1]);
    } else if(kind==='coffee') {
      // Coffea arabica has opposite pairs of glossy pointed leaves.
      stem(new THREE.Vector3(0,base+potHeight,0),new THREE.Vector3(0,base+size*1.05,0),size*.009,plantBark);
      for(let row=0;row<4;row++)for(const sign of [-1,1]) {
        const angle=row*.82,spread=size*(.35-row*.045);
        const joint=new THREE.Vector3(0,base+size*(.45+row*.15),0);
        const tip=new THREE.Vector3(Math.sin(angle)*spread*sign,joint.y+size*.12,Math.cos(angle)*spread*sign);
        leaf(joint,tip,size*.065,leafMats[row%3]);
      }
    } else {
      // A single trailing pothos is confined to the bright dining-window shelf.
      for(let i=0;i<8;i++) {
        const angle=i*2.4,start=new THREE.Vector3(0,base+potHeight,0);
        const joint=new THREE.Vector3(Math.sin(angle)*size*.18,base+size*.4,Math.cos(angle)*size*.18);
        const tip=new THREE.Vector3(Math.sin(angle)*size*.4,base+size*(i<3?.08:.59),Math.cos(angle)*size*.4);
        stem(start,joint,size*.004);leaf(joint,tip,size*.11,leafMats[i%3]);
      }
    }
    return group;
  }
  function table(x:number,z:number,w:number,d:number,h=.74,surface:THREE.Material=cherry) {
    contact(x,z,w+.4,d+.4);box(x,h,z,w,.07,d,surface,furniture,.045);
    const legs=surface===wood?oak:cherryEdge;
    for(const dx of [-1,1])for(const dz of [-1,1]) {const leg=box(x+dx*(w/2-.09),h/2,z+dz*(d/2-.09),.055,h-.04,.055,legs);leg.rotation.z=-dx*.045;}
    obstruction(x,z,w-.08,d-.08,'table');
  }
  function chair(x:number,z:number,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;furniture.add(g);
    box(0,.45,0,.43,.09,.44,fabric,g,.045);box(0,.71,.19,.43,.45,.065,cherry,g,.04);
    for(const dx of [-.16,.16])for(const dz of [-.15,.15]) box(dx,.22,dz,.036,.44,.036,cherryEdge,g);
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
    box(0,.23,0,w+.12,.27,2.14,cherryEdge,g,.065);
    box(0,.46,0,w,.27,2.0,fabric,g,.10);
    box(0,.64,-1.04,w+.16,1.1,.09,cherry,g,.055);
    box(0,.60,.25,w+.01,.13,1.43,fabric,g,.065);
    box(0,.68,.68,w+.025,.055,.50,oatmeal,g,.025);
    for(const dx of [-w*.25,w*.25]) {const p=box(dx,.67,-.68,w*.43,.17,.45,white,g,.09);p.rotation.y=dx*.10;}
    for(let i=0;i<9;i++) box(-w/2+.12+i*(w-.24)/8,.63,.25,.006,.007,1.30,white,g);
    obstruction(x,z,w+.12,2.14,'bed');contact(x,z,w+.7,2.6);
  }
  function sideTable(x:number,z:number) {cylinder(x,.45,z,.25,.065,cherry);cylinder(x,.23,z,.065,.43,cherryEdge);contact(x,z,.6,.6);}
  function lamp(x:number,z:number,y=.52,scale=1) {
    cylinder(x,y,z,.11*scale,.03,metal);cylinder(x,y+.17*scale,z,.017,.32*scale,metal);
    const m=mat('#f8f0e4',.7);m.emissive=new THREE.Color('#ffdfb7');m.emissiveIntensity=.12;luminous.push(m);
    cylinder(x,y+.36*scale,z,.13*scale,.18*scale,m,furniture,.20*scale);
    const light=new THREE.PointLight(HOME_STYLE.lamplight,0,2.5,2);const [lx,lz]=relocateFurniture(x,z);light.position.set(lx,y+.35*scale,lz);root.add(light);lamps.push({light,nightIntensity:1.05});
  }
  function book(x:number,y:number,z:number,w=.22,color='#7c8c72') {box(x,y,z,w,.035,.17,mat(color),furniture,.006);box(x,y+.008,z+.002,w-.015,.018,.173,white);}
  // Revised living arrangement: a 65-inch screen and low oak console face the sofa.
  // The centered television now sits against a complete warm-white wall.
  rug(8.15,7.28,1.45,2.25,'#d9d0bf');
  const sofa=new THREE.Group();sofa.position.set(9.15,0,7.28);sofa.rotation.y=Math.PI/2;furniture.add(sofa);
  box(0,.24,0,2.05,.22,.87,cherryEdge,sofa,.06);
  box(0,.47,0,1.86,.27,.77,fabric,sofa,.12);
  box(0,.78,.32,2.05,.65,.22,fabric,sofa,.1);
  for(const dx of [-.95,.95])box(dx,.58,0,.19,.5,.88,fabric,sofa,.08);
  for(const dx of [-.48,.48])box(dx,.64,-.07,.89,.13,.62,fabric,sofa,.06);
  for(const [dx,material] of [[-.64,sage],[.58,oatmeal]] as const) {const p=box(dx,.91,.12,.4,.4,.16,material,sofa,.1);p.rotation.z=dx*.24;p.rotation.x=-.18;}
  obstruction(9.15,7.28,.92,2.05,'sofa');contact(9.15,7.28,1.4,2.6);
  const tv=new THREE.Group();tv.position.set(6.72,0,7.28);tv.rotation.y=Math.PI/2;furniture.add(tv);
  const consoleWood=cherry;
  const consoleFront=cherryFront;
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
  // Two short feet support the display on the timber console.
  for(const x of [-.51,.51]) {
    box(x,.49,.015,.13,.025,.24,charcoal,tv,.008);
    box(x,.53,-.015,.028,.08,.035,charcoal,tv,.006);
  }
  box(0,.976,-.015,1.475,.85,.045,charcoal,tv,.018);
  const screen=mat('#273c38',.23);screen.emissive=new THREE.Color('#29423d');screen.emissiveIntensity=.25;
  box(0,.978,.012,1.439,.809,.007,screen,tv,.006);
  box(0,.563,.013,.028,.004,.006,metal,tv,.001);
  obstruction(6.72,7.28,.42,1.80,'TV console');contact(6.72,7.28,.76,2.12);
  // Left when seated on the sofa facing the screen: the south end of the TV.
  const tvPlantX=X.studyEast+.69,tvPlantZ=Z.livingStep+.35;
  const tvPlant=plant(tvPlantX,tvPlantZ,1.35,0,'bengal');tvPlant.userData.calibrated=true;
  obstruction(tvPlantX,tvPlantZ,.46,.46,'TV-side plant pot',false);
  contact(tvPlantX,tvPlantZ,.70,.70).userData.calibrated=true;
  sideTable(8.20,8.23);book(8.20,.505,8.23);
  cylinder(7.68,.28,10.02,.30,.46,fabric);contact(7.68,10.02,.8,.8);obstruction(7.68,10.02,.6,.6,'stool');
  lamp(8.10,9.85,.08,2.4);
  // Gaming room: measured coordinates, desk against the shared MASTER wall.
  const gaming=fixedGroup('gaming-room');
  const {desk,chair:seat,pegboard:peg,display:dc,cables}=LAYOUT.gamingRoom;
  box(desk.x,desk.height,desk.z,desk.depth,.055,desk.length,wood,gaming,.018);
  for(const x of [desk.x-.28,desk.x+.28])for(const z of [desk.z-.79,desk.z+.79])
    box(x,.375,z,.045,.72,.045,oak,gaming,.006);
  obstruction(desk.x,desk.z,desk.depth,desk.length,'gaming desk',false);
  // One ultrawide monitor faces east, towards the chair; desk-mounted arm avoids
  // transmitting hardware vibration through the master bedroom wall.
  box(3.63,.99,7.10,.045,.43,.045,charcoal,gaming);
  box(3.73,1.14,7.10,.24,.035,.035,charcoal,gaming);
  box(3.82,1.22,7.10,.045,.43,.88,charcoal,gaming,.014);
  box(3.846,1.22,7.10,.006,.396,.845,screen,gaming,.004);
  box(4.045,.783,7.10,.32,.008,.97,mat('#b5b8a8'),gaming,.012);
  box(4.08,.80,7.17,.145,.022,.44,charcoal,gaming,.006);
  sphere(4.09,.808,6.83,.046,.018,.03,charcoal,gaming);
  // Tower stands on the tabletop at its north end, all vents remain open.
  box(3.91,1.005,6.33,.40,.45,.22,white,gaming,.012);
  box(4.116,1.005,6.33,.008,.40,.18,glass,gaming);
  for(const y of [.91,1.08]) {
    const fan=cylinder(4.125,y,6.33,.067,.006,charcoal,gaming);fan.rotation.z=Math.PI/2;
  }
  // Upholstered ergonomic chair faces negative X. Five-point base and armrests.
  cylinder(seat.x,.25,seat.z,.035,.40,metal,gaming);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5,leg=box(seat.x+Math.sin(a)*.14,.10,seat.z+Math.cos(a)*.14,.035,.025,.31,charcoal,gaming);
    leg.rotation.y=a;
    sphere(seat.x+Math.sin(a)*.29,.065,seat.z+Math.cos(a)*.29,.04,.04,.04,charcoal,gaming);
  }
  box(seat.x,.47,seat.z,.49,.10,.51,fabric,gaming,.06);
  box(seat.x+.23,.85,seat.z,.09,.72,.48,sage,gaming,.04);
  for(const z of [seat.z-.30,seat.z+.30]) {
    box(seat.x,.64,z,.29,.045,.06,charcoal,gaming,.015);
    box(seat.x+.12,.55,z,.025,.18,.025,metal,gaming);
  }
  obstruction(seat.x,seat.z,seat.depth,seat.width,'gaming chair',false);
  // Perforated wall board: holes, hooks, controller shelf, and headphones.
  box(peg.x,peg.centerY,peg.z,.035,peg.height,peg.length,wood,gaming,.012);
  const holeMat=mat('#796e5d');
  for(let row=0;row<7;row++)for(let col=0;col<22;col++) {
    const hole=cylinder(peg.x+.019,peg.centerY-.24+row*.08,peg.z-.84+col*.08,.009,.002,holeMat,gaming);
    hole.rotation.z=Math.PI/2;
  }
  box(3.61,1.65,6.45,.22,.025,.45,oak,gaming,.008);
  for(const z of [6.33,6.57]) {
    sphere(3.63,1.72,z,.055,.04,.09,charcoal,gaming);
    box(3.69,1.72,z,.015,.018,.065,metal,gaming,.006);
  }
  const headphoneBand=new THREE.Mesh(new THREE.TorusGeometry(.10,.012,8,24,Math.PI),charcoal);
  headphoneBand.rotation.y=Math.PI/2;headphoneBand.position.set(3.60,1.85,7.55);gaming.add(headphoneBand);
  for(const z of [7.45,7.65])box(3.60,1.80,z,.055,.10,.045,charcoal,gaming,.018);
  box(3.56,1.96,7.55,.10,.015,.018,metal,gaming);
  // Separate accessible trays and grommets; one contained drop, no floor crossing.
  for(const [x,m] of [[cables.powerTrayX,charcoal],[cables.signalTrayX,metal]] as const) {
    box(x,cables.trayY,7.0,.11,.035,1.60,m,gaming,.005);
    box(x,.69,6.20,.025,.10,.025,m,gaming);
    cylinder(x,.783,6.20,.026,.007,charcoal,gaming);
  }
  box(3.62,.67,6.60,.07,.028,.35,white,gaming,.004);
  for(const z of [6.49,6.60,6.71])box(3.62,.686,z,.034,.002,.045,charcoal,gaming);
  box(3.50,.54,cables.dropZ,.025,.22,.055,white,gaming,.005);
  for(const z of [6.14,6.24])box(3.49,cables.outletY,z,.025,.08,.08,white,gaming,.004);
  box(3.54,.65,6.18,.09,.025,.035,charcoal,gaming,.004);
  // A small task lamp and soft bias strip keep the gaming setup warm at night.
  const gamingGlow=mat('#f5ead7');gamingGlow.emissive=new THREE.Color(HOME_STYLE.lamplight);gamingGlow.emissiveIntensity=.13;luminous.push(gamingGlow);
  cylinder(3.91,.79,7.68,.08,.02,oak,gaming);
  cylinder(3.91,.93,7.68,.012,.26,metal,gaming);
  cylinder(3.91,1.09,7.68,.07,.13,gamingGlow,gaming,.12);
  box(3.53,1.495,7.0,.035,.012,1.55,gamingGlow,gaming);
  const gamingLight=new THREE.PointLight(HOME_STYLE.lamplight,0,2.6,2);
  gamingLight.position.set(3.95,1.13,7.68);root.add(gamingLight);lamps.push({light:gamingLight,nightIntensity:.8});
  // Sliding glass cabinet against the north wall, clear of the doorway/swing.
  box(dc.x,.13,dc.z,dc.width,.12,dc.depth,oak,gaming,.01);
  box(dc.x,dc.height-.025,dc.z,dc.width,.05,dc.depth,wood,gaming,.006);
  box(dc.x,dc.height/2,dc.z-dc.depth/2+.012,dc.width,dc.height-.12,.024,wood,gaming);
  for(const x of [dc.x-dc.width/2+.018,dc.x+dc.width/2-.018])
    box(x,dc.height/2,dc.z,.036,dc.height-.12,dc.depth,oak,gaming);
  const displayGlow=mat('#f7e4c2');displayGlow.emissive=new THREE.Color('#ffe2ae');displayGlow.emissiveIntensity=.35;luminous.push(displayGlow);
  for(const y of [.49,.91,1.33,1.75]) {
    box(dc.x,y,dc.z,dc.width-.07,.018,dc.depth-.04,glass,gaming);
    box(dc.x,y+.025,dc.z-.14,dc.width-.12,.012,.015,displayGlow,gaming);
  }
  for(const [i,x] of [dc.x-.245,dc.x+.245].entries()) {
    box(x,1.01,dc.z+.19+i*.012,.50,1.57,.012,glass,gaming);
    box(x+(i?-.18:.18),1.0,dc.z+.209+i*.012,.014,.14,.022,metal,gaming,.004);
  }
  // Small original toy animals, kept inside the shelves instead of loose in the aisle.
  for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
    const x=dc.x-.31+col*.31,y=.51+row*.42,z=dc.z+.015;
    const toyMat=[oatmeal,sage,porcelain][(row+col)%3];
    sphere(x,y+.09,z,.065,.09,.055,toyMat,gaming);
    sphere(x,y+.20,z,.07,.065,.058,toyMat,gaming);
    for(const dx of [-.047,.047])sphere(x+dx,y+.26,z,.025,.035,.024,toyMat,gaming);
    for(const dx of [-.023,.023])sphere(x+dx,y+.21,z+.053,.007,.008,.005,charcoal,gaming);
  }
  obstruction(dc.x,dc.z,dc.width,dc.depth,'gaming glass display',false);
  // Window-side green is kept away from electronics and the chair path.
  const gamingPlant=plant(5.84,8.25,.72,0,'coffee');gamingPlant.userData.calibrated=true;
  obstruction(5.84,8.25,.28,.28,'gaming window plant',false);
  // Master bed follows the concept plan, with headboard at the lower end.
  rug(1.57,9.13,2.65,2.80,'#d9cfbd');bed(1.55,9.10,1.80,Math.PI);
  sideTable(.32,9.88);lamp(.32,9.88);sideTable(2.72,9.88);
  wardrobe(1.22,6.55,1.75,.6,2.38);wardrobe(.25,5.3,1.32,.48,2.38,Math.PI/2);
  const mirror=new THREE.Mesh(new THREE.CircleGeometry(.35,48),mat('#b8c4be',.15,.7));mirror.position.set(1.85,1.5,4.44);furniture.add(mirror);
  box(1.85,.75,4.64,.7,.05,.28,wood,furniture,.025);
  // Measured secondary bedroom: reference-photo arrangement, one permanent occupant.
  function fixedGroup(name:string) {
    const g=new THREE.Group();g.name=name;g.userData.calibrated=true;furniture.add(g);return g;
  }
  const guest=fixedGroup('secondary-bedroom-study');
  const gb=LAYOUT.guestRoom.bed,gd=LAYOUT.guestRoom.desk,gc=LAYOUT.guestRoom.chair,gw=LAYOUT.guestRoom.wardrobe;
  box(X.guestWest+.118,1.35,1.65,.015,2.69,3.05,guestAccent,guest);
  // Drawer base with recessed plinth and three individually inset fronts facing the aisle.
  box(gb.x,.08,gb.z,gb.width-.10,.14,gb.length-.10,charcoal,guest,.005);
  box(gb.x,.29,gb.z,gb.width,.36,gb.length,cherry,guest,.012);
  for(let i=0;i<3;i++) {
    const z=gb.z-gb.length/2+(i+.5)*gb.length/3;
    box(gb.x+gb.width/2+.004,.29,z,.018,.30,gb.length/3-.015,cherryFront,guest,.005);
    box(gb.x+gb.width/2+.016,.38,z,.006,.018,.17,charcoal,guest,.003);
  }
  box(gb.x,.565,gb.z,gb.width-.025,.20,gb.mattressLength,fabric,guest,.065);
  box(gb.x,.685,gb.z+.10,gb.width-.035,.055,1.67,sage,guest,.025);
  box(gb.x,.65,gb.z-gb.length/2+.035,gb.width,.62,.05,cherry,guest,.012);
  for(const [i,z] of [.76,1.18].entries())box(2.31,.85,z,.19,.44,.39,i?sage:oatmeal,guest,.045);
  box(2.85,.775,.77,.43,.17,.40,fabric,guest,.055);
  box(gb.x,.735,2.19,gb.width-.06,.04,.39,oatmeal,guest,.016);
  obstruction(gb.x,gb.z,gb.width,gb.length,'guest drawer bed',false);
  // Long desk faces the east wall. Drawer unit at its foot leaves a full knee bay.
  box(gd.x,gd.height,gd.z,gd.depth,.045,gd.length,cherry,guest,.012);
  for(const z of [.54,2.71])box(gd.x+.23,.37,z,.045,.72,.045,oak,guest,.006);
  box(gd.x,.36,2.47,.56,.69,.48,cherryFront,guest,.008);
  for(const y of [.20,.43,.64])box(gd.x-.286,y,2.47,.012,.015,.32,charcoal,guest,.003);
  box(gd.x,.65,gd.z,.35,.035,1.40,charcoal,guest,.004);
  box(5.10,.50,1.20,.024,.45,.055,white,guest,.004);
  box(4.82,.795,1.15,.20,.025,.32,metal,guest,.006);
  box(4.91,1.02,1.15,.025,.43,.67,charcoal,guest,.012);
  box(4.893,1.03,1.15,.006,.37,.61,mat('#688178',.7),guest,.002);
  box(4.61,.789,1.15,.13,.012,.40,white,guest,.004);
  box(4.62,.79,1.47,.10,.02,.07,charcoal,guest,.012);
  // One fabric chair, tucked sufficiently to preserve a narrow passage behind its back.
  box(gc.x,.46,gc.z,.52,.09,.54,oatmeal,guest,.045);
  box(gc.x-.23,.73,gc.z,.055,.50,.53,fabric,guest,.035);
  cylinder(gc.x,.24,gc.z,.027,.40,metal,guest);
  for(const angle of [0,Math.PI/2]) {
    const foot=box(gc.x,.08,gc.z,.51,.028,.035,metal,guest,.006);foot.rotation.y=angle;
  }
  obstruction(gd.x,gd.z,gd.depth,gd.length,'guest long desk',false);
  obstruction(gc.x,gc.z,gc.width,gc.depth,'guest desk chair',false);
  box(gw.x,gw.height/2,gw.z,gw.width,gw.height,gw.depth,cherry,guest,.008);
  for(let i=0;i<3;i++) {
    const x=gw.x-gw.width/2+(i+.5)*gw.width/3;
    box(x,1.20,gw.z-gw.depth/2-.009,gw.width/3-.009,2.27,.018,cherryFront,guest,.004);
    box(x+.18,1.15,gw.z-gw.depth/2-.025,.015,.25,.018,metal,guest,.004);
  }
  obstruction(gw.x,gw.z,gw.width,gw.depth,'guest wardrobe',false);
  // Shallow shelves on both solid side walls; book spines vary without covering every inch.
  const shelfSpec=LAYOUT.guestRoom.shelves;
  const bookMats=['#677259','#beae8d','#756653','#d8cbb3'].map(c=>mat(c,.84));
  for(const x of [shelfSpec.westX,shelfSpec.eastX])for(const y of shelfSpec.heights) {
    box(x,y,1.60,shelfSpec.depth,.035,2.10,cherry,guest,.005);
    for(let i=0;i<12;i++) {
      const z=.69+i*.105,h=.17+(i%4)*.025;
      box(x,y+.025+h/2,z,.14,h,.052,bookMats[i%4],guest,.002);
    }
    for(const z of [.72,2.48])box(x+(x<3?-.07:.07),y-.075,z,.035,.15,.028,metal,guest,.003);
  }
  box(5.135,1.35,1.92,.025,.50,.72,oatmeal,guest,.008);
  for(let i=0;i<4;i++)box(5.117,1.27+(i%2)*.17,1.69+Math.floor(i/2)*.31,.009,.12,.19,bookMats[i],guest);
  // Actual curtain fabric strips are gathered outside the retained north opening.
  for(const x of [2.55,4.18])for(let i=0;i<5;i++)box(x+i*.017,1.36,.18,.026,2.33,.05,sage,guest,.012);
  box(3.36,2.56,.16,1.94,.018,.025,metal,guest,.005);
  const guestGlow=mat('#f4ecd7');guestGlow.emissive=new THREE.Color(HOME_STYLE.lamplight);guestGlow.emissiveIntensity=.13;luminous.push(guestGlow);
  box(2.13,1.36,1.04,.04,.09,.13,metal,guest,.008);box(2.24,1.34,1.04,.20,.045,.14,guestGlow,guest,.014);
  cylinder(4.86,.79,2.15,.065,.018,metal,guest);cylinder(4.86,.97,2.15,.009,.35,metal,guest);
  box(4.72,1.16,2.15,.30,.025,.11,guestGlow,guest,.009);
  const guestTaskLight=new THREE.PointLight(HOME_STYLE.lamplight,0,2.1,2);guestTaskLight.position.set(4.65,1.20,2.15);root.add(guestTaskLight);lamps.push({light:guestTaskLight,nightIntensity:.65});
  // New integrated assemblies use measured coordinates and true-size appliances.
  const dining=fixedGroup('integrated-dining');
  const tableX=8.08,tableZ=1.60;
  box(tableX,.75,tableZ,.70,.055,1.20,wood,dining,.025);
  for(const dx of [-.25,.25])for(const dz of [-.49,.49])box(tableX+dx,.375,tableZ+dz,.045,.72,.045,oak,dining,.007);
  box(7.43,.46,tableZ,.36,.075,1.20,wood,dining,.025);
  for(const z of [1.13,2.07])box(7.43,.23,z,.26,.44,.045,oak,dining,.005);
  obstruction(tableX,tableZ,.70,1.20,'dining table',false);
  obstruction(7.43,tableZ,.36,1.20,'dining bench',false);
  for(const {x,z} of LAYOUT.dining.chairs) {
    box(x,.45,z,.43,.075,.44,fabric,dining,.035);
    box(x,.70,z+(z<tableZ?-.18:.18),.43,.44,.055,wood,dining,.025);
    for(const dx of [-.15,.15])for(const dz of [-.15,.15])box(x+dx,.22,z+dz,.035,.44,.035,oak,dining);
    obstruction(x,z,.43,.44,'dining chair',false);
  }
  const teaGlaze=mat('#eee8de',.31),tea=mat('#8a6749',.4);
  box(tableX,.785,tableZ,.29,.014,.36,oak,dining,.02);
  for(const z of [1.51,1.71]) {
    cylinder(8.07,.82,z,.045,.055,teaGlaze,dining,.038);
    cylinder(8.07,.85,z,.037,.003,tea,dining);
  }
  cylinder(tableX,2.51,tableZ,.012,.38,charcoal,dining);
  const pendantMat=mat('#f7f3eb');pendantMat.emissive=new THREE.Color('#fff1dc');pendantMat.emissiveIntensity=.12;luminous.push(pendantMat);
  const shade=new THREE.Mesh(new THREE.SphereGeometry(.25,32,16,0,Math.PI*2,0,Math.PI/2),pendantMat);shade.position.set(tableX,2.28,tableZ);dining.add(shade);

  const counter=mat('#ede9df',.51),steel=mat('#929a97',.28,.75);
  function cabinetActual(parent:THREE.Group,x:number,z:number,w:number,d:number,name:string,rot=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);
    box(0,.45,0,w,.78,d,white,g,.006);box(0,.875,0,w,.05,d,counter,g,.005);
    box(0,.055,0,w-.08,.11,d-.08,charcoal,g);
    const count=Math.max(1,Math.round(w/.60));
    for(let i=0;i<count;i++) {
      const px=-w/2+(i+.5)*w/count;
      box(px,.465,d/2+.009,w/count-.006,.75,.018,white,g,.003);
      box(px,.81,d/2+.021,w/count-.08,.012,.015,oak,g);
    }
    obstruction(x,z,rot?d:w,rot?w:d,name,false);return g;
  }
  const kitchen=fixedGroup('integrated-open-kitchen');
  const northCounter=LAYOUT.kitchen.northCounter;
  cabinetActual(kitchen,northCounter.x,northCounter.z,northCounter.width,northCounter.depth,'north kitchen cabinets');
  cabinetActual(kitchen,12.28,2.075,.85,.60,'east kitchen prep cabinets',-Math.PI/2);
  // Hob and hood fit the solid north-wall segment, clear of both original windows.
  const hobX=LAYOUT.kitchen.hob.x;
  box(hobX,.91,.44,.58,.025,.48,charcoal,kitchen,.012);
  for(const x of [hobX-.16,hobX+.16]) {
    cylinder(x,.932,.44,.105,.010,steel,kitchen);cylinder(x,.941,.44,.080,.012,charcoal,kitchen);
  }
  cylinder(hobX+.16,1.025,.44,.105,.16,steel,kitchen);cylinder(hobX+.16,1.112,.44,.112,.012,metal,kitchen);
  box(hobX,1.92,.35,.60,.13,.45,steel,kitchen,.012);box(hobX,2.28,.24,.24,.61,.22,white,kitchen,.006);
  const worklight=mat('#fff9eb',.45);worklight.emissive=new THREE.Color(HOME_STYLE.lamplight);worklight.emissiveIntensity=.13;luminous.push(worklight);
  box(hobX,1.846,.43,.47,.008,.22,worklight,kitchen);
  box(11.45,.906,.44,.60,.02,.43,steel,kitchen,.035);box(11.45,.916,.44,.49,.022,.32,charcoal,kitchen,.025);
  cylinder(11.45,1.04,.23,.017,.27,metal,kitchen);box(11.45,1.173,.29,.025,.025,.15,metal,kitchen,.01);
  // The refrigerator is against the northeast perimeter, with its doors facing south.
  box(12.18,.985,.46,.70,1.93,.64,white,kitchen,.018);
  box(12.18,1.35,.792,.674,1.12,.026,white,kitchen,.010);box(12.18,.38,.792,.674,.72,.026,white,kitchen,.010);
  box(11.89,1.18,.82,.020,.32,.022,metal,kitchen,.006);box(11.89,.59,.82,.020,.18,.022,metal,kitchen,.006);
  box(11.805,1.335,.49,.025,2.63,.70,white,kitchen,.004);box(12.555,1.335,.49,.025,2.63,.70,white,kitchen,.004);
  box(12.18,2.26,.49,.725,.48,.70,white,kitchen,.005);
  obstruction(12.18,.49,.70,.70,'refrigerator',false);
  const taskLight=new THREE.PointLight(HOME_STYLE.lamplight,0,2.1,2);taskLight.position.set(10.8,1.7,.8);root.add(taskLight);lamps.push({light:taskLight,nightIntensity:.8});

  // Original laundry niche: 1500 × 480 mm sideboard with a real working surface.
  const coffee=fixedGroup('coffee-sideboard');
  box(7.50,.45,-.10,.48,.84,1.50,oak,coffee,.007);box(7.50,.895,-.10,.50,.05,1.50,counter,coffee,.006);
  box(7.50,.055,-.10,.39,.10,1.42,charcoal,coffee);
  for(const z of [-.60,-.10,.40]) {
    box(7.75,.47,z,.018,.76,.49,wood,coffee,.004);box(7.768,.80,z,.012,.012,.37,oak,coffee);
  }
  box(7.40,1.76,-.48,.30,.66,.73,white,coffee,.006);box(7.555,1.76,-.48,.018,.63,.70,white,coffee,.004);
  box(7.41,1.59,.28,.32,.035,.65,oak,coffee,.004);box(7.41,1.98,.28,.32,.035,.65,oak,coffee,.004);
  // Espresso machine and grinder face east into the free preparation aisle.
  box(7.52,1.095,.08,.31,.35,.29,steel,coffee,.018);box(7.687,1.10,.08,.025,.23,.24,charcoal,coffee,.008);
  box(7.72,.94,.08,.12,.03,.29,steel,coffee,.006);box(7.725,1.17,.08,.12,.017,.035,charcoal,coffee,.005);
  cylinder(7.54,1.028,.41,.072,.21,charcoal,coffee);cylinder(7.54,1.19,.41,.07,.12,mat('#857869',.3),coffee,.055);
  obstruction(7.50,-.10,.50,1.50,'coffee sideboard',false);
  const coffeeTree=plant(7.50,-.58,.27,.92,'coffee');coffeeTree.userData.calibrated=true;
  const trailingPlant=plant(7.41,.28,.23,1.61,'pothos');trailingPlant.userData.calibrated=true;

  // Bathroom: shower → WC → washer → basin, all service fronts facing east.
  const bathroom=fixedGroup('bathroom-laundry');
  const bathTile=mat('#d3d0c6',.62);box(6.19,.05,.62,1.58,.07,.98,bathTile,bathroom,.008);
  const shower=box(5.80,1.10,1.15,.80,2.10,.025,glass,bathroom);shower.castShadow=false;
  box(5.80,2.155,1.15,.83,.025,.03,metal,bathroom);box(6.17,1.90,.17,.035,.95,.035,metal,bathroom);
  cylinder(6.17,2.35,.37,.14,.025,metal,bathroom);box(6.17,2.30,.27,.025,.10,.30,metal,bathroom);
  obstruction(5.80,1.15,.80,.03,'shower glass',false);
  box(5.49,.55,1.57,.20,.72,.39,porcelain,bathroom,.05);sphere(5.76,.38,1.57,.31,.19,.24,porcelain,bathroom);sphere(5.81,.48,1.57,.27,.035,.21,white,bathroom);
  obstruction(5.75,1.57,.70,.50,'toilet',false);
  const washer=new THREE.Group();washer.position.set(5.71,0,2.32);washer.rotation.y=Math.PI/2;bathroom.add(washer);
  box(0,.445,0,.60,.85,.64,white,washer,.014);
  const drum=cylinder(0,.44,.331,.205,.025,metal,washer);drum.rotation.x=Math.PI/2;
  const drumGlass=cylinder(0,.44,.349,.158,.025,charcoal,washer);drumGlass.rotation.x=Math.PI/2;
  box(0,.775,.329,.54,.085,.018,white,washer,.004);cylinder(-.19,.78,.347,.025,.015,steel,washer).rotation.x=Math.PI/2;
  obstruction(5.735,2.32,.69,.60,'bathroom washer',false);
  box(5.65,.48,3.10,.52,.78,.65,oak,bathroom,.007);box(5.92,.48,3.10,.018,.74,.63,wood,bathroom,.004);
  box(5.71,.90,2.71,.66,.055,1.48,counter,bathroom,.006);
  box(5.70,.944,3.10,.43,.055,.53,porcelain,bathroom,.055);sphere(5.70,.976,3.10,.17,.01,.215,mat('#c6cbc5'),bathroom);
  box(5.44,1.07,3.10,.025,.25,.025,metal,bathroom);box(5.39,1.56,3.10,.025,.75,.60,mat('#aab9b2',.1,.8),bathroom,.025);
  obstruction(5.71,3.10,.66,.70,'basin',false);
  // Dining balcony now belongs to the calm dining and coffee zone.
  wardrobe(11.12,5.63,.85,.34,1.12,-Math.PI/2);
  box(11.12,1.13,5.63,.36,.035,.87,cherry,furniture,.012);
  // Framed artwork: simple relief forms, no external image dependencies.
  const art=new THREE.Group();art.position.set(9.715,1.72,7.3);art.rotation.y=-Math.PI/2;furniture.add(art);
  box(0,0,0,.84,.64,.025,oak,art,.015);box(0,0,.018,.77,.57,.008,white,art);
  const artShape=new THREE.Mesh(new THREE.CircleGeometry(.19,40),mat('#a0aa8d'));artShape.position.set(.09,.03,.025);art.add(artShape);
  box(-.15,-.1,.027,.15,.28,.005,oatmeal,art,.03);
  // Light groups are illustrative ambience, not a daylight calculation.
  for(const r of rooms) {
    const light=new THREE.PointLight(HOME_STYLE.lamplight,0,r.id==='living'?6:4.8,2);light.position.set(r.center[0],2.38,r.center[1]);root.add(light);lamps.push({light,nightIntensity:r.id==='kitchen'||r.id==='bathroom'?3.1:2.5});
    if(r.id!=='dining') {cylinder(r.center[0],2.65,r.center[1],.17,.045,white,ceilings);}
  }
  let currentCutaway=false;
  function setCutaway(enabled:boolean) {
    if(enabled===currentCutaway)return;currentCutaway=enabled;
    architecturalMaterials.forEach(m=>{m.clippingPlanes=enabled?[cutPlane]:[];m.clipShadows=true;m.needsUpdate=true;});
  }
  function setNight(night:boolean) {lamps.forEach(({light,nightIntensity})=>{light.visible=night;light.intensity=night?nightIntensity:0;});luminous.forEach(m=>m.emissiveIntensity=night?.9:.13);}
  setNight(false);
  // Translate complete furniture pieces into the measured rooms. Product widths,
  // bed lengths and the 65-inch display are never scaled with the footprint.
  for(const item of furniture.children) {
    if(item.userData.calibrated)continue;
    const [x,z]=relocateFurniture(item.position.x,item.position.z);
    item.position.x=x;item.position.z=z;
  }
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
  function setScheme(id:SchemeId) {
    const p=modelPalettes[id];
    wallMat.color.set(p.wall);ceilingMat.color.set(p.ceiling);white.color.set(p.cabinet);capMat.color.set(p.edge);
    for(const material of [wood,cherry,cherryFront,darkWood])material.color.set(p.wood);
    for(const material of [oak,cherryEdge])material.color.set(p.edge);
    guestAccent.color.set(p.accent);sage.color.set(p.accent);fabric.color.set(p.fabric);oatmeal.color.set(p.fabric).multiplyScalar(.87);
    metal.color.set(p.metal);archMetal.color.set(p.metal);floorOak.color.set(p.floorTint);
  }
  setScheme('forest');
  batch(furniture);batch(architecture);
  const kitchenDoors=buildKitchenDoors(colliders,architecturalMaterials);root.add(kitchenDoors.root);
  return {root,architecture,furniture,ceilings,colliders,floorMeshes,windows,walls,layout:LAYOUT,kitchenDoors,setCutaway,setNight,setScheme};
}
