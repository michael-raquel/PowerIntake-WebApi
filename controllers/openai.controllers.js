const client = require("../config/db");
const axios = require("axios");

const getAIResponse = async (req, res) => {
  try {
    const { message, systemPrompt } = req.body;

    console.log("[AI] Message received:", message);
    console.log("[AI] SystemPrompt length:", systemPrompt?.length);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const messages = [
      {
        role: "user",
        content: systemPrompt
          ? `${systemPrompt}\n\nNow help with this:\n${message}`
          : message
      }
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const response = await axios.post(
      `${process.env.AZURE_OPENAI_ENDPOINT2}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT2}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION2}`,
      {
        messages,
        max_completion_tokens: 5000,
        
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_OPENAI_API_KEY2
        },
        timeout: 120000
      }
    );

    const fullText = response.data.choices?.[0]?.message?.content ?? "";

    if (!fullText) {
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const words = fullText.split(/(?<=>\s*)|(?=\s*<)|(\s+)/);

    for (const word of words) {
      if (!word) continue;
      res.write(`data: ${JSON.stringify({ delta: word })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 8));
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (error) {
    console.error("[AI] Error:", error.response?.data || error.message);
    res.write(`data: ${JSON.stringify({ error: "Failed to fetch AI response" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
};

module.exports = { getAIResponse };