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
    roomMaterials:{living:'深樱桃木电视柜 · 苔绿亚麻躺读椅 · 移动收纳脚凳',dining:'樱桃木餐桌与咖啡柜 · 苔绿亚麻 · 厨房围合通路',master:'深樱桃木低床 · 温润木饰面 · 苔绿床品',study:'原木电竞桌 · 洞洞板 · 深樱桃木玻璃柜',guest:'樱桃木抽屉床 · 苔绿床品 · 双侧书架与长桌',kitchen:'苔绿下柜 · 浅石色连续 L 台 · 燃气双眼灶与透明围合',bathroom:'洗衣台盆共台 · 樱桃木柜门 · 温润石感'},
    roomNotes:{living:'窗边坐读、伸腿，让放松也有位置。',dining:'咖啡留在餐边，厨房通路保持清楚。',master:'像林中小屋一样，安静地休息。',study:'桌靠主卧共墙，林间木色里也有自己的游戏角。',guest:'左床右桌，绿意与书页一起陪伴日常。',kitchen:'北侧洗炒，L 形台面接住备餐与储物。',bathroom:'石、木与柔光，照顾日常。'},
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
    roomMaterials:{living:'胡桃木矮柜 · 橄榄绿躺读椅 · 胡桃木收纳脚凳',dining:'胡桃木餐桌 · 编织餐椅 · 清楚的餐厨通路',master:'低矮胡桃木床 · 亚麻床品 · 纸罩床灯',study:'胡桃木电竞桌 · 洞洞板 · 中古玻璃柜',guest:'胡桃木抽屉床 · 橄榄绿亚麻 · 壁挂书架与长桌',kitchen:'胡桃木下柜 · 暖白连续 L 台 · 燃气双眼灶与透明围合',bathroom:'暖白石面 · 防潮胡桃木色柜门 · 柔光圆镜'},
    roomNotes:{living:'胡桃木与柔光之间，留一处能伸腿的座位。',dining:'三餐与咖啡各有位置，餐厨之间留路。',master:'木色沉下来，睡眠也慢下来。',study:'桌靠主卧共墙，低调设备与中古木色相伴。',guest:'一张收纳床、一面长桌，安静地住与读。',kitchen:'洗炒留在北侧，备餐与器物连成 L。',bathroom:'木色与石感，收住日常的安静。'},
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
    roomMaterials:{living:'蜂蜜木电视柜 · 灰蓝躺读椅 · 浅木收纳脚凳',dining:'浅木餐桌 · 藤编椅 · 亚麻与清楚的餐厨通路',master:'浅木床 · 象牙白亚麻 · 旧玫瑰床毯',study:'浅木电竞桌 · 象牙白洞洞板 · 黄铜玻璃柜',guest:'蜂蜜橡木抽屉床 · 鼠尾草绿 · 黄铜壁灯与长桌',kitchen:'浅木细框柜门 · 象牙白连续 L 台 · 燃气灶与透明围合',bathroom:'奶油石感 · 防潮浅木柜门 · 黄铜细节'},
    roomNotes:{living:'灰蓝软椅与脚凳，把窗光留给坐读。',dining:'木桌与陶器照顾三餐，门边通路留空。',master:'轻柔的织物，把一天安放下来。',study:'桌靠主卧共墙，暖灯照亮游戏与收藏。',guest:'鼠尾草绿与浅木，把读书和休息放在一起。',kitchen:'浅木与石面相接，备餐、燃气烹饪各有位置。',bathroom:'浅木、石面和柔光，简单地精致。'},
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
    roomMaterials:{living:'木边白台面 · 米白条纹躺读椅 · 浅木收纳脚凳',dining:'白柜木台面 · 开放杯架 · 咖啡角与餐厨通路',master:'偏深木色床与梳妆角 · 木百叶 · 柔粉薄毯',study:'木边白电竞桌 · 木色洞洞板 · 玻璃收藏柜',guest:'浅木抽屉床 · 绿白细条纹 · 双侧书架与长桌',kitchen:'白色方砖 · 浅木下柜与白色连续 L 台 · 燃气灶围合',bathroom:'浅木色防潮柜门 · 米白方砖 · 条纹毛巾'},
    roomNotes:{living:'窗边一把软椅、一点绿，留给读书与伸腿。',dining:'杯具收在餐边，三餐与厨房通路都从容。',master:'木百叶筛过日光，薄毯接住一天的疲惫。',study:'桌靠主卧共墙，绿意在窗边，玩偶在玻璃柜里。',guest:'绿白条纹、窗光与长桌，留给一个人的日常。',kitchen:'白色 L 台留空，洗炒、备餐与储物各就位。',bathroom:'将浅木、白砖与柔软织物延续到日常洗漱。'},
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
  living:['电视、沙发及原外窗保持。电视左窗边拟放约 75–82 cm 宽、85–90 cm 深的躺读椅，配约 45 × 40 cm 移动收纳脚凳；主通路目标约 85–90 cm，均为拟定尺度。','一盏定向阅读灯照向书页，边几约 32 cm；椅背与收拢帘布之间拟留 15–20 cm，保留原窗开启与帘布行程。','脚凳用时移出承托双脚，收回时靠椅；书、薄毯入凳，杯子落边几。只留一处窄植物，不再用大盆栽占满放松位。'],
  dining:['沿用约 1.20 × 0.70 m 餐桌、西侧长凳与两端餐椅布置；椅子收回时餐厨主通路目标约 85–90 cm，拉椅就座时需让行，尺寸待复测。','餐桌照明、咖啡台工作光与厨房照明分开；南侧玻璃门组拟向左叠收，门片、餐椅及人行范围一起复核。','咖啡机和磨豆机留在现方案拟定约 1.50 m 餐边台，杯具就近入柜；燃气烹饪、米面储物和主备餐留在可完整围合的厨房。'],
  master:['保留 1.80 m 床，衣帽区用通高闭柜、内置脏衣位与柜面镜；两侧留顺手床边置物。','床边各有独立阅读灯，遮光帘与纱帘分开使用，避免整屋泛黄。','床品用细织亚麻和小比例毯子区分触感，床边充电与走线集中，画作只留一处重点。'],
  study:['1.80 × 0.75 m 电竞桌沿主卧共墙，座椅面向墙；北侧玻璃移门柜放收藏，椅后通路留空。','屏幕后柔光与桌面工作灯分开；展示柜低亮补光，不用彩色灯带淹没房间。','洞洞板挂耳机和手柄；桌下电源、信号双槽理线，一侧落线；吸音织物只做局部。'],
  guest:['左侧 1.20 × 2.10 m 抽屉床，配 1.20 × 2.00 m 床垫；右侧 2.30 × 0.65 m 长桌，中央约 1.18 m（未计椅子）。','保留原北窗与绿色窗帘，床边阅读灯和书桌工作灯独立；不增开侧窗，不复制参考图的大窗和结构木梁。','两侧 22 cm 深壁挂书架；床上方层板抬高，窗边留空；西南端设衣柜，门口和中央通路保持清楚。'],
  kitchen:['沿用约 3.10 × 2.44 m 围合边界、原窗及东北约 70 cm 冰箱机位。北侧拟定 230 cm 洗炒线设双眼燃气灶、烟机与原窗下单槽；东侧原约 85 cm 短台不向冰箱加长，起点仍避开开门及抽屉投影。','双眼灶与烟机留在北侧原实墙段，保留原窗通风并规划独立排烟；窗与玻璃前不加上柜。热源与窗、器具、供气接口和工作照明按实选设备及现场条件深化。','东侧约 85 cm 短台与新增南侧约 135 × 55 cm 低备餐柜连成 L，同拟定约 88 cm 高、石面连续、踢脚和抽屉线对齐；替代孤立矮柜及笨重上柜，转角结构与开启关系须深化。'],
  bathroom:['60 cm 标准洗衣机与台盆共用 1.48 m 台面，保留约 0.94 m 通道；淋浴、马桶位置保留。','镜前工作灯与基础光分开，小窗用隐私卷帘，毛巾钩放在伸手能到的位置。','柜门采用防潮构造的木色表面，台面靠墙密封；淋浴屏、排水与砖缝对齐，收纳尽量闭合。'],
 };
 const [layout,lighting,finish]=notes[room];
 const details=[{title:'布局与收纳',text:layout},{title:'材料与配色',text:designSchemes[scheme].roomMaterials[room]},{title:'灯光与窗帘',text:lighting},{title:'使用与收口',text:finish}];
 if(room==='living')details.push({title:'拟定尺度与使用',text:'家具尺寸、帘布余量及通路目标均为布置建议，需用实物样板与现场复测核对。当前粗三维模型未同步放松区，只能参考原始边界。'});
 if(room==='kitchen')details.push(
  {title:'主备餐与器具',text:'南侧拟定 135 cm 台面至少留约 110 cm 连续备餐面；电饭煲放东侧短台，取电与蒸汽避让另行深化。灶下放锅具但保留燃气检修，水槽下分清洁与垃圾，冰箱顶只收偶用器。'},
  {title:'下柜分工',text:'南台下柜按约 60 / 45 / 30 cm 拟分餐具深抽、米面干货和瓶罐；L 角共享柜体，转角机构、抽屉可开启范围与净储物尺寸待深化，不能按三只独立成品柜直接下单。'},
  {title:'围合与通路',text:'南侧相邻原活动玻璃约 50 cm 拟改固定低围合，与原回墙共同构成备餐台后的固定界面，台面以上用固定清玻璃。其余南侧四扇向左叠收，目标净开口约 125–130 cm；西侧五扇保留可闭。对向台面净距按 244 − 60 − 55 = 129 cm 估算，均为拟定值。'},
  {title:'台面与深化状态',text:'扣除 L 角重复投影后，台面由约 1.89 ㎡增至 2.30 ㎡，约增加 22%。按可完整围合、通风及独立排烟方案深化；柜体、门组、器具、燃气接口和窗侧热源间距均待现场复核。原始尺寸模型未同步本轮柜体与门组，仅作边界参考。'},
 );
 return details;
}
