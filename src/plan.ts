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
    description:'65 英寸电视搭配樱桃木色矮柜，居中正对沙发。暖白墙面、暖棕木纹地面与米色织物形成层次；电视仍会遮住部分景窗。',
    features:['65 英寸电视 · 正对沙发','1.80 × 0.42 m 樱桃木色电视柜','电视左侧 · 约 1.7 m 阔叶绿植'],
    polygon:[[X.studyEast,Z.studyNorth],[X.livingEast,Z.studyNorth],[X.livingEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingStep],[X.lowerAlcoveEast,Z.livingSouth],[X.studyEast,Z.livingSouth]],center:[8.1,6.4],spawn:[8.35,6.65],look:[6.72,6.70],color:'#bba68a' },
  { id:'study', name:'书房 / 客卧', english:'STUDY & GUEST', icon:'book-open', subtitle:'一扇景窗，让光相遇', dimension:'净尺寸 2.75 × 3.40 m',
    description:'共享墙中段保留固定清玻璃，两端为实体承重段。双人桌靠原有外窗，高柜在上侧；客厅更新后的电视会遮住部分玻璃，隐私帘仍可收拢。',
    features:['1.70 × 0.58 m 白橡木双人桌','固定中段景窗 · 原门进出','客床展开时左椅收至桌下'],
    polygon:rect(X.studyWest,Z.studyNorth,X.studyEast,Z.studySouth),center:[4.85,7.02],spawn:[5.35,7.17],look:[6.33,6.95],color:'#97a88b' },
  { id:'master', name:'主卧 / 衣帽区', english:'MASTER BEDROOM', icon:'bed-double', subtitle:'安静而松弛的日常', dimension:'睡眠区 3.25 × 3.35 m · 上方衣帽区',
    description:'主卧睡眠区按 3.25 × 3.35 m 校正，上方原 2.12 × 1.94 m 区域继续用于衣帽收纳。左侧墙改为完整实墙，保留下端外窗。',
    features:['1.80 m 床垫 · 燕麦织物','入口衣帽区 · 0.60 m 深衣柜','暖棕木纹砖 · 暖白墙面'],
    polygon:rect(X.masterWest,Z.upperSouth,X.studyWest,Z.masterSouth),center:[1.6,7.65],spawn:[2.65,6.04],look:[1.4,7.94],color:'#c8b69c' },
  { id:'guest', name:'客房 / 未来儿童房', english:'FUTURE KIDS ROOM', icon:'sprout', subtitle:'为未来，留一间完整的房', dimension:'净宽 3.05 m · 侧墙无窗',
    description:'左上房间按 3.05 m 净宽校正，作为客房并预留未来儿童房用途。左侧墙为完整实墙，仅保留上方原有外窗。',
    features:['1.50 m 床垫','独立房门 · 保留实体墙','书桌与低收纳 · 灵活转换'],
    polygon:rect(X.guestWest,-.11,X.bathroomWest,Z.upperSouth),center:[3.56,2.0],spawn:[4.60,3.05],look:[3.4,1.3],color:'#b1b69a' },
  { id:'dining', name:'餐厅', english:'DINING ROOM', icon:'utensils', subtitle:'两个人，也认真吃饭', dimension:'宽 2.50 m · 含上方阳台总深 3.45 m',
    description:'樱桃木色餐桌与长凳、活动椅建立暖棕层次，米色座垫和少量茶具柔化桌面。右侧保留从玄关通向阳台的主要通道。',
    features:['1.20 × 0.70 m 樱桃木色餐桌','左侧长凳 · 右侧活动椅','独立餐桌吊灯'],
    polygon:rect(X.diningWest,Z.diningNorth,X.livingEast,Z.kitchenSouth),center:[8.45,1.55],spawn:[9.2,2.45],look:[8.0,1.35],color:'#c0a27e' },
  { id:'kitchen', name:'厨房', english:'KITCHEN', icon:'cooking-pot', subtitle:'封闭 L 形，高效而明亮', dimension:'净尺寸 2.62 × 2.44 m',
    description:'保留封闭 L 形厨房，水槽沿上方窗布置，灶台在右侧，冰箱靠入口一侧，浅色柜体配易清洁台面。',
    features:['封闭 L 形工作台','暖白平板柜门','柜下工作照明'],
    polygon:rect(X.livingEast,-.11,X.kitchenEast,Z.kitchenSouth),center:[11.25,1.3],spawn:[10.8,1.50],look:[12.1,1.0],color:'#a9b8b4' },
  { id:'bathroom', name:'卫生间', english:'BATHROOM', icon:'bath', subtitle:'中部独立，顺序清晰', dimension:'净尺寸 1.65 × 3.70 m',
    description:'沿用中央卫生间：上端淋浴、中段马桶、下端浅台盆。入口朝向公共过道，排污与通风条件仍需深化。',
    features:['上淋浴 · 中马桶 · 下台盆','下端朝公共过道开门','灰米色防滑砖'],
    polygon:rect(X.bathroomWest,-.11,X.diningWest,Z.upperSouth),center:[6.18,1.95],spawn:[6.3,2.72],look:[6.23,1.0],color:'#9cafa9' },
  { id:'balcony', name:'阳台', english:'UTILITY BALCONY', icon:'flower-2', subtitle:'家务之外，一点绿意', dimension:'与餐厅合计进深 3.45 m',
    description:'餐厅上方阳台作为家政候选，布置洗烘设备与少量植物。设备所需的给排水与电路条件待现场核实。',
    features:['家政洗烘候选','少量绿植 · 保持透光','水电排污条件待核实'],
    polygon:rect(X.diningWest,Z.upperBalconyNorth,X.livingEast,Z.diningNorth),center:[8.6,-.25],spawn:[8.75,-.15],look:[8.5,Z.upperBalconyNorth],color:'#8c9f78' },
  { id:'entry', name:'玄关 / 公共过道', english:'ENTRANCE', icon:'door-open', subtitle:'回家，从这里开始', dimension:'公共过道净宽 1.03 m · 玄关宽 1.65 m',
    description:'入口保留轻薄收纳，过道连接卧室、书房与公共空间。夜间独立照明，减少行走时对睡眠区的打扰。',
    features:['薄型玄关柜','连续公共过道','独立灯光 · 清洁设备预留'],
    polygon:[[3.25,Z.upperSouth],[X.diningWest,Z.upperSouth],[X.diningWest,Z.kitchenSouth],[X.entranceEast,Z.kitchenSouth],[X.entranceEast,Z.entranceSouth],[X.livingEast,Z.entranceSouth],[X.livingEast,Z.studyNorth],[3.25,Z.studyNorth]],center:[8,4.2],spawn:[10.8,3.5],look:[7.8,4.4],color:'#b5ae9c' },
];
export const roomById = (id: string) => rooms.find(r => r.id === id);
export const WALL_HEIGHT = 2.7;
export const GLASS = { x:X.studyEast, z1:Z.studyNorth+1.30, z2:Z.studyNorth+2.77, sill:.42, top:2.36 };
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
