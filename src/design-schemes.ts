import { HOME_STYLE } from './style-palette';
import type { PanoramaId } from './panorama-data';

export type SchemeId = 'cream' | 'forest' | 'japanese' | 'french' | 'sunlit';
export interface MaterialSample { name:string; note:string; color:string; wood?:boolean }
export interface DesignScheme {
  id:SchemeId; name:string; english:string; eyebrow:string; title:[string,string]; introduction:[string,string];
  paletteLabel:string; materialIntro:string; samples:MaterialSample[];
  roomMaterials:Record<PanoramaId,string>; roomNotes:Partial<Record<PanoramaId,string>>;
  source?:{title:string;url:string};
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
  japanese:{
    id:'japanese',name:'现代日式中古风',english:'JAPANESE MID-CENTURY / 2026',eyebrow:'WALNUT · PAPER LIGHT · QUIET FORM',
    title:['旧时光，','新日常。'],introduction:['胡桃木的线条，纸灯的柔光。','留一点橄榄绿，让家慢慢呼吸。'],
    paletteLabel:'暖白 / 胡桃木 / 橄榄绿 / 陶土色',materialIntro:'以暖白留出呼吸感，胡桃木集中在低矮家具；橄榄绿、陶土色与手作陶器点出中古气息。',
    samples:[
      {name:'暖白墙面',note:'柔和哑光，保留空间亮度',color:'#eee9df'},
      {name:'中深胡桃木',note:'细直纹与温润棕色，低矮木作重点',color:'#79553d',wood:true},
      {name:'烟熏柚木地面',note:'中性暖棕，连续且低反光',color:'#a48968',wood:true},
      {name:'橄榄绿与陶土色',note:'在织物和小件上少量点缀',color:'#727960'},
    ],
    roomMaterials:{living:'胡桃木矮柜 · 几何地毯 · 纸灯与橄榄绿',dining:'胡桃木餐桌 · 编织餐椅 · 手作陶器',master:'低矮胡桃木床 · 亚麻床品 · 纸罩床灯',study:'柚木书桌 · 中古台灯 · 陶器与藏书',guest:'胡桃木低床 · 橄榄绿薄毯 · 几何织毯',kitchen:'暖白柜体 · 胡桃木下柜 · 陶器与香草',bathroom:'暖白石面 · 防潮胡桃木色柜门 · 柔光圆镜'},
    roomNotes:{living:'低矮木作与柔和灯光，让生活有自己的节奏。',dining:'一张胡桃木桌，容纳三餐与闲谈。',master:'木色沉下来，睡眠也慢下来。',study:'一盏灯、一本书，刚好够用。',guest:'简洁而有温度的留宿角落。',kitchen:'器物有秩序，做饭也从容。',bathroom:'木色与石感，收住日常的安静。'},
  },
  french:{
    id:'french',name:'轻法式复古原木风',english:'LIGHT FRENCH VINTAGE / 2026',eyebrow:'IVORY · HONEY OAK · SOFT VINTAGE',
    title:['把优雅，','过成日常。'],introduction:['浅木色和奶油白铺开明亮底色。','一点灰蓝与旧玫瑰，留住柔软。'],
    paletteLabel:'象牙白 / 蜂蜜橡木 / 灰蓝 / 旧玫瑰',materialIntro:'轻薄线条和浅蜂蜜木为主，复古图案、黄铜与灰蓝粉色只作为细节，保持明亮而不繁复。',
    samples:[
      {name:'象牙白墙面',note:'细腻墙面与克制的线条装饰',color:'#f2eee5'},
      {name:'蜂蜜橡木',note:'浅暖木色，家具带柔和曲线',color:'#c7a777',wood:true},
      {name:'浅原木地面',note:'柔和低色差，不偏橙黄',color:'#c4ad8b',wood:true},
      {name:'灰蓝与旧玫瑰',note:'靠垫、床品和花纹的轻点缀',color:'#8a9aa2'},
    ],
    roomMaterials:{living:'蜂蜜木电视柜 · 复古花纹地毯 · 灰蓝织物',dining:'浅木弧线餐桌 · 藤编椅 · 亚麻桌旗',master:'浅木床 · 象牙白亚麻 · 旧玫瑰床毯',study:'浅木写字桌 · 黄铜灯 · 小幅植物画',guest:'柔和木床 · 灰蓝靠垫 · 复古小花纹',kitchen:'象牙白柜体 · 浅木细节 · 陶器与黄铜',bathroom:'奶油石感 · 防潮浅木柜门 · 黄铜细节'},
    roomNotes:{living:'木色和旧物，让明亮空间更有故事。',dining:'花、陶器与木桌，把三餐摆得轻松。',master:'轻柔的织物，把一天安放下来。',study:'窗边写字，灯下读书。',guest:'带一点旧时光的温柔客房。',kitchen:'明亮餐厨里，也有顺手的小器物。',bathroom:'浅木、石面和柔光，简单地精致。'},
  },
  sunlit:{
    id:'sunlit',name:'日光花园原木',english:'SUNLIT GARDEN HOME / 2026',eyebrow:'PALE WOOD · STRIPES · LIVING GREEN',
    title:['让日光，','长成花园。'],introduction:['浅木、细条纹与窗边的绿。','把喜欢的器物，放进每一天。'],
    paletteLabel:'暖白 / 蜂蜜木 / 米白条纹 / 鲜叶绿',
    materialIntro:'参考「奥仔不吃奥利奥」的 89 平原木风 Room Tour：浅木边白台面、细条纹布艺、开放咖啡层板与窗边成组绿植。卧室加入偏深木色和柔粉织物；独立客房与卫浴为同风格延伸设计。色卡为方案示意，并非视频实测色号。',
    source:{title:'奥仔不吃奥利奥 · 89平原木风 Room Tour',url:'https://www.bilibili.com/video/BV1tm576NEwz/'},
    samples:[
      {name:'暖白与浅灰米墙面',note:'保持通透，日光下带柔和暖意',color:'#f1eee5'},
      {name:'浅蜂蜜木',note:'木框、层板与家具边缘形成暖色线条',color:'#c5a06a',wood:true},
      {name:'米白细条纹',note:'沙发与床品的轻纹理，搭少量柔粉色',color:'#e8e3d8'},
      {name:'窗边鲜叶绿',note:'高低植物架与蕨叶，集中在有光的位置',color:'#788c50'},
    ],
    roomMaterials:{living:'木边白台面 · 米白细条纹 · 窗边植物架',dining:'白柜木台面 · 开放杯架 · 咖啡与陶器',master:'偏深木色床与梳妆角 · 木百叶 · 柔粉薄毯',study:'木边书桌 · 书与器物 · 窗边垂叶',guest:'浅木低床 · 细条纹床品 · 小幅植物画',kitchen:'白色方砖 · 浅木下柜 · 通铺木色地面',bathroom:'浅木色防潮柜门 · 米白方砖 · 条纹毛巾'},
    roomNotes:{living:'把绿意留在窗边，把柔软留给日常。',dining:'杯子、咖啡和喜欢的小物，都有自己的位置。',master:'木百叶筛过日光，薄毯接住一天的疲惫。',study:'桌面留给工作，层板留给喜欢的事。',guest:'沿用浅木和细条纹，留一个温柔的房间。',kitchen:'明亮台面与顺手器物，让三餐从容。',bathroom:'将浅木、白砖与柔软织物延续到日常洗漱。'},
  },
};
export function schemeFromSearch(search:string):SchemeId {
  const value=new URLSearchParams(search).get('design');
  return value==='forest'||value==='japanese'||value==='french'||value==='sunlit'?value:'cream';
}
