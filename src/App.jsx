// ============================================================
// Jack's Crackers — Dashboard Backend v5
// Google Apps Script Web App
// ============================================================
// SETUP:
// 1. Open your Google Sheet -> Extensions -> Apps Script
// 2. Replace all content in the Dashboard file with this code
// 3. Run installTriggers() ONCE manually (sets up 5pm digest)
// 4. Run testPins() to confirm PINs are working before deploying
// 5. Deploy -> Manage deployments -> edit existing -> New version -> Deploy
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Your deployment URL stays the same — no need to update App.jsx
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────
const SPREADSHEET_ID   = SpreadsheetApp.getActiveSpreadsheet().getId();
const BAKE_PLANNER_TAB = "Bake Planner";
const BAKE_LOG_TAB     = "Bake Log";
const BAGGER_LOG_TAB   = "Bagger Log";
const ALERTS_TAB       = "Dashboard Alerts";
const ORDERS_TAB       = "Orders";

const ON_HAND_COLUMN   = 2;

const MANAGER_EMAIL    = "kevin@jackscrackers.com";
const DIGEST_HOUR      = 17;

// ── PIN CONFIG ────────────────────────────────────────────────
const PINS = {
  admin:  "4050",
  baker:  "2131",
  bagger: "6024",
};

const FLAVOR_ROW_MAP = {
  "Red Wine":              5,
  "White Wine":            6,
  "Tomato Basil":          7,
  "Garlic Herb":           8,
  "Buttermilk Bacon":      9,
  "Lavender Rosemary":     10,
  "Cracked Pepper & Sage": 11,
  "Spicy Chocolate Mint":  12,
  "Chocolate Graham":      13,
  "Graham Crackers":       14,
};

const SIZE_CONFIG = {
  s45:  { label: "4.5oz", oz: 4.5,  mult: 1  },
  s15:  { label: "15oz",  oz: 15,   mult: 4  },
  s450: { label: "45oz",  oz: 45,   mult: 10 },
};

// ── ROUTER ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    if      (action === "logBake")       result = logBake(data);
    else if (action === "logBagging")    result = logBagging(data);
    else if (action === "updateOnHand")  result = updateOnHand(data);
    else if (action === "getInventory")  result = getInventory();
    else if (action === "getOrders")     result = getOrders();
    else if (action === "getAlerts")     result = getAlerts();
    else if (action === "clearAlert")    result = clearAlert(data);
    else if (action === "verifyPin")     result = verifyPin(data);
    else result = { success: false, error: "Unknown action: " + action };
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e.parameter.action || "getInventory";
  let result;
  if      (action === "getInventory") result = getInventory();
  else if (action === "getOrders")    result = getOrders();
  else if (action === "getAlerts")    result = getAlerts();
  else if (action === "verifyPin")    result = verifyPin(e.parameter);
  else result = { success: false, error: "Unknown action: " + action };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── verifyPin ─────────────────────────────────────────────────
function verifyPin(data) {
  const role = String(data.role || "").trim();
  const pin  = String(data.pin  || "").trim();
  if (!PINS[role]) return { success: false, error: "Unknown role: " + role };
  const valid = pin === String(PINS[role]);
  return { success: true, valid: valid };
}

// ── DIAGNOSTIC ────────────────────────────────────────────────
function testPins() {
  Logger.log("=== PIN CONFIG CHECK ===");
  Logger.log("admin  PIN: " + (PINS.admin  !== "0000" ? "SET (" + PINS.admin.length  + " digits)" : "DEFAULT — change it"));
  Logger.log("baker  PIN: " + (PINS.baker  !== "0000" ? "SET (" + PINS.baker.length  + " digits)" : "DEFAULT — change it"));
  Logger.log("bagger PIN: " + (PINS.bagger !== "0000" ? "SET (" + PINS.bagger.length + " digits)" : "DEFAULT — change it"));
  Logger.log("");
  Logger.log("=== VERIFY TEST (using your actual PINs) ===");
  Logger.log("admin  correct PIN: " + JSON.stringify(verifyPin({ role: "admin",  pin: PINS.admin  })));
  Logger.log("baker  correct PIN: " + JSON.stringify(verifyPin({ role: "baker",  pin: PINS.baker  })));
  Logger.log("bagger correct PIN: " + JSON.stringify(verifyPin({ role: "bagger", pin: PINS.bagger })));
  Logger.log("admin  wrong PIN:   " + JSON.stringify(verifyPin({ role: "admin",  pin: "9999"      })));
  Logger.log("");
  Logger.log("=== SHEET CONFIG ===");
  Logger.log("ON_HAND_COLUMN: " + ON_HAND_COLUMN);
  Logger.log("BAKE_PLANNER_TAB: " + BAKE_PLANNER_TAB);
  Logger.log("ORDERS_TAB: " + ORDERS_TAB);
}

// ── logBake ───────────────────────────────────────────────────
function logBake(data) {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const bpSheet = ss.getSheetByName(BAKE_PLANNER_TAB);
  if (!bpSheet) throw new Error("Tab not found: " + BAKE_PLANNER_TAB);

  const flavors   = data.flavors   || {};
  const timestamp = data.timestamp || new Date().toISOString();
  const updated   = [];

  for (const [flavor, fd] of Object.entries(flavors)) {
    const row = FLAVOR_ROW_MAP[flavor];
    if (!row || !fd.bags) continue;

    let retailEquiv = 0;
    for (const [skey, cfg] of Object.entries(SIZE_CONFIG)) {
      retailEquiv += (fd.bags[skey] || 0) * cfg.mult;
    }
    if (retailEquiv <= 0) continue;

    const cell    = bpSheet.getRange(row, ON_HAND_COLUMN);
    const current = Number(cell.getValue()) || 0;
    cell.setValue(current + retailEquiv);
    updated.push({
      flavor,
      retailEquivAdded: retailEquiv,
      newOnHand: current + retailEquiv,
      bags: fd.bags,
    });
  }

  writeBakeLog(ss, timestamp, flavors);

  const subject = "Bake completed — " + formatDate(timestamp);
  const html    = buildBakeEmailHtml(timestamp, flavors, updated);
  const plain   = buildBakeEmailPlain(timestamp, flavors, updated);
  sendEmail(subject, plain, html);

  const summary = buildBakeSummaryLine(flavors);
  writeAlert(ss, "bake", timestamp, subject, summary);

  return { success: true, updated, timestamp };
}

// ── logBagging ────────────────────────────────────────────────
function logBagging(data) {
  const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  const quantities = data.quantities || {};
  const timestamp  = data.timestamp  || new Date().toISOString();

  let logSheet = ss.getSheetByName(BAGGER_LOG_TAB);
  if (!logSheet) {
    logSheet = ss.insertSheet(BAGGER_LOG_TAB);
    const h = ["Timestamp", "Flavor", "Bags Filled"];
    logSheet.appendRow(h);
    logSheet.getRange(1, 1, 1, h.length).setFontWeight("bold");
  }

  const lines = [];
  for (const [flavor, bags] of Object.entries(quantities)) {
    if (bags <= 0) continue;
    logSheet.appendRow([timestamp, flavor, bags]);
    lines.push({ flavor, bags });
  }

  const total   = lines.reduce((a, l) => a + l.bags, 0);
  const summary = lines.map(l => l.flavor + ": " + l.bags + " bags").join(" · ");
  writeAlert(ss, "bagging", timestamp,
    "Bagging session — " + total + " bag" + (total !== 1 ? "s" : "") + " filled",
    summary
  );

  return { success: true, timestamp };
}

// ── updateOnHand (Product Check) ──────────────────────────────
function updateOnHand(data) {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const bpSheet = ss.getSheetByName(BAKE_PLANNER_TAB);
  if (!bpSheet) throw new Error("Tab not found: " + BAKE_PLANNER_TAB);

  const inventory = data.inventory || {};
  const updated   = [];

  for (const [flavor, bags] of Object.entries(inventory)) {
    const row = FLAVOR_ROW_MAP[flavor];
    if (row === undefined) {
      Logger.log("updateOnHand: unknown flavor " + flavor);
      continue;
    }
    bpSheet.getRange(row, ON_HAND_COLUMN).setValue(Number(bags) || 0);
    updated.push({ flavor, bags: Number(bags) || 0 });
  }

  Logger.log("updateOnHand: updated " + updated.length + " flavors");
  return { success: true, updated };
}

// ── getAlerts ─────────────────────────────────────────────────
function getAlerts() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ALERTS_TAB);
  if (!sheet) return { success: true, alerts: [] };

  const rows   = sheet.getDataRange().getValues().slice(1);
  const alerts = rows
    .filter(r => r[4] === "unread")
    .map(r => ({
      id:        String(r[0]),
      type:      r[1],
      timestamp: r[2],
      title:     r[3],
      summary:   r[5],
    }))
    .reverse();

  return { success: true, alerts };
}

// ── clearAlert ────────────────────────────────────────────────
function clearAlert(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ALERTS_TAB);
  if (!sheet) return { success: true };

  const id   = String(data.alertId);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      sheet.getRange(i + 1, 5).setValue("read");
      break;
    }
  }
  return { success: true };
}

// ── sendDailyDigest ───────────────────────────────────────────
function sendDailyDigest() {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet   = ss.getSheetByName(BAGGER_LOG_TAB);
  if (!sheet) return;

  const tz       = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const rows     = sheet.getDataRange().getValues().slice(1);

  const todayRows = rows.filter(r => {
    try {
      return Utilities.formatDate(new Date(r[0]), tz, "yyyy-MM-dd") === todayStr;
    } catch(e) { return false; }
  });

  if (todayRows.length === 0) return;

  const totals = {};
  let lastTs   = null;
  todayRows.forEach(r => {
    const flavor = r[1];
    const bags   = Number(r[2]) || 0;
    totals[flavor] = (totals[flavor] || 0) + bags;
    if (!lastTs || new Date(r[0]) > new Date(lastTs)) lastTs = r[0];
  });

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const subject    = "Bagging summary — " + todayStr + " (" + grandTotal + " bags)";
  const plain      = buildDigestPlain(todayStr, totals, grandTotal, lastTs);
  const html       = buildDigestHtml(todayStr, totals, grandTotal, lastTs);
  sendEmail(subject, plain, html);
}

// ── getInventory ──────────────────────────────────────────────
function getInventory() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(BAKE_PLANNER_TAB);
  if (!sheet) throw new Error("Tab not found: " + BAKE_PLANNER_TAB);
  const inventory = [];
  for (const [flavor, row] of Object.entries(FLAVOR_ROW_MAP)) {
    const bags = Number(sheet.getRange(row, ON_HAND_COLUMN).getValue()) || 0;
    inventory.push({ flavor, bags, max: 60 });
  }
  return { success: true, inventory };
}

// ── getOrders ─────────────────────────────────────────────────
function getOrders() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ORDERS_TAB);
  if (!sheet) throw new Error("Tab not found: " + ORDERS_TAB);
  const data   = sheet.getDataRange().getValues();
  const orders = data.slice(1).reverse().slice(0, 20).map(row => ({
    status: row[0], customer: row[1], date: row[2],
    channel: row[3], id: row[4], notes: row[5],
  }));
  return { success: true, orders };
}

// ── INTERNAL HELPERS ──────────────────────────────────────────

function writeAlert(ss, type, timestamp, title, summary) {
  let sheet = ss.getSheetByName(ALERTS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(ALERTS_TAB);
    sheet.appendRow(["ID", "Type", "Timestamp", "Title", "Status", "Summary"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  sheet.appendRow([Date.now().toString(), type, timestamp, title, "unread", summary]);
}

function writeBakeLog(ss, timestamp, flavors) {
  let sheet = ss.getSheetByName(BAKE_LOG_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(BAKE_LOG_TAB);
    const h = ["Timestamp","Flavor","Total Oz","Size","Split Oz","Bags (complete)","Remainder Oz","Retail Equiv."];
    sheet.appendRow(h);
    sheet.getRange(1, 1, 1, h.length).setFontWeight("bold");
  }
  for (const [flavor, fd] of Object.entries(flavors)) {
    for (const [skey, cfg] of Object.entries(SIZE_CONFIG)) {
      const splitOz = (fd.split && fd.split[skey]) || 0;
      const bags    = (fd.bags  && fd.bags[skey])  || 0;
      const remOz   = (fd.rems  && fd.rems[skey])  || 0;
      if (splitOz <= 0 && bags <= 0) continue;
      sheet.appendRow([timestamp, flavor, fd.totalOz || "", cfg.label, splitOz, bags, remOz, bags * cfg.mult]);
    }
  }
}

function sendEmail(subject, plainBody, htmlBody) {
  try {
    GmailApp.sendEmail(MANAGER_EMAIL, subject, plainBody, {
      htmlBody: htmlBody || plainBody.replace(/\n/g, "<br>"),
      name: "Jack's Crackers Ops",
    });
  } catch (e) {
    Logger.log("Email send failed: " + e.message);
  }
}

function formatDate(ts) {
  try {
    return Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), "MMM d 'at' h:mm a");
  } catch(e) { return String(ts); }
}

function buildBakeSummaryLine(flavors) {
  const parts = [];
  for (const [flavor, fd] of Object.entries(flavors)) {
    if (!fd.bags) continue;
    const bagParts = [];
    for (const [skey, cfg] of Object.entries(SIZE_CONFIG)) {
      const b = fd.bags[skey] || 0;
      if (b > 0) bagParts.push(b + " x " + cfg.label);
    }
    if (bagParts.length) parts.push(flavor + ": " + bagParts.join(", "));
  }
  return parts.join(" · ");
}

function buildBakeEmailPlain(timestamp, flavors, updated) {
  let s = "Bake completed at " + formatDate(timestamp) + "\n\n";
  for (const [flavor, fd] of Object.entries(flavors)) {
    if (!fd.bags) continue;
    s += flavor + " (" + (fd.totalOz || 0) + " oz)\n";
    for (const [skey, cfg] of Object.entries(SIZE_CONFIG)) {
      const bags = fd.bags[skey] || 0;
      if (!bags) continue;
      const rem = (fd.rems && fd.rems[skey]) || 0;
      s += "  " + cfg.label + ": " + bags + " bags" + (rem > 0 ? " (rem. " + rem + " oz)" : "") + " = " + (bags * cfg.mult) + " retail\n";
    }
    s += "\n";
  }
  s += "Updated On Hand:\n";
  updated.forEach(u => { s += "  " + u.flavor + ": " + u.newOnHand + "\n"; });
  return s;
}

function buildBakeEmailHtml(timestamp, flavors, updated) {
  const W = "max-width:560px;font-family:'Courier New',monospace;font-size:13px;color:#1a1a18";
  let h = "<div style='" + W + "'>";
  h += "<div style='background:#1a1a18;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:baseline'>";
  h += "<strong>Bake completed</strong>";
  h += "<span style='font-size:11px;color:#9b9b94'>" + formatDate(timestamp) + "</span></div>";
  h += "<div style='border:1px solid #e0deda;border-top:none;border-radius:0 0 8px 8px;padding:16px 18px'>";
  for (const [flavor, fd] of Object.entries(flavors)) {
    if (!fd.bags) continue;
    h += "<div style='margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f4f3ef'>";
    h += "<div style='font-weight:bold;margin-bottom:8px'>" + flavor;
    h += " <span style='font-weight:normal;color:#9b9b94;font-size:11px'>" + (fd.totalOz || 0) + " oz</span></div>";
    h += "<div style='display:flex;gap:8px;flex-wrap:wrap'>";
    for (const [skey, cfg] of Object.entries(SIZE_CONFIG)) {
      const bags = fd.bags[skey] || 0;
      if (!bags) continue;
      const rem = (fd.rems && fd.rems[skey]) || 0;
      h += "<span style='background:#f4f3ef;border-radius:6px;padding:5px 10px;font-size:12px'>";
      h += "<strong>" + bags + "</strong> x " + cfg.label;
      if (rem > 0) h += " <span style='color:#BA7517'>(rem. " + rem + " oz)</span>";
      h += " <span style='color:#9b9b94'>= " + (bags * cfg.mult) + " retail</span></span>";
    }
    h += "</div></div>";
  }
  h += "<div style='margin-top:4px'>";
  h += "<div style='font-size:10px;color:#9b9b94;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px'>Updated On Hand</div>";
  updated.forEach(u => {
    const pct   = Math.min(100, Math.round(u.newOnHand / 60 * 100));
    const color = pct > 40 ? "#639922" : pct > 20 ? "#BA7517" : "#D85A30";
    h += "<div style='display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:12px'>";
    h += "<span style='min-width:160px'>" + u.flavor + "</span>";
    h += "<div style='flex:1;height:5px;background:#e0deda;border-radius:3px;overflow:hidden'>";
    h += "<div style='width:" + pct + "%;height:100%;background:" + color + "'></div></div>";
    h += "<span style='color:#6b6b65;min-width:36px;text-align:right'>" + u.newOnHand + "</span></div>";
  });
  h += "</div></div></div>";
  return h;
}

function buildDigestPlain(dateStr, totals, grandTotal, lastTs) {
  let s = "Daily Bagging Summary — " + dateStr + "\n\n";
  s += "Total bags filled: " + grandTotal + "\n\n";
  for (const [flavor, bags] of Object.entries(totals)) {
    s += "  " + flavor + ": " + bags + " bags\n";
  }
  s += "\nLast session: " + formatDate(lastTs);
  s += "\nFull detail in the Bagger Log tab of your Google Sheet.";
  return s;
}

function buildDigestHtml(dateStr, totals, grandTotal, lastTs) {
  const W = "max-width:560px;font-family:'Courier New',monospace;font-size:13px;color:#1a1a18";
  let h = "<div style='" + W + "'>";
  h += "<div style='background:#1a1a18;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:baseline'>";
  h += "<strong>Daily Bagging Summary</strong>";
  h += "<span style='font-size:11px;color:#9b9b94'>" + dateStr + "</span></div>";
  h += "<div style='border:1px solid #e0deda;border-top:none;border-radius:0 0 8px 8px;padding:16px 18px'>";
  h += "<div style='background:#f4f3ef;border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center'>";
  h += "<span style='color:#6b6b65'>Total bags filled today</span>";
  h += "<strong style='font-size:20px'>" + grandTotal + "</strong></div>";
  h += "<div style='font-size:10px;color:#9b9b94;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px'>By Flavor</div>";
  for (const [flavor, bags] of Object.entries(totals)) {
    h += "<div style='display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f4f3ef;font-size:12px'>";
    h += "<span>" + flavor + "</span><strong>" + bags + " bag" + (bags !== 1 ? "s" : "") + "</strong></div>";
  }
  h += "<div style='margin-top:14px;font-size:11px;color:#9b9b94'>Last session: " + formatDate(lastTs) + "</div>";
  h += "<div style='margin-top:3px;font-size:11px;color:#9b9b94'>Full detail in the Bagger Log tab of your Google Sheet.</div>";
  h += "</div></div>";
  return h;
}

// ── TRIGGER INSTALLER ─────────────────────────────────────────
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendDailyDigest") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("sendDailyDigest")
    .timeBased()
    .everyDays(1)
    .atHour(DIGEST_HOUR)
    .create();
  Logger.log("Daily digest trigger installed for " + DIGEST_HOUR + ":00 in timezone: " + Session.getScriptTimeZone());
}

function checkTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    Logger.log("No triggers installed. Run installTriggers().");
  } else {
    triggers.forEach(t => Logger.log(t.getHandlerFunction() + " — " + t.getTriggerSource()));
  }
}