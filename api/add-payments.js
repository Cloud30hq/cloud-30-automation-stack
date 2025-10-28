import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { orderId, amountPaid, paymentMethod, reference, payerName, notes } = req.body;

    // Validate required fields
    if (!orderId || !amountPaid || !paymentMethod || !payerName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, amountPaid, paymentMethod, payerName",
      });
    }

    // Set up Google auth
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;

    // Fetch Orders sheet to check for matching order
    const orderResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Orders!A:J",
    });

    const orders = orderResponse.data.values || [];
    const orderHeader = orders[0];
    const orderRows = orders.slice(1);

    const orderIndex = orderRows.findIndex(row => row[0] === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found`,
      });
    }

    const orderRow = orderRows[orderIndex];
    const orderPrice = parseFloat(orderRow[3]);
    const paidAmount = parseFloat(amountPaid);

    // Check if payment covers full price
    const verified = paidAmount >= orderPrice ? "TRUE" : "FALSE";

    // Create a payment record
    const paymentId = `PAY-${uuidv4().split("-")[0].toUpperCase()}`;
    const datePaid = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });

    const paymentRow = [
      paymentId,
      orderId,
      amountPaid,
      paymentMethod,
      reference || "-",
      payerName,
      datePaid,
      verified,
      notes || "",
      "System",
    ];

    // Append payment to Payments sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Payments!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [paymentRow] },
    });

    // If verified, update order status in Orders sheet
    if (verified === "TRUE") {
      const orderRowNumber = orderIndex + 2; // account for header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Orders!E${orderRowNumber}`, // Column E = status
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Paid"]] },
      });
    }

    res.status(200).json({
      success: true,
      message: "✅ Payment logged successfully",
      paymentId,
      verified,
    });

  } catch (error) {
    console.error("❌ Error adding payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add payment",
      error: error.message || error,
    });
  }
}