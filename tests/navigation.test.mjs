import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon, circleHitsBox, moveWithCollision, canOccupy } from '../src/navigation.mjs';
const outline=[[0,0],[8,0],[8,5],[5,5],[5,8],[0,8]];
test('irregular exterior rejects the cut-out rather than using a bounding rectangle',()=>{
 assert.equal(pointInPolygon(7,7,outline),false);
 assert.equal(pointInPolygon(3,7,outline),true);
});
test('a person cannot walk through fixed glazing, even with a large time step',()=>{
 const wall={minX:4,maxX:4.1,minZ:0,maxZ:8};
 const result=moveWithCollision({x:2,z:3},6,0,outline,[wall]);
 assert.ok(result.x<=3.82);assert.ok(result.x>3.7);
 assert.equal(canOccupy(4.05,3,outline,[wall]),false);
});
test('movement slides alongside walls without sticking to their corners',()=>{
 const wall={minX:4,maxX:4.1,minZ:0,maxZ:8};
 const result=moveWithCollision({x:3.7,z:2},1,2,outline,[wall]);
 assert.ok(result.x<3.83);assert.ok(result.z>3.95);
});
test('the original doorway is passable while its solid ends remain blocked',()=>{
 const walls=[{minX:4,maxX:4.2,minZ:0,maxZ:2},{minX:4,maxX:4.2,minZ:3,maxZ:8}];
 assert.ok(moveWithCollision({x:3,z:2.5},2,0,outline,walls).x>4.8);
 assert.ok(moveWithCollision({x:3,z:1},2,0,outline,walls).x<3.83);
});
test('collision uses a circular body, including diagonal furniture corners',()=>{
 const box={minX:2,maxX:3,minZ:2,maxZ:3};
 assert.equal(circleHitsBox(1.9,1.9,.18,box),true);
 assert.equal(circleHitsBox(1.8,1.8,.18,box),false);
});
