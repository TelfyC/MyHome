export type RoomId = 'living' | 'study' | 'master' | 'guest' | 'dining' | 'kitchen' | 'bathroom' | 'balcony' | 'entry';
export type Point = [number, number];
export interface Room {
  id: RoomId; name: string; english: string; icon: string; subtitle: string;
  description: string; features: string[]; dimension: string;
  polygon: Point[]; center: Point; spawn: Point; look: Point; color: string;
}
const rect = (x1: number, z1: number, x2: number, z2: number): Point[] => [[x1,z1],[x2,z1],[x2,z2],[x1,z2]];
export const rooms: Room[] = [
  { id:'living', name:'客厅', english:'LIVING ROOM', icon:'sofa', subtitle:'把中央，留给生活', dimension:'参考净宽 ≈ 3.30 m',
    description:'65 英寸电视与 1.80 m 木质矮柜移至左侧墙面中段，正对沙发。柜上摆放避开玻璃固定安装，屏幕会遮住景窗的一部分，借光面积相应减少。',
    features:['65 英寸电视 · 正对沙发','1.80 × 0.42 m 木质电视柜','中段摆放 · 部分遮挡景窗'],
    polygon:[[6.33,5.54],[9.74,5.54],[9.74,8.65],[8.4,8.65],[8.4,10.65],[6.33,10.65]],center:[8.1,7.5],spawn:[8.35,7.30],look:[6.72,7.28],color:'#bba68a' },
  { id:'study', name:'书房 / 客卧', english:'STUDY & GUEST', icon:'book-open', subtitle:'一扇景窗，让光相遇', dimension:'参考净宽 ≈ 2.75 m',
    description:'共享墙中段保留固定清玻璃，两端为实体承重段。双人桌靠原有外窗，高柜在上侧；客厅更新后的电视会遮住部分玻璃，隐私帘仍可收拢。',
    features:['1.70 × 0.58 m 双人书桌','固定中段景窗 · 原门进出','折叠客床 · 上侧 0.55 m 深柜'],
    polygon:rect(3.36,5.65,6.33,9.77),center:[4.85,7.8],spawn:[5.35,7.9],look:[6.33,7.5],color:'#97a88b' },
  { id:'master', name:'主卧 / 衣帽区', english:'MASTER BEDROOM', icon:'bed-double', subtitle:'安静而松弛的日常', dimension:'参考净宽 ≈ 3.25 m',
    description:'左下主卧延续完整睡眠区，入口段改为衣帽收纳。旧候选卫浴不再保留，以暖白柜体和浅木地板延续整体材质。',
    features:['1.80 m 床垫 · 燕麦织物','入口衣帽区 · 0.60 m 深衣柜','浅橡木地板 · 暖白墙面'],
    polygon:rect(-.11,4.31,3.36,10.76),center:[1.6,8.6],spawn:[2.65,7.25],look:[1.4,9.15],color:'#c8b69c' },
  { id:'guest', name:'客房 / 未来儿童房', english:'FUTURE KIDS ROOM', icon:'sprout', subtitle:'为未来，留一间完整的房', dimension:'参考净宽 ≈ 3.20 m',
    description:'左上房间保持独立实体边界，现阶段作为客房，未来可转换为儿童房，不通过拆墙为其他空间借光。',
    features:['1.50 m 床垫','独立房门 · 保留实体墙','书桌与低收纳 · 灵活转换'],
    polygon:rect(1.88,-.11,5.3,4.31),center:[3.5,2.2],spawn:[4.6,3.3],look:[3.4,1.5],color:'#b1b69a' },
  { id:'dining', name:'餐厅', english:'DINING ROOM', icon:'utensils', subtitle:'两个人，也认真吃饭', dimension:'参考净宽 ≈ 2.50 m',
    description:'木餐桌靠左布置，配一张长凳和两把活动椅。右侧保留从玄关通向阳台的主要通道。',
    features:['1.20 × 0.70 m 木餐桌','左侧长凳 · 右侧活动椅','独立餐桌吊灯'],
    polygon:rect(7.13,1.1,9.85,4.31),center:[8.45,2.7],spawn:[9.2,3.75],look:[8.0,2.5],color:'#c0a27e' },
  { id:'kitchen', name:'厨房', english:'KITCHEN', icon:'cooking-pot', subtitle:'封闭 L 形，高效而明亮', dimension:'参考尺度 ≈ 2.15 × 2.90 m',
    description:'保留封闭 L 形厨房，水槽沿上方窗布置，灶台在右侧，冰箱靠入口一侧，浅色柜体配易清洁台面。',
    features:['封闭 L 形工作台','暖白平板柜门','柜下工作照明'],
    polygon:rect(9.85,-.11,12.22,3.01),center:[11.0,1.5],spawn:[10.6,1.75],look:[11.9,1.0],color:'#a9b8b4' },
  { id:'bathroom', name:'卫生间', english:'BATHROOM', icon:'bath', subtitle:'中部独立，顺序清晰', dimension:'中央狭长区 · 尺度估算',
    description:'沿用中央卫生间：上端淋浴、中段马桶、下端浅台盆。入口朝向公共过道，排污与通风条件仍需深化。',
    features:['上淋浴 · 中马桶 · 下台盆','下端朝公共过道开门','灰米色防滑砖'],
    polygon:rect(5.3,-.11,7.13,4.31),center:[6.2,2.2],spawn:[6.55,2.9],look:[6.25,1.0],color:'#9cafa9' },
  { id:'balcony', name:'阳台', english:'UTILITY BALCONY', icon:'flower-2', subtitle:'家务之外，一点绿意', dimension:'餐厅上方 · 保留原开口',
    description:'餐厅上方阳台作为家政候选，布置洗烘设备与少量植物。设备所需的给排水与电路条件待现场核实。',
    features:['家政洗烘候选','少量绿植 · 保持透光','水电排污条件待核实'],
    polygon:rect(7.13,-.91,9.85,1.1),center:[8.6,.2],spawn:[8.75,.45],look:[8.5,-.8],color:'#8c9f78' },
  { id:'entry', name:'玄关 / 公共过道', english:'ENTRANCE', icon:'door-open', subtitle:'回家，从这里开始', dimension:'连接全屋的公共动线',
    description:'入口保留轻薄收纳，过道连接卧室、书房与公共空间。夜间独立照明，减少行走时对睡眠区的打扰。',
    features:['薄型玄关柜','连续公共过道','独立灯光 · 清洁设备预留'],
    polygon:[[3.25,4.31],[7.13,4.31],[7.13,3.01],[11.35,3.01],[11.35,6.2],[9.74,6.2],[9.74,5.65],[3.25,5.65]],center:[8,4.9],spawn:[10.6,4.9],look:[7.8,4.9],color:'#b5ae9c' },
];
export const roomById = (id: string) => rooms.find(r => r.id === id);
export const WALL_HEIGHT = 2.7;
export const GLASS = { x:6.33, z1:6.95, z2:8.42, sill:.42, top:2.36 };
export const outline: Point[] = [[-.11,4.31],[1.88,4.31],[1.88,-.11],[7.13,-.11],[7.13,-.91],[9.85,-.91],[9.85,-.11],[12.22,-.11],[12.22,3.01],[11.46,3.01],[11.46,6.31],[9.85,6.31],[9.85,8.76],[8.51,8.76],[8.51,10.76],[6.22,10.76],[6.22,9.88],[3.47,9.88],[3.47,10.76],[-.11,10.76]];
