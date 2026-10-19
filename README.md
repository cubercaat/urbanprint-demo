# 3D UrbanPrint — doʻkon sayti va admin panel

3D printerda yasalgan svetilnik, brelok, figura va logotipli sovgʻalar sotadigan [@3durbanprint](https://www.instagram.com/3durbanprint/) uchun sayt.

**Demo:** https://cubercaat.github.io/urbanprint-demo/
**Admin panel (demo):** https://cubercaat.github.io/urbanprint-demo/admin.html — parol: `admin`

Bu versiya foydalanuvchining boshqa loyihalaridagi eng yaxshi qismlarni birlashtiradi:
`cubercaat/3durbanprint` dan Payme va Click toʻlovlari, `cubercaat/dokon-tizimi` dan SQLite baza, promokod, 3 til, sevimlilar, xaritada manzil, buyurtmani kuzatish, CSV eksport, chek va Docker/Render sozlamasi.

## Doʻkon sahifasi

- **Yuklanish ekrani:** logo qatlam-qatlam “chop etiladi” (sessiyada bir marta)
- **Bosh ekran:** orqa fonda haqiqiy 3D printer (three.js) toʻxtovsiz buyum chop etadi; yonidagi “chipta” hozirgi qatlam, material va qolgan vaqtni koʻrsatadi. Sarlavha harflarining oʻzi printer qatlamlaridan iborat
- **Kataloglar:** har bir turkumning oʻz filament rangi bor (ustaxonadagi rangli devordan olingan)
- **Ustaxona tanlovi:** skroll qilinganda tanlangan mahsulotlar gorizontal harakatlanadi
- **Mahsulotlar:** qidiruv, saralash, turkum va sevimlilar filtri, 3D egiluvchi kartochkalar, qoldiq (“3 ta qoldi”, “Tugagan”)
- **Mahsulot oynasi:** galereya, rasmni kattalashtirish, aylanuvchi 3D model, rang va son, oʻxshash mahsulotlar, havolani ulashish (`#p-3` kabi toʻgʻridan-toʻgʻri havola)
- **Savat:** bepul yetkazishgacha qolgan summa, promokod, yetkazib berish yoki olib ketish, xaritada joy belgilash (OpenStreetMap), naqd/karta yoki Payme/Click
- **Buyurtmani kuzatish:** buyurtma raqami va telefon orqali holat tarixi
- **Instagram videolari** sahifaning oʻzida, maxsus buyurtma formasi (rasm/video bilan), biznes boʻlimi, savol-javob
- **3 til:** oʻzbek, rus, ingliz (interfeys toʻliq, mahsulot va turkum matnlari admin paneldan)
- Silliq skroll, kursor, skroll koʻrsatkichi; kuchsiz telefonlarda 3D sifati oʻzi pasayadi, “kamroq harakat” sozlamasi hurmat qilinadi

## Admin panel

- **Bosh sahifa:** yangi buyurtmalar, tushum, oʻrtacha chek, 14 kunlik grafik, eng koʻp sotilganlar, Payme/Click/Telegram holati, kam qolgan mahsulotlar
- **Buyurtmalar:** qidiruv, holat (Toʻlov kutilmoqda → Toʻlandi/Yangi → Tasdiqlandi → Chop etilmoqda → Yoʻlda → Yetkazildi), tarix, xarita havolasi, ichki eslatma, chek chop etish, CSV (Excel) eksport. Bekor qilinganda qoldiq qaytadi
- **Soʻrovlar:** mijoz yuborgan rasm/videolar, narx taklifi, javob
- **Mahsulotlar:** 3 tilda nom va tavsif, rasmlarni sudrab tartiblash va kompyuterdan tashlash, qoldiq, “Ustaxona tanlovi”, 3D model, nusxa olish
- **Turkumlar:** 3 tilda nom, rang, muqova, tartib
- **Instagram videolari:** havolani qoʻyib qoʻshish, muqova, tartib
- **Promokodlar:** foiz yoki summa, minimal xarid, limit, muddat
- **Mijozlar:** buyurtmalardan yigʻilgan roʻyxat, xarid summasi
- **Sozlamalar:** aloqa, yetkazish narxi va bepul chegara, olib ketish manzili, 3 tildagi matnlar

Narxlar (ajdar brelokdan tashqari) va `URBAN10` promokodi namunaviy — admin paneldan oʻzgartiring yoki oʻchiring.

## Ikki rejim

| | Statik hosting (GitHub Pages) | Server bilan |
|---|---|---|
| Maʼlumot | Shu brauzer xotirasida (demo) | `DATA_DIR/shop.db` (SQLite) |
| Buyurtmalar | Faqat shu brauzerda | Hamma mijozlardan |
| Onlayn toʻlov | Yoʻq | Payme, Click |
| Telegram xabar | Yoʻq | Bor |

Sayt oʻzi aniqlaydi: `api/health` javob bersa server rejimida ishlaydi.

## Serverni ishga tushirish

Node.js 22.5 yoki yangisi kerak. Qoʻshimcha paket oʻrnatilmaydi (SQLite Node.js ichida).

```bash
ADMIN_PASSWORD="kuchliParol123" node server/server.js
# http://localhost:3000        — doʻkon
# http://localhost:3000/admin  — admin panel
```

Docker: `docker build -t urbanprint . && docker run -p 3000:3000 -e ADMIN_PASSWORD=... -v urbanprint-data:/data urbanprint`

Render.com: repozitoriyni ulang → *New → Blueprint* → `render.yaml`. Doimiy disk uchun pullik tarif kerak, aks holda buyurtmalar qayta ishga tushganda oʻchadi.

| Muhit oʻzgaruvchisi | Vazifasi |
|---|---|
| `ADMIN_PASSWORD` | Admin paroli, kamida 8 belgi (majburiy) |
| `SESSION_SECRET` | Kirish cookie kaliti. Bermasangiz, har qayta ishga tushganda qayta kirasiz |
| `PORT`, `DATA_DIR` | Port (3000) va baza/fayllar papkasi (`server/data`) |
| `PUBLIC_URL` | Sayt manzili, masalan `https://urbanprint.uz` — toʻlovdan keyin qaytish uchun |
| `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST=1` | Payme |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` | Click |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Yangi buyurtma, toʻlov va soʻrovlar Telegramga |
| `TRUST_PROXY=1` | Nginx yoki hosting proksisi ortida |

**Toʻlov manzillari** (Payme va Click kabinetlarida kiriting):

| Tizim | Maydon | Qiymat |
|---|---|---|
| Payme | Endpoint URL | `https://sizning-domen.uz/api/payme` (hisob maydoni: `order_id`) |
| Click | Prepare URL | `https://sizning-domen.uz/api/click/prepare` |
| Click | Complete URL | `https://sizning-domen.uz/api/click/complete` |

Kalitlar berilmaguncha savatda faqat “Qabul qilganda” toʻlovi koʻrinadi. Jonli rejimdan oldin ikkala tizimning sinov toʻlovlarini oʻtkazing.

**Telegram:** @BotFather orqali bot yarating, botga bir marta yozing, `https://api.telegram.org/bot<TOKEN>/getUpdates` dan `chat.id` ni oling.

Eski versiyadagi `db.json` boʻlsa, birinchi ishga tushishda SQLite bazaga avtomatik koʻchiriladi.

## Fayllar

```
index.html, admin.html     doʻkon va admin panel
assets/css/                site.css, admin.css
assets/js/printer3d.js     3D printer, qatlamli buyumlar, aylanuvchi model (three.js r128, MIT)
assets/js/shared.js        narx, promokod va qoldiq qoidalari (brauzer va server uchun bitta)
assets/js/i18n.js          interfeys matnlari: uz, ru, en
assets/js/store.js         maʼlumot qatlami (server yoki demo)
assets/js/site.js          doʻkon, assets/js/admin.js — admin panel
data/seed.json             boshlangʻich mahsulotlar, turkumlar, videolar, promokod
server/                    server.js (API), db.js (SQLite), payments.js (Payme, Click)
Dockerfile, render.yaml    joylash
```
