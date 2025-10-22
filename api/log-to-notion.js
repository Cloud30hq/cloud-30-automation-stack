import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    console.log("Database ID:", databaseId);

    const response = await notion.databases.query({
      database_id: databaseId,
    });

    res.status(200).json({
      success: true,
      data: response.results,
    });
  } catch (error) {
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      message: "Notion API failed",
      error: error.message,
      details: error.body || "No extra details",
    });
  }
}