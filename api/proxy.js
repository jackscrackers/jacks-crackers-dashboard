export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxp0OOtSZKJ_bW8kSoU7Bc7PKYNEGy9bScswDWTjN8CbxaDg9Wwp5tymCDc_6tMdq_g/exec";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    let gasRes;
    if (req.method === "POST") {
      // req.body is already parsed by Vercel — stringify it back for Apps Script
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      gasRes = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } else {
      const params = new URLSearchParams(req.query);
      gasRes = await fetch(`${GAS_URL}?${params}`);
    }
    const data = await gasRes.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
