import { HOME_STYLE } from './style-palette';
import type { PanoramaId } from './panorama-data';

export type SchemeId = 'cream' | 'forest';
export interface MaterialSample { name:string; note:string; color:string; wood?:boolean }
export interface DesignScheme {
  id:SchemeId; name:string; english:string; eyebrow:string; title:[string,string]; introduction:[string,string];
  paletteLabel:string; materialIntro:string; samples:MaterialSample[];
  roomMaterials:Record<PanoramaId,string>; roomNotes:Partial<Record<PanoramaId,string>>;
}
export const designSchemes:Record<SchemeId,DesignScheme> = {
  cream:{
    id:'cream',name:'奶白原木',english:'MUJI INSPIRED / 2026',eyebrow:'NATURAL · SIMPLE · EVERYDAY',
    title:['把生活，','还给日常。'],introduction:['原木的温度，棉麻的触感。','在简单的空间里，慢慢住下来。'],
    paletteLabel:'奶白 / 细纹橡木 / 棉麻 / 一点绿',materialIntro:'这一版用柔和中性日光看色，减少暖黄灯与夕阳染色。',
    samples:[
      {name:'奶白墙面',note:'细腻哑光，微暖、不泛黄',color:HOME_STYLE.wall},
      {name:'中性细纹橡木',note:'低黄低红，细纹、无亮漆',color:HOME_STYLE.cherry,wood:true},
      {name:'灰棕木纹地面',note:'餐厨一体通铺，柔光、低色差',color:HOME_STYLE.floor.swatch,wood:true},
      {name:'本色棉麻',note:'米白与浅燕麦色织物',color:HOME_STYLE.linen},
    ],
    roomMaterials:{living:'细纹中性橡木 · 棉麻 · 奶白墙面',dining:'1.5 m 咖啡餐边柜 · 橡木餐桌 · 贯通通道',master:'低床 · 原木 · 燕麦色床品',study:'橡木书桌 · 完整实墙 · 浅色收纳',guest:'浅木家具 · 米白织物 · 低收纳',kitchen:'角部冰箱高柜 · 洗切炒台面 · 开放餐厨',bathroom:'洗衣与台盆共台 · 奶白柜体 · 灰米砖'},roomNotes:{},
  },
  forest:{
    id:'forest',name:'林中树屋',english:'WOODLAND RETREAT / 2026',eyebrow:'WOOD · LEAVES · A SLOWER LIFE',
    title:['像住进，','一片树林。'],introduction:['木的纹理，叶的层次。','深色樱桃木，收住一室温暖。'],
    paletteLabel:'自然木 / 深樱桃木 / 苔绿 / 亚麻',materialIntro:'自然木作铺开背景，深色樱桃木只落在少量主家具上；苔绿织物与蕨叶形成林下层次。',
    samples:[
      {name:'奶油白矿物感墙面',note:'保留明亮底色，局部自然木饰面',color:'#eee7d8'},
      {name:'深色樱桃木',note:'温润深红棕，哑光，少量重点家具',color:'#683e31',wood:true},
      {name:'自然棕原木',note:'细腻木纹，餐厨地面连续',color:'#ae9574',wood:true},
      {name:'苔绿与本色亚麻',note:'用织物和绿植增加林间层次',color:'#697451'},
    ],
    roomMaterials:{living:'深樱桃木电视柜 · 自然木作 · 伞叶榕与蕨叶',dining:'樱桃木餐桌与咖啡柜 · 层板垂叶 · 苔绿亚麻',master:'深樱桃木低床 · 温润木饰面 · 苔绿床品',study:'原木书桌 · 樱桃木小柜 · 窗边垂叶',guest:'木质低床 · 浅亚麻 · 窗边一盆蕨',kitchen:'原木与奶油白柜体 · 角部冰箱 · 林间餐厨',bathroom:'洗衣台盆共台 · 樱桃木柜门 · 温润石感'},
    roomNotes:{living:'在木纹与叶影之间，把日子慢下来。',dining:'咖啡香、木桌与一片垂落的绿。',master:'像林中小屋一样，安静地休息。',study:'把窗边的一角，留给阅读。',guest:'木与亚麻，接住一夜好眠。',kitchen:'餐厨相连，也与绿意相望。',bathroom:'石、木与柔光，照顾日常。'},
  },
};
export function schemeFromSearch(search:string):SchemeId {return new URLSearchParams(search).get('design')==='forest'?'forest':'cream';}
