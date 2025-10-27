import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    orderId,
    product,
    quantity,
    price,
    status,
    customerName,
    email,
    phone,
    address,
  } = req.body;

  if (!orderId || !product || !quantity || !price || !customerName) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "Orders!A:J"; // Updated range

    const newRow = [
      orderId,
      product,
      quantity,
      price,
      status || "Pending",
      customerName,
      email || "",
      phone || "",
      address || "",
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newRow] },
    });

    res.status(200).json({ message: "Order added successfully" });
  } catch (error) {
    console.error("Error adding order:", error);
    res.status(500).json({ message: "Failed to add order", error });
  }
}