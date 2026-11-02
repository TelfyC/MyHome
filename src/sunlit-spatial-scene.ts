/** Independent 2026-11-02 spatial review copy. Never mounted by the main viewer. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildHome} from './model';
import {rooms,outline,LAYOUT,WALL_HEIGHT} from './plan';
import {X,Z,MEASUREMENTS,relocateFurniture} from './dimensions';

export function buildSunlitSpatialScene(){
 const home=buildHome({batchStatic:false});
 home.setScheme('sunlit');home.setCutaway(false);home.ceilings.visible=true;
 home.root.name='sunlit-spatial-20261102';home.architecture.name='locked-architecture';home.furniture.name='spatial-furniture';home.ceilings.name='ceilings';
 const cream=new THREE.MeshStandardMaterial({color:'#f4f0e6',roughness:.72});
 const oak=new THREE.MeshStandardMaterial({color:'#c7ad88',roughness:.72});
 const dark=new THREE.MeshStandardMaterial({color:'#6b4435',roughness:.73});
 const sage=new THREE.MeshStandardMaterial({color:'#a3ad91',roughness:.9});
 const steel=new THREE.MeshStandardMaterial({color:'#767c74',roughness:.38,metalness:.55});
 const stone=new THREE.MeshStandardMaterial({color:'#eeeae0',roughness:.48});
 const glass=new THREE.MeshPhysicalMaterial({color:'#eef4ef',transparent:true,opacity:.14,roughness:.03,side:THREE.DoubleSide,depthWrite:false});
 const charcoal=new THREE.MeshStandardMaterial({color:'#353c36',roughness:.64});
 const corrections:string[]=[];
 const furniture:any[]=[];
 function record(id:string,roomId:string,x:number,z:number,width:number,depth:number,height:number,rotation=0,extra:any={}){furniture.push({id,role:id,roomId,x,z,width,depth,height,rotation,...extra});}
 function group(id:string){const g=new THREE.Group();g.name=id;g.userData.spatialId=id;home.furniture.add(g);return g;}
 function box(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,round=.008){const o=new THREE.Mesh(round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/4,h/4,d/4)):new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 function cyl(g:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 function cable(g:THREE.Object3D,p:number[][],m:THREE.Material,r=.006){const curve=new THREE.CatmullRomCurve3(p.map(p=>new THREE.Vector3(...p as [number,number,number])));const o=new THREE.Mesh(new THREE.TubeGeometry(curve,30,r,6,false),m);g.add(o);return o;}
 const bounds=(o:THREE.Object3D)=>new THREE.Box3().setFromObject(o);
 const center=(o:THREE.Object3D)=>bounds(o).getCenter(new THREE.Vector3());
 // Remove only superseded living objects in this review copy.
 for(const child of [...home.furniture.children]){
  const c=center(child),b=bounds(child),s=b.getSize(new THREE.Vector3());
  if(child.name==='plant-bengal'||(child instanceof THREE.Mesh&&c.x>7.25&&c.x<8.45&&c.z>8.50&&c.z<9.10&&s.x<1.0&&s.z<1.0))child.removeFromParent();
 }
 // The old decorative point lamp is not used as a false light source.
 home.root.traverse(o=>{if(o instanceof THREE.Light)o.visible=false;});
 const reading=group('reading-corner');
 const fabricCanvas=document.createElement('canvas');fabricCanvas.width=256;fabricCanvas.height=256;const cx=fabricCanvas.getContext('2d')!;cx.fillStyle='#eeeadd';cx.fillRect(0,0,256,256);cx.fillStyle='#aab29b';for(let i=0;i<256;i+=32)cx.fillRect(i,0,4,256);
 const stripeTexture=new THREE.CanvasTexture(fabricCanvas);stripeTexture.wrapS=stripeTexture.wrapT=THREE.RepeatWrapping;stripeTexture.colorSpace=THREE.SRGBColorSpace;
 const striped=new THREE.MeshStandardMaterial({color:'#ffffff',map:stripeTexture,roughness:.93});
 const chair=new THREE.Group();chair.name='reading-chair';chair.position.set(7.02,0,8.39);chair.rotation.y=Math.PI;reading.add(chair);
 box(chair,0,.25,0,.70,.16,.76,oak,.025);box(chair,0,.48,-.025,.68,.20,.77,striped,.075);box(chair,0,.83,.30,.73,.63,.17,striped,.06);
 for(const dx of [-.36,.36]){box(chair,dx,.66,-.04,.055,.05,.72,oak,.018);for(const dz of [-.28,.28])box(chair,dx,.34,dz,.045,.59,.045,oak,.008);}
 record('reading-chair','living',7.02,8.39,.78,.88,1.15,Math.PI);
 const ottoman=group('reading-ottoman');box(ottoman,7.02,.22,9.03,.45,.30,.40,oak,.018);box(ottoman,7.02,.41,9.03,.45,.12,.40,striped,.045);box(ottoman,7.02,.275,8.824,.34,.017,.007,charcoal,.003);
 record('reading-ottoman','living',7.02,9.03,.45,.40,.47);
 cyl(reading,6.63,.51,9.03,.16,.045,dark);cyl(reading,6.63,.26,9.03,.035,.48,dark);cyl(reading,6.63,.03,9.03,.125,.035,dark);record('side-table','living',6.63,9.03,.32,.32,.54);
 cyl(reading,6.53,.025,8.68,.08,.035,steel);cyl(reading,6.53,.77,8.68,.012,1.48,steel);box(reading,6.62,1.51,8.67,.20,.035,.055,steel,.012);const shade=cyl(reading,6.71,1.48,8.67,.075,.11,cream);shade.rotation.z=Math.PI/5;record('reading-lamp','living',6.53,8.68,.16,.16,1.55,0,{footprint:'floor base; lamp head overhang above chair back'});
 corrections.push('Replace the living TV-side large plant and old stool/lamp with an ivory-sage striped armchair, 45x40cm storage ottoman, 32cm dark side table and directional reading light; retain all original windows and the stepped contour.');
 // Clear the two-centimetre corner overlap between the two dressing cabinets.
 for(const o of home.furniture.children){if(o instanceof THREE.Group&&Math.abs(o.position.x-.25)<.001&&Math.abs(o.position.z-(5.3+Z.upperSouth-4.31))<.001)o.position.z-=.04;}
 // Reinstate the approved light low coffee table at a checked footprint.
 const coffeeTable=group('living-coffee-table');box(coffeeTable,7.95,.40,6.25,.70,.055,1.05,cream,.055);for(const x of [7.70,8.20])for(const z of [5.85,6.65])box(coffeeTable,x,.20,z,.045,.37,.045,oak,.009);box(coffeeTable,7.95,.437,6.25,.25,.016,.37,dark,.012);
 record('living-coffee-table','living',7.95,6.25,.70,1.05,.45);
 for(const o of home.furniture.children){if(!(o instanceof THREE.Mesh))continue;const c=center(o),b=bounds(o),sz=b.getSize(new THREE.Vector3());if(Math.abs(c.x-2.72)<.01&&Math.abs(c.z-(9.88+Z.masterSouth-10.76))<.01&&sz.x<.7&&sz.z<.7)o.position.x+=.10;}
 // Warm dark dining table, pale bench and chairs. Recolour individual table parts only.
 const dining=home.furniture.getObjectByName('integrated-dining');
 dining?.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const c=center(o);if(c.x>7.70&&c.x<8.46&&Math.abs(c.z-1.60)<.63&&c.y<.79)o.material=dark;});
 // White coffee base, pale-oak counter and a reachable corded warm-white strip.
 const coffee=home.furniture.getObjectByName('coffee-sideboard')!;
 coffee.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const c=center(o);if(c.y<.87)o.material=c.y<.11?charcoal:cream;else if(c.y<.94)o.material=oak;});
 const power=group('coffee-mobile-power-strip');
 box(power,7.275,1.24,.49,.045,.075,.29,cream,.015);
 for(const z of [.40,.49,.58]){box(power,7.300,1.25,z,.003,.020,.006,charcoal,.001);for(const dz of [-.014,.014]){const slot=box(power,7.301,1.23,z+dz,.003,.018,.004,charcoal,.001);slot.rotation.x=dz>0?-.5:.5;}}
 box(power,7.301,1.24,.62,.004,.045,.028,sage,.005);
 cable(power,[[7.28,1.20,.62],[7.28,1.04,.64],[7.28,.64,.66],[7.29,.37,.66]],cream,.007);
 cable(power,[[7.54,1.10,.41],[7.37,1.10,.43],[7.31,1.16,.49],[7.30,1.24,.49]],charcoal,.005);
 cable(power,[[7.52,1.02,.08],[7.38,1.01,.13],[7.32,1.12,.40],[7.30,1.24,.40]],charcoal,.005);
 record('coffee-mobile-power-strip','dining',7.275,.49,.045,.29,.075,0,{baseHeight:1.20,wallMounted:true});
 corrections.push('Coffee cabinet remains west-facing structure with appliances facing east; warm-white three-position portable power bar fixed with removable clips on dry back wall, supply cable restrained down cabinet rear.');
 // Preserve the original exterior return at its full height. Only the new ~49cm
 // former sliding span becomes a low fixed back with clear glass above it.
 const fixedStart=12.58-1.35;
 const kitchenFixed=new THREE.Group();kitchenFixed.name='kitchen-south-fixed-low-wall-and-glass';home.architecture.add(kitchenFixed);
 box(kitchenFixed,(fixedStart+X.entranceEast)/2,.44,Z.kitchenSouth,X.entranceEast-fixedStart,.88,.16,cream,.003);
 box(kitchenFixed,(fixedStart+X.entranceEast)/2,1.755,Z.kitchenSouth,X.entranceEast-fixedStart,1.71,.015,glass,0);
 for(const x of [fixedStart,X.entranceEast])box(kitchenFixed,x,1.755,Z.kitchenSouth,.025,1.75,.035,steel,.002);
 for(const y of [.89,2.63])box(kitchenFixed,(fixedStart+X.entranceEast)/2,y,Z.kitchenSouth,X.entranceEast-fixedStart+.025,.025,.035,steel,.002);
 // Replace the east short run with a continuous non-overlapping L. Shared corner belongs to south unit.
 const kitchen=home.furniture.getObjectByName('integrated-open-kitchen')!;
 for(const o of [...kitchen.children]){const c=center(o);if(o instanceof THREE.Group&&Math.abs(c.x-12.28)<.1&&c.z>1.5)o.removeFromParent();}
 const prep=group('kitchen-continuous-L-prep');
 const southBack=2.55,southFront=2.00,eastFront=11.98,eastBack=12.58,eastNorth=1.70;
 box(prep,(fixedStart+eastBack)/2,.46,(southFront+southBack)/2,1.35,.77,.55,oak,.008);
 box(prep,(eastFront+eastBack)/2,.46,(eastNorth+southFront)/2,.60,.77,.30,oak,.008);
 box(prep,(fixedStart+eastBack)/2,.055,2.275,1.27,.11,.47,charcoal,.003);
 box(prep,12.28,.055,1.85,.52,.11,.30,charcoal,.003);
 const lshape=new THREE.Shape();lshape.moveTo(fixedStart,-southBack);lshape.lineTo(eastBack,-southBack);lshape.lineTo(eastBack,-eastNorth);lshape.lineTo(eastFront,-eastNorth);lshape.lineTo(eastFront,-southFront);lshape.lineTo(fixedStart,-southFront);lshape.closePath();
 const topGeo=new THREE.ExtrudeGeometry(lshape,{depth:.045,bevelEnabled:false});topGeo.rotateX(-Math.PI/2);const top=new THREE.Mesh(topGeo,stone);top.position.y=.8575;top.name='continuous-L-stone-top';top.receiveShadow=true;prep.add(top);
 for(const [a,b] of [[fixedStart,fixedStart+.60],[fixedStart+.60,fixedStart+1.05],[fixedStart+1.05,eastBack]]){for(const y of [.26,.50,.73]){box(prep,(a+b)/2,y,southFront-.010,b-a-.008,.21,.018,oak,.004);box(prep,(a+b)/2,y+.075,southFront-.022,b-a-.10,.012,.016,steel,.003);}}
 box(prep,eastFront-.012,.46,1.85,.018,.72,.285,oak,.004);box(prep,eastFront-.022,.79,1.85,.016,.012,.22,steel,.003);
 // Rice cooker belongs on east short counter, outside the main cutting surface.
 box(prep,12.28,1.02,1.85,.29,.23,.26,cream,.045);box(prep,12.28,1.145,1.85,.30,.035,.265,charcoal,.025);
 record('south-prep-counter','kitchen',(fixedStart+eastBack)/2,2.275,1.35,.55,.903,0,{assembly:'kitchen-L',contactGroup:'kitchen-L'});
 record('east-counter','kitchen',12.28,1.85,.60,.30,.903,0,{assembly:'kitchen-L',contactGroup:'kitchen-L',note:'Non-overlapping north extension; shared .60x.55 corner counted only in south unit. Full east run85cm.'});
 // Rebuild both banks; south four stack toward west/left, clear of fixed135cm segment.
 home.kitchenDoors.root.removeFromParent();const doors=new THREE.Group();doors.name='kitchen-enclosure-5west-4south-left';home.root.add(doors);
 const doorGroups:any[]=[];
 function bank(side:'west'|'south',from:number,to:number,count:number,cross:number){const west=side==='west',pitch=(to-from)/count,width=pitch+.020;
  const trackCenter=(from+to)/2;box(doors,west?cross+.08:trackCenter,2.665,west?trackCenter:cross-.06,west?.22:to-from,.07,west?to-from:.18,cream,.003);
  const positions=[];for(let i=0;i<count;i++){const leaf=new THREE.Group();leaf.name=`kitchen-${side}-leaf-${i+1}`;if(west)leaf.rotation.y=Math.PI/2;const along=from+width/2;leaf.position.set(west?cross+i*.04:along,0,west?along:cross-i*.04);doors.add(leaf);box(leaf,0,1.31,0,width-.036,2.58,.012,glass,0);for(const x of [-1,1])box(leaf,x*(width-.018)/2,1.31,0,.018,2.60,.025,steel,.002);for(const y of [.018,2.61])box(leaf,0,y,0,width,.018,.025,steel,.002);positions.push([leaf.position.x,leaf.position.z]);}
  doorGroups.push({side,panels:count,from,to,cross,stackToward:'start',stackWidth:width,positions,default:'open',clearOpening:to-from-width});}
 bank('west',Z.upperBalconyNorth+.11,Z.kitchenSouth,5,LAYOUT.kitchen.enclosureWest);
 bank('south',LAYOUT.kitchen.enclosureWest,fixedStart,4,Z.kitchenSouth);
 corrections.push('Kitchen east85cm short run and south135x55cm prep counter form one continuous L; shared corner counted once; original southeast exterior return retained at full2.70m height, only new49cm span receives low enclosure/clear glass; west5 panels and south4 panels (south stacks left).');
 // Stable records for all principal furniture; these match actual exported source meshes.
 const sofa=relocateFurniture(9.15,7.28),tv=relocateFurniture(6.72,7.28),bed=relocateFurniture(1.55,9.10);
 record('living-sofa','living',sofa[0],sofa[1],.92,2.05,1.11,0);record('tv-console','living',tv[0],tv[1],.42,1.80,.47,0);
 record('dining-table','dining',8.08,1.60,.70,1.20,.78);record('dining-bench','dining',7.43,1.60,.36,1.20,.50);
 record('dining-chair-north','dining',8.08,.66,.43,.44,.92);record('dining-chair-south','dining',8.08,2.54,.43,.44,.92);
 record('coffee-sideboard','dining',7.50,-.10,.50,1.50,.92);
 record('master-bed','master',bed[0],bed[1],1.96,2.23,1.19);
 const mb1=relocateFurniture(1.22,6.55),mb2=relocateFurniture(.25,5.3);record('master-wardrobe','master',mb1[0],mb1[1],1.75,.60,2.38);record('master-dressing-cabinet','master',mb2[0],mb2[1]-.04,.48,1.32,2.38);
 record('guest-chair','guest',4.14,1.68,.56,.56,.98);record('gaming-chair','study',4.79,7.10,.68,.68,1.21);
 const n1=relocateFurniture(.32,9.88),n2=relocateFurniture(2.72,9.88);record('master-nightstand-left','master',n1[0],n1[1],.50,.50,.50);record('master-nightstand-right','master',n2[0]+.10,n2[1],.50,.50,.50);
 record('guest-bed','guest',2.70,1.55,1.20,2.10,.96);record('guest-desk','guest',4.80,1.62,.65,2.30,.78);record('guest-wardrobe','guest',2.95,3.45,1.70,.60,2.35);
 record('gaming-desk','study',3.895,7.0,.75,1.80,.78);record('display-cabinet','study',4.20,5.505,1.05,.40,1.85);
 record('north-counter','kitchen',10.64,.44,2.30,.60,.90);record('refrigerator','kitchen',12.18,.49,.70,.70,1.93);
 record('washer','bathroom',5.71,2.32,.69,.60,.87);record('basin','bathroom',5.71,3.10,.66,.70,1.20);record('toilet','bathroom',5.75,1.57,.70,.50,.91);record('shower','bathroom',6.19,.62,1.58,.98,2.36);
 home.root.updateMatrixWorld(true);
 const walls=home.walls.map((w,i)=>({...w,id:`wall-${String(i+1).padStart(3,'0')}`,thickness:.22,start:[w.x1,w.z1],end:[w.x2,w.z2]}));
 walls.push({id:'kitchen-fixed-extension',name:'kitchen-fixed-low-wall',x1:fixedStart,z1:Z.kitchenSouth,x2:X.entranceEast,z2:Z.kitchenSouth,base:0,height:.88,opaque:true,color:'#f4f0e6',thickness:.16,start:[fixedStart,Z.kitchenSouth],end:[X.entranceEast,Z.kitchenSouth]});
 const openings:any[]=home.windows.map((w,i)=>{const matches=home.walls.filter(a=>Math.abs(a.x1-w.x1)<1e-6&&Math.abs(a.z1-w.z1)<1e-6&&Math.abs(a.x2-w.x2)<1e-6&&Math.abs(a.z2-w.z2)<1e-6);const bottom=matches.find(a=>a.base===0),top=matches.find(a=>a.base>1);return{id:`window-${i+1}`,kind:'window',start:[w.x1,w.z1],end:[w.x2,w.z2],sill:bottom?.height??.85,height:(top?.base??2.28)-(bottom?.height??.85)};});
 for(const [id,start,end] of [['guest',[4.13,Z.upperSouth],[5.15,Z.upperSouth]],['bathroom',[6.15,Z.upperSouth],[7.02,Z.upperSouth]],['master',[2.90,Z.upperSouth],[2.90,Z.upperSouth+1.02]],['study',[5.15,Z.studyNorth],[6.22,Z.studyNorth]],['entry',[X.entranceEast,2.89],[X.entranceEast,3.91]]] as const)openings.push({id:`door-${id}`,kind:'door',start,end,sill:0,height:2.15});
 for(const d of doorGroups)openings.push({id:`kitchen-${d.side}-retractable`,kind:'retractable',start:d.side==='west'?[d.cross,d.from]:[d.from,d.cross],end:d.side==='west'?[d.cross,d.to]:[d.to,d.cross],sill:0,height:2.62});
 const roomData=rooms.map(r=>({...r,polygon:r.id==='master'?[[X.masterWest,Z.upperSouth],[2.90,Z.upperSouth],[2.90,Z.studyNorth],[X.studyWest,Z.studyNorth],[X.studyWest,Z.masterSouth],[X.masterWest,Z.masterSouth]]:r.polygon}));
 const cameras=[
  {id:'living',roomId:'living',position:[9.12,1.58,5.53],target:[7.25,1.10,7.73],lensMm:21,type:'main'},
  {id:'dining',roomId:'dining',position:[8.95,1.58,2.45],target:[7.65,1.13,-.12],lensMm:21,type:'main'},
  {id:'kitchen',roomId:'kitchen',position:[9.57,1.58,1.27],target:[11.4,1.08,1.15],lensMm:15,type:'main'},
  {id:'master',roomId:'master',position:[2.68,1.58,5.40],target:[1.42,1.05,8.19],lensMm:22,type:'main'},
  {id:'study',roomId:'study',position:[5.73,1.58,5.91],target:[3.86,1.13,7.18],lensMm:21,type:'main'},
  {id:'guest',roomId:'guest',position:[4.05,1.58,3.45],target:[3.51,1.08,1.26],lensMm:20,type:'main'},
  {id:'bathroom',roomId:'bathroom',position:[6.75,1.58,3.37],target:[5.82,1.05,1.57],lensMm:18,type:'main'},
  {id:'living-detail',roomId:'living',position:[8.16,1.42,7.75],target:[7.02,1.0,8.72],lensMm:25,type:'detail'},
  {id:'dining-detail',roomId:'dining',position:[8.64,1.48,.84],target:[7.44,1.24,-.04],lensMm:30,type:'detail'},
 ].map(c=>({...c,projection:'perspective',sensorWidthMm:36,fovDegrees:2*Math.atan(36/(2*c.lensMm))*180/Math.PI,structureVisibility:'Actual full walls retained; camera inside room footprint.'}));
 const scene={version:'sunlit-spatial-20261102-r1',units:'m',coordinateSystem:'Three x/east,y/up,z/drawing-down; Blender (x,-z,y)',height:WALL_HEIGHT,outline,rooms:roomData,walls,openings,furniture,doorGroups,cameras,dimensions:{X,Z,MEASUREMENTS},changes:corrections,qaNotes:['Source wall/window geometry locked to latest src/model.ts; source thickness, heights and unmeasured opening offsets remain conceptual.','Kitchen actual clear geometry follows latest coordinate anchors; approximate doc measurements are not promoted to surveyed dimensions.','No main-view wall removed or moved for the camera. Full-home/room overhead drawings explicitly hide ceiling only.']};
 return {root:home.root,scene};
}
