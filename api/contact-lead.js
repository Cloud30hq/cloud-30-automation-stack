import { google } from "googleapis";

function normalizePhone(phone) {
  if (!phone) return "";

  let cleaned = String(phone).replace(/[^0-9]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  }

  if (cleaned.startsWith("234")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || "{}");
    credentials.private_key = (credentials.private_key || "").replace(/\\n/g, "\n");

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const {
      phone,
      searchId,
      whatsappLink = "",
      contacted = "NO",
      response = "",
    } = req.body || {};

    if (!phone && !searchId) {
      return res.status(400).json({
        success: false,
        message: "phone or searchId is required",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Leads!A:M",
    });

    const rows = data.data.values || [];

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No leads found",
      });
    }

    // Row 1 is assumed to be headers, so updates start from row 2.
    let targetRow = -1;

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const rowPhone = normalizePhone(row[2] || ""); // Column C
      const rowSearchId = String(row[7] || "").trim(); // Column H

      const phoneMatch = normalizedPhone && rowPhone === normalizedPhone;
      const searchIdMatch = searchId && rowSearchId === String(searchId).trim();

      if (phoneMatch || searchIdMatch) {
        targetRow = i + 1; // Sheets are 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Leads!K${targetRow}:M${targetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          whatsappLink || "",
          contacted || "NO",
          response || "",
        ]],
      },
    });

    return res.status(200).json({
      success: true,
      message: "Lead outreach updated successfully",
      row: targetRow,
      phone: normalizedPhone || null,
      searchId: searchId || null,
    });
  } catch (error) {
    console.error("contact-lead API error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      details: error,
    });
  }
}
