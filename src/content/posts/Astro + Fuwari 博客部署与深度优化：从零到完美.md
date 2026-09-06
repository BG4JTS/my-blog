---
title: Astro + Fuwari 博客深度部署与优化全记录
published: 2026-09-06
description: '基于真实踩坑经验，完整记录 Astro + Fuwari 博客从零搭建到深度优化的全过程。涵盖环境配置、主题定制、评论系统、访问统计、自定义404、分享组件、工具聚合、国内加速等 15+ 功能模块的实战配置。'
image: ''
tags: [Astro, Fuwari, 博客搭建, Vercel, Cloudflare, 性能优化]
category: '技术'
draft: false
slug: astro-fuwari-complete-guide
---

## 写在前面

从 Hexo 迁移到 Astro + Fuwari，我花了一周左右的时间。这一周里踩了不少坑，也积累了一些经验。

网上关于 Fuwari 的系统性教程不多，官方文档虽然详细，但有些细节还是需要自己摸索。这篇文章不是官方文档的复述，而是我**实际搭建过程中遇到的问题和解决方案的完整记录**。

文章会涵盖从环境配置到上线优化的全流程，希望能帮助正在或准备使用 Astro + Fuwari 的朋友少走一些弯路。

::github{repo="bg4jts/my-blog"}

> 本文所有代码均已开源，完整项目可在 [bg4jts/my-blog](https://github.com/bg4jts/my-blog) 查看。欢迎 Star、Fork、提 Issue。

---

## 一、为什么选择 Astro + Fuwari？

### 1.1 框架选型对比

在决定迁移之前，我认真对比了几个主流的静态博客方案：

| 框架 | 优点 | 缺点 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **Hexo** | 生态成熟，主题丰富，入门简单 | 构建速度慢，Node.js 版本兼容性问题多 | 新手入门，快速搭建 |
| **Hugo** | 构建极快，单二进制文件，无依赖 | Go 模板语法学习成本高，主题生态相对小 | 大型站点，追求极致速度 |
| **Jekyll** | GitHub Pages 原生支持 | Ruby 环境配置复杂，构建慢 | 深度绑定 GitHub 的用户 |
| **Astro** | 岛屿架构，默认零 JS，性能顶尖 | 生态相对较新，部分主题不成熟 | 追求性能与现代前端体验 |

### 1.2 为什么是 Fuwari？

在众多 Astro 主题中，我最终选择了 Fuwari，原因如下：

- 🚀 **性能极致**：默认生成近乎零 JavaScript 的静态页面，首屏加载极快
- 🌓 **原生暗色模式**：亮色/暗色模式无缝切换，体验完整
- 📱 **完全响应式**：从桌面到手机，布局自适应
- 🔍 **内置全文搜索**：基于 Pagefind，无需额外配置
- 🎨 **可自定义主题色**：一键更换主色调
- 📝 **完美支持 MDX**：可以在 Markdown 中嵌入 React 组件
- 🧩 **组件化架构**：所有 UI 都是可替换的 Astro 组件
- 📦 **零依赖启动**：开箱即用，无需额外安装插件

最重要的是，Fuwari 的设计风格非常干净、克制——没有花哨的动画和装饰，专注于内容本身。这正是我想要的博客的样子。

---

## 二、环境准备与项目初始化

### 2.1 环境要求

- **Node.js**：18.x 或更高版本（推荐使用最新的 LTS 版本）
- **包管理器**：pnpm（Fuwari 官方推荐，速度更快，磁盘占用更小）

```bash
# 安装 pnpm
npm install -g pnpm

# 验证安装
pnpm --version
```

### 2.2 创建项目

Fuwari 提供了官方模板，一条命令即可创建：

```bash
# 使用 pnpm 创建
pnpm create fuwari@latest

# 或者使用 npm
npm create fuwari@latest
```

项目创建后，进入目录并安装依赖：

```bash
cd my-blog
pnpm install
```

### 2.3 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:4321`，你应该能看到 Fuwari 的默认首页。

## 三、基础配置

### 3.1 站点信息配置

Fuwari 的所有配置集中在 `src/config.ts` 文件中。打开它，你会看到两个主要配置对象：

#### `siteConfig` — 站点级配置

```typescript
export const siteConfig = {
  title: 'BG4JTS 的博客',           // 网站标题
  subtitle: '记录与分享',            // 网站副标题
  lang: 'zh-CN',                    // 语言
  description: '个人技术博客，记录开发与思考', // SEO 描述
  themeColor: { hue: 220, fixed: false }, // 主色调（色相值 0-360）
  banner: {                         // 顶部横幅
    enable: true,
    src: '/images/banner.jpg',
    position: 'center',
  },
  favicon: [ ... ],                 // 网站图标配置
};
```

#### `profileConfig` — 个人信息配置

```typescript
export const profileConfig = {
  name: 'BG4JTS',
  bio: '开发者 · 创作者',
  avatar: '/avatar.jpg',
  links: [
    { name: 'GitHub', url: 'https://github.com/bg4jts', external: true },
    { name: 'Twitter', url: 'https://twitter.com/xxxx', external: true },
  ],
};
```

### 3.2 网站图标（Favicon）配置

网站图标是博客的品牌标识，我推荐使用 **RealFaviconGenerator** 生成全套图标。

1. **生成图标**：访问 [realfavicongenerator.net](https://realfavicongenerator.net/)，上传你的 Logo，生成并下载压缩包
2. **放置文件**：将所有文件解压到 `public/` 目录（**注意：直接放在根目录，不要放在子文件夹中**）
3. **配置引用**：在 `src/config.ts` 中添加 `favicon` 配置：

```typescript
favicon: [
  { src: '/favicon.ico', sizes: 'any', theme: null },
  { src: '/favicon-16x16.png', sizes: '16x16', theme: null },
  { src: '/favicon-32x32.png', sizes: '32x32', theme: null },
  { src: '/apple-touch-icon.png', sizes: '180x180', theme: null },
],
```

4. **添加 manifest**：在 `src/layouts/Layout.astro` 的 `<head>` 中添加：

```astro
<link rel="manifest" href="/site.webmanifest" />
<meta name="msapplication-TileColor" content="#da532c" />
<meta name="theme-color" content="#ffffff" />
```

> 💡 **踩坑提醒**：如果你把 favicon 文件放在 `public/favicon/` 子目录中，但配置里引用的是 `/favicon.ico`，浏览器会 404。**务必确认文件路径与引用路径一致。**

---

## 四、个性化定制

### 4.1 自定义文章 URL

Fuwari 默认使用文章文件夹名作为 URL。如果你的文章标题是中文，生成的 URL 会是一长串编码字符，既不美观也不利于 SEO。

**解决方案**：在文章 Frontmatter 中添加 `slug` 字段：

```yaml
---
title: 中国学生压力状况：基于公开数据与研究的梳理
published: 2026-09-05
slug: student-pressure-analysis   # 自定义短链接
---
```

生成的 URL 从：
```
/posts/2026-09-05-中国学生压力状况基于公开数据与研究的梳理/
```
变为：
```
/posts/student-pressure-analysis/
```

简洁、清晰、易分享。

### 4.2 深色模式适配

Fuwari 已经内置了深色模式支持，通过 `dark:` 前缀的 Tailwind 类实现。

在自定义组件时，记得同时适配两种模式：

```astro
<div class="text-black/80 dark:text-white/80">
  这段文字在亮色模式下是深灰色，暗色模式下是浅灰色
</div>
```

---

## 五、功能增强

### 5.1 评论系统：Giscus

Giscus 是一个基于 GitHub Discussions 的评论系统，评论数据存储在你的 GitHub 仓库中，无需额外数据库。

**配置步骤**：

1. 在 GitHub 创建一个**公开仓库**（如 `blog-comments`），并启用 Discussions
2. 安装 [Giscus GitHub App](https://github.com/apps/giscus)，授权访问该仓库
3. 访问 [giscus.app](https://giscus.app/zh-CN)，获取 `data-repo-id` 和 `data-category-id`
4. 在 `src/components/misc/GiscusComment.astro` 中配置评论组件

**核心特性**：
- 评论自动跟随博客主题切换（亮色/暗色）
- 支持 Markdown 格式评论
- 支持点赞、回复等 GitHub Discussions 原生功能
- 无需登录即可评论（需 GitHub 账号）

> 📂 **源码位置**：`src/components/misc/GiscusComment.astro`

### 5.2 访问统计：Umami

Umami 是一个轻量、隐私友好的网站分析工具，是 Google Analytics 的优秀替代品。

Fuwari 已内置 Umami 支持，只需在 `src/config.ts` 中配置：

```typescript
umamiConfig: {
  enable: true,
  baseUrl: 'https://cloud.umami.is',     // 官方云服务或自部署地址
  shareId: '你的ShareID',                // 从分享链接中提取
  timezone: 'Asia/Shanghai',
},
```

**获取 ShareID**：
- 在 Umami 后台开启网站分享功能
- 复制分享链接（如 `https://cloud.umami.is/share/EkS4mYbIXLu9vshR`）
- 取最后一段作为 ShareID：`EkS4mYbIXLu9vshR`

### 5.3 分享组件

我为每篇文章添加了一个分享组件，支持三种分享方式：
- **复制链接**：仅复制文章 URL
- **复制标题+链接**：格式为 `【文章标题】URL`
- **QQ 分享**：调用 QQ 分享接口

组件位于文章底部，以圆形按钮触发，浮窗从右下方展开，设计紧凑且符合 Fuwari 的视觉风格。

> 📂 **源码位置**：`src/components/misc/ShareButtons.astro`

### 5.4 MDX 集成：在文章中嵌入交互组件

Fuwari 默认支持 MDX，这意味着你可以在 Markdown 中直接嵌入 Astro 组件或 React 组件。

**使用示例**：

```mdx
---
title: 我的交互式文章
---

这是一篇普通的 Markdown 内容。

<MyCustomComponent someProp="value" />

这里可以继续写 Markdown。
```

这为技术博客带来了极大的灵活性——你可以插入代码演示、交互式图表、甚至小型应用。

---

## 六、部署与域名配置

### 6.1 Vercel 部署

Fuwari 是静态站点，部署到 Vercel 非常简单：

1. **推送代码**：将项目推送到 GitHub 仓库
2. **导入项目**：在 Vercel 控制台点击 `Add New` → `Project`，选择你的仓库
3. **自动构建**：Vercel 会自动检测 Astro 项目并完成构建
4. **部署完成**：获得一个 `xxx.vercel.app` 的预览域名

**Vercel 的自动部署**：每次 `git push` 到主分支，Vercel 会自动重新构建和部署，全程无需手动操作。

### 6.2 绑定自定义域名

1. 在 Vercel 项目设置中，进入 `Domains` 页面
2. 点击 `Add Domain`，输入你的域名（如 `bg4jts.cn`）
3. 到域名注册商处添加 DNS 记录：
   - **A 记录**：指向 `76.76.21.21`（Vercel 的 IP）
   - **或 CNAME 记录**：指向 `cname.vercel-dns.com`

### 6.3 国内访问加速：Cloudflare Workers

由于 Vercel 在国内访问不稳定，我使用 Cloudflare Workers 做了一层转发加速。

**核心思路**：用 Cloudflare Worker 作为“反向代理”，将请求转发到 Vercel 项目，同时利用 Cloudflare 的全球 CDN 加速国内访问。

**Worker 代码**（精简版）：

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 工具路径 → 工具聚合项目
    if (path.startsWith('/tools/')) {
      const targetUrl = `https://tools-hub.vercel.app${path}`;
      return fetch(new Request(targetUrl, request));
    }

    // 其他路径 → 主博客项目
    const targetUrl = `https://bg4jts.vercel.app${path}`;
    return fetch(new Request(targetUrl, request));
  }
};
```

**配置要点**：
- DNS 记录必须开启 Cloudflare 代理（橙色云朵）
- Worker 路由：`*bg4jts.cn/*`
- 转发时保留 Host 头，避免 Vercel 重定向

> 💡 **踩坑提醒**：如果 Worker 转发后出现 301 重定向到 `blog.bg4jts.cn`，是因为 Vercel 根据 `Host` 头判断域名。解决方案是在转发时强制设置 `Host` 头为 Vercel 项目域名。

### 6.4 工具聚合框架：Tools Hub

我把所有独立工具（如“何意为”汉字查询工具）放在一个单独的 Vercel 项目中，通过 Worker 转发到 `/tools/*` 路径。

**项目结构**：

```
tools-hub/
├── public/
│   ├── hyw/              # 何意为工具
│   │   └── index.html
│   ├── tool-a/           # 其他工具
│   │   └── index.html
│   └── tool-b/
│       └── index.html
├── vercel.json           # 路由重写配置
└── package.json
```

**vercel.json**：

```json
{
  "rewrites": [
    { "source": "/tools/:path*", "destination": "/:path*" }
  ]
}
```

这样访问 `bg4jts.cn/tools/hyw` 就会映射到 `tools-hub.vercel.app/hyw`，实现了多工具的统一管理。

---

## 七、完整踩坑记录

### 7.1 pnpm Windows 安装失败

**错误**：`ERR_PNPM_ENOENT ENOENT: no such file or directory, rename`

**原因**：pnpm 在 Windows 上的硬链接机制与某些文件系统不兼容

**解决**：在 `.npmrc` 中添加 `node-linker=hoisted`

### 7.2 Layout 导入路径错误

**错误**：`Cannot find module '@/layouts/BaseLayout.astro'`

**原因**：Fuwari 的布局文件是 `Layout.astro`，不是 `BaseLayout.astro`

**解决**：将 `import BaseLayout from '@/layouts/BaseLayout.astro'` 改为 `import Layout from '@/layouts/Layout.astro'`

### 7.3 Favicon 不显示

**原因**：文件放在了 `public/favicon/` 子目录，但 HTML 引用的是 `/favicon.ico`

**解决**：将文件移到 `public/` 根目录，或修改配置路径

### 7.4 Vercel + Cloudflare 的 DNS 冲突

**问题**：`@` 记录不能同时存在 CNAME 和 A 记录

**解决**：使用 Worker 路由 + DNS 代理（橙色云朵），无需额外添加 A 记录

### 7.5 Worker 转发 301 重定向

**问题**：Vercel 根据 `Host` 头判断域名，返回 301 重定向到 `blog.bg4jts.cn`

**解决**：在 Worker 转发时强制设置 `Host` 头

```javascript
newRequest.headers.set('Host', targetHost);
```

### 7.6 文章 URL 过长

**问题**：中文标题导致 URL 编码后很长

**解决**：在 Frontmatter 中添加 `slug` 字段自定义短链接

---

## 八、性能优化建议

| 优化项 | 方法 | 效果 |
| :--- | :--- | :--- |
| **图片优化** | 使用 Astro 的 `Image` 组件，自动转换为 WebP | 减少图片体积 30-50% |
| **字体加载** | `font-display: swap`，或本地托管字体 | 避免 FOIT（字体闪烁） |
| **构建缓存** | Vercel 默认开启 | 加速二次构建 |
| **懒加载** | Fuwari 已集成 PhotoSwipe | 按需加载图片 |
| **预加载** | 关键页面使用 `<link rel="preload">` | 提升关键资源加载速度 |
| **CDN 加速** | Cloudflare 代理 | 国内访问速度提升 3-5 倍 |

---

## 九、总结

Astro + Fuwari 是一个非常优秀的博客方案。它的设计哲学是“少即是多”——把复杂的事情交给框架，让开发者专注于内容创作。

整个搭建过程下来，我最深的感受是：

1. **Fuwari 的架构很干净**：没有冗余的依赖和复杂的配置，想改什么都找得到地方
2. **Astro 的性能是真实可感的**：页面加载速度比 Hexo 快了一个档次
3. **Vercel + Cloudflare 的组合**：让部署和访问加速变得非常简单
4. **MDX 支持**：为技术博客带来了无限可能

如果你正在寻找一个现代化的博客方案，Astro + Fuwari 值得一试。

---

## 十、相关资源

| 资源 | 链接 |
| :--- | :--- |
| **本文完整源码** | [github.com/bg4jts/my-blog](https://github.com/bg4jts/my-blog) |
| **Fuwari 官方仓库** | [github.com/saicaca/fuwari](https://github.com/saicaca/fuwari) |
| **Astro 官方文档** | [docs.astro.build](https://docs.astro.build) |
| **Giscus 配置** | [giscus.app](https://giscus.app/zh-CN) |
| **RealFaviconGenerator** | [realfavicongenerator.net](https://realfavicongenerator.net) |
| **Umami 官网** | [umami.is](https://umami.is) |

---

*如有问题，欢迎在评论区交流，或直接在 GitHub 仓库提 Issue。*
