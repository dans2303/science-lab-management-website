import React, { useState } from "react";
const logo = "/logo-alkhairiyah.png";

const LabIPASOP: React.FC = () => {
  const [isEnglish, setIsEnglish] = useState(false);
  const T = (id: string, en: string) => (isEnglish ? en : id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-800 via-teal-700 to-emerald-500 text-white flex flex-col">
      {/* Decorative background shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-10 w-96 h-96 bg-teal-900/30 rounded-full blur-3xl" />
      </div>

      {/* Main container */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-8 sm:mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md shadow-emerald-900/30 flex items-center justify-center">
              <img
                src={logo}
                alt="Alkhairiyah Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-100">
                LAB IPA
              </div>
              <div className="text-lg sm:text-xl font-semibold text-white">
                Alkhairiyah Surabaya
              </div>
              <div className="text-[11px] text-emerald-100/90">
                {T("SD & SMP Terpadu", "Integrated Primary & Junior High")}
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
              >
                EN
              </button>
            </div>
            <a
              href="#/"
              className="text-[11px] text-emerald-100/90 hover:text-white underline underline-offset-2"
            >
              {T("← Kembali ke Beranda", "← Back to Home")}
            </a>
          </div>
        </header>

        <main className="space-y-8 sm:space-y-10 pb-10">
          {/* Title card */}
          <section className="bg-teal-900/60 rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl shadow-emerald-900/40 backdrop-blur-md">
            <h1 className="text-xl sm:text-2xl font-semibold mb-1">
              {T(
                "SOP Umum Penggunaan Laboratorium IPA",
                "General SOP for Science Lab Usage"
              )}
            </h1>
            <p className="text-[11px] sm:text-xs text-emerald-100/90 max-w-3xl">
              {T(
                "SOP ini disusun secara sederhana dan fleksibel sebagai panduan bersama bagi Bapak/Ibu Guru dan manajemen, agar penggunaan Lab IPA berlangsung dengan tertib, aman, dan nyaman.",
                "This SOP is simple and flexible — a shared guide for teachers and management so the Science Lab can be used in an orderly, safe, and comfortable way."
              )}
            </p>
          </section>

          {/* 1. Tujuan Umum */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "1. Tujuan Laboratorium IPA",
                "1. Purpose of the Science Lab"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "Mendukung pembelajaran sains yang aktif melalui kegiatan percobaan dan praktik.",
                  "Support science learning based on experiments and hands-on activities."
                )}
              </li>
              <li>
                {T(
                  "Menyediakan lingkungan belajar yang aman, tertib, dan terstruktur bagi peserta didik.",
                  "Provide a safe, orderly, and structured learning environment."
                )}
              </li>
              <li>
                {T(
                  "Mengatur penggunaan alat dan bahan agar dapat dimanfaatkan secara bergantian dan teratur antar kelas.",
                  "Ensure equipment and materials are used in an orderly way across classes."
                )}
              </li>
            </ul>
          </section>

          {/* 2. Panduan Singkat Sistem Booking */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "2. Panduan Singkat Sistem Booking Lab",
                "2. Quick Guide to the Lab Booking System"
              )}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              {/* Cara Booking */}
              <div className="border border-emerald-100 rounded-2xl p-3.5 bg-emerald-50/60">
                <h3 className="font-semibold mb-1.5">
                  {T("Cara Booking", "How to Book")}
                </h3>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    {T(
                      'Buka menu "Booking Lab" pada website Lab IPA.',
                      'Open the "Booking Lab" menu on the Lab IPA website.'
                    )}
                  </li>
                  <li>
                    {T(
                      "Pilih lab yang akan digunakan (Lab SD1 & SMP / Lab SD2).",
                      "Select which lab will be used (Lab SD1 & SMP / Lab SD2)."
                    )}
                  </li>
                  <li>
                    {T(
                      "Bapak/Ibu Guru mengisi form: nama, unit & kelas, tanggal, jam mulai–selesai, kegiatan/topik, serta alat–bahan yang dibutuhkan.",
                      "Fill the form: teacher name, unit & class, date, start–end time, activity/topic, and required tools/materials."
                    )}
                  </li>
                  <li>
                    {T(
                      "Masukkan kode akses yang diberikan oleh PJ Lab, kemudian kirim permohonan.",
                      "Enter the access code given by the Lab PIC, then submit."
                    )}
                  </li>
                </ol>
              </div>

              {/* Aturan Waktu */}
              <div className="border border-emerald-100 rounded-2xl p-3.5 bg-emerald-50/60">
                <h3 className="font-semibold mb-1.5">
                  {T("Aturan Waktu", "Time Rules")}
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {T(
                      "Idealnya permohonan penggunaan Lab dilakukan minimal H-7 sebelum praktikum, agar persiapan alat dan penjadwalan dapat berjalan lebih baik. Namun jika ada kebutuhan mendadak, Bapak/Ibu tetap dapat mengajukan selama slot waktu tersedia.",
                      "Ideally, lab bookings are submitted at least D-7 before the practical session, to allow proper preparation of tools and scheduling. However, for urgent needs, teachers may still submit bookings as long as the time slot is available."
                    )}
                  </li>
                  <li>
                    {T(
                      "Durasi mengikuti jam pelajaran. Jika membutuhkan waktu lebih panjang, mohon dicantumkan dengan jelas pada form.",
                      "Duration follows lesson periods; if longer, please state clearly in the form."
                    )}
                  </li>
                  <li>
                    {T(
                      "Jika ada perubahan jadwal, Bapak/Ibu Guru diharapkan menginformasikan kepada PJ Lab sebelum hari pelaksanaan.",
                      "If the schedule changes, the teacher informs the Lab PIC before the day of use."
                    )}
                  </li>
                </ul>
              </div>

              {/* Perbedaan Lab 1 & Lab 2 */}
              <div className="border border-emerald-100 rounded-2xl p-3.5 bg-emerald-50/60">
                <h3 className="font-semibold mb-1.5">
                  {T(
                    "Perbedaan Lab SD1 & SMP dan Lab SD2",
                    "Difference Between Lab SD1 & SMP and Lab SD2"
                  )}
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {T(
                      "Lab SD1 & SMP: digunakan bersama oleh SD1 dan SMP; jadwal relatif lebih padat sehingga koordinasi perlu lebih diperhatikan.",
                      "Lab SD1 & SMP: shared by SD1 and SMP; schedule is denser and requires tighter coordination."
                    )}
                  </li>
                  <li>
                    {T(
                      "Lab SD2: difokuskan untuk kegiatan praktikum siswa SD2.",
                      "Lab SD2: focused on practical activities for SD2 students."
                    )}
                  </li>
                  <li>
                    {T(
                      "Mohon memilih lab yang sesuai pada form agar jadwal dan log-book tercatat di kalender yang tepat.",
                      "Choose the correct lab in the form so the schedule and log book go to the correct calendar."
                    )}
                  </li>
                </ul>
              </div>

              {/* Panduan Admin / Logbook */}
              <div className="border border-emerald-100 rounded-2xl p-3.5 bg-emerald-50/60">
                <h3 className="font-semibold mb-1.5">
                  {T(
                    "Panduan Admin & Log-book",
                    "Admin & Log Book Guide"
                  )}
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {T(
                      'PJ Lab/Admin membuka menu "Admin / Log-book" pada website.',
                      'Admin/Lab PIC opens the "Admin / Log Book" menu on the website.'
                    )}
                  </li>
                  <li>
                    {T(
                      "Log-book digital menampilkan ringkasan penggunaan lab per periode (tanggal, guru, kelas, kegiatan).",
                      "The digital log book shows a summary of lab usage by period (date, teacher, class, activity)."
                    )}
                  </li>
                  <li>
                    {T(
                      "PJ Lab/Admin dapat mencetak ringkasan log-book bulanan/semester untuk kebutuhan laporan dan akreditasi.",
                      "Admin can print monthly/semester log book summaries for reporting and accreditation."
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Alur Penggunaan (Sederhana) */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "3. Alur Penggunaan Lab (Sederhana)",
                "3. Simple Lab Usage Flow"
              )}
            </h2>
            <ol className="list-decimal pl-5 text-xs space-y-2">
              <li>
                <strong>
                  {T("Cek jadwal lab", "Check the lab schedule")}
                </strong>{" "}
                –{" "}
                {T(
                  "Bapak/Ibu Guru memeriksa ketersediaan jadwal melalui website Lab IPA.",
                  "The teacher checks schedule availability through the Lab IPA website."
                )}
              </li>
              <li>
                <strong>{T("Isi form booking", "Fill the Booking Form")}</strong>{" "}
                –{" "}
                {T(
                  "Bapak/Ibu Guru mengisi nama, unit & kelas, tanggal, jam, kegiatan/topik, serta alat dan bahan yang dibutuhkan.",
                  "The teacher fills in name, unit & class, date, time, activity/topic, and required tools and materials."
                )}
              </li>
              <li>
                <strong>{T("Masukkan kode akses", "Enter the access code")}</strong>{" "}
                –{" "}
                {T(
                  "Bapak/Ibu Guru memasukkan kode akses yang diberikan oleh PJ Lab. Dengan kode yang benar, permohonan penggunaan lab akan tercatat di sistem.",
                  "The teacher enters the access code provided by the Lab PIC. With the correct code, the booking will be saved in the system."
                )}
              </li>
              <li>
                <strong>{T("Menunggu konfirmasi", "Wait for confirmation")}</strong>{" "}
                –{" "}
                {T(
                  "PJ Lab mengecek jadwal dan ketersediaan alat, kemudian menyetujui atau menyesuaikan booking jika diperlukan.",
                  "The Lab PIC checks the schedule and equipment availability, then approves or adjusts the booking if needed."
                )}
              </li>
              <li>
                <strong>{T("Pelaksanaan praktikum", "Conduct the practical")}</strong>{" "}
                –{" "}
                {T(
                  "Jika telah disetujui, Bapak/Ibu Guru menggunakan lab sesuai jadwal yang tercatat pada sistem.",
                  "If approved, the teacher uses the lab according to the schedule recorded in the system."
                )}
              </li>
            </ol>
          </section>

          {/* 4. Tanggung Jawab Guru IPA */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "4. Tanggung Jawab Guru IPA",
                "4. Responsibilities of Science Teachers"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "Mengawasi peserta didik selama berada di dalam laboratorium.",
                  "Supervise students at all times while they are in the lab."
                )}
              </li>
              <li>
                {T(
                  "Menjelaskan aturan dasar lab dan langkah kerja sebelum praktikum dimulai.",
                  "Explain basic lab rules and procedures before the practical begins."
                )}
              </li>
              <li>
                {T(
                  "Memastikan alat dan bahan digunakan sesuai instruksi dan dengan hati-hati.",
                  "Ensure tools and materials are used carefully and according to instructions."
                )}
              </li>
              <li>
                {T(
                  "Membantu mengarahkan peserta didik untuk merapikan dan mengembalikan alat-bahan ke tempat semula setelah selesai digunakan.",
                  "Guide students to tidy up and return tools and materials to their original place after use."
                )}
              </li>
              <li>
                {T(
                  "Melaporkan kepada PJ Lab apabila terdapat kerusakan, kehilangan, atau kekurangan alat.",
                  "Report any damage, loss, or shortage of equipment to the Lab PIC."
                )}
              </li>
            </ul>
          </section>

          {/* 5. Peran PJ Lab / Admin */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "5. Peran PJ Lab / Admin",
                "5. Role of Lab PIC / Admin"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "Mengelola kode akses dan membagikannya kepada Bapak/Ibu Guru yang berwenang menggunakan lab.",
                  "Manage access codes and share them only with authorized teachers."
                )}
              </li>
              <li>
                {T(
                  "Meninjau jadwal booking dan membantu mencegah benturan jadwal antar kelas atau antar lab.",
                  "Check booking schedules and prevent schedule clashes between classes/labs."
                )}
              </li>
              <li>
                {T(
                  "Memastikan alat dan bahan utama siap sebelum praktikum dimulai sejauh kondisi memungkinkan.",
                  "Ensure key tools and materials are ready before the practical begins."
                )}
              </li>
              <li>
                {T(
                  "Memantau log-book digital dan mencetak ringkasan jika diperlukan untuk kebutuhan laporan dan akreditasi.",
                  "Monitor the digital log book and print summaries when needed for reporting/accreditation."
                )}
              </li>
              <li>
                {T(
                  "Berkoordinasi dengan manajemen terkait pengadaan atau perbaikan alat yang diperlukan.",
                  "Coordinate with management for equipment procurement or repair."
                )}
              </li>
            </ul>
          </section>

          {/* 6. Aturan Dasar untuk Siswa */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "6. Aturan Dasar untuk Siswa",
                "6. Basic Rules for Students"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "Masuk dan keluar lab dengan tertib, tidak berlari atau mendorong teman demi keselamatan bersama.",
                  "Enter and exit the lab calmly; no running or pushing."
                )}
              </li>
              <li>
                {T(
                  "Siswa diharapkan tidak menyentuh alat atau bahan tanpa izin dan pendampingan dari guru.",
                  "Do not touch any tools or materials without the teacher’s permission."
                )}
              </li>
              <li>
                {T(
                  "Demi keamanan dan kebersihan, siswa tidak makan dan minum di dalam laboratorium.",
                  "Do not eat or drink inside the laboratory."
                )}
              </li>
              <li>
                {T(
                  "Menggunakan alat sesuai arahan guru dan tidak bermain-main di area praktikum.",
                  "Use equipment according to the teacher’s instructions and do not play in the lab area."
                )}
              </li>
              <li>
                {T(
                  "Segera memberitahukan kepada guru atau PJ Lab jika terjadi tumpahan, pecah, atau insiden lain.",
                  "Immediately report any spills, breakages, or other incidents."
                )}
              </li>
            </ul>
          </section>

          {/* 7. Log Book Penggunaan */}
          <section className="bg-white/95 rounded-3xl p-5 sm:px-6 p-5 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "7. Log Book Penggunaan Lab",
                "7. Lab Usage Log Book"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "Setiap sesi penggunaan lab akan tercatat secara otomatis dalam sistem booking (log-book digital).",
                  "Every lab session is automatically recorded in the booking system (digital log book)."
                )}
              </li>
              <li>
                {T(
                  "Jika diperlukan, PJ Lab/Admin dapat mencetak log-book per bulan atau per semester melalui panel admin.",
                  "If needed, the Lab PIC can print the log book monthly or per semester through the admin panel."
                )}
              </li>
              <li>
                {T(
                  "Tanda tangan log-book dilakukan oleh PJ Lab sebagai penanggung jawab utama laboratorium.",
                  "The log book is signed by the Lab PIC as the main person in charge of the laboratory."
                )}
              </li>
              <li>
                {T(
                  "Catatan kerusakan alat dicantumkan pada log dan diteruskan kepada pihak terkait apabila diperlukan pengadaan atau perbaikan.",
                  "Equipment damage is recorded in the log and forwarded to the relevant parties if procurement/repair is needed."
                )}
              </li>
            </ul>
          </section>

          {/* 8. Fleksibilitas & Penyesuaian */}
          <section className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm text-slate-800">
            <h2 className="text-lg font-semibold mb-3">
              {T(
                "8. Fleksibilitas & Penyesuaian SOP",
                "8. SOP Flexibility & Adjustments"
              )}
            </h2>
            <ul className="list-disc pl-5 text-xs space-y-1.5">
              <li>
                {T(
                  "SOP ini bersifat umum dan tidak kaku; dapat disesuaikan seiring perkembangan Lab IPA dan kebutuhan sekolah.",
                  "This SOP is general and not rigid; it can be adjusted based on the development of the Science Lab and school needs."
                )}
              </li>
              <li>
                {T(
                  "Perubahan dilakukan melalui diskusi bersama antara guru IPA, PJ Lab, dan manajemen sekolah.",
                  "Changes can be made after discussions with science teachers, the Lab PIC, and school management."
                )}
              </li>
              <li>
                {T(
                  "Detail teknis (jam operasional, jenis praktikum, pembagian jadwal SD–SMP) mengikuti kebijakan sekolah yang berlaku.",
                  "Technical details (operational hours, types of practicum, and SD–SMP schedule division) follow school policies."
                )}
              </li>
            </ul>
          </section>

          <p className="text-[10px] sm:text-xs text-emerald-100/90 text-center mt-4 mb-2">
            {T(
              "Draft SOP ini menjadi dasar bersama. Jika di lapangan ada kebiasaan yang dirasa lebih efektif, SOP dapat disesuaikan agar tetap membantu, bukan membebani.",
              "This SOP draft serves as a shared foundation. If certain practices in the field work better, the SOP can be adjusted so it helps rather than burdens."
            )}
          </p>
        </main>
      </div>
    </div>
  );
};

export default LabIPASOP;
