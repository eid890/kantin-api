// API Backend Kantin Pondok dengan WhatsApp Notification (Node.js + Express)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const schedule = require('node-schedule');
const app = express();
const PORT = process.env.PORT || 3000;

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'YOUR_FONNTE_TOKEN';

app.use(bodyParser.json());

// Simulasi database
let santriDB = {
  S001: {
    id: 'S001',
    nama: 'Ahmad',
    saldo: 85000,
    limit: 15000,
    total_hari_ini: 12000,
    no_wa: '08123456789'
  },
};

let transaksiDB = [];

// Fungsi kirim WA via Fonnte
async function kirimWA(nomor, pesan) {
  try {
    const res = await axios.post(
      'https://api.fonnte.com/send',
      {
        target: nomor,
        message: pesan,
        delay: 3,
        countryCode: '62'
      },
      {
        headers: {
          Authorization: FONNTE_TOKEN
        }
      }
    );
    console.log('✅ WA terkirim:', res.data);
  } catch (err) {
    console.error('❌ Gagal kirim WA:', err.response?.data || err.message);
  }
}

// Reset total harian semua santri setiap jam 00:00
schedule.scheduleJob('0 0 * * *', () => {
  for (let id in santriDB) {
    santriDB[id].total_hari_ini = 0;
  }
  console.log('⏰ Total harian di-reset');
});

// Endpoint: Ambil data santri dari QR
app.get('/api/santri/:id', (req, res) => {
  const santri = santriDB[req.params.id];
  if (!santri) return res.status(404).json({ error: 'Santri tidak ditemukan' });
  res.json(santri);
});

// Endpoint: Simpan transaksi
app.post('/api/transaksi', async (req, res) => {
  const { id_santri, barang, harga } = req.body;
  const santri = santriDB[id_santri];
  if (!santri) return res.status(404).json({ error: 'Santri tidak ditemukan' });

  const total = parseInt(harga);
  if (santri.total_hari_ini + total > santri.limit) {
    return res.status(400).json({ error: 'Limit harian tercapai' });
  }
  if (total > santri.saldo) {
    return res.status(400).json({ error: 'Saldo tidak mencukupi' });
  }

  // Update saldo dan total hari ini
  santri.saldo -= total;
  santri.total_hari_ini += total;

  // Simpan transaksi
  transaksiDB.push({
    id_santri,
    barang,
    harga: total,
    tanggal: new Date().toISOString().split('T')[0]
  });

  // Kirim WhatsApp
  const pesan = `Assalamu'alaikum Bapak/Ibu,\nAnanda ${santri.nama} belanja Rp${total} hari ini.\nSisa saldo: Rp${santri.saldo}`;
  await kirimWA(santri.no_wa, pesan);

  res.json({ success: true, sisa_saldo: santri.saldo, pesan });
});

// Endpoint: Tambah/Edit data santri (admin)
app.post('/api/santri', (req, res) => {
  const { id, nama, saldo, limit, no_wa } = req.body;
  santriDB[id] = {
    id,
    nama,
    saldo: saldo || 0,
    limit: limit || 15000,
    total_hari_ini: 0,
    no_wa
  };
  res.json({ success: true, data: santriDB[id] });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
