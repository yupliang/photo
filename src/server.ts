const { analyzeImageBase64 } = require("./glmClient");

// 预生成 HTML，避免每次请求都重新生成
// 使用 try-catch 确保模块加载时不会因为 HTML 生成失败而导致 Worker 无法启动
let INDEX_HTML: string;
try {
  INDEX_HTML = getIndexHTML();
  console.log("[Worker 初始化] HTML 预生成成功");
} catch (error) {
  console.error("[Worker 初始化] HTML 预生成失败:", error);
  INDEX_HTML = "<!DOCTYPE html><html><body><h1>服务器初始化错误</h1></body></html>";
}

// Cloudflare Worker 入口
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 详细的请求日志
    const url = new URL(request.url);
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const method = request.method;
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
        
        // 直接返回预生成的 HTML，不执行任何计算
        const response = new Response(INDEX_HTML, {
          headers: { 
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600"
          },
        });
        
        console.log(`[${requestId}] ✓ HTML 响应已创建`);
        return response;
      }

      // 2️⃣ 处理 POST /analyze - 只处理图片分析
      if (method === "POST" && pathname === "/analyze") {
        console.log(`[${requestId}] ✓ 进入图片分析 API 分支 (POST /analyze)`);
        const result = await handleAnalyze(request, env, requestId);
        console.log(`[${requestId}] ✓ 分析请求处理完成`);
        return result;
      }

      // 3️⃣ 其他所有请求返回 404 Not Found
      console.log(`[${requestId}] ✗ 路由未匹配 (${method} ${pathname})，返回 404`);
      return new Response("Not Found", { 
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    } catch (error) {
      console.error(`[${requestId}] ✗✗✗ 请求处理异常 ✗✗✗`);
      console.error(`[${requestId}] 错误类型:`, error instanceof Error ? error.constructor.name : typeof error);
      console.error(`[${requestId}] 错误消息:`, error instanceof Error ? error.message : String(error));
      console.error(`[${requestId}] 错误堆栈:`, error instanceof Error ? error.stack : "无堆栈信息");
      
      const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          requestId: requestId
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ===== 请求结束，耗时: ${duration}ms =====`);
    }
  },
};

export async function handleAnalyze(request: Request, env: Env, requestId: string): Promise<Response> {
  try {
    console.log(`[${requestId}] [handleAnalyze] 开始处理分析请求`);
    
    // 检查环境变量
    if (!env.BIGMODEL_API_KEY) {
      console.error(`[${requestId}] [handleAnalyze] BIGMODEL_API_KEY 未设置`);
      return new Response(
        JSON.stringify({ 
          error: "服务器配置错误：API Key 未设置。请使用 'wrangler secret put BIGMODEL_API_KEY' 设置环境变量。" 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    console.log(`[${requestId}] [handleAnalyze] API Key 已配置（长度: ${env.BIGMODEL_API_KEY.length}）`);

    console.log(`[${requestId}] [handleAnalyze] 开始解析 FormData`);
    const formData = await request.formData();
    console.log(`[${requestId}] [handleAnalyze] FormData 解析完成`);
    
    const fileEntry = formData.get("photo");
    console.log(`[${requestId}] [handleAnalyze] 获取文件字段: ${fileEntry ? (typeof fileEntry === "string" ? "字符串类型" : "File 类型") : "未找到"}`);

    if (!fileEntry || typeof fileEntry === "string") {
      console.log(`[${requestId}] [handleAnalyze] 未找到有效的图片文件`);
      return new Response(
        JSON.stringify({ error: "请上传图片" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const file = fileEntry as File;
    console.log(`[${requestId}] [handleAnalyze] 图片文件信息:`);
    console.log(`[${requestId}]   - 文件名: ${file.name}`);
    console.log(`[${requestId}]   - 文件大小: ${file.size} bytes`);
    console.log(`[${requestId}]   - 文件类型: ${file.type}`);

    // 读取文件并转换为 base64
    console.log(`[${requestId}] [handleAnalyze] 开始读取文件内容`);
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[${requestId}] [handleAnalyze] 文件读取完成，ArrayBuffer 长度: ${arrayBuffer.byteLength}`);
    
    // 将 ArrayBuffer 转换为 base64（分块处理避免调用栈溢出）
    console.log(`[${requestId}] [handleAnalyze] 开始转换为 base64`);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192; // 每次处理 8KB
    const totalChunks = Math.ceil(bytes.length / chunkSize);
    console.log(`[${requestId}] [handleAnalyze] 需要处理 ${totalChunks} 个块`);
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
      if ((i / chunkSize) % 10 === 0) {
        console.log(`[${requestId}] [handleAnalyze] 转换进度: ${Math.round((i / bytes.length) * 100)}%`);
      }
    }
    const imageBase64 = btoa(binary);
    console.log(`[${requestId}] [handleAnalyze] Base64 转换完成，长度: ${imageBase64.length} 字符`);

    // 调用 GLM-4V 分析（传入 env 以获取 API Key）
    console.log(`[${requestId}] [handleAnalyze] 开始调用 GLM-4V API`);
    const apiStartTime = Date.now();
    const result = await analyzeImageBase64(imageBase64, env.BIGMODEL_API_KEY);
    const apiDuration = Date.now() - apiStartTime;
    console.log(`[${requestId}] [handleAnalyze] GLM-4V API 调用完成，耗时: ${apiDuration}ms`);
    console.log(`[${requestId}] [handleAnalyze] 分析结果长度: ${result.length} 字符`);

    return new Response(
      JSON.stringify({ result }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [handleAnalyze] ✗✗✗ 分析失败 ✗✗✗`);
    console.error(`[${requestId}] [handleAnalyze] 错误类型:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`[${requestId}] [handleAnalyze] 错误消息:`, error instanceof Error ? error.message : String(error));
    console.error(`[${requestId}] [handleAnalyze] 错误堆栈:`, error instanceof Error ? error.stack : "无堆栈信息");
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "分析失败",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GLM-4V 图片分析</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f5f5f7;
      color: #1a1a1a;
      line-height: 1.6;
      padding: 40px 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 680px;
      margin: 0 auto;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 40px;
      color: #1a1a1a;
      text-align: center;
    }

    /* 上传区域卡片 */
    .upload-card {
      background: #ffffff;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .upload-card-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 24px;
      color: #1a1a1a;
    }

    .file-input-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
      margin-bottom: 20px;
    }

    .file-input-label {
      display: block;
      padding: 14px 18px;
      background: #f5f5f7;
      border: 1px dashed #c0c0c2;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      color: #4a4a4a;
      text-align: center;
      transition: all 0.2s ease;
    }

    .file-input-label:hover {
      background: #eeeeef;
      border-color: #a0a0a2;
    }

    #photoInput {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }

    .image-preview {
      margin-top: 20px;
      display: none;
      text-align: center;
    }

    .image-preview.show {
      display: block;
    }

    .image-preview img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    #analyzeBtn {
      width: 100%;
      padding: 14px 24px;
      background: #1a1a1a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 20px;
    }

    #analyzeBtn:hover {
      background: #2a2a2a;
    }

    #analyzeBtn:active {
      background: #0a0a0a;
      transform: translateY(1px);
    }

    #analyzeBtn:disabled {
      background: #999;
      cursor: not-allowed;
      transform: none;
    }

    /* 分析结果卡片 */
    .result-card {
      background: #ffffff;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      padding: 32px;
      margin-top: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      display: none;
    }

    .result-card.show {
      display: block;
    }

    .result-section {
      margin-bottom: 32px;
    }

    .result-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a1a1a;
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;
    }

    .section-title.advantages {
      color: #2e7d32;
    }

    .section-title.improvements {
      color: #d84315;
    }

    .section-title.suggestions {
      color: #1565c0;
    }

    .item-list {
      list-style: none;
      padding: 0;
    }

    .item-list li {
      padding: 12px 0;
      font-size: 15px;
      line-height: 1.7;
      color: #2a2a2a;
      border-bottom: 1px solid #f5f5f7;
    }

    .item-list li:last-child {
      border-bottom: none;
    }

    .item-list li::before {
      content: "•";
      color: #999;
      margin-right: 8px;
      font-weight: bold;
    }

    .location-tag {
      display: inline-block;
      background: #f0f0f0;
      color: #666;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 8px;
      font-weight: 500;
    }

    .loading-state {
      text-align: center;
      padding: 40px 20px;
      color: #666;
      font-size: 15px;
    }

    .error-state {
      color: #d32f2f;
      padding: 20px;
      background: #ffebee;
      border-radius: 8px;
      font-size: 15px;
    }

    /* 行动引导区域 */
    .action-hint {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e8e8e8;
      text-align: center;
    }

    .action-hint-text {
      font-size: 14px;
      color: #666;
      margin-bottom: 16px;
      line-height: 1.6;
    }

    .action-hint-text strong {
      color: #1a1a1a;
      font-weight: 600;
    }

    .action-button {
      padding: 10px 20px;
      background: #f5f5f7;
      color: #1a1a1a;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-button:hover {
      background: #eeeeef;
      border-color: #a0a0a0;
    }

    @media (max-width: 640px) {
      body {
        padding: 20px 16px;
      }

      h1 {
        font-size: 24px;
        margin-bottom: 32px;
      }

      .upload-card,
      .result-card {
        padding: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GLM-4V 图片分析</h1>
    
    <!-- ① 上传区域 -->
    <div class="upload-card">
      <div class="upload-card-title">上传一张照片</div>
      
      <div class="file-input-wrapper">
        <label for="photoInput" class="file-input-label">
          点击选择图片文件
        </label>
        <input type="file" id="photoInput" accept="image/*">
      </div>

      <div class="image-preview" id="imagePreview">
        <img id="previewImg" alt="预览图片">
      </div>
      
      <button id="analyzeBtn">开始分析</button>
    </div>
    
    <!-- ② 分析结果区域 -->
    <div class="result-card" id="resultCard">
      <div id="loadingState" class="loading-state">分析中，请稍候...</div>
      
      <div id="resultContent" style="display: none;">
        <!-- 优点模块 -->
        <div class="result-section" id="advantagesSection" style="display: none;">
          <div class="section-title advantages">照片优点</div>
          <ul class="item-list" id="advantagesList"></ul>
        </div>

        <!-- 改进模块 -->
        <div class="result-section" id="improvementsSection" style="display: none;">
          <div class="section-title improvements">可以改进的地方</div>
          <ul class="item-list" id="improvementsList"></ul>
        </div>

        <!-- 建议模块 -->
        <div class="result-section" id="suggestionsSection" style="display: none;">
          <div class="section-title suggestions">下次拍摄建议</div>
          <ul class="item-list" id="suggestionsList"></ul>
        </div>

        <!-- ③ 行动引导区域 -->
        <div class="action-hint" id="actionHint" style="display: none;">
          <div class="action-hint-text" id="hintText"></div>
          <button class="action-button" id="analyzeAnotherBtn">换一张再分析</button>
        </div>
      </div>

      <div id="errorState" class="error-state" style="display: none;"></div>
    </div>
  </div>

  <script>
    const photoInput = document.getElementById("photoInput");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const resultCard = document.getElementById("resultCard");
    const imagePreview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");
    const loadingState = document.getElementById("loadingState");
    const resultContent = document.getElementById("resultContent");
    const errorState = document.getElementById("errorState");
    const advantagesSection = document.getElementById("advantagesSection");
    const improvementsSection = document.getElementById("improvementsSection");
    const suggestionsSection = document.getElementById("suggestionsSection");
    const advantagesList = document.getElementById("advantagesList");
    const improvementsList = document.getElementById("improvementsList");
    const suggestionsList = document.getElementById("suggestionsList");
    const actionHint = document.getElementById("actionHint");
    const hintText = document.getElementById("hintText");
    const analyzeAnotherBtn = document.getElementById("analyzeAnotherBtn");

    // 图片预览
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          imagePreview.classList.add("show");
        };
        reader.readAsDataURL(file);
      } else {
        imagePreview.classList.remove("show");
      }
    });

    // 解析分析结果文本
    function parseAnalysisResult(text) {
      const result = {
        advantages: [],
        improvements: [],
        suggestions: []
      };

      // 按段落分割
      const paragraphs = text.split(/\\n\\n+/).filter(p => p.trim());

      let currentSection = null;

      for (let para of paragraphs) {
        para = para.trim();
        
        // 识别优点部分
        if (para.match(/优点|优势|做得好的地方|亮点/i)) {
          currentSection = 'advantages';
          continue;
        }
        
        // 识别改进部分
        if (para.match(/改进|可以改进|不足|问题|需要/i)) {
          currentSection = 'improvements';
          continue;
        }
        
        // 识别建议部分
        if (para.match(/建议|下次拍摄|可以尝试|推荐/i)) {
          currentSection = 'suggestions';
          continue;
        }

        // 提取列表项
        const items = para.split(/\\n/).filter(item => item.trim());
        
        for (let item of items) {
          item = item.trim();
          // 移除编号和符号
          item = item.replace(/^[•\\-\\d\\.、）)]+\\s*/, '');
          
          if (!item) continue;

          // 提取位置标签（如【主体】【背景】等）
          const locationMatch = item.match(/【([^】]+)】/);
          const location = locationMatch ? locationMatch[1] : null;
          const content = item.replace(/【[^】]+】/, '').trim();

          const itemObj = { content, location };

          if (currentSection === 'advantages') {
            result.advantages.push(itemObj);
          } else if (currentSection === 'improvements') {
            result.improvements.push(itemObj);
          } else if (currentSection === 'suggestions') {
            result.suggestions.push(itemObj);
          } else {
            // 如果没有明确分类，尝试根据关键词判断
            if (item.match(/好|优秀|清晰|突出/i)) {
              result.advantages.push(itemObj);
            } else if (item.match(/改进|注意|调整/i)) {
              result.improvements.push(itemObj);
            } else if (item.match(/建议|可以|尝试|下次/i)) {
              result.suggestions.push(itemObj);
            }
          }
        }
      }

      // 如果没有解析到内容，尝试更宽松的解析
      if (result.advantages.length === 0 && result.improvements.length === 0 && result.suggestions.length === 0) {
        const lines = text.split(/\\n/).filter(l => l.trim());
        lines.forEach(line => {
          line = line.trim().replace(/^[•\\-\\d\\.、）)]+\\s*/, '');
          if (line.match(/好|优秀|清晰|突出/i)) {
            result.advantages.push({ content: line });
          } else if (line.match(/改进|注意|调整|不足/i)) {
            result.improvements.push({ content: line });
          } else if (line.match(/建议|可以|尝试|下次/i)) {
            result.suggestions.push({ content: line });
          }
        });
      }

      return result;
    }

    // 渲染分析结果
    function renderResult(parsed) {
      // 隐藏加载状态
      loadingState.style.display = "none";
      resultContent.style.display = "block";

      // 渲染优点
      if (parsed.advantages.length > 0) {
        advantagesSection.style.display = "block";
        advantagesList.innerHTML = parsed.advantages.map(item => 
          \`<li>\${item.content}</li>\`
        ).join('');
      }

      // 渲染改进
      if (parsed.improvements.length > 0) {
        improvementsSection.style.display = "block";
        improvementsList.innerHTML = parsed.improvements.map(item => 
          \`<li>\${item.location ? \`<span class="location-tag">【\${item.location}】</span>\` : ''}\${item.content}</li>\`
        ).join('');
      }

      // 渲染建议
      if (parsed.suggestions.length > 0) {
        suggestionsSection.style.display = "block";
        suggestionsList.innerHTML = parsed.suggestions.map(item => 
          \`<li>\${item.content}</li>\`
        ).join('');
      }

      // 显示行动引导
      if (parsed.suggestions.length > 0) {
        actionHint.style.display = "block";
        hintText.innerHTML = \`下次拍摄时，优先注意<strong>第 1 条建议</strong>\`;
      }
    }

    // 分析按钮点击
    analyzeBtn.addEventListener("click", async () => {
      const file = photoInput.files[0];
      if (!file) {
        resultCard.classList.add("show");
        errorState.style.display = "block";
        errorState.textContent = "请先选择图片";
        return;
      }

      // 显示加载状态
      resultCard.classList.add("show");
      loadingState.style.display = "block";
      resultContent.style.display = "none";
      errorState.style.display = "none";
      analyzeBtn.disabled = true;

      const formData = new FormData();
      formData.append("photo", file);

      try {
        const response = await fetch("/analyze", {
          method: "POST",
          body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
          const result = data.result || "无结果";
          const parsed = parseAnalysisResult(result);
          renderResult(parsed);
        } else {
          errorState.style.display = "block";
          errorState.textContent = "错误: " + (data.error || "未知错误");
        }
      } catch (error) {
        errorState.style.display = "block";
        errorState.textContent = "请求失败: " + error.message;
      } finally {
        analyzeBtn.disabled = false;
      }
    });

    // 换一张再分析
    analyzeAnotherBtn.addEventListener("click", () => {
      photoInput.value = "";
      imagePreview.classList.remove("show");
      resultCard.classList.remove("show");
      photoInput.focus();
    });
  </script>
</body>
</html>`;
}

// 类型定义
export interface Env {
  BIGMODEL_API_KEY: string;
}

// CommonJS 导出（用于 Node.js 环境）
module.exports = {
  getIndexHTML,
  handleAnalyze,
  Env: {} as Env, // 类型定义，实际运行时不需要
};
