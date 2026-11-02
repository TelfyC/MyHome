# 栖光 · 四套风格全景之家

Plan C 新路线已独立接入：页面“Plan C · Blender 实景”或 `?view=plan-c` 可查看按 `home1.png` 构建的日光花园真实三维首版。源工程位于 `planC/`，使用方法、范围及验收记录见 [Plan C 文档](docs/planC/README.md)。

默认进入「林中树屋」的 360° 全景。页首还可切换「现代日式中古风」「轻法式复古原木风」「日光花园原木」。奶白原木方案已移除，旧 `?design=cream` 链接回落到林中树屋。

四套方案各有客厅、餐厅与咖啡角、主卧与衣帽区、电竞房、次卧／书房、厨房、卫生间七个 360° 观察点。直接访问 `?design=forest&room=guest` 可查看次卧；`?view=model&design=forest&room=guest` 可核对实际尺寸模型。旧 `?scene=room` 链接也进入对应房间的 360°，页面不再提供独立空间效果入口。

## 最新：28 个高清全景重建（接缝验收进行中）

四套风格的七个房间已完成 28 张高清母版生成：向用户配置的 OpenAI 兼容图片接口明确指定 `3840x1920`，直接保存 API 返回的 PNG，没有在本地放大。随后把全景经度首尾移到图像中央，用蒙版限定区域修复接缝，再局部合成并导出桌面 3840 × 1920、手机 2560 × 1280 和 320 × 160 缩略图。当前接缝修复、逐图目视复核与浏览器验收仍在进行，不能仅以生成完成或接缝数值下降认定 28 张全部通过。

页面先显示保留的 1774 × 887 原图，再后台加载高清版本，保持正在看的朝向、缩放与自动环顾状态。手机优先使用 2560 × 1280；桌面优先使用 3840 × 1920，并按资源尺寸和设备纹理上限选择。高清文件失败、尺寸不符或设备不足时保留可交互原图。添加 `&quality=original` 可在相同视角设置下对比正文原图。

AI 生成会推断材质细节，局部织物、植物和纹样可能变化；更大文件尺寸也不能证明提供商内部的具体渲染方式。网页图经过接缝修复和合成，不称为未处理的原生 API 输出。方法、断点命令和文件边界见 [360 高清全景重建](docs/360高清全景重建.md)。本轮最终汇总记录位置为 `home-design-review/input/panorama-native-20261028.json`，验收截图保存在 `artifacts/panorama-native-20261028/`，以最终记录的状态为准。

## 此前：AI 超分增强

此前用本机 Real-ESRGAN 把原图生成 7096 × 3548 的 4 倍增强和 3548 × 1774 手机版本。旧文件 `public/panoramas-hd/` 与 [360 高清增强](docs/360高清增强.md) 保留为历史方案；来源和校验值见 `home-design-review/input/panorama-superresolution-20261027.json`。当前高清资源入口已改为 `public/panoramas-native/`。

## 360° 视角与渲染

视角改为按画面长边控制：默认 86°，缩放范围 60°–90°，桌面、超宽屏和竖屏手机都不会因宽高比变化而变成极端广角。俯仰范围随垂直视角调整，避开天顶与地板极区。工具条增加“恢复自然视角”，同时复位朝向、缩放并暂停自动环顾。

画布支持最高 2 倍设备像素比，并限制在约 800 万绘制像素以内。全景采用 mipmap、最高 8 倍各向异性过滤、横向接缝重复采样、放大时的双三次插值及温和的局部对比锐化。显示采样不能补出素材没有的细节；本轮清晰度改善主要来自新的高清素材，保留的 1774 × 887 原图仍用于首次加载、回退和对照。

## 此前：设计师细节与生活陈设

此前按“物品摆放有逻辑、要有生活化的小装饰”制作了四套风格的 28 张空间效果图。分别参考 Axel Vervoordt、Norm Architects × 芦泽启治、Pierre Yovanovitch、Heju Studio 的公开方法，按阅读、咖啡、床边、学习、备餐与洗漱组织物品。这些原生 1536 × 1024 的独立图片保留作历史素材，当前入口统一使用 360°，没有把独立效果图硬贴进全景。

逐室改动、设计师来源和提示词见 [四套风格：设计师细节与生活陈设](docs/四套风格_设计师细节与生活陈设.md)。

## 上一轮布局修订

- 左上次卧按一人长期使用重排：1.20 m 抽屉床靠左、2.30 × 0.65 m 长桌靠右、双侧壁挂书架、绿色织物与原北窗；西南床尾为衣柜，电竞房继续保留。
- 学习 Ilse Crawford／Studioilse 的公开住宅理念，按布局与收纳、材料触感、灯光与窗帘、使用与收口逐间修订四套风格。页面“本空间设计细节”可查看每间房的具体处理。
- 四套风格的七个空间全景与缩略图均更新，运行时使用本地素材，不调用生图 API。图片使用内置 image_gen 生成。
- 尺寸模型可切换四套材质底色；全景与模型互跳保留风格和房间。
- 厨房上一轮扩容方案保留：餐厅侧外移约 50 cm，围合主区约 7.6 ㎡，北侧台面 2.30 m。两面顶部吊轨透明玻璃默认叠收，五扇收窗边、四扇收右端，转角无立柱、地面无连续下轨；按钮可比较收起和围合。

设计师来源、逐室细化与素材记录见 [次卧与四套风格细节修订](docs/次卧与四套风格细节修订.md)；厨房具体占位见 [厨房扩容与吊轨移门](docs/厨房扩容与吊轨移门.md)。

## 启动与验证

需要 Node.js 22.12+。

```bash
npm install
npm run dev           # 默认 http://localhost:5173
npm run build         # TypeScript 检查与生产打包
npm test              # 导航与碰撞单元测试
npm run test:e2e      # 先启动 dev；尺寸、家具、开合碰撞、漫游与手机检查
npm run test:panorama # 360 素材、视角上限、缩放、超宽屏、手机与高像素比检查
npm run test:rooms    # 默认和旧空间效果链接统一进入 360 的兼容检查
npm run test:quality  # 渐进加载、3840/2560 纹理、原图对照、设备上限、失败回退与切换竞态
```

浏览器检查默认使用 `/usr/bin/google-chrome`，可通过 `CHROME_PATH` 指定浏览器、`BASE_URL` 更改地址。需要支持 WebGL 2 的浏览器。`dist` 可直接部署至静态网站服务器。

网站地址：[https://telfyc.github.io/MyHome/](https://telfyc.github.io/MyHome/)。推送到 `main` 后 GitHub Actions 自动测试、构建和发布；本地修改不代表已经发布。

GitHub Pages 使用 `VITE_BASE_PATH=/MyHome/ npm run build`，本地开发使用根路径；预览子路径构建时同样设置 `VITE_BASE_PATH=/MyHome/ npm run preview`。

## 操作

全景支持拖动、触摸与方向键环顾，滚轮或双指缩放、自动旋转、户型定位和截图。侧栏“查看材质本色”与手机工具条“色”按钮显示方案底色；“设计细节”按钮说明当前空间的布局、材料、灯光和收口。

尺寸模型支持鸟瞰旋转、缩放和平移，或用 WASD／方向键漫游，Shift 加速、Esc 退出。点击房间、空间标签或小地图跳转，切换日夜、墙体剖切、标签和截图；手机提供屏幕方向按钮。

## 尺寸与既有约束

主要尺寸取自 `docs/newStructure.jpg` 手写标注，仅使用尺寸，不复制其中旧隔墙、旧卫浴和窗符号。餐厅和上方阳台合计进深 3.45 m 已由用户确认。布局沿用方案 B 与后续确认，方位保持图纸上下左右，不认定地理南北。

| 项目 | 当前模型 |
| --- | --- |
| 主卧睡眠区 | 3.25 × 3.35 m；上方旧卫浴区域继续作为衣帽收纳 |
| 电竞房 | 2.75 × 3.40 m；1.80 × 0.75 m 桌靠主卧共墙，椅后约 1.09 m |
| 次卧 | 净宽 3.05 m；左侧 1.20 m 抽屉床、右侧 2.30 × 0.65 m 长桌 |
| 卫生间 | 1.65 × 3.70 m；洗衣机与台盆共 1.48 m 台面，通道约 0.94 m |
| 厨房 | 原净尺寸 2.62 × 2.44 m；外扩后围合主区约 7.6 ㎡，含柜体投影 |
| 餐厅与上方阳台 | 原宽 2.50 m，合计进深 3.45 m；厨房侧让出约 0.50 m |
| 客厅 | 公区主段宽 3.30 m、深 4.60 m；下端保留不规则收窄轮廓 |
| 公共过道／玄关 | 净宽 1.03 m／1.65 × 2.05 m |
| 层高 | 暂取 2.70 m，待现场复测 |

主卧与次卧左侧两处侧窗已取消，保留原端部外窗；电竞房与客厅共享墙补为完整实墙。约 65 英寸电视位于 1.80 × 0.42 m 矮柜上，正对沙发。卧室及卫浴门为细框不透明磨砂玻璃，外窗为黑框；厨房新增围合门为透明玻璃。旧阳台洗衣位改为 1.50 m 咖啡柜，洗衣迁入卫浴。电竞房布局和走线见 [专项说明](docs/电竞房布局与走线.md)。

原资料是分区比例概念示意，门窗洞口、层高、墙厚及未标注错位仍为估算。尺寸模型负责布局与通行核对；AI 全景负责材质和氛围，局部家具、洞口、玻璃分扇、台面及餐椅方向可能有偏差，不能反向用于量取施工尺寸。日夜切换是照明氛围示意，不是照度或日照模拟。

## 文件与素材

本轮高清生成的逐图请求、提示词、原始输出和处理记录保存在本机 `output/imagegen/panoramas-native-20261028/`；最终网页素材汇总记录位置为 `home-design-review/input/panorama-native-20261028.json`。原始输出不随网页打包，网站仅使用 `public/` 中的导出文件。此前设计陈设记录在 `home-design-review/input/craft-refinement-manifest-20261026.json` 和 `home-design-review/logs/craft-refinement-20261026/`，继续保留。

- `src/plan.ts` / `src/dimensions.ts`：房间关系、尺寸、家具与门组占位。
- `src/model.ts` / `src/kitchen-doors.ts`：三维家具、材质、吊轨门动画和碰撞。
- `src/design-schemes.ts`：四套风格、模型材质和逐室设计细节。
- `src/model-app.ts` / `src/viewer.ts`：尺寸模型界面与漫游。
- `src/room-tour.ts` / `src/room-tour.css`：历史独立空间效果实现，当前入口不加载。
- `src/craft-guides.ts`：四个设计师参考、逐室生活摆放与新图路径。
- `src/panorama.ts` / `src/panorama-data.ts`：七空间 360° 全景与导航。
- `src/panorama-rendering.ts`：视角与画布像素预算、纹理局部对比处理。
- `src/panorama-hd-data.ts`：高清全景的桌面、手机路径与实际尺寸；播放器据此选择和验证纹理。
- `public/panoramas-native/{forest,japanese,french,sunlit}/`：当前高清资源目录，桌面 3840 × 1920、手机 2560 × 1280、缩略图 320 × 160。
- `scripts/build-native-panoramas.py` / `scripts/finish-native-panoramas.py`：批量生成、蒙版接缝修复、局部合成与网页导出，支持核验已有输出后继续处理。
- `public/panoramas-hd/{forest,japanese,french,sunlit}/`：历史 4 倍超分与手机版本，当前入口不使用。
- `scripts/upscale-panoramas.py` / `scripts/build-panorama-hd.py`：此前本机分块超分及网页导出脚本，原图不覆写。
- `public/room-views/{forest,japanese,french,sunlit}/`：此前 28 张独立空间效果与缩略图，当前入口不加载。
- `public/panoramas/{forest,japanese,french,sunlit}/`：28 张全景与 28 张缩略图。
- `home-design-review/logs/detail-refinement-20261026-prompts.json`：生成提示词集合与来源。
- `home-design-review/logs/refinement-assets/`：逐图生成与定点修正记录。
- `home-design-review/input/detail-refinement-manifest-20261026.json`：最终尺寸、体积与校验值。

此前视频参考、窗帘补齐、早期风格和复核报告保留为历史资料，当前布局与风格以本轮修订为准。日光花园延续原指定 [89 平原木风 Room Tour](https://www.bilibili.com/video/BV1tm576NEwz/) 的浅木边白台面、细条纹与窗边植物；次卧与卫浴属于本项目延伸设计。
