import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    // Parse credentials directly from environment variable
   const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const values = [
      ["Name", "Email", "Message", new Date().toISOString()] // Example data
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    res.status(200).json({
      success: true,
      message: "✅ Data logged to Google Sheet successfully",
      response: response.data,
    });
  } catch (error) {
    console.error("❌ Google Sheets API Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error,
    });
  }
}