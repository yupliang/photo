import fs from "fs";
import dotenv from "dotenv";
import { analyzeImageBase64 } from "./glmClient";

dotenv.config();

function imageToBase64(path: string): string {
  const buffer = fs.readFileSync(path);
  return buffer.toString("base64");
}

async function analyzeImage() {
  const apiKey = process.env.BIGMODEL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing BIGMODEL_API_KEY");
  }

  const imageBase64 = imageToBase64("test.jpg");
  const result = await analyzeImageBase64(imageBase64, apiKey);
  console.log(result);
}

analyzeImage().catch(console.error);
