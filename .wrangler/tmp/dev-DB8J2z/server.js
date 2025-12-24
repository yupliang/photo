var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-W7vrpy/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-W7vrpy/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/glmClient.ts
async function analyzeImageBase64(imageBase64, apiKey) {
  if (!apiKey) {
    throw new Error("Missing BIGMODEL_API_KEY");
  }
  const res = await fetch(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-4v",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
\u4F60\u662F\u4E00\u540D\u53CB\u597D\u3001\u4E0D\u4F1A\u6253\u51FB\u4EBA\u7684\u6444\u5F71\u6559\u7EC3\u3002
\u8BF7\u4ECE\u6784\u56FE\u3001\u5149\u7EBF\u3001\u4E3B\u4F53\u660E\u786E\u5EA6\u4E09\u4E2A\u65B9\u9762\uFF0C
\u5206\u6790\u8FD9\u5F20\u7167\u7247\u7684\u4F18\u7F3A\u70B9\uFF0C\u5E76\u7ED9\u51FA\u4E0B\u6B21\u62CD\u6444\u5EFA\u8BAE\u3002
                `.trim()
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      })
    }
  );
  if (!res.ok) {
    throw new Error(`API request failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}
__name(analyzeImageBase64, "analyzeImageBase64");

// src/server.ts
var server_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(getIndexHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (url.pathname === "/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function handleAnalyze(request, env) {
  try {
    if (!env.BIGMODEL_API_KEY) {
      console.error("BIGMODEL_API_KEY \u672A\u8BBE\u7F6E");
      return new Response(
        JSON.stringify({
          error: "\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF\uFF1AAPI Key \u672A\u8BBE\u7F6E\u3002\u8BF7\u4F7F\u7528 'wrangler secret put BIGMODEL_API_KEY' \u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF\u3002"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const formData = await request.formData();
    const fileEntry = formData.get("photo");
    if (!fileEntry || typeof fileEntry === "string") {
      return new Response(
        JSON.stringify({ error: "\u8BF7\u4E0A\u4F20\u56FE\u7247" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const file = fileEntry;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const imageBase64 = btoa(binary);
    const result = await analyzeImageBase64(imageBase64, env.BIGMODEL_API_KEY);
    return new Response(
      JSON.stringify({ result }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("\u5206\u6790\u5931\u8D25:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "\u5206\u6790\u5931\u8D25"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
__name(handleAnalyze, "handleAnalyze");
function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GLM-4V \u56FE\u7247\u5206\u6790</title>
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

    /* \u4E0A\u4F20\u533A\u57DF\u5361\u7247 */
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

    /* \u5206\u6790\u7ED3\u679C\u5361\u7247 */
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
      content: "\u2022";
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

    /* \u884C\u52A8\u5F15\u5BFC\u533A\u57DF */
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
    <h1>GLM-4V \u56FE\u7247\u5206\u6790</h1>
    
    <!-- \u2460 \u4E0A\u4F20\u533A\u57DF -->
    <div class="upload-card">
      <div class="upload-card-title">\u4E0A\u4F20\u4E00\u5F20\u7167\u7247</div>
      
      <div class="file-input-wrapper">
        <label for="photoInput" class="file-input-label">
          \u70B9\u51FB\u9009\u62E9\u56FE\u7247\u6587\u4EF6
        </label>
        <input type="file" id="photoInput" accept="image/*">
      </div>

      <div class="image-preview" id="imagePreview">
        <img id="previewImg" alt="\u9884\u89C8\u56FE\u7247">
      </div>
      
      <button id="analyzeBtn">\u5F00\u59CB\u5206\u6790</button>
    </div>
    
    <!-- \u2461 \u5206\u6790\u7ED3\u679C\u533A\u57DF -->
    <div class="result-card" id="resultCard">
      <div id="loadingState" class="loading-state">\u5206\u6790\u4E2D\uFF0C\u8BF7\u7A0D\u5019...</div>
      
      <div id="resultContent" style="display: none;">
        <!-- \u4F18\u70B9\u6A21\u5757 -->
        <div class="result-section" id="advantagesSection" style="display: none;">
          <div class="section-title advantages">\u7167\u7247\u4F18\u70B9</div>
          <ul class="item-list" id="advantagesList"></ul>
        </div>

        <!-- \u6539\u8FDB\u6A21\u5757 -->
        <div class="result-section" id="improvementsSection" style="display: none;">
          <div class="section-title improvements">\u53EF\u4EE5\u6539\u8FDB\u7684\u5730\u65B9</div>
          <ul class="item-list" id="improvementsList"></ul>
        </div>

        <!-- \u5EFA\u8BAE\u6A21\u5757 -->
        <div class="result-section" id="suggestionsSection" style="display: none;">
          <div class="section-title suggestions">\u4E0B\u6B21\u62CD\u6444\u5EFA\u8BAE</div>
          <ul class="item-list" id="suggestionsList"></ul>
        </div>

        <!-- \u2462 \u884C\u52A8\u5F15\u5BFC\u533A\u57DF -->
        <div class="action-hint" id="actionHint" style="display: none;">
          <div class="action-hint-text" id="hintText"></div>
          <button class="action-button" id="analyzeAnotherBtn">\u6362\u4E00\u5F20\u518D\u5206\u6790</button>
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

    // \u56FE\u7247\u9884\u89C8
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

    // \u89E3\u6790\u5206\u6790\u7ED3\u679C\u6587\u672C
    function parseAnalysisResult(text) {
      const result = {
        advantages: [],
        improvements: [],
        suggestions: []
      };

      // \u6309\u6BB5\u843D\u5206\u5272
      const paragraphs = text.split(/\\n\\n+/).filter(p => p.trim());

      let currentSection = null;

      for (let para of paragraphs) {
        para = para.trim();
        
        // \u8BC6\u522B\u4F18\u70B9\u90E8\u5206
        if (para.match(/\u4F18\u70B9|\u4F18\u52BF|\u505A\u5F97\u597D\u7684\u5730\u65B9|\u4EAE\u70B9/i)) {
          currentSection = 'advantages';
          continue;
        }
        
        // \u8BC6\u522B\u6539\u8FDB\u90E8\u5206
        if (para.match(/\u6539\u8FDB|\u53EF\u4EE5\u6539\u8FDB|\u4E0D\u8DB3|\u95EE\u9898|\u9700\u8981/i)) {
          currentSection = 'improvements';
          continue;
        }
        
        // \u8BC6\u522B\u5EFA\u8BAE\u90E8\u5206
        if (para.match(/\u5EFA\u8BAE|\u4E0B\u6B21\u62CD\u6444|\u53EF\u4EE5\u5C1D\u8BD5|\u63A8\u8350/i)) {
          currentSection = 'suggestions';
          continue;
        }

        // \u63D0\u53D6\u5217\u8868\u9879
        const items = para.split(/\\n/).filter(item => item.trim());
        
        for (let item of items) {
          item = item.trim();
          // \u79FB\u9664\u7F16\u53F7\u548C\u7B26\u53F7
          item = item.replace(/^[\u2022\\-\\d\\.\u3001\uFF09)]+\\s*/, '');
          
          if (!item) continue;

          // \u63D0\u53D6\u4F4D\u7F6E\u6807\u7B7E\uFF08\u5982\u3010\u4E3B\u4F53\u3011\u3010\u80CC\u666F\u3011\u7B49\uFF09
          const locationMatch = item.match(/\u3010([^\u3011]+)\u3011/);
          const location = locationMatch ? locationMatch[1] : null;
          const content = item.replace(/\u3010[^\u3011]+\u3011/, '').trim();

          const itemObj = { content, location };

          if (currentSection === 'advantages') {
            result.advantages.push(itemObj);
          } else if (currentSection === 'improvements') {
            result.improvements.push(itemObj);
          } else if (currentSection === 'suggestions') {
            result.suggestions.push(itemObj);
          } else {
            // \u5982\u679C\u6CA1\u6709\u660E\u786E\u5206\u7C7B\uFF0C\u5C1D\u8BD5\u6839\u636E\u5173\u952E\u8BCD\u5224\u65AD
            if (item.match(/\u597D|\u4F18\u79C0|\u6E05\u6670|\u7A81\u51FA/i)) {
              result.advantages.push(itemObj);
            } else if (item.match(/\u6539\u8FDB|\u6CE8\u610F|\u8C03\u6574/i)) {
              result.improvements.push(itemObj);
            } else if (item.match(/\u5EFA\u8BAE|\u53EF\u4EE5|\u5C1D\u8BD5|\u4E0B\u6B21/i)) {
              result.suggestions.push(itemObj);
            }
          }
        }
      }

      // \u5982\u679C\u6CA1\u6709\u89E3\u6790\u5230\u5185\u5BB9\uFF0C\u5C1D\u8BD5\u66F4\u5BBD\u677E\u7684\u89E3\u6790
      if (result.advantages.length === 0 && result.improvements.length === 0 && result.suggestions.length === 0) {
        const lines = text.split(/\\n/).filter(l => l.trim());
        lines.forEach(line => {
          line = line.trim().replace(/^[\u2022\\-\\d\\.\u3001\uFF09)]+\\s*/, '');
          if (line.match(/\u597D|\u4F18\u79C0|\u6E05\u6670|\u7A81\u51FA/i)) {
            result.advantages.push({ content: line });
          } else if (line.match(/\u6539\u8FDB|\u6CE8\u610F|\u8C03\u6574|\u4E0D\u8DB3/i)) {
            result.improvements.push({ content: line });
          } else if (line.match(/\u5EFA\u8BAE|\u53EF\u4EE5|\u5C1D\u8BD5|\u4E0B\u6B21/i)) {
            result.suggestions.push({ content: line });
          }
        });
      }

      return result;
    }

    // \u6E32\u67D3\u5206\u6790\u7ED3\u679C
    function renderResult(parsed) {
      // \u9690\u85CF\u52A0\u8F7D\u72B6\u6001
      loadingState.style.display = "none";
      resultContent.style.display = "block";

      // \u6E32\u67D3\u4F18\u70B9
      if (parsed.advantages.length > 0) {
        advantagesSection.style.display = "block";
        advantagesList.innerHTML = parsed.advantages.map(item => 
          \`<li>\${item.content}</li>\`
        ).join('');
      }

      // \u6E32\u67D3\u6539\u8FDB
      if (parsed.improvements.length > 0) {
        improvementsSection.style.display = "block";
        improvementsList.innerHTML = parsed.improvements.map(item => 
          \`<li>\${item.location ? \`<span class="location-tag">\u3010\${item.location}\u3011</span>\` : ''}\${item.content}</li>\`
        ).join('');
      }

      // \u6E32\u67D3\u5EFA\u8BAE
      if (parsed.suggestions.length > 0) {
        suggestionsSection.style.display = "block";
        suggestionsList.innerHTML = parsed.suggestions.map(item => 
          \`<li>\${item.content}</li>\`
        ).join('');
      }

      // \u663E\u793A\u884C\u52A8\u5F15\u5BFC
      if (parsed.suggestions.length > 0) {
        actionHint.style.display = "block";
        hintText.innerHTML = \`\u4E0B\u6B21\u62CD\u6444\u65F6\uFF0C\u4F18\u5148\u6CE8\u610F<strong>\u7B2C 1 \u6761\u5EFA\u8BAE</strong>\`;
      }
    }

    // \u5206\u6790\u6309\u94AE\u70B9\u51FB
    analyzeBtn.addEventListener("click", async () => {
      const file = photoInput.files[0];
      if (!file) {
        resultCard.classList.add("show");
        errorState.style.display = "block";
        errorState.textContent = "\u8BF7\u5148\u9009\u62E9\u56FE\u7247";
        return;
      }

      // \u663E\u793A\u52A0\u8F7D\u72B6\u6001
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
          const result = data.result || "\u65E0\u7ED3\u679C";
          const parsed = parseAnalysisResult(result);
          renderResult(parsed);
        } else {
          errorState.style.display = "block";
          errorState.textContent = "\u9519\u8BEF: " + (data.error || "\u672A\u77E5\u9519\u8BEF");
        }
      } catch (error) {
        errorState.style.display = "block";
        errorState.textContent = "\u8BF7\u6C42\u5931\u8D25: " + error.message;
      } finally {
        analyzeBtn.disabled = false;
      }
    });

    // \u6362\u4E00\u5F20\u518D\u5206\u6790
    analyzeAnotherBtn.addEventListener("click", () => {
      photoInput.value = "";
      imagePreview.classList.remove("show");
      resultCard.classList.remove("show");
      photoInput.focus();
    });
  <\/script>
</body>
</html>`;
}
__name(getIndexHTML, "getIndexHTML");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-W7vrpy/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = server_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-W7vrpy/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=server.js.map
