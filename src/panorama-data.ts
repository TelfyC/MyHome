import type { SchemeId } from './design-schemes';

export type PanoramaId = 'living' | 'dining' | 'master' | 'study' | 'guest' | 'kitchen' | 'bathroom';
export interface PanoramaRoom { id: PanoramaId; name: string; english: string; note: string; material: string; links: PanoramaId[] }
export const panoramaRooms: PanoramaRoom[] = [
  { id:'living', name:'客厅', english:'LIVING', note:'低重心的家具，让生活慢下来。', material:'细纹中性橡木 · 棉麻 · 奶白墙面', links:['study','dining','master'] },
  { id:'dining', name:'餐厅与咖啡角', english:'DINING', note:'一张木桌，盛下三餐与日常。', material:'1.5 m 咖啡餐边柜 · 橡木餐桌 · 贯通通道', links:['living','kitchen','guest'] },
  { id:'master', name:'主卧与衣帽区', english:'MASTER', note:'减少装饰，留下安静与触感。', material:'低床 · 原木 · 燕麦色床品', links:['living','bathroom','guest'] },
  { id:'study', name:'电竞房', english:'GAMING', note:'面向主卧共墙，把游戏和喜欢的收藏安放好。', material:'靠主卧墙电竞桌 · 洞洞板 · 玻璃展示柜', links:['living','master'] },
  { id:'guest', name:'次卧 / 书房', english:'BEDROOM & STUDY', note:'左床右桌，让读书和休息各有位置。', material:'抽屉床 · 2.30 m 长桌 · 双侧壁挂书架', links:['dining','master','bathroom'] },
  { id:'kitchen', name:'可开合厨房', english:'KITCHEN', note:'餐厨相连，让做饭融入日常。', material:'角部冰箱高柜 · 洗切炒台面 · 开放餐厨', links:['dining','bathroom'] },
  { id:'bathroom', name:'卫生间', english:'BATH', note:'干净、克制，回到日常的舒适。', material:'洗衣与台盆共台 · 奶白柜体 · 灰米砖', links:['master','dining'] },
];
export const panoramaAsset = (id: PanoramaId, design:SchemeId='forest') => `${import.meta.env.BASE_URL}panoramas/${design}/${id}.jpg`;
export const panoramaThumbnail = (id:PanoramaId, design:SchemeId='forest') => `${import.meta.env.BASE_URL}panoramas/${design}/${id}-thumb.jpg`;
