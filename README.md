# PRD Platform — السفراء والفروع والإدارة (رمضان) — GitHub + Netlify + Neon

منصة Static (Vite) + Netlify Functions + Neon PostgreSQL.

## المتطلبات
- Node.js 18+  
- Netlify CLI (للتشغيل بـ `netlify dev`)  
  - تثبيت: `npm i -g netlify-cli`

## التشغيل محليًا
1) انسخ ملف البيئة:
```bash
cp .env.example .env
```

2) ضع القيم داخل `.env` (أهمها `DATABASE_URL`, `JWT_SECRET`).

3) ثبّت الحزم وشغّل إعداد قاعدة البيانات (مرة واحدة):
```bash
npm install
npm run db:setup
```

4) شغّل التطبيق:
- واجهة فقط:
```bash
npm run dev
```
- واجهة + Functions (الموصى به):
```bash
netlify dev
```

## النشر على Netlify
1) ارفع هذا المشروع إلى GitHub.
2) اربطه بـ Netlify.
3) Environment Variables في Netlify:
- `DATABASE_URL`
- `JWT_SECRET`
- (اختياري) `ADMIN_USERNAME`, `ADMIN_PASSWORD` أو `ADMIN_SEED_KEY`
- (اختياري) `APP_BASE_URL`

4) أنشئ الجداول في Neon (مرة واحدة):
- الأسهل: افتح Neon → **SQL Editor** والصق محتوى `db/schema.sql` ثم Run.
- أو محليًا: `npm run db:setup` (يتطلب `DATABASE_URL`).


> **مهم جدًا:** ربط Neon بـ Netlify (Integration) لا ينشئ الجداول تلقائيًا.
> لازم تنفّذ ملف `db/schema.sql` **مرة واحدة** داخل Neon (SQL Editor) أو عبر `npm run db:setup`.


## المسارات
- `/` الرئيسية
- `/safer/:numsafer` صفحة السفير
- `/fre/:numfre` صفحة الفرع
- `/cpadmin` صفحة الإدارة

## CSV Formats
راجع: `docs/csv-formats.md` + أمثلة: `docs/examples/`

> ملاحظة: المعاينة (أول 20 صف) تتم داخل صفحة الإدارة قبل الاعتماد، ثم يتم إرسال النص كاملًا إلى الـ API.
