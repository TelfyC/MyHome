import type { SchemeId } from './design-schemes';
import type { PanoramaId } from './panorama-data';

export const craftReferences:Record<SchemeId,{name:string;project:string;url:string;lesson:string;material:string}>={
 forest:{name:'Axel Vervoordt',project:'Living with Light',url:'https://www.axel-vervoordt.com/books/living-with-light',lesson:'学习自然材料与日光的平衡，以木纹、亚麻和矿物墙的层次组织空间。',material:'深樱桃木细门缝、内退底座、细织地毯、定向阅读灯与柔和苔绿。'},
 japanese:{name:'Norm Architects × 芦泽启治',project:'Kinuta Terrace',url:'https://normcph.com/project/kinuta-terrace/',lesson:'学习木作比例、材料衔接、光影与定制家具之间的整体关系。',material:'细木构件、胡桃木端面与小拉手、纸光、橄榄绿亚麻与克制的几何织物。'},
 french:{name:'Pierre Yovanovitch',project:'Architecture d’intérieur et Mobilier',url:'https://www.pierreyovanovitch.com/fr/',lesson:'学习家具比例、灯光和工艺，让细线条与柔和曲面适合日常居住。',material:'浅木细边、适度墙线、旧黄铜小五金、灰蓝与鼠尾草绿织物、低对比地毯。'},
 sunlit:{name:'Heju Studio',project:'République / Aumale',url:'https://www.heju.fr/projets/appartement-republique',lesson:'学习自然配色与有触感材料的相接，把日常器物组织成轻盈的生活角落。',material:'浅木包边与白台面、细条纹、局部柔绿、轻层板与窗边成组植物。'},
};
export const dailyPlacements:Record<PanoramaId,{title:string;text:string}[]>={
 living:[{title:'阅读位',text:'台灯、正在读的书和一只带杯垫的杯子放在座位伸手可及的边几上。'},{title:'茶几',text:'杯具集中在低托盘，旁边少量叠书；保留至少半张桌面。'},{title:'个人物件',text:'小幅照片、手作器皿和窗边植物分组陈列，以高低和颜色形成关系。'}],
 dining:[{title:'咖啡角',text:'机器和磨豆机共用托盘，杯具在旁边集中收纳，擦布与电线各有位置。'},{title:'日常餐桌',text:'亚麻桌旗、低果盘和两只常用杯形成一组，桌面留出吃饭的位置。'},{title:'小装饰',text:'餐边柜只留小相框或低花器，避免重复花瓶占满层板。'}],
 master:[{title:'床边',text:'读物、杯子和充电物件集中在小托盘；另一侧保留独立阅读灯和小相框。'},{title:'床品',text:'细条纹或素色靠垫与一条随手折好的薄毯搭配，层次柔软，便于整理。'},{title:'衣帽角',text:'小物碟、镜子与收起的脏衣篮围绕梳理和换衣布置。'}],
 study:[{title:'游戏桌面',text:'桌垫、杯垫与小笔记本各有固定位置，桌下集中收线，键鼠区留空。'},{title:'设备挂区',text:'耳机和手柄按使用频率挂在洞洞板，充电线靠墙走。'},{title:'收藏展示',text:'不同的玩偶、书和卡片疏密搭配，低亮度灯光照向收藏本身。'}],
 guest:[{title:'学习桌面',text:'灯、笔筒、笔记本和杯垫集中在桌端，电脑旁留一块完整工作面。'},{title:'读与睡',text:'绿色床品、细条纹靠垫、薄毯和读物呼应参考图，床边阅读灯独立使用。'},{title:'墙上与窗边',text:'书按高低分组，少量卡片与小相框保留个人感；窗台不堆满花盆。'}],
 kitchen:[{title:'备餐组',text:'砧板、两件常用工具与调味小托盘靠近备餐段，保留连续空台面。'},{title:'水槽组',text:'清洁用品收在小托盘里，毛巾挂在远离热源的柜侧。'},{title:'一点生活感',text:'原窗边一盆香草、小陶器和实用挂钩即可，地面与移门通路保持清楚。'}],
 bathroom:[{title:'洗漱组',text:'皂液和牙刷杯放在紧凑托盘里，洗衣机前和台盆周围留出使用面。'},{title:'织物',text:'手巾挂在伸手可及处，备用毛巾放入闭柜，低矮衣篮不占湿区通路。'},{title:'淋浴',text:'日常瓶罐集中在置物位，玻璃边缘、砖缝、排水和五金统一收口。'}],
};
export const roomViewAsset=(room:PanoramaId,style:SchemeId)=>`${import.meta.env.BASE_URL}room-views/${style}/${room}.jpg`;
export const roomViewThumbnail=(room:PanoramaId,style:SchemeId)=>`${import.meta.env.BASE_URL}room-views/${style}/${room}-thumb.jpg`;
