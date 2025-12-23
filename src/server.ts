import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeImageBase64 } from "./glmClient";

const app = express();
const upload = multer({ dest: "uploads/" });

// 确保 uploads 目录存在
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// 提供静态文件服务
app.use(express.static(path.join(__dirname, "..", "public")));

// 图片分析接口
app.post("/analyze", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片" });
    }

    // 读取上传的文件并转换为 base64
    const fileBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = fileBuffer.toString("base64");

    // 调用 GLM-4V 分析
    const result = await analyzeImageBase64(imageBase64);

    // 清理临时文件
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("删除临时文件失败:", err);
    });

    res.json({ result });
  } catch (error) {
    console.error("分析失败:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "分析失败" 
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

