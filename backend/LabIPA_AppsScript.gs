/* ============================================================
   LAB IPA ALKHAIRIYAH – BOOKING + INVENTORY SYSTEM (MULTI-LAB)
   PUBLIC / GITHUB-SAFE CONFIG
   ============================================================ */

/* ================================
      BOOKING SPREADSHEET
================================ */
const SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") ||
  "YOUR_SPREADSHEET_ID_HERE";
const SHEET_NAME = "Bookings";

/* ================================
      INVENTORY SPREADSHEET
================================ */
const INVENTORY_SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("INVENTORY_SPREADSHEET_ID") ||
  "YOUR_INVENTORY_SPREADSHEET_ID_HERE";
const INVENTORY_MASTER_SHEET = "MASTER_DATA";

// Borrowing sheet (add-only)
const INVENTORY_BORROW_SHEET = "INVENTARIS_PINJAM";

// Inventory log sheet (add-only)
const INVENTORY_LOG_SHEET = "INVENTARIS_LOG";

// Auto-request rows for booking (planning only; no stock mutation)
const INVENTORY_REQUEST_STATUS = {
  REQUESTED: "REQUESTED",
  BORROWED: "BORROWED",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
};

// Timestamp columns in MASTER_DATA (add-only)
const INVENTORY_CREATED_AT_COL = "TANGGAL INPUT";
const INVENTORY_UPDATED_AT_COL = "TERAKHIR UPDATE";

/* ================================
      CALENDAR & EMAIL CONFIG
================================ */
const LAB_CALENDAR_ID_SD1_SMP =
  PropertiesService.getScriptProperties().getProperty("LAB_CALENDAR_ID_SD1_SMP") ||
  "YOUR_LAB_CALENDAR_ID_SD1_SMP_HERE";

const LAB_CALENDAR_ID_SD2 =
  PropertiesService.getScriptProperties().getProperty("LAB_CALENDAR_ID_SD2") ||
  "YOUR_LAB_CALENDAR_ID_SD2_HERE";

const ADMIN_EMAIL =
  PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL") ||
  "YOUR_ADMIN_EMAIL_HERE";

// Per-lab admin
const ADMIN_EMAIL_LAB1 =
  PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL_LAB1") ||
  "YOUR_ADMIN_EMAIL_LAB1_HERE"; // SD1 & SMP

const ADMIN_EMAIL_LAB2 =
  PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL_LAB2") ||
  "YOUR_ADMIN_EMAIL_LAB2_HERE"; // SD2

// Return a SINGLE email (most of your code expects one string)
function getAdminEmailForLab_(lab) {
  const tag = String(lab || "").toUpperCase();
  if (tag === "LAB_SD2") return ADMIN_EMAIL_LAB2;
  return ADMIN_EMAIL_LAB1; // default LAB1
}

// If someday you want multiple recipients, keep this too (optional)
function getAdminEmailsForLab_(lab) {
  const one = getAdminEmailForLab_(lab);
  return one ? [one] : [];
}

/* ================================
      SECURITY & TIMEZONE
================================ */
const TZ = "Asia/Jakarta";

const ACCESS_CODE =
  PropertiesService.getScriptProperties().getProperty("ACCESS_CODE") ||
  "YOUR_ACCESS_CODE_HERE"; // Booking code for teachers

const ADMIN_KEY =
  PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") ||
  "YOUR_ADMIN_KEY_HERE"; // Admin panel key

// Admin emails allowed (sch + ac)
const ADMIN_EMAILS = (
  PropertiesService.getScriptProperties().getProperty("ADMIN_EMAILS") ||
  "YOUR_ADMIN_EMAIL_1_HERE,YOUR_ADMIN_EMAIL_2_HERE"
)
  .split(",")
  .map(function (s) {
    return String(s || "").trim().toLowerCase();
  })
  .filter(function (s) {
    return s;
  });

// Optional version endpoint (handy for debugging)
const APP_VERSION = "2026-02-06_FULL_STABLE_CORRECTED";

/* ============================================================
      DATE HELPERS (JAKARTA-SAFE)
      - fixes date-only shift (YYYY-MM-DD) becoming one day earlier
============================================================ */

/**
 * Parse "YYYY-MM-DD" safely as a Date that stays on the same calendar day
 * for Asia/Jakarta. We set time to 12:00 to avoid edge conversions.
 */
function parseDateOnlyJakarta_(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);

  return new Date(y, mo, d, 12, 0, 0, 0);
}

/**
 * Convert an incoming payload value into a Date when appropriate.
 * - If it's already a Date: keep it
 * - If it's "YYYY-MM-DD": parse safely as Jakarta date-only
 * - Otherwise: attempt new Date(value) if valid, else return original
 */
function coerceDateInput_(value) {
  if (value === null || value === undefined) return value;

  // allow clearing with empty string
  if (value === "") return "";

  if (value instanceof Date) return value;

  const s = String(value).trim();
  if (!s) return "";

  const d1 = parseDateOnlyJakarta_(s);
  if (d1) return d1;

  const d2 = new Date(s);
  if (d2 && !isNaN(d2.getTime())) return d2;

  return value;
}

/* ============================================================
      BOOKING LIFECYCLE COLUMNS (ADD-ONLY)
============================================================ */
const BOOKING_STATUS = {
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  RESCHEDULED: "RESCHEDULED", // reserved (not implemented as a flow here)
};

const BOOKING_LIFECYCLE_COLUMNS = {
  BOOKING_ID: "bookingId",
  STATUS: "status",
};

const BOOKING_CANCEL_COLUMNS = {
  CANCELLED_AT: "cancelledAt",
  CANCELLED_BY: "cancelledBy",
  CANCEL_REASON: "cancelReason",
};

function ensureBookingLifecycleColumns_(sheet) {
  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return { ok: false, message: "Sheet has no columns." };

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const headerNorm = headers.map((h) => String(h || "").trim());

    const needsBookingId =
      headerNorm.indexOf(BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID) < 0;
    const needsStatus =
      headerNorm.indexOf(BOOKING_LIFECYCLE_COLUMNS.STATUS) < 0;

    const needsCancelledAt =
      headerNorm.indexOf(BOOKING_CANCEL_COLUMNS.CANCELLED_AT) < 0;
    const needsCancelledBy =
      headerNorm.indexOf(BOOKING_CANCEL_COLUMNS.CANCELLED_BY) < 0;
    const needsCancelReason =
      headerNorm.indexOf(BOOKING_CANCEL_COLUMNS.CANCEL_REASON) < 0;

    let added = 0;

    if (needsBookingId) {
      sheet
        .getRange(1, lastCol + added + 1)
        .setValue(BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID);
      added++;
    }

    if (needsStatus) {
      sheet
        .getRange(1, lastCol + added + 1)
        .setValue(BOOKING_LIFECYCLE_COLUMNS.STATUS);
      added++;
    }

    if (needsCancelledAt) {
      sheet
        .getRange(1, lastCol + added + 1)
        .setValue(BOOKING_CANCEL_COLUMNS.CANCELLED_AT);
      added++;
    }

    if (needsCancelledBy) {
      sheet
        .getRange(1, lastCol + added + 1)
        .setValue(BOOKING_CANCEL_COLUMNS.CANCELLED_BY);
      added++;
    }

    if (needsCancelReason) {
      sheet
        .getRange(1, lastCol + added + 1)
        .setValue(BOOKING_CANCEL_COLUMNS.CANCEL_REASON);
      added++;
    }

    return { ok: true, added: added };
  } catch (err) {
    Logger.log("ensureBookingLifecycleColumns_ error: " + err);
    return { ok: false, message: String(err) };
  }
}

function findHeaderIndex_(headers, name) {
  if (!headers || !headers.length) return -1;
  const target = String(name || "").trim();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim() === target) return i;
  }
  return -1;
}

/* ============================================================
      INVENTORY ID & KODE HELPERS
============================================================ */

function normalizeLabUtama_(lab) {
  const s = String(lab || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "SD1_SMP") return "SD1_SMP";
  if (s === "SD2") return "SD2";

  if (s.replace(/\s+/g, "") === "SD1SMP") return "SD1_SMP";
  if (s.indexOf("SD1") >= 0 && s.indexOf("SMP") >= 0) return "SD1_SMP";
  if (s.indexOf("SD2") >= 0) return "SD2";
  if (s.indexOf("LAB 2") >= 0 || s.indexOf("LAB2") >= 0) return "SD2";
  if (s.indexOf("LAB 1") >= 0 || s.indexOf("LAB1") >= 0) return "SD1_SMP";

  return s;
}

function labCodeFromLabUtama_(labUtama) {
  const n = normalizeLabUtama_(labUtama);
  return n === "SD2" ? "LAB2" : "LAB1";
}

function idToNumber_(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.startsWith("'") ? s.slice(1) : s;
  if (!/^\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

function padId4_(n) {
  const num = parseInt(n, 10);
  if (!isFinite(num) || num <= 0) return "";
  return String(num).padStart(4, "0");
}

function normalizeIdForCompare_(v) {
  const num = idToNumber_(v);
  if (num === null) return "";
  return String(num);
}

function getKodePrefixFromCategory_(kategori) {
  const kat = String(kategori || "").toUpperCase();
  if (kat.includes("KIMIA")) return "K";
  if (kat.includes("FISIKA")) return "F";
  if (kat.includes("BIO")) return "B";
  return "U";
}

function pad3_(n) {
  const num = parseInt(n, 10);
  if (!isFinite(num) || num < 0) return "000";
  return String(num).padStart(3, "0");
}

function getNextGlobalInventoryId_(sheet, idColIndex1Based) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return "0001";

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let maxId = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const num = idToNumber_(row[idColIndex1Based - 1]);
    if (num !== null && num > maxId) maxId = num;
  }

  return padId4_(maxId + 1);
}

function extractKodeSeq_(kode, labCode, prefix) {
  const s = String(kode || "").trim().toUpperCase();
  if (!s) return null;

  const reNew = new RegExp(
    "^" + labCode + "[\\s-]*" + prefix + "[\\s-]*0*(\\d{1,6})$"
  );
  let m = s.match(reNew);
  if (m && m[1]) return parseInt(m[1], 10);

  const reOld = new RegExp("^" + prefix + "[\\s-]*0*(\\d{1,6})$");
  m = s.match(reOld);
  if (m && m[1]) return parseInt(m[1], 10);

  return null;
}

function getNextKodeForLabAndPrefix_(sheet, headers, labUtama, prefix) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const labCode = labCodeFromLabUtama_(labUtama);

  if (lastRow < 2) return `${labCode}-${prefix}-001`;

  const idxKode = headers.indexOf("KODE");
  const idxLab = headers.indexOf("LAB UTAMA");
  if (idxKode < 0 || idxLab < 0) return `${labCode}-${prefix}-001`;

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const targetLab = normalizeLabUtama_(labUtama);

  let maxNum = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLab = normalizeLabUtama_(row[idxLab]);
    if (rowLab !== targetLab) continue;

    const kode = row[idxKode];
    const n = extractKodeSeq_(kode, labCode, prefix);
    if (n !== null && !isNaN(n) && n > maxNum) maxNum = n;
  }

  return `${labCode}-${prefix}-${pad3_(maxNum + 1)}`;
}

/* ================================
      ADMIN AUTH HELPERS
================================ */
function getRequestUserEmail_() {
  try {
    const a = Session.getActiveUser().getEmail();
    if (a) return String(a).toLowerCase();
  } catch (e1) {}

  try {
    const e = Session.getEffectiveUser().getEmail();
    if (e) return String(e).toLowerCase();
  } catch (e2) {}

  return "";
}

function isAdminRequest_(e) {
  const p = (e && e.parameter) || {};

  // NEW: token-based session (recommended)
  const token = String(p.token || "").trim();
  if (token) {
    const k = "ADMIN_SESSION_" + token;
    const expiry = PropertiesService.getScriptProperties().getProperty(k);
    if (expiry && Number(expiry) > Date.now()) return true;
  }

  // Existing: adminKey fallback (keep for now so nothing breaks)
  const key1 = p.adminKey || "";
  const key2 = p.key || "";
  if (key1 === ADMIN_KEY || key2 === ADMIN_KEY) return true;

  // Existing: admin email allowlist (works only when Session email is available)
  const email = getRequestUserEmail_();
  if (email && ADMIN_EMAILS.indexOf(email) >= 0) return true;

  return false;
}

/* ============================================================
      INVENTORY TIMESTAMP HELPERS (ADD-ONLY)
============================================================ */

function getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
}

function ensureInventoryColumn_(sheet, colName) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { ok: false, message: "MASTER_DATA has no headers." };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const idx = headers.indexOf(colName);
  if (idx >= 0) return { ok: true, index: idx, added: false };

  sheet.getRange(1, lastCol + 1).setValue(colName);
  return { ok: true, index: lastCol, added: true };
}

function ensureInventoryTimestampColumns_(sheet) {
  ensureInventoryColumn_(sheet, INVENTORY_CREATED_AT_COL);
  ensureInventoryColumn_(sheet, INVENTORY_UPDATED_AT_COL);
}

/* ============================================================
      INVENTARIS PINJAM (BORROW/RETURN) – ADD-ONLY
      PATCH: add-only new column "Tanggal Return"
============================================================ */

function getInventarisPinjamSheet_() {
  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  let sh = ss.getSheetByName(INVENTORY_BORROW_SHEET);
  if (!sh) sh = ss.insertSheet(INVENTORY_BORROW_SHEET);
  return sh;
}

function ensureInventarisPinjamHeader_() {
  const sh = getInventarisPinjamSheet_();
  const lastRow = sh.getLastRow();

  // If sheet is empty -> create full header (13 cols)
  if (lastRow < 1) {
    sh.appendRow([
      "Tanggal",
      "Kode Alat",
      "Nama Alat",
      "Jumlah",
      "Dari",
      "Ke",
      "Guru/Kelas",
      "Status",
      "Dicatat Oleh",
      "Catatan",
      "RefId",
      "Tanggal Return",
      "BookingId",
    ]);
    return;
  }

  // Add-only: append missing columns (without reordering existing)
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  let currentLastCol = lastCol;

  if (headers.indexOf("Tanggal Return") < 0) {
    sh.getRange(1, currentLastCol + 1).setValue("Tanggal Return");
    currentLastCol++;
  }

  if (headers.indexOf("BookingId") < 0) {
    sh.getRange(1, currentLastCol + 1).setValue("BookingId");
    currentLastCol++;
  }
}

function appendInventarisPinjamRow_(row13) {
  try {
    ensureInventarisPinjamHeader_();
    const sh = getInventarisPinjamSheet_();

    const row = (row13 || []).slice(0, 13);
    while (row.length < 13) row.push("");

    sh.appendRow(row);
  } catch (err) {
    Logger.log("appendInventarisPinjamRow_ failed: " + err);
  }
}

function markInventarisPinjamReturnedByRefId_(refId, note) {
  try {
    ensureInventarisPinjamHeader_();
    const sh = getInventarisPinjamSheet_();
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return false;

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const idxStatus = headers.indexOf("Status") + 1;
    const idxCatatan = headers.indexOf("Catatan") + 1;
    const idxRefId = headers.indexOf("RefId") + 1;
    const idxReturn = headers.indexOf("Tanggal Return") + 1;

    if (idxRefId <= 0) return false;

    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowRef = String(row[idxRefId - 1] || "").trim();
      if (rowRef === String(refId || "").trim()) {
        const targetRow = i + 2;
        const now = new Date();

        if (idxStatus) sh.getRange(targetRow, idxStatus).setValue("RETURNED");
        if (idxCatatan && note !== undefined)
          sh.getRange(targetRow, idxCatatan).setValue(note);
        if (idxReturn) sh.getRange(targetRow, idxReturn).setValue(now);

        return true;
      }
    }

    return false;
  } catch (err) {
    Logger.log("markInventarisPinjamReturnedByRefId_ failed: " + err);
    return false;
  }
}

/* ============================================================
      INVENTARIS LOG (CREATE/UPDATE + BORROW/RETURN) – ADD-ONLY
      Format 10 cols:
      (Tanggal, Jenis, Kode Alat, Nama Alat, Jumlah, Dari, Ke,
       Guru/Kelas, Dicatat Oleh, Catatan)
============================================================ */

function getInventarisLogSheet_() {
  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  let sh = ss.getSheetByName(INVENTORY_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(INVENTORY_LOG_SHEET);
  return sh;
}

function ensureInventarisLogHeader_() {
  const sh = getInventarisLogSheet_();
  if (sh.getLastRow() >= 1) return;

  sh.appendRow([
    "Tanggal",
    "Jenis",
    "Kode Alat",
    "Nama Alat",
    "Jumlah",
    "Dari",
    "Ke",
    "Guru/Kelas",
    "Dicatat Oleh",
    "Catatan",
  ]);
}

function appendInventarisLogRow_(row10) {
  try {
    ensureInventarisLogHeader_();
    const sh = getInventarisLogSheet_();

    const row = (row10 || []).slice(0, 10);
    while (row.length < 10) row.push("");

    sh.appendRow(row);
  } catch (err) {
    Logger.log("appendInventarisLogRow_ failed: " + err);
  }
}

/* ================================
      DO GET HANDLER
================================ */
function doGet(e) {
  const mode = e && e.parameter && e.parameter.mode;

  if (mode === "version") {
    return jsonOutput({ status: "ok", version: APP_VERSION });
  }

  if (mode === "stats") {
    return jsonOutput(getStats());
  }

  if (mode === "checkConflict") {
    const date = e.parameter.date;
    const startTime = e.parameter.startTime;
    const endTime = e.parameter.endTime;
    const lab = e.parameter.lab || "";
    return jsonOutput(checkConflict(date, startTime, endTime, lab));
  }

  if (mode === "adminBookings") {
    return jsonOutput(getAdminBookings(e));
  }

  if (mode === "inventory") {
    return jsonOutput(getInventory());
  }

  if (mode === "inventoryBackfillIds") {
    return jsonOutput(backfillMissingInventoryIds_(e));
  }

  return jsonOutput({
    error:
      "Invalid mode. Use ?mode=version, ?mode=stats, ?mode=checkConflict, ?mode=adminBookings, ?mode=inventory, or ?mode=inventoryBackfillIds",
  });
}

/* ================================
      DO POST (SINGLE SOURCE OF TRUTH)
================================ */
function doPost(e) {
  try {
    const data = (e && e.parameter) || {};
    const mode = String(data.mode || "").trim();

    // Admin / Inventory
    if (mode === "adminLogin") return jsonOutput(handleAdminLogin(e));

    if (mode === "inventoryCreate" || mode === "inventoryAdd")
      return jsonOutput(createInventoryItem(e));

    if (mode === "inventoryUpdate")
      return jsonOutput(updateInventoryItem(e));

    if (mode === "inventoryBorrow")
      return jsonOutput(borrowInventoryItem_(e));

    if (mode === "inventoryReturn")
      return jsonOutput(returnInventoryItem_(e));

    if (mode === "inventoryCheckoutBooking")
      return jsonOutput(checkoutInventoryByBookingId_(e));

    // Booking admin actions
    if (mode === "cancelBooking")
      return jsonOutput(cancelBooking_(e));

    if (mode === "setBookingStatus")
      return jsonOutput(setBookingStatus_(e));

    // Default: teacher booking submission (no mode)
    return jsonOutput(createBookingSubmission_(e));

  } catch (err) {
    return jsonOutput({
      status: "error",
      where: "doPost",
      message: String(err),
      stack: err && err.stack ? String(err.stack) : "",
    });
  }
}

    /* ===========================
          BOOKING PATH (WORKING)
       =========================== */
function checkToolAvailabilitySoft_(toolsText) {
  try {
    const toolsRaw = String(toolsText || "").trim();
    if (!toolsRaw) return { warning: false };

    // Load MASTER inventory
    const ssInv = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
    const master = ssInv.getSheetByName(INVENTORY_MASTER_SHEET);
    if (!master) return { warning: false, message: "MASTER_DATA not found." };

    const mLastRow = master.getLastRow();
    const mLastCol = master.getLastColumn();
    if (mLastRow < 2) return { warning: false };

    const mHeaders = master.getRange(1, 1, 1, mLastCol).getValues()[0] || [];
    const mValues = master.getRange(2, 1, mLastRow - 1, mLastCol).getValues() || [];

    const idxKode = mHeaders.indexOf("KODE");
    const idxNama = mHeaders.indexOf("NAMA ALAT");
    const idxJumlah = mHeaders.indexOf("JUMLAH TOTAL");

    if (idxNama < 0 || idxJumlah < 0) {
      return {
        warning: false,
        message: "Inventory headers missing (NAMA ALAT / JUMLAH TOTAL).",
      };
    }

    function norm_(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }

    // Build master lookup
    const byName = {};
    const byKode = {};

    for (let i = 0; i < mValues.length; i++) {
      const row = mValues[i];
      const nama = row[idxNama];
      const qty = Number(row[idxJumlah] || 0);
      const kode = idxKode >= 0 ? row[idxKode] : "";

      const n = norm_(nama);
      if (n) byName[n] = { kode: kode, nama: nama, total: qty };

      const k = norm_(kode);
      if (k) byKode[k] = { kode: kode, nama: nama, total: qty };
    }

    // Borrow sheet (optional, but improves accuracy)
    let borrowedByKode = {};
    try {
      const pinjam = ssInv.getSheetByName(INVENTORY_BORROW_SHEET);
      if (pinjam && pinjam.getLastRow() >= 2) {
        const pLastRow = pinjam.getLastRow();
        const pLastCol = pinjam.getLastColumn();
        const pData = pinjam.getRange(1, 1, pLastRow, pLastCol).getValues();

        const pHeaders = pData[0] || [];
        const idxPKode = pHeaders.indexOf("Kode Alat");
        const idxPQty = pHeaders.indexOf("Jumlah");
        const idxPStatus = pHeaders.indexOf("Status");

        if (idxPKode >= 0 && idxPQty >= 0 && idxPStatus >= 0) {
          for (let r = 1; r < pData.length; r++) {
            const row = pData[r];
            const status = String(row[idxPStatus] || "").trim().toUpperCase();
            if (status !== "BORROWED") continue;

            const kode = norm_(row[idxPKode]);
            const qty = Number(row[idxPQty] || 0);
            if (!kode || !isFinite(qty) || qty <= 0) continue;

            borrowedByKode[kode] = (borrowedByKode[kode] || 0) + qty;
          }
        }
      }
    } catch (errBorrow) {
      // Soft-fail: do not break booking if pinjam parsing fails
      Logger.log("Borrow sheet scan failed (soft): " + errBorrow);
    }

    // Parse requested tools
    const parts = toolsRaw
      .split(/[,;\n]+/g)
      .map((x) => String(x || "").trim())
      .filter((x) => x);

    const requests = parts.map((p) => {
      let name = p;
      let qty = 1;

      const m1 = p.match(/^(.*?)(?:\s*[xX]\s*(\d+))\s*$/);
      if (m1) {
        name = (m1[1] || "").trim();
        qty = parseInt(m1[2], 10) || 1;
      } else {
        const m2 = p.match(/^(.*?)(?:\s+(\d+))\s*$/);
        if (m2) {
          name = (m2[1] || "").trim();
          qty = parseInt(m2[2], 10) || 1;
        }
      }
      return { raw: p, name: name, qty: qty };
    });

    const warnings = [];
    const nameKeys = Object.keys(byName);

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const n = norm_(req.name);
      if (!n) continue;
      if (n.length < 3) continue;

      let item = null;

      // exact kode
      if (byKode[n]) item = byKode[n];

      // exact name
      if (!item && byName[n]) item = byName[n];

      // contains fallback
      if (!item) {
        for (let k = 0; k < nameKeys.length; k++) {
          const invName = nameKeys[k];
          if (!invName) continue;
          if (invName.indexOf(n) >= 0 || n.indexOf(invName) >= 0) {
            item = byName[invName];
            break;
          }
        }
      }

      if (!item) {
        warnings.push(`"${req.raw}" tidak ditemukan di inventaris (cek penulisan / nama alat).`);
        continue;
      }

      const total = Number(item.total || 0);
      if (!isFinite(total) || total <= 0) {
        warnings.push(`"${req.raw}" terdeteksi, tapi stok tidak valid (JUMLAH TOTAL kosong/0).`);
        continue;
      }

      // subtract borrowed if kode is known
      const kodeKey = norm_(item.kode);
      const borrowed = kodeKey ? Number(borrowedByKode[kodeKey] || 0) : 0;
      const available = total - borrowed;

      if (req.qty > available) {
        warnings.push(
          `"${item.nama}" diminta ${req.qty} tetapi stok tersedia hanya ${available} (total ${total}, sedang dipinjam ${borrowed}).`
        );
      }
    }

    if (warnings.length) {
      return {
        warning: true,
        message: "Peringatan ketersediaan alat:\n- " + warnings.join("\n- "),
      };
    }

    return { warning: false };
  } catch (err) {
    Logger.log("checkToolAvailabilitySoft_ error: " + err);
    return { warning: false };
  }
}


/* ============================================================
      INVENTORY REQUESTS FROM BOOKING (PLANNING ONLY)
      - Creates rows in INVENTARIS_PINJAM with Status = REQUESTED
      - No stock deduction here (aligned with locked philosophy)
      - Admin will "checkout" later (convert REQUESTED -> BORROWED)
============================================================ */

function normalizeLoose_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemListText_(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/[,;\n]+/g)
    .map((x) => String(x || "").trim())
    .filter((x) => x);

  return parts.map((p) => {
    let name = p;
    let qty = 1;

    const m1 = p.match(/^(.*?)(?:\s*[xX]\s*(\d+))\s*$/);
    if (m1) {
      name = (m1[1] || "").trim();
      qty = parseInt(m1[2], 10) || 1;
    } else {
      const m2 = p.match(/^(.*?)(?:\s+(\d+))\s*$/);
      if (m2) {
        name = (m2[1] || "").trim();
        qty = parseInt(m2[2], 10) || 1;
      }
    }

    return { raw: p, name: name, qty: qty };
  });
}

function findInventoryItemByNameLabKategori_(masterHeaders, masterValues, reqName, labUtama, kategori) {
  const idxKode = masterHeaders.indexOf("KODE");
  const idxNama = masterHeaders.indexOf("NAMA ALAT");
  const idxLab = masterHeaders.indexOf("LAB UTAMA");
  const idxKat = masterHeaders.indexOf("KATEGORI");
  const idxTipe = masterHeaders.indexOf("TIPE");

  if (idxNama < 0) return null;

  const nReq = normalizeLoose_(reqName);
  const labReq = normalizeLabUtama_(labUtama);
  const katReq = String(kategori || "").trim();

  let best = null;

  for (let i = 0; i < masterValues.length; i++) {
    const row = masterValues[i];
    const nama = row[idxNama];
    if (!nama) continue;

    const nNama = normalizeLoose_(nama);

    // match by contains (safe enough for school usage; can tighten later)
    const nameMatch = nNama === nReq || nNama.indexOf(nReq) >= 0 || nReq.indexOf(nNama) >= 0;
    if (!nameMatch) continue;

    // optional filters
    if (idxLab >= 0 && labReq) {
      const rowLab = normalizeLabUtama_(row[idxLab]);
      if (rowLab && rowLab !== labReq) continue;
    }

    if (idxKat >= 0 && katReq) {
      const rowKat = String(row[idxKat] || "").trim();
      if (rowKat && rowKat !== katReq) continue;
    }

    best = {
      kode: idxKode >= 0 ? String(row[idxKode] || "").trim() : "",
      nama: String(nama || "").trim(),
      tipe: idxTipe >= 0 ? String(row[idxTipe] || "").trim() : "",
      labUtama: idxLab >= 0 ? String(row[idxLab] || "").trim() : "",
      kategori: idxKat >= 0 ? String(row[idxKat] || "").trim() : "",
    };
    break;
  }

  return best;
}

function findInventoryItemByKode_(masterHeaders, masterValues, kode) {
  const idxKode = masterHeaders.indexOf("KODE");
  const idxNama = masterHeaders.indexOf("NAMA ALAT");
  const idxLab = masterHeaders.indexOf("LAB UTAMA");
  const idxKat = masterHeaders.indexOf("KATEGORI");
  const idxTipe = masterHeaders.indexOf("TIPE");
  if (idxKode < 0) return null;

  const kReq = normalizeLoose_(kode);
  if (!kReq) return null;

  for (let i = 0; i < masterValues.length; i++) {
    const row = masterValues[i];
    const rowKode = normalizeLoose_(row[idxKode]);
    if (!rowKode) continue;
    if (rowKode !== kReq) continue;

    return {
      kode: String(row[idxKode] || "").trim(),
      nama: idxNama >= 0 ? String(row[idxNama] || "").trim() : "",
      tipe: idxTipe >= 0 ? String(row[idxTipe] || "").trim() : "",
      labUtama: idxLab >= 0 ? String(row[idxLab] || "").trim() : "",
      kategori: idxKat >= 0 ? String(row[idxKat] || "").trim() : "",
    };
  }

  return null;
}

function createInventoryRequestsForBooking_(info) {
  try {
    const bookingId = String(info.bookingId || "").trim();
    if (!bookingId) return { ok: false, message: "Missing bookingId." };

    const toolsText = String(info.tools || "").trim();
    if (!toolsText) return { ok: true, created: 0, skipped: 0 };

    const ssInv = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
    const master = ssInv.getSheetByName(INVENTORY_MASTER_SHEET);
    if (!master) return { ok: false, message: "MASTER_DATA not found." };

    const mLastRow = master.getLastRow();
    const mLastCol = master.getLastColumn();
    if (mLastRow < 2) return { ok: true, created: 0, skipped: 0 };

    const masterHeaders = master.getRange(1, 1, 1, mLastCol).getValues()[0] || [];
    const masterValues = master.getRange(2, 1, mLastRow - 1, mLastCol).getValues() || [];

    // Parse requested tools
    const reqs = parseItemListText_(toolsText);
    if (!reqs.length) return { ok: true, created: 0, skipped: 0 };

    let created = 0;
    let skipped = 0;

    const now = new Date();
    const dicatatOleh = getRequestUserEmail_() || "SYSTEM";
    const guruKelas = String(info.unitClass || "").trim();
    const ke = String(info.lab || "").trim();

    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i];
      if (!r || !r.name) continue;

      // Try match by KODE first, then Name+Lab+Kategori (if provided)
      let item = findInventoryItemByKode_(masterHeaders, masterValues, r.name);
      if (!item) {
        item = findInventoryItemByNameLabKategori_(
          masterHeaders,
          masterValues,
          r.name,
          info.labUtama || "",
          info.kategori || ""
        );
      }

      if (!item || !item.kode || !item.nama) {
        skipped++;
        continue;
      }

      const refId = Utilities.getUuid();
      appendInventarisPinjamRow_([
        now,
        item.kode,
        item.nama,
        Number(r.qty || 1),
        "Gudang",
        ke,
        guruKelas,
        INVENTORY_REQUEST_STATUS.REQUESTED,
        dicatatOleh,
        "AUTO_REQUEST from booking: " + bookingId,
        refId,
        "",
        bookingId,
      ]);
      created++;
    }

    return { ok: true, created: created, skipped: skipped };
  } catch (err) {
    Logger.log("createInventoryRequestsForBooking_ failed: " + err);
    return { ok: false, message: String(err) };
  }
}

function cancelInventoryRequestsByBookingId_(bookingId, actor, reason) {
  try {
    const bid = String(bookingId || "").trim();
    if (!bid) return { ok: false, message: "Missing bookingId." };

    ensureInventarisPinjamHeader_();
    const sh = getInventarisPinjamSheet_();

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return { ok: true, cancelled: 0 };

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const idxStatus = headers.indexOf("Status") + 1;
    const idxCatatan = headers.indexOf("Catatan") + 1;
    const idxBookingId = headers.indexOf("BookingId") + 1;
    const idxReturn = headers.indexOf("Tanggal Return") + 1;

    if (idxBookingId <= 0 || idxStatus <= 0) return { ok: false, message: "Required columns missing." };

    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    let cancelled = 0;
    const now = new Date();
    const note = "AUTO_CANCEL booking: " + bid + (reason ? (" | " + reason) : "");

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowBid = String(row[idxBookingId - 1] || "").trim();
      if (rowBid !== bid) continue;

      const status = String(row[idxStatus - 1] || "").trim().toUpperCase();

      // Only auto-cancel planning requests
      if (status === INVENTORY_REQUEST_STATUS.REQUESTED) {
        const targetRow = i + 2;
        sh.getRange(targetRow, idxStatus).setValue(INVENTORY_REQUEST_STATUS.CANCELLED);
        if (idxCatatan) sh.getRange(targetRow, idxCatatan).setValue(note);
        if (idxReturn) sh.getRange(targetRow, idxReturn).setValue(now);
        cancelled++;
      } else if (status === INVENTORY_REQUEST_STATUS.BORROWED) {
        // Do not auto-return borrowed items. Just mark note for admin visibility.
        if (idxCatatan) {
          const targetRow = i + 2;
          const old = String(row[idxCatatan - 1] || "").trim();
          const merged = old ? (old + " | " + "BOOKING_CANCELLED - check return") : "BOOKING_CANCELLED - check return";
          sh.getRange(targetRow, idxCatatan).setValue(merged);
        }
      }
    }

    return { ok: true, cancelled: cancelled };
  } catch (err) {
    Logger.log("cancelInventoryRequestsByBookingId_ failed: " + err);
    return { ok: false, message: String(err) };
  }
}

/**
 * Admin-only: convert REQUESTED rows (by BookingId) to BORROWED.
 * This represents the real checkout moment (stock movement).
 */
function checkoutInventoryByBookingId_(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const p = (e && e.parameter) || {};
  const bookingId = String(p.bookingId || "").trim();
  if (!bookingId) return { status: "error", message: "Missing bookingId." };

  ensureInventarisPinjamHeader_();
  const sh = getInventarisPinjamSheet_();

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { status: "ok", bookingId, converted: 0 };

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const idxStatus = headers.indexOf("Status") + 1;
  const idxBookingId = headers.indexOf("BookingId") + 1;
  const idxKode = headers.indexOf("Kode Alat") + 1;
  const idxNama = headers.indexOf("Nama Alat") + 1;
  const idxQty = headers.indexOf("Jumlah") + 1;
  const idxDari = headers.indexOf("Dari") + 1;
  const idxKe = headers.indexOf("Ke") + 1;
  const idxGuru = headers.indexOf("Guru/Kelas") + 1;
  const idxDicatat = headers.indexOf("Dicatat Oleh") + 1;
  const idxCatatan = headers.indexOf("Catatan") + 1;

  if (idxStatus <= 0 || idxBookingId <= 0) {
    return { status: "error", message: "Required columns missing in INVENTARIS_PINJAM." };
  }

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const now = new Date();
  const actor = getRequestUserEmail_() || "ADMIN";

  let converted = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowBid = String(row[idxBookingId - 1] || "").trim();
    if (rowBid !== bookingId) continue;

    const status = String(row[idxStatus - 1] || "").trim().toUpperCase();
    if (status !== INVENTORY_REQUEST_STATUS.REQUESTED) continue;

    const targetRow = i + 2;

    // set to BORROWED
    sh.getRange(targetRow, idxStatus).setValue(INVENTORY_REQUEST_STATUS.BORROWED);
    if (idxDicatat) sh.getRange(targetRow, idxDicatat).setValue(actor);

    // log BORROW as real movement
    try {
      const kodeAlat = idxKode ? String(row[idxKode - 1] || "") : "";
      const namaAlat = idxNama ? String(row[idxNama - 1] || "") : "";
      const qty = idxQty ? String(row[idxQty - 1] || "") : "";
      const dari = idxDari ? String(row[idxDari - 1] || "Gudang") : "Gudang";
      const ke = idxKe ? String(row[idxKe - 1] || "") : "";
      const guru = idxGuru ? String(row[idxGuru - 1] || "") : "";
      const cat = idxCatatan ? String(row[idxCatatan - 1] || "") : "";

      appendInventarisLogRow_([
        now,
        "BORROW",
        kodeAlat,
        namaAlat,
        qty,
        dari || "Gudang",
        ke,
        guru,
        actor,
        (cat ? (cat + " | ") : "") + "CHECKOUT from booking: " + bookingId,
      ]);
    } catch (lerr) {}

    converted++;
  }

  return { status: "ok", bookingId, converted: converted };
}


function createBookingSubmission_(e) {
  try {
    const data = (e && e.parameter) || {};

    const lab = data.lab || "";
    const teacher = data.teacher || "";
    const unitClass = data.unitClass || "";
    const whatsapp = data.whatsapp || "";
    const teacherEmail = data.teacherEmail || "";
    const date = data.date || "";
    const startTime = data.startTime || "";
    const endTime = data.endTime || "";
    const activity = data.activity || "";
    const tools = data.tools || "";
    const materials = data.materials || "";
    const accessCode = data.accessCode || "";

    if (!accessCode || accessCode !== ACCESS_CODE) {
      return {
        status: "invalid_code",
        message: "Access code is invalid.",
      };
    }

    const conflict = checkConflict(date, startTime, endTime, lab);
    if (conflict && conflict.conflict) {
      return {
        status: "conflict",
        existingStart: conflict.existingStart,
        existingEnd: conflict.existingEnd,
        existingTeacher: conflict.existingTeacher || "",
        existingUnitClass: conflict.existingUnitClass || "",
        existingActivity: conflict.existingActivity || "",
      };
    }

    // NEW (add-only): soft tool availability warning (does NOT block booking)
    let toolWarningMessage = "";
    try {
      if (tools) {
        const warning = checkToolAvailabilitySoft_(tools);
        if (warning && warning.warning) {
          toolWarningMessage = String(warning.message || "");
          Logger.log("Tool availability warning: " + toolWarningMessage);
        }
      }
    } catch (werr) {
      Logger.log("Soft tool check failed: " + werr);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    // Ensure lifecycle columns exist (add-only)
    ensureBookingLifecycleColumns_(sheet);

    // Re-fetch headers AFTER ensure
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];

    const idxBookingId = findHeaderIndex_(
      headers,
      BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID
    );
    const idxStatus = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.STATUS);

    const timestamp = new Date();
    const bookingId = Utilities.getUuid();
    const bookingStatus = BOOKING_STATUS.CONFIRMED;

    // Calendar event
    let calendarUrl = "";
    let eventId = "";

    try {
      const eventInfo = createCalendarEvent({
        lab,
        date,
        startTime,
        endTime,
        teacher,
        unitClass,
        whatsapp,
        teacherEmail,
        activity,
        tools,
        materials,
      });

      if (eventInfo) {
        calendarUrl = eventInfo.calendarUrl || "";
        eventId = eventInfo.eventId || "";
      }
    } catch (calErr) {
      Logger.log("Calendar error: " + calErr);
    }

    // Base columns (original order) — 15 cols
    const baseRow = [
      timestamp, // 0
      lab, // 1
      date, // 2
      startTime, // 3
      endTime, // 4
      teacher, // 5
      teacherEmail, // 6
      whatsapp, // 7
      unitClass, // 8
      activity, // 9
      tools, // 10
      materials, // 11
      accessCode, // 12
      calendarUrl, // 13
      eventId, // 14
    ];

    // Write full row sized to actual sheet width
    const fullRow = new Array(lastCol).fill("");
    for (let i = 0; i < baseRow.length && i < fullRow.length; i++) {
      fullRow[i] = baseRow[i];
    }

    if (idxBookingId >= 0) fullRow[idxBookingId] = bookingId;
    if (idxStatus >= 0) fullRow[idxStatus] = bookingStatus;

    sheet.appendRow(fullRow);

    // AUTO: create inventory REQUESTED rows for this booking (planning only)
    // This does NOT borrow stock. Admin will checkout later.
    try {
      const labUtamaAuto = String(lab || "").toUpperCase() === "LAB_SD2" ? "SD2" : "SD1_SMP";
      createInventoryRequestsForBooking_({
        bookingId: bookingId,
        lab: lab,
        unitClass: unitClass,
        tools: tools,
        labUtama: labUtamaAuto,
        kategori: "",
      });
    } catch (reqErr) {
      Logger.log("Auto inventory request failed (soft): " + reqErr);
    }


    /* ===========================
       EMAILS (Teacher + Admin)
    =========================== */
    try {
      // 1) Teacher confirmation email
      if (teacherEmail) {
        const t = buildTeacherConfirmationEmail_({
          teacher,
          teacherEmail,
          lab,
          date,
          startTime,
          endTime,
          unitClass,
          activity,
          calendarUrl,
        });
        GmailApp.sendEmail(teacherEmail, t.subject, t.body);
      }

      // 2) Admin email (per-lab routing)
      const adminSubject = subjectNewBooking_({ lab, date });

      let adminBody =
        "Booking baru untuk Lab IPA Alkhairiyah.\n\n" +
        "Lab: " +
        (lab || "-") +
        "\n" +
        "Tanggal: " +
        (date || "-") +
        "\n" +
        "Jam: " +
        (startTime || "-") +
        " - " +
        (endTime || "-") +
        "\n" +
        "Guru/PIC: " +
        (teacher || "-") +
        "\n" +
        "Unit & Kelas: " +
        (unitClass || "-") +
        "\n" +
        "WhatsApp: " +
        (whatsapp || "-") +
        "\n" +
        "Email: " +
        (teacherEmail || "-") +
        "\n" +
        "Kegiatan: " +
        (activity || "-") +
        "\n" +
        "Alat: " +
        (tools || "-") +
        "\n" +
        "Bahan: " +
        (materials || "-") +
        "\n\n" +
        (calendarUrl ? "Link kalender: " + calendarUrl + "\n\n" : "") +
        "Booking ID: " +
        bookingId +
        "\n" +
        "Status: " +
        bookingStatus +
        "\n";

      // NEW: include tool availability warning to admin (optional but useful)
      if (toolWarningMessage) {
        adminBody +=
          "\n" +
          "⚠️ " +
          toolWarningMessage +
          "\n";
      }

      adminBody += "\n— Sistem Booking Lab IPA Alkhairiyah";

      const adminTo = getAdminEmailForLab_(lab);
      sendAdminEmail_(adminSubject, adminBody, adminTo);
    } catch (mailErr) {
      Logger.log("Email error: " + mailErr);
    }

    return {
      status: "success",
      message:
        "Booking tersimpan dan undangan kalender dikirim (jika email diisi).",
      eventInfo: { eventId: eventId, calendarUrl: calendarUrl },
      booking: { bookingId: bookingId, status: bookingStatus },
      toolWarning: toolWarningMessage ? toolWarningMessage : "",
    };
  } catch (err) {
    return {
      status: "error",
      where: "createBookingSubmission_",
      message: String(err),
      stack: err && err.stack ? String(err.stack) : "",
    };
  }
}


/* ============================================================
      CANCEL BOOKING (teacher accessCode OR admin)
============================================================ */
function cancelBooking_(e) {
  const p = (e && e.parameter) || {};

  const bookingId = String(p.bookingId || "").trim();
  const reason = String(p.reason || p.cancelReason || "").trim();
  const cancelledBy = String(p.cancelledBy || "").trim().toUpperCase() || "";

  const isAdmin = isAdminRequest_(e);
  const accessCode = String(p.accessCode || "").trim();

  if (!isAdmin && accessCode !== ACCESS_CODE) {
    return {
      status: "unauthorized",
      message: "Invalid access (admin or accessCode required).",
    };
  }

  if (!bookingId) return { status: "error", message: "Missing bookingId." };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  ensureBookingLifecycleColumns_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2)
    return { status: "not_found", message: "No bookings found." };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  const idxBookingId = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID);
  const idxStatus = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.STATUS);

  const idxCancelledAt = findHeaderIndex_(headers, BOOKING_CANCEL_COLUMNS.CANCELLED_AT);
  const idxCancelledBy = findHeaderIndex_(headers, BOOKING_CANCEL_COLUMNS.CANCELLED_BY);
  const idxCancelReason = findHeaderIndex_(headers, BOOKING_CANCEL_COLUMNS.CANCEL_REASON);

  if (idxBookingId < 0)
    return { status: "error", message: "bookingId column not found." };

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let targetRow = -1;
  let lab = "";
  let eventId = "";
  let oldStatus = "";

  // capture details for notification
  let teacher = "";
  let teacherEmail = "";
  let unitClass = "";
  let dateStr = "";
  let startTime = "";
  let endTime = "";
  let activity = "";

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (String(r[idxBookingId] || "").trim() === bookingId) {
      targetRow = i + 2;

      lab = r[1] || "";
      eventId = r[14] || "";
      oldStatus = idxStatus >= 0 ? String(r[idxStatus] || "") : "";

      dateStr = r[2] || "";
      startTime = r[3] || "";
      endTime = r[4] || "";
      teacher = r[5] || "";
      teacherEmail = r[6] || "";
      unitClass = r[8] || "";
      activity = r[9] || "";
      break;
    }
  }

  if (targetRow < 0) return { status: "not_found", message: "Booking not found." };

  const oldStatusNorm = String(oldStatus || "").trim().toUpperCase();
  if (oldStatusNorm === BOOKING_STATUS.CANCELLED) {
    return {
      status: "ok",
      bookingId,
      newStatus: BOOKING_STATUS.CANCELLED,
      message: "Already cancelled.",
    };
  }

  const now = new Date();
  const actor = cancelledBy || (isAdmin ? "ADMIN" : "TEACHER");

  if (idxStatus >= 0)
    sheet.getRange(targetRow, idxStatus + 1).setValue(BOOKING_STATUS.CANCELLED);
  if (idxCancelledAt >= 0)
    sheet.getRange(targetRow, idxCancelledAt + 1).setValue(now);
  if (idxCancelledBy >= 0)
    sheet.getRange(targetRow, idxCancelledBy + 1).setValue(actor);
  if (idxCancelReason >= 0 && reason)
    sheet.getRange(targetRow, idxCancelReason + 1).setValue(reason);

  // Prefix calendar title
  if (eventId) {
    try {
      const calendarId = getCalendarIdForLab(lab);
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (calendar) {
        const ev = calendar.getEventById(String(eventId));
        if (ev) {
          const oldTitle = String(ev.getTitle() || "");
          if (!oldTitle.startsWith("[CANCELLED]")) {
            ev.setTitle("[CANCELLED] " + oldTitle);
          }
        }
      }
    } catch (err) {
      Logger.log("cancelBooking_ calendar update failed: " + err);
    }
  }

  // Admin email notification
  try {
    notifyAdminBookingCancelled_({
      bookingId: bookingId,
      lab: lab,
      date: dateStr,
      startTime: startTime,
      endTime: endTime,
      teacher: teacher,
      teacherEmail: teacherEmail,
      unitClass: unitClass,
      activity: activity,
      cancelledBy: actor,
      cancelReason: reason || "",
    });
  } catch (nerr) {
    Logger.log("notifyAdminBookingCancelled_ failed: " + nerr);
  }

  // prevent reminders firing for cancelled booking
  try {
    clearReminderFlags_(bookingId);
  } catch (cerr) {}

  // AUTO: cancel inventory REQUESTED rows linked to this booking (planning only)
  try {
    cancelInventoryRequestsByBookingId_(bookingId, actor, reason);
  } catch (ierr) {
    Logger.log("Auto cancel inventory requests failed (soft): " + ierr);
  }

  return { status: "ok", bookingId: bookingId, newStatus: BOOKING_STATUS.CANCELLED };
}

/* ============================================================
      EVENT TITLE PREFIX HELPER
============================================================ */
function prefixEventTitle_(calendarId, eventId, prefixTag) {
  const cal = CalendarApp.getCalendarById(String(calendarId));
  if (!cal) return;

  const ev = cal.getEventById(String(eventId));
  if (!ev) return;

  const oldTitle = String(ev.getTitle() || "");

  if (oldTitle.startsWith("[CANCELLED]")) return;
  if (!oldTitle.startsWith(prefixTag)) {
    ev.setTitle(prefixTag + " " + oldTitle);
  }
}

/* ============================================================
      SET BOOKING STATUS (ADMIN ONLY)
      - Supports: CANCELLED (delegates), NO_SHOW (implemented)
      PATCH: no mutation of e.parameter (clone event)
============================================================ */
function setBookingStatus_(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const p = (e && e.parameter) || {};
  const bookingId = String(p.bookingId || "").trim();
  const newStatusRaw = String(p.status || p.newStatus || "").trim().toUpperCase();

  if (!bookingId) return { status: "error", message: "Missing bookingId." };
  if (!newStatusRaw) return { status: "error", message: "Missing status." };

  const allowed = [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.NO_SHOW,
    BOOKING_STATUS.RESCHEDULED,
  ];
  if (allowed.indexOf(newStatusRaw) < 0) {
    return { status: "error", message: "Invalid status: " + newStatusRaw };
  }

  if (
    newStatusRaw !== BOOKING_STATUS.CANCELLED &&
    newStatusRaw !== BOOKING_STATUS.NO_SHOW
  ) {
    return {
      status: "error",
      message:
        "This backend currently supports setting status to CANCELLED or NO_SHOW only.",
    };
  }

  // Delegate CANCELLED safely without mutating original e.parameter
  if (newStatusRaw === BOOKING_STATUS.CANCELLED) {
    const mergedParams = Object.assign({}, p);
    if (!mergedParams.cancelledBy) mergedParams.cancelledBy = "ADMIN";

    const e2 = Object.assign({}, e, { parameter: mergedParams });
    return cancelBooking_(e2);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  ensureBookingLifecycleColumns_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { status: "not_found", message: "No bookings found." };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const idxBookingId = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID);
  const idxStatus = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.STATUS);

  if (idxBookingId < 0) return { status: "error", message: "bookingId column not found." };
  if (idxStatus < 0) return { status: "error", message: "status column not found." };

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let targetRow = -1;
  let lab = "";
  let eventId = "";
  let oldStatus = "";

  // capture details for notification
  let teacher = "";
  let teacherEmail = "";
  let unitClass = "";
  let dateStr = "";
  let startTime = "";
  let endTime = "";
  let activity = "";

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (String(r[idxBookingId] || "").trim() === bookingId) {
      targetRow = i + 2;

      lab = r[1] || "";
      eventId = r[14] || "";
      oldStatus = String(r[idxStatus] || "");

      dateStr = r[2] || "";
      startTime = r[3] || "";
      endTime = r[4] || "";
      teacher = r[5] || "";
      teacherEmail = r[6] || "";
      unitClass = r[8] || "";
      activity = r[9] || "";
      break;
    }
  }

  if (targetRow < 0) return { status: "not_found", message: "Booking not found." };

  const oldStatusNorm = String(oldStatus || "").trim().toUpperCase();

  if (oldStatusNorm === BOOKING_STATUS.CANCELLED) {
    return {
      status: "error",
      message: "Booking is already CANCELLED and cannot be changed.",
      bookingId,
      currentStatus: BOOKING_STATUS.CANCELLED,
    };
  }

  if (oldStatusNorm === BOOKING_STATUS.NO_SHOW) {
    // idempotent prefix + notify + clear reminders
    if (eventId) {
      try {
        const calendarId = getCalendarIdForLab(lab);
        prefixEventTitle_(calendarId, eventId, "[NO_SHOW]");
      } catch (err0) {
        Logger.log("NO_SHOW calendar prefix (idempotent) failed: " + err0);
      }
    }

    try {
      notifyAdminNoShow_({
        bookingId: bookingId,
        lab: lab,
        date: dateStr,
        startTime: startTime,
        endTime: endTime,
        teacher: teacher,
        teacherEmail: teacherEmail,
        unitClass: unitClass,
        activity: activity,
      });
    } catch (nerr0) {
      Logger.log("notifyAdminNoShow_ failed: " + nerr0);
    }

    try {
      clearReminderFlags_(bookingId);
    } catch (cerr0) {}

    return { status: "ok", bookingId, newStatus: BOOKING_STATUS.NO_SHOW };
  }

  sheet.getRange(targetRow, idxStatus + 1).setValue(BOOKING_STATUS.NO_SHOW);

  if (eventId) {
    try {
      const calendarId = getCalendarIdForLab(lab);
      prefixEventTitle_(calendarId, eventId, "[NO_SHOW]");
    } catch (err) {
      Logger.log("setBookingStatus_ NO_SHOW calendar update failed: " + err);
    }
  }

  try {
    notifyAdminNoShow_({
      bookingId: bookingId,
      lab: lab,
      date: dateStr,
      startTime: startTime,
      endTime: endTime,
      teacher: teacher,
      teacherEmail: teacherEmail,
      unitClass: unitClass,
      activity: activity,
    });
  } catch (nerr) {
    Logger.log("notifyAdminNoShow_ failed: " + nerr);
  }

  try {
    clearReminderFlags_(bookingId);
  } catch (cerr) {}

  return { status: "ok", bookingId, newStatus: BOOKING_STATUS.NO_SHOW };
}

/* ================================
      CALENDAR HELPERS
================================ */
function getCalendarIdForLab(lab) {
  const labTag = (lab || "").toString().toUpperCase();
  if (labTag === "LAB_SD2") return LAB_CALENDAR_ID_SD2;
  return LAB_CALENDAR_ID_SD1_SMP;
}

function parseDateTime(dateStr, timeStr) {
  const dParts = String(dateStr).split("-");
  const y = parseInt(dParts[0], 10);
  const m = parseInt(dParts[1], 10) - 1;
  const d = parseInt(dParts[2], 10);

  const tParts = String(timeStr).split(":");
  const hh = parseInt(tParts[0], 10) || 0;
  const mm = parseInt(tParts[1], 10) || 0;

  return new Date(y, m, d, hh, mm, 0, 0);
}

function createCalendarEvent(data) {
  if (!data.date || !data.startTime || !data.endTime) return null;

  const calendarId = getCalendarIdForLab(data.lab);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error("Calendar not found: " + calendarId);

  const start = parseDateTime(data.date, data.startTime);
  const end = parseDateTime(data.date, data.endTime);

  const title = data.activity || "Kegiatan Lab IPA";

  const description =
    "Lab IPA Alkhairiyah\n" +
    "Lab: " + (data.lab || "-") + "\n" +
    "Guru/PIC: " + (data.teacher || "") + "\n" +
    "Unit & Kelas: " + (data.unitClass || "") + "\n" +
    "WhatsApp: " + (data.whatsapp || "") + "\n" +
    "Email: " + (data.teacherEmail || "") + "\n" +
    "Kegiatan: " + title + "\n" +
    "Alat: " + (data.tools || "") + "\n" +
    "Bahan: " + (data.materials || "") + "\n\n" +
    "— Sistem Booking Lab IPA";

  const guests = [];
  if (data.teacherEmail) guests.push(data.teacherEmail);

  // add lab admin as guest (so PJ/admin gets the invite)
  const adminGuest = getAdminEmailForLab_(data.lab);
  if (adminGuest) guests.push(adminGuest);

  const event = calendar.createEvent(title, start, end, {
    description: description,
    guests: guests.join(","),
    sendInvites: true,
    visibility: "public",
  });

  const eventId = event.getId();
  const calendarUrl =
    "https://calendar.google.com/calendar/u/0/r?cid=" + encodeURIComponent(calendarId);

  return { eventId: eventId, calendarUrl: calendarUrl };
}

/* ================================
      CONFLICT CHECK
================================ */
function checkCalendarConflict(date, startTime, endTime, lab) {
  if (!date || !startTime || !endTime) return { conflict: false };

  const calendarId = getCalendarIdForLab(lab);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error("Calendar not found for lab: " + lab + " (" + calendarId + ")");
  }

  const start = parseDateTime(date, startTime);
  const end = parseDateTime(date, endTime);

  const events = calendar.getEventsForDay(start);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.isAllDayEvent && ev.isAllDayEvent()) continue;

    const desc = ev.getDescription ? String(ev.getDescription()) : "";
    if (
      desc.indexOf("Sistem Booking Lab IPA") === -1 &&
      desc.indexOf("Lab IPA Alkhairiyah") === -1
    ) {
      continue;
    }

    const evStart = ev.getStartTime();
    const evEnd = ev.getEndTime();

    if (start < evEnd && end > evStart) {
      return {
        conflict: true,
        existingStart: Utilities.formatDate(evStart, TZ, "HH:mm"),
        existingEnd: Utilities.formatDate(evEnd, TZ, "HH:mm"),
        existingTeacher: "",
        existingUnitClass: "",
        existingActivity: ev.getTitle() || "",
      };
    }
  }

  return { conflict: false };
}

function checkSheetConflictForLab(date, startTime, endTime, labTagUpper) {
  if (!date || !startTime || !endTime) return { conflict: false };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { conflict: false };

  const numRows = lastRow - 1;
  const data = sheet.getRange(2, 1, numRows, 15).getValues();

  const requestedStart = parseDateTime(date, startTime);
  const requestedEnd = parseDateTime(date, endTime);

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const labCell = (r[1] || "").toString().toUpperCase();
    if (labCell !== labTagUpper) continue;

    const tanggalCell = r[2];
    let tanggalStr = "";
    if (tanggalCell instanceof Date) {
      tanggalStr = Utilities.formatDate(tanggalCell, TZ, "yyyy-MM-dd");
    } else {
      tanggalStr = String(tanggalCell || "").substring(0, 10);
    }
    if (!tanggalStr || tanggalStr !== date) continue;

    const startCell = r[3];
    const endCell = r[4];
    if (!startCell || !endCell) continue;

    const rowStart = parseDateTime(date, String(startCell));
    const rowEnd = parseDateTime(date, String(endCell));

    if (requestedStart < rowEnd && requestedEnd > rowStart) {
      return {
        conflict: true,
        existingStart: Utilities.formatDate(rowStart, TZ, "HH:mm"),
        existingEnd: Utilities.formatDate(rowEnd, TZ, "HH:mm"),
        existingTeacher: r[5] || "",
        existingUnitClass: r[8] || "",
        existingActivity: r[9] || "",
      };
    }
  }

  return { conflict: false };
}

function checkConflict(date, startTime, endTime, lab) {
  const calendarResult = checkCalendarConflict(date, startTime, endTime, lab);
  if (calendarResult && calendarResult.conflict) return calendarResult;

  const labTag = (lab || "").toString().toUpperCase();
  if (labTag === "LAB_SD2") {
    const sheetResult = checkSheetConflictForLab(date, startTime, endTime, labTag);
    if (sheetResult && sheetResult.conflict) return sheetResult;
  }

  return { conflict: false };
}

/* ================================
      GET STATS FOR DASHBOARD
================================ */
function getStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      totalSessions: 0,
      sdSessions: 0,
      sd1Sessions: 0,
      sd2Sessions: 0,
      smpSessions: 0,
      otherSessions: 0,
      topTeachers: [],
      unitCounts: [],
      toolCounts: [],
      monthlyCounts: [],
      recentBookings: [],
    };
  }

  const numRows = lastRow - 1;
  const data = sheet.getRange(2, 1, numRows, 15).getValues();

  let total = 0;
  let sd1 = 0;
  let sd2 = 0;
  let smp = 0;
  let other = 0;

  const teacherCount = {};
  const unitCount = {};
  const toolCount = {};
  const monthlyCount = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const timestamp = r[0];
    const lab = (r[1] || "").toString().toUpperCase();
    const tanggalCell = r[2];
    const unit = (r[8] || "").toString();
    const teacher = r[5] || "";
    const alatStr = r[10] || "";

    let bucket = "other";
    const unitUpper = unit.toUpperCase();

    if (lab === "LAB_SD2") bucket = "sd2";
    else if (lab === "LAB_SD1_SMP") {
      if (unitUpper.indexOf("SMP") === 0) bucket = "smp";
      else bucket = "sd1";
    } else {
      if (unitUpper.indexOf("SD 2") === 0 || unitUpper.indexOf("SD2") === 0)
        bucket = "sd2";
      else if (unitUpper.indexOf("SMP") === 0) bucket = "smp";
      else if (unitUpper.indexOf("SD") === 0) bucket = "sd1";
      else bucket = "other";
    }

    total++;
    if (bucket === "sd1") sd1++;
    else if (bucket === "sd2") sd2++;
    else if (bucket === "smp") smp++;
    else other++;

    if (teacher) teacherCount[teacher] = (teacherCount[teacher] || 0) + 1;
    if (unit) unitCount[unit] = (unitCount[unit] || 0) + 1;

    if (alatStr) {
      String(alatStr)
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)
        .forEach((tool) => {
          toolCount[tool] = (toolCount[tool] || 0) + 1;
        });
    }

    let monthKey = null;
    if (tanggalCell) {
      if (tanggalCell instanceof Date)
        monthKey = Utilities.formatDate(tanggalCell, TZ, "yyyy-MM");
      else monthKey = String(tanggalCell).substring(0, 7);
    } else if (timestamp instanceof Date) {
      monthKey = Utilities.formatDate(timestamp, TZ, "yyyy-MM");
    }

    if (monthKey) monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
  }

  const recentRows = data.slice(-10).reverse();
  const recentBookings = recentRows.map((r) => ({
    date: r[2],
    unitClass: r[8],
    teacher: r[5],
    activity: r[9],
  }));

  return {
    totalSessions: total,
    sdSessions: sd1 + sd2,
    sd1Sessions: sd1,
    sd2Sessions: sd2,
    smpSessions: smp,
    otherSessions: other,
    topTeachers: sortToList(teacherCount, 5),
    unitCounts: sortToList(unitCount),
    toolCounts: sortToList(toolCount, 10),
    monthlyCounts: Object.keys(monthlyCount)
      .sort()
      .map((month) => ({ month, count: monthlyCount[month] })),
    recentBookings,
  };
}

/* ================================
      ADMIN BOOKINGS ENDPOINT
================================ */
function getAdminBookings(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  ensureBookingLifecycleColumns_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { status: "ok", bookings: [] };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const numRows = lastRow - 1;
  const data = sheet.getRange(2, 1, numRows, lastCol).getValues();

  const idxBookingId = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID);
  const idxStatus = findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.STATUS);

  const dateFrom = e.parameter.dateFrom || "";
  const dateTo = e.parameter.dateTo || "";

  const bookings = [];

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const tanggal = r[2];
    let tanggalStr = "";
    if (tanggal instanceof Date) {
      tanggalStr = Utilities.formatDate(tanggal, TZ, "yyyy-MM-dd");
    } else {
      tanggalStr = String(tanggal || "");
    }

    if (dateFrom && tanggalStr && tanggalStr < dateFrom) continue;
    if (dateTo && tanggalStr && tanggalStr > dateTo) continue;

    const bookingIdVal = idxBookingId >= 0 ? r[idxBookingId] || "" : "";
    const statusValRaw = idxStatus >= 0 ? r[idxStatus] || "" : "";
    const statusVal = String(statusValRaw || "").trim() || BOOKING_STATUS.CONFIRMED;

    bookings.push({
      rowIndex: i + 2,
      timestamp: r[0],
      lab: r[1],
      date: tanggalStr,
      startTime: r[3],
      endTime: r[4],
      teacher: r[5],
      teacherEmail: r[6],
      whatsapp: r[7],
      unitClass: r[8],
      activity: r[9],
      tools: r[10],
      materials: r[11],
      accessCode: r[12],
      calendarUrl: r[13],
      eventId: r[14],
      bookingId: bookingIdVal,
      status: statusVal,
    });
  }

  return { status: "ok", bookings };
}

/* ================================
      INVENTORY – READ MASTER_DATA
================================ */
function getInventory() {
  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_MASTER_SHEET);

  if (!sheet) return { items: [], message: "MASTER_DATA sheet not found." };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { items: [] };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  function mapAliasKey_(h) {
    const u = String(h || "").trim().toUpperCase();
    switch (u) {
      case "KODE":
        return "Kode";
      case "NAMA ALAT":
        return "Nama Alat";
      case "LAB UTAMA":
        return "Lab Utama";
      case "KATEGORI":
        return "Kategori";
      case "LOKASI PENYIMPANAN":
        return "Lokasi Penyimpanan";
      case "JUMLAH TOTAL":
        return "Jumlah Total";
      case "MIN STOK":
        return "Min Stok";
      case "KONDISI":
        return "Kondisi";
      case "TERAKHIR DICEK":
        return "Terakhir Dicek";
      case "DICEK OLEH":
        return "Dicek Oleh";
      case "LINK FOTO":
        return "ImageURL";
      case "CATATAN":
        return "Catatan";
      case INVENTORY_CREATED_AT_COL:
        return "Tanggal Input";
      case INVENTORY_UPDATED_AT_COL:
        return "Terakhir Update";
      default:
        return "";
    }
  }

  const items = values.map(function (row) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const rawKey = headers[c] || "COL_" + (c + 1);
      obj[rawKey] = row[c];
      const aliasKey = mapAliasKey_(rawKey);
      if (aliasKey) obj[aliasKey] = row[c];
    }

    const idNum = idToNumber_(obj["ID"]);
    if (idNum !== null) obj["ID"] = padId4_(idNum);

    if (obj["ImageURL"] && !obj["Link Foto"]) obj["Link Foto"] = obj["ImageURL"];
    if (obj["LINK FOTO"] && !obj["ImageURL"]) obj["ImageURL"] = obj["LINK FOTO"];

    return obj;
  });

  return { items };
}

/* ================================
      INVENTORY – BACKFILL MISSING IDS
================================ */
function backfillMissingInventoryIds_(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_MASTER_SHEET);
  if (!sheet) return { status: "error", message: "MASTER_DATA sheet not found." };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1)
    return { status: "ok", filled: 0, message: "No data rows." };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idIdx = headers.indexOf("ID");
  if (idIdx < 0) return { status: "error", message: "ID column not found." };

  const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = range.getValues();

  let maxId = 0;
  for (let i = 0; i < values.length; i++) {
    const n = idToNumber_(values[i][idIdx]);
    if (n !== null && n > maxId) maxId = n;
  }

  let nextId = maxId + 1;
  let filled = 0;

  for (let i = 0; i < values.length; i++) {
    const current = String(values[i][idIdx] || "").trim();
    const n = idToNumber_(current);

    if (!current || n === null) {
      const padded = padId4_(nextId);
      values[i][idIdx] = "'" + padded;
      nextId++;
      filled++;
    } else {
      values[i][idIdx] = "'" + padId4_(n);
    }
  }

  range.setValues(values);

  return {
    status: "ok",
    filled: filled,
    message: "Backfill selesai. Semua ID sekarang tersimpan sebagai teks 4 digit (mis. 0001).",
  };
}

/* ================================
      INVENTORY – CREATE NEW ITEM
      + timestamps
      + TERAKHIR DICEK safe date coercion
      + INVENTARIS_LOG (additive)
================================ */
function createInventoryItem(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_MASTER_SHEET);
  if (!sheet) return { status: "error", message: "MASTER_DATA sheet not found." };

  ensureInventoryTimestampColumns_(sheet);

  const headers = getHeaders_(sheet);
  if (!headers || headers.length < 1) {
    return { status: "error", message: "MASTER_DATA has no header columns." };
  }

  const newRow = new Array(headers.length).fill("");

  function idx(name) {
    const i = headers.indexOf(name);
    return i >= 0 ? i : -1;
  }

  const p = e.parameter || {};

  // ID
  const idCol = idx("ID");
  if (idCol >= 0) {
    const nextId = getNextGlobalInventoryId_(sheet, idCol + 1);
    newRow[idCol] = "'" + nextId;
  }

  // KODE
  const labUtama = p.labUtama || "";
  const kategori = p.kategori || "";

  let kodeInput = String(p.kode || "").trim();
  if (!kodeInput) {
    const prefix = getKodePrefixFromCategory_(kategori);
    kodeInput = getNextKodeForLabAndPrefix_(sheet, headers, labUtama, prefix);
  }

  // Field map
  const map = [
    ["KODE", kodeInput],
    ["NAMA ALAT", p.namaAlat],
    ["LAB UTAMA", labUtama],
    ["KATEGORI", kategori],
    ["LOKASI PENYIMPANAN", p.lokasiPenyimpanan],
    ["JUMLAH TOTAL", p.jumlahTotal],
    ["MIN STOK", p.minStok],
    ["KONDISI", p.kondisi],
    ["DICEK OLEH", p.dicekOleh],
    ["LINK FOTO", p.linkFoto],
    ["CATATAN", p.catatan],
  ];

  map.forEach(([header, value]) => {
    const c = idx(header);
    if (c >= 0 && value !== undefined && value !== "") newRow[c] = value;
  });

  // TERAKHIR DICEK: set only if provided
  if (Object.prototype.hasOwnProperty.call(p, "terakhirDicek")) {
    const c = idx("TERAKHIR DICEK");
    if (c >= 0) newRow[c] = coerceDateInput_(p.terakhirDicek);
  }

  // timestamps
  const now = new Date();
  const createdIdx = idx(INVENTORY_CREATED_AT_COL);
  const updatedIdx = idx(INVENTORY_UPDATED_AT_COL);

  if (createdIdx >= 0 && !newRow[createdIdx]) newRow[createdIdx] = now;
  if (updatedIdx >= 0) newRow[updatedIdx] = now;

  sheet.appendRow(newRow);

  // INVENTARIS_LOG CREATE
  try {
    const jumlahTotal = String(p.jumlahTotal || "").trim() || "-";
    const actor = getRequestUserEmail_() || "ADMIN";
    appendInventarisLogRow_([
      now,
      "CREATE",
      kodeInput,
      String(p.namaAlat || ""),
      jumlahTotal,
      "-",
      String(p.lokasiPenyimpanan || ""),
      "-",
      actor,
      "Create inventory item",
    ]);
  } catch (lerr) {
    Logger.log("INVENTARIS_LOG create failed: " + lerr);
  }

  return {
    status: "ok",
    message: "Inventory item created.",
    assignedId: idCol >= 0 ? String(newRow[idCol]).replace(/^'/, "") : "",
    assignedKode: kodeInput,
  };
}

/* ================================
      INVENTORY – UPDATE ITEM
      + timestamps
      + TERAKHIR DICEK safe date coercion
      + INVENTARIS_LOG (additive)
================================ */
function updateInventoryItem(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const idParamRaw = e.parameter.ID || "";
  if (!idParamRaw) return { status: "error", message: "Missing inventory ID." };

  const idParamNorm = normalizeIdForCompare_(idParamRaw);

  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_MASTER_SHEET);
  if (!sheet) return { status: "error", message: "MASTER_DATA sheet not found." };

  ensureInventoryTimestampColumns_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1)
    return { status: "error", message: "No inventory data to update." };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colIndexByName = {};
  for (let c = 0; c < headers.length; c++) {
    const name = headers[c];
    if (name) colIndexByName[String(name)] = c + 1;
  }

  const idCol = colIndexByName["ID"];
  if (!idCol) return { status: "error", message: "ID column not found." };

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let targetRowIndex = null;
  for (let i = 0; i < values.length; i++) {
    const cellId = values[i][idCol - 1];
    const cellNorm = normalizeIdForCompare_(cellId);
    if (cellNorm && cellNorm === idParamNorm) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (!targetRowIndex)
    return { status: "error", message: "Inventory ID not found in MASTER_DATA." };

  const rowRange = sheet.getRange(targetRowIndex, 1, 1, lastCol);
  const rowValues = rowRange.getValues()[0];

  // capture old values for logging
  const idxKode = headers.indexOf("KODE");
  const idxNama = headers.indexOf("NAMA ALAT");
  const idxJumlah = headers.indexOf("JUMLAH TOTAL");
  const idxLokasi = headers.indexOf("LOKASI PENYIMPANAN");

  const oldKode = idxKode >= 0 ? rowValues[idxKode] : "";
  const oldNama = idxNama >= 0 ? rowValues[idxNama] : "";
  const oldJumlah = idxJumlah >= 0 ? rowValues[idxJumlah] : "";
  const oldLokasi = idxLokasi >= 0 ? rowValues[idxLokasi] : "";

  // preserve createdAt
  const createdIdx = headers.indexOf(INVENTORY_CREATED_AT_COL);
  const updatedIdx = headers.indexOf(INVENTORY_UPDATED_AT_COL);
  const createdAtOriginal = createdIdx >= 0 ? rowValues[createdIdx] : null;

  // apply updates
  applyInventoryUpdates(rowValues, headers, e.parameter);

  // keep createdAt original
  if (createdIdx >= 0) rowValues[createdIdx] = createdAtOriginal;

  // set updatedAt always
  const now = new Date();
  if (updatedIdx >= 0) rowValues[updatedIdx] = now;

  rowRange.setValues([rowValues]);

  // INVENTARIS_LOG UPDATE
  try {
    const newKode = idxKode >= 0 ? rowValues[idxKode] : oldKode;
    const newNama = idxNama >= 0 ? rowValues[idxNama] : oldNama;
    const newJumlah = idxJumlah >= 0 ? rowValues[idxJumlah] : oldJumlah;
    const newLokasi = idxLokasi >= 0 ? rowValues[idxLokasi] : oldLokasi;

    const actor = getRequestUserEmail_() || "ADMIN";

    const noteParts = [];
    if (String(oldJumlah) !== String(newJumlah))
      noteParts.push("JUMLAH: " + oldJumlah + " → " + newJumlah);
    if (String(oldLokasi) !== String(newLokasi))
      noteParts.push("LOKASI: " + oldLokasi + " → " + newLokasi);

    appendInventarisLogRow_([
      now,
      "UPDATE",
      String(newKode || oldKode || ""),
      String(newNama || oldNama || ""),
      String(newJumlah || oldJumlah || "-"),
      "-",
      String(newLokasi || oldLokasi || ""),
      "-",
      actor,
      noteParts.length ? noteParts.join(" | ") : "Update inventory item",
    ]);
  } catch (lerr2) {
    Logger.log("INVENTARIS_LOG update failed: " + lerr2);
  }

  return { status: "ok", message: "Inventory item updated." };
}

function applyInventoryUpdates(rowValues, headers, params) {
  const mapping = {
    lokasiPenyimpanan: "LOKASI PENYIMPANAN",
    jumlahTotal: "JUMLAH TOTAL",
    minStok: "MIN STOK",
    kondisi: "KONDISI",
    dicekOleh: "DICEK OLEH",
    linkFoto: "LINK FOTO",
    catatan: "CATATAN",
  };

  Object.keys(mapping).forEach(function (paramKey) {
    const headerName = mapping[paramKey];
    const newValue = params[paramKey];
    if (newValue !== undefined && newValue !== null && newValue !== "") {
      const colIndex = headers.indexOf(headerName);
      if (colIndex >= 0) rowValues[colIndex] = newValue;
    }
  });

  // TERAKHIR DICEK: update ONLY if provided
  if (Object.prototype.hasOwnProperty.call(params, "terakhirDicek")) {
    const idxTerakhirDicek = headers.indexOf("TERAKHIR DICEK");
    if (idxTerakhirDicek >= 0) {
      rowValues[idxTerakhirDicek] = coerceDateInput_(params.terakhirDicek);
    }
  }
}

/* ============================================================
      INVENTORY – BORROW / RETURN (ADD-ONLY)
============================================================ */
function borrowInventoryItem_(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const p = (e && e.parameter) || {};

  const kodeAlat = String(p.kodeAlat || p.kode || "").trim();
  const namaAlat = String(p.namaAlat || p.nama || "").trim();
  const jumlah = Number(p.jumlah || p.qty || 0);

  if (!kodeAlat || !namaAlat || !isFinite(jumlah) || jumlah <= 0) {
    return { status: "error", message: "Invalid borrow payload." };
  }

  const dari = String(p.dari || "Gudang").trim();
  const ke = String(p.ke || "").trim();
  const guruKelas = String(p.guruKelas || p.unitClass || "").trim();
  const dicatatOleh = getRequestUserEmail_() || String(p.dicatatOleh || "ADMIN");
  const catatan = String(p.catatan || "").trim();

  // NEW (optional): link borrow to booking
  const bookingId = String(p.bookingId || "").trim();

  const now = new Date();
  const refId = Utilities.getUuid();

  // NOW: 13 columns (Tanggal Return empty + BookingId)
  appendInventarisPinjamRow_([
    now,
    kodeAlat,
    namaAlat,
    jumlah,
    dari,
    ke,
    guruKelas,
    "BORROWED",
    dicatatOleh,
    catatan,
    refId,
    "",        // Tanggal Return
    bookingId, // BookingId (optional)
  ]);

  // also log movement
  try {
    appendInventarisLogRow_([
      now,
      "BORROW",
      kodeAlat,
      namaAlat,
      String(jumlah),
      dari,
      ke,
      guruKelas,
      dicatatOleh,
      (bookingId ? ("BookingId: " + bookingId + " | ") : "") + (catatan || "Borrowed"),
    ]);
  } catch (lerr) {}

  return { status: "ok", refId: refId, bookingId: bookingId || "" };
}

function returnInventoryItem_(e) {
  if (!isAdminRequest_(e)) {
    return { status: "unauthorized", message: "Invalid admin key / user" };
  }

  const p = (e && e.parameter) || {};
  const refId = String(p.refId || "").trim();
  const jumlah = Number(p.jumlah || p.qty || 0);

  if (!refId || !isFinite(jumlah) || jumlah <= 0) {
    return { status: "error", message: "Invalid return payload." };
  }

  const ss = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_BORROW_SHEET);
  if (!sheet) {
    return { status: "error", message: "INVENTARIS_PINJAM sheet not found." };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { status: "error", message: "No borrow records found." };
  }

  const headers = data[0];
  const refIdx = headers.indexOf("RefId");
  const kodeIdx = headers.indexOf("Kode Alat");
  const namaIdx = headers.indexOf("Nama Alat");
  const statusIdx = headers.indexOf("Status");
  const returnIdx = headers.indexOf("Tanggal Return");

  if (refIdx < 0 || statusIdx < 0) {
    return { status: "error", message: "Required columns not found." };
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][refIdx]) === refId) {

      const currentStatus = String(data[i][statusIdx] || "").trim().toUpperCase();

      // Idempotent guard
      if (currentStatus === "RETURNED") {
        return {
          status: "ok",
          refId,
          message: "Already returned (idempotent)."
        };
      }

      const kodeAlat = kodeIdx >= 0 ? data[i][kodeIdx] : "";
      const namaAlat = namaIdx >= 0 ? data[i][namaIdx] : "";

      const now = new Date();

      sheet.getRange(i + 1, statusIdx + 1).setValue("RETURNED");
      if (returnIdx >= 0) {
        sheet.getRange(i + 1, returnIdx + 1).setValue(now);
      }

      appendInventarisLogRow_([
        now,
        "RETURN",
        kodeAlat,
        namaAlat,
        String(jumlah),
        "-",
        "-",
        "-",
        getRequestUserEmail_() || "ADMIN",
        "Returned"
      ]);

      return { status: "ok", refId };
    }
  }

  return { status: "error", message: "RefId not found in INVENTARIS_PINJAM." };
}

/* ================================
      ADMIN LOGIN
================================ */
function handleAdminLogin(e) {
  const params = e.parameter || {};
  const code = params.code || "";

  if (!code || code !== ADMIN_KEY) {
    return { success: false, message: "Kode akses admin tidak valid." };
  }

  const token = "labipa-admin-" + Utilities.getUuid();
  const expiresAt = Date.now() + (6 * 60 * 60 * 1000); // 6 hours

  PropertiesService.getScriptProperties().setProperty(
    "ADMIN_SESSION_" + token,
    String(expiresAt)
  );

  return {
    success: true,
    role: "ADMIN",
    message: "Login admin berhasil.",
    token: token,
    expiresAt: expiresAt
  };
}

/* ================================
      UTILITIES
================================ */
function sortToList(obj, limit) {
  const arr = Object.keys(obj).map(function (k) {
    return { name: k, count: obj[k] };
  });
  arr.sort(function (a, b) {
    return b.count - a.count;
  });
  return limit && limit > 0 ? arr.slice(0, limit) : arr;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* ============================================================
   TEACHER CONFIRMATION EMAIL
============================================================ */
function formatLabLabel_(lab) {
  const s = String(lab || "").toUpperCase();
  if (s === "LAB_SD2") return "Lab SD 2 (Lab 2)";
  return "Lab SD 1 & SMP (Lab 1)";
}

function safeLine_(label, value) {
  const v = value === null || value === undefined ? "" : String(value).trim();
  return label + ": " + (v ? v : "-");
}

function buildTeacherConfirmationEmail_(info) {
  const subject =
    "[Lab IPA] Booking terkonfirmasi – " +
    (info.date || "") +
    " " +
    (info.startTime || "");

  const body =
    "Yth. Bapak/Ibu " +
    (info.teacher || "Guru/PIC") +
    ",\n\n" +
    "Booking penggunaan Lab IPA telah terkonfirmasi.\n\n" +
    "Detail booking:\n" +
    "1) " +
    safeLine_("Tanggal", info.date) +
    "\n" +
    "2) " +
    safeLine_("Waktu", (info.startTime || "") + " – " + (info.endTime || "")) +
    "\n" +
    "3) " +
    safeLine_("Lab", formatLabLabel_(info.lab)) +
    "\n" +
    "4) " +
    safeLine_("Unit/Kelas", info.unitClass) +
    "\n" +
    "5) " +
    safeLine_("Kegiatan", info.activity) +
    "\n\n" +
    "Catatan penting:\n" +
    "- Mohon hadir 10 menit sebelum jam mulai untuk persiapan.\n" +
    "- Setelah kegiatan, mohon memastikan area lab rapi dan alat kembali sesuai tempat.\n" +
    "- Jika terjadi perubahan jadwal, mohon konfirmasi minimal H-1 (kecuali kondisi darurat).\n\n" +
    (info.calendarUrl
      ? "Undangan kalender telah dikirim melalui Google Calendar.\nLink kalender: " +
        info.calendarUrl +
        "\n\n"
      : "Undangan kalender telah dikirim melalui Google Calendar.\n\n") +
    "Hormat kami,\n" +
    "Tim Lab IPA Alkhairiyah";

  return { subject, body };
}

/* ============================================================
   ADMIN NOTIFICATION (EMAIL ONLY)
   - Supports per-lab admin routing
   - Backward compatible (safe)
============================================================ */
const NOTIF_EMAIL_ENABLED = true; // master on/off
const NOTIF_EMAIL_TO = ADMIN_EMAIL; // fallback / central inbox
const NOTIF_SENDER_NAME = "Lab IPA System";

/* ===== Reminder Settings ===== */
const REMINDER_ENABLED = true;
const REMINDER_LOOKAHEAD_HOURS = 3; // scan window
const REMINDER_GRACE_MINUTES = 20; // safer with 15-min cadence
const REMINDER_TRIGGER_INTERVAL_MINUTES = 15; // time-driven trigger cadence

/**
 * Send admin email.
 * - If toEmail is provided → send there
 * - Else fallback to NOTIF_EMAIL_TO
 */
function sendAdminEmail_(subject, body, toEmail) {
  if (!NOTIF_EMAIL_ENABLED) return;

  const target = String(toEmail || NOTIF_EMAIL_TO || "").trim();
  if (!target) return;

  GmailApp.sendEmail(target, String(subject), String(body), {
    name: NOTIF_SENDER_NAME,
  });
}

function formatBookingLine_(label, value) {
  const v = value === null || value === undefined ? "" : String(value);
  return label + ": " + (v ? v : "-");
}


/* ======= ADMIN NOTIFICATION NEW HELPERS HERE ======= */

function formatLabLabelShort_(lab) {
  const s = String(lab || "").toUpperCase();
  if (s === "LAB_SD2") return "Lab SD2";
  return "Lab SD1&SMP";
}

function formatDateYmd_(dateValue) {
  if (dateValue instanceof Date)
    return Utilities.formatDate(dateValue, TZ, "yyyy-MM-dd");
  const s = String(dateValue || "").trim();
  return s ? s.substring(0, 10) : "";
}

function subjectNewBooking_(info) {
  return `[LAB IPA] New Booking – ${formatLabLabelShort_(info.lab)} – ${formatDateYmd_(info.date)}`;
}

function subjectBookingUpdate_(info, status) {
  const st = String(status || "").toUpperCase();
  const time = String(info.startTime || "").trim();
  const t = time ? ` ${time}` : "";
  return `[LAB IPA] Booking Update – ${st} – ${formatLabLabelShort_(info.lab)} – ${formatDateYmd_(info.date)}${t}`;
}



/* ================================
      CANCELLED NOTIFICATION
================================ */
function notifyAdminBookingCancelled_(info) {
  if (!NOTIF_EMAIL_ENABLED) return;

  const subject = subjectBookingUpdate_(info, "CANCELLED");


  const body =
    "Booking dibatalkan.\n\n" +
    formatBookingLine_("Booking ID", info.bookingId) +
    "\n" +
    formatBookingLine_("Lab", info.lab) +
    "\n" +
    formatBookingLine_("Tanggal", info.date) +
    "\n" +
    formatBookingLine_("Jam", (info.startTime || "") + " - " + (info.endTime || "")) +
    "\n" +
    formatBookingLine_("Guru/PIC", info.teacher) +
    "\n" +
    formatBookingLine_("Email", info.teacherEmail) +
    "\n" +
    formatBookingLine_("Unit & Kelas", info.unitClass) +
    "\n" +
    formatBookingLine_("Kegiatan", info.activity) +
    "\n" +
    formatBookingLine_("Dibatalkan oleh", info.cancelledBy) +
    "\n" +
    (info.cancelReason ? formatBookingLine_("Alasan", info.cancelReason) + "\n" : "") +
    "\n— Sistem Booking Lab IPA Alkhairiyah";

  // route to correct lab admin (temporary: Danisa)
  sendAdminEmail_(subject, body, getAdminEmailForLab_(info.lab));
}

/* ================================
      NO-SHOW NOTIFICATION
================================ */
function notifyAdminNoShow_(info) {
  if (!NOTIF_EMAIL_ENABLED) return;

  const subject = subjectBookingUpdate_(info, "NO_SHOW");


  const body =
    "Status booking diubah menjadi NO_SHOW.\n\n" +
    formatBookingLine_("Booking ID", info.bookingId) +
    "\n" +
    formatBookingLine_("Lab", info.lab) +
    "\n" +
    formatBookingLine_("Tanggal", info.date) +
    "\n" +
    formatBookingLine_("Jam", (info.startTime || "") + " - " + (info.endTime || "")) +
    "\n" +
    formatBookingLine_("Guru/PIC", info.teacher) +
    "\n" +
    formatBookingLine_("Email", info.teacherEmail) +
    "\n" +
    formatBookingLine_("Unit & Kelas", info.unitClass) +
    "\n" +
    formatBookingLine_("Kegiatan", info.activity) +
    "\n\n— Sistem Booking Lab IPA Alkhairiyah";

  // route to correct lab admin (temporary: Danisa)
  sendAdminEmail_(subject, body, getAdminEmailForLab_(info.lab));
}

/* ============================================================
   REMINDERS (H-2 and H-1) – time-driven trigger
   - No sheet changes; uses Script Properties to de-duplicate
============================================================ */
function reminderKey_(bookingId, tag) {
  return "REMINDER_SENT::" + String(bookingId || "") + "::" + String(tag || "");
}

function isReminderSent_(bookingId, tag) {
  const key = reminderKey_(bookingId, tag);
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v === "1";
}

function markReminderSent_(bookingId, tag) {
  const key = reminderKey_(bookingId, tag);
  PropertiesService.getScriptProperties().setProperty(key, "1");
}

function clearReminderFlags_(bookingId) {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys() || [];
  const bid = String(bookingId || "");
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.indexOf("REMINDER_SENT::" + bid + "::") === 0) {
      props.deleteProperty(k);
    }
  }
}

function jakartaNow_() {
  return new Date();
}

function getBookingSheetDataForReminders_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, message: "Bookings sheet not found." };

  ensureBookingLifecycleColumns_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { ok: true, rows: [], headers: [], idx: {} };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  const idx = {
    timestamp: 0,
    lab: 1,
    date: 2,
    startTime: 3,
    endTime: 4,
    teacher: 5,
    teacherEmail: 6,
    whatsapp: 7,
    unitClass: 8,
    activity: 9,
    tools: 10,
    materials: 11,
    accessCode: 12,
    calendarUrl: 13,
    eventId: 14,
    bookingId: findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.BOOKING_ID),
    status: findHeaderIndex_(headers, BOOKING_LIFECYCLE_COLUMNS.STATUS),
  };

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return { ok: true, rows: values, headers: headers, idx: idx };
}

function sendUpcomingReminders_() {
  if (!REMINDER_ENABLED) return;
  if (!NOTIF_EMAIL_ENABLED) return;

  const data = getBookingSheetDataForReminders_();
  if (!data.ok) return;

  const rows = data.rows || [];
  const idx = data.idx || {};

  const now = jakartaNow_();
  const nowMs = now.getTime();

  const lookaheadMs = REMINDER_LOOKAHEAD_HOURS * 60 * 60 * 1000;
  const graceMs = REMINDER_GRACE_MINUTES * 60 * 1000;

  const windowEnd = nowMs + lookaheadMs;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const bookingId =
      idx.bookingId >= 0 ? String(r[idx.bookingId] || "").trim() : "";
    if (!bookingId) continue;

    const statusRaw =
      idx.status >= 0
        ? String(r[idx.status] || "").trim().toUpperCase()
        : BOOKING_STATUS.CONFIRMED;
    if (statusRaw !== BOOKING_STATUS.CONFIRMED) continue;

    const dateStr = r[idx.date];
    const startStr = r[idx.startTime];

    let yyyyMmDd = "";
    if (dateStr instanceof Date)
      yyyyMmDd = Utilities.formatDate(dateStr, TZ, "yyyy-MM-dd");
    else yyyyMmDd = String(dateStr || "").substring(0, 10);
    if (!yyyyMmDd || !startStr) continue;

    let start;
    try {
      start = parseDateTime(yyyyMmDd, String(startStr));
    } catch (err) {
      continue;
    }

    const startMs = start.getTime();
    if (startMs < nowMs) continue;
    if (startMs > windowEnd) continue;

    const diffMs = startMs - nowMs;

    const h2 = 2 * 60 * 60 * 1000;
    const h1 = 1 * 60 * 60 * 1000;

    const shouldSendH2 = Math.abs(diffMs - h2) <= graceMs;
    const shouldSendH1 = Math.abs(diffMs - h1) <= graceMs;

    if (shouldSendH2 && !isReminderSent_(bookingId, "H2")) {
      try {
        sendReminderEmail_(r, idx, bookingId, "H-2");
        markReminderSent_(bookingId, "H2");
      } catch (e2) {
        Logger.log("H-2 reminder failed for " + bookingId + ": " + e2);
      }
    }

    if (shouldSendH1 && !isReminderSent_(bookingId, "H1")) {
      try {
        sendReminderEmail_(r, idx, bookingId, "H-1");
        markReminderSent_(bookingId, "H1");
      } catch (e1) {
        Logger.log("H-1 reminder failed for " + bookingId + ": " + e1);
      }
    }
  }
}

function sendReminderEmail_(row, idx, bookingId, tagLabel) {
  const lab = row[idx.lab] || "";
  const dateCell = row[idx.date];
  const startTime = row[idx.startTime] || "";
  const endTime = row[idx.endTime] || "";
  const teacher = row[idx.teacher] || "";
  const teacherEmail = row[idx.teacherEmail] || "";
  const unitClass = row[idx.unitClass] || "";
  const activity = row[idx.activity] || "";
  const calendarUrl = row[idx.calendarUrl] || "";

  let dateStr = "";
  if (dateCell instanceof Date)
    dateStr = Utilities.formatDate(dateCell, TZ, "yyyy-MM-dd");
  else dateStr = String(dateCell || "").substring(0, 10);

  const subject = `[LAB IPA] Reminder ${tagLabel} – ${formatLabLabelShort_(lab)} – ${dateStr} ${startTime}`;
  const body =
    "Reminder sesi Lab IPA (" + tagLabel + ").\n\n" +
    formatBookingLine_("Booking ID", bookingId) +
    "\n" +
    formatBookingLine_("Lab", lab) +
    "\n" +
    formatBookingLine_("Tanggal", dateStr) +
    "\n" +
    formatBookingLine_("Jam", String(startTime) + " - " + String(endTime)) +
    "\n" +
    formatBookingLine_("Guru/PIC", teacher) +
    "\n" +
    formatBookingLine_("Email", teacherEmail) +
    "\n" +
    formatBookingLine_("Unit & Kelas", unitClass) +
    "\n" +
    formatBookingLine_("Kegiatan", activity) +
    "\n" +
    (calendarUrl ? "\nLink kalender: " + calendarUrl + "\n" : "") +
    "\n— Sistem Booking Lab IPA Alkhairiyah";

  sendAdminEmail_(subject, body, getAdminEmailForLab_(lab));
}

/* ============================================================
   TRIGGER INSTALLERS (RUN ONCE MANUALLY)
============================================================ */
function installReminderTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    if (t.getHandlerFunction && t.getHandlerFunction() === "sendUpcomingReminders_") {
      ScriptApp.deleteTrigger(t);
    }
  }

  ScriptApp.newTrigger("sendUpcomingReminders_")
    .timeBased()
    .everyMinutes(REMINDER_TRIGGER_INTERVAL_MINUTES)
    .create();

  return {
    status: "ok",
    message:
      "Reminder trigger installed (every " +
      REMINDER_TRIGGER_INTERVAL_MINUTES +
      " minutes).",
  };
}

function removeReminderTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    if (t.getHandlerFunction && t.getHandlerFunction() === "sendUpcomingReminders_") {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  return { status: "ok", removed: removed };
}
