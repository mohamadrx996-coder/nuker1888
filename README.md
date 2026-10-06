# TRJ Tool12 - Cloudflare Edge Deployment

## ما هذا؟
أداة إدارة سيرفرات Discord (Nuker, Mass DM, Rename Channels) تعمل **مباشرة من المتصفح** على الآيفون/أندرويد/كمبيوتر بدون تشغيل أي سيرفر محلي.

## الميزات
- ✅ يعمل على **الآيفون/أندرويد/كمبيوتر** من المتصفح مباشرة
- ⚡ **Cloudflare Edge** - أسرع من الاتصال المحلي (Edge network 275+ موقع)
- 🔐 **Bot Token فقط** - يجلب السيرفرات تلقائياً (`/users/@me/guilds`)
- 🛡️ **Worker Proxy** - يتجاوز CORS، يضيف headers صحيحة
- 💾 **إعدادات محفوظة** في localStorage
- 🌙 **Dark theme** محسّن للجوال

## النشر (5 دقائق)

### 1. ثبت حساب Cloudflare (مجاني)
- ادخل: https://dash.cloudflare.com/sign-up

### 2. ثبت Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 3. أنشئ KV Namespace للتخزين المؤقت
```bash
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
```
انسخ الـ IDs التي تظهرها وحدث `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-production-kv-id"
preview_id = "your-preview-kv-id"
```

### 4. انشر Worker
```bash
wrangler deploy
```
سيعطيك رابط: `https://tool12-discord-proxy.your-subdomain.workers.dev`

### 5. انشر Pages
```bash
wrangler pages deploy . --project-name=tool12 --branch=main
```
رابطك النهائي: `https://tool12.pages.dev`

## الاستخدام
1. افتح `https://tool12.pages.dev` على الآيفون/أندرويد/كمبيوتر
2. ضع **Bot Token** فقط
3. اضغط **Connect** → سيظهر جميع السيرفرات التي البوت فيها
4. اختر السيرفر → الأدوات جاهزة

## الهيكل
```
tool12-cloudflare/
├── wrangler.toml          # إعدادات Worker
├── index.html             # واجهة المستخدم (RTL, Arabic, Mobile-first)
├── src/
│   ├── worker.js          # Cloudflare Worker Proxy (High Performance)
│   └── app.js             # منطق الواجهة (Tabs, Nuker, DM, Rename, Settings)
└── deploy.bat             # سكريبت نشر سريع (Windows)
```

## تحسينات الأداء
- **Worker على Edge** (275+ موقع) - أقرب لـ Discord API
- **Cache-Control ذكي** - GET requests مخزنة 5 ثواني
- **Connection keep-alive** مع Discord
- **Brotli/Zstd compression** تلقائي
- **Early Hints** و **minify** مفعلة
- **60 concurrent** للعمليات المتوازية (Rename, Create, Delete)
- **Streaming responses** - لا ينتظر تحميل كامل الاستجابة

## المتطلبات
- Bot Token مع صلاحيات: `Administrator` أو صلاحيات محددة
- البوت يجب أن يكون في السيرفر
- حساب Cloudflare (مجاني)

## استكشاف الأخطاء
| المشكلة | الحل |
|----------|-------|
| CORS Error | تأكد أن Worker منتشر ويعمل |
| 401 Unauthorized | Token غير صحيح أو البوت ليس في السيرفر |
| 429 Rate Limited | الأداة تتعامل معها تلقائياً (Retry-After) |
| لا تظهر السيرفرات | البوت ليس في أي سيرفر أو Token خطأ |

## الترخيص
للأغراض التعليمية فقط. استخدم بمسؤولية.