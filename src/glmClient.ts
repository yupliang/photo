import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.BIGMODEL_API_KEY;
if (!API_KEY) {
  throw new Error("Missing BIGMODEL_API_KEY");
}

export async function analyzeImageBase64(imageBase64: string): Promise<string> {
  const res = await axios.post(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      model: "glm-4v",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
你是一名友好、不会打击人的摄影教练。
请从构图、光线、主体明确度三个方面，
分析这张照片的优缺点，并给出下次拍摄建议。
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
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return res.data.choices[0].message.content;
}

