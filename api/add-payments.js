import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Extract payment data
    const {
      orderId,
      amount,
      method,
      status,
      customerName,
      email,
      phone,
      transactionId,
      reference,
    } = req.body;

    const timestamp = new Date().toLocaleString();

    // Authenticate Google Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ✅ Use same spreadsheet ID already in use for Orders
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // ✅ Use new sheet tab for payments (same structure logic)
    const range = "Payment logs!A:J"; // must match the actual sheet tab name in Google Sheets

    // Prepare new payment record
    const newRow = [
      orderId || `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
      amount,
      method,
      status,
      customerName,
      email,
      phone,
      transactionId || "-",
      reference || "-",
      timestamp,
    ];

    // Append payment record to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [newRow],
      },
    });

    res.status(200).json({
      success: true,
      message: "✅ Payment logged successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add payment",
      error: error.message,
    });
  }
}