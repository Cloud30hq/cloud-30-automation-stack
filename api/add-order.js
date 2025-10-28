import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { product, quantity, price, status, customerName, email, phone, address } = req.body;

    if (!product || !quantity || !price || !customerName || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;

    // 1️⃣ Fetch existing customers
    const customerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Customers!A2:E", // Adjust range based on your columns
    });

    const customers = customerResponse.data.values || [];
    let existingCustomer = customers.find(
      (row) => row[2] === email || row[3] === phone
    );

    let customerId;

    // 2️⃣ If customer exists, reuse their ID — else, create new
    if (existingCustomer) {
      customerId = existingCustomer[0];
    } else {
      customerId = `CUST-${uuidv4().split("-")[0].toUpperCase()}`;
      const newCustomer = [
        customerId,
        customerName,
        email,
        phone,
        address,
        new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Customers!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [newCustomer] },
      });
    }

    // 3️⃣ Log the order
    const orderId = `ORD-${uuidv4().split("-")[0].toUpperCase()}`;
    const orderRow = [
      orderId,
      customerId,
      product,
      quantity,
      price,
      status || "Pending",
      customerName,
      email,
      phone,
      address,
      new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Order-Log!A:K",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [orderRow] },
    });

    res.status(200).json({
      success: true,
      message: "✅ Order + Customer automation complete",
      orderId,
      customerId,
    });
  } catch (error) {
    console.error("❌ Integration Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add order and link customer",
      error: error.message || error,
    });
  }
}