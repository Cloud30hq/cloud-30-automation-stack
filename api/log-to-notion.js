import { Client } from "@notionhq/client";

// Initialize Notion client with token
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log("🚀 Testing Notion connection...");

    const databaseId = process.env.NOTION_DATABASE_ID;

    // Check if environment variables exist
    if (!databaseId || !process.env.NOTION_TOKEN) {
      throw new Error("⚠️ Missing Notion credentials. Check Vercel environment variables.");
    }

    // Run query on your database
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 5, // optional — just limits results
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