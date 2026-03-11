import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

/**
 * POST /api/chat
 * Handle AI chat for book recommendations using Groq (Llama 3)
 */
export const chatWithAI = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({
                ok: false,
                message: "Message is required",
            });
        }

        if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
            return res.status(500).json({
                ok: false,
                message: "GROQ_API_KEY is missing or not configured in .env",
            });
        }

        // Fetch limited books for context
        const { data: books, error } = await supabase
            .from("books")
            .select("id,title,author,description")
            .limit(50);

        if (error) {
            console.error("Supabase error:", error);
            return res.status(500).json({
                ok: false,
                message: "Failed to fetch book catalog for context",
            });
        }

        // Format catalog
        const bookContext = books
            .map(
                (b) =>
                    `- ID: ${b.id}, Title: "${b.title}", Author: "${b.author}", Description: "${b.description || "N/A"}"`
            )
            .join("\n");

        const systemPrompt = `
You are a helpful and friendly Librarian Assistant for the "BookHub" mobile app. 
Your goal is to help students discover books from our library catalog.

LIBRARY CATALOG:
${bookContext}

INSTRUCTIONS:
1. Recommend books ONLY from the LIBRARY CATALOG provided above.
2. Suggest 1-3 books maximum per response.
3. For each recommended book, YOU MUST include its ID in this exact format: [BOOK_ID: <id>]. 
   Example: "Tôi gợi ý cuốn 'Lập trình Node.js' [BOOK_ID: 15] vì nó rất phù hợp với bạn."
4. Respond entirely in Vietnamese.
5. Be concise, friendly, and encouraging.
6. If the student asks for something not in the catalog, suggest the closest match or ask for more details about their interests.
7. Only discuss books and library-related topics.
`;

        // Map history to OpenAI format
        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map((h) => ({
                role: h.role === "user" ? "user" : "assistant",
                content: h.content,
            })),
            { role: "user", content: message },
        ];

        console.log(`Sending request to Groq (Llama 3)`);

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const responseText = completion.choices[0]?.message?.content || "Xin lỗi, tôi không thể xử lý yêu cầu lúc này.";

        return res.status(200).json({
            ok: true,
            data: {
                content: responseText,
            },
        });
    } catch (err) {
        console.error("Groq AI Chat Error:", err);

        return res.status(500).json({
            ok: false,
            message: "AI processing failed with Groq",
            error: err.message,
        });
    }
};