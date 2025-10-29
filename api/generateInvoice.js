import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import PDFDocument from "pdfkit";
import streamBuffers from "stream-buffers";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { orderId } = req.body;

    console.log("🧾 Starting invoice generation for:", req.body);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: orderId",
      });
    }

    // Authenticate Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Fetch order details
    const orderSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Order logs!A:J",
    });

    const rows = orderSheet.data.values;
    const order = rows.find((r) => r[0] === orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Extract order details
    const [id, product, quantity, price, status, customerName, email, phone, address, timestamp] = order;
    const total = Number(price) * Number(quantity);

    // Generate invoice
    const invoiceId = `INV-${uuidv4().split("-")[0].toUpperCase()}`;
    const doc = new PDFDocument();
    const stream = new streamBuffers.WritableStreamBuffer();

    doc.pipe(stream);
    doc.fontSize(20).text("INVOICE", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice ID: ${invoiceId}`);
    doc.text(`Order ID: ${id}`);
    doc.text(`Customer: ${customerName}`);
    doc.text(`Email: ${email}`);
    doc.text(`Phone: ${phone}`);
    doc.text(`Address: ${address}`);
    doc.text(`Date: ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`);
    doc.moveDown();
    doc.text(`Product: ${product}`);
    doc.text(`Quantity: ${quantity}`);
    doc.text(`Unit Price: ₦${price}`);
    doc.text(`Total: ₦${total}`);
    doc.moveDown();
    doc.text(`Status: ${status || "Pending"}`);
    doc.moveDown();
    doc.text("Thank you for your business!", { align: "center" });
    doc.end();

    const pdfBuffer = stream.getContents();

    // Upload to Google Drive
    const drive = google.drive({ version: "v3", auth });
    const fileMetadata = {
      name: `${invoiceId}.pdf`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: "application/pdf",
      body: Buffer.from(pdfBuffer),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, webViewLink",
    });

    const invoiceUrl = file.data.webViewLink;

    // Log in "Invoice Logs" sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "InvoiceLogs!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            invoiceId,
            orderId,
            customerName,
            email,
            `₦${total}`,
            "Generated",
            new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
            invoiceUrl,
          ],
        ],
      },
    });

    // Send email with invoice
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Cloud30 Sales" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Invoice - ${invoiceId}`,
      text: `Dear ${customerName},\n\nPlease find attached your invoice for Order ${orderId}.\n\nThank you for choosing Cloud30.`,
      attachments: [
        {
          filename: `${invoiceId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Invoice generated and emailed successfully",
      invoiceId,
      invoiceUrl,
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
      error: error.message,
    });
  }
}