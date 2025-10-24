import { Client } from "@notionhq/client";

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

// ✅ Exported API handler (for Vercel)
export default async function handler(req, res) {
  try {
    console.log("🚀 Testing Notion connection...");
    const response = await notion.databases.query({ database_id: databaseId });
    console.log("✅ Notion connection successful.");

    res.status(200).json({
      success: true,
      count: response.results.length,
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

// ✅ Direct-run block (for local testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.log("🧠 Running Notion connection test (local mode)...");
      const response = await notion.databases.query({ database_id: databaseId });
      console.log("✅ Connection successful!");
      console.log("📄 Retrieved pages:", response.results.length);
    } catch (error) {
      console.error("❌ Failed to query Notion:", error.message);
      console.error(error);
    }
  })();
}