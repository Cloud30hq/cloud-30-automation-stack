// api/log-to-notion.js
import notionPkg from "@notionhq/client";

const Client = notionPkg?.Client ?? notionPkg?.default?.Client ?? notionPkg;
if (typeof Client !== "function") {
  // Fail fast with a clear message so logs show why
  throw new Error("Notion Client not found. Did you install @notionhq/client at project root?");
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  try {
    console.log("🚀 Testing Notion connection...");

    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!databaseId || !process.env.NOTION_TOKEN) {
      throw new Error("⚠️ Missing Notion credentials. Check Vercel environment variables.");
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 5,
    });

    console.log("✅ Notion connection successful.");
    res.status(200).json({
      success: true,
      count: response.results.length,
      results: response.results,
    });
  } catch (error) {
    console.error("🔴 Notion API Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.body || error,
    });
  }
}