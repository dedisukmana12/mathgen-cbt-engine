# MathGen CBT

Generator soal matematika berbasis konteks akademik yang mengatur jenjang, materi, kurikulum, bentuk soal, dan tingkat kesulitan.

## Cakupan saat ini

Entry point aplikasi berada di `src/App.tsx`. Lihat kode sumber untuk mengetahui alur yang tersedia.

## Teknologi

- **Frontend:** React, TypeScript, dan Vite.
- **Antarmuka:** Tailwind CSS, Lucide React, Motion.
- **Backend:** Node.js dan Express.
- **AI:** Google GenAI SDK.
- **Data dan integrasi:** SQLite.

## Menjalankan secara lokal

### Prasyarat

- Node.js dan npm.

### Instalasi dan pengembangan

Jalankan perintah berikut dari folder proyek:

```powershell
npm install
npm run dev
```

Bila fitur memerlukan variabel lingkungan, gunakan nama variabel pada tabel berikut dan isi nilainya hanya di lingkungan lokal atau secret manager deployment. Jangan commit file `.env`.

| Variabel | Kegunaan |
|---|---|
| `GEMINI_API_KEY` | API key untuk fitur Gemini yang dipanggil server. Simpan sebagai environment variable atau secret deployment dan jangan commit nilainya. |

Template `.env.example` mendokumentasikan nama konfigurasi yang dikenali proyek. Isi konfigurasi melalui lingkungan runtime yang sesuai; jangan menaruh secret di kode frontend atau repository.

## Backend dan API

Proyek menyertakan server Node.js. Rute API berikut terdaftar pada implementasi server:

| Metode | Rute |
|---|---|
| `POST` | `/api/questions/explain` |
| `POST` | `/api/questions/generate` |

## Build dan pemeriksaan

- Build: `npm run build` (`vite build`).
- Pemeriksaan TypeScript: `npm run lint` (`tsc --noEmit`).
- Menjalankan script start: `npm start` (`tsx server.ts`).
- Preview hasil build: `npm run preview` (`vite preview`).

## Lisensi

Lisensi repositori belum ditetapkan. Tambahkan berkas `LICENSE` sebelum memberikan izin penggunaan ulang.

---

Dokumentasi ini menjelaskan implementasi yang ditemukan pada kode sumber proyek. Periksa kembali konfigurasi dan perilaku aplikasi sebelum deployment.
