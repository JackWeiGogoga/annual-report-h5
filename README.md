# 年度账单 H5 · Three.js 粒子 MVP

两个方向的原型，分别参考 `demo1.mp4` 与 `demo2.mp4`：

| 页面 | 灵感 | 核心效果 | 交互 |
| --- | --- | --- | --- |
| `demo1-tree/` 生长 | demo1.mp4 | 光球沿细线降下；点云树从中轴线「先竖起、再由上而下扇开」；悬丝连接光球与树冠 | 轻触：溶解 → 重聚，同时切换色调与镜头；拖拽旋转；结尾树折回中轴线，光球升起 |
| `demo2-shatter/` 重塑 | demo2.mp4 | 同一批粒子在 2026 / 地球 / K 线 / 交易额数字 / ₿ 硬币 / 圆环 之间变形 | 轻触：以 碎片 / 尘埃 / 切环 三种方式炸开再聚合；长按预览式打散、松手复原；拖拽旋转 |

## 运行

需要一个静态服务器（ES Module 不能用 `file://` 直接打开）：

```bash
npm run dev
```

然后打开 <http://127.0.0.1:4173/>，首页把两个 demo 放在手机框里并排预览；也可以直接开
`/demo1-tree/` 或 `/demo2-shatter/`，用浏览器的手机模拟或真机扫码查看。

## 结构

```
shared/data.js        Mock 用户数据，两个页面共用；接真实接口只需替换这里
vendor/three/         Three.js r186（three.module.js + three.core.js），通过 importmap 引入
demo1-tree/           index.html · style.css · main.js
demo2-shatter/        index.html · style.css · main.js
index.html            并排预览页
```

## 关键实现

- 粒子全部走自定义 `ShaderMaterial`，形变 / 炸开 / 溶解都在顶点着色器里按 `uProgress` 计算，CPU 每帧几乎不干活。
- demo1 树是程序化生成的（三根主干递归分枝 + 枝端高斯团簇叶片 + 不规则岩板），换随机种子就是另一棵树。
- demo2 的「碎片」模式用一组随机正交基把空间切成薄片，每片作为刚体各自翻滚飞散，这是参考视频里那种「片状碎裂」的来源；「切环」模式按高度分层，各层反向旋转并上下拉开；「尘埃」逐粒子随机飘散。
- 文字形体（2026、$1.28M、₿）是把文字画到离屏 canvas 再采样像素得到的，所以任何数字都能变成粒子。

## 调参入口

- 粒子预算：`demo1 main.js` 的 `Q`、`demo2 main.js` 的 `N`（已按移动端自动降档）。
- 故事线 / 文案：两个 `main.js` 里的 `SLIDES`；镜头 `SHOTS`（demo1）；形体与炸开方式 `STEPS`（demo2）。
- 品牌名暂用 `NOVA` 占位，在 HTML 头部与文案里替换即可。

## 上线前

- 现在 Three.js 是完整未压缩版（约 2 MB），正式上线建议用 Vite 打包 tree-shake，或换成 CDN 的 min 版。
- 中文字体走系统字体栈，没有外部字体请求；如需品牌字体请自托管并做子集化。
- 「生成海报」按钮目前只弹提示，需要接海报合成 / 分享 SDK。
