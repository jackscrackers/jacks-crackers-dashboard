export const config = { api: { bodyParser: false } };

const GAS_URL = "https://script.google.com/macros/s/AKfycbzy58OU7c0PIq8QI4tNRAbo06_tUJ8d7EsL8bUS8WB6pj0VhE6Kp7uz_fy3Byv6Pn4P/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const params = new URLSearchParams(req.query);
      const gasRes = await fetch(`${GAS_URL}?${params}`, { redirect: "follow" });
      const data = await gasRes.json();
      return res.status(200).json(data);
    }

    // Read raw POST body
    const rawBody = await new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

    // Step 1: POST to GAS without following redirect.
    // GAS processes the body on this request, then returns 302.
    const firstRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
      redirect: "manual",
    });

    // Step 2: GET the Location URL — the redirect endpoint only accepts GET.
    // This retrieves the JSON response GAS already prepared in step 1.
    const location = firstRes.headers.get("location");
    if (!location) {
      return res.status(500).json({ success: false, error: "No redirect location from GAS" });
    }

    const finalRes = await fetch(location, { method: "GET" });
    const data = await finalRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
