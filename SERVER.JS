const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

// Veritabanını aç (dosya yoksa otomatik oluşturur)
const db = new Database('siparisler.db');

// Tabloları oluştur (sadece ilk çalıştırmada gerçek etkisi olur)
db.exec(`
  CREATE TABLE IF NOT EXISTS kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_adi TEXT UNIQUE NOT NULL,
    sifre_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS urunler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    fiyat REAL NOT NULL,
    stok INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS siparisler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER,
    urun_id INTEGER,
    durum TEXT DEFAULT 'Hazırlanıyor',
    tarih TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Başlangıç ürünleri - tablo boşsa ekle
const urunSayisi = db.prepare('SELECT COUNT(*) as adet FROM urunler').get();
if (urunSayisi.adet === 0) {
  const ekle = db.prepare('INSERT INTO urunler (ad, fiyat, stok) VALUES (?, ?, ?)');
  ekle.run('Buzdolabı X200', 24999, 5);
  ekle.run('Çamaşır Makinesi Z50', 12999, 0);
  ekle.run('Bulaşık Makinesi Pro', 8999, 12);
}

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'delf-egitim-gizli-anahtar',
  resave: false,
  saveUninitialized: false
}));
// Kayıt ol
app.post('/api/kayit', async (req, res) => {
  const { kullanici_adi, sifre } = req.body;

  if (!kullanici_adi || !sifre) {
    return res.status(400).json({ hata: 'Kullanıcı adı ve şifre zorunlu' });
  }

  const sifreHash = await bcrypt.hash(sifre, 10);

  try {
    const ekle = db.prepare('INSERT INTO kullanicilar (kullanici_adi, sifre_hash) VALUES (?, ?)');
    ekle.run(kullanici_adi, sifreHash);
    res.status(201).json({ mesaj: 'Kayıt başarılı' });
  } catch (err) {
    res.status(400).json({ hata: 'Bu kullanıcı adı zaten alınmış' });
  }
});

// Giriş yap
app.post('/api/giris', async (req, res) => {
  const { kullanici_adi, sifre } = req.body;

  const kullanici = db.prepare('SELECT * FROM kullanicilar WHERE kullanici_adi = ?').get(kullanici_adi);

  if (!kullanici) {
    return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });
  }

  const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre_hash);

  if (!sifreDogruMu) {
    return res.status(401).json({ hata: 'Şifre yanlış' });
  }

  req.session.kullaniciId = kullanici.id;
  req.session.kullaniciAdi = kullanici.kullanici_adi;

  res.json({ mesaj: 'Giriş başarılı', kullanici: kullanici.kullanici_adi });
});

// Çıkış yap
app.post('/api/cikis', (req, res) => {
  req.session.destroy();
  res.json({ mesaj: 'Çıkış yapıldı' });
});

// Şu an giriş yapmış kullanıcıyı kontrol et
app.get('/api/ben', (req, res) => {
  if (req.session.kullaniciId) {
    res.json({ girisYapti: true, kullaniciAdi: req.session.kullaniciAdi });
  } else {
    res.json({ girisYapti: false });
  }
});
// Ürünleri listele
app.get('/api/urunler', (req, res) => {
  const urunler = db.prepare('SELECT * FROM urunler').all();
  res.json(urunler);
});

// Sipariş oluştur (giriş yapmış olmak şart)
app.post('/api/siparis', (req, res) => {
  if (!req.session.kullaniciId) {
    return res.status(401).json({ hata: 'Sipariş vermek için giriş yapmalısınız' });
  }

  const { urunId } = req.body;
  const urun = db.prepare('SELECT * FROM urunler WHERE id = ?').get(urunId);

  if (!urun) {
    return res.status(404).json({ hata: 'Ürün bulunamadı' });
  }
  if (urun.stok <= 0) {
    return res.status(400).json({ hata: 'Ürün stokta yok' });
  }

  // Sipariş oluştur
  const siparisEkle = db.prepare('INSERT INTO siparisler (kullanici_id, urun_id, durum) VALUES (?, ?, ?)');
  const sonuc = siparisEkle.run(req.session.kullaniciId, urunId, 'Hazırlanıyor');

  // Stoğu düşür
  db.prepare('UPDATE urunler SET stok = stok - 1 WHERE id = ?').run(urunId);

  res.status(201).json({ mesaj: 'Sipariş oluşturuldu', siparisId: sonuc.lastInsertRowid });
});

// Kendi siparişlerimi listele
app.get('/api/siparislerim', (req, res) => {
  if (!req.session.kullaniciId) {
    return res.status(401).json({ hata: 'Giriş yapmalısınız' });
  }

  const siparisler = db.prepare(`
    SELECT siparisler.id, siparisler.durum, siparisler.tarih, urunler.ad, urunler.fiyat
    FROM siparisler
    JOIN urunler ON siparisler.urun_id = urunler.id
    WHERE siparisler.kullanici_id = ?
    ORDER BY siparisler.tarih DESC
  `).all(req.session.kullaniciId);

  res.json(siparisler);
});

// Sipariş durumunu güncelle (normalde sadece yönetici yapar - şimdilik herkes yapabilsin, eğitim amaçlı)
app.post('/api/siparis/:id/durum', (req, res) => {
  const { durum } = req.body;
  const { id } = req.params;

  db.prepare('UPDATE siparisler SET durum = ? WHERE id = ?').run(durum, id);
  res.json({ mesaj: 'Durum güncellendi' });
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});