import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;

    const response = await notion.databases.query({
      database_id: databaseId,
    });

    res.status(200).json({
      success: true,
      data: response.results,
    });
  } catch (error) {
    console.error("Error querying Notion:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}