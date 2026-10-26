import type { PanoramaId } from './panorama-data';

export type SchemeId = 'forest' | 'japanese' | 'french' | 'sunlit';
export interface MaterialSample { name:string; note:string; color:string; wood?:boolean }
export interface DesignScheme {
  id:SchemeId; name:string; english:string; eyebrow:string; title:[string,string]; introduction:[string,string];
  paletteLabel:string; materialIntro:string; samples:MaterialSample[];
  roomMaterials:Record<PanoramaId,string>; roomNotes:Partial<Record<PanoramaId,string>>;
  source?:{title:string;url:string};
}
export const designSchemes:Record<SchemeId,DesignScheme> = {
  forest:{
    id:'forest',name:'林中树屋',english:'WOODLAND RETREAT / 2026',eyebrow:'WOOD · LEAVES · A SLOWER LIFE',
    title:['像住进，','一片树林。'],introduction:['木的纹理，叶的层次。','深色樱桃木，收住一室温暖。'],
    paletteLabel:'自然木 / 深樱桃木 / 苔绿 / 亚麻',materialIntro:'浅灰米矿物墙面保留日光，深樱桃木落在床、矮柜和桌面；苔绿亚麻与局部木作形成层次，减少整墙格栅和满顶黄木。',
    samples:[
      {name:'浅灰米矿物感墙面',note:'保留明亮底色，局部自然木饰面',color:'#ded9cd'},
      {name:'深色樱桃木',note:'温润深红棕，哑光，少量重点家具',color:'#683e31',wood:true},
      {name:'自然棕原木',note:'细腻木纹，餐厨地面连续',color:'#ae9574',wood:true},
      {name:'苔绿与本色亚麻',note:'用织物和绿植增加林间层次',color:'#697451'},
    ],
    roomMaterials:{living:'深樱桃木电视柜 · 自然木作 · 伞叶榕与蕨叶',dining:'樱桃木餐桌与咖啡柜 · 层板垂叶 · 苔绿亚麻',master:'深樱桃木低床 · 温润木饰面 · 苔绿床品',study:'原木电竞桌 · 洞洞板 · 深樱桃木玻璃柜',guest:'樱桃木抽屉床 · 苔绿床品 · 双侧书架与长桌',kitchen:'苔绿下柜 · 2.30 m 台面 · 顶吊叠收玻璃门',bathroom:'洗衣台盆共台 · 樱桃木柜门 · 温润石感'},
    roomNotes:{living:'在木纹与叶影之间，把日子慢下来。',dining:'咖啡香、木桌与一片垂落的绿。',master:'像林中小屋一样，安静地休息。',study:'桌靠主卧共墙，林间木色里也有自己的游戏角。',guest:'左床右桌，绿意与书页一起陪伴日常。',kitchen:'餐厨相连，也与绿意相望。',bathroom:'石、木与柔光，照顾日常。'},
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
    roomMaterials:{living:'胡桃木矮柜 · 几何地毯 · 纸灯与橄榄绿',dining:'胡桃木餐桌 · 编织餐椅 · 手作陶器',master:'低矮胡桃木床 · 亚麻床品 · 纸罩床灯',study:'胡桃木电竞桌 · 洞洞板 · 中古玻璃柜',guest:'胡桃木抽屉床 · 橄榄绿亚麻 · 壁挂书架与长桌',kitchen:'胡桃木下柜 · 2.30 m 台面 · 顶吊叠收玻璃门',bathroom:'暖白石面 · 防潮胡桃木色柜门 · 柔光圆镜'},
    roomNotes:{living:'低矮木作与柔和灯光，让生活有自己的节奏。',dining:'一张胡桃木桌，容纳三餐与闲谈。',master:'木色沉下来，睡眠也慢下来。',study:'桌靠主卧共墙，低调设备与中古木色相伴。',guest:'一张收纳床、一面长桌，安静地住与读。',kitchen:'器物有秩序，做饭也从容。',bathroom:'木色与石感，收住日常的安静。'},
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
    roomMaterials:{living:'蜂蜜木电视柜 · 复古花纹地毯 · 灰蓝织物',dining:'浅木弧线餐桌 · 藤编椅 · 亚麻桌旗',master:'浅木床 · 象牙白亚麻 · 旧玫瑰床毯',study:'浅木电竞桌 · 象牙白洞洞板 · 黄铜玻璃柜',guest:'蜂蜜橡木抽屉床 · 鼠尾草绿 · 黄铜壁灯与长桌',kitchen:'浅木细框柜门 · 2.30 m 台面 · 顶吊叠收玻璃门',bathroom:'奶油石感 · 防潮浅木柜门 · 黄铜细节'},
    roomNotes:{living:'木色和旧物，让明亮空间更有故事。',dining:'花、陶器与木桌，把三餐摆得轻松。',master:'轻柔的织物，把一天安放下来。',study:'桌靠主卧共墙，暖灯照亮游戏与收藏。',guest:'鼠尾草绿与浅木，把读书和休息放在一起。',kitchen:'明亮餐厨里，也有顺手的小器物。',bathroom:'浅木、石面和柔光，简单地精致。'},
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
    roomMaterials:{living:'木边白台面 · 米白细条纹 · 窗边植物架',dining:'白柜木台面 · 开放杯架 · 咖啡与陶器',master:'偏深木色床与梳妆角 · 木百叶 · 柔粉薄毯',study:'木边白电竞桌 · 木色洞洞板 · 玻璃收藏柜',guest:'浅木抽屉床 · 绿白细条纹 · 双侧书架与长桌',kitchen:'白色方砖 · 浅木下柜 · 顶吊叠收玻璃门',bathroom:'浅木色防潮柜门 · 米白方砖 · 条纹毛巾'},
    roomNotes:{living:'把绿意留在窗边，把柔软留给日常。',dining:'杯子、咖啡和喜欢的小物，都有自己的位置。',master:'木百叶筛过日光，薄毯接住一天的疲惫。',study:'桌靠主卧共墙，绿意在窗边，玩偶在玻璃柜里。',guest:'绿白条纹、窗光与长桌，留给一个人的日常。',kitchen:'明亮台面与顺手器物，让三餐从容。',bathroom:'将浅木、白砖与柔软织物延续到日常洗漱。'},
  },
};
export function schemeFromSearch(search:string):SchemeId {
  const value=new URLSearchParams(search).get('design');
  return value==='forest'||value==='japanese'||value==='french'||value==='sunlit'?value:'forest';
}

// Colour references for the measured model; photographic panoramas have their own lighting.
export const modelPalettes:Record<SchemeId,{wall:string;ceiling:string;cabinet:string;wood:string;edge:string;accent:string;fabric:string;metal:string;floorTint:string}>={
 forest:{wall:'#ded9cd',ceiling:'#eeeae1',cabinet:'#d3d0c3',wood:'#795344',edge:'#664737',accent:'#7d896c',fabric:'#ded8c8',metal:'#8c7a60',floorTint:'#efeee7'},
 japanese:{wall:'#e5e1d7',ceiling:'#f0ede5',cabinet:'#dad6ca',wood:'#79553d',edge:'#5c412f',accent:'#727960',fabric:'#dbd4c4',metal:'#8b7c65',floorTint:'#ebe6df'},
 french:{wall:'#eee9e1',ceiling:'#f5f1e8',cabinet:'#e7e1d6',wood:'#c2a275',edge:'#a58a63',accent:'#8b9b91',fabric:'#e4dfd4',metal:'#af9568',floorTint:'#fff8ef'},
 sunlit:{wall:'#eae8de',ceiling:'#f4f1e8',cabinet:'#edeae2',wood:'#bf9e6b',edge:'#a18458',accent:'#8b9e76',fabric:'#e5e0d2',metal:'#a08e71',floorTint:'#fffbf0'},
};
export const designReference={name:'Ilse Crawford / Studioilse',url:'https://www.studioilse.com/work/homes/',note:'根据公开住宅理念形成的本项目细化方法：从日常活动出发，处理收纳、触感、灯光与收口。此方案由本项目整理与生成。'};
export function roomDesignDetails(scheme:SchemeId,room:PanoramaId) {
 const notes:Record<PanoramaId,[string,string,string]>={
  living:['电视居中正对沙发，矮柜闭合收纳与一格开放书位并用；入户至餐厅主路留空。','阅读灯照向座位，窗帘贴顶安装并收到窗侧，保留自然光。','矮柜内退踢脚、细缝抽屉与隐藏走线；地毯边缘压在沙发前脚下，减少零散小件。'],
  dining:['1.20 × 0.70 m 餐桌左侧长凳，两椅放桌子两端；东侧留约 0.90 m 静态通路。','餐桌吊灯集中照桌面，咖啡层板下设工作光；窗帘收起后不遮通路。','1.50 m 咖啡台用托盘集中机器和磨豆机，杯架轻量化，下柜闭合收纳，插座靠墙归整。'],
  master:['保留 1.80 m 床，衣帽区用通高闭柜、内置脏衣位与柜面镜；两侧留顺手床边置物。','床边各有独立阅读灯，遮光帘与纱帘分开使用，避免整屋泛黄。','床品用细织亚麻和小比例毯子区分触感，床边充电与走线集中，画作只留一处重点。'],
  study:['1.80 × 0.75 m 电竞桌沿主卧共墙，座椅面向墙；北侧玻璃移门柜放收藏，椅后通路留空。','屏幕后柔光与桌面工作灯分开；展示柜低亮补光，不用彩色灯带淹没房间。','洞洞板挂耳机和手柄；桌下电源、信号双槽理线，一侧落线；吸音织物只做局部。'],
  guest:['左侧 1.20 × 2.10 m 抽屉床，配 1.20 × 2.00 m 床垫；右侧 2.30 × 0.65 m 长桌，中央约 1.18 m（未计椅子）。','保留原北窗与绿色窗帘，床边阅读灯和书桌工作灯独立；不增开侧窗，不复制参考图的大窗和结构木梁。','两侧 22 cm 深壁挂书架；床上方层板抬高，窗边留空；西南端设衣柜，门口和中央通路保持清楚。'],
  kitchen:['向餐厅外移约 50 cm，围合主区约 7.6 ㎡；2.30 m 北侧台面与 0.85 m 东侧辅助台，冰箱在东北角。','灶与烟罩落在原北墙实体段，台面工作光分区；窗前用短卷帘。','两组顶部吊轨透明玻璃，五扇收窗边、四扇收右端；地面无连续下轨、转角无落地柱，台面端头和背板留细收口。'],
  bathroom:['60 cm 标准洗衣机与台盆共用 1.48 m 台面，保留约 0.94 m 通道；淋浴、马桶位置保留。','镜前工作灯与基础光分开，小窗用隐私卷帘，毛巾钩放在伸手能到的位置。','柜门采用防潮构造的木色表面，台面靠墙密封；淋浴屏、排水与砖缝对齐，收纳尽量闭合。'],
 };
 const [layout,lighting,finish]=notes[room];
 return [{title:'布局与收纳',text:layout},{title:'材料与配色',text:designSchemes[scheme].roomMaterials[room]},{title:'灯光与窗帘',text:lighting},{title:'使用与收口',text:finish}];
}
