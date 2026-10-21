export type RoomId = 'living' | 'study' | 'master' | 'guest' | 'dining' | 'kitchen' | 'bathroom' | 'balcony' | 'entry';
export type Point = [number, number];
export interface Room {
  id: RoomId; name: string; english: string; icon: string; subtitle: string;
  description: string; features: string[]; dimension: string;
  polygon: Point[]; center: Point; spawn: Point; look: Point; color: string;
}
const rect = (x1: number, z1: number, x2: number, z2: number): Point[] => [[x1,z1],[x2,z1],[x2,z2],[x1,z2]];
export const rooms: Room[] = [
  { id:'living', name:'客厅', english:'LIVING ROOM', icon:'sofa', subtitle:'把中央，留给生活', dimension:'净宽 3.30 m · 公区主段进深 4.60 m',
    description:'65 英寸电视搭配自然橡木矮柜，居中正对沙发。MUJI 风的奶白墙面、自然棕橡木纹地面与本色棉麻形成层次；电视背后补为完整奶白实体墙。',
    features:['65 英寸电视 · 正对沙发','1.80 × 0.42 m 自然橡木电视柜','电视左侧 · 约 1.7 m 孟加拉榕'],
    polygon:[[X.studyEast,Z.studyNorth],[X.livingEast,Z.studyNorth],[X.livingEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingSouth],[X.studyEast,Z.livingSouth]],center:[8.1,6.4],spawn:[8.35,6.65],look:[6.72,6.70],color:'#bba68a' },
  { id:'study', name:'电竞房', english:'GAMING ROOM', icon:'gamepad-2', subtitle:'游戏、收藏与自己的小世界', dimension:'净尺寸 2.75 × 3.40 m',
    description:'1.80 × 0.75 m 电竞桌沿主卧共墙摆放，座椅面向墙，原窗侧向采光。上方洞洞板挂耳机与手柄，上侧玻璃移门柜展示玩偶。桌后留 5 cm 理线空隙，桌下双槽分收电源线与信号线，沿墙集中落线；座椅常用位置后方约 1.09 m 通道。',
    features:['靠主卧共墙 · 面向墙使用','洞洞板挂件 · 玻璃移门展示柜','桌下双理线槽 · 落线不跨过道'],
    polygon:rect(X.studyWest,Z.studyNorth,X.studyEast,Z.studySouth),center:[4.85,7.02],spawn:[5.55,7.10],look:[3.65,7.10],color:'#97a88b' },
  { id:'master', name:'主卧 / 衣帽区', english:'MASTER BEDROOM', icon:'bed-double', subtitle:'安静而松弛的日常', dimension:'睡眠区 3.25 × 3.35 m · 上方衣帽区',
    description:'主卧睡眠区按 3.25 × 3.35 m 校正，上方原 2.12 × 1.94 m 区域继续用于衣帽收纳。左侧墙改为完整实墙，保留下端外窗。',
    features:['1.80 m 床垫 · 燕麦织物','入口衣帽区 · 0.60 m 深衣柜','暖棕木纹砖 · 奶白墙面'],
    polygon:rect(X.masterWest,Z.upperSouth,X.studyWest,Z.masterSouth),center:[1.6,7.65],spawn:[2.65,6.04],look:[1.4,7.94],color:'#c8b69c' },
  { id:'guest', name:'客房 / 未来儿童房', english:'FUTURE KIDS ROOM', icon:'sprout', subtitle:'为未来，留一间完整的房', dimension:'净宽 3.05 m · 侧墙无窗',
    description:'左上房间按 3.05 m 净宽校正，作为客房并预留未来儿童房用途。左侧墙为完整实墙，仅保留上方原有外窗。',
    features:['1.50 m 床垫','独立房门 · 保留实体墙','书桌与低收纳 · 灵活转换'],
    polygon:rect(X.guestWest,-.11,X.bathroomWest,Z.upperSouth),center:[3.56,2.0],spawn:[4.60,3.05],look:[3.4,1.3],color:'#b1b69a' },
  { id:'dining', name:'餐厅', english:'DINING ROOM', icon:'utensils', subtitle:'两个人，也认真吃饭', dimension:'宽 2.50 m · 含上方阳台总深 3.45 m',
    description:'开放餐厨一体布局：1.20 × 0.70 m 餐桌左侧长凳、右侧两把椅，右侧保留约 0.92 m 静态主通道。原阳台洗衣位改为 1.50 m 餐边咖啡柜，咖啡机、磨豆机与杯具集中收纳。',
    features:['1.20 × 0.70 m 原木餐桌','1.50 × 0.48 m 咖啡餐边柜','右侧约 0.92 m 静态主通道'],
    polygon:rect(X.diningWest,Z.diningNorth,X.livingEast,Z.kitchenSouth),center:[8.45,1.55],spawn:[9.2,2.45],look:[8.0,1.35],color:'#c0a27e' },
  { id:'kitchen', name:'厨房', english:'KITCHEN', icon:'cooking-pot', subtitle:'取、洗、切、炒，与餐厅相连', dimension:'净尺寸 2.62 × 2.44 m',
    description:'冰箱归入东北角靠墙家电区；北墙依次安排灶台、约 0.58 m 连续备餐段及窗下水槽，烟罩落在北侧实墙段。右墙下段增加 0.85 m 辅助操作与收纳柜，冰箱前留出开门区，中部通向玄关和餐厅；保留原外墙窗。',
    features:['冰箱靠东北角 · 主路不设高柜','北墙约 0.58 m 连续备餐段','右墙 0.85 m 辅助操作台','灶与烟罩避开原外窗'],
    polygon:rect(X.livingEast,-.11,X.kitchenEast,Z.kitchenSouth),center:[11.25,1.3],spawn:[10.8,1.60],look:[11.45,.44],color:'#a9b8b4' },
  { id:'bathroom', name:'卫生间', english:'BATHROOM', icon:'bath', subtitle:'中部独立，顺序清晰', dimension:'净尺寸 1.65 × 3.70 m',
    description:'维持 1.65 × 3.70 m 卫生间，左墙由北至南为淋浴、马桶、洗衣机、台盆。0.60 m 标准洗衣机与台盆共用 1.48 m 台面，前方约 0.94 m 通道；门洞移至右侧，内开贴右墙。排水、防水与门位需现场深化。',
    features:['标准洗衣机迁入台盆旁','1.48 m 洗衣台盆共用台面','0.87 m 右侧门洞 · 内开贴墙'],
    polygon:rect(X.bathroomWest,-.11,X.diningWest,Z.upperSouth),center:[6.18,1.95],spawn:[6.55,2.72],look:[5.72,2.85],color:'#9cafa9' },
  { id:'balcony', name:'阳台', english:'COFFEE & DAYLIGHT', icon:'flower-2', subtitle:'让阳光进入餐桌与咖啡角', dimension:'与餐厅合计进深 3.45 m',
    description:'洗衣机已迁入卫生间，原家政位置融入餐厅；靠左墙设置餐边咖啡柜，北侧窗前保留开阔采光，放少量绿植。',
    features:['原洗衣区改咖啡收纳','保留北窗 · 释放采光','餐厨家务各归其位'],
    polygon:rect(X.diningWest,Z.upperBalconyNorth,X.livingEast,Z.diningNorth),center:[8.6,-.25],spawn:[8.75,-.15],look:[8.5,Z.upperBalconyNorth],color:'#8c9f78' },
  { id:'entry', name:'玄关 / 公共过道', english:'ENTRANCE', icon:'door-open', subtitle:'回家，从这里开始', dimension:'公共过道净宽 1.03 m · 玄关宽 1.65 m',
    description:'入口保留轻薄收纳，过道连接卧室、电竞房与公共空间。夜间独立照明，减少行走时对睡眠区的打扰。',
    features:['薄型玄关柜','连续公共过道','独立灯光 · 清洁设备预留'],
    polygon:[[3.25,Z.upperSouth],[X.diningWest,Z.upperSouth],[X.diningWest,Z.kitchenSouth],[X.entranceEast,Z.kitchenSouth],[X.entranceEast,Z.entranceSouth],[X.livingEast,Z.entranceSouth],[X.livingEast,Z.studyNorth],[3.25,Z.studyNorth]],center:[8,4.2],spawn:[10.8,3.5],look:[7.8,4.4],color:'#b5ae9c' },
];
export const roomById = (id: string) => rooms.find(r => r.id === id);
export const WALL_HEIGHT = 2.7;
// Latest user-approved visual layout. These are model coordinates, not a demolition plan.
export const LAYOUT = {
  gamingRoom: {
    sharedWall:'master', facing:'west',
    desk:{x:3.895,z:7.0,depth:.75,length:1.80,height:.75,wallGap:.05},
    chair:{x:4.79,z:7.10,width:.68,depth:.68},
    pegboard:{x:3.50,z:7.0,length:1.80,height:.65,centerY:1.83},
    display:{x:4.20,z:5.505,width:1.05,depth:.40,height:1.85,front:'south',doors:'sliding'},
    cables:{powerTrayX:3.62,signalTrayX:3.79,trayY:.64,dropZ:6.18,outletY:.43},
    chairBackAisle:1.09,
  },
  studyLivingWall: { kind:'solid', x:X.studyEast, from:Z.studyNorth, to:Z.livingSouth,
    infillFrom:Z.studyNorth+1.30, infillTo:Z.studyNorth+2.77, height:WALL_HEIGHT, curtain:false },
  kitchen: { kind:'open', slidingDoor:false,
    diningOpening:{x:X.livingEast,from:Z.north,to:Z.kitchenSouth},
    entryOpening:{z:Z.kitchenSouth,from:X.livingEast,to:X.entranceEast},
    exteriorReturn:{z:Z.kitchenSouth,from:X.entranceEast,to:X.kitchenEast},
    refrigerator:{x:12.18,z:.49,width:.70,depth:.70,height:1.93,front:'south',doorSweepSouth:1.54},
    sink:{x:11.45,z:.44,width:.60},hob:{x:10.28,z:.44,width:.58},
    hood:{x:10.28,width:.60,northWindowStart:10.685},
    northCounter:{x:10.89,z:.44,width:1.80,depth:.60},
    auxiliaryCounter:{x:12.28,z:2.075,width:.85,depth:.60},
    continuousPrep:.58 },
  dining:{table:{x:8.08,z:1.60,width:.70,length:1.20},chairEast:8.935,staticPassage:.915,
    coffeeSideboard:{x:7.50,z:-.10,width:1.50,depth:.48,height:.92}},
  planting:{living:'Ficus benghalensis',coffee:'Coffea arabica',windowShelf:'Epipremnum aureum',pots:'matte cream ceramic',count:3},
  laundry:{room:'bathroom',washer:{x:5.71,z:2.32,width:.60,bodyDepth:.64,totalDepth:.69,height:.85,front:'east'},
    basin:{x:5.71,z:3.10},counter:{x:5.71,z:2.71,width:1.48,depth:.66},
    clearAisle:.94,door:{fromX:6.15,toX:7.02,z:Z.upperSouth,opening:.87,hinge:'east',swing:'inward'}},
} as const;
export const outline: Point[] = [
  [X.masterWest,Z.upperSouth],[X.guestWest,Z.upperSouth],[X.guestWest,-.11],
  [X.diningWest,-.11],[X.diningWest,Z.upperBalconyNorth],[X.livingEast,Z.upperBalconyNorth],
  [X.livingEast,-.11],[X.kitchenEast,-.11],[X.kitchenEast,Z.kitchenSouth],
  [X.entranceEast,Z.kitchenSouth],[X.entranceEast,Z.entranceSouth],[X.livingEast,Z.entranceSouth],
  [X.livingEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingSouth],
  [X.studyEast,Z.livingSouth],[X.studyEast,Z.studySouth],[X.studyWest,Z.studySouth],
  [X.studyWest,Z.masterSouth],[X.masterWest,Z.masterSouth],
];
import { X, Z } from './dimensions';
