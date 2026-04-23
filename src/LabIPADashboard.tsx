// src/LabIPADashboard.tsx
import { useEffect, useMemo, useState } from "react";
const logo = "/logo-alkhairiyah.png";

/* ========= PUBLIC CONFIG ========= */

// Same Apps Script backend as Booking & Admin
const BOOKING_ENDPOINT =
  import.meta.env.VITE_BOOKING_ENDPOINT ||
  "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const STATS_ENDPOINT = `${BOOKING_ENDPOINT}?mode=stats`;
const INVENTORY_ENDPOINT = `${BOOKING_ENDPOINT}?mode=inventory`;
const IS_DEMO_MODE =
  BOOKING_ENDPOINT === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

/* ========= HELPERS ========= */

// Date: "2025-12-03" → "03/12/2025"
function formatLogDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return s;
}

/* ========= TYPES ========= */

type StatsResponse = {
  totalSessions: number;
  sdSessions: number;
  sd1Sessions: number;
  sd2Sessions: number;
  smpSessions: number;
  otherSessions: number;
  topTeachers: { name: string; count: number }[];
  unitCounts: { name: string; count: number }[];
  toolCounts: { name: string; count: number }[];
  monthlyCounts: { month: string; count: number }[];
  recentBookings: {
    date: string;
    unitClass: string;
    teacher: string;
    activity: string;
  }[];
};

type InventoryItem = {
  [key: string]: any;
  ID?: number | string;
  Kode?: string;
  "Nama Alat"?: string;
  "Lab Utama"?: string; // "SD1_SMP" | "SD2" | etc.
  Kategori?: string;
  "Lokasi Penyimpanan"?: string;
  "Jumlah Total"?: number | string;
  "Min Stok"?: number | string;
  Kondisi?: string;
  "Terakhir Dicek"?: string;
  "Dicek Oleh"?: string;
  ImageURL?: string;
  Catatan?: string;
};

/* ========= NORMALIZER UNTUK INVENTARIS ========= */
/* Menyamakan format dari Google Sheets (header huruf besar) ke format yang dipakai dashboard */

function normalizeInventory(rows: any[]): InventoryItem[] {
  return (rows || []).map((row) => ({
    ID: row.ID ?? row.id ?? row.row ?? "",
    Kode: row.KODE ?? row.Kode ?? row.kode ?? "",
    "Nama Alat":
      row["NAMA ALAT"] ??
      row["Nama Alat"] ??
      row.namaAlat ??
      row.nama ??
      "",
    "Lab Utama":
      row["LAB UTAMA"] ??
      row["Lab Utama"] ??
      row.labUtama ??
      row.lab ??
      "",
    Kategori: row.KATEGORI ?? row.Kategori ?? row.kategori ?? "",
    "Lokasi Penyimpanan":
      row["LOKASI PENYIMPANAN"] ??
      row["Lokasi Penyimpanan"] ??
      row.lokasiPenyimpanan ??
      "",
    "Jumlah Total":
      row["JUMLAH TOTAL"] ??
      row["Jumlah Total"] ??
      row.jumlahTotal ??
      "",
    "Min Stok":
      row["MIN STOK"] ??
      row["Min Stok"] ??
      row.minStok ??
      "",
    Kondisi: row.KONDISI ?? row.kondisi ?? row.Kondisi ?? "",
    "Terakhir Dicek":
      row["TERAKHIR DICEK"] ??
      row["Terakhir Dicek"] ??
      row.terakhirDicek ??
      "",
    "Dicek Oleh":
      row["DICEK OLEH"] ??
      row["Dicek Oleh"] ??
      row.dicekOleh ??
      "",
    ImageURL:
      row["LINK FOTO"] ??
      row["Link Foto"] ??
      row.linkFoto ??
      row.fotoUrl ??
      row.imageUrl ??
      "",
    Catatan: row.CATATAN ?? row.Catatan ?? row.catatan ?? "",
  }));
}

/* ========= DASHBOARD COMPONENT ========= */

const LabIPADashboard = () => {
  // Stats state
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Inventory state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  // Inventory filters
  const [search, setSearch] = useState("");
  const [labFilter, setLabFilter] = useState<"ALL" | "SD1_SMP" | "SD2">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  /* ====== LOADERS ====== */

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError(null);

    if (IS_DEMO_MODE) {
      setStats(null);
      setStatsError(
        "Demo mode aktif. Tambahkan VITE_BOOKING_ENDPOINT di file .env untuk memuat statistik."
      );
      setStatsLoading(false);
      return;
    }

    try {
      const res = await fetch(STATS_ENDPOINT);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatsResponse;
      setStats(json);
    } catch (err: any) {
      console.error(err);
      setStatsError(err?.message || "Gagal memuat statistik.");
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchInventory = async () => {
    setInvLoading(true);
    setInvError(null);

    if (IS_DEMO_MODE) {
      setItems([]);
      setInvError(
        "Demo mode aktif. Tambahkan VITE_BOOKING_ENDPOINT di file .env untuk memuat inventaris."
      );
      setInvLoading(false);
      return;
    }

    try {
      const res = await fetch(INVENTORY_ENDPOINT);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const normalized = normalizeInventory(json.items || []);
      setItems(normalized);
    } catch (err: any) {
      console.error(err);
      setInvError(err?.message || "Gagal memuat data inventaris.");
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchInventory();
  }, []);

  /* ====== INVENTORY HELPERS ====== */

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const k = (item.Kategori || "").toString().trim();
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  }, [items]);

  const parseNumber = (value: any): number | null => {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };

  const getLabLabel = (lab?: string) => {
    if (lab === "SD1_SMP") return "Lab SD1 & SMP";
    if (lab === "SD2") return "Lab SD 2";
    return lab || "-";
  };

  const getLabPillClass = (lab?: string) => {
    if (lab === "SD1_SMP")
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (lab === "SD2") return "bg-sky-50 text-sky-700 border-sky-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const getKondisiBadgeClass = (kondisiRaw?: string) => {
    const kondisi = (kondisiRaw || "").toLowerCase();
    if (kondisi === "baik") {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (kondisi.includes("cek") || kondisi === "perlu dicek") {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (kondisi.includes("rusak") || kondisi.includes("hilang")) {
      return "bg-rose-50 text-rose-800 border-rose-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  // Short list (max 10 items) per lab, independent of search text
  const topItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    let base = items;
    if (labFilter !== "ALL") {
      base = items.filter(
        (item) => (item["Lab Utama"] || "").toString() === labFilter
      );
    }

    const sorted = [...base].sort((a, b) => {
      const nameA = (a["Nama Alat"] || "").toString().toLowerCase();
      const nameB = (b["Nama Alat"] || "").toString().toLowerCase();
      if (!nameA && nameB) return 1;
      if (nameA && !nameB) return -1;
      return nameA.localeCompare(nameB);
    });

    return sorted.slice(0, 10);
  }, [items, labFilter]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    return items.filter((item) => {
      const lab = (item["Lab Utama"] || "").toString();
      if (labFilter !== "ALL" && lab !== labFilter) return false;

      if (categoryFilter !== "ALL") {
        const kat = (item.Kategori || "").toString();
        if (kat !== categoryFilter) return false;
      }

      if (!q) return true;

      const fieldsRaw = [
        item["Nama Alat"],
        item.Kode,
        item.Kategori,
        item["Lokasi Penyimpanan"],
        item.Kondisi,
        item.Catatan,
        item["Lab Utama"],
      ];

      const fields = fieldsRaw
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).toLowerCase());

      return fields.some((f) => f.includes(q));
    });
  }, [items, search, labFilter, categoryFilter]);

  /* ========= RENDER ========= */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-emerald-100 flex items-center justify-center">
              <img
                src={logo}
                alt="Alkhairiyah Logo"
                className="w-8 h-8 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">
                LAB IPA ALKHAIRIYAH
              </div>
              <div className="text-sm sm:text-base font-semibold text-slate-900">
                Dashboard Penggunaan & Inventaris
              </div>
              <div className="text-[11px] text-slate-500">
                SD 1, SD 2 & SMP Alkhairiyah Surabaya
              </div>
            </div>
          </div>

          <a
            href="#/"
            className="text-[11px] sm:text-xs text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
          >
            ← Kembali ke Portal
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8">
        {/* Top Intro Card */}
        <section className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-3xl p-4 sm:p-5 lg:p-6 text-emerald-50 shadow-md shadow-emerald-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold mb-1">
                Overview Penggunaan Lab IPA
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 max-w-2xl">
                Ringkasan aktivitas lab berdasarkan data booking, serta daftar
                inventaris alat & bahan. Halaman ini bersifat{" "}
                <span className="font-semibold">baca saja</span> untuk guru,
                pimpinan, dan kebutuhan akreditasi.
              </p>
            </div>
            <div className="text-[11px] sm:text-xs text-emerald-100/90">
              <div>Data sumber:</div>
              <ul className="list-disc pl-4">
                <li>Spreadsheet &amp; Booking Lab IPA</li>
                <li>Spreadsheet Inventaris LABIPA</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Stats + Recent Bookings */}
        <section className="grid gap-4 lg:grid-cols-[1.1fr,1.05fr] items-start">
          {/* Stats block */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Ringkasan Penggunaan Lab
              </h2>
              {statsLoading && (
                <span className="text-[11px] text-slate-500">
                  Memuat statistik…
                </span>
              )}
              {statsError && (
                <button
                  onClick={fetchStats}
                  className="text-[11px] text-rose-600 underline"
                >
                  Coba lagi
                </button>
              )}
            </div>

            {statsError && !statsLoading && (
              <p className="text-[11px] text-rose-600">{statsError}</p>
            )}

            {stats && !statsLoading && !statsError && (
              <div className="space-y-4 sm:space-y-5">
                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    label="Total Sesi Lab"
                    value={stats.totalSessions}
                    subtitle="Semua unit"
                  />
                  <SummaryCard
                    label="Sesi SD 1"
                    value={stats.sd1Sessions}
                    subtitle="Lab SD1 & SMP"
                  />
                  <SummaryCard
                    label="Sesi SD 2"
                    value={stats.sd2Sessions}
                    subtitle="Lab SD 2"
                  />
                  <SummaryCard
                    label="Sesi SMP"
                    value={stats.smpSessions}
                    subtitle="Lab SD1 & SMP"
                  />
                </div>

                {/* Top teachers & monthly trend */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-3.5">
                    <h3 className="text-xs font-semibold text-emerald-900 mb-2">
                      Guru / PIC Teraktif
                    </h3>
                    {stats.topTeachers.length === 0 ? (
                      <p className="text-[11px] text-emerald-700">
                        Belum ada data penggunaan.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px]">
                        {stats.topTeachers.map((t) => (
                          <li
                            key={t.name}
                            className="flex items-center justify-between"
                          >
                            <span>{t.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-[10px]">
                              {t.count} sesi
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5">
                    <h3 className="text-xs font-semibold text-slate-900 mb-2">
                      Tren Penggunaan per Bulan
                    </h3>
                    {stats.monthlyCounts.length === 0 ? (
                      <p className="text-[11px] text-slate-600">
                        Belum ada data bulanan.
                      </p>
                    ) : (
                      <div className="space-y-1.5 text-[11px]">
                        {stats.monthlyCounts.map((m) => (
                          <div
                            key={m.month}
                            className="flex items-center gap-2"
                          >
                            <span className="w-16">{m.month}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{
                                  width: `${Math.min(m.count * 8, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="w-6 text-right">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent bookings */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                10 Booking Terakhir
              </h2>
              <span className="text-[11px] text-slate-500">
                Sumber: sistem booking Lab IPA
              </span>
            </div>

            {!statsLoading && stats && stats.recentBookings.length === 0 && (
              <p className="text-[11px] text-slate-600">Belum ada booking.</p>
            )}

            {statsLoading && (
              <p className="text-[11px] text-slate-500">Memuat data…</p>
            )}

            {stats && stats.recentBookings.length > 0 && (
              <div className="overflow-x-auto text-[11px]">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-2 py-1.5 text-slate-700 font-semibold">
                        Tanggal
                      </th>
                      <th className="text-left px-2 py-1.5 text-slate-700 font-semibold">
                        Unit & Kelas
                      </th>
                      <th className="text-left px-2 py-1.5 text-slate-700 font-semibold">
                        Guru / PIC
                      </th>
                      <th className="text-left px-2 py-1.5 text-slate-700 font-semibold">
                        Kegiatan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentBookings.map((b, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-2 py-1.5">
                          {formatLogDate(String(b.date))}
                        </td>
                        <td className="px-2 py-1.5">{b.unitClass}</td>
                        <td className="px-2 py-1.5">{b.teacher}</td>
                        <td className="px-2 py-1.5">{b.activity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Inventory section */}
        <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Inventaris Lab IPA (Read-Only)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 max-w-xl">
                Daftar alat & bahan laboratorium untuk Lab SD1 & SMP dan Lab SD
                2. Data dikelola melalui Google Sheet oleh PJ Lab / manajemen.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchInventory}
              disabled={invLoading}
              className="self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] sm:text-xs font-medium shadow-sm hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {invLoading ? "Memuat…" : "Muat Ulang Data"}
            </button>
          </div>

          {invError && (
            <p className="text-[11px] text-red-600 mb-2">{invError}</p>
          )}

          {/* Short top-10 list */}
          {!invError && !invLoading && topItems.length > 0 && (
            <div className="mb-3">
              <h3 className="text-[11px] sm:text-xs font-semibold text-slate-800 mb-1.5">
                Daftar singkat (maks. 10 item) sesuai pilihan lab
              </h3>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 text-[11px]">
                {topItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/70 text-left"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 line-clamp-1">
                        {(item["Nama Alat"] || "-").toString()}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {getLabLabel(item["Lab Utama"]?.toString())}
                      </span>
                    </div>
                    {item["Jumlah Total"] !== undefined &&
                      item["Jumlah Total"] !== null && (
                        <span className="text-[10px] text-slate-600 font-semibold ml-2">
                          {String(item["Jumlah Total"])}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Cari nama alat, kode, kategori, atau lokasi…"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Lab:</span>
                <select
                  value={labFilter}
                  onChange={(e) =>
                    setLabFilter(e.target.value as "ALL" | "SD1_SMP" | "SD2")
                  }
                  className="border border-slate-300 rounded-full px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua</option>
                  <option value="SD1_SMP">Lab SD1 & SMP</option>
                  <option value="SD2">Lab SD 2</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Kategori:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-slate-300 rounded-full px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-slate-500">
                Total item:{" "}
                <span className="font-semibold text-slate-800">
                  {filteredItems.length}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          {invLoading && !invError && (
            <div className="py-6 text-center text-[12px] text-slate-500">
              Memuat data inventaris…
            </div>
          )}

          {!invLoading && !invError && filteredItems.length === 0 && (
            <div className="py-6 text-center text-[12px] text-slate-500">
              Tidak ada data inventaris yang sesuai dengan filter atau
              pencarian.
            </div>
          )}

          {!invLoading && !invError && filteredItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Alat / Bahan
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Kode
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Lab
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Kategori
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Lokasi
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Kondisi
                    </th>
                    <th className="text-right py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Jumlah
                    </th>
                    <th className="text-left py-2 px-2 sm:px-3 font-semibold text-slate-700">
                      Terakhir Dicek
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const jumlah = parseNumber(item["Jumlah Total"]);
                    const minStok = parseNumber(item["Min Stok"]);
                    const lowStock =
                      jumlah !== null &&
                      minStok !== null &&
                      minStok > 0 &&
                      jumlah <= minStok;

                    const imageUrl = (item.ImageURL || "").toString().trim();
                    const nama = (item["Nama Alat"] || "").toString();

                    return (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 hover:bg-emerald-50/40 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        {/* Alat + thumbnail */}
                        <td className="py-1.5 px-2 sm:px-3">
                          <div className="flex items-center gap-2">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={nama}
                                className="w-9 h-9 rounded-md object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] text-slate-500 flex-shrink-0">
                                {nama ? nama.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-slate-900">
                                {nama || "-"}
                              </div>
                              {item.Catatan && (
                                <div className="text-[10px] text-slate-500 line-clamp-1">
                                  {item.Catatan}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          <span className="font-mono text-[11px]">
                            {item.Kode || "-"}
                          </span>
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          <span
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] " +
                              getLabPillClass(item["Lab Utama"]?.toString())
                            }
                          >
                            {getLabLabel(item["Lab Utama"]?.toString())}
                          </span>
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          {item.Kategori || "-"}
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          {item["Lokasi Penyimpanan"] || "-"}
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          <span
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] " +
                              getKondisiBadgeClass(item.Kondisi)
                            }
                          >
                            {item.Kondisi || "—"}
                          </span>
                        </td>

                        <td className="py-1.5 px-2 sm:px-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-semibold">
                              {jumlah !== null ? jumlah : "-"}
                            </span>
                            {lowStock && (
                              <span className="text-[9px] text-rose-600">
                                Perlu pengadaan
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-1.5 px-2 sm:px-3">
                          <div className="flex flex-col gap-0.5">
                            <span>{item["Terakhir Dicek"] || "-"}</span>
                            {item["Dicek Oleh"] && (
                              <span className="text-[9px] text-slate-500">
                                oleh {item["Dicek Oleh"]}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] sm:text-xs text-slate-400 text-center mt-3">
            Data inventaris bersifat baca-saja untuk publik/guru. Pengubahan
            data dilakukan melalui Google Sheet atau halaman admin oleh PJ Lab.
          </p>
        </section>
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Detail Alat / Bahan Lab IPA
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Header: image + main info */}
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  {selectedItem.ImageURL ? (
                    <img
                      src={selectedItem.ImageURL.toString()}
                      alt={selectedItem["Nama Alat"] || ""}
                      className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-lg text-slate-500">
                      {selectedItem["Nama Alat"]
                        ? selectedItem["Nama Alat"]
                            .toString()
                            .charAt(0)
                            .toUpperCase()
                        : "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedItem["Nama Alat"] || "-"}
                  </div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    Kode:{" "}
                    <span className="font-mono">
                      {selectedItem.Kode || "-"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] " +
                        getLabPillClass(selectedItem["Lab Utama"]?.toString())
                      }
                    >
                      {getLabLabel(selectedItem["Lab Utama"]?.toString())}
                    </span>
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] " +
                        getKondisiBadgeClass(selectedItem.Kondisi)
                      }
                    >
                      {selectedItem.Kondisi || "Kondisi tidak tercatat"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-700">
                <div>
                  <div className="text-slate-500 mb-0.5">Kategori</div>
                  <div className="font-medium">
                    {selectedItem.Kategori || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">
                    Lokasi Penyimpanan
                  </div>
                  <div className="font-medium">
                    {selectedItem["Lokasi Penyimpanan"] || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Jumlah Total</div>
                  <div className="font-medium">
                    {selectedItem["Jumlah Total"] ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Min Stok</div>
                  <div className="font-medium">
                    {selectedItem["Min Stok"] ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Terakhir Dicek</div>
                  <div className="font-medium">
                    {selectedItem["Terakhir Dicek"] || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Dicek Oleh</div>
                  <div className="font-medium">
                    {selectedItem["Dicek Oleh"] || "-"}
                  </div>
                </div>
              </div>

              {selectedItem.Catatan && (
                <div className="text-[11px] text-slate-700">
                  <div className="text-slate-500 mb-0.5">Catatan</div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    {selectedItem.Catatan}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========= SMALL COMPONENT ========= */

type SummaryCardProps = {
  label: string;
  value: number;
  subtitle?: string;
};

const SummaryCard = ({ label, value, subtitle }: SummaryCardProps) => (
  <div className="bg-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm border border-slate-200">
    <div className="text-[11px] text-slate-500 mb-1">{label}</div>
    <div className="text-xl sm:text-2xl font-semibold text-teal-800 mb-1">
      {value}
    </div>
    {subtitle && <div className="text-[10px] text-slate-400">{subtitle}</div>}
  </div>
);

export default LabIPADashboard;
