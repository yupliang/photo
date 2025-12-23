import fs from "fs";
import { analyzeImageBase64 } from "./glmClient";

function imageToBase64(path: string): string {
  const buffer = fs.readFileSync(path);
  return buffer.toString("base64");
}

async function analyzeImage() {
  const imageBase64 = imageToBase64("test.jpg");
  const result = await analyzeImageBase64(imageBase64);
  console.log(result);
}

analyzeImage().catch(console.error);
