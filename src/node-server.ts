import http from "http";
import dotenv from "dotenv";
import { getIndexHTML, handleAnalyze, type Env } from "./server";

// 加载环境变量
dotenv.config();

// 预生成 HTML
let INDEX_HTML: string;
try {
  INDEX_HTML = getIndexHTML();
  console.log("[服务器初始化] HTML 预生成成功");
} catch (error) {
  console.error("[服务器初始化] HTML 预生成失败:", error);
  INDEX_HTML = "<!DOCTYPE html><html><body><h1>服务器初始化错误</h1></body></html>";
}

// 从环境变量获取配置
const env: Env = {
  BIGMODEL_API_KEY: process.env.BIGMODEL_API_KEY || "",
};

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const method = req.method || "GET";
  const pathname = url.pathname;

  console.log(`[${requestId}] ===== 请求开始 =====`);
  console.log(`[${requestId}] 时间: ${new Date().toISOString()}`);
  console.log(`[${requestId}] 方法: ${method}`);
  console.log(`[${requestId}] URL: ${url.href}`);
  console.log(`[${requestId}] 路径: ${pathname}`);
  console.log(`[${requestId}] 查询参数: ${url.search}`);

  try {
    // 1️⃣ 处理 GET / - 返回 HTML 页面
    if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      console.log(`[${requestId}] ✓ 进入 HTML 页面分支 (GET /)`);
      console.log(`[${requestId}] 返回预生成的 HTML，长度: ${INDEX_HTML.length} 字符`);

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
      res.end(INDEX_HTML);
      console.log(`[${requestId}] ✓ HTML 响应已发送`);
      return;
    }

    // 2️⃣ 处理 POST /analyze - 只处理图片分析
    if (method === "POST" && pathname === "/analyze") {
      console.log(`[${requestId}] ✓ 进入图片分析 API 分支 (POST /analyze)`);
      
      // 将 Node.js 请求转换为 Web API Request
      const request = await nodeRequestToWebRequest(req);
      const response = await handleAnalyze(request, env, requestId);
      
      // 将 Web API Response 转换为 Node.js 响应
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const body = await response.text();
      res.end(body);
      
      console.log(`[${requestId}] ✓ 分析请求处理完成`);
      return;
    }

    // 3️⃣ 其他所有请求返回 404 Not Found
    console.log(`[${requestId}] ✗ 路由未匹配 (${method} ${pathname})，返回 404`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  } catch (error) {
    console.error(`[${requestId}] ✗✗✗ 请求处理异常 ✗✗✗`);
    console.error(`[${requestId}] 错误类型:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`[${requestId}] 错误消息:`, error instanceof Error ? error.message : String(error));
    console.error(`[${requestId}] 错误堆栈:`, error instanceof Error ? error.stack : "无堆栈信息");

    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: errorMessage, requestId: requestId }));
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ===== 请求结束，耗时: ${duration}ms =====`);
  }
});

// 将 Node.js IncomingMessage 转换为 Web API Request
async function nodeRequestToWebRequest(req: http.IncomingMessage): Promise<Request> {
  const host = req.headers.host || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const url = new URL(req.url || "/", `${protocol}://${host}`);
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);

  return new Request(url.href, {
    method: req.method || "GET",
    headers: req.headers as HeadersInit,
    body: body.length > 0 ? body : undefined,
  });
}


// 启动服务器
const PORT = parseInt(process.env.PORT || "8787", 10);
const HOST = "0.0.0.0"; // 监听所有网络接口，允许公网访问

server.listen(PORT, HOST, () => {
  console.log("=".repeat(60));
  console.log("🚀 服务器已启动");
  console.log("=".repeat(60));
  console.log(`📡 监听地址: ${HOST}:${PORT}`);
  console.log(`🌐 本地访问: http://localhost:${PORT}`);
  console.log(`🌍 公网访问: http://<ECS公网IP>:${PORT}`);
  console.log(`📝 环境变量 BIGMODEL_API_KEY: ${env.BIGMODEL_API_KEY ? "✅ 已设置" : "❌ 未设置"}`);
  console.log("=".repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log("=".repeat(60));
});

