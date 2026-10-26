import * as THREE from 'three';
import { LAYOUT } from './plan';
import type { Collider } from './navigation.mjs';

// Multi-track telescopic leaves: the same full-size panels slide into a stack.
// Keep this assembly outside static batching so transforms and collisions agree.
export function buildKitchenDoors(colliders: Collider[], architecturalMaterials: THREE.Material[]) {
  const spec=LAYOUT.kitchen.doors;
  const root=new THREE.Group();root.name='top-hung-kitchen-enclosure';
  const frame=new THREE.MeshStandardMaterial({color:'#b9b6a9',roughness:.42,metalness:.45});
  const track=new THREE.MeshStandardMaterial({color:'#e9e7de',roughness:.6});
  const channel=new THREE.MeshStandardMaterial({color:'#757b75',roughness:.5,metalness:.35});
  const glazing=new THREE.MeshPhysicalMaterial({color:'#e4f0ed',roughness:.06,metalness:0,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false});
  architecturalMaterials.push(frame,track,channel,glazing);
  const leaves:{group:THREE.Group;side:'west'|'south';index:number;width:number;open:THREE.Vector3;closed:THREE.Vector3;collider:Collider}[]=[];
  function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  for(const side of ['west','south'] as const) {
    const run=spec[side],alongZ=side==='west';
    const length=run.to-run.from,pitch=length/run.panels,width=pitch+.025;
    const cross=alongZ?spec.west.x:spec.south.z;
    const trackWidth=(run.panels-1)*spec.trackPitch+.045;
    const offset=(run.panels-1)*spec.trackPitch/2*(alongZ?1:-1);
    box(root,alongZ?cross+offset:(run.from+run.to)/2,2.665,alongZ?(run.from+run.to)/2:cross+offset,
      alongZ?trackWidth:length+.04,.07,alongZ?length+.04:trackWidth,track);
    for(let i=0;i<run.panels;i++) {
      const lane=cross+i*spec.trackPitch*(alongZ?1:-1);
      box(root,alongZ?lane:(run.from+run.to)/2,2.626,alongZ?(run.from+run.to)/2:lane,
        alongZ?.009:length,.009,alongZ?length:.009,channel);
      const leaf=new THREE.Group();leaf.name=`kitchen-${side}-leaf-${i+1}`;root.add(leaf);
      if(alongZ)leaf.rotation.y=Math.PI/2;
      const bottom=.012,height=spec.height-bottom,bar=.018;
      box(leaf,0,bottom+height/2,0,width-2*bar,height-2*bar,spec.panelThickness,glazing);
      for(const x of [-1,1])box(leaf,x*(width-bar)/2,bottom+height/2,0,bar,height,.028,frame);
      for(const y of [bottom+bar/2,bottom+height-bar/2])box(leaf,0,y,0,width,bar,.028,frame);
      // Recessed pull on the leading leaf; no projecting handle between stacked leaves.
      if(i===(alongZ?run.panels-1:0))box(leaf,(alongZ?1:-1)*(width/2-.032),1.10,.017,.018,.20,.008,frame);
      const closedAlong=run.from+(i+.5)*pitch;
      const openAlong=alongZ?run.from+width/2:run.to-width/2;
      const open=new THREE.Vector3(alongZ?lane:openAlong,0,alongZ?openAlong:lane);
      const closed=new THREE.Vector3(alongZ?lane:closedAlong,0,alongZ?closedAlong:lane);
      const collider={minX:0,maxX:0,minZ:0,maxZ:0,name:`kitchen ${side} sliding leaf ${i+1}`};
      colliders.push(collider);leaves.push({group:leaf,side,index:i,width,open,closed,collider});
    }
  }
  let progress=0,target=0;
  function place() {
    const ease=progress*progress*(3-2*progress);
    for(const leaf of leaves) {
      leaf.group.position.lerpVectors(leaf.open,leaf.closed,ease);
      const {x,z}=leaf.group.position,alongZ=leaf.side==='west';
      Object.assign(leaf.collider,{minX:x-(alongZ?.018:leaf.width/2),maxX:x+(alongZ?.018:leaf.width/2),
        minZ:z-(alongZ?leaf.width/2:.018),maxZ:z+(alongZ?leaf.width/2:.018)});
    }
  }
  place();
  const sweptColliders:Collider[]=(['west','south'] as const).map(side=>{
    const list=leaves.filter(leaf=>leaf.side===side);
    return {minX:Math.min(...list.map(l=>Math.min(l.open.x,l.closed.x)-(side==='west'?.018:l.width/2))),
      maxX:Math.max(...list.map(l=>Math.max(l.open.x,l.closed.x)+(side==='west'?.018:l.width/2))),
      minZ:Math.min(...list.map(l=>Math.min(l.open.z,l.closed.z)-(side==='west'?l.width/2:.018))),
      maxZ:Math.max(...list.map(l=>Math.max(l.open.z,l.closed.z)+(side==='west'?l.width/2:.018))),name:`moving kitchen ${side} doors`};
  });
  return {root,sweptColliders,
    setClosed(closed:boolean){target=closed?1:0;},
    update(dt:number){
      if(progress===target)return false;
      progress=THREE.MathUtils.clamp(progress+Math.sign(target-progress)*dt/1.1,0,1);
      place();return true;
    },
    diagnostics:()=>({closed:target===1,progress,moving:progress!==target,
      panels:leaves.map(l=>({side:l.side,index:l.index,width:l.width,...l.collider})),
      stacks:{west:{length:leaves[0].width,depth:spec.west.stackDepth},south:{length:leaves[spec.west.panels].width,depth:spec.south.stackDepth}}}),
  };
}
