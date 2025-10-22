import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, message } = req.body;

  // Connect to Notion using your API key
  const notion = new Client({ auth: process.env.NOTION_KEY });

  try {
    // Add a new row (page) to your Notion database
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: name || "Unknown" } }] },
        Email: { email: email || "N/A" },
        Message: { rich_text: [{ text: { content: message || "" } }] },
        Timestamp: { date: { start: new Date().toISOString() } },
      },
    });

    res.status(200).json({ success: true, message: "Logged to Notion successfully!" });
  } catch (error) {
    console.error("Notion Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}