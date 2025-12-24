# GLM-4V 图片分析 - Cloudflare Workers

这是一个基于 Cloudflare Workers 的图片分析应用，使用 GLM-4V 多模态模型分析照片。

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 设置环境变量

有两种方式设置本地开发环境变量：

**方式一：使用 .dev.vars 文件（推荐）**

```bash
# 复制示例文件
cp .dev.vars.example .dev.vars

# 编辑 .dev.vars 文件，填入你的 API Key
# BIGMODEL_API_KEY=your_api_key_here
```

**方式二：使用 wrangler secret**

```bash
wrangler secret put BIGMODEL_API_KEY
```

然后输入你的 API Key。

### 3. 启动开发服务器

```bash
npm run dev
# 或
wrangler dev
```

访问 `http://localhost:8787` 查看应用。

## 部署到 Cloudflare

### 1. 登录 Cloudflare

```bash
wrangler login
```

### 2. 设置生产环境变量

```bash
wrangler secret put BIGMODEL_API_KEY
```

### 3. 部署

```bash
npm run deploy
# 或
wrangler deploy
```

部署完成后，会显示 Worker 的 URL。

## 项目结构

- `src/server.ts` - Cloudflare Worker 主入口
- `src/glmClient.ts` - GLM-4V API 调用封装
- `src/index.ts` - 命令行工具（可选）
- `wrangler.toml` - Wrangler 配置文件
- `public/index.html` - 前端页面（已内联到 server.ts）

## 功能

- ✅ 图片上传
- ✅ 图片预览
- ✅ GLM-4V 图片分析
- ✅ 结构化结果展示（优点/改进/建议）
- ✅ 响应式设计
