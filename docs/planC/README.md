# Plan C · 日光花园真实三维首版

这是依据 [初始化规范](AI_Blender_ArchViz_多Agent项目初始化规范.md) 实现的独立路线。源代码、场景和本地渲染管线放在项目根目录 `planC/`；新路线说明统一在本目录。现有四套风格、28 个观察点继续使用原有素材和入口。

网页入口：当前网站侧栏或手机页首 **「Plan C · Blender 实景」**，也可直接访问 `/?view=plan-c`。部署在 GitHub Pages 子路径时，入口为 `/MyHome/?view=plan-c`。本地修改尚不等于线上发布。

## 首版可以查看什么

- 七个空间：起居室、餐厅与阳台、主卧、次卧／书房、多功能卧室、厨房、原图卫浴区。
- 「空间效果」展示真实 Cycles 渲染；「360° 环顾」展示同一工程的球形全景。
- 「户型与结构」可切换 Scene 平面图、原始 `home1.png`、可旋转缩放的 GLB 三维结构。
- 「项目与交付」可下载 `.blend`、Scene JSON、GLB、资产清单、逐图记录和检查报告。
- 没有实际渲染文件的视角会显示待渲染，不借用旧路线图片补位。

所有网页视觉制品来自版本化 Scene 对应的 Blender 工程；网页所需文件位于 `public/plan-c/`。原始 PNG 不进行 AI 精修或本地放大。

## 一次安装

前端沿用当前项目 Node.js 22.12+。Python 核心使用 Python 3.11，Blender 固定为已验证兼容的 **4.5.3 LTS**。

在仓库根目录运行：

```bash
python3 -m pip install --user uv
python3 planC/scripts/bootstrap.py
npm install
npm run dev
```

安装脚本通过 `planC/uv.lock` 安装依赖，并将 Blender 放入 `planC/.tools/`，不覆盖系统 Blender。Blender 下载经过固定 SHA256 校验；便携安装脚本面向 Linux x86_64。其他平台可先运行 `bootstrap.py --skip-blender`，自行安装同版本，再设置 `ARCHVIZ_BLENDER` 为可执行文件路径。

## 重新生成与导出

```bash
# 只验证 Scene、几何和预览资产，不启动 Blender
npm run planc:validate

# 默认生成客厅效果和全景，并导出至现有网站
planC/.venv/bin/python planC/scripts/render_demo.py --panorama

# 七房效果＋2K全景；客厅1920×1080，其余960×540，逐间导出
npm run planc:render

# 真实4K静态＋8K全景的草稿配置；CPU耗时明显增加
npm run planc:render:hd

# 将已有同版本制品重新导出到 public/plan-c/
npm run planc:export
```

`render_demo.py` 依次执行预览门禁、可复用构建、固定相机渲染、文件与版本校验、网页导出。默认输出位于 `planC/outputs/home1_sunlit/r1/`。Scene、资产或构建脚本变更会使旧构建失效；版本、相机或哈希不符的旧图不会发布为当前成果。`--rebuild` 可强制重建。

`--high-resolution` 输出依然标记为 `preview_only`。正式 `final_still_4k`／`panorama_8k_final` 另有尺寸校准和专业资产门禁，分辨率本身不代表照片级质量或正式验收通过。

## 本地 API 与增量数据

```bash
export ARCHVIZ_BLENDER="$PWD/planC/.tools/blender-4.5.3-linux-x64/blender"
npm run planc:api
# Swagger：http://127.0.0.1:8011/docs
```

主要接口：

| 接口 | 用途 |
| --- | --- |
| `GET /api/projects` | 项目及当前版本 |
| `GET /api/projects/home1_sunlit/scene` | Scene 事实源；可带 `revision` |
| `POST /api/projects/home1_sunlit/patches` | 事务 Patch、乐观锁、几何校验 |
| `GET /api/projects/home1_sunlit/reports?final=false` | 预览几何与资产门禁 |
| `POST /api/projects/home1_sunlit/jobs` | 排入固定 Blender 构建和渲染任务 |
| `GET /api/jobs/{job_id}` | 持久化状态、检查报告、失败原因 |
| `POST /api/jobs/{job_id}/retry` | 记录不同修复措施后重试，最多三次 |
| `GET /api/assets` | 已登记的预览／导入资产 |
| `GET /api/contracts/scene` | Pydantic 导出的 JSON Schema |

创建预览任务请求：

```json
{
  "scene_revision": 1,
  "mode": "preview",
  "camera_id": "camera_living_still",
  "render_profile_id": "preview_fast"
}
```

Patch 示例（实际能否提交取决于布局碰撞校验）：

```json
{
  "project_id": "home1_sunlit",
  "expected_revision": 1,
  "patch_id": "move_table_east_010",
  "requested_by": "design_agent",
  "operations": [{"op": "translate", "object_id": "living_table", "delta_m": [0.1, 0, 0]}],
  "validate_before_commit": true
}
```

失败不会增加版本。未知或承重墙的拆改会阻断；普通 Agent 也不能直接提交墙体改造。API 在本机回环地址提供服务，静态网站无需运行 API 就能看已导出的结果。API 中的新版本不会自动替换静态首版，需要为该版本重新构建、检查和导出。

## 验证

```bash
npm run test:planc
npm test
npm run build
BASE_URL=http://localhost:5173/ npm run test:planc:browser
```

核心测试覆盖承重与未知墙保护、窗洞边界、房间拓扑、家具碰撞、资产缺失／许可／哈希、事务回滚、并发版本冲突、渲染尺寸与版本、文件缺失、重试上限。浏览器测试覆盖真实图片／全景、三维结构、七房导航、手机布局、原始图纸、失败重试与旧四风格入口。实际输出和验证范围见 [首版验收记录](首版验收记录.md)。

## 当前范围

完成规范的 Phase 0 和 Phase 1 预览闭环：Scene／Patch／约束／资产门禁、真实 Blender 建模、Cycles 渲染、网页展示及文件 QA。十份公共及角色提示词按原规范抽出到 `planC/prompts/`；当前执行器是确定性任务状态机，尚未接入会自主设计、搜索资产和修图的九个在线 LLM Agent。

本版房屋输入来自估算示意图，家具为有来源记录的自建开发模型，仍需真实尺寸、洞口及专业资产审核，正式交付门禁保持阻断。这不影响先评估这条路线的空间一致性和日光花园风格。详见 [架构与图纸转录说明](架构与图纸转录说明.md)。
