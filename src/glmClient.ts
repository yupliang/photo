async function analyzeImageBase64(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing BIGMODEL_API_KEY");
  }

  const res = await fetch(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
你是一名友好、不会打击人的摄影教练。
请从构图、光线、主体明确度三个方面，
分析这张照片的优缺点，并给出下次拍摄建议。
                `.trim(),
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`API request failed: ${res.statusText}`);
  }

  const data = await res.json() as {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };
  return data.choices[0].message.content;
}

module.exports = { analyzeImageBase64 };
