export interface Collider { minX:number; maxX:number; minZ:number; maxZ:number; name?:string }
export function pointInPolygon(x:number,z:number,polygon:[number,number][]):boolean;
export function circleHitsBox(x:number,z:number,radius:number,box:Collider):boolean;
export function canOccupy(x:number,z:number,polygon:[number,number][],colliders:Collider[],radius?:number):boolean;
export function moveWithCollision(position:{x:number,z:number},dx:number,dz:number,polygon:[number,number][],colliders:Collider[],radius?:number):{x:number,z:number};
