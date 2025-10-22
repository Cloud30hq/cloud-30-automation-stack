// api/log-to-notion.js

const { Client } = require("@notionhq/client");

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

module.exports = async (req, res) => {
  try {
    console.log("Testing Notion connection...");

    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
    });

    res.status(200).json({
      success: true,
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
};