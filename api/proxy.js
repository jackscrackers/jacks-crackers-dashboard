export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbzy58OU7c0PIq8QI4tNRAbo06_tUJ8d7EsL8bUS8WB6pj0VhE6Kp7uz_fy3Byv6Pn4P/exec";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const params = new URLSearchParams(req.query);
      const gasRes = await fetch(`${GAS_URL}?${params}`);
      const data = await gasRes.json();
      return res.status(200).json(data);
    }

    // For POST — read raw body so nothing gets lost
    const rawBody = await new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    });
    const data = await gasRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
