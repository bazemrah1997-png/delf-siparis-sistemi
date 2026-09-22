const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const bcrypt = require('bcryptjs');
const session = require('express-session');
// Form verilerini okumak için gerekli
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'delf-egitim-gizli-anahtar',
    resave: false,
    saveUninitialized: false
}));
// SQLite Veritabanı Dosyasını Oluştur ve Bağlan
const db = new sqlite3.Database('./siparisler.db', (err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası:', err.message);
    } else {
        console.log('SQLite veritabanına başarıyla bağlanıldı.');
    }
});

// Tabloları Otomatik Oluştur (Eğer yoksa)
db.serialize(() => {    db.run(`CREATE TABLE IF NOT EXISTS kullanicilar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_adi TEXT UNIQUE NOT NULL,
        sifre_hash TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS urunler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT NOT NULL,
        fiyat REAL NOT NULL,
        stok INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS siparislar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        urun TEXT NOT NULL,
        fiyat REAL NOT NULL,
        durum TEXT NOT NULL
    )`);

    // İlk açılışta tablolar boşsa örnek ürünler ekleyelim
    db.get("SELECT COUNT(*) as count FROM urunler", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO urunler (ad, fiyat, stok) VALUES ('Samsung Galaxy A32', 9499, 5)`);
            db.run(`INSERT INTO urunler (ad, fiyat, stok) VALUES ('Buzdolabı X200', 24999, 2)`);
            db.run(`INSERT INTO urunler (ad, fiyat, stok) VALUES ('Çamaşır Makinesi Z50', 12999, 0)`);
            db.run(`INSERT INTO urunler (ad, fiyat, stok) VALUES ('Bulaşık Makinesi Pro', 8999, 8)`);
        }
    });
});

// Ana Sayfa - Veritabanından Verileri Çekip Göster
app.get('/', (req, res) => {
    if (!req.session.kullaniciId) {
        return res.redirect('/giris');
    }
    db.all("SELECT * FROM urunler", [], (err, urunler) => {

        db.all("SELECT * FROM siparislar ORDER BY id DESC", [], (err, siparisler) => {
            if (err) {
                return res.status(500).send("Veritabanı hatası (Siparişler)");
            }

            let html = `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <title>Delf Teknoloji - SQLite Veritabanlı Panel</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; background-color: #f4f7f6; color: #333; }
                    h1 { font-size: 26px; color: #222; }
                    .container { display: flex; gap: 20px; flex-wrap: wrap; }
                    .box { background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); flex: 1; min-width: 300px; margin-bottom: 20px; }
                    button { padding: 6px 12px; cursor: pointer; border-radius: 4px; border: none; font-weight: bold; }
                    .btn-danger { background-color: #dc3545; color: white; padding: 10px 15px; }
                    .btn-success { background-color: #28a745; color: white; padding: 10px 15px; width: 100%; }
                    .btn-primary { background-color: #007bff; color: white; }
                    .btn-warning { background-color: #ffc107; color: #333; font-size: 12px; }
                    ul { padding-left: 20px; list-style-type: none; }
                    li { margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
                    .disabled-btn { background-color: #e0e0e0; color: #888; cursor: not-allowed; }
                    input { padding: 8px; width: 100%; box-sizing: border-box; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; }
                    .badge-hazirlaniyor { color: #d97706; font-weight: bold; }
                    .badge-kargoda { color: #16a34a; font-weight: bold; }
                </style>
            </head>
            <body>

                <h1>Delf Teknoloji Sipariş ve Yönetim Sistemi (SQLite)</h1>
                <p>Hoş geldin, <strong>${req.session.kullaniciAdi}</strong> |
<form action="/cikis" method="POST" style="display:inline;">
    <button type="submit" style="background:#6c757d; color:#fff;">Çıkış Yap</button>
</form></p>

                <div class="container">
                    <!-- Ürünler Paneli -->
                    <div class="box">
                        <h3>Ürün Katalogu (Veritabanı)</h3>
                        ${urunler.map((u) => `
                            <p style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px;">
                                <span><strong>${u.ad}</strong><br>${u.fiyat}₺ (Stok: ${u.stok})</span>${u.stok > 0 ? `
                                    <form action="/siparis-ver" method="POST" style="margin:0;">
                                        <input type="hidden" name="urunId" value="${u.id}">
                                        <button type="submit" class="btn-primary">Sipariş Ver</button>
                                    </form>
                                ` : `<button class="disabled-btn" disabled>Tükendi</button>`}
                            </p>
                        `).join('')}
                    </div>

                    <!-- Yeni Ürün Ekleme Paneli (Admin) -->
                    <div class="box">
                        <h3>Yeni Ürün Ekle (Admin)</h3>
                        <form action="/urun-ekle" method="POST">
                            <input type="text" name="urunAdi" placeholder="Ürün Adı (örn: Kulaklık)" required>
                            <input type="number" name="fiyat" placeholder="Fiyat (TL)" required>
                            <input type="number" name="stok" placeholder="Stok Adedi" required>
                            <button type="submit" class="btn-success">Ürünü Sisteme Ekle</button>
                        </form>
                    </div>
                </div>

                <!-- Siparişler Yönetim Paneli -->
                <div class="box">
                    <h3>Sipariş Yönetimi</h3>
                    <ul>
                        ${siparisler.length === 0 ? '<p>Aktif sipariş bulunmuyor.</p>' : siparisler.map((s) => `
                            <li>
                                <span>#${s.id} - <strong>${s.urun}</strong> (${s.fiyat}₺) <br>Durum: <span class="${s.durum === 'Kargoda' ? 'badge-kargoda' : 'badge-hazirlaniyor'}">${s.durum}</span></span>${s.durum === 'Hazırlanıyor' ? `
                                    <form action="/kargola" method="POST" style="margin:0;">
                                        <input type="hidden" name="siparisId" value="${s.id}">
                                        <button type="submit" class="btn-warning">Kargoya Ver</button>
                                    </form>
                                ` : '<span style="font-size:12px; color:gray;">Tamamlandı</span>'}
                            </li>
                        `).join('')}
                    </ul>

                    <form action="/sepeti-temizle" method="POST" style="margin-top: 15px;">
                        <button type="submit" class="btn-danger">Tüm Siparişleri Temizle</button>
                    </form>
                </div>

            </body>
            </html>
            `;
            res.send(html);
        });
    });
});

// Yeni Ürün Ekleme (DB)
app.post('/urun-ekle', (req, res) => {
    const { urunAdi, fiyat, stok } = req.body;
    if (urunAdi && fiyat && stok) {
        db.run(`INSERT INTO urunler (ad, fiyat, stok) VALUES (?, ?, ?)`, [urunAdi, Number(fiyat), Number(stok)], (err) => {
            if (err) console.error(err);
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

// Sipariş Verme ve Stok Düşme (DB)
app.post('/siparis-ver', (req, res) => {
    const { urunId } = req.body;

    db.get(`SELECT * FROM urunler WHERE id = ?`, [urunId], (err, urun) => {
        if (urun && urun.stok > 0) {
            // Stok 1 azalt
            db.run(`UPDATE urunler SET stok = stok - 1 WHERE id = ?`, [urunId], () => {
                // Siparişler tablosuna ekle
                db.run(`INSERT INTO siparislar (urun, fiyat, durum) VALUES (?, ?, ?)`, [urun.ad, urun.fiyat, "Hazırlanıyor"], () => {
                    res.redirect('/');
                });
            });
        } else {
            res.redirect('/');
        }
    });
});

// Siparişi Kargoya Ver (DB)
app.post('/kargola', (req, res) => {
    const { siparisId } = req.body;
    db.run(`UPDATE siparislar SET durum = 'Kargoda' WHERE id = ?`, [siparisId], () => {
        res.redirect('/');
    });
});

// Siparişleri Temizle (DB)
app.post('/sepeti-temizle', (req, res) => {
    db.run(`DELETE FROM siparislar`, () => {
        res.redirect('/');
    });
});
// Kayıt Ol
app.post('/kayit', (req, res) => {
    const { kullanici_adi, sifre } = req.body;
    if (!kullanici_adi || !sifre) {
        return res.send('Kullanıcı adı ve şifre zorunlu. <a href="/giris">Geri dön</a>');
    }
    const sifreHash = bcrypt.hashSync(sifre, 10);
    db.run(`INSERT INTO kullanicilar (kullanici_adi, sifre_hash) VALUES (?, ?)`, [kullanici_adi, sifreHash], (err) => {
        if (err) {
            return res.send('Bu kullanıcı adı zaten alınmış. <a href="/giris">Geri dön</a>');
        }
        res.redirect('/giris');
    });
});

// Giriş Yap
app.post('/giris-yap', (req, res) => {
    const { kullanici_adi, sifre } = req.body;
    db.get(`SELECT * FROM kullanicilar WHERE kullanici_adi = ?`, [kullanici_adi], (err, kullanici) => {
        if (!kullanici || !bcrypt.compareSync(sifre, kullanici.sifre_hash)) {
            return res.send('Kullanıcı adı veya şifre yanlış. <a href="/giris">Geri dön</a>');
        }
        req.session.kullaniciId = kullanici.id;
        req.session.kullaniciAdi = kullanici.kullanici_adi;
        res.redirect('/');
    });
});

// Çıkış Yap
app.post('/cikis', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/giris');
    });
});

// Giriş / Kayıt Sayfası
app.get('/giris', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <title>Giriş Yap</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 50px; }
            .kutu { border: 1px solid #ccc; padding: 20px; max-width: 300px; margin-bottom: 20px; border-radius: 6px; }
            input { display: block; margin-bottom: 10px; padding: 8px; width: 100%; box-sizing: border-box; }
            button { padding: 8px 15px; cursor: pointer; }
        </style>
    </head>
    <body>
        <h1>Delf Teknoloji</h1>
        <div class="kutu">
            <h3>Giriş Yap</h3>
            <form action="/giris-yap" method="POST">
                <input type="text" name="kullanici_adi" placeholder="Kullanıcı adı" required>
                <input type="password" name="sifre" placeholder="Şifre" required>
                <button type="submit">Giriş Yap</button>
            </form>
        </div>
        <div class="kutu">
            <h3>Kayıt Ol</h3>
            <form action="/kayit" method="POST">
                <input type="text" name="kullanici_adi" placeholder="Kullanıcı adı" required>
                <input type="password" name="sifre" placeholder="Şifre" required>
                <button type="submit">Kayıt Ol</button>
            </form>
        </div>
    </body>
    </html>
    `);
});
// Sunucuyu Başlat
app.listen(3000, () => {
    console.log("Sunucu çalışıyor: http://localhost:3000");
});