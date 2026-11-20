# Panduan Input PROT

Panduan ini untuk kontributor, kurator daerah, pakar dan admin yang mengisi atau memeriksa data PROT (Permainan Rakyat dan
Olahraga Tradisional) di situs Nusantara Legacy. Semua yang tertulis di sini diambil dari cara kerja aplikasi saat ini
(November 2026, Phase 26). Bagian "Belum tersedia" menyebut hal yang belum bisa dilakukan aplikasi. Hal yang
ditandai **"berlaku setelah deploy backend"** baru bekerja setelah pembaruan server dipasang (lihat bagian 10).

Prinsip utama: **setiap data yang terbit bisa dilihat siapa saja di internet.** Periksa setiap tulisan, foto dan dokumen
sebelum diajukan dan sebelum disetujui.

---

## 1. Peran (role)

| Peran | Yang bisa dilakukan |
|---|---|
| `publik` | Hanya melihat PROT yang sudah terbit (status ARSIP_NASIONAL). Peran awal setiap akun baru. |
| `kurator_daerah` | Membuat PROT, mengedit PROT miliknya sendiri (saat DRAFT atau REVISI), mengajukan verifikasi, dan memeriksa (verifikasi) PROT **dari provinsinya sendiri** di antrean verifikasi. |
| `pakar` | Membuat PROT (hanya di provinsi yang tercatat di profilnya), dan memeriksa PROT dari semua provinsi di antrean verifikasi. |
| `admin_kpoti` | Semua hal di atas, mengedit PROT siapa pun (saat DRAFT atau REVISI), menerbitkan ke Arsip Nasional, menghapus PROT, mengatur peran pengguna. Setelah pembaruan server (lihat bagian 9): menghapus satu foto/dokumen/tautan dari PROT berstatus apa pun dan mengembalikan PROT yang sudah terbit ke REVISI. |

Peran diatur oleh admin di halaman admin pengguna. Seorang `pakar` atau `kurator_daerah` harus punya data daerah di
profilnya; tanpa itu sebagian tombol menolak dengan pesan "belum memiliki data daerah".

---

## 2. Alur dari membuat PROT sampai terbit

```
DRAFT ──(Ajukan Verifikasi)──> DIKURASI ──(pemeriksa: Setujui)──> DIVERIFIKASI ──(admin: Publish)──> ARSIP_NASIONAL
  ^                               │                                                                    (terbit)
  └──────(pemeriksa: Tolak)───────┤
                                  └──(pemeriksa: Perlu revisi)──> REVISI ──(diajukan ulang)──> DIKURASI
```

1. **Membuat (DRAFT).** Kontributor membuka "Tambah PROT" (`/prot/create`), mengisi formulir, mengunggah foto/video/
   dokumen, lalu menyimpan. Status menjadi DRAFT. Hanya pembuat dan admin yang bisa melihatnya.
2. **Mengedit.** Selama DRAFT atau REVISI, pembuat (atau admin) bisa membuka tombol "Edit" di halaman PROT. Di status
   lain tombol Edit tidak muncul dan server menolak perubahan, termasuk menambah atau menghapus foto dan dokumen.
3. **Mengajukan verifikasi (DIKURASI).** Pembuat menekan "Ajukan Verifikasi" di halaman PROT. Hanya **pembuat** PROT
   yang melihat tombol ini (server menolak admin yang bukan pembuat). Sebuah jendela terbuka:
   - **Daftar periksa** lima poin (teks lengkap, foto menampilkan permainan ini, tanpa data pribadi, tanpa wajah anak
     tanpa izin, tautan pembelian benar). Tombol "Ajukan" baru aktif setelah semua poin dicentang. Centangan tidak
     disimpan; ini pengingat.
   - **Catatan untuk pemeriksa** (tidak wajib, maksimal 500 karakter). Jika kosong, terkirim "Diajukan oleh pengguna".
     Catatan tersimpan di antrean dan terlihat oleh pemeriksa **setelah deploy backend** (sebelumnya server menerima
     tetapi tidak menyimpannya).

   PROT masuk ke **antrean verifikasi** dan tidak bisa diedit lagi.
4. **Memeriksa (antrean verifikasi, `/prot/verifikasi/queue`).** Pemeriksa (pakar, admin, atau kurator daerah untuk
   provinsinya sendiri) **mengambil** satu PROT dari antrean ("pick"). Setelah diambil, hanya pemeriksa itu yang bisa
   memutuskan; ia juga bisa melepaskannya kembali ("release"). Keputusan:
   - **Setujui** → DIVERIFIKASI.
   - **Perlu revisi** → REVISI. Kolom "saran perbaikan" **wajib** diisi. Pembuat melihat saran ini di kotak kuning
     "Perlu revisi: catatan kurator" di halaman PROT dan halaman Edit.
   - **Tolak** → kembali ke DRAFT.
   Catatan pemeriksa tersimpan di riwayat verifikasi (halaman "History" PROT). Setelah keputusan, PROT keluar dari antrean.
5. **Menerbitkan (ARSIP_NASIONAL).** Admin menekan "Publish" di halaman PROT berstatus DIVERIFIKASI (atau di halaman
   admin "Publish"). Sejak saat itu PROT tampil untuk semua orang (lihat bagian 4).

6. **Mengajukan ulang setelah REVISI.** Pembuat memperbaiki lewat "Edit", lalu menekan **"Ajukan Ulang"** di halaman
   PROT (jendela yang sama: daftar periksa dan catatan). Situs memakai rute pengajuan ulang, jadi PROT REVISI kembali
   ke antrean (sejak Phase 26; sebelumnya tombol ini gagal). Catatan untuk pengajuan ulang bisa ditulis **setelah deploy
   backend**; sampai saat itu kolomnya nonaktif dan perbaikan dijelaskan di isian yang bersangkutan.

### Aturan: tidak memeriksa PROT buatan sendiri

- **Sekarang (server lama):** halaman pemeriksaan dan tombol "Publish" menampilkan **peringatan merah** jika Anda
  pembuat PROT itu. Server belum menolaknya, jadi ikuti peringatan itu: minta pemeriksa atau admin lain.
- **Berlaku setelah deploy backend:** server menolak pemeriksa (pakar, kurator daerah) yang mengambil, memutuskan atau
  menerbitkan PROT buatannya sendiri. **Admin** boleh mengambilnya, tetapi keputusan dan "Publish" hanya bisa dengan
  **alasan tertulis** (10 sampai 500 karakter, tanpa data pribadi). Alasan dicatat di log audit
  (`PROT_SELF_REVIEW_OVERRIDE`) sebelum keputusan disimpan.
- Tidak ada waktu minimum pemeriksaan. Ikuti daftar periksa di bagian 7 dan 8.

---

## 3. Isian formulir

Batas di bawah ini adalah batas yang diperiksa aplikasi. "Wajib" = formulir tidak bisa disimpan tanpanya.

### Tahap 01: Identitas

| Isian | Wajib? | Batas | Dipakai di situs |
|---|---|---|---|
| Nama permainan | Wajib | Minimal 3 karakter | Judul di semua tempat: daftar `/prot`, halaman PROT, kartu di beranda, papan stan di desa Jelajah, film pengenalan (nama-nama arsip). Ditandai "Disarankan untuk Jelajah". |
| Jenis | Wajib | Permainan Rakyat / Olahraga Tradisional | Label di kartu dan halaman PROT. |
| Target usia | Wajib | Anak-anak / Remaja / Dewasa / Semua Usia | Halaman PROT dan kartu `/prot`. |
| Jumlah pemain (baru, Phase 26) | Tidak | Angka bulat, minimal 1. Kosongkan jika tidak tentu. | Halaman PROT, "Informasi Dasar". |

### Tahap 02: Geografi budaya

| Isian | Wajib? | Batas | Dipakai di situs |
|---|---|---|---|
| Provinsi, Kabupaten/Kota | Wajib di formulir | Dipilih dari daftar daerah resmi | **Provinsi menentukan di mana PROT muncul di peta Jelajah** dan di desa provinsi itu; dihitung di statistik beranda. Kabupaten/kota tampil di kartu dan halaman PROT. Pakar hanya bisa memilih provinsinya sendiri. |
| Kecamatan, Desa | Tidak | Harus cocok dengan kabupaten di atasnya | Halaman PROT (saat ini sebagai kode). |
| Detail lokasi spesifik (alamat) | Tidak | - | Halaman PROT, "Alamat Lengkap". **Tulis nama tempat umum (desa, sanggar, lapangan), jangan alamat rumah pribadi.** |

### Tahap 03: Narasi

| Isian | Wajib? | Batas | Dipakai di situs |
|---|---|---|---|
| Deskripsi singkat (baru, Phase 26) | Tidak (disarankan) | Server tidak membatasi panjang. Penghitung karakter menunjukkan berapa yang muat di panel Jelajah (sekitar 280 karakter pertama). | **Panel stan desa Jelajah** (sekitar 280 karakter pertama) dan halaman PROT ("Ringkasan"). Tulis 1 sampai 3 kalimat yang menjelaskan permainannya. Ditandai "Disarankan untuk Jelajah". |
| Sejarah / Asal usul | Tidak | Tidak ada batas | Halaman PROT, "Status Asal Usul". |
| Cara bermain | Tidak (tetapi lihat bagian 5) | Tidak ada batas | Halaman PROT (lengkap). Panel stan Jelajah (dipotong sekitar 420 karakter). Kartu beranda jika nilai moral kosong (3 baris). **Dasar untuk membuat game di situs**: tanpa langkah-langkah permainan yang lengkap, game tidak bisa dibuat. |
| Nilai moral & karakter | Tidak | Tidak ada batas | Halaman PROT; ringkasan di kartu beranda (3 baris). |

Tulis setiap isian dengan teksnya sendiri. Jangan menyalin paragraf yang sama ke beberapa isian.

### Tahap 04: Peralatan (boleh lebih dari satu)

| Isian | Wajib? | Batas | Dipakai di situs |
|---|---|---|---|
| Nama alat | Wajib per alat | - | Halaman PROT, kotak "Peralatan yang Dibutuhkan". |
| Kisaran harga | Tidak | Teks bebas | Ditampilkan sebagai "Rp …". |
| Deskripsi | Tidak | - | Halaman PROT. |
| Foto alat | Tidak | JPG, PNG, WEBP; maksimal 10 MB per file, 10 file per simpan | Foto pertama sebagai gambar kecil, sisanya di bawahnya. |
| URL pembelian | Tidak | Teks | Tautan "Beli di:" yang bisa diklik pengunjung. |

### Tahap 05: Media

| Isian | Wajib? | Batas | Dipakai di situs |
|---|---|---|---|
| Foto kegiatan | Tidak (tetapi lihat bagian 5) | JPG, PNG, WEBP; maksimal 10 MB per file, 10 file per simpan | **Foto pertama** dipakai di: kartu `/prot`, kartu beranda, panel stan dan kartu 2D Jelajah, kartu provinsi di peta, dan strip foto di intro Jelajah (bumper). Semua foto tampil di galeri halaman PROT. Ditandai "Disarankan untuk Jelajah". |
| Video kegiatan | Tidak | MP4 atau MOV; maksimal 50 MB per file, 10 file per simpan | Pemutar video di halaman PROT. |
| Dokumen kurikulum / panduan | Tidak | **Hanya PDF** (dokumen Word: simpan dulu sebagai PDF); maksimal 20 MB per file, 10 file per simpan | **Sejak Phase 25 tidak ditampilkan ke publik**; hanya pengguna dengan peran kurator daerah, pakar atau admin yang melihat tautannya di halaman PROT. |

Sejak Phase 26 formulir memeriksa setiap file sebelum disimpan: file dengan jenis atau ukuran yang salah tidak
ditambahkan, dan alasannya tampil dalam bahasa Indonesia di bawah kotak unggah. Server sendiri menerima sampai 100 MB
per file; batas formulir lebih kecil karena unggahan besar lewat situs belum teruji.

Isian yang ditandai **"Disarankan untuk Jelajah"** (nama, provinsi dan kabupaten/kota, deskripsi singkat, cara
bermain, nilai moral, foto kegiatan) membuat PROT tampil baik di peta dan desa Jelajah.

Setiap file yang diunggah langsung tersimpan di penyimpanan publik (siapa pun yang tahu alamatnya bisa membukanya), **juga
saat PROT masih DRAFT**. Jangan pernah mengunggah file yang tidak boleh dilihat publik.

---

## 4. Di mana PROT yang terbit tampil

Hanya PROT berstatus **ARSIP_NASIONAL** yang tampil untuk publik:

- **Daftar `/prot` dan halaman PROT `/prot/<id>`**: semua isian di atas (dokumen hanya untuk peran pemeriksa).
- **Beranda**: statistik (jumlah PROT terbit dan jumlah provinsinya) dan 4 kartu PROT (foto pertama, nama, jenis,
  kabupaten/kota + provinsi, nilai moral atau cara bermain).
- **Peta Jelajah `/jelajah`** (perlu masuk akun): setiap provinsi yang punya minimal satu PROT terbit diberi warna dan
  bisa diklik; kartunya menampilkan jumlah PROT dan sampai 6 nama dengan foto pertama.
- **Desa Jelajah** (`/jelajah/<provinsi>`): setiap PROT terbit provinsi itu mendapat satu **stan** (urut abjad nama). Panel
  stan menampilkan nama, foto pertama, deskripsi singkat, cara bermain (dipotong) dan tautan ke halaman lengkap. Jika PROT
  lebih banyak dari jumlah stan, stan terakhir menjadi papan pengumuman berisi sisanya.
- **Intro Jelajah (bumper)**: jumlah PROT terbit dan sampai 4 foto (foto pertama, satu per provinsi dulu).
- **Film pengenalan Jelajah**: nama-nama PROT terbit dan jumlahnya (tanpa foto).
- **Game di `/main`**: dibuat oleh pengembang berdasarkan "cara bermain" PROT terbit tertentu (Gasing, Egrang Bambu,
  Egrang Batok), dan menautkan kembali ke halaman PROT itu.

### Supaya tampil bagus di Jelajah

Minimal per PROT:
- Nama yang jelas, provinsi dan kabupaten/kota terisi.
- **Minimal satu foto kegiatan yang baik sebagai foto pertama** (foto pertama dipakai di mana-mana).
- Cara bermain yang lengkap: jumlah pemain, alat, area, langkah-langkah berurutan, cara menang dan kalah. Kalimat pertama
  sebaiknya sudah menjelaskan permainannya (panel stan hanya menampilkan sekitar 420 karakter pertama).
- Nilai moral dengan teksnya sendiri.

Tips foto:
- **Mendatar (landscape)**, cahaya terang, subjek di tengah; kartu memotong foto menjadi bentuk lebar atau persegi.
- **Foto harus menampilkan permainan INI** (atau alat permainan ini). Jangan memakai foto permainan lain, gambar
  ilustrasi yang tidak terkait, atau foto dari internet tanpa izin.
- **Tanpa wajah anak yang dikenali kecuali ada izin tertulis orang tua/wali**. Lebih baik foto dari belakang, dari jauh,
  atau fokus pada tangan dan alat.
- Tanpa watermark, tanpa tulisan promosi toko ("promo", "gratis ongkir"), tanpa logo pihak lain.
- Tanpa data pribadi yang terbaca (nomor rumah, pelat kendaraan, papan nama, dokumen).

### Bagaimana sebuah provinsi bisa "dimasuki" (desa Jelajah)

- Provinsi muncul **di peta** (berwarna, bisa diklik, dengan jumlah PROT) begitu ada **minimal satu PROT terbit** dengan
  provinsi itu. Ini otomatis.
- **Desa yang bisa dijelajahi** untuk sebuah provinsi dibuat oleh **pengembang** (satu file desain desa per provinsi).
  Saat ini ada lima: Sumatera Selatan, Aceh, Kepulauan Riau, Jawa Tengah dan Sulawesi Selatan. Untuk provinsi baru,
  terbitkan dulu minimal satu PROT yang bagus, lalu minta pengembang membuat desanya.
- Stan di desa terisi otomatis dari PROT terbit provinsi itu; tidak ada yang perlu diatur.

---

## 5. Memperbaiki atau menarik kembali PROT

- **Sebelum terbit (DRAFT atau REVISI)**: pembuat atau admin membuka "Edit", mengubah isian, menghapus atau menambah
  foto/dokumen, lalu mengajukan lagi.
- **Saat DIKURASI**: tidak bisa diedit. Pemeriksa memilih "Perlu revisi" dengan saran perbaikan, maka PROT kembali ke
  REVISI dan bisa diedit pembuatnya.
- **Sesudah terbit (ARSIP_NASIONAL)**: saat ini **tidak bisa** diubah lewat situs, dan foto/dokumen tidak bisa dihapus.
  Setelah pembaruan server Phase 25 dipasang, admin bisa (lihat bagian 9):
  - menghapus satu foto, video, dokumen atau tautan pembelian dari PROT berstatus apa pun; atau
  - mengembalikan PROT yang sudah terbit (atau DIVERIFIKASI) ke **REVISI**, sehingga langsung hilang dari tampilan publik
    dan pembuatnya bisa memperbaikinya.
- **Menghapus seluruh PROT**: hanya admin (tombol "Hapus" di halaman PROT). Ini permanen.

---

## 6. Hal yang tidak boleh ada di PROT

- **Data pribadi**: nomor KTP/NIK, nomor telepon, alamat email, alamat rumah, tanggal lahir, tanda tangan, foto dokumen
  identitas, daftar nama orang dengan data mereka.
- **Wajah anak yang dikenali tanpa izin tertulis orang tua/wali.**
- File yang tidak terkait permainan (surat tugas, sertifikat, dokumen kantor, gambar acak).
- Tautan pembelian ke produk yang bukan alat permainan ini.
- Teks atau foto yang disalin dari sumber lain tanpa izin.

---

## 7. Daftar periksa kontributor (setiap PROT)

Sebelum menekan "Ajukan Verifikasi":

- [ ] Nama, jenis, target usia, provinsi dan kabupaten/kota benar.
- [ ] Alamat/lokasi adalah tempat umum, bukan rumah pribadi.
- [ ] Cara bermain lengkap dan selesai (tidak terpotong): jumlah pemain, alat, area, langkah berurutan, cara menang/kalah.
- [ ] Sejarah dan nilai moral ditulis masing-masing, tidak menyalin paragraf yang sama.
- [ ] Foto pertama adalah foto terbaik, mendatar, terang, dan menampilkan permainan ini.
- [ ] Setiap foto sudah saya buka dan memang tentang permainan ini; tidak ada wajah anak tanpa izin; tidak ada watermark atau promosi.
- [ ] Setiap foto alat menampilkan alat itu.
- [ ] Setiap tautan pembelian sudah saya buka: toko yang wajar dan produk yang benar adalah alat permainan ini.
- [ ] Setiap dokumen sudah saya buka sampai halaman terakhir: isinya tentang permainan ini dan **tidak berisi data pribadi**.
- [ ] Video sudah saya tonton: tentang permainan ini, tanpa wajah anak tanpa izin.

Lima poin terpenting dari daftar ini juga muncul sebagai daftar centang di jendela "Ajukan Verifikasi" / "Ajukan Ulang".

## 8. Daftar periksa pemeriksa / kurator (setiap PROT di antrean)

Jangan memeriksa PROT buatan sendiri (bagian 2, "Aturan"). Sediakan waktu: memeriksa satu PROT dengan benar butuh lebih
dari beberapa menit.

Sejak Phase 26 halaman pemeriksaan (`/prot/verifikasi/<id>/review`) menampilkan **semua isi** PROT: setiap teks lengkap,
setiap foto kegiatan dan foto alat (klik untuk ukuran penuh), setiap video, nama setiap dokumen dengan tautan "Buka /
unduh", dan setiap tautan pembelian dengan **nama domainnya** (tautan tanpa https atau tidak valid ditandai). File yang
ada di daftar sembunyi tampil sebagai kotak "Disembunyikan"; jangan setujui sebelum file itu dihapus atau diganti.

- [ ] **Baca setiap teks sampai akhir** (sejarah, cara bermain, nilai moral, alamat, deskripsi alat). Teks yang terpotong atau disalin berulang → "Perlu revisi".
- [ ] Cara bermain cukup lengkap untuk dimainkan orang yang belum mengenal permainannya.
- [ ] **Buka setiap foto** dalam ukuran penuh. Setiap foto cocok dengan permainan ini? Ada wajah anak yang dikenali? Ada data pribadi yang terbaca?
- [ ] **Buka setiap foto alat**: menampilkan alat yang disebut?
- [ ] **Buka setiap tautan pembelian**: domain toko yang wajar, nama produk sesuai alat.
- [ ] **Buka setiap dokumen sampai halaman terakhir**. **Jangan pernah menyetujui dokumen yang berisi data pribadi**
      (NIK/KTP, telepon, email, alamat, tanda tangan, daftar peserta) atau yang tidak terkait permainan.
- [ ] Tonton setiap video.
- [ ] Jika ada satu saja masalah: pilih "Perlu revisi" dan tulis di "saran perbaikan" isian dan file mana yang harus
      diganti (sebutkan jenis masalahnya, jangan menyalin data pribadinya).
- [ ] Admin, sebelum "Publish": buka halaman PROT sekali lagi dan ulangi pemeriksaan foto, tautan dan dokumen.

---

## 9. Darurat: data pribadi atau file salah sudah terbit

### Yang bisa dilakukan HARI INI

1. **Laporkan** ke admin dan pengembang: alamat halaman PROT (`/prot/<id>`), isian mana (misalnya "dokumen kurikulum
   ke-1" atau "foto alat 'Biji Pinang'") dan jenis masalahnya. **Jangan** menyalin data pribadinya ke chat atau email.
2. **Pengembang menyembunyikan file di situs** dengan menambahkan alamat file ke daftar sembunyi
   `nusantara-play-fe/lib/prot/hidden-media.ts` (alamat persis, alasan tanpa data pribadi), lalu menggabungkan perubahan
   ke cabang utama; Vercel menerbitkannya dalam beberapa menit. File itu lalu hilang dari semua halaman situs (halaman
   PROT, kartu, Jelajah, intro). Satu isian utuh sebuah PROT (misalnya semua tautan pembelian satu alat) juga bisa
   disembunyikan di file yang sama.
3. **Penting:** cara ini hanya menyembunyikan tampilan. File **masih ada** di penyimpanan publik dan alamatnya masih ada
   di data API sampai admin menghapusnya di server (langkah berikut).

### Yang bisa dilakukan SETELAH pembaruan server Phase 25 dipasang

Admin (`admin_kpoti`) bisa:
1. **Menghapus satu file atau tautan** dari PROT berstatus apa pun: `POST /api/admin/prot/<id>/media/remove` dengan
   isian (`fotoKegiatan`, `videoKegiatan`, `dokumenKurikulum`, `fotoAlat`, `urlPembelian`), alamat file persis, dan
   alasan (tanpa data pribadi). Server menghapus alamat itu dari data, menghapus file dari penyimpanan, dan mencatat
   siapa, PROT mana, isian mana dan alasannya di log audit. Mengulang permintaan yang sama tidak mengubah apa pun.
2. **Mengembalikan PROT ke REVISI**: `POST /api/admin/prot/<id>/revisi` dengan alasan. PROT langsung hilang dari
   tampilan publik; pembuatnya bisa memperbaikinya dan mengajukan ulang.

Langkah teknis lengkap (termasuk contoh perintah untuk file SEPANGKAL) ada di `CLAUDE.md`, bagian "Pending deployment",
nomor 12. Saat ini tombol untuk kedua tindakan ini belum ada di situs; admin memakai perintah tersebut.

---

## 10. Belum tersedia

- Mengubah atau menghapus foto/dokumen PROT yang sudah terbit lewat situs (server sudah disiapkan di Phase 25 tetapi
  belum dipasang, dan belum ada tombol di halaman admin).
- **Berlaku setelah deploy backend** (Phase 26, sudah siap di kode, belum di server):
  - catatan untuk pemeriksa tersimpan di antrean (pengajuan pertama dan pengajuan ulang);
  - server menolak pemeriksaan dan penerbitan PROT buatan sendiri; admin hanya dengan alasan yang dicatat.
  Setelah deploy, pengembang menyalakan `NEXT_PUBLIC_PROT_RESUBMIT_NOTE=true` dan `NEXT_PUBLIC_PROT_SELF_REVIEW_RULE=true`
  di Vercel.
- Waktu minimum pemeriksaan.
- Pemeriksaan otomatis dokumen terhadap data pribadi (diputuskan tidak dibuat dulu; pemeriksa membaca setiap dokumen).
- Mengunggah dokumen Word (DOC/DOCX): server hanya menerima PDF.
- Membuat desa Jelajah untuk provinsi baru tanpa pengembang.
- Melihat jumlah PROT per status tanpa akun admin (lihat di bawah).

### Jumlah PROT per status

Tidak ada alamat publik yang menampilkan jumlah PROT per status. Yang publik hanya jumlah PROT **terbit**
(`GET /api/stats/landing` dan daftar `GET /api/prot?status=ARSIP_NASIONAL`). Untuk jumlah DRAFT, DIKURASI, REVISI dan
DIVERIFIKASI dibutuhkan akun admin (daftar `GET /api/prot` dengan token admin menampilkan semua status).
