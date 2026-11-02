import type { SchemeId } from './design-schemes';
import type { PanoramaId } from './panorama-data';

export const craftReferences:Record<SchemeId,{name:string;project:string;url:string;lesson:string;material:string}>={
 forest:{name:'Axel Vervoordt',project:'Living with Light',url:'https://www.axel-vervoordt.com/books/living-with-light',lesson:'学习自然材料与日光的平衡，以木纹、亚麻和矿物墙的层次组织空间。',material:'深樱桃木细木作、苔绿亚麻躺读椅与定向灯；苔绿厨房下柜接浅石色连续台面。'},
 japanese:{name:'Norm Architects × 芦泽启治',project:'Kinuta Terrace',url:'https://normcph.com/project/kinuta-terrace/',lesson:'学习木作比例、材料衔接、光影与定制家具之间的整体关系。',material:'胡桃木细构件与低柜、橄榄绿亚麻躺读椅、纸光；厨房接暖白石面与克制的小五金。'},
 french:{name:'Pierre Yovanovitch',project:'Architecture d’intérieur et Mobilier',url:'https://www.pierreyovanovitch.com/fr/',lesson:'学习家具比例、灯光和工艺，让细线条与柔和曲面适合日常居住。',material:'蜂蜜浅木细边、灰蓝躺读椅、旧黄铜小五金；厨房用浅木细框与象牙白连续石面。'},
 sunlit:{name:'Heju Studio',project:'République / Aumale',url:'https://www.heju.fr/projets/appartement-republique',lesson:'学习自然配色与有触感材料的相接，把日常器物组织成轻盈的生活角落。',material:'浅木包边与白台面、米白条纹躺读椅、局部柔绿；窗边留一窄植物，厨房延续白砖与浅木。'},
};
export const dailyPlacements:Record<PanoramaId,{title:string;text:string}[]>={
 living:[{title:'坐读与伸腿',text:'电视左窗边拟放约 75–82 cm 宽、85–90 cm 深的躺读椅，配约 45 × 40 cm 移动收纳脚凳；电视、沙发和原外窗保持。'},{title:'顺手收纳',text:'薄毯与书收在脚凳，约 32 cm 边几放一杯水和正在读的书，定向灯照书页；仅留一处窄植物。以上为拟定家具尺度。'},{title:'窗帘与通路',text:'椅背与收拢帘布拟留约 15–20 cm，主通路目标约 85–90 cm；脚凳收回靠椅，窗扇与帘布行程需现场复核。'}],
 dining:[{title:'咖啡角',text:'机器和磨豆机共用餐边托盘，杯具就近入柜；电饭煲与中式备餐转入厨房，不把餐边台继续堆成第二个灶台。'},{title:'日常餐桌',text:'西侧长凳与两端餐椅沿用；椅子收回时主通路目标约 85–90 cm，拉椅与南侧向左叠收的门组一起核对。目标尺寸均待现场复测。'},{title:'与厨房相接',text:'餐桌只留低果盘与少量常用杯，通往可围合厨房的路径留空，咖啡、吃饭、洗炒各有明确位置。'}],
 master:[{title:'床边',text:'读物、杯子和充电物件集中在小托盘；另一侧保留独立阅读灯和小相框。'},{title:'床品',text:'细条纹或素色靠垫与一条随手折好的薄毯搭配，层次柔软，便于整理。'},{title:'衣帽角',text:'小物碟、镜子与收起的脏衣篮围绕梳理和换衣布置。'}],
 study:[{title:'游戏桌面',text:'桌垫、杯垫与小笔记本各有固定位置，桌下集中收线，键鼠区留空。'},{title:'设备挂区',text:'耳机和手柄按使用频率挂在洞洞板，充电线靠墙走。'},{title:'收藏展示',text:'不同的玩偶、书和卡片疏密搭配，低亮度灯光照向收藏本身。'}],
 guest:[{title:'学习桌面',text:'灯、笔筒、笔记本和杯垫集中在桌端，电脑旁留一块完整工作面。'},{title:'读与睡',text:'绿色床品、细条纹靠垫、薄毯和读物呼应参考图，床边阅读灯独立使用。'},{title:'墙上与窗边',text:'书按高低分组，少量卡片与小相框保留个人感；窗台不堆满花盆。'}],
 kitchen:[{title:'主备餐台',text:'南侧新增约 135 × 55 cm 低柜，与原东侧约 85 cm 短台接成同高 L 台，至少留约 110 cm 连续备餐面。约 88 cm 台高及全部柜体尺寸均为拟定。'},{title:'餐具与干货',text:'约 60 / 45 / 30 cm 拟分餐具深抽、米面干货与瓶罐；L 角共享空间，抽屉、转角机构和净储物尺寸需深化，避免把转角算两次。'},{title:'家电与洗炒',text:'电饭煲放东短台；北侧双眼燃气灶配烟机，原窗下保留单槽。灶下锅具不封检修，水槽下分清洁和垃圾；窗、玻璃前不加上柜，冰箱顶可放偶用器。'}],
 bathroom:[{title:'洗漱组',text:'皂液和牙刷杯放在紧凑托盘里，洗衣机前和台盆周围留出使用面。'},{title:'织物',text:'手巾挂在伸手可及处，备用毛巾放入闭柜，低矮衣篮不占湿区通路。'},{title:'淋浴',text:'日常瓶罐集中在置物位，玻璃边缘、砖缝、排水和五金统一收口。'}],
};
export const roomViewAsset=(room:PanoramaId,style:SchemeId)=>`${import.meta.env.BASE_URL}room-views/${style}/${room}.jpg`;
export const roomViewThumbnail=(room:PanoramaId,style:SchemeId)=>`${import.meta.env.BASE_URL}room-views/${style}/${room}-thumb.jpg`;
