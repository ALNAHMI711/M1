# دليل تشغيل وتسليم M1

النسخة منصة تحليل ومؤشرات ورقابة وتحقق من الإشارات ومحاكاة PAPER نقدية
محفوظة للأرصدة والمراكز والرسوم. ليست منصة تداول حقيقي مكتملة.
LIVE مغلق، ولا توجد عمليات سحب أو تحويل.
راجع `docs/PAPER_SIMULATION_AR.md` للأسعار المفترضة والحدود.

## تشغيل محلي

المتطلبات: Node.js 24 وPython 3.11. لا تحتاج مفاتيح Binance للواجهة أو DEMO.

```bash
npm ci
npm run typecheck
npm run typecheck:terminal
npm test
npm run build
npm run build:example
cd backend
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade "pip>=26.2.1" "setuptools>=83.0.0"
.venv/bin/python -m pip install -r requirements-test.lock
.venv/bin/python -m pip install -e ".[test]" --no-deps
export M1_DB_PATH="$PWD/data/m1.sqlite3"
export M1_AUTH_SECRET="$(openssl rand -hex 32)"
.venv/bin/python -m app.admin user admin --role ADMIN
.venv/bin/pytest -q
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers --no-access-log
```

احتفظ بسر JWT نفسه خارج Git عند إعادة التشغيل؛ تغييره يبطل الجلسات.
أمر المستخدم يطلب كلمة المرور في الطرفية، ولا يضعها في وسيطات الأوامر.
تغيير كلمة المرور أو الدور يبطل جميع جلسات المستخدم. لا تستخدم حساب CI
أو بيانات معاينة معروفة في إنتاج حقيقي.

في طرفية ثانية من جذر المشروع:

```bash
npm run dev:example -- --host 127.0.0.1 --port 3000
```

افتح `http://127.0.0.1:3000` ثم لوحة التحكم وسجل الدخول بحسابك المحلي.
يوجّه Vite طلبات API إلى Backend. وثائق API على
`http://127.0.0.1:8000/docs`.

## Docker وHTTPS

```bash
cp .env.example .env
chmod 600 .env
# ضع سرًا من openssl rand -hex 32 في M1_AUTH_SECRET محليًا.
docker compose config --quiet
docker compose build
docker compose up -d backend
docker compose exec backend python -m app.admin user admin --role ADMIN
docker compose up -d web
docker compose ps
```

HTTP الافتراضي على `127.0.0.1:8080` فقط. للنشر الفعلي ضع اسم نطاقك في
`M1_SITE_ADDRESS` واضبط DNS وجدار الحماية وعدّل منافذ web إلى 80:80 و443:443
بعد مراجعة. Caddy مجهز لـHTTPS؛ لا تجعل منفذ Backend عامًا.
لم يتم تشغيل Docker أو إصدار TLS فعلي في بيئة التسليم؛ الملفات تجهيز
وليست إثبات نجاح نشر. Backend يعمل بمستخدم غير root ونظام ملفات للقراءة.

## الرقابة والنسخ الاحتياطي

- `/health`: حياة العملية دون الاعتماد على قاعدة البيانات.
- `/ready`: التخزين وسر JWT، لا جاهزية تداول.
- `/v1/control/readiness`: حالة محدودة وموانع، وليس اعتماد LIVE.
- `/v1/control/audit`: قراءة التدقيق بصلاحيات حساب.
- `/v1/control/kill-switch`: التعديل ADMIN فقط؛ لا تصفية أو إلغاء أوامر.
- `/v1/paper/account`: حساب المحاكاة الخاص بالمستخدم، لا أرصدة بورصة.
- `/v1/paper/orders`: تعبئة PAPER فقط؛ OPERATOR أو ADMIN، لا VIEWER.
- `/v1/paper/ledger.csv`: سجل المحاكاة الخاص بالمستخدم، حتى 5000 إيصال.
- الإيقاف وإبطال الجلسات محفوظان بعد إعادة التشغيل.
- الحد الافتراضي 120 طلبًا/دقيقة و10 محاولات دخول/دقيقة لكل عنوان النظير
  المباشر. خلف proxy قد يكون الحد مشتركًا؛ لا توثَق X-Forwarded-For تلقائيًا.

من داخل backend وبنفس `M1_DB_PATH`:

```bash
python -m app.admin backup /private-backups/m1-2026-10-10.sqlite3
# أوقف الخدمة؛ الاستعادة إلى مسار جديد فقط:
M1_DB_PATH=/new-data/restored.sqlite3 python -m app.admin restore /private-backups/m1-2026-10-10.sqlite3
```

النسخ متسق مع WAL ويتحقق من سلامته ويرفض الكتابة فوق نسخة موجودة.
الاستعادة تبطل الجلسات وتفعّل الإيقاف وتحفظ المستخدمين والبيانات
وحسابات PAPER والمراكز والإيصالات.
النسخ تحتوي hashes وتفاصيل تشغيل، فاحفظها خاصة ومشفرة خارج الخادم.
لم تُفعّل جدولة نسخ أو تنبيهات سحابية؛ يلزم ضبطها واختبار الاستعادة على الخادم.

## الحدود المتبقية

`/v1/binance/spot/order-test` يختبر صيغة أمر عبر `/api/v3/order/test`
على Testnet فقط؛ لا يضع أمرًا ولا يثبت تعبئة أو استعادة. مفاتيح Testnet
اختيارية وتبقى في Backend الخاص. لم يُختبر بمفاتيح فعلية في هذا التسليم.

ما يحتاج بيئة خارجية أو تطويرًا إضافيًا:

- Testnet مصادق عليه، وfilters وprecision وnotional واستعادة انقطاع حقيقي.
- تحقق فعلي من IP الخادم وصلاحيات المفتاح ومنع السحب والتحويل في حساب البورصة.
- مراجعة أمنية بشرية واختبارات اختراق ومراقبة ونسخ احتياطي تشغيلي.
- محولات تنفيذ COIN-M والهامش وAlpha والأسهم؛ غير مكتملة ومغلقة.
- أسعار سوق موثقة لمحاكاة PAPER ووقف/هدف تلقائي وmark-to-market؛
  المحاكي الحالي يعتمد أسعارًا يحددها المستخدم، لا الشموع ولا تنفيذ البورصة.

## اختبارات المتصفح

```bash
npx playwright install chromium
npm run test:e2e
```

ثلاثة اختبارات تعمل دون حساب. اختبارا Backend والـPAPER الفعليان المحليان يتطلبان
`M1_E2E_USERNAME` و`M1_E2E_PASSWORD` لحساب اختبار منفصل؛ لا تستخدم الإنتاج.
CI ينشئ SQLite وحسابًا مؤقتين ولا يضع أوامر بورصة.

يوجد `docker-check` لاختبار الحاويات في GitHub Actions باستخدام حساب
وSQLite معزولين: بناء، تحميل الواجهة، شراء/بيع PAPER وإعادة الطلب،
إعادة تشغيل Backend وبقاء الأرصدة والجلسات، CSV والإيقاف وإبطال الدخول.
لا تعتبر تعريف workflow إثبات نجاحه؛ راجع نتيجة التشغيل على SHA نفسه.
