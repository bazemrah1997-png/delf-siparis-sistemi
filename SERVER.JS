const express = require('express');
const app = express();

// Form verilerini okumak için gerekli
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ürün Listesi
let urunler = [
    { ad: "Samsung Galaxy A32", fiyat: 9499, stok: 5 },
    { ad: "Buzdolabı X200", fiyat: 24999, stok: 2 },
    { ad: "Çamaşır Makinesi Z50", fiyat: 12999, stok: 0 },
    { ad: "Bulaşık Makinesi Pro", fiyat: 8999, stok: 8 }
];

// Sipariş Listesi
let siparisler = [
    { id: 2, urun: "Samsung Galaxy A32", fiyat: 9499, durum: "Hazırlanıyor" },
    { id: 1, urun: "Buzdolabı X200", fiyat: 24999, durum: "Kargoda" }
];

// Ana Sayfa Arayüzü
app.get('/', (req, res) => {
    let html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <title>Delf Teknoloji Sipariş Sistemi - Gelişmiş Panel</title>
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

        <h1>Delf Teknoloji Sipariş ve Yönetim Sistemi</h1>
        <p>Hoş geldin, <strong>sdas</strong> | <button onclick="alert('Çıkış yapıldı')" style="background:#6c757d; color:#fff;">Çıkış Yap</button></p>

        <div class="container">
            <!-- Ürünler Paneli -->
            <div class="box">
                <h3>Ürün Katalogu</h3>
                ${urunler.map((u, index) => `
                    <p style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px;">
                        <span><strong>${u.ad}</strong><br>${u.fiyat}₺ (Stok: ${u.stok})</span>${u.stok > 0 ? `
                            <form action="/siparis-ver" method="POST" style="margin:0;">
                                <input type="hidden" name="urunIndex" value="${index}">
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
                    <input type="text" name="urunAdi" placeholder="Ürün Adı (örn: Samsung A32)" required>
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
                ${siparisler.length === '<p>Aktif sipariş bulunmuyor.</p>' ? '<p>Aktif sipariş bulunmuyor.</p>' : siparisler.map((s, sIndex) => `
                    <li>
                        <span>#${s.id} - <strong>${s.urun}</strong> (${s.fiyat}₺) <br>Durum: <span class="${s.durum === 'Kargoda' ? 'badge-kargoda' : 'badge-hazirlaniyor'}">${s.durum}</span></span>${s.durum === 'Hazırlanıyor' ? `
                            <form action="/kargola" method="POST" style="margin:0;">
                                <input type="hidden" name="siparisIndex" value="${sIndex}">
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

// Yeni Ürün Ekleme
app.post('/urun-ekle', (req, res) => {
    const { urunAdi, fiyat, stok } = req.body;
    if (urunAdi && fiyat && stok) {
        urunler.push({
            ad: urunAdi,
            fiyat: Number(fiyat),
            stok: Number(stok)
        });
    }
    res.redirect('/');
});

// Sipariş Verme ve Stok Düşme
app.post('/siparis-ver', (req, res) => {
    const { urunIndex } = req.body;
    const index = Number(urunIndex);

    if (urunler[index] && urunler[index].stok > 0) {
        urunler[index].stok -= 1; 

        siparisler.unshift({
            id: siparisler.length + 1,
            urun: urunler[index].ad,
            fiyat: urunler[index].fiyat,
            durum: "Hazırlanıyor"
        });
    }
    res.redirect('/');
});

// Siparişi Kargoya Ver (Durum Güncelleme)
app.post('/kargola', (req, res) => {
    const { siparisIndex } = req.body;
    const index = Number(siparisIndex);

    if (siparisler[index]) {
        siparisler[index].durum = "Kargoda";
    }
    res.redirect('/');
});

// Siparişleri Temizle
app.post('/sepeti-temizle', (req, res) => {
    siparisler = [];
    res.redirect('/');
});

// Sunucuyu Başlat
app.listen(3000, () => {
    console.log("Sunucu çalışıyor: http://localhost:3000");
});