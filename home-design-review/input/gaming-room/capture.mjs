import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto('http://localhost:5175');
 const images=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {HomeViewer}=await import('/src/viewer.ts');
  const div=document.createElement('div');div.style='width:1200px;height:900px';document.body.append(div);
  const v=new HomeViewer(div,{onRoom(){},onMode(){},onMove(){},onReady(){}});
  v.renderer.setAnimationLoop(null);v.model.ceilings.visible=true;v.model.setCutaway(false);v.scene.background=new THREE.Color('#e7e7df');
  v.renderer.setPixelRatio(1);v.renderer.setSize(1200,900);
  v.camera.aspect=1200/900;v.camera.fov=83;v.camera.position.set(5.55,1.5,7.1);v.camera.lookAt(3.5,1.25,6.95);v.camera.updateProjectionMatrix();
  v.renderer.render(v.scene,v.camera);const perspective=v.renderer.domElement.toDataURL();
  const rt=new THREE.WebGLCubeRenderTarget(768,{type:THREE.HalfFloatType});
  const cube=new THREE.CubeCamera(.05,100,rt);cube.position.set(5.55,1.5,7.1);cube.update(v.renderer,v.scene);
  const scene=new THREE.Scene();const cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  // Image center = west (desk), left quarter = south window, right = north cabinet.
  const shader=new THREE.ShaderMaterial({uniforms:{env:{value:rt.texture}},vertexShader:'varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform samplerCube env;varying vec2 uvv;void main(){float a=(uvv.x-.5)*6.2831853;float p=(uvv.y-.5)*3.14159265;vec3 dir=vec3(-cos(a)*cos(p),sin(p),-sin(a)*cos(p));gl_FragColor=textureCube(env,dir);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),shader));v.renderer.setSize(2048,1024);v.renderer.render(scene,cam);const panorama=v.renderer.domElement.toDataURL();
  v.model.ceilings.visible=false;v.model.setCutaway(true);v.renderer.setSize(900,1100);v.camera.aspect=900/1100;v.camera.fov=35;v.camera.position.set(4.85,9,7);v.camera.up.set(0,0,-1);v.camera.lookAt(4.85,0,7);v.camera.updateProjectionMatrix();v.renderer.render(v.scene,v.camera);const plan=v.renderer.domElement.toDataURL();
  v.renderer.dispose();return{perspective,panorama,plan};
 });
 for(const [name,data] of Object.entries(images))await fs.writeFile(`home-design-review/input/gaming-room/${name}.png`,Buffer.from(data.split(',')[1],'base64'));
}finally{await browser.close();}
