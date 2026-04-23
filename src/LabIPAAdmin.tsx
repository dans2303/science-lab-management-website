// src/LabIPAAdmin.tsx
import React, { useEffect, useRef, useState } from "react";
const logo = "/logo-alkhairiyah.png";

/* ========= ENDPOINT ========= */

const BOOKING_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzhu2nsGjTx8hsX8Kz9Z1iTARsclBe1AFTrEgxiS1yYRZHkfKora0m1LSCR5ph_iUDT/exec";

/* ========= BACKEND MODES =========*/
const MODE_ADMIN_SET_BOOKING_STATUS = "setBookingStatus";
const MODE_ADMIN_CANCEL_BOOKING = "cancelBooking";
const MODE_INVENTORY_BORROW = "inventoryBorrow";
const MODE_INVENTORY_RETURN = "inventoryReturn";
const MODE_ADMIN_BORROWED_INVENTORY = "adminBorrowedInventory";

/* ========= HELPERS (FORMATTER) ========= */

// Helper: make date short & neat (e.g. "2025-12-03" → "03/12/2025")
function formatLogDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();

  // Case 1: "2025-12-03" or "2025-12-03T..."
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }

  // Case 2: parseable date string
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Fallback
  return s;
}

// Helper: make time short (keep only HH:MM)
function formatLogTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();

  // Case 1: "08:30" or "08:30:00"
  const hhmmMatch = s.match(/(\d{2}):(\d{2})/);
  if (hhmmMatch) {
    const [, hh, mm] = hhmmMatch;
    return `${hh}:${mm}`;
  }

  // Case 2: parseable date/time
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // Fallback
  return s;
}

/* ========= TYPES ========= */

type BookingStatus = "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";

/* =========================
   BOOKING TYPES
========================= */

// Normalized booking used by the React UI
type AdminBooking = {
  rowIndex: number;

  // Locked identifiers
  bookingId?: string;
  calendarEventId?: string;
  status?: BookingStatus;

  lab: string; // LAB_SD1_SMP / LAB_SD2
  date: string;
  startTime: string;
  endTime: string;
  teacher: string;
  teacherEmail: string;
  whatsapp: string;
  unitClass: string;
  activity: string;
  tools: string;
  materials: string;
  calendarUrl: string;
};

// Raw booking from Apps Script
type RawAdminBooking = {
  [key: string]: any;
};

type AdminResponse =
  | { status: "ok"; bookings: RawAdminBooking[] }
  | { status: "unauthorized"; message: string }
  | Record<string, any>;


/* =========================
   INVENTORY TYPES
========================= */

type InventoryItem = {
  [key: string]: any;

  ID?: number | string;
  Kode?: string;
  "Nama Alat"?: string;
  "Lab Utama"?: string;
  Kategori?: string;
  "Lokasi Penyimpanan"?: string;
  "Jumlah Total"?: number | string;
  "Min Stok"?: number | string;
  Kondisi?: string;

  "Terakhir Dicek"?: string;
  "Dicek Oleh"?: string;

  "Link Foto"?: string;     // legacy
  ImageURL?: string;        // normalized for UI
  Catatan?: string;

  "Foto Folder"?: string;
};

type InventoryResponse = {
  items?: InventoryItem[];
  [key: string]: any;
};


/* =========================
   BORROWED ITEMS (ACTIVE)
========================= */

type BorrowedRow = {
  refId: string;
  status: string;

  // dates
  tanggalPinjam?: string; // preferred (matches sheet header)
  tanggal?: string; // legacy alias used by some handlers/backends

  // item identity
  kodeAlat?: string;
  namaAlat?: string;

  // quantities (different backends may provide different fields)
  jumlah?: number | string; // legacy alias
  jumlahDipinjam?: number | string;
  jumlahKembali?: number | string;
  sisa?: number | string;

  // movement / ownership
  dari?: string;
  ke?: string;
  guruKelas?: string;
  dicatatOleh?: string;
  catatan?: string;

  // optional booking linkage (future-safe)
  bookingId?: string;
  bookingRowIndex?: number | string;
  bookingLab?: string;
  bookingDate?: string;
  bookingTime?: string;
};

/* ========= HELPERS (LABEL PRINTING) ========= */

const escapeHtml = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isBundledItem = (item: InventoryItem) => {
  const cat = String(item.Catatan ?? "").toUpperCase();
  const name = String(item["Nama Alat"] ?? "").toUpperCase();
  const kategori = String(item.Kategori ?? "").toUpperCase();
  const qty = Number(item["Jumlah Total"]);

  if (cat.includes("SET") || cat.includes("BUNDLE") || cat.includes("PAKET")) return true;

  const keyword =
    /(BEAKER|GELAS BEKER|TEST TUBE|TABUNG REAKSI|PIPET|PIPETTE|DROP(PER)?|SLIDE|COVER GLASS|PETRI|CUVETTE|SPATULA|STIRRER|KACA ARLOJI|FUNNEL|CORONG)/i;

  if (qty > 1 && (keyword.test(name) || kategori === "KIMIA" || kategori === "BIOLOGI")) {
    return true;
  }

  return false;
};


type TabKey = "log" | "inventory";
type UnitFilter = "ALL" | "SD1" | "SMP";
type LabLogFilter = "LAB_SD1_SMP" | "LAB_SD2";

type StatusFilter = "ALL" | BookingStatus;

/* ========= MAIN COMPONENT ========= */
const LabIPAAdmin = () => {
  const [isEnglish, setIsEnglish] = useState(false);
  const T = (id: string, en: string) => (isEnglish ? en : id);

  // 🔐 Front-page login state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabKey>("log");

  // Admin key used for backend calls (same as before)
  const [adminKey, setAdminKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);

  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // SD1 / SMP filter (for LAB_SD1_SMP logbook)
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("ALL");

  // Lab filter for log-book (Lab SD1 & SMP vs Lab SD 2)
  const [logLabFilter, setLogLabFilter] = useState<LabLogFilter>("LAB_SD1_SMP");

  // NEW: booking status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // NEW: booking action UI state
  const [bookingActionLoadingId, setBookingActionLoadingId] = useState<string | null>(null);
  const [bookingActionMessage, setBookingActionMessage] = useState<string | null>(null);

  // Inventory state (Admin Inventaris)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [invFromBooking, setInvFromBooking] = useState<AdminBooking | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // ==============================
  // PHASE A: BORROW / RETURN (UI ONLY)
  // ==============================
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [borrowItem, setBorrowItem] = useState<InventoryItem | null>(null);
  const [borrowQty, setBorrowQty] = useState<number>(1);
  const [borrowKe, setBorrowKe] = useState("");
  const [borrowGuruKelas, setBorrowGuruKelas] = useState("");
  const [borrowCatatan, setBorrowCatatan] = useState("");
  const [borrowDicatatOleh, setBorrowDicatatOleh] = useState("Admin");
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [borrowSuccessRefId, setBorrowSuccessRefId] = useState<string | null>(null);

  const [borrowedOpen, setBorrowedOpen] = useState(false);
  const [borrowedRows, setBorrowedRows] = useState<BorrowedRow[]>([]);
  const [borrowedError, setBorrowedError] = useState<string | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRefId, setReturnRefId] = useState("");
  const [returnQty, setReturnQty] = useState(1);
  const [returnDicatatOleh, setReturnDicatatOleh] = useState("Admin");
  const [returnCatatan, setReturnCatatan] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccessRefId, setReturnSuccessRefId] = useState<string | null>(null);

  // ==============================
  // PHASE 1: INVENTORY UI FILTERS
  // ==============================
  const [invSearch, setInvSearch] = useState("");
  const [invFilterLab, setInvFilterLab] = useState<"ALL" | "LAB1" | "LAB2">("ALL");
  const [invFilterKategori, setInvFilterKategori] = useState<
    "ALL" | "Fisika" | "Biologi" | "Kimia" | "Umum"
  >("ALL");
  const [invLowStockOnly, setInvLowStockOnly] = useState(false);

  // ==============================
  // PHASE 1 HELPERS (SAFE)
  // ==============================
  const isLowStock = (item: InventoryItem) => {
    const total = Number(item["Jumlah Total"]);
    const min = Number(item["Min Stok"]);
    if (isNaN(total) || isNaN(min)) return false;
    return total <= min;
  };

  const getFilteredInventoryItems = () => {
    return inventoryItems.filter((item) => {
      // search
      const q = invSearch.toLowerCase();
      if (q) {
        const name = (item["Nama Alat"] || "").toLowerCase();
        const kode = (item.Kode || "").toLowerCase();
        const lokasi = (item["Lokasi Penyimpanan"] || "").toLowerCase();
        if (!name.includes(q) && !kode.includes(q) && !lokasi.includes(q)) {
          return false;
        }
      }

      // lab filter (based on your current data)
      const labRaw = (item["Lab Utama"] || "").toUpperCase();
      if (invFilterLab === "LAB1" && !labRaw.includes("SD1") && !labRaw.includes("SMP")) return false;
      if (invFilterLab === "LAB2" && !labRaw.includes("SD2")) return false;

      // kategori
      if (invFilterKategori !== "ALL" && item.Kategori !== invFilterKategori) return false;

      // low stock
      if (invLowStockOnly && !isLowStock(item)) return false;

      return true;
    });
  };

  // ==============================
  // PHASE 2: NEEDS ATTENTION HELPERS
  // ==============================

  const isConditionProblem = (item: InventoryItem) => {
    const kondisi = (item.Kondisi || "").toLowerCase().trim();
    if (!kondisi) return false;
    return kondisi !== "baik";
  };

  const isLongNotChecked = (item: InventoryItem, days = 90) => {
    const raw = item["Terakhir Dicek"];
    if (!raw) return true; // never checked → attention

    const d = new Date(String(raw));
    if (isNaN(d.getTime())) return true;

    const diffMs = Date.now() - d.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > days;
  };

  const getNeedsAttentionItems = () => {
    return inventoryItems.filter((item) => isLowStock(item) || isConditionProblem(item) || isLongNotChecked(item));
  };

  // NEW: filter for printing inventory
  const [inventoryPrintLab, setInventoryPrintLab] = useState<"ALL" | "LAB1" | "LAB2">("ALL");

  // ✅ NEW: ref to avoid state timing issue (dropdown change then immediate click print)
  const inventoryPrintLabRef = useRef<"ALL" | "LAB1" | "LAB2">("ALL");

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [inventorySaveMessage, setInventorySaveMessage] = useState<string | null>(null);

  // state for "input data / add new item"
  const [newItem, setNewItem] = useState<InventoryItem>({
    "Nama Alat": "",
    "Lab Utama": "",
    Kategori: "",
    "Lokasi Penyimpanan": "",
    "Jumlah Total": "",
    "Min Stok": "",
    Kondisi: "",
    "Terakhir Dicek": "",
    "Dicek Oleh": "",
    Catatan: "",
  });
  const [newItemSaving, setNewItemSaving] = useState(false);
  const [newItemMessage, setNewItemMessage] = useState<string | null>(null);

  // image upload state (edit & new)
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadImageMessage, setUploadImageMessage] = useState<string | null>(null);
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);

  // ==============================
  // PHASE 3: LABEL PRINT SETTINGS
  // ==============================
  const [labelPreset, setLabelPreset] = useState<"A4_2x5" | "A4_2x4">("A4_2x5");

  // Load saved admin session from localStorage → auto-login
  useEffect(() => {
    try {
      const raw = localStorage.getItem("labipa_admin_session");
      if (!raw) return;

      const sess = JSON.parse(raw || "{}");
      const token = String(sess?.token || "").trim();
      const expiresAt = Number(sess?.expiresAt || 0);

      if (token && (!expiresAt || expiresAt > Date.now())) {
        setStoredKey(token);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem("labipa_admin_session");
      }
    } catch {
      // ignore
    }
  }, []);

const effectiveKey = storedKey ?? adminKey;

  const labLabel = (labKey: LabLogFilter): string => {
    if (labKey === "LAB_SD1_SMP") return "Lab SD1 & SMP";
    if (labKey === "LAB_SD2") return "Lab SD 2";
    return labKey;
  };

  const statusBadgeLabel = (s?: string) => {
    const x = String(s || "").toUpperCase();
    if (!x) return T("CONFIRMED", "CONFIRMED");
    return x;
  };

  const statusBadgeClass = (s?: string) => {
    const x = String(s || "").toUpperCase();
    if (x === "CANCELLED") return "bg-rose-200 text-rose-900";
    if (x === "NO_SHOW") return "bg-yellow-200 text-yellow-900";
    if (x === "RESCHEDULED") return "bg-sky-200 text-sky-900";
    return "bg-emerald-200 text-emerald-900";
  };

  /* ========= LOGIN HANDLERS ========= */

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeTrimmed = loginCode.trim();

    if (!codeTrimmed) {
      setLoginError(T("Silakan masukkan kode admin.", "Please enter the admin code."));
      return;
    }

    setLoginError(null);
    setLoginLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("mode", "adminLogin");
      params.append("code", codeTrimmed);

      const res = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        body: params,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (!json.success) {
        setLoginError(json.message || T("Kode admin tidak valid.", "Admin code is not valid."));
        return;
      }

      // Success
      const token = String(json.token || "").trim();
      const expiresAt = Number(json.expiresAt || 0);

      if (!token) {
        setLoginError(T("Login berhasil tapi token tidak ditemukan.", "Login succeeded but no token was returned."));
        return;
      }

      setIsAuthenticated(true);
      setStoredKey(token); // storedKey holds token now
      setAdminKey("");

      try {
        localStorage.setItem(
          "labipa_admin_session",
          JSON.stringify({
            token,
            expiresAt,
            lastValidatedAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }
    } catch (err: any) {
      setLoginError(
        T("Terjadi kesalahan saat login.", "An error occurred during login.") + (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setStoredKey(null);
    setAdminKey("");
    setBookings([]);
    setInventoryItems([]);
    setEditingItem(null);
    setInventorySaveMessage(null);
    setInventoryError(null);
    setLoadError(null);
    setUploadImageMessage(null);
    setNewItemMessage(null);
    setBookingActionMessage(null);
    setBookingActionLoadingId(null);

    // Phase A: close borrow/return modals & popups
    setBorrowOpen(false);
    setReturnOpen(false);
    setBorrowSuccessRefId(null);
    setReturnSuccessRefId(null);
    setBorrowError(null);
    setReturnError(null);

    try {
      localStorage.removeItem("labipa_admin_session");
    } catch {
      // ignore
    }
  };

  /* ========= DATA LOADERS ========= */

  // Normalize raw rows from Apps Script to a clean AdminBooking[]
  const normalizeBookings = (rawRows: RawAdminBooking[]): AdminBooking[] => {
    return (rawRows || []).map((raw, idx) => {
      const lab = (raw.lab || raw.Lab || raw.labName || "").toString() || "";

      const date = raw.date || raw.tanggal || raw.bookingDate || "";
      const startTime = raw.startTime || raw.jamMulai || raw.timeStart || raw.start || "";
      const endTime = raw.endTime || raw.jamSelesai || raw.timeEnd || raw.end || "";
      const teacher = raw.teacher || raw.guru || raw.teacherName || "";
      const teacherEmail = raw.teacherEmail || raw.email || raw.teacher_email || "";
      const whatsapp = raw.whatsapp || raw.wa || raw.whatsappNumber || "";
      const unitClass = raw.unitClass || raw.unitKelas || raw.kelas || raw.className || raw.unit || "";
      const activity = raw.activity || raw.kegiatan || raw.topic || raw.topik || "";
      const tools = raw.tools || raw.alat || raw.toolsUsed || "";
      const materials = raw.materials || raw.bahan || raw.material || "";
      const calendarUrl = raw.calendarUrl || raw.eventUrl || raw.calendar_link || "";

      const rowIndex =
        typeof raw.rowIndex === "number"
          ? raw.rowIndex
          : typeof raw.Row === "number"
          ? raw.Row
          : idx + 2; // guess row (header = row 1)

      // NEW: booking identifiers + status (best-effort)
      const bookingId = raw.bookingId || raw.BookingID || raw.id || raw.uuid || raw.bookingUUID || "";
      const calendarEventId = raw.calendarEventId || raw.eventId || raw.calendar_id || raw.gcalEventId || "";
      const statusRaw = raw.status || raw.Status || raw.bookingStatus || raw.state || "CONFIRMED";
      const status = String(statusRaw || "CONFIRMED").toUpperCase() as BookingStatus;

      return {
        rowIndex,

        bookingId: bookingId ? String(bookingId) : undefined,
        calendarEventId: calendarEventId ? String(calendarEventId) : undefined,
        status,

        lab: lab.toUpperCase(),
        date: String(date),
        startTime: String(startTime),
        endTime: String(endTime),
        teacher: String(teacher),
        teacherEmail: String(teacherEmail),
        whatsapp: String(whatsapp),
        unitClass: String(unitClass),
        activity: String(activity),
        tools: String(tools),
        materials: String(materials),
        calendarUrl: String(calendarUrl),
      };
    });
  };

  const handleLoadBookings = async () => {
    if (!effectiveKey) {
      setLoadError(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setBookingActionMessage(null);

    try {
      const params = new URLSearchParams();
      params.append("mode", "adminBookings");
      params.append("token", effectiveKey);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const url = `${BOOKING_ENDPOINT}?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AdminResponse = await res.json();

      if ((data as any).status === "unauthorized") {
        setBookings([]);
        setLoadError(
          T(
            "Kode admin tidak dikenali oleh server. Silakan login ulang.",
            "Admin key is not recognized by the server. Please log in again."
          )
        );
        handleLogout();
        return;
      }

      if ((data as any).status === "ok") {
        const okData = data as { status: "ok"; bookings: RawAdminBooking[] };
        const normalized = normalizeBookings(okData.bookings || []);
        setBookings(normalized);

        // keep your current UI behavior:
        setUnitFilter("ALL");
        setLogLabFilter("LAB_SD1_SMP");
        setStatusFilter("ALL");

        return;
      }

      throw new Error("Unexpected response");
    } catch (err: any) {
      console.error("Admin load error:", err);
      setLoadError(
        T("Gagal memuat data booking. Silakan coba lagi.", "Failed to load booking data. Please try again.") +
          (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setInventorySaveMessage(null);
    setUploadImageMessage(null);
  };

  const updateEditingField = (field: keyof InventoryItem, value: any) => {
    setEditingItem((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const fetchInventory = async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    setInventorySaveMessage(null);
    setUploadImageMessage(null);

    try {
      const params = new URLSearchParams();
      params.append("mode", "inventory");
      const url = `${BOOKING_ENDPOINT}?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: InventoryResponse = await res.json();
      const normalized = normalizeInventoryItems(json.items || []);
      setInventoryItems(normalized);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("Inventory load error:", err);
      }
      setInventoryError(
        T("Gagal memuat data inventaris. Silakan coba lagi.", "Failed to load inventory data. Please try again.") +
          (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setInventoryLoading(false);
    }
  };

  // ====== NORMALIZER UNTUK INVENTARIS ======
  const normalizeInventoryItems = (rows: any[]): InventoryItem[] => {
    return (rows || []).map((row) => {
      const id = row.ID ?? row.id ?? row.rowId ?? row.row ?? "";
      const image = row.ImageURL ?? row["Link Foto"] ?? row.linkFoto ?? row.fotoUrl ?? row.imageUrl ?? "";

      return {
        ID: id,
        Kode: row.Kode ?? row.kode ?? row.code ?? "",
        "Nama Alat": row["Nama Alat"] ?? row.namaAlat ?? row.Nama ?? row.nama ?? "",
        "Lab Utama": row["Lab Utama"] ?? row.labUtama ?? row.lab ?? row.unitLab ?? "",
        Kategori: row.Kategori ?? row.kategori ?? row.category ?? "",
        "Lokasi Penyimpanan": row["Lokasi Penyimpanan"] ?? row.lokasiPenyimpanan ?? row.lokasi ?? row.lokasiSimpan ?? "",
        "Jumlah Total": row["Jumlah Total"] ?? row.jumlahTotal ?? row.jumlah ?? row.qty ?? "",
        "Min Stok": row["Min Stok"] ?? row.minStok ?? row.minimalStok ?? "",
        Kondisi: row.Kondisi ?? row.kondisi ?? row.condition ?? "",
        "Terakhir Dicek": row["Terakhir Dicek"] ?? row.terakhirDicek ?? row.lastCheck ?? "",
        "Dicek Oleh": row["Dicek Oleh"] ?? row.dicekOleh ?? row.checkedBy ?? "",
        "Link Foto": image,
        ImageURL: image,
        Catatan: row.Catatan ?? row.catatan ?? row.notes ?? "",
        "Foto Folder": row["Foto Folder"] ?? row.fotoFolder ?? row.folderLabel ?? "",
      };
    });
  };

// ====== Borrowed inventory (Admin dashboard) ======
const fetchBorrowedInventory = async () => {
  if (!effectiveKey) {
    setInventoryError(
      T(
        "Sesi admin belum aktif. Silakan login ulang.",
        "Admin session is not active. Please log in again."
      )
    );
    return;
  }

  setInventoryLoading(true);
  setInventoryError(null);
  setInventorySaveMessage(null);
  setUploadImageMessage(null);

  setBorrowedError(null);
  setBorrowedRows([]);

  try {
    const params = new URLSearchParams();
    params.append("mode", MODE_ADMIN_BORROWED_INVENTORY);
    params.append("token", effectiveKey);

    const url = `${BOOKING_ENDPOINT}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    if (json.status === "unauthorized") {
      setBorrowedRows([]);
      setBorrowedError(
        T(
          "Sesi admin tidak valid. Silakan login ulang.",
          "Admin session is invalid. Please log in again."
        )
      );
      setBorrowedOpen(true);
      return;
    }

    const rows = (json.rows || json.items || json.data || []) as any[];

    const normalized: BorrowedRow[] = rows.map((r: any) => {
      const jumlahDipinjam =
        r.jumlahDipinjam ?? r["Jumlah Dipinjam"] ?? r.qty ?? r.jumlah ?? r["Jumlah"] ?? "";

      const jumlahKembali =
        r.jumlahKembali ?? r["Jumlah Kembali"] ?? r.returned ?? r["Jumlah Returned"] ?? 0;

      const sisa =
        r.sisa ?? r["Sisa"] ?? r.remaining ?? jumlahDipinjam;

      return {
        refId: String(r.refId || r.RefId || r.id || r.ID || "").trim(),
        status: String(r.status || r.Status || "BORROWED").trim(),

        tanggalPinjam: String(
          r.tanggalPinjam || r["Tanggal Pinjam"] || r.tanggal || r.Tanggal || r.date || ""
        ).trim(),
        tanggal: String(r.tanggal || r.Tanggal || r.date || "").trim(),

        kodeAlat: String(r.kodeAlat || r["Kode Alat"] || r.kode || "").trim(),
        namaAlat: String(r.namaAlat || r["Nama Alat"] || r.nama || "").trim(),

        jumlahDipinjam,
        jumlahKembali,
        sisa,

        dari: String(r.dari || r["Dari"] || "").trim(),
        ke: String(r.ke || r["Ke"] || r.lab || "").trim(),
        guruKelas: String(r.guruKelas || r["Guru/Kelas"] || r.guru || "").trim(),
        dicatatOleh: String(r.dicatatOleh || r["Dicatat Oleh"] || "").trim(),
        catatan: String(r.catatan || r["Catatan"] || "").trim(),

        bookingId: String(r.bookingId || r.BookingID || "").trim(),
        bookingRowIndex: r.bookingRowIndex ?? r.bookingRow ?? "",
        bookingLab: String(r.bookingLab || "").trim(),
        bookingDate: String(r.bookingDate || "").trim(),
        bookingTime: String(r.bookingTime || "").trim(),
      };
    });

    setBorrowedRows(normalized);
    setBorrowedOpen(true);

    if (import.meta.env.DEV) {
      console.log("Borrowed inventory:", json);
    }
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("Borrowed inventory load error:", err);
    }

    setBorrowedRows([]);
    setBorrowedError(
      T(
        "Gagal memuat data peminjaman inventaris.",
        "Failed to load borrowed inventory data."
      ) + (err?.message ? ` (${err.message})` : "")
    );
    setBorrowedOpen(true);
  } finally {
    setInventoryLoading(false);
  }
};


  // ========= IMAGE UPLOAD HELPERS =========
  
  const uploadImageForItem = (file: File, item: InventoryItem) => {
    if (!file || !item.ID) return;
  
    if (!effectiveKey) {
      setUploadImageMessage(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }
  
    const reader = new FileReader();
    setUploadingImage(true);
    setUploadImageMessage(null);
  
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || "");
  
        const params = new URLSearchParams();
        params.append("mode", "inventoryUploadImage");
        params.append("token", effectiveKey);
        params.append("ID", String(item.ID));
        params.append("imageBase64", base64);
        params.append("contentType", file.type || "image/png");
  
        const res = await fetch(BOOKING_ENDPOINT, {
          method: "POST",
          body: params,
        });
  
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
        const json = await res.json();
  
        const folderLabel = String(json.fotoFolder || json["Foto Folder"] || "");
  
        if (json.status === "ok" && json.imageUrl) {
          const url = String(json.imageUrl);
  
          setInventoryItems((prev) =>
            prev.map((it) =>
              String(it.ID) === String(item.ID)
                ? {
                    ...it,
                    ImageURL: url,
                    "Link Foto": url,
                    ...(folderLabel ? { "Foto Folder": folderLabel } : {}),
                  }
                : it
            )
          );
  
          setEditingItem((prev) =>
            prev && String(prev.ID) === String(item.ID)
              ? {
                  ...prev,
                  ImageURL: url,
                  "Link Foto": url,
                  ...(folderLabel ? { "Foto Folder": folderLabel } : {}),
                }
              : prev
          );
  
          setUploadImageMessage(T("Foto berhasil diunggah.", "Photo uploaded successfully."));
        } else {
          setUploadImageMessage(json.message || T("Gagal mengunggah foto.", "Failed to upload photo."));
        }
      } catch (err: any) {
        console.error("Image upload error", err);
        setUploadImageMessage(
          T("Gagal mengunggah foto.", "Failed to upload photo.") + (err?.message ? ` (${err.message})` : "")
        );
      } finally {
        setUploadingImage(false);
      }
    };
  
    reader.onerror = () => {
      setUploadingImage(false);
      setUploadImageMessage(T("Tidak dapat membaca file gambar.", "Unable to read image file."));
    };
  
    reader.readAsDataURL(file);
  };
  
  const handleEditImageSelected = (file: File | null) => {
    if (!editingItem || !file) return;
    uploadImageForItem(file, editingItem);
  };
  
  const handleSaveInventory = async () => {
    if (!editingItem) return;
  
    if (!effectiveKey) {
      setInventorySaveMessage(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }
  
    const id = editingItem.ID;
    if (id === undefined || id === null || id === "") {
      setInventorySaveMessage(
        T(
          "ID inventaris tidak ditemukan. Mohon cek kolom ID di Google Sheet.",
          "Inventory ID not found. Please check the ID column in the Google Sheet."
        )
      );
      return;
    }
  
    setInventorySaving(true);
    setInventorySaveMessage(null);
  
    try {
      const params = new URLSearchParams();
      params.append("mode", "inventoryUpdate");
      params.append("token", effectiveKey);
      params.append("ID", String(id));
  
      const lokasi = editingItem["Lokasi Penyimpanan"];
      const jumlahTotal = editingItem["Jumlah Total"];
      const minStok = editingItem["Min Stok"];
      const kondisi = editingItem.Kondisi;
      const terakhirDicek = editingItem["Terakhir Dicek"];
      const dicekOleh = editingItem["Dicek Oleh"];
      const catatan = editingItem.Catatan;
  
      if (lokasi !== undefined) params.append("lokasiPenyimpanan", String(lokasi));
      if (jumlahTotal !== undefined) params.append("jumlahTotal", String(jumlahTotal));
      if (minStok !== undefined) params.append("minStok", String(minStok));
      if (kondisi !== undefined) params.append("kondisi", String(kondisi));
      if (terakhirDicek !== undefined) params.append("terakhirDicek", String(terakhirDicek));
      if (dicekOleh !== undefined) params.append("dicekOleh", String(dicekOleh));
      if (catatan !== undefined) params.append("catatan", String(catatan));
  
      const res = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        body: params,
      });
  
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
      const json = await res.json();
      if (json.status === "unauthorized") {
        setInventorySaveMessage(
          T("Kode admin salah atau tidak diizinkan untuk mengubah inventaris.", "Admin key is incorrect or not allowed to update inventory.")
        );
        return;
      }
  
      if (json.status === "ok") {
        setInventoryItems((prev) => prev.map((it) => (String(it.ID) === String(id) ? editingItem : it)));
        setInventorySaveMessage(T("Data inventaris berhasil disimpan.", "Inventory data saved successfully."));
        return;
      }
  
      setInventorySaveMessage(T("Respon tidak terduga dari server.", "Unexpected response from server."));
    } catch (err: any) {
      console.error("Inventory save error:", err);
      setInventorySaveMessage(
        T("Gagal menyimpan data inventaris.", "Failed to save inventory data.") + (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setInventorySaving(false);
    }
  };
  
  // helper to update "new item" fields
  const updateNewItemField = (field: keyof InventoryItem, value: any) => {
    setNewItem((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  
  // reset new item form
  const resetNewItem = () => {
    setNewItem({
      "Nama Alat": "",
      "Lab Utama": "",
      Kategori: "",
      "Lokasi Penyimpanan": "",
      "Jumlah Total": "",
      "Min Stok": "",
      Kondisi: "",
      "Terakhir Dicek": "",
      "Dicek Oleh": "",
      Catatan: "",
    });
    setNewItemMessage(null);
    setNewItemImageFile(null);
  };
  
  // create / input new inventory item (with optional photo)
  const handleCreateInventory = async () => {
    if (!effectiveKey) {
      setNewItemMessage(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }
  
    if (!newItem["Nama Alat"] || !newItem["Lab Utama"]) {
      setNewItemMessage(T("Nama alat dan Lab Utama wajib diisi.", "Tool name and Main Lab are required."));
      return;
    }
  
    setNewItemSaving(true);
    setNewItemMessage(null);
  
    try {
      const params = new URLSearchParams();
      params.append("mode", "inventoryCreate");
      params.append("token", effectiveKey);
  
      // ✅ IMPORTANT: Do NOT generate or send KODE from frontend.
      // Backend will generate KODE as LABx-P-### based on labUtama + kategori.
  
      if (newItem["Nama Alat"]) params.append("namaAlat", String(newItem["Nama Alat"]));
      if (newItem["Lab Utama"]) params.append("labUtama", String(newItem["Lab Utama"]));
      if (newItem.Kategori) params.append("kategori", String(newItem.Kategori));
      if (newItem["Lokasi Penyimpanan"]) params.append("lokasiPenyimpanan", String(newItem["Lokasi Penyimpanan"]));
      if (newItem["Jumlah Total"] !== undefined) params.append("jumlahTotal", String(newItem["Jumlah Total"]));
      if (newItem["Min Stok"] !== undefined) params.append("minStok", String(newItem["Min Stok"]));
      if (newItem.Kondisi) params.append("kondisi", String(newItem.Kondisi));
      if (newItem["Terakhir Dicek"]) params.append("terakhirDicek", String(newItem["Terakhir Dicek"]));
      if (newItem["Dicek Oleh"]) params.append("dicekOleh", String(newItem["Dicek Oleh"]));
      if (newItem.Catatan) params.append("catatan", String(newItem.Catatan));
  
      const res = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        body: params,
      });
  
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
      const json = await res.json();
      if (json.status === "unauthorized") {
        setNewItemMessage(
          T("Kode admin salah atau tidak diizinkan untuk menambah inventaris.", "Admin key is incorrect or not allowed to add inventory.")
        );
        return;
      }
  
      if (json.status === "ok") {
        const createdId = json.assignedId || json.newId || "";
  
        if (newItemImageFile && createdId) {
          uploadImageForItem(newItemImageFile, { ID: createdId } as InventoryItem);
        }
  
        await fetchInventory();
        resetNewItem();
        setNewItemMessage(T("Item baru berhasil ditambahkan ke inventaris.", "New item has been added to inventory."));
        return;
      }
  
      setNewItemMessage(T("Respon tidak terduga dari server saat menambah item.", "Unexpected response from server when adding item."));
    } catch (err: any) {
      console.error("Inventory add error:", err);
      setNewItemMessage(
        T("Gagal menambah item inventaris.", "Failed to add inventory item.") + (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setNewItemSaving(false);
    }
  };
  
  // Auto-load inventory when Inventory tab is active
  useEffect(() => {
    if (activeTab === "inventory" && isAuthenticated) {
      fetchInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated]);

  /* ========= NEW INVENTORY PRINT HELPERS ========= */

  const getInventoryForPrint = () => {
    const selected = inventoryPrintLabRef.current || inventoryPrintLab;

    return inventoryItems.filter((item) => {
      if (selected === "ALL") return true;

      const labRaw = String(item["Lab Utama"] || "")
        .trim()
        .toUpperCase();
      const kodeRaw = String(item.Kode || "")
        .trim()
        .toUpperCase();

      const isLab1 =
        labRaw === "SD1_SMP" ||
        labRaw.includes("SD1") ||
        labRaw.includes("SD 1") ||
        labRaw.includes("SMP") ||
        labRaw.includes("LAB1") ||
        labRaw.includes("LAB 1") ||
        labRaw.includes("LAB SD1") ||
        kodeRaw.startsWith("LAB1-");

      const isLab2 =
        labRaw === "SD2" ||
        labRaw.includes("SD2") ||
        labRaw.includes("SD 2") ||
        labRaw.includes("LAB2") ||
        labRaw.includes("LAB 2") ||
        labRaw.includes("LAB SD2") ||
        kodeRaw.startsWith("LAB2-");

      if (selected === "LAB1") return isLab1;
      if (selected === "LAB2") return isLab2;

      return true;
    });
  };

  const printInventoryTable = () => {
    const data = getInventoryForPrint();
    if (!data.length) {
      alert("Tidak ada data inventaris untuk dicetak (cek Filter Cetak di kanan atas).");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Tabel Inventaris Lab IPA</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; }
            h1 { font-size: 14px; margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
            th { background: #f0fdf4; text-align: left; }
          </style>
        </head>
        <body>
          <div style="padding: 10px;">
            <h1>Tabel Inventaris Lab IPA</h1>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Kode</th>
                  <th>Nama Alat</th>
                  <th>Lab</th>
                  <th>Kategori</th>
                  <th>Lokasi</th>
                  <th>Qty</th>
                  <th>Min</th>
                  <th>Kondisi</th>
                </tr>
              </thead>
              <tbody>
                ${data
                  .map((it) => {
                    const id = escapeHtml(it.ID ?? "");
                    const kode = escapeHtml(it.Kode ?? "");
                    const nama = escapeHtml(it["Nama Alat"] ?? "");
                    const lab = escapeHtml(it["Lab Utama"] ?? "");
                    const kat = escapeHtml(it.Kategori ?? "");
                    const lok = escapeHtml(it["Lokasi Penyimpanan"] ?? "");
                    const qty = escapeHtml(it["Jumlah Total"] ?? "");
                    const min = escapeHtml(it["Min Stok"] ?? "");
                    const kondisi = escapeHtml(it.Kondisi ?? "");
                    return `
                      <tr>
                        <td>${id}</td>
                        <td>${kode}</td>
                        <td>${nama}</td>
                        <td>${lab}</td>
                        <td>${kat}</td>
                        <td>${lok}</td>
                        <td style="text-align:right">${qty}</td>
                        <td style="text-align:right">${min}</td>
                        <td>${kondisi}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
            <script>
              window.onload = function(){ window.print(); };
            </script>
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const printInventoryLabels = async () => {
    const data = getInventoryForPrint();
    if (!data.length) {
      alert("Tidak ada data inventaris untuk dicetak sebagai label (cek Filter Cetak di kanan atas).");
      return;
    }

    const labelWidth = "50%"; // 2 columns
    const labelHeight = labelPreset === "A4_2x4" ? "25%" : "20%"; // 4 rows vs 5 rows

    // ✅ Vite-safe base path (works if deployed under /labipa/ or any subfolder)
    const base = (import.meta as any)?.env?.BASE_URL || "/";
    const logoAbsUrl = new URL(`${base}logo-alkhairiyah.png`, window.location.origin).toString();

    // ✅ Convert logo to embedded data URL so popup print never breaks
    const toDataUrl = async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      });
    };

    let logoDataUrl = "";
    try {
      logoDataUrl = await toDataUrl(logoAbsUrl);
    } catch (e) {
      // Fallback: still try absolute URL (better than blank)
      console.warn("Logo embed failed, falling back to URL:", e);
      logoDataUrl = logoAbsUrl;
    }

    const html = `
      <html>
        <head>
          <title>Label Inventaris Lab IPA</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 0; margin: 0; }
            .grid { display: flex; flex-wrap: wrap; }
            .label {
              box-sizing: border-box;
              width: ${labelWidth};
              height: ${labelHeight};
              padding: 8px;
              border: 1px solid #444;
              display: flex;
              gap: 8px;
              align-items: flex-start;
              overflow: hidden;
            }
            .info { flex: 1; min-width: 0; }
            .title { font-weight: 700; font-size: 12px; margin-bottom: 4px; line-height: 1.2; word-break: break-word; }
            .small { font-size: 10px; line-height: 1.25; margin-bottom: 2px; word-break: break-word; }
            .tag { display: inline-block; font-size: 10px; padding: 2px 6px; border: 1px solid #999; border-radius: 999px; margin-left: 6px; }
            .brand { width: 52px; flex: 0 0 52px; display: flex; align-items: flex-start; justify-content: flex-end; }
            .brand img { width: 48px; height: 48px; object-fit: contain; display: block; }
          </style>
        </head>
        <body>
          <div class="grid">
            ${data
              .map((item) => {
                // ✅ USE isBundledItem so it is not unused anymore
                const bundled = isBundledItem(item);

                const nama = escapeHtml(item["Nama Alat"] ?? "-");
                const kode = escapeHtml(item.Kode ?? "-");
                const lab = escapeHtml(item["Lab Utama"] ?? "-");
                const lokasi = escapeHtml(item["Lokasi Penyimpanan"] ?? "-");

                return `
                  <div class="label">
                    <div class="info">
                      <div class="title">
                        ${nama}
                        ${bundled ? `<span class="tag">SET</span>` : ``}
                      </div>
                      <div class="small">Kode: ${kode}</div>
                      <div class="small">Lab: ${lab}</div>
                      <div class="small">Lokasi: ${lokasi}</div>
                    </div>
                    <div class="brand">
                      <img src="${logoDataUrl}" alt="Alkhairiyah" />
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>

          <script>
            (function () {
              function doPrint() { try { window.focus(); } catch(e) {} window.print(); }
              window.onload = function () {
                const imgs = Array.from(document.images || []);
                if (imgs.length === 0) return doPrint();
                let done = 0;
                const finishOne = () => { done++; if (done >= imgs.length) doPrint(); };
                imgs.forEach(img => {
                  if (img.complete) finishOne();
                  else { img.onload = finishOne; img.onerror = finishOne; }
                });
                setTimeout(doPrint, 1500);
              };
            })();
          </script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  /* ========= BOOKING STATUS ACTIONS (NEW) ========= */

  const postAdminAction = async (params: URLSearchParams) => {
    const res = await fetch(BOOKING_ENDPOINT, { method: "POST", body: params });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };


  // ====== PHASE A: Borrow/Return API helper (Apps Script-friendly) ======
  const postForm = async (mode: string, fields: Record<string, any>) => {
    if (!effectiveKey) {
      throw new Error("Admin session is not active (missing adminKey).");
    }
  
    const params = new URLSearchParams();
    params.append("mode", mode);
    params.append("token", effectiveKey);
  
    Object.entries(fields || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      params.append(k, String(v));
    });
  
    const res = await fetch(BOOKING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params,
    });
  
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const openBorrowModal = (item: InventoryItem, booking?: AdminBooking | null) => {
    setBorrowItem(item);
    setBorrowQty(1);

    // Auto-fill if coming from booking
    if (booking) {
      setInvFromBooking(booking);

      // “Guru/Kelas” gets teacher + unitClass
      const teacher = String(booking.teacher || "").trim();
      const unitClass = String(booking.unitClass || "").trim();
      const autoGuruKelas = [teacher, unitClass].filter(Boolean).join(" — ");
      if (autoGuruKelas) setBorrowGuruKelas(autoGuruKelas);

      // Destination: set default “Ke” (optional)
      // You can change this wording anytime.
      setBorrowKe("Untuk kegiatan praktikum (booking)");

      // Catatan: include activity
      const act = String(booking.activity || "").trim();
      if (act) setBorrowCatatan(`Booking: ${act}`);
    } else {
      setInvFromBooking(null);
      setBorrowKe("");
      setBorrowGuruKelas("");
      setBorrowCatatan("");
    }

    setBorrowError(null);
    setBorrowSuccessRefId(null);
    setBorrowOpen(true);
  };

  const submitBorrow = async () => {
    if (!borrowItem) return;

    const kodeAlat = String(borrowItem.Kode || "").trim();
    const namaAlat = String(borrowItem["Nama Alat"] || "").trim();
    const jumlah = Number(borrowQty);

    if (!kodeAlat || !namaAlat) {
      setBorrowError(T("Data item tidak lengkap (Kode/Nama).", "Item data is incomplete (Code/Name)."));
      return;
    }
    if (!jumlah || jumlah <= 0) {
      setBorrowError(T("Jumlah harus lebih dari 0.", "Qty must be greater than 0."));
      return;
    }

    setBorrowLoading(true);
    setBorrowError(null);

    try {
      const dariParts = [borrowItem["Lab Utama"], borrowItem["Lokasi Penyimpanan"]].map((x) => String(x || "").trim()).filter(Boolean);
      const dari = dariParts.join(" - ");

      const json = await postForm(MODE_INVENTORY_BORROW, {
        kodeAlat,
        namaAlat,
        jumlah,
        dari,
        ke: borrowKe,
        guruKelas: borrowGuruKelas,
        dicatatOleh: borrowDicatatOleh,
        catatan: borrowCatatan,


        // NEW: booking reference (backend can ignore if not implemented)
        bookingId: invFromBooking?.bookingId || "",
        bookingRowIndex: invFromBooking?.rowIndex ?? "",
        bookingLab: invFromBooking?.lab || "",
        bookingDate: invFromBooking?.date || "",
        bookingTime: `${invFromBooking?.startTime || ""}-${invFromBooking?.endTime || ""}`,
      });

      if (json.status === "ok" && json.refId) {
        setBorrowSuccessRefId(String(json.refId));
        setBorrowOpen(false);
      
        // ✅ Auto refresh inventory after borrow
        await fetchInventory();
      
        return;
      }

      setBorrowError(json.message || T("Respon tidak terduga dari server.", "Unexpected response from server."));
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("Borrow error:", err);
      }
      setBorrowError(T("Gagal meminjam item.", "Failed to borrow item.") + (err?.message ? ` (${err.message})` : ""));
    } finally {
      setBorrowLoading(false);
    }
  };

  const openReturnModal = (prefillRefId?: string) => {
    setReturnRefId(String(prefillRefId || "").trim());
    setReturnQty(1);
    setReturnCatatan("");
    setReturnError(null);
    setReturnSuccessRefId(null);
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    const refId = String(returnRefId || "").trim();
    const jumlah = Number(returnQty);
  
    if (!refId) {
      setReturnError(T("RefId wajib diisi.", "RefId is required."));
      return;
    }
    if (!jumlah || jumlah <= 0) {
      setReturnError(T("Jumlah harus lebih dari 0.", "Qty must be greater than 0."));
      return;
    }
  
    setReturnLoading(true);
    setReturnError(null);
  
    try {
      const json = await postForm(MODE_INVENTORY_RETURN, {
        refId,
        jumlah,
        dicatatOleh: returnDicatatOleh,
        catatan: returnCatatan,
      });
  
      if (json.status === "ok" && (json.refId || refId)) {
        setReturnSuccessRefId(String(json.refId || refId));
        setReturnOpen(false);
  
        // ✅ Auto refresh inventory after return
        await fetchInventory();
  
        return;
      }
  
      setReturnError(json.message || T("Respon tidak terduga dari server.", "Unexpected response from server."));
    } catch (err: any) {
      console.error("Return error:", err);
      setReturnError(T("Gagal mengembalikan item.", "Failed to return item.") + (err?.message ? ` (${err.message})` : ""));
    } finally {
      setReturnLoading(false);
    }
  };

  const setBookingStatus = async (b: AdminBooking, nextStatus: BookingStatus) => {
    if (!effectiveKey) {
      setBookingActionMessage(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }

    // bookingId is strongly preferred; fallback to rowIndex if backend uses row reference
    const bookingId = b.bookingId;
    const rowIndex = b.rowIndex;

    setBookingActionLoadingId(bookingId || String(rowIndex));
    setBookingActionMessage(null);

    try {
      const params = new URLSearchParams();
      params.append("mode", MODE_ADMIN_SET_BOOKING_STATUS);
      params.append("token", effectiveKey);
      params.append("status", nextStatus);

      if (bookingId) params.append("bookingId", bookingId);
      params.append("rowIndex", String(rowIndex)); // harmless if backend ignores
      if (b.calendarEventId) params.append("calendarEventId", b.calendarEventId);

      const json = await postAdminAction(params);

      if (json.status === "unauthorized" || json.success === false) {
        setBookingActionMessage(
          json.message ||
            T(
              "Kode admin salah atau tidak diizinkan untuk mengubah status booking.",
              "Admin key is incorrect or not allowed to update booking status."
            )
        );
        return;
      }

      if (json.status === "ok" || json.success === true) {
        // Update local state (optimistic + safe)
        setBookings((prev) => prev.map((x) => (x.rowIndex === b.rowIndex ? { ...x, status: nextStatus } : x)));
        setBookingActionMessage(T("Status booking berhasil diperbarui.", "Booking status updated successfully."));
        return;
      }

      setBookingActionMessage(json.message || T("Respon tidak terduga dari server.", "Unexpected response from server."));
    } catch (err: any) {
      console.error("Set booking status error:", err);
      setBookingActionMessage(
        T("Gagal mengubah status booking.", "Failed to update booking status.") + (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setBookingActionLoadingId(null);
    }
  };

  const cancelBooking = async (b: AdminBooking) => {
    if (!effectiveKey) {
      setBookingActionMessage(T("Sesi admin belum aktif. Silakan login ulang.", "Admin session is not active. Please log in again."));
      return;
    }

    const ok = window.confirm(
      T(
        "Yakin ingin membatalkan booking ini? Data booking tidak akan dihapus, hanya status menjadi CANCELLED.",
        "Are you sure you want to cancel this booking? It won't be deleted; status will become CANCELLED."
      )
    );
    if (!ok) return;

    const bookingId = b.bookingId;
    const rowIndex = b.rowIndex;

    setBookingActionLoadingId(bookingId || String(rowIndex));
    setBookingActionMessage(null);

    try {
      const cancelReason =
        window.prompt(
          T("Alasan cancel (opsional):", "Cancel reason (optional):")
        ) || "";

      const params = new URLSearchParams();
      params.append("mode", MODE_ADMIN_CANCEL_BOOKING);
      params.append("token", effectiveKey);

      if (bookingId) params.append("bookingId", bookingId);
      params.append("rowIndex", String(rowIndex));
      if (b.calendarEventId) params.append("calendarEventId", b.calendarEventId);

      if (cancelReason.trim()) {
        params.append("reason", cancelReason.trim());
        params.append("cancelReason", cancelReason.trim());
      }

      // backend should:
      // - set status=CANCELLED
      // - keep row
      // - prefix calendar title with [CANCELLED]
      const json = await postAdminAction(params);

      if (json.status === "unauthorized" || json.success === false) {
        setBookingActionMessage(
          json.message ||
            T("Kode admin salah atau tidak diizinkan untuk membatalkan booking.", "Admin key is incorrect or not allowed to cancel booking.")
        );
        return;
      }

      if (json.status === "ok" || json.success === true) {
        setBookings((prev) => prev.map((x) => (x.rowIndex === b.rowIndex ? { ...x, status: "CANCELLED" } : x)));
        setBookingActionMessage(T("Booking dibatalkan.", "Booking cancelled."));
        return;
      }

      setBookingActionMessage(json.message || T("Respon tidak terduga dari server.", "Unexpected response from server."));
    } catch (err: any) {
      console.error("Cancel booking error:", err);
      setBookingActionMessage(
        T("Gagal membatalkan booking.", "Failed to cancel booking.") + (err?.message ? ` (${err.message})` : "")
      );
    } finally {
      setBookingActionLoadingId(null);
    }
  };

  /* ========= RENDER BLOCKS ========= */

const renderLogBook = () => {
  const toStatus = (raw: any): BookingStatus => {
    const s = String(raw || "CONFIRMED").toUpperCase();
    if (s === "CANCELLED" || s === "NO_SHOW" || s === "RESCHEDULED" || s === "CONFIRMED") {
      return s as BookingStatus;
    }
    return "CONFIRMED";
  };

  // Filter by selected lab
  const bookingsByLab = bookings.filter((b) => {
    const labUpper = String(b.lab || "").toUpperCase();
    return labUpper === String(logLabFilter).toUpperCase();
  });

  // Apply SD1/SMP filter ONLY for LAB_SD1_SMP
  const byUnit = bookingsByLab.filter((b) => {
    if (logLabFilter === "LAB_SD1_SMP") {
      const unitUpper = String(b.unitClass || "").toUpperCase();
      if (unitFilter === "SD1") return unitUpper.startsWith("SD");
      if (unitFilter === "SMP") return unitUpper.startsWith("SMP");
      return true;
    }
    return true;
  });

  // Status filter
  const filteredBookings = byUnit.filter((b) => {
    if (statusFilter === "ALL") return true;
    return toStatus(b.status) === statusFilter;
  });

  return (
    <main className="space-y-6 sm:space-y-8 pb-10">
      {/* Top explanation + filters */}
      <section className="bg-teal-900/60 rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl shadow-emerald-900/40 backdrop-blur-md print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">
              {T("Panel Admin – Log Penggunaan Lab", "Admin Panel – Lab Usage Log")}
            </h1>
            <p className="text-[11px] sm:text-xs text-emerald-100/90 max-w-xl">
              {T(
                "Gunakan halaman ini untuk melihat ringkasan booking dan mencetak log-book resmi untuk akreditasi atau laporan.",
                "Use this tab to view booking summaries and print an official log book for accreditation or reports."
              )}
            </p>
            <p className="mt-1 text-[11px] text-emerald-100/80">
              {T("Anda sedang melihat data untuk:", "You are currently viewing data for:")}{" "}
              <span className="font-semibold">{labLabel(logLabFilter)}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="self-start sm:self-auto px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow-md shadow-emerald-900/40 hover:bg-emerald-200"
            >
              {T("Cetak / PDF Log-Book", "Print / PDF Log Book")}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[11px] text-emerald-100/90 underline underline-offset-2 hover:text-white"
            >
              {T("Keluar dari sesi admin", "Log out from admin session")}
            </button>
          </div>
        </div>

        {/* Date filter + load button */}
        <div className="grid md:grid-cols-[1.05fr,1.2fr] gap-4 text-xs">
          <div className="bg-teal-950/50 rounded-2xl border border-white/15 p-4">
            <p className="font-semibold mb-2">{T("Status Sesi Admin", "Admin Session Status")}</p>
            <p className="text-[11px] text-emerald-100/90 mb-1">
              {T(
                "Sesi admin aktif. Hanya Anda yang memiliki kode admin yang dapat melihat dan mencetak data log-book ini.",
                "Admin session is active. Only those with the admin code can see and print this log book data."
              )}
            </p>
            <p className="text-[11px] text-emerald-100/80">
              {T(
                "Jika kode admin berubah, silakan logout lalu login kembali dengan kode terbaru.",
                "If the admin code changes, please log out and log in again with the new code."
              )}
            </p>

            {bookingActionMessage ? (
              <p className="mt-3 text-[11px] text-emerald-100">{bookingActionMessage}</p>
            ) : null}
          </div>

          <div className="bg-teal-950/50 rounded-2xl border border-white/15 p-4">
            <p className="font-semibold mb-2">{T("Filter Tanggal", "Date Filter")}</p>
            <p className="text-[11px] text-emerald-100/90 mb-3">
              {T(
                "Opsional: batasi data berdasarkan rentang tanggal (yyyy-mm-dd). Kosongkan untuk melihat semua data.",
                "Optional: limit the data by date range (yyyy-mm-dd). Leave empty to see all data."
              )}
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] text-emerald-100/90 mb-1">
                  {T("Dari Tanggal", "From Date")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-emerald-200/70 rounded-2xl px-3 py-2 text-xs text-teal-900 bg-emerald-50/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-emerald-100/90 mb-1">
                  {T("Sampai Tanggal", "To Date")}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-emerald-200/70 rounded-2xl px-3 py-2 text-xs text-teal-900 bg-emerald-50/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleLoadBookings}
                disabled={isLoading}
                className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow-md shadow-emerald-900/40 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? T("Memuat…", "Loading…") : T("Muat Data Booking", "Load Booking Data")}
              </button>

              <span className="text-[11px] text-emerald-100/80">
                {T("Direkomendasikan memuat per bulan / per semester.", "Recommended to load per month / per semester.")}
              </span>
            </div>

            {loadError ? (
              <p className="mt-3 text-[11px] text-rose-200">
                {T("Terjadi kesalahan:", "An error occurred:")} {loadError}
              </p>
            ) : null}
          </div>
        </div>

        {/* Lab filter + unit filter + status filter */}
        <div className="mt-4 flex flex-wrap gap-3 items-center print:hidden">
          <label className="text-[11px] text-emerald-100/90">{T("Pilih Lab:", "Choose Lab:")}</label>
          <select
            value={logLabFilter}
            onChange={(e) => setLogLabFilter(e.target.value as LabLogFilter)}
            className="px-3 py-1 rounded-xl bg-emerald-50/70 text-[11px] text-teal-900 border border-emerald-200"
          >
            <option value="LAB_SD1_SMP">Lab SD1 & SMP</option>
            <option value="LAB_SD2">Lab SD 2</option>
          </select>

          <span className="text-[11px] text-emerald-100/90">{T("Status:", "Status:")}</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-1 rounded-xl bg-emerald-50/70 text-[11px] text-teal-900 border border-emerald-200"
          >
            <option value="ALL">{T("Semua", "All")}</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="NO_SHOW">NO_SHOW</option>
            <option value="RESCHEDULED">RESCHEDULED</option>
          </select>

          {logLabFilter === "LAB_SD1_SMP" && bookingsByLab.length > 0 ? (
            <>
              <span className="text-[11px] text-emerald-100/90">{T("Filter Unit:", "Unit Filter:")}</span>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value as UnitFilter)}
                className="px-3 py-1 rounded-xl bg-emerald-50/70 text-[11px] text-teal-900 border border-emerald-200"
              >
                <option value="ALL">{T("SD 1 & SMP (Semua)", "SD 1 & JHS (All)")}</option>
                <option value="SD1">{T("Hanya SD 1", "SD 1 only")}</option>
                <option value="SMP">{T("Hanya SMP", "JHS only")}</option>
              </select>
              <span className="text-[10px] text-emerald-100/80">
                {T("Gunakan untuk akreditasi: pisahkan bukti SD 1 dan SMP.", "Use this for accreditation: separate SD 1 and JHS evidence.")}
              </span>
            </>
          ) : null}
        </div>
      </section>

      {/* Log-book table */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-emerald-100 shadow-xl shadow-emerald-900/20 text-teal-900">
        <div className="mb-4 print:mb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-semibold">
                {T("Log-Book Penggunaan Laboratorium IPA", "Science Lab Usage Log Book")}
              </h2>
              <p className="text-[11px] text-slate-500">
                {T("Data di bawah ini diambil dari sistem booking Lab IPA.", "The data below is taken from the Lab IPA booking system.")}
              </p>
            </div>
            <div className="hidden print:block text-right text-[10px] text-slate-500">
              <div>Lab IPA Alkhairiyah Surabaya</div>
              <div>{new Date().toLocaleString("id-ID")}</div>
            </div>
          </div>
        </div>

        {isLoading ? <p className="text-[11px] text-slate-500 mb-2">{T("Memuat data booking…", "Loading booking data…")}</p> : null}

        {!isLoading && bookings.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            {T(
              "Belum ada data booking yang ditampilkan. Klik 'Muat Data Booking' setelah memilih rentang tanggal.",
              "No booking data shown yet. Click 'Load Booking Data' after selecting a date range."
            )}
          </p>
        ) : null}

        {bookingsByLab.length > 0 && filteredBookings.length === 0 ? (
          <p className="text-[11px] text-slate-500 mb-2">
            {T("Tidak ada data yang cocok dengan filter yang dipilih.", "No data matches the selected filters.")}
          </p>
        ) : null}

        {filteredBookings.length > 0 ? (
          <div className="overflow-auto max-h-[60vh] print:max-h-none print:overflow-visible mt-2">
            <table className="w-full text-[11px] border-collapse print:text-[10px]">
              <thead>
                <tr className="bg-emerald-50">
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">No.</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Lab", "Lab")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Tanggal", "Date")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Jam", "Time")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Guru / PIC", "Teacher / PIC")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Unit & Kelas", "Unit & Class")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Kegiatan / Topik", "Activity / Topic")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Alat", "Tools")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Bahan", "Materials")}</th>

                  <th className="border border-emerald-100 px-1.5 py-1 text-left print:hidden">{T("Status", "Status")}</th>
                  <th className="border border-emerald-100 px-1.5 py-1 text-left print:hidden">{T("Aksi", "Actions")}</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((b, idx) => {
                  const idKey = b.bookingId ? String(b.bookingId) : String(b.rowIndex);
                  const loading = bookingActionLoadingId === idKey;
                  const st = toStatus(b.status);

                  return (
                    <tr key={b.rowIndex} className="align-top">
                      <td className="border border-emerald-100 px-1.5 py-1 text-right">{idx + 1}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{String(b.lab || "").toUpperCase()}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{formatLogDate(b.date)}</td>
                      <td className="border border-emerald-100 px-1.5 py-1 whitespace-nowrap">
                        {formatLogTime(b.startTime)}–{formatLogTime(b.endTime)}
                      </td>
                      <td className="border border-emerald-100 px-1.5 py-1">{b.teacher}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{b.unitClass}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{b.activity}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{b.tools}</td>
                      <td className="border border-emerald-100 px-1.5 py-1">{b.materials}</td>

                      <td className="border border-emerald-100 px-1.5 py-1 print:hidden">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(st)}`}>
                          {statusBadgeLabel(st)}
                        </span>
                      </td>

                      <td className="border border-emerald-100 px-1.5 py-1 print:hidden">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={loading || st === "CANCELLED"}
                            onClick={() => cancelBooking(b)}
                            className="px-2 py-1 rounded-full bg-rose-200 text-rose-900 text-[10px] font-semibold hover:bg-rose-100 disabled:opacity-60"
                            title={T("Batalkan booking (tidak menghapus data).", "Cancel booking (does not delete data).")}
                          >
                            {loading ? "…" : T("Cancel", "Cancel")}
                          </button>

                          <button
                            type="button"
                            disabled={loading || st === "NO_SHOW" || st === "CANCELLED"}
                            onClick={() => setBookingStatus(b, "NO_SHOW")}
                            className="px-2 py-1 rounded-full bg-yellow-200 text-yellow-900 text-[10px] font-semibold hover:bg-yellow-100 disabled:opacity-60"
                          >
                            {loading ? "…" : "No-show"}
                          </button>

                          <button
                            type="button"
                            disabled={loading || st === "RESCHEDULED"}
                            onClick={() => setBookingStatus(b, "RESCHEDULED")}
                            className="px-2 py-1 rounded-full bg-sky-200 text-sky-900 text-[10px] font-semibold hover:bg-sky-100 disabled:opacity-60"
                            title={T(
                              "Gunakan jika booking dipindah. (Backend tetap harus mengatur jadwal baru.)",
                              "Use if booking was moved. (Backend still must handle the new schedule.)"
                            )}
                          >
                            {loading ? "…" : "Resch."}
                          </button>

                          <button
                            type="button"
                            disabled={loading || st === "CONFIRMED"}
                            onClick={() => setBookingStatus(b, "CONFIRMED")}
                            className="px-2 py-1 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-semibold hover:bg-emerald-100 disabled:opacity-60"
                            title={T("Kembalikan menjadi CONFIRMED.", "Set back to CONFIRMED.")}
                          >
                            {loading ? "…" : "Confirm"}
                          </button>
                        </div>

                        {b.calendarUrl ? (
                          <div className="mt-1">
                            <a href={b.calendarUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-700 underline">
                              {T("Buka event", "Open event")}
                            </a>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {bookings.length > 0 ? (
          <div className="mt-4 grid sm:grid-cols-2 gap-4 text-[10px] text-slate-500 print:text-[9px]">
            <div>
              <p className="font-semibold mb-1">{T("Catatan:", "Notes:")}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>{T("Data ini dihasilkan otomatis dari sistem booking Lab IPA.", "This data is automatically generated from the Lab IPA booking system.")}</li>
                <li>{T("Jika ada kesalahan penulisan, mohon cek kembali pada Google Sheet sumber.", "If there are any typos, please re-check the source Google Sheet.")}</li>
                <li className="print:hidden">
                  {T(
                    "Status booking tidak menghapus data. CANCELLED akan menandai event kalender (prefix [CANCELLED]) sesuai aturan sistem.",
                    "Status changes do not delete data. CANCELLED should mark the calendar event (prefix [CANCELLED]) per system rules."
                  )}
                </li>
              </ul>
            </div>
            <div className="text-right print:text-left">
              <p className="font-semibold mb-1">{T("Tanda Tangan PJ Lab:", "Signature of Lab PIC:")}</p>
              <p className="mt-6">______________________________</p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
};

  const renderInventory = () => {
    return (
      <main className="space-y-6 sm:space-y-8 pb-10">
        <section className="bg-teal-900/60 rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl shadow-emerald-900/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold mb-1">{T("Admin Inventaris", "Inventory Admin")}</h1>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 max-w-xl">
                {T(
                  "Data diambil dari Spreadsheet InventarisLABIPA (MASTER_DATA). PJ Lab dapat memperbarui lokasi, stok, kondisi, dan catatan alat.",
                  "Data is taken from the InventarisLABIPA spreadsheet (MASTER_DATA). Lab PIC can update location, stock, condition and notes."
                )}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[11px] text-emerald-100/80">{T("Filter Cetak:", "Print Filter:")}</span>
                <select
                  value={inventoryPrintLab}
                  onChange={(e) => {
                    const v = e.target.value as "ALL" | "LAB1" | "LAB2";
                    inventoryPrintLabRef.current = v;
                    setInventoryPrintLab(v);
                  }}
                  className="px-3 py-1 rounded-full bg-emerald-50/80 text-[11px] text-teal-900 border border-emerald-200"
                >
                  <option value="ALL">{T("Semua Lab", "All Labs")}</option>
                  <option value="LAB1">Lab SD1 &amp; SMP</option>
                  <option value="LAB2">Lab SD 2</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={printInventoryTable}
                  className="px-3 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold shadow hover:bg-emerald-100"
                >
                  🖨️ {T("Cetak Tabel Inventaris", "Print Inventory Table")}
                </button>
                <button
                  type="button"
                  onClick={printInventoryLabels}
                  className="px-3 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold shadow hover:bg-emerald-100"
                >
                  🏷️ {T("Cetak Label Inventaris", "Print Inventory Labels")}
                </button>
                <button
                  type="button"
                  onClick={fetchBorrowedInventory}
                  disabled={inventoryLoading}
                  className="px-3 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold shadow hover:bg-emerald-100"
                >
                  📋 {T("Barang Dipinjam", "Borrowed Items")}
                </button>

                {/* PHASE A: Return (paste RefId) */}
                <button
                  type="button"
                  onClick={() => openReturnModal()}
                  className="px-3 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold shadow hover:bg-emerald-100"
                  title={T("Masukkan RefId untuk mengembalikan item.", "Paste RefId to return an item.")}
                >
                  ↩️ {T("Return Item", "Return Item")}
                </button>
              </div>

              <button
                type="button"
                onClick={fetchInventory}
                disabled={inventoryLoading}
                className="self-start sm:self-auto px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow-md shadow-emerald-900/40 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {inventoryLoading ? T("Memuat…", "Loading…") : T("Muat Ulang Inventaris", "Reload Inventory")}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] text-emerald-100/90 underline underline-offset-2 hover:text-white"
              >
                {T("Keluar dari sesi admin", "Log out from admin session")}
              </button>
            </div>
          </div>

          {inventoryError && (
            <p className="mt-3 text-[11px] text-rose-200">
              {T("Terjadi kesalahan:", "An error occurred:")} {inventoryError}
            </p>
          )}
          {inventorySaveMessage && <p className="mt-2 text-[11px] text-emerald-100">{inventorySaveMessage}</p>}
          {newItemMessage && <p className="mt-1 text-[11px] text-emerald-50">{newItemMessage}</p>}
          {uploadImageMessage && <p className="mt-1 text-[11px] text-emerald-50">{uploadImageMessage}</p>}
        </section>

        {/* ===== PHASE 3: Label Options ===== */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] print:hidden">
          <label>{T("Ukuran Label:", "Label Size:")}</label>
          <select value={labelPreset} onChange={(e) => setLabelPreset(e.target.value as any)} className="px-2 py-1 rounded border">
            <option value="A4_2x5">A4 – 2 × 5</option>
            <option value="A4_2x4">A4 – 2 × 4</option>
          </select>
        </div>

        {/* ===== PHASE 2: Needs Attention Panel ===== */}
        {getNeedsAttentionItems().length > 0 && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-teal-900 print:hidden">
            <h3 className="text-sm font-semibold mb-2">⚠️ {T("Perlu Perhatian", "Needs Attention")}</h3>

            <div className="space-y-1 text-xs">
              {getNeedsAttentionItems()
                .slice(0, 10)
                .map((item) => (
                  <div key={String(item.ID)} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border">{item.Kode}</span>
                    <span>{item["Nama Alat"]}</span>

                    {isLowStock(item) && <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">{T("Stok Menipis", "Low Stock")}</span>}

                    {isConditionProblem(item) && <span className="px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900">{T("Kondisi", "Condition")}</span>}

                    {isLongNotChecked(item) && <span className="px-2 py-0.5 rounded-full bg-sky-200 text-sky-900">{T("Belum Dicek Lama", "Not Checked")}</span>}
                  </div>
                ))}
            </div>

            {getNeedsAttentionItems().length > 10 && (
              <p className="mt-2 text-[11px] text-slate-600">{T("Menampilkan 10 item pertama.", "Showing first 10 items.")}</p>
            )}
          </div>
        )}

        {/* ===== PHASE 1: Inventory Filters (UI only) ===== */}
        <div className="mb-4 grid sm:grid-cols-4 gap-3 text-xs print:hidden">
          <input
            type="text"
            placeholder={T("Cari nama / kode / lokasi…", "Search name / code / location…")}
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            className="border rounded-xl px-3 py-2"
          />

          <select value={invFilterLab} onChange={(e) => setInvFilterLab(e.target.value as any)} className="border rounded-xl px-3 py-2">
            <option value="ALL">{T("Semua Lab", "All labs")}</option>
            <option value="LAB1">Lab SD1 & SMP</option>
            <option value="LAB2">Lab SD2</option>
          </select>

          <select
            value={invFilterKategori}
            onChange={(e) => setInvFilterKategori(e.target.value as any)}
            className="border rounded-xl px-3 py-2"
          >
            <option value="ALL">{T("Semua Kategori", "All categories")}</option>
            <option value="Fisika">Fisika</option>
            <option value="Biologi">Biologi</option>
            <option value="Kimia">Kimia</option>
            <option value="Umum">Umum</option>
          </select>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={invLowStockOnly} onChange={(e) => setInvLowStockOnly(e.target.checked)} />
            {T("Low stock saja", "Low stock only")}
          </label>
        </div>

        {/* ====== TABLE INVENTORY ====== */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-emerald-100 shadow-xl shadow-emerald-900/20 text-teal-900">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold">{T("Daftar Inventaris", "Inventory List")}</h2>
            <span className="text-[11px] text-slate-500">{inventoryLoading ? T("Memuat…", "Loading…") : `${inventoryItems.length} item`}</span>
          </div>

          {inventoryLoading && <p className="text-[11px] text-slate-500">{T("Memuat data inventaris…", "Loading inventory data…")}</p>}

          {!inventoryLoading && inventoryItems.length === 0 && (
            <p className="text-[11px] text-slate-500">{T("Belum ada data inventaris yang ditampilkan.", "No inventory data is shown yet.")}</p>
          )}

          {inventoryItems.length > 0 && (
            <div className="overflow-auto max-h-[60vh] mt-2">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-emerald-50">
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">ID</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Kode", "Code")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Nama Alat", "Tool Name")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Lab Utama", "Main Lab")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Kategori", "Category")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Lokasi", "Location")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Jumlah", "Qty")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Min Stok", "Min Stock")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Kondisi", "Condition")}</th>

                    {/* ✅ NEW */}
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Terakhir Dicek", "Last Checked")}</th>

                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Foto", "Photo")}</th>
                    <th className="border border-emerald-100 px-1.5 py-1 text-left">{T("Aksi", "Action")}</th>
                  </tr>
                </thead>

                <tbody>
                  {getFilteredInventoryItems().map((item) => {
                    const low = isLowStock(item);

                    return (
                      <tr key={String(item.ID)} className={`align-top ${low ? "bg-rose-100" : ""}`}>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item.ID ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item.Kode ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item["Nama Alat"] ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item["Lab Utama"] ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item.Kategori ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item["Lokasi Penyimpanan"] ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1 text-right">{String(item["Jumlah Total"] ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1 text-right">{String(item["Min Stok"] ?? "")}</td>
                        <td className="border border-emerald-100 px-1.5 py-1">{String(item.Kondisi ?? "")}</td>

                        {/* ✅ NEW */}
                        <td className="border border-emerald-100 px-1.5 py-1 whitespace-nowrap">{String(item["Terakhir Dicek"] ?? "") || "-"}</td>

                        <td className="border border-emerald-100 px-1.5 py-1">
                          {item.ImageURL ? (
                            <a href={String(item.ImageURL)} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                              {T("Lihat", "View")}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="border border-emerald-100 px-1.5 py-1">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="px-2 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold hover:bg-emerald-100"
                            >
                              {T("Edit", "Edit")}
                            </button>

                            {/* PHASE A: Borrow */}
                            <button
                              type="button"
                              onClick={() => openBorrowModal(item)}
                              className="px-2 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold hover:bg-emerald-100"
                              title={T("Pinjam item ini (akan menghasilkan RefId).", "Borrow this item (will generate a RefId).")}
                            >
                              {T("Borrow", "Borrow")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ====== EDIT PANEL ====== */}
        {editingItem && (
          <section className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-emerald-100 shadow-xl shadow-emerald-900/20 text-teal-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-semibold">{T("Edit Inventaris", "Edit Inventory")}</h2>
              <button type="button" onClick={() => setEditingItem(null)} className="text-[11px] text-slate-500 underline hover:text-slate-700">
                {T("Tutup", "Close")}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
              <div>
                <label className="block text-slate-500 mb-1">{T("ID", "ID")}</label>
                <input value={String(editingItem.ID ?? "")} disabled className="w-full border rounded-2xl px-3 py-2 bg-slate-100 text-slate-500" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Kode", "Code")}</label>
                <input value={String(editingItem.Kode ?? "")} disabled className="w-full border rounded-2xl px-3 py-2 bg-slate-100 text-slate-500" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Nama Alat", "Tool Name")}</label>
                <input
                  value={String(editingItem["Nama Alat"] ?? "")}
                  disabled
                  className="w-full border rounded-2xl px-3 py-2 bg-slate-100 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Lab Utama", "Main Lab")}</label>
                <input
                  value={String(editingItem["Lab Utama"] ?? "")}
                  disabled
                  className="w-full border rounded-2xl px-3 py-2 bg-slate-100 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Kategori", "Category")}</label>
                <input value={String(editingItem.Kategori ?? "")} disabled className="w-full border rounded-2xl px-3 py-2 bg-slate-100 text-slate-500" />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Lokasi Penyimpanan", "Storage Location")}</label>
                <input
                  value={String(editingItem["Lokasi Penyimpanan"] ?? "")}
                  onChange={(e) => updateEditingField("Lokasi Penyimpanan", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Jumlah Total", "Total Qty")}</label>
                <input
                  value={String(editingItem["Jumlah Total"] ?? "")}
                  onChange={(e) => updateEditingField("Jumlah Total", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Min Stok", "Min Stock")}</label>
                <input
                  value={String(editingItem["Min Stok"] ?? "")}
                  onChange={(e) => updateEditingField("Min Stok", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Kondisi", "Condition")}</label>
                <input
                  value={String(editingItem.Kondisi ?? "")}
                  onChange={(e) => updateEditingField("Kondisi", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                />
              </div>

              {/* ✅ Terakhir Dicek + "Hari ini" button (only addition) */}
              <div>
                <label className="block text-slate-500 mb-1">{T("Terakhir Dicek", "Last Checked")}</label>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={String(editingItem["Terakhir Dicek"] ?? "")}
                    onChange={(e) => updateEditingField("Terakhir Dicek", e.target.value)}
                    className="w-full border rounded-2xl px-3 py-2"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const yyyy = today.getFullYear();
                      const mm = String(today.getMonth() + 1).padStart(2, "0");
                      const dd = String(today.getDate()).padStart(2, "0");
                      updateEditingField("Terakhir Dicek", `${yyyy}-${mm}-${dd}`);
                    }}
                    className="px-3 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 whitespace-nowrap"
                    title={T("Set tanggal hari ini", "Set to today")}
                  >
                    {T("Hari ini", "Today")}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">{T("Dicek Oleh", "Checked By")}</label>
                <input
                  value={String(editingItem["Dicek Oleh"] ?? "")}
                  onChange={(e) => updateEditingField("Dicek Oleh", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-slate-500 mb-1">{T("Catatan", "Notes")}</label>
                <textarea
                  value={String(editingItem.Catatan ?? "")}
                  onChange={(e) => updateEditingField("Catatan", e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2 min-h-[80px]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-slate-500 mb-1">{T("Unggah Foto", "Upload Photo")}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleEditImageSelected(e.target.files?.[0] || null)}
                  disabled={uploadingImage}
                  className="w-full"
                />
                {editingItem.ImageURL && (
                  <div className="mt-1 text-[11px]">
                    <a href={String(editingItem.ImageURL)} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                      {T("Lihat Foto Saat Ini", "View Current Photo")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveInventory}
                disabled={inventorySaving}
                className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {inventorySaving ? T("Menyimpan…", "Saving…") : T("Simpan Perubahan", "Save Changes")}
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                {T("Batal", "Cancel")}
              </button>
            </div>
          </section>
        )}

        {/* ====== ADD NEW ITEM FORM ====== */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-emerald-100 shadow-xl shadow-emerald-900/20 text-teal-900">
          <h2 className="text-sm sm:text-base font-semibold mb-3">{T("Input Data Inventaris Baru", "Add New Inventory Item")}</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-slate-500 mb-1">{T("Nama Alat / Bahan", "Tool / Material Name")} *</label>
              <input
                value={String(newItem["Nama Alat"] ?? "")}
                onChange={(e) => updateNewItemField("Nama Alat", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Lab Utama", "Main Lab")} *</label>
              <select
                value={String(newItem["Lab Utama"] ?? "")}
                onChange={(e) => updateNewItemField("Lab Utama", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              >
                <option value="">{T("Pilih Lab", "Select Lab")}</option>
                <option value="SD1_SMP">Lab SD1 & SMP</option>
                <option value="SD2">Lab SD 2</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Kategori", "Category")}</label>
              <select
                value={String(newItem.Kategori ?? "")}
                onChange={(e) => updateNewItemField("Kategori", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              >
                <option value="">{T("Pilih Kategori", "Select Category")}</option>
                <option value="Fisika">Fisika</option>
                <option value="Biologi">Biologi</option>
                <option value="Kimia">Kimia</option>
                <option value="Umum">Umum</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Lokasi Penyimpanan", "Storage Location")}</label>
              <input
                value={String(newItem["Lokasi Penyimpanan"] ?? "")}
                onChange={(e) => updateNewItemField("Lokasi Penyimpanan", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Jumlah Total", "Total Qty")}</label>
              <input
                value={String(newItem["Jumlah Total"] ?? "")}
                onChange={(e) => updateNewItemField("Jumlah Total", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Min Stok", "Min Stock")}</label>
              <input
                value={String(newItem["Min Stok"] ?? "")}
                onChange={(e) => updateNewItemField("Min Stok", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Kondisi", "Condition")}</label>
              <input
                value={String(newItem.Kondisi ?? "")}
                onChange={(e) => updateNewItemField("Kondisi", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Terakhir Dicek", "Last Checked")}</label>
              <input
                type="date"
                value={String(newItem["Terakhir Dicek"] ?? "")}
                onChange={(e) => updateNewItemField("Terakhir Dicek", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">{T("Dicek Oleh", "Checked By")}</label>
              <input
                value={String(newItem["Dicek Oleh"] ?? "")}
                onChange={(e) => updateNewItemField("Dicek Oleh", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-slate-500 mb-1">{T("Catatan", "Notes")}</label>
              <textarea
                value={String(newItem.Catatan ?? "")}
                onChange={(e) => updateNewItemField("Catatan", e.target.value)}
                className="w-full border rounded-2xl px-3 py-2 min-h-[80px]"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-slate-500 mb-1">{T("Unggah Foto (opsional)", "Upload Photo (optional)")}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewItemImageFile(e.target.files?.[0] || null)}
                disabled={uploadingImage}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateInventory}
              disabled={newItemSaving}
              className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {newItemSaving ? T("Menyimpan…", "Saving…") : T("Simpan Item Baru", "Save New Item")}
            </button>
            <button
              type="button"
              onClick={resetNewItem}
              className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              {T("Reset Form", "Reset Form")}
            </button>
          </div>
        </section>

        {/* ============================== */}
        {/* PHASE A: Borrow Modal */}
        {/* ============================== */}
        {borrowOpen && borrowItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div className="w-full max-w-lg rounded-3xl bg-white text-teal-900 shadow-2xl border border-emerald-100 overflow-hidden">
             <div className="p-5 border-b border-emerald-100">
               <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{T("Pinjam Item", "Borrow Item")}</h3>

            <p className="text-[11px] text-slate-500">
              {String((borrowItem as any).Kode || "")} — {String((borrowItem as any)["Nama Alat"] || "")}
            </p>

            {/* NEW: show booking ref if this borrow came from booking context */}
            {invFromBooking && (
              <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-900">{T("Booking Ref:", "Booking Ref:")}</span>

                  <span className="font-mono bg-white border border-emerald-100 px-2 py-0.5 rounded">
                    {invFromBooking.bookingId || `ROW-${invFromBooking.rowIndex}`}
                  </span>
                </div>

                <p className="mt-1 text-[10px] text-emerald-900/70">
                  {T(
                    "Jika peminjaman ini terkait booking, simpan referensi ini untuk pelacakan.",
                    "If this borrow is related to a booking, keep this reference for tracking."
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setBorrowOpen(false)}
            className="text-[11px] text-slate-500 underline hover:text-slate-700"
          >
            {T("Tutup", "Close")}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-3 text-[11px]">
        {borrowError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900">
            {borrowError}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-500 mb-1">{T("Jumlah", "Qty")}</label>
            <input
              type="number"
              min={1}
              value={borrowQty}
              onChange={(e) => setBorrowQty(Number(e.target.value))}
              className="w-full border rounded-2xl px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1">{T("Dicatat oleh", "Recorded by")}</label>
            <input
              value={borrowDicatatOleh}
              onChange={(e) => setBorrowDicatatOleh(e.target.value)}
              className="w-full border rounded-2xl px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-500 mb-1">{T("Ke (Tujuan)", "To (Destination)")}</label>
            <input
              value={borrowKe}
              onChange={(e) => setBorrowKe(e.target.value)}
              className="w-full border rounded-2xl px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-500 mb-1">{T("Guru / Kelas", "Teacher / Class")}</label>
            <input
              value={borrowGuruKelas}
              onChange={(e) => setBorrowGuruKelas(e.target.value)}
              className="w-full border rounded-2xl px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-500 mb-1">{T("Catatan", "Notes")}</label>
            <textarea
              value={borrowCatatan}
              onChange={(e) => setBorrowCatatan(e.target.value)}
              className="w-full border rounded-2xl px-3 py-2 min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={submitBorrow}
            disabled={borrowLoading}
            className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {borrowLoading ? T("Memproses…", "Processing…") : T("Konfirmasi Pinjam", "Confirm Borrow")}
          </button>

          <button
            type="button"
            onClick={() => setBorrowOpen(false)}
            className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
          >
            {T("Batal", "Cancel")}
          </button>
        </div>

        <p className="text-[10px] text-slate-500">
          {T(
            "Setelah berhasil, sistem akan memberikan RefId. Simpan RefId untuk proses Return.",
            "After success, the system will return a RefId. Keep the RefId for the Return process."
          )}
        </p>
      </div>
    </div>
  </div>
)}

        {/* ============================== */}
        {/* PHASE A: Return Modal (paste RefId) */}
        {/* ============================== */}
        {returnOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
            <div className="w-full max-w-lg rounded-3xl bg-white text-teal-900 shadow-2xl border border-emerald-100 overflow-hidden">
              <div className="p-5 border-b border-emerald-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{T("Return Item", "Return Item")}</h3>
                    <p className="text-[11px] text-slate-500">{T("Masukkan RefId dari transaksi Borrow.", "Paste the RefId from the Borrow transaction.")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReturnOpen(false)}
                    className="text-[11px] text-slate-500 underline hover:text-slate-700"
                  >
                    {T("Tutup", "Close")}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3 text-[11px]">
                {returnError && <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900">{returnError}</div>}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 mb-1">RefId</label>
                    <input value={returnRefId} onChange={(e) => setReturnRefId(e.target.value)} className="w-full border rounded-2xl px-3 py-2 font-mono" />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{T("Jumlah", "Qty")}</label>
                    <input
                      type="number"
                      min={1}
                      value={returnQty}
                      onChange={(e) => setReturnQty(Number(e.target.value))}
                      className="w-full border rounded-2xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{T("Dicatat oleh", "Recorded by")}</label>
                    <input
                      value={returnDicatatOleh}
                      onChange={(e) => setReturnDicatatOleh(e.target.value)}
                      className="w-full border rounded-2xl px-3 py-2"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 mb-1">{T("Catatan", "Notes")}</label>
                    <textarea
                      value={returnCatatan}
                      onChange={(e) => setReturnCatatan(e.target.value)}
                      className="w-full border rounded-2xl px-3 py-2 min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={submitReturn}
                    disabled={returnLoading}
                    className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {returnLoading ? T("Memproses…", "Processing…") : T("Konfirmasi Return", "Confirm Return")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnOpen(false)}
                    className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    {T("Batal", "Cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* PHASE A: Success Popups */}
        {/* ============================== */}
        {borrowSuccessRefId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 print:hidden">
            <div className="w-full max-w-md rounded-3xl bg-white text-teal-900 shadow-2xl border border-emerald-100 p-5">
              <h3 className="text-base font-semibold mb-1">{T("Borrow Berhasil", "Borrow Success")}</h3>
              <p className="text-[11px] text-slate-600 mb-3">{T("Simpan RefId ini untuk proses Return.", "Save this RefId for the Return process.")}</p>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] break-all">{borrowSuccessRefId}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(borrowSuccessRefId);
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-3 py-1 rounded-full bg-emerald-200 text-teal-900 text-[11px] font-semibold hover:bg-emerald-100 whitespace-nowrap"
                >
                  {T("Copy", "Copy")}
                </button>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBorrowSuccessRefId(null);
                    openReturnModal(borrowSuccessRefId);
                  }}
                  className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200"
                >
                  {T("Langsung Return", "Return Now")}
                </button>
                <button
                  type="button"
                  onClick={() => setBorrowSuccessRefId(null)}
                  className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  {T("Tutup", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {returnSuccessRefId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 print:hidden">
            <div className="w-full max-w-md rounded-3xl bg-white text-teal-900 shadow-2xl border border-emerald-100 p-5">
              <h3 className="text-base font-semibold mb-1">{T("Return Berhasil", "Return Success")}</h3>
              <p className="text-[11px] text-slate-600 mb-3">{T("RefId berikut sudah ditandai RETURNED.", "The following RefId has been marked as RETURNED.")}</p>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <span className="font-mono text-[12px] break-all">{returnSuccessRefId}</span>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnSuccessRefId(null)}
                  className="px-4 py-2 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow hover:bg-emerald-200"
                >
                  {T("OK", "OK")}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    );
  };

        {/* ============================== */}
        {/* BORROWED ITEMS MODAL */}
        {/* ============================== */}
        {borrowedOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 print:hidden">
            <div className="w-full max-w-6xl rounded-3xl bg-white text-teal-900 shadow-2xl border border-emerald-100 overflow-hidden">
              <div className="p-5 border-b border-emerald-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {T("Daftar Barang Dipinjam", "Borrowed Items List")}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {T(
                        "Berikut adalah item inventaris yang sedang dipinjam dan belum selesai dikembalikan.",
                        "These are inventory items currently borrowed and not yet fully returned."
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBorrowedOpen(false)}
                    className="text-[11px] text-slate-500 underline hover:text-slate-700"
                  >
                    {T("Tutup", "Close")}
                  </button>
                </div>
              </div>

              <div className="p-5">
                {borrowedError && (
                  <div className="mb-3 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900 text-[11px]">
                    {borrowedError}
                  </div>
                )}

                {!borrowedError && borrowedRows.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    {T("Belum ada item yang sedang dipinjam.", "No borrowed items found.")}
                  </p>
                )}

                {borrowedRows.length > 0 && (
                  <div className="overflow-auto max-h-[65vh]">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-emerald-50">
                          <th className="border border-emerald-100 px-2 py-1 text-left">RefId</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Tanggal", "Date")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Kode", "Code")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Nama Alat", "Tool Name")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-right">{T("Dipinjam", "Borrowed")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-right">{T("Kembali", "Returned")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-right">{T("Sisa", "Remaining")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Guru/Kelas", "Teacher/Class")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Ke", "To")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Status", "Status")}</th>
                          <th className="border border-emerald-100 px-2 py-1 text-left">{T("Aksi", "Action")}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {borrowedRows.map((r, idx) => {
                          const tanggal = r.tanggalPinjam || r.tanggal || "-";
                          const qtyBorrowed = r.jumlahDipinjam ?? r.jumlah ?? "-";
                          const qtyReturned = r.jumlahKembali ?? "0";
                          const qtyRemaining = r.sisa ?? qtyBorrowed;

                          return (
                            <tr key={`${r.refId}-${idx}`} className="align-top">
                              <td className="border border-emerald-100 px-2 py-1 font-mono">{r.refId || "-"}</td>
                              <td className="border border-emerald-100 px-2 py-1 whitespace-nowrap">{tanggal}</td>
                              <td className="border border-emerald-100 px-2 py-1">{r.kodeAlat || "-"}</td>
                              <td className="border border-emerald-100 px-2 py-1">{r.namaAlat || "-"}</td>
                              <td className="border border-emerald-100 px-2 py-1 text-right">{String(qtyBorrowed)}</td>
                              <td className="border border-emerald-100 px-2 py-1 text-right">{String(qtyReturned)}</td>
                              <td className="border border-emerald-100 px-2 py-1 text-right">{String(qtyRemaining)}</td>
                              <td className="border border-emerald-100 px-2 py-1">{r.guruKelas || "-"}</td>
                              <td className="border border-emerald-100 px-2 py-1">{r.ke || "-"}</td>
                              <td className="border border-emerald-100 px-2 py-1">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-semibold">
                                  {r.status || "BORROWED"}
                                </span>
                              </td>
                              <td className="border border-emerald-100 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBorrowedOpen(false);
                                    openReturnModal(r.refId);
                                  }}
                                  className="px-2 py-1 rounded-full bg-emerald-200 text-teal-900 text-[10px] font-semibold hover:bg-emerald-100"
                                >
                                  ↩️ {T("Return", "Return")}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


/* ========= LOGIN SCREEN RENDER ========= */

if (!isAuthenticated) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-800 via-teal-700 to-emerald-500 text-white flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-10 w-96 h-96 bg-teal-900/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col justify-center">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md shadow-emerald-900/30 flex items-center justify-center">
              <img src={logo} alt="Alkhairiyah Logo" className="w-10 h-10 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-100">LAB IPA – ADMIN</div>
              <div className="text-lg sm:text-xl font-semibold text-white">Alkhairiyah Surabaya</div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEnglish(false)}
                className={
                  "px-2.5 py-1 rounded-full border transition " +
                  (!isEnglish
                    ? "bg-emerald-300 text-teal-900 border-emerald-200"
                    : "border-white/40 bg-white/5 text-emerald-50")
                }
                aria-pressed={!isEnglish}
              >
                ID
              </button>

              <button
                type="button"
                onClick={() => setIsEnglish(true)}
                className={
                  "px-2.5 py-1 rounded-full border transition " +
                  (isEnglish
                    ? "bg-emerald-300 text-teal-900 border-emerald-200"
                    : "border-white/40 bg-white/5 text-emerald-50")
                }
                aria-pressed={isEnglish}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <main>
          <div className="bg-teal-950/60 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-xl shadow-emerald-900/40 backdrop-blur-md">
            <h1 className="text-xl sm:text-2xl font-semibold mb-1">
              {T("Login Admin Lab IPA", "Lab IPA Admin Login")}
            </h1>

            <p className="text-[11px] sm:text-xs text-emerald-100/90 mb-4">
              {T(
                "Masukkan kode admin yang diberikan kepada PJ Lab untuk mengakses Log-Book dan Inventaris.",
                "Enter the admin code given to the Lab PIC to access the Log Book and Inventory."
              )}
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-emerald-100/90 mb-1">
                  {T("Kode Admin", "Admin Code")}
                </label>

                <input
                  type="password"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder={T("Masukkan kode admin", "Enter admin code")}
                  className="w-full border border-emerald-200/70 rounded-2xl px-3 py-2 text-xs text-teal-900 placeholder:text-emerald-300 bg-emerald-50/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  autoComplete="current-password"
                  inputMode="text"
                />
              </div>

              {loginError ? <p className="text-[11px] text-rose-100">{loginError}</p> : null}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-2 px-4 py-2.5 rounded-full bg-emerald-300 text-teal-900 text-xs font-semibold shadow-md shadow-emerald-900/40 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loginLoading
                  ? T("Memeriksa kode…", "Checking code…")
                  : T("Masuk ke Halaman Admin", "Enter Admin Page")}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a href="#/" className="text-[11px] text-emerald-100/90 hover:text-white underline underline-offset-2">
                {T("← Kembali ke Beranda", "← Back to Home")}
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

return (
  <div className="min-h-screen bg-gradient-to-b from-teal-800 via-teal-700 to-emerald-500 text-white flex flex-col">
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -left-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-10 w-96 h-96 bg-teal-900/30 rounded-full blur-3xl" />
    </div>

    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1">
      <header className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-md shadow-emerald-900/30 flex items-center justify-center">
            <img src={logo} alt="Alkhairiyah Logo" className="w-10 h-10 object-contain" />
          </div>

          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-100">LAB IPA – ADMIN</div>
            <div className="text-lg sm:text-xl font-semibold text-white">Alkhairiyah Surabaya</div>
            <div className="text-[11px] text-emerald-100/90">
              {T("Log-Book & Inventaris (Hanya untuk Admin)", "Log Book & Inventory (Admin Only)")}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEnglish(false)}
              className={
                "px-2.5 py-1 rounded-full border transition " +
                (!isEnglish
                  ? "bg-emerald-300 text-teal-900 border-emerald-200"
                  : "border-white/40 bg-white/5 text-emerald-50")
              }
              aria-pressed={!isEnglish}
            >
              ID
            </button>

            <button
              type="button"
              onClick={() => setIsEnglish(true)}
              className={
                "px-2.5 py-1 rounded-full border transition " +
                (isEnglish
                  ? "bg-emerald-300 text-teal-900 border-emerald-200"
                  : "border-white/40 bg-white/5 text-emerald-50")
              }
              aria-pressed={isEnglish}
            >
              EN
            </button>
          </div>

          <a href="#/" className="text-[11px] text-emerald-100/90 hover:text-white underline underline-offset-2">
            {T("← Kembali ke Beranda", "← Back to Home")}
          </a>
        </div>
      </header>

      <div className="mb-6 print:hidden">
        <div className="inline-flex items-center bg-teal-950/70 border border-white/15 rounded-full p-1 text-[11px] sm:text-xs">
          <TabButton label="Log-Book" active={activeTab === "log"} onClick={() => setActiveTab("log")} />
          <TabButton
            label={T("Admin Inventaris", "Inventory Admin")}
            active={activeTab === "inventory"}
            onClick={() => setActiveTab("inventory")}
          />
        </div>
      </div>

      {/* IMPORTANT: don't hide inventory accidentally */}
      <div className={activeTab !== "log" ? "print:hidden" : ""}>
        {activeTab === "log" ? renderLogBook() : null}
        {activeTab === "inventory" ? renderInventory() : null}
      </div>
    </div>
  </div>
);
};

/* ========= SMALL COMPONENTS ========= */

type TabButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 sm:px-4 py-1 rounded-full font-medium transition " +
        (active ? "bg-emerald-300 text-teal-900" : "text-emerald-100/80 hover:text-white")
      }
    >
      {label}
    </button>
  );
}

export default LabIPAAdmin;