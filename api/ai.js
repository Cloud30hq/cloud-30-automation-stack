// api/ai.js

export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "Hello from your new AI endpoint 🚀"
  });
}