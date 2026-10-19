export type PanoramaId = 'living' | 'dining' | 'master' | 'study' | 'guest' | 'kitchen' | 'bathroom';
export interface PanoramaRoom { id: PanoramaId; name: string; english: string; note: string; material: string; links: PanoramaId[] }
export const panoramaRooms: PanoramaRoom[] = [
  { id:'living', name:'客厅', english:'LIVING', note:'低重心的家具，让生活慢下来。', material:'自然橡木 · 棉麻沙发 · 暖白墙面', links:['study','dining','master'] },
  { id:'dining', name:'餐厅与阳台', english:'DINING', note:'一张木桌，盛下三餐与日常。', material:'橡木餐桌 · 亚麻 · 柔和自然光', links:['living','kitchen','guest'] },
  { id:'master', name:'主卧与衣帽区', english:'MASTER', note:'减少装饰，留下安静与触感。', material:'低床 · 原木 · 燕麦色床品', links:['living','bathroom','guest'] },
  { id:'study', name:'书房兼客卧', english:'STUDY', note:'阅读、工作，也为偶尔的留宿留白。', material:'橡木书桌 · 隐私帘 · 浅色收纳', links:['living','master'] },
  { id:'guest', name:'客房', english:'GUEST', note:'可生长的空间，为未来留一点余地。', material:'浅木家具 · 米白织物 · 低收纳', links:['dining','master','bathroom'] },
  { id:'kitchen', name:'厨房', english:'KITCHEN', note:'让每一处收纳，都服务于一餐。', material:'暖白平板柜 · 浅色台面 · 局部橡木', links:['dining','bathroom'] },
  { id:'bathroom', name:'卫生间', english:'BATH', note:'干净、克制，回到日常的舒适。', material:'哑光灰米砖 · 木色浴室柜 · 柔光', links:['master','dining'] },
];
export const panoramaAsset = (id: PanoramaId) => `${import.meta.env.BASE_URL}panoramas/${id}.jpg`;
