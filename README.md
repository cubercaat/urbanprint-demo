# 3D UrbanPrint — doʻkon sayti va admin panel

3D printerda yasalgan svetilnik, brelok, figura va logotipli sovgʻalar sotadigan [@3durbanprint](https://www.instagram.com/3durbanprint/) uchun sayt.

**Demo:** https://cubercaat.github.io/urbanprint-demo/
**Admin panel (demo):** https://cubercaat.github.io/urbanprint-demo/admin.html — parol: `admin`

## Ichida nima bor

**Doʻkon sahifasi** (`index.html`)
- Bosh ekranda orqa fonda haqiqiy 3D printer (three.js) toʻxtovsiz buyum chop etadi, atrofda tayyor buyumlar suzib yuradi, sichqonchaga ergashadi
- Kataloglar: Yangi kelganlar, Svetilniklar, Breloklar, Figuralar, Dekor, Kundalik buyumlar, Noodatiy buyumlar, Biznes uchun
- Mahsulotlar: qidiruv, saralash, turkum filtrlari, 3D egiluvchi kartochkalar, mahsulot oynasida rasm galereyasi va aylantiriladigan 3D model, rang va son tanlash
- Instagram videolari: reels sahifaning oʻzida Instagram pleyerida ochiladi
- Skroll bilan boshqariladigan “Qanday yasaladi” sahnasi: buyum qatlam-qatlam chop etilib, pastga tushadi
- Biznes / ulgurji boʻlimi, maxsus buyurtma formasi (rasm va video yuklash bilan), savol-javob
- Savat va buyurtma berish (ism, telefon, manzil)
- Kuchsiz telefonlarda 3D sifati avtomatik pasayadi; “kamroq harakat” sozlamasi hurmat qilinadi

**Admin panel** (`admin.html`)
- Bosh sahifa: yangi buyurtmalar, tushum, 14 kunlik grafik
- Buyurtmalar: holat (Yangi → Tasdiqlandi → Chop etilmoqda → Yoʻlda → Yetkazildi), ichki eslatma, qoʻngʻiroq
- Soʻrovlar: mijoz yuborgan rasm/videolar, narx taklifi, javob
- Mahsulotlar: qoʻshish, tahrirlash, nusxa olish, oʻchirish, rasm yuklash, belgilar (Yangi, Xit, Chegirma), 3D model, saytdan yashirish
- Turkumlar: nom, tavsif, muqova rasmi, tartib
- Instagram videolari: havolani qoʻyib qoʻshish, muqova, tartib, yashirish
- Sozlamalar: telefon, Instagram, Telegram, bosh ekran matnlari, eʼlon qatori

Rasmlar va videolar @3durbanprint Instagram sahifasidan olingan. Narxlar (Ajdar brelokdan tashqari) namunaviy — admin paneldan oʻzgartiring.

## Ikki rejim

| | Statik hosting (GitHub Pages) | Server bilan |
|---|---|---|
| Maʼlumot qayerda | Shu brauzerning xotirasida (demo) | `server/data/db.json` |
| Buyurtmalar | Faqat shu brauzerda koʻrinadi | Hamma mijozlardan keladi |
| Rasm yuklash | Brauzerda saqlanadi | `server/data/uploads/` |
| Telegram xabar | Yoʻq | Bor |

Sayt oʻzi aniqlaydi: `api/health` javob bersa server rejimida ishlaydi.

## Serverni ishga tushirish

Faqat Node.js 18 yoki yangisi kerak, qoʻshimcha paket oʻrnatilmaydi.

```bash
ADMIN_PASSWORD="kuchliParol123" node server/server.js
# http://localhost:3000        — doʻkon
# http://localhost:3000/admin  — admin panel
```

Muhit oʻzgaruvchilari:

| Nomi | Vazifasi |
|---|---|
| `ADMIN_PASSWORD` | Admin paroli, kamida 8 belgi (majburiy) |
| `PORT` | Port, standart 3000 |
| `DATA_DIR` | Baza va yuklangan fayllar papkasi, standart `server/data` |
| `SESSION_SECRET` | Kirish cookie kaliti. Bermasangiz, har qayta ishga tushganda admin qayta kiradi |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Yangi buyurtma va soʻrovlarni Telegramga yuborish |
| `TRUST_PROXY=1` | Nginx yoki hosting proksisi ortida ishlaganda |

**Telegram xabarnoma:** @BotFather orqali bot yarating, tokenni oling, botga bir marta yozing, keyin `https://api.telegram.org/bot<TOKEN>/getUpdates` dan `chat.id` ni oling.

**Hostingga qoʻyish:** doimiy disk beradigan istalgan VPS yoki Node hosting (masalan, Railway, Render, Fly.io) mos. `DATA_DIR` doimiy diskka qaratilsin, aks holda qayta joylashda buyurtmalar oʻchib ketadi. HTTPS orqali ishlating.

## Fayllar

```
index.html            doʻkon sahifasi
admin.html            admin panel
assets/css/           site.css, admin.css
assets/js/three.min.js   three.js r128 (MIT)
assets/js/printer3d.js   3D printer, qatlamli buyumlar, aylanuvchi model
assets/js/store.js       maʼlumot qatlami (server yoki demo)
assets/js/site.js        doʻkon mantigʻi
assets/js/admin.js       admin panel
assets/img/              mahsulot va video muqovalari
data/seed.json           boshlangʻich mahsulotlar, turkumlar, videolar
server/server.js         API server (tashqi paketlarsiz)
```
