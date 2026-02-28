import { google } from "googleapis";
import fetch from "node-fetch"; // to call Paystack API

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { reference, orderId } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: "Payment reference is required" });
    }

    // Step 1: Verify Paystack payment
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });

    const data = await response.json();

    if (!data.status || data.data.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed or incomplete",
        details: data,
      });
    }

    // Step 2: Extract details
    const transaction = data.data;
    const amount = transaction.amount / 100; // convert kobo to naira
    const customerName = transaction.customer.name || "N/A";
    const email = transaction.customer.email;
    const paymentMethod = transaction.channel;
    const status = transaction.status;
    const paymentId = `PAY-${reference.slice(-6).toUpperCase()}`;

    // Step 3: Log to Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const paymentRow = [
      paymentId,
      orderId || "N/A",
      amount,
      paymentMethod,
      status,
      customerName,
      email,
      new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Payments!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [paymentRow] },
    });

    // Step 4: Return response
    res.status(200).json({
      success: true,
      message: "✅ Paystack payment verified and logged successfully",
      paymentId,
      data: paymentRow,
    });

  } catch (error) {
    console.error("❌ Paystack verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify and log Paystack payment",
      error: error.message || error,
    });
  }
}