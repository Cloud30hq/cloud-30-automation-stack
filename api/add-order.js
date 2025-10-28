import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid"; // For unique order IDs

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { product, quantity, price, status, customerName, email, phone, address } = req.body;

    // Validate required fields
    if (!product || !quantity || !price || !customerName || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: product, quantity, price, customerName, email, phone, address",
      });
    }

    // Generate a unique order ID
    const orderId = `ORD-${uuidv4().split("-")[0].toUpperCase()}`;

    // Parse Google credentials from Vercel environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Prepare order row to match your columns (A–J)
    const orderRow = [
      orderId,
      product,
      quantity,
      price,
      status || "Pending", // default if not provided
      customerName,
      email,
      phone,
      address,
      new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
    ];

    // Append the order to your Orders sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [orderRow] },
    });

    res.status(200).json({
      success: true,
      message: "✅ Order logged successfully",
      orderId,
      data: response.data.updates,
    });
  } catch (error) {
    console.error("❌ Error adding order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add order",
      error: error.message || error,
    });
  }
}