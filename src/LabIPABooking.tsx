// src/LabIPABooking.tsx
import React, { useEffect, useMemo, useState } from "react";
const logo = "/logo-alkhairiyah.png";

/* ========= PUBLIC CONFIG =========
   Put real values in .env for local/private deployment.
   Public GitHub version intentionally uses placeholders.
================================= */

const BOOKING_ENDPOINT =
  import.meta.env.VITE_BOOKING_ENDPOINT ||
  "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

// Lab 1: SD1 & SMP calendar embed URL
const LAB_CALENDAR_URL_SD1_SMP =
  import.meta.env.VITE_LAB_CALENDAR_URL_SD1_SMP ||
  "YOUR_SD1_SMP_GOOGLE_CALENDAR_EMBED_URL_HERE";

// Lab 2: SD2 calendar embed URL
const LAB_CALENDAR_URL_SD2 =
  import.meta.env.VITE_LAB_CALENDAR_URL_SD2 ||
  "YOUR_SD2_GOOGLE_CALENDAR_EMBED_URL_HERE";

const IS_DEMO_MODE =
  BOOKING_ENDPOINT === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

type UnitCategory = "SD1_SMP" | "SD2" | "OTHER";

type BookingFormData = {
  lab: string; // LAB_SD1_SMP or LAB_SD2
  unitCategory: UnitCategory;
  teacher: string;
  unitClass: string;
  whatsapp: string;
  teacherEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  tools: string; // we'll fill this from picker as "KODE x2, KODE2 x1"
  materials: string;
  accessCode: string;
};

type LabIPABookingProps = {
  onBack?: () => void;
};

/* ========= INVENTORY TYPES ========= */

type InventoryItem = {
  // raw headers (uppercase) that may come from Apps Script
  ID?: string;
  KODE?: string;
  "NAMA ALAT"?: string;
  "LAB UTAMA"?: string;
  "KATEGORI"?: string;
  "LOKASI PENYIMPANAN"?: string;
  "JUMLAH TOTAL"?: any;

  // alias keys also returned by Apps Script getInventory()
  Kode?: string;
  "Nama Alat"?: string;
  "Lab Utama"?: string;
  Kategori?: string;
  "Lokasi Penyimpanan"?: string;
  "Jumlah Total"?: any;

  // optional extras
  Kondisi?: string;
  ImageURL?: string;
  "Link Foto"?: string;

  // if future columns appear, don’t break TS
  [key: string]: any;
};

type InventoryApiResponse = {
  items?: InventoryItem[];
  message?: string;
};

/* ========= HELPERS ========= */

function toStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function labUtamaFromBookingLab(lab: string): "SD1_SMP" | "SD2" {
  return String(lab || "").toUpperCase() === "LAB_SD2" ? "SD2" : "SD1_SMP";
}

function normalizeText(s: any) {
  return toStr(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/* ========= COMPONENT ========= */

const LabIPABooking: React.FC<LabIPABookingProps> = ({ onBack }) => {
  const [isEnglish, setIsEnglish] = useState(false);
  const T = (id: string, en: string) => (isEnglish ? en : id);

  const openInfoModal = (
    titleId: string,
    titleEn: string,
    msgId: string,
    msgEn: string,
    type: "success" | "error" = "error"
  ) => {
    setModalTitle(T(titleId, titleEn));
    setModalMessage(T(msgId, msgEn));
    setModalType(type);
    setModalOpen(true);
  };

  // which calendar is shown
  const [activeCalendar, setActiveCalendar] = useState<"SD1_SMP" | "SD2">(
    "SD1_SMP"
  );

  const [form, setForm] = useState<BookingFormData>({
    lab: "LAB_SD1_SMP",
    unitCategory: "SD1_SMP",
    teacher: "",
    unitClass: "",
    whatsapp: "",
    teacherEmail: "",
    date: "",
    startTime: "",
    endTime: "",
    activity: "",
    tools: "",
    materials: "",
    accessCode: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Modal State (Success/Error) */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("error");

  /* ========= INVENTORY PICKER STATE ========= */
  const [invOpen, setInvOpen] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [invQuery, setInvQuery] = useState("");
  const [invCategory, setInvCategory] = useState<string>("ALL");

  // selected: key is kode, value {kode,nama,qty}
  const [selected, setSelected] = useState<
    Record<string, { kode: string; nama: string; qty: number }>
  >({});

  // Load inventory only when modal opens (lazy)
  useEffect(() => {
    if (!invOpen) return;

    let cancelled = false;

    const load = async () => {
      setInvLoading(true);
      setInvError("");

      try {
        if (IS_DEMO_MODE) {
          if (!cancelled) {
            setInvItems([]);
            setInvError(
              T(
                "Mode demo aktif. Tambahkan URL Apps Script Anda sendiri di file .env untuk memuat inventaris.",
                "Demo mode is active. Add your own Apps Script URL in the .env file to load inventory."
              )
            );
          }
          return;
        }

        const params = new URLSearchParams({ mode: "inventory" });
        const res = await fetch(`${BOOKING_ENDPOINT}?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as InventoryApiResponse;
        const items = Array.isArray(json?.items) ? json.items : [];

        if (!cancelled) setInvItems(items);
        if (!cancelled && items.length === 0) {
          setInvError(json?.message ? String(json.message) : "");
        }
      } catch (e: any) {
        if (!cancelled) setInvError(e?.message ?? "Failed to load inventory.");
      } finally {
        if (!cancelled) setInvLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [invOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUnitCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as UnitCategory;
    setForm((prev) => ({
      ...prev,
      unitCategory: value,
      lab: value === "SD2" ? "LAB_SD2" : "LAB_SD1_SMP",
    }));

    // keep calendar tab aligned with selection (nice UX)
    setActiveCalendar(value === "SD2" ? "SD2" : "SD1_SMP");
  };

  const filteredInventory = useMemo(() => {
    const q = normalizeText(invQuery);
    const labUtama = labUtamaFromBookingLab(form.lab);

    const list = invItems.filter((it) => {
      const lab = normalizeText(it["Lab Utama"] ?? it["LAB UTAMA"]);
      const matchLab =
        !labUtama ? true : lab === normalizeText(labUtama) || lab === "";
      if (!matchLab) return false;

      const kat = normalizeText(it.Kategori ?? it["KATEGORI"]);
      if (invCategory !== "ALL" && kat !== normalizeText(invCategory))
        return false;

      if (!q) return true;

      const kode = normalizeText(it.Kode ?? it.KODE);
      const nama = normalizeText(it["Nama Alat"] ?? it["NAMA ALAT"]);
      const lokasi = normalizeText(
        it["Lokasi Penyimpanan"] ?? it["LOKASI PENYIMPANAN"]
      );

      return (
        kode.includes(q) ||
        nama.includes(q) ||
        kat.includes(q) ||
        lokasi.includes(q)
      );
    });

    return list.sort((a, b) => {
      const an = normalizeText(a["Nama Alat"] ?? a["NAMA ALAT"]);
      const bn = normalizeText(b["Nama Alat"] ?? b["NAMA ALAT"]);
      if (an < bn) return -1;
      if (an > bn) return 1;
      const ak = normalizeText(a.Kode ?? a.KODE);
      const bk = normalizeText(b.Kode ?? b.KODE);
      return ak.localeCompare(bk);
    });
  }, [invItems, invQuery, invCategory, form.lab]);

  const categories = useMemo(() => {
    const labUtama = labUtamaFromBookingLab(form.lab);
    const set = new Set<string>();

    invItems.forEach((it) => {
      const lab = normalizeText(it["Lab Utama"] ?? it["LAB UTAMA"]);
      const matchLab =
        !labUtama ? true : lab === normalizeText(labUtama) || lab === "";
      if (!matchLab) return;

      const kat = toStr(it.Kategori ?? it["KATEGORI"]).trim();
      if (kat) set.add(kat);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [invItems, form.lab]);

  function addSelected(it: InventoryItem) {
    const kode = toStr(it.Kode ?? it.KODE).trim();
    const nama = toStr(it["Nama Alat"] ?? it["NAMA ALAT"]).trim();
    if (!kode || !nama) return;

    setSelected((prev) => {
      const cur = prev[kode];
      const nextQty = cur ? cur.qty + 1 : 1;
      return { ...prev, [kode]: { kode, nama, qty: nextQty } };
    });
  }

  function setQty(kode: string, qty: number) {
    const q = Math.max(0, Math.floor(qty || 0));
    setSelected((prev) => {
      const cur = prev[kode];
      if (!cur) return prev;
      if (q <= 0) {
        const copy = { ...prev };
        delete copy[kode];
        return copy;
      }
      return { ...prev, [kode]: { ...cur, qty: q } };
    });
  }

  function clearSelected() {
    setSelected({});
  }

  function applyPickerToTools() {
    const parts = Object.values(selected)
      .sort((a, b) => a.kode.localeCompare(b.kode))
      .map((x) => `${x.kode} x${x.qty}`);

    setForm((prev) => ({ ...prev, tools: parts.join(", ") }));
    setInvOpen(false);
  }

  /* ========= SUBMIT HANDLER (with conflict pre-check) ========= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!form.date || !form.startTime || !form.endTime) {
        throw new Error(
          T(
            "Tanggal dan jam tidak boleh kosong.",
            "Date and time cannot be empty."
          )
        );
      }

      if (!form.lab) {
        throw new Error(
          T(
            "Silakan pilih Unit Pengguna Lab dengan benar.",
            "Please choose the Lab User Unit correctly."
          )
        );
      }

      if (IS_DEMO_MODE) {
        openInfoModal(
          "Mode Demo",
          "Demo Mode",
          "Halaman booking ini menampilkan implementasi asli, tetapi URL backend sengaja diganti placeholder untuk versi public GitHub. Tambahkan konfigurasi Anda sendiri di file .env agar booking dapat dijalankan.",
          "This booking page shows the real implementation, but the backend URL is intentionally replaced with a placeholder for the public GitHub version. Add your own configuration in the .env file to enable booking."
        );
        setIsSubmitting(false);
        return;
      }

      /* === 1) FRONTEND CONFLICT CHECK === */
      const conflictParams = new URLSearchParams({
        mode: "checkConflict",
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        lab: form.lab,
      });

      const conflictRes = await fetch(
        `${BOOKING_ENDPOINT}?${conflictParams.toString()}`
      );

      if (!conflictRes.ok) {
        throw new Error(
          T(
            "Gagal mengecek jadwal. Silakan coba lagi.",
            "Failed to check schedule. Please try again."
          ) + ` (HTTP ${conflictRes.status})`
        );
      }

      const conflictJson = await conflictRes.json();

      if (conflictJson?.conflict) {
        const msg = T(
          `Jadwal lab sudah terpakai pada ${conflictJson.existingStart}–${conflictJson.existingEnd}.
          
Guru/PIC: ${conflictJson.existingTeacher || "-"}
Unit & Kelas: ${conflictJson.existingUnitClass || "-"}
Kegiatan: ${conflictJson.existingActivity || "-"}`,
          `This time slot is already booked: ${conflictJson.existingStart}–${conflictJson.existingEnd}.
          
Teacher: ${conflictJson.existingTeacher || "-"}
Unit & Class: ${conflictJson.existingUnitClass || "-"}
Activity: ${conflictJson.existingActivity || "-"}`
        );

        setModalTitle(T("Jadwal Bentrok", "Schedule Conflict"));
        setModalMessage(msg);
        setModalType("error");
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      /* === 2) IF NO CONFLICT → SUBMIT BOOKING (POST) === */
      const body = new URLSearchParams();
      (Object.keys(form) as (keyof BookingFormData)[]).forEach((key) => {
        body.append(key, String(form[key] ?? ""));
      });

      const res = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
      });

      const rawText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(
          T(
            "Gagal mengirim booking. Silakan coba lagi.",
            "Failed to submit booking. Please try again."
          ) + ` (HTTP ${res.status})`
        );
      }

      if (json?.status === "conflict") {
        const msg = T(
          `Jadwal lab sudah terpakai pada ${json.existingStart}–${json.existingEnd}.`,
          `This time slot is already booked: ${json.existingStart}–${json.existingEnd}.`
        );

        setModalTitle(T("Jadwal Bentrok", "Schedule Conflict"));
        setModalMessage(msg);
        setModalType("error");
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      if (json?.status === "invalid_code") {
        setModalTitle(T("Kode Akses Salah", "Invalid Access Code"));
        setModalMessage(T("Kode akses tidak valid.", "Access code is invalid."));
        setModalType("error");
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      if (json?.status === "success") {
        const backendWarning = String(
          json?.toolWarning || json?.tool_warning || ""
        ).trim();

        const baseMsg = T(
          "Booking tersimpan dan undangan kalender telah dikirim.",
          "Booking saved and calendar invite sent."
        );

        const msg = backendWarning
          ? baseMsg +
            "\n\n" +
            T("⚠️ Peringatan alat:\n", "⚠️ Tools warning:\n") +
            backendWarning
          : baseMsg;

        setModalTitle(T("Booking Berhasil", "Booking Successful"));
        setModalMessage(msg);
        setModalType("success");
        setModalOpen(true);

        setForm((prev) => ({
          ...prev,
          date: "",
          startTime: "",
          endTime: "",
          activity: "",
          tools: "",
          materials: "",
          accessCode: "",
        }));

        clearSelected();

        setIsSubmitting(false);
        return;
      }

      throw new Error(json?.message || "Unknown error");
    } catch (err: any) {
      const msg = err?.message ?? "Error";
      setModalTitle("Error");
      setModalMessage(msg);
      setModalType("error");
      setModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ========= MODAL ========= */
  const GlassModal = () => {
    if (!modalOpen) return null;

    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={() => setModalOpen(false)}
      >
        <div
          className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 max-w-xs text-center shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            className={
              "text-lg font-semibold mb-2 " +
              (modalType === "success" ? "text-emerald-200" : "text-rose-200")
            }
          >
            {modalTitle}
          </h3>

          <p className="text-sm text-white/90 whitespace-pre-line">
            {modalMessage}
          </p>

          <button
            onClick={() => setModalOpen(false)}
            className="mt-4 px-4 py-1.5 rounded-full bg-white/30 text-white hover:bg-white/40 transition"
          >
            OK
          </button>
        </div>
      </div>
    );
  };

  /* ========= INVENTORY PICKER MODAL ========= */
  const InventoryPickerModal = () => {
    if (!invOpen) return null;

    const selectedList = Object.values(selected).sort((a, b) =>
      a.nama.localeCompare(b.nama)
    );

    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9998] px-4"
        onClick={() => setInvOpen(false)}
      >
        <div
          className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-teal-900">
                {T("Pilih Alat dari Inventaris", "Pick Tools from Inventory")}
              </h3>
              <p className="text-[12px] text-slate-500 mt-1">
                {T(
                  "Hasil pilihan akan otomatis diformat sebagai KODE xQty agar backend bisa membuat REQUESTED rows.",
                  "Your selection will be formatted as KODE xQty so the backend can create REQUESTED rows."
                )}
              </p>
            </div>

            <button
              className="text-slate-500 hover:text-slate-800 text-sm"
              onClick={() => setInvOpen(false)}
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 sm:p-6 grid lg:grid-cols-[1fr_360px] gap-5">
            {/* Left: search + list */}
            <div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {T("Cari", "Search")}
                  </label>
                  <input
                    value={invQuery}
                    onChange={(e) => setInvQuery(e.target.value)}
                    placeholder={T(
                      "Kode / Nama / Lokasi...",
                      "Code / Name / Location..."
                    )}
                    className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  />
                </div>

                <div className="sm:w-64">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {T("Kategori", "Category")}
                  </label>
                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-sm bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  >
                    <option value="ALL" className="text-slate-900">
                      {T("Semua", "All")}
                    </option>
                    {categories.map((c) => (
                      <option key={c} value={c} className="text-slate-900">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs text-slate-600 flex items-center justify-between">
                  <div>
                    {T("Lab aktif:", "Active lab:")}{" "}
                    <span className="font-semibold text-slate-700">
                      {labUtamaFromBookingLab(form.lab) === "SD2"
                        ? "SD2 (LAB2)"
                        : "SD1_SMP (LAB1)"}
                    </span>
                  </div>
                  <div>
                    {T("Item:", "Items:")}{" "}
                    <span className="font-semibold">
                      {filteredInventory.length}
                    </span>
                  </div>
                </div>

                <div className="max-h-[52vh] overflow-auto">
                  {invLoading ? (
                    <div className="p-6 text-sm text-slate-600">
                      {T("Memuat inventaris…", "Loading inventory…")}
                    </div>
                  ) : invError ? (
                    <div className="p-6 text-sm text-rose-700">
                      {T(
                        "Gagal memuat inventaris:",
                        "Failed to load inventory:"
                      )}{" "}
                      {invError}
                    </div>
                  ) : filteredInventory.length === 0 ? (
                    <div className="p-6 text-sm text-slate-600">
                      {T("Tidak ada item yang cocok.", "No matching items.")}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredInventory.map((it, idx) => {
                        const kode = toStr(it.Kode ?? it.KODE).trim();
                        const nama = toStr(
                          it["Nama Alat"] ?? it["NAMA ALAT"]
                        ).trim();
                        const kat = toStr(it.Kategori ?? it["KATEGORI"]).trim();
                        const lokasi = toStr(
                          it["Lokasi Penyimpanan"] ?? it["LOKASI PENYIMPANAN"]
                        ).trim();
                        const total = toNum(
                          it["Jumlah Total"] ?? it["JUMLAH TOTAL"]
                        );
                        const picked = kode ? selected[kode]?.qty ?? 0 : 0;

                        return (
                          <div
                            key={`${kode}-${idx}`}
                            className="p-4 flex items-start gap-3"
                          >
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                                  {kode || T("Tanpa Kode", "No Code")}
                                </span>
                                {kat ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                                    {kat}
                                  </span>
                                ) : null}
                                {total ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                                    {T("Stok:", "Stock:")} {total}
                                  </span>
                                ) : null}
                                {picked > 0 ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                                    {T("Dipilih:", "Picked:")} {picked}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 font-semibold text-slate-800">
                                {nama || "-"}
                              </div>

                              {lokasi ? (
                                <div className="mt-1 text-[12px] text-slate-500">
                                  {T("Lokasi:", "Location:")} {lokasi}
                                </div>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => addSelected(it)}
                              disabled={!kode || !nama}
                              className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {T("+ Tambah", "+ Add")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: selected list */}
            <div className="rounded-3xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  {T("Terpilih", "Selected")}
                </div>
                <button
                  type="button"
                  onClick={clearSelected}
                  className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  {T("Hapus semua", "Clear all")}
                </button>
              </div>

              <div className="p-4">
                {selectedList.length === 0 ? (
                  <div className="text-sm text-slate-600">
                    {T("Belum ada item dipilih.", "No items selected yet.")}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[42vh] overflow-auto pr-1">
                    {selectedList.map((x) => (
                      <div
                        key={x.kode}
                        className="rounded-2xl border border-slate-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-emerald-700">
                              {x.kode}
                            </div>
                            <div className="text-sm font-semibold text-slate-800 truncate">
                              {x.nama}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQty(x.kode, 0)}
                            className="text-slate-500 hover:text-rose-600 text-sm"
                            title={T("Hapus", "Remove")}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQty(x.kode, x.qty - 1)}
                            className="w-8 h-8 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={x.qty}
                            onChange={(e) =>
                              setQty(x.kode, Number(e.target.value))
                            }
                            className="w-16 text-center border border-slate-300 rounded-xl py-1 text-sm text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setQty(x.kode, x.qty + 1)}
                            className="w-8 h-8 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={applyPickerToTools}
                    disabled={selectedList.length === 0}
                    className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
                  >
                    {T(
                      "Gunakan pilihan → isi field Alat",
                      "Apply selection → fill Tools"
                    )}
                  </button>

                  <p className="mt-2 text-[11px] text-slate-500">
                    {T(
                      "Catatan: sistem akan membuat REQUESTED otomatis saat booking sukses.",
                      "Note: the system will auto-create REQUESTED rows after a successful booking."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-[11px] text-slate-600">
              {T(
                "Tip: jika nama alat mirip-mirip, pilih berdasarkan KODE.",
                "Tip: if tool names are similar, pick by KODE."
              )}
            </div>
            <button
              type="button"
              onClick={() => setInvOpen(false)}
              className="rounded-full px-4 py-2 text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-white"
            >
              {T("Tutup", "Close")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ========= UI ========= */
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-800 via-teal-700 to-emerald-500 text-white flex flex-col">
      <GlassModal />
      <InventoryPickerModal />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-10 flex-1">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex-shrink-0 rounded-full bg-white p-1 shadow-lg">
              <img
                src={logo}
                alt="Alkhairiyah Logo"
                className="h-full w-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-100">
                LAB IPA
              </div>
              <div className="text-lg sm:text-xl font-semibold text-white">
                {T(
                  "Booking Lab — SD 1, SD 2 & SMP",
                  "Lab Booking — SD 1, SD 2 & JHS"
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setIsEnglish(false)}
              className={
                "px-2.5 py-1 rounded-full border " +
                (!isEnglish
                  ? "bg-emerald-300 text-teal-900 border-emerald-200"
                  : "border-white/40 bg-white/5 text-emerald-50")
              }
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => setIsEnglish(true)}
              className={
                "px-2.5 py-1 rounded-full border " +
                (isEnglish
                  ? "bg-emerald-300 text-teal-900 border-emerald-200"
                  : "border-white/40 bg-white/5 text-emerald-50")
              }
            >
              EN
            </button>

            <a
              href="#/"
              onClick={(e) => {
                if (onBack) {
                  e.preventDefault();
                  onBack();
                }
              }}
              className="text-[11px] underline underline-offset-2 text-emerald-100/90 hover:text-white"
            >
              {T("← Kembali", "← Back")}
            </a>
          </div>
        </header>

        {/* Calendars – Wide Tabbed View */}
        <section className="-mx-4 sm:-mx-8 lg:-mx-12 mb-12">
          <div className="bg-teal-900/40 rounded-none lg:rounded-3xl border-t lg:border border-white/10 px-4 sm:px-8 lg:px-10 py-8 sm:py-10 shadow-xl">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-semibold mb-1">
                    {T("Jadwal Lab IPA", "Science Lab Schedule")}
                  </h2>
                  <p className="text-[11px] sm:text-sm text-emerald-100/90">
                    {T(
                      "Silakan cek ketersediaan jadwal lab sebelum mengisi form booking.",
                      "Please check lab availability before filling out the booking form."
                    )}
                  </p>
                </div>

                {/* Tabs to switch calendar */}
                <div className="inline-flex items-center bg-teal-950/60 border border-white/15 rounded-full p-1 text-[11px] sm:text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveCalendar("SD1_SMP")}
                    className={
                      "px-3 sm:px-4 py-1 rounded-full font-medium transition " +
                      (activeCalendar === "SD1_SMP"
                        ? "bg-emerald-300 text-teal-900"
                        : "text-emerald-100/80 hover:text-white")
                    }
                  >
                    {T("Lab SD 1 & SMP", "Lab SD 1 & JHS")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCalendar("SD2")}
                    className={
                      "px-3 sm:px-4 py-1 rounded-full font-medium transition " +
                      (activeCalendar === "SD2"
                        ? "bg-emerald-300 text-teal-900"
                        : "text-emerald-100/80 hover:text-white")
                    }
                  >
                    {T("Lab SD 2", "Lab SD 2")}
                  </button>
                </div>
              </div>

              {/* Wide calendar container */}
              <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-white shadow-2xl">
                <div className="absolute inset-x-0 top-0 h-9 bg-slate-100/90 border-b border-slate-200 flex items-center px-4 gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-[11px] text-slate-500 font-medium uppercase tracking-[0.18em]">
                    {activeCalendar === "SD1_SMP"
                      ? T(
                          "Kalender Lab SD 1 & SMP",
                          "Lab SD 1 & JHS Calendar"
                        )
                      : T("Kalender Lab SD 2", "Lab SD 2 Calendar")}
                  </span>
                </div>

                <div className="w-full aspect-[16/9] sm:aspect-[16/8] lg:aspect-[16/7] mt-9">
                  {activeCalendar === "SD1_SMP" ? (
                    LAB_CALENDAR_URL_SD1_SMP ===
                    "YOUR_SD1_SMP_GOOGLE_CALENDAR_EMBED_URL_HERE" ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-600 px-6 text-center">
                        <div>
                          <div className="font-semibold text-slate-800 mb-2">
                            {T(
                              "Kalender demo belum dikonfigurasi",
                              "Demo calendar is not configured yet"
                            )}
                          </div>
                          <div className="text-sm">
                            {T(
                              "Tambahkan URL embed Google Calendar Anda sendiri di file .env.",
                              "Add your own Google Calendar embed URL in the .env file."
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        src={LAB_CALENDAR_URL_SD1_SMP}
                        className="w-full h-full border-0"
                        loading="lazy"
                        title="Lab IPA SD1 & SMP Calendar"
                      ></iframe>
                    )
                  ) : LAB_CALENDAR_URL_SD2 ===
                    "YOUR_SD2_GOOGLE_CALENDAR_EMBED_URL_HERE" ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-600 px-6 text-center">
                      <div>
                        <div className="font-semibold text-slate-800 mb-2">
                          {T(
                            "Kalender demo belum dikonfigurasi",
                            "Demo calendar is not configured yet"
                          )}
                        </div>
                        <div className="text-sm">
                          {T(
                            "Tambahkan URL embed Google Calendar Anda sendiri di file .env.",
                            "Add your own Google Calendar embed URL in the .env file."
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={LAB_CALENDAR_URL_SD2}
                      className="w-full h-full border-0"
                      loading="lazy"
                      title="Lab IPA SD2 Calendar"
                    ></iframe>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[10px] sm:text-xs text-emerald-100/80">
                {T(
                  "Gunakan tab di kanan atas untuk berpindah antara kalender Lab SD 1 & SMP dan Lab SD 2.",
                  "Use the tabs above to switch between the Lab SD 1 & JHS and Lab SD 2 calendars."
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Booking Form */}
        <section className="bg-white rounded-3xl shadow-2xl p-10 sm:p-12 lg:p-14 text-slate-800 mb-16">
          <h1 className="text-3xl font-semibold text-teal-900 mb-6">
            {T("Formulir Booking Lab IPA", "Science Lab Booking Form")}
          </h1>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 text-sm sm:text-base"
          >
            {/* Unit Category + Teacher */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 text-xs sm:text-sm mb-1">
                  {T("Unit Pengguna Lab", "Lab User Unit")}
                </label>
                <select
                  value={form.unitCategory}
                  onChange={handleUnitCategoryChange}
                  className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-xs sm:text-sm bg-emerald-50/60"
                >
                  <option value="SD1_SMP">
                    {T("SD 1 atau SMP (Lab 1)", "SD 1 or JHS (Lab 1)")}
                  </option>
                  <option value="SD2">{T("SD 2 (Lab 2)", "SD 2 (Lab 2)")}</option>
                  <option value="OTHER">
                    {T("Lainnya (ikut Lab 1)", "Others (Lab 1)")}
                  </option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {T(
                    "Pilihan ini menentukan lab fisik dan kalender yang digunakan.",
                    "This choice determines the physical lab and calendar used."
                  )}
                </p>
              </div>

              <InputField
                label={T("Nama Guru / PIC", "Teacher / PIC")}
                name="teacher"
                value={form.teacher}
                onChange={handleChange}
                required
              />
            </div>

            <InputField
              label={T("Unit & Kelas", "Unit & Class")}
              name="unitClass"
              value={form.unitClass}
              onChange={handleChange}
              placeholder={T("mis. SD 5A, SMP 7B", "e.g. SD 5A, JHS 7B")}
              required
            />

            <InputField
              label="WhatsApp"
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
            />

            <InputField
              label="Email"
              name="teacherEmail"
              value={form.teacherEmail}
              onChange={handleChange}
            />

            <div className="grid md:grid-cols-3 gap-4">
              <InputField
                label={T("Tanggal", "Date")}
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
              />
              <InputField
                label={T("Jam Mulai", "Start Time")}
                name="startTime"
                type="time"
                value={form.startTime}
                onChange={handleChange}
                required
              />
              <InputField
                label={T("Jam Selesai", "End Time")}
                name="endTime"
                type="time"
                value={form.endTime}
                onChange={handleChange}
                required
              />
            </div>

            <InputField
              label={T("Kegiatan / Topik", "Activity / Topic")}
              name="activity"
              value={form.activity}
              onChange={handleChange}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-end justify-between gap-3">
                  <label className="block font-medium text-slate-700 text-xs sm:text-sm">
                    {T("Alat yang dibutuhkan", "Required tools")}
                  </label>

                  <button
                    type="button"
                    onClick={() => setInvOpen(true)}
                    className="text-[11px] sm:text-xs font-semibold text-teal-800 underline underline-offset-2 hover:text-teal-900"
                  >
                    {T("📦 Pilih dari inventaris", "📦 Pick from inventory")}
                  </button>
                </div>

                <textarea
                  name="tools"
                  rows={3}
                  value={form.tools}
                  onChange={handleChange}
                  placeholder={T(
                    "Contoh: LAB1-F-001 x2, LAB1-K-010 x1",
                    "Example: LAB1-F-001 x2, LAB1-K-010 x1"
                  )}
                  className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-xs sm:text-sm bg-emerald-50/60"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {T(
                    "Jika menggunakan picker, field ini akan terisi otomatis dengan format KODE xQty.",
                    "If you use the picker, this field will auto-fill as KODE xQty."
                  )}
                </p>
              </div>

              <TextAreaField
                label={T("Bahan yang dibutuhkan", "Required materials")}
                name="materials"
                value={form.materials}
                onChange={handleChange}
              />
            </div>

            <InputField
              label={T("Kode Akses", "Access Code")}
              name="accessCode"
              type="password"
              value={form.accessCode}
              onChange={handleChange}
              required
            />
            <p className="mt-1 text-[11px] sm:text-xs text-slate-500">
              {T(
                "Untuk mendapatkan Kode Akses, silakan hubungi Admin / PJ Lab IPA.",
                "To obtain the Access Code, please contact the Lab Admin."
              )}
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    date: "",
                    startTime: "",
                    endTime: "",
                    activity: "",
                    tools: "",
                    materials: "",
                    accessCode: "",
                  }))
                }
                className="border border-slate-300 rounded-full px-4 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full px-6 py-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSubmitting
                  ? T("Mengirim…", "Submitting…")
                  : T("Kirim Booking", "Submit Booking")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

/* ========= PRESENTATIONAL FIELDS ========= */

type InputFieldProps = {
  label: string;
  name: keyof BookingFormData;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}) => (
  <div>
    <label className="block font-medium text-slate-700 text-xs sm:text-sm">
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-xs sm:text-sm bg-emerald-50/60"
    />
  </div>
);

type TextAreaFieldProps = {
  label: string;
  name: keyof BookingFormData;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  placeholder?: string;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
}) => (
  <div>
    <label className="block font-medium text-slate-700 text-xs sm:text-sm">
      {label}
    </label>
    <textarea
      name={name}
      rows={3}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-2xl px-3 py-2 text-xs sm:text-sm bg-emerald-50/60"
    />
  </div>
);

export default LabIPABooking;