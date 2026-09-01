# Monitor Media HAM Indonesia

Dashboard pemantauan pemberitaan media untuk tiga kluster:

1. **Represi Digital** — 10 subkluster;
2. **Pelanggaran HAM dalam Proyek Strategis Nasional (PSN)** — 3 subkluster; dan
3. **Pelanggaran HAM Sipil dan Politik** — 3 subkluster.

Data diambil dari **Google News RSS sejak 1 Januari 2026**. GitHub Actions
memeriksa berita baru setiap 6 jam, memperbarui CSV/JSON, lalu menerbitkan ulang
GitHub Pages. Dashboard sudah berisi data awal; ini bukan template kosong.

## Cara paling mudah memasang di GitHub

### 1. Buat repository

Di GitHub, klik **New repository**, beri nama misalnya
**monitor-media-ham**, pilih **Public**, lalu klik **Create repository**.

### 2. Unggah seluruh isi paket

Ekstrak ZIP ini. Di halaman repository baru, pilih
**uploading an existing file**, seret **seluruh isi folder** hasil ekstraksi,
lalu klik **Commit changes**.

Pastikan folder tersembunyi **.github** ikut terunggah. Folder ini berisi mesin
pembaruan otomatis.

### 3. Aktifkan GitHub Pages

Buka **Settings → Pages**. Pada bagian **Build and deployment**, pilih:

- **Source:** GitHub Actions

Kembali ke tab **Actions**, buka workflow **Update Google News RSS and deploy**,
lalu klik **Run workflow** untuk penerbitan pertama. Setelah selesai, alamat
dashboard muncul di halaman workflow dan di **Settings → Pages**.

### 4. Izinkan workflow menulis data

Jika pembaruan data gagal karena izin, buka:

**Settings → Actions → General → Workflow permissions**

Pilih **Read and write permissions**, lalu **Save**. Jalankan workflow sekali
lagi.

## Verifikasi manusia

**public/data/news.csv** adalah sumber data utama yang dapat diperiksa lewat
GitHub. Berita baru otomatis diberi:

- review_status = Belum ditinjau
- human_verified = false

Untuk memverifikasi coding HAM:

1. buka public/data/news.csv;
2. unduh atau edit CSV;
3. ubah review_status menjadi Terverifikasi;
4. ubah human_verified menjadi true;
5. tambahkan review_note bila perlu; dan
6. unggah/commit CSV kembali.

Workflow berikutnya mempertahankan kolom verifikasi tersebut. Baris dengan
review_status **Tidak relevan** tetap tersimpan dalam CSV tetapi tidak
ditampilkan di dashboard.

## Pembaruan manual

Di tab **Actions**, pilih **Update Google News RSS and deploy → Run workflow**.
Pilih **Full rescan** bila ingin menarik ulang seluruh rentang sejak
1 Januari 2026. Pemindaian penuh memerlukan waktu lebih lama.

## Menjalankan di komputer sendiri (opsional)

Prasyarat: Node.js 22+, npm, dan Python 3.

    npm ci
    python3 scripts/fetch_news.py
    npm run dev

Untuk membuat versi produksi:

    npm run build

## Berkas penting

| Berkas | Fungsi |
| --- | --- |
| data/monitor-config.json | 16 kueri dan struktur tiga kluster |
| scripts/fetch_news.py | pengambilan, deduplikasi, dan penggabungan RSS |
| public/data/news.csv | sumber utama yang dapat diverifikasi manusia |
| public/data/news.json | data siap-baca dashboard |
| .github/workflows/update-news.yml | pembaruan 6 jam dan penerbitan Pages |

## Catatan metodologis

Google News RSS adalah alat temu kembali, bukan basis data media yang lengkap.
Hasil dapat dipengaruhi indeks Google, batas hasil per feed, perubahan judul,
duplikasi sindikasi, dan logika Boolean Google News. Klasifikasi awal bersifat
otomatis; klaim substantif tentang pelanggaran HAM tetap memerlukan pembacaan
artikel dan verifikasi peneliti.
