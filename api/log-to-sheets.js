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

function buildContactLeadLink(normalizedPhone) {
  const phoneWithoutPlus = String(normalizedPhone || "").replace(/\+/g, "").trim();
  if (!phoneWithoutPlus || !phoneWithoutPlus.startsWith("234")) return "";
  return `https://cloud-30-automation-stack.vercel.app/api/contact-lead?phone=${phoneWithoutPlus}`;
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

    // Read existing leads for duplicate detection
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Leads!C:C", // Column C = Phone
    });

    const existingPhones = existingData.data.values?.flat() || [];

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

    let leadLogged = false;

    const normalizedPhone = normalizePhone(phone);
    const whatsappLink = buildContactLeadLink(normalizedPhone);
    const contacted = "NO";
    const contactedDate = "";

    // Duplicate detection
    if (existingPhones.includes(normalizedPhone)) {
      return res.status(200).json({
        success: true,
        message: "⚠ Duplicate lead skipped",
        phone: normalizedPhone,
      });
    }

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
      source || "",
      whatsappLink || "",
      contacted,
      contactedDate
    ]];

    leadLogged = true;

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Leads!A:M",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    if (leadLogged) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "SearchHistory!A:E",
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            searchId || "",
            category || "",
            searchLocation || "",
            1,
            new Date().toISOString(),
          ]],
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "✅ Data logged to Google Sheet successfully",
      response: appendResponse.data,
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
