# CTLS 载重平衡计算器

> AeroJones CTLS Weight & Balance Calculator (POH 2022)
> 纯前端 Web 应用 · 手机优先设计 · 支持 PWA 添加到主屏幕

## 项目介绍

基于 **AeroJones CTLS 飞机飞行手册（POH）2022** 第 5 章性能数据实现的载重平衡计算器。飞行员在起飞前快速录入空机重、前座乘员、行李、燃油等参数，实时计算：

- 起飞总重（TOW）
- 起飞重心（CG / %MAC）
- 重心包线图（CG Envelope 范围内 / 超出）
- 实时警告（超重 / 重心越界 / 各项超限）

数据无需后端，浏览器 `file://` 双击可直接运行。

## 功能说明

| 模块 | 说明 |
|------|------|
| 飞机注册号 | 内置 B-10J9 / B-12LY / B-133X 三架飞机空机数据，支持自定义注册号保存到本地 |
| 预设管理 | 自定义注册号可保存到 localStorage，支持删除（防累积） |
| 重量计算 | 实时计算 ZFW / TOW / 力矩 / 重心位置 |
| 重心包线图 | Canvas 绘制 CG envelope + MTOW 线 + 当前位置点 |
| 警告系统 | 红 / 黄 / 绿三色状态，超限与接近边界分别提示 |
| 手机优先布局 | 容器最大宽 420px，所有控件适配手机屏幕，支持 iOS 安全区域 |
| PWA / A2HS | iOS Safari / Android Chrome 添加到主屏幕，全屏启动 |
| 打印支持 | 一键打印，自动隐藏按钮和选择行 |

## 本地运行

直接双击 `index.html` 即可在浏览器中运行（无需服务器）。

或用本地服务器（推荐）：
```bash
python -m http.server 8080
# 访问 http://localhost:8080
```

## GitHub 部署

```bash
cd CTLS-WB
git init
git add .
git commit -m "Initial commit: CTLS W&B Calculator"
git branch -M main
git remote add origin https://github.com/<user>/CTLS-WB.git
git push -u origin main
```

## Vercel 部署

1. 访问 https://vercel.com/new
2. `Import Git Repository` → 选择仓库
3. Framework Preset 选 `Other`
4. 点击 `Deploy`

完成后获得 `https://ctls-wb-<user>.vercel.app`（自动 HTTPS）。

## 更新日志

### v1.1.0 (2026-07-17)

- 手机 APP 尺寸优先（容器最大宽 420px，紧凑排版）
- 新增"飞机注册号"自定义保存 / 删除（localStorage 持久化）
- 包线图移除中文词（统一英文坐标轴）
- 标签"飞机选择"改为"飞机注册号"
- 移除"重新计算"按钮

### v1.0.0 (2026-07-16)

- 删除"保存预设"按钮（飞机选择保留）
- 删除"重新计算"按钮（输入实时计算）
- 重构项目结构（按 Web 标准拆 css/js/icons/assets）
- LOGO 图标采用威翔蓝色主题 + AeroJones 真实 LOGO
- PWA 优化（manifest + 4 种尺寸图标）
- 添加 MIT 许可证

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 开发者

- 飞行性能数据：AeroJones Aviation · CTLS POH 2022
- 实现：纯前端 Web（HTML + CSS + Vanilla JS）