import { google } from "googleapis";

// Normalize Nigerian phone numbers
function normalizePhone(phone) {
  if (!phone) return "";

  // Remove spaces and symbols
  let cleaned = phone.replace(/[^0-9]/g, "");

  // Convert formats to +234XXXXXXXXXX
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  }

  if (cleaned.startsWith("234")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

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

    const {
      businessName,
      area,
      phone,
      websiteStatus,
      evidence,
      category,
      searchLocation,
      searchId,
      source
    } = req.body;

    const normalizedPhone = normalizePhone(phone);

    const values = [[
      businessName || "",
      area || "",
      normalizedPhone || "",
      websiteStatus || "",
      evidence || "",
      category || "",
      searchLocation || "",
      searchId || "",
      new Date().toISOString(),
      source || ""
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Leads!A:J",
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
