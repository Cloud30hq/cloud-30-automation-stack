export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    // simple validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // simulate sending or saving message
    console.log('New message received:', { name, email, message });

    // success response
    return res.status(200).json({ message: 'Message received successfully!' });
  } else {
    // if method isn't POST
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}