import { google } from "googleapis";
import { verifyWhatsAppCompatibility } from "../lib/whatsapp-verification.js";

// Normalize Nigerian phone numbers
function normalizePhone(phone) {
  if (!phone) return "";

  // Remove spaces and symbols
  let cleaned = String(phone).replace(/[^0-9]/g, "");

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Parse credentials directly from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || "{}");
    credentials.private_key = (credentials.private_key || "").replace(/\\n/g, "\n");

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

    const payload = req.body || {};

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
    } = payload;

    let leadLogged = false;
    const contacted = "NO";
    const contactedDate = "";

    if (String(websiteStatus || "").trim().toUpperCase() !== "NO") {
      return res.status(422).json({
        success: false,
        message: "Lead skipped: website status is not NO",
        reason: "website_status_not_no",
        logged: false,
      });
    }

    const verification = await verifyWhatsAppCompatibility(phone, {
      mode: "HYBRID",
    });

    const normalizedPhone = verification.normalized?.e164 || normalizePhone(phone);
    const whatsappLink = buildContactLeadLink(normalizedPhone);

    if (verification.whatsappCompatible !== "YES") {
      return res.status(422).json({
        success: false,
        message: "Lead skipped: WhatsApp incompatible",
        reason: verification.verificationEvidence,
        whatsappCompatible: verification.whatsappCompatible,
        verificationMethod: verification.verificationMethod,
        verificationHttpCode: verification.verificationHttpCode,
        verificationEvidence: verification.verificationEvidence,
        verificationCheckedAt: verification.verificationCheckedAt,
        logged: false,
      });
    }

    // Duplicate detection
    if (existingPhones.includes(normalizedPhone)) {
      return res.status(200).json({
        success: true,
        message: "⚠ Duplicate lead skipped",
        phone: normalizedPhone,
        whatsappCompatible: verification.whatsappCompatible,
        verificationMethod: verification.verificationMethod,
        verificationHttpCode: verification.verificationHttpCode,
        verificationEvidence: verification.verificationEvidence,
        verificationCheckedAt: verification.verificationCheckedAt,
        logged: false,
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
      contactedDate,
      verification.whatsappCompatible,
      verification.verificationMethod,
      verification.verificationCheckedAt,
      String(verification.verificationHttpCode || 0),
      verification.verificationEvidence
    ]];

    leadLogged = true;

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Leads!A:R",
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
      whatsappCompatible: verification.whatsappCompatible,
      verificationMethod: verification.verificationMethod,
      verificationHttpCode: verification.verificationHttpCode,
      verificationEvidence: verification.verificationEvidence,
      verificationCheckedAt: verification.verificationCheckedAt,
      logged: true,
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
