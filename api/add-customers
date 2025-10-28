import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { name, email, phone, address } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, phone, address",
      });
    }

    // Parse Google credentials
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Spreadsheet ID from environment
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Get existing customers to check for duplicates
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Customers!A:F",
    });

    const rows = existing.data.values || [];

    // Check for duplicate email or phone
    const duplicate = rows.find(
      (row) => row[2] === email || row[3] === phone
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists (duplicate email or phone).",
      });
    }

    // Create customer ID
    const customerId = `CUS-${uuidv4().split("-")[0].toUpperCase()}`;

    const newCustomer = [
      customerId,
      name,
      email,
      phone,
      address,
      new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
    ];

    // Append to Google Sheets
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Customers!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newCustomer] },
    });

    res.status(200).json({
      success: true,
      message: "✅ Customer added successfully",
      customerId,
      data: response.data.updates,
    });
  } catch (error) {
    console.error("❌ Error adding customer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add customer",
      error: error.message || error,
    });
  }
}