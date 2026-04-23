// src/LabIPALanding.tsx
import React, { useState } from "react";
const logo = "/logo-alkhairiyah.png";

const LabIPALanding: React.FC = () => {
  const [lang, setLang] = useState<"id" | "en">("en");
  const T = (id: string, en: string) => (lang === "id" ? id : en);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-teal-700 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* HEADER BAR */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/95 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <img
                src={logo}
                alt="Alkhairiyah Logo"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] tracking-[0.25em] uppercase text-emerald-100/90">
                {T("Portal Lab IPA", "Science Lab Portal")}
              </div>
              <div className="text-lg sm:text-xl font-semibold">
                Lab IPA Alkhairiyah
              </div>
              <div className="text-[11px] text-emerald-100/80">
                {T(
                  "SD 1, SD 2 & SMP • Sains & Praktikum",
                  "SD 1, SD 2 & SMP • Science & Laboratory Activities"
                )}
              </div>
            </div>
          </div>

          {/* TOP NAV */}
          <div className="flex items-center gap-3 text-[11px] sm:text-xs">
            <nav className="hidden sm:flex gap-2">
              <a
                href="#/sop"
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/20 transition-colors"
              >
                SOP
              </a>
              <a
                href="#/booking"
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 transition-colors"
              >
                {T("Booking Lab", "Booking")}
              </a>
              <a
                href="#/dashboard"
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/20 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="#/admin"
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/20 transition-colors"
              >
                Admin
              </a>
            </nav>

            {/* LANG SWITCH */}
            <div className="inline-flex items-center bg-white/5 rounded-full border border-white/20 p-1">
              <button
                onClick={() => setLang("id")}
                className={
                  "px-2.5 py-0.5 rounded-full text-[11px]" +
                  (lang === "id"
                    ? " bg-white text-emerald-900 font-semibold"
                    : " text-emerald-50")
                }
              >
                ID
              </button>
              <button
                onClick={() => setLang("en")}
                className={
                  "px-2.5 py-0.5 rounded-full text-[11px]" +
                  (lang === "en"
                    ? " bg-white text-emerald-900 font-semibold"
                    : " text-emerald-50")
                }
              >
                EN
              </button>
            </div>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1.4fr)] items-stretch">
          {/* LEFT SIDE */}
          <div className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight drop-shadow-sm">
                {T(
                  "Portal Digital Lab IPA Alkhairiyah",
                  "Digital Science Lab Management Platform"
                )}
              </h1>

              <div className="text-sm sm:text-base text-emerald-100/90 font-medium">
                {T(
                  "Lab IPA Alkhairiyah — SD 1, SD 2 & SMP",
                  "Lab IPA Alkhairiyah — SD 1, SD 2 & SMP"
                )}
              </div>

              <p className="flex items-center gap-2 text-[12px] sm:text-sm text-emerald-50/90 max-w-xl">
                <span className="text-lg sm:text-xl">🧪</span>
                <span>
                  {T(
                    "Platform terintegrasi kegiatan & manajemen Lab IPA.",
                    "Integrated platform for science lab operations and management."
                  )}
                </span>
              </p>

              <p className="text-[11px] sm:text-xs text-emerald-100/80 max-w-2xl">
                {T(
                  "Dirancang sebagai sistem operasional nyata untuk mendukung pengelolaan laboratorium sekolah.",
                  "Designed as a real operational system for school laboratory management."
                )}
              </p>
            </div>

            {/* BUTTONS */}
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="#/booking"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-300 text-emerald-950 text-sm font-semibold shadow-lg shadow-emerald-900/40 hover:bg-emerald-200 transition-colors"
              >
                <span>📝</span>
                <span>{T("Mulai Booking Lab", "Start Lab Booking")}</span>
              </a>

              <a
                href="#/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 text-emerald-50 text-[11px] sm:text-xs border border-white/30 hover:bg-white/15 transition-colors"
              >
                <span>📊</span>
                <span>{T("Lihat Dashboard Lab", "View Lab Dashboard")}</span>
              </a>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-emerald-50/90">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-300/40">
                <span>✅</span>
                <span>
                  {T(
                    "Cek jadwal & konflik otomatis",
                    "Automatic schedule conflict detection"
                  )}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-300/40">
                <span>🔐</span>
                <span>
                  {T(
                    "Gunakan kode akses guru",
                    "Access-controlled booking system"
                  )}
                </span>
              </span>
            </div>
          </div>

          {/* RIGHT SIDE CARD */}
          <div className="bg-emerald-50/95 text-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl shadow-emerald-900/40 border border-emerald-200">
            <h2 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-200 text-emerald-800 text-sm">
                ①
              </span>
              <span>
                {T(
                  "Langkah Cepat Booking Lab",
                  "Quick Lab Booking Steps"
                )}
              </span>
            </h2>

            <ol className="space-y-2 text-[12px] sm:text-[13px] text-slate-700">
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-600">1.</span>
                <span>
                  {T(
                    "Buka halaman Booking Lab & lihat jadwal kosong.",
                    "Open the booking page and check available schedule."
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-600">2.</span>
                <span>
                  {T(
                    "Pilih Lab SD 1 & SMP atau Lab SD 2.",
                    "Select lab (SD 1 & SMP or SD 2)."
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-600">3.</span>
                <span>
                  {T(
                    "Masukkan kode akses guru.",
                    "Enter the teacher access code."
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-emerald-600">4.</span>
                <span>
                  {T(
                    "Cek email / kalender untuk undangan otomatis.",
                    "Receive automatic confirmation via email/calendar."
                  )}
                </span>
              </li>
            </ol>

            <div className="mt-4 pt-3 border-t border-emerald-200 text-[11px] text-slate-600">
              💡{" "}
              {T(
                "Untuk SOP & ringkasan penggunaan lab, gunakan menu utama di bawah.",
                "For SOP and usage summary, use the main menu below."
              )}
            </div>
          </div>
        </section>

        {/* MENU UTAMA */}
        <section className="pb-6 sm:pb-10">
          <h2 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
            {T("Menu Utama", "Main Menu")}
          </h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* SOP */}
            <a
              href="#/sop"
              className="group bg-lime-50 rounded-2xl p-4 sm:p-5 shadow-lg border border-lime-200 hover:-translate-y-0.5 hover:shadow-xl transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-lime-200 text-lime-800 flex items-center justify-center text-lg">
                  📘
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    SOP Lab IPA
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {T(
                      "Panduan umum & tata tertib.",
                      "General guidelines and rules."
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700">
                {T(
                  "Acuan bersama guru & manajemen.",
                  "Shared reference for teachers and management."
                )}
              </p>
            </a>

            {/* BOOKING */}
            <a
              href="#/booking"
              className="group bg-emerald-50 rounded-2xl p-4 sm:p-5 shadow-lg border border-emerald-200 hover:-translate-y-0.5 hover:shadow-xl transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-200 text-emerald-800 flex items-center justify-center text-lg">
                  📅
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {T("Booking Lab IPA", "Lab Booking")}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {T(
                      "Form untuk menjadwalkan praktikum.",
                      "Form to schedule lab usage."
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700">
                {T(
                  "Guru SD 1, SD 2, dan SMP dapat memesan slot lab sendiri.",
                  "Teachers can book lab time for their classes."
                )}
              </p>
            </a>

            {/* DASHBOARD */}
            <a
              href="#/dashboard"
              className="group bg-sky-50 rounded-2xl p-4 sm:p-5 shadow-lg border border-sky-200 hover:-translate-y-0.5 hover:shadow-xl transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-sky-200 text-sky-800 flex items-center justify-center text-lg">
                  📊
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Dashboard Lab IPA
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {T(
                      "Ringkasan penggunaan lab per unit & per bulan.",
                      "Summary of lab usage per unit and per month."
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700">
                {T(
                  "Untuk akreditasi & monitoring.",
                  "For accreditation and monitoring."
                )}
              </p>
            </a>

            {/* ADMIN */}
            <a
              href="#/admin"
              className="group bg-rose-50 rounded-2xl p-4 sm:p-5 shadow-lg border border-rose-200 hover:-translate-y-0.5 hover:shadow-xl transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-rose-200 text-rose-800 flex items-center justify-center text-lg">
                  🛠️
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {T("Panel Admin", "Admin Panel")}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {T(
                      "Khusus manajemen & PJ Lab.",
                      "For management and Lab PIC only."
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-700">
                {T(
                  "Akses statistik, log-book & inventaris.",
                  "Access statistics, log-book, and inventory."
                )}
              </p>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LabIPALanding;