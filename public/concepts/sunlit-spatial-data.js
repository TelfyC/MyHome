window.sunlitSpatial = {
  date: '2026-11-02',
  name: '日光花园 · 户型与摆位校正',
  base: 'spatial/sunlit/',
  plan: 'spatial/sunlit/references/plan.png',
  rooms: [
    {id:'living', parent:'living', name:'客厅', en:'LIVING', camera:'L01', summary:'电视与沙发相对，窗边阅读位落在南端收窄区；保留玄关回折与客厅下端的真实轮廓。', details:['电视靠电竞房共用的实墙，沙发在对面，不恢复旧玻璃景窗。','图纸右侧先从玄关退回客厅，再向南端收窄，不能拉成矩形大厅。','阅读椅、收纳脚凳和深木边几放在电视左侧窗边，通路留在家具外。']},
    {id:'dining', parent:'dining', name:'餐厅与咖啡角', en:'DINING & COFFEE', camera:'D01', summary:'把深木餐桌放回紧凑餐区：西侧长凳、两端座椅，咖啡柜靠西墙北段。', details:['餐桌按 1.20 × 0.70 m 布置，长向随图纸上下方向；厨房侧不加座椅。','餐厅与原阳台合计进深 3.45 m，北窗与窗右侧收门区域保留。','咖啡柜在西墙，面向厨房方向；不会把它移到整面北窗下面。']},
    {id:'master', parent:'master', name:'主卧与衣帽区', en:'MASTER BEDROOM', camera:'M01', summary:'睡眠区与入口衣帽区分开组织，保留入口退台和南端原窗。', details:['入口衣帽区东边有回折，主卧并非从头到尾同宽的长方形。','西侧为实墙，窗位只使用原南端外窗，不补出侧窗。','深木床组位于睡眠区，闭合通高柜与梳理位置放在北侧衣帽区。']},
    {id:'study', parent:'study', name:'电竞房', en:'GAMING & COLLECTION', camera:'S01', summary:'桌子靠主卧共墙，坐下朝西；收藏柜与原门、原窗各守其位。', details:['1.80 × 0.75 m 桌面沿西墙摆放，洞洞板在同面墙上。','入口在北墙靠东，收藏柜放在门左侧，避开门扇与椅后通道。','原南窗为侧向采光，东侧客厅共墙保持完整实体；不再加入床。']},
    {id:'guest', parent:'guest', name:'次卧 / 书房', en:'BEDROOM & STUDY', camera:'G01', summary:'左床右桌的布置贴合原窗与门，西南床尾留衣柜，东南入口保持可通行。', details:['西侧 1.20 m 床与东侧 2.30 m 长桌对置，床头朝原北窗。','房间两侧均为实墙，浅书架靠墙，唯一外窗在图纸上端。','衣柜放西南床尾，原门保留在南墙东侧，家具不挤占门洞。']},
    {id:'kitchen', parent:'kitchen', name:'可开合厨房', en:'KITCHEN', camera:'K01', summary:'洗炒线、东北冰箱与东南 L 形备餐区各自独立，玻璃围合服从已有拐角。', details:['北侧灶与烟机落在实墙段，水槽在原北窗下，东北冰箱独立落地。','东侧短台接南侧 1.35 m 备餐台形成 L；不把北台继续绕成 U 形。','南台后固定围合与透明玻璃保留；余下南门向左叠收，西侧门组保留。']},
    {id:'bathroom', parent:'bathroom', name:'卫生间', en:'BATHROOM', camera:'B01', summary:'把洗衣与台盆放回狭长中央卫浴，同一面墙依次安排淋浴、马桶和洗漱。', details:['按 1.65 × 3.70 m 的狭长关系组织，原高窗在北端。','西墙由北到南为淋浴、马桶、洗衣机、台盆，设备正面朝东。','门在南端靠东、内开贴右墙；洗衣机与台盆共台，保持中部通行。']},
    {id:'living-detail', parent:'living', name:'窗边阅读位 · 细节', en:'READING CORNER', camera:'L02', summary:'从客厅同一底模取近景，核对阅读椅、脚凳、深木小边几与窗边折角。', details:['沿用客厅主图中的真实窗位、收窄区和家具位置。','米白细条纹椅、浅木脚凳、深木边几延续最新材质。','定向阅读灯与小件放在坐姿顺手的位置，椅背避开帘布。']},
    {id:'dining-detail', parent:'dining', name:'咖啡角 · 插排细节', en:'COFFEE CORNER', camera:'D02', summary:'从餐厅同一咖啡柜取近景，暖白移动插排与设备、杯架保持一致。', details:['咖啡柜仍靠餐区西墙北段，柜体与设备朝向沿用餐厅主图。','暖白短条移动插排放在磨豆机侧后方，沿后侧整理设备线。','白柜、浅木台面、深棕设备托盘与少量米白绿杯具相互呼应。']}
  ]
};
