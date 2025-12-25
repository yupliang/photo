# Cloudflare Workers 验证步骤

## 1. 部署 Worker

```bash
npx wrangler deploy
```

## 2. 验证 Logs 配置

### 方法 A: Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → 选择你的 Worker (`photo`)
3. 点击 **Logs** 标签页
4. 应该能看到 "Logs are enabled" 的提示，不再要求更新配置

### 方法 B: 命令行验证

```bash
# 实时查看日志（推荐）
npx wrangler tail

# 或者查看最近的日志
npx wrangler tail --format pretty
```

## 3. 测试根路径访问

### 步骤 1: 访问根路径
在浏览器中访问：
```
https://photo.yupeiliang110.workers.dev/
```

### 步骤 2: 查看日志输出

**使用 `npx wrangler tail`：**

你应该能看到类似这样的日志：

```
[Worker 初始化] HTML 预生成成功
[1234567890-abc123] ===== 请求开始 =====
[1234567890-abc123] 时间: 2024-01-01T12:00:00.000Z
[1234567890-abc123] 方法: GET
[1234567890-abc123] URL: https://photo.yupeiliang110.workers.dev/
[1234567890-abc123] 路径: /
[1234567890-abc123] 查询参数: 
[1234567890-abc123] ✓ 进入 HTML 页面分支
[1234567890-abc123] 返回预生成的 HTML，长度: 12345 字符
[1234567890-abc123] ✓ HTML 响应已创建
[1234567890-abc123] ===== 请求结束，耗时: 5ms =====
```

**关键检查点：**
- ✅ 看到 `[Worker 初始化] HTML 预生成成功`
- ✅ 看到 `✓ 进入 HTML 页面分支`
- ✅ 看到 `✓ HTML 响应已创建`
- ✅ 请求耗时应该 < 50ms
- ✅ 浏览器应该能正常显示页面

## 4. 测试图片分析 API

### 步骤 1: 使用浏览器开发者工具

1. 打开页面：`https://photo.yupeiliang110.workers.dev/`
2. 打开浏览器开发者工具（F12）
3. 切换到 **Network** 标签
4. 上传一张图片并点击"开始分析"
5. 查看 `/analyze` 请求的响应

### 步骤 2: 查看日志输出

在 `npx wrangler tail` 中应该能看到：

```
[1234567891-def456] ===== 请求开始 =====
[1234567891-def456] 方法: POST
[1234567891-def456] URL: https://photo.yupeiliang110.workers.dev/analyze
[1234567891-def456] 路径: /analyze
[1234567891-def456] ✓ 进入图片分析 API 分支
[1234567891-def456] [handleAnalyze] 开始处理分析请求
[1234567891-def456] [handleAnalyze] API Key 已配置（长度: 32）
[1234567891-def456] [handleAnalyze] 开始解析 FormData
[1234567891-def456] [handleAnalyze] FormData 解析完成
[1234567891-def456] [handleAnalyze] 获取文件字段: File 类型
[1234567891-def456] [handleAnalyze] 图片文件信息:
[1234567891-def456]   - 文件名: test.jpg
[1234567891-def456]   - 文件大小: 123456 bytes
[1234567891-def456]   - 文件类型: image/jpeg
[1234567891-def456] [handleAnalyze] 开始读取文件内容
[1234567891-def456] [handleAnalyze] 文件读取完成，ArrayBuffer 长度: 123456
[1234567891-def456] [handleAnalyze] 开始转换为 base64
[1234567891-def456] [handleAnalyze] Base64 转换完成，长度: 164608 字符
[1234567891-def456] [handleAnalyze] 开始调用 GLM-4V API
[1234567891-def456] [handleAnalyze] GLM-4V API 调用完成，耗时: 5000ms
[1234567891-def456] [handleAnalyze] 分析结果长度: 500 字符
[1234567891-def456] ✓ 分析请求处理完成
[1234567891-def456] ===== 请求结束，耗时: 5200ms =====
```

## 5. 排查 "Sorry, something went wrong" 错误

如果仍然出现错误，按以下步骤排查：

### 检查 1: 查看 Worker 初始化日志

```bash
npx wrangler tail
```

**如果看到：**
```
[Worker 初始化] HTML 预生成失败: [错误信息]
```

**说明：** `getIndexHTML()` 函数执行失败，需要检查 HTML 模板。

### 检查 2: 查看请求处理日志

**如果看到请求开始但没有结束：**
- 说明代码在某个地方卡住了
- 查看最后一条日志，定位卡住的位置

**如果看到错误日志：**
```
[xxx] ✗✗✗ 请求处理异常 ✗✗✗
[xxx] 错误类型: TypeError
[xxx] 错误消息: [具体错误]
[xxx] 错误堆栈: [堆栈信息]
```

根据错误信息修复代码。

### 检查 3: 验证环境变量

```bash
# 检查是否设置了 API Key
npx wrangler secret list
```

如果没有设置，运行：
```bash
npx wrangler secret put BIGMODEL_API_KEY
```

## 6. 常见问题排查

### 问题 1: Dashboard 仍然提示配置不一致

**解决方案：**
1. 确认 `wrangler.toml` 中有 `[observability] enabled = true`
2. 重新部署：`npx wrangler deploy`
3. 等待 1-2 分钟后刷新 Dashboard

### 问题 2: `npx wrangler tail` 没有输出

**可能原因：**
- Worker 还没有收到请求
- Logs 功能未正确启用

**解决方案：**
1. 访问 Worker URL 触发请求
2. 检查 `wrangler.toml` 配置
3. 在 Dashboard 中确认 Logs 已启用

### 问题 3: 日志中有错误但页面正常

**说明：** 错误已被捕获并返回了错误响应，这是正常的。检查错误日志以优化代码。

## 7. 验证清单

部署后，确认以下所有项：

- [ ] `wrangler.toml` 中 `[observability] enabled = true`
- [ ] `npx wrangler deploy` 成功
- [ ] Cloudflare Dashboard 中 Logs 标签页不再提示配置不一致
- [ ] `npx wrangler tail` 能正常显示日志
- [ ] 访问根路径 `/` 能正常显示页面
- [ ] 日志中能看到 `[Worker 初始化] HTML 预生成成功`
- [ ] 日志中能看到 `✓ 进入 HTML 页面分支`
- [ ] 日志中能看到请求耗时 < 50ms
- [ ] 上传图片后能正常调用 `/analyze` API
- [ ] 日志中能看到完整的分析流程

## 8. 性能基准

正常情况下：
- **根路径 `/` 响应时间：** < 50ms
- **HTML 页面大小：** ~20-30KB
- **图片分析 API 响应时间：** 取决于图片大小和 API 响应时间（通常 3-10 秒）

如果响应时间明显超过这些值，检查日志定位瓶颈。

