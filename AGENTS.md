# AGENTS.md

## Nusantara Play — Tahap 1 (Foundation)

Dokumen ini adalah **konteks kerja (agent context)** untuk pengembangan **Nusantara Play Tahap 1**. Fokus tahap ini adalah **fondasi platform budaya**: arsip permainan rakyat, verifikasi resmi, event & komunitas, sertifikasi dasar, dan transparansi.

> **Catatan penting (perubahan kebijakan):**
>
> * **Publik TIDAK dapat submit usulan data budaya.**
> * **Input data hanya dilakukan oleh pihak resmi daerah (KPOTI Daerah / Kurator Daerah) dan diproses melalui verifikasi pakar.**

---

## 1. Tujuan Tahap 1

* Menghasilkan **arsip nasional permainan rakyat** yang rapi, terverifikasi, dan kredibel.
* Menyediakan **mekanisme resmi** input data oleh daerah.
* Mendokumentasikan **aksi komunitas & event** secara konsisten.
* Menyediakan **sertifikasi digital dasar** (non-Web3).
* Menampilkan **dashboard transparansi** program.

**Out of scope (Tahap 1):** Web3, wallet, token, DAO, marketplace.

---

## 2. Arsitektur Tingkat Tinggi

```
[ User (Daerah/Pakar/Admin) ]
            |
         Frontend
        (Next.js)
            |
        Backend API
        (NestJS)
            |
  ------------------------
  | PostgreSQL (Core DB) |
  | Object Storage (S3) |
  ------------------------
            |
        Supabase Auth
```

* **Satu platform**: Nusantara Play.
* **Auth managed**: Supabase Auth (Email + Google).
* **RBAC** (Role-Based Access Control) di backend.

---

## 3. Peran & Akses (RBAC)

### Peran

* **Admin KPOTI (Pusat)**: publish nasional, manajemen sistem.
* **Kurator Daerah (KPOTI Daerah)**: input & kurasi data budaya daerah.
* **Pakar**: verifikasi konten budaya.
* **Publik**: hanya baca (read-only).

### Aturan Akses

* Publik **read-only**.
* **Hanya Kurator Daerah** yang dapat **input & edit** data budaya.
* Pakar **verifikasi** (approve/reject/revise).
* Admin Pusat **publish** sebagai arsip nasional.

---

## 4. Modul Sistem (Tahap 1)

### 4.1 Auth & Identitas

* **Supabase Auth**: Email + Google.
* JWT untuk akses API.
* Role & izin disimpan di **DB aplikasi** (bukan di auth provider).

**Flow Login:**

```
User -> Supabase Auth -> JWT -> Frontend -> Backend (verify JWT)
```

---

### 4.2 Arsip Digital Budaya (Core)

**Kebijakan Input Data:**

* **Input hanya oleh Kurator Daerah.**
* Publik tidak memiliki fitur submit.

**Status Data (wajib):**

1. Draft (Daerah)
2. Dikurasi (Daerah)
3. Diverifikasi Pakar
4. Arsip Nasional Resmi

**Entitas Utama (ringkas):**

```
Permainan {
  id,
  nama_lokal,
  nama_nasional,
  daerah,
  deskripsi,
  aturan_main,
  alat,
  status
}
```

**Flow Arsip:**

```
Kurator Daerah input -> Kurasi -> Pakar verifikasi -> Admin publish
```

---

### 4.3 Verifikasi & Workflow Pakar

* Antrean verifikasi.
* Komentar & catatan pakar.
* Revisi terkontrol.
* **Audit log**: siapa, kapan, keputusan apa.

---

### 4.4 Event & Komunitas

* Kalender event (mis. Teras Bermain).
* Registrasi peserta.
* Check-in kehadiran.
* Dokumentasi kegiatan.

**Catatan:** Tanpa reward/token di Tahap 1.

---

### 4.5 Sertifikasi & Reputasi Dasar

* Sertifikat digital (PDF) untuk: Relawan, Pelatih, Fasilitator, Kontributor.
* QR code verifikasi publik.
* Berdasarkan **data aktivitas & keputusan admin**.

---

### 4.6 Dashboard Transparansi

**Publik:**

* Jumlah permainan terdata.
* Event berjalan.
* Partisipasi daerah.

**Internal:**

* Status verifikasi.
* Aktivitas daerah.
* Kinerja program.

---

## 5. Tech Stack (Tahap 1)

* **Frontend**: Next.js (React)
* **Backend**: NestJS (Node.js)
* **Database**: PostgreSQL
* **Storage**: S3-compatible Object Storage
* **Auth**: Supabase Auth
* **Infra**: Docker, Cloud VPS/Managed Cloud

---

## 6. Non-Goals & Guardrails

* Tidak ada Web3, wallet, token.
* Tidak ada marketplace.
* Tidak ada submit publik.
* Tidak ada microservices berlebihan.

---

## 7. Timeline & Deliverables (Ringkas)

* Bulan 1–2: Setup & desain
* Bulan 3–4: Arsip + Workflow verifikasi
* Bulan 5: Event & Sertifikasi
* Bulan 6: Dashboard & stabilisasi

---

## 8. Prinsip Desain

* **Cultural-first**, tech sebagai alat.
* **Official input only** untuk menjaga legitimasi.
* **Modular & siap scale** ke Tahap 2.

---

*End of document.*
