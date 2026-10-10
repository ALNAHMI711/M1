# تقرير حالة مشروع M1 وخطة التسليم — 2026-10-10

> اقرأ أولًا `docs/RELEASE_DELIVERY_AR.md` و`docs/OPERATIONS_AR.md` لتعديلات
> التسليم اللاحقة. هذا الملف يصف الحالة السابقة، وليس شهادة جاهزية إنتاجية.

## المستودع والفرع وطلب الدمج
- المستودع: `ALNAHMI711/M1`
- فرع العمل: `integration/trading-platform-2026-10-07`
- طلب الدمج: PR #3 — Integrate trading research catalog and security hardening
- حالة PR عند إعداد التقرير: مفتوح، غير مدموج، وGitHub يعرضه قابلاً للدمج. لا تدمجه قبل مراجعة الملفات والاختبارات النهائية.
- رابط PR: https://github.com/ALNAHMI711/M1/pull/3
- آخر SHA جرى التحقق من تشغيل CI عليه عند إعداد التقرير: `e2f3fb3595bc3cb544738ffaea22af055dee3c8d`
- نتائج ذلك SHA: CI ناجح، security-audit ناجح، backend-check ناجح.
- ملاحظة: توجد commits أحدث من بعض ملخصات المحادثة السابقة؛ قبل أي عمل جديد اجلب HEAD الحالي للفرع وPR ونتائج Actions مرة أخرى، ولا تعتمد على SHA هذا إذا تحرك الفرع.

## الهدف المعماري
تطبيق تحليل/تحكم تداول عربي RTL. واجهة المتصفح تعرض بيانات السوق والمؤشرات فقط. أي تنفيذ مستقبلي يجب أن يكون في الخادم، خلف المصادقة والسياسات والمخاطر والموافقة والتدقيق. لا تعرض مفاتيح Binance أو Telegram للمتصفح.

مسار العمل المطلوب:
Market Data → Indicators/Signal Parser → Validation → Risk Gate → Approval → Execution Policy → Exchange Adapter → Persistent Audit/Reconciliation.

## ما هو موجود بحسب الملفات المتحققة في PR #3
### الواجهة/المؤشرات
- واجهة قائمة على Lightweight Charts ومكتبة مؤشرات واسعة.
- بيانات سوق عامة من Binance وWebSocket للسعر/الشموع.
- قائمة مؤشرات/بحث/قائمة متابعة وأطر زمنية وواجهة RTL.
- جرى إزالة استخدام innerHTML الديناميكي في مواضع محددة واستبداله بإنشاء عناصر DOM آمن.
- لا تعتبر واجهة المتصفح محرك تنفيذ أوامر.

### Backend / API
- FastAPI/Pydantic control plane ونقطة تحقق للإشارات.
- مصادقة JWT/password hash وأدوار/Scopes موجودة في `backend/app/auth.py`، لكن يلزم تدقيق التخزين الدائم للجلسات والإلغاء وتهيئة حساب المدير ومحددات المعدل قبل الإنتاج.
- Binance Spot REST client وUser Data Stream مع أساسيات reconnect/recovery، مع اختبارات.
- وحدات USDⓈ-M لتمثيل الحساب والأحداث والنقل الخاص وإعادة الاتصال والاستعادة وSnapshot gate وReconciliation.
- SQLite store لسجل الإشارات/أوامر التنفيذ/أحداث التدقيق.
- execution contract/boundary/mode policy/execution policy/service وrisk-gated executor موجودة، وتحتاج مراجعة تكاملية لضمان أن كل adapter لا يمكن الوصول إليه إلا عبر البوابة.
- Risk Gate أولي: score، RR، spread، slippage، daily loss، open risk، notional، kill switch.
- اختبارات backend متعددة تشمل المصادقة، حدود التنفيذ، سياسات الأوضاع، المخاطر، الاستعادة، وتحديثات أوامر USDⓈ-M.

### الوثائق/CI
- `SECURITY.md`
- `docs/INTEGRATION_CATALOG.md`
- `docs/INDICATOR_LIBRARY_REVIEW.md`
- `docs/SECURITY_AUDIT_2026-10-07.md`
- `docs/EXECUTION_POLICY.md`
- `backend/README.md`
- GitHub Actions: `.github/workflows/ci.yml`, `backend-check.yml`, `security-audit.yml`
- على SHA المذكور أعلاه كانت الفحوصات الثلاثة ناجحة؛ هذا ليس ضمانًا بأن HEAD الحالي لا يزال ناجحًا.

## ما لم يثبت أنه مكتمل — لا تدّعِ اكتماله
- لا يوجد اعتماد للإنتاج أو تصريح بأن التداول الحقيقي آمن. LIVE يبقى مغلقًا افتراضيًا.
- لا يوجد دليل موثق هنا على اختبار Testnet كامل من طرف إلى طرف باستخدام حساب/مفاتيح اختبار حقيقية.
- لا توجد مصادقة تشغيل إنتاجية متكاملة مع إدارة مستخدمين/جلسات دائمة/2FA وتحديد معدل شامل مؤكدة.
- لا توجد مراجعة أمنية مستقلة كاملة أو اختبار اختراق.
- لا توجد ضمانات بأن جميع قنوات الإشارة (Telegram/AI/Webhook/strategies) تمر دائمًا من نفس البوابة؛ يجب إثبات ذلك باختبارات تكامل.
- لا توجد في هذا التقرير نتيجة نشر إنتاجي VPS/Docker/HTTPS/monitoring/backup/restore مؤكدة.
- لا توجد أدلة كافية على أن جميع محولات Cross Margin وIsolated Margin وCOIN-M وAlpha والأسهم منفذة؛ تعامل معها كغير جاهزة إلى أن تُراجع الملفات والاختبارات.
- لا توجد ضمانات أرباح؛ أي إشارات أو backtest لا تضمن نتائج مستقبلية.

## خطة الإنجاز المتبقية — نفّذ بالترتيب
### P0 — تثبيت الحالة وتنظيف آمن
1. اجلب HEAD الحالي، PR #3، قائمة الملفات، ونتائج Actions الحالية.
2. أنشئ فرع تنظيف منفصل من فرع التكامل. لا تعدّل `main` ولا تدمج PR تلقائيًا.
3. افحص كل ملف/اعتمادية: هل مستخدم في build/runtime/test/docs؟ لا تحذف ملفات لمجرد أنها تبدو غير مهمة.
4. احذف فقط الملفات المولدة/الأسرار/المخلفات المثبت أنها غير مطلوبة، مع الحفاظ على lockfile وملفات النشر والاختبارات والمراجع القانونية.
5. راجع `package.json` وlockfile معًا. لا تستخدم `npm install` بدل `npm ci` في CI إلا لسبب موثق؛ افحص تغييرات الإصدارات ونتائج audit.
6. أضف هذا التقرير إلى README العربي/فهرس الوثائق كي لا تضيع نقطة التسليم.

### P1 — سلامة التنفيذ والمخاطر
1. ارسم خريطة كل استدعاء exchange order endpoint وابحث عن أي مسار يتجاوز `risk_gated_executor`.
2. اجعل Execution Adapter لا يقبل إلا طلبًا معتمدًا/متحققًا، وأضف اختبارات تثبت أن kill switch والرفض يمنعان أي network call.
3. تحقق من idempotency وإعادة التشغيل، stale/duplicate/conflicting events، وatomic DB updates.
4. ثبّت وضع التشغيل الافتراضي DEVELOPMENT/DRY_RUN/PAPER، وارفض LIVE إذا غاب أي شرط أمان.
5. أضف تحققًا server-side من عنوان IP الخارجي الموثوق، صلاحيات API، ورفض withdrawal/transfer؛ لا تعتمد على عنوان الهاتف.
6. اختبر REST signing، filters/precision/stepSize/minNotional، clock skew، rate limits، timeouts، retry safety، وعمليات partial fill/terminal states.
7. اختبر recovery من REST snapshot قبل السماح بأحداث stream، بما في ذلك listen-key/session expiry وإعادة تشغيل الخادم.

### P2 — المصادقة والبيانات
1. خزّن المستخدمين والجلسات وإبطالها والتدقيق في تخزين دائم؛ لا تستخدم in-memory revoked token set للإنتاج.
2. أضف rate limits، secure cookie/session policy إذا استُخدمت cookies، CSRF حيث يلزم، و2FA اختياريًا.
3. أضف تشفير أسرار على الخادم، redaction في logs، وفحص عدم تسريب المفاتيح.
4. اختبر authorization/IDOR وحدود الوصول بين المستخدمين/المشاريع.

### P3 — الاختبار والنشر
1. شغّل `python -m compileall app tests` و`pytest -q` داخل backend.
2. شغّل `npm ci` ثم typecheck/tests/build/audit وفق scripts الفعلية وlockfile.
3. اختبر كل workflows على HEAD الجديد حتى تنتهي؛ لا تعتبر in_progress نجاحًا.
4. اختبر Testnet end-to-end، مع إثبات أن لا أمر حقيقي يُرسل.
5. أضف Docker Compose وhealth/readiness endpoints وTLS reverse proxy وmonitoring وbackup/restore وخطة استرجاع.
6. لا تفعل LIVE إلا بعد مراجعة بشرية موثقة واستيفاء كل بوابات الأمان.

### P4 — وحدات المنصة المتبقية
- أكمل/وثّق كل Adapter على حدة: Spot، USDⓈ-M، COIN-M، Cross Margin، Isolated Margin، Alpha، Stocks.
- لا تضع علامة Ready على أي وحدة دون اختبارات عقد/محاكاة/اختبار رسمي مناسب.
- أكمل إدارة استراتيجيات المؤشرات، backtest واقعي بالرسوم والانزلاق وgap-through، وتجنب look-ahead في multi-timeframe.

## قواعد تنظيف المصادر الخارجية
- لا تنسخ مستودعات كاملة عشوائيًا.
- احتفظ بسجل المصدر والرخصة والملفات التي أُعيد استخدامها فعلًا.
- لا تحذف LICENSE/NOTICE/attribution اللازمة.
- إذا لم تكن رخصة مصدر ما واضحة، لا تنقل شيفرته؛ استخدمه كمرجع فقط.
- لا تضع مفاتيح API أو Telegram tokens أو ملفات `.env` في Git.

## نقطة تسليم لمساعد/مهندس آخر
ابدأ بقراءة هذا الملف و`SECURITY.md` و`docs/EXECUTION_POLICY.md` و`docs/INTEGRATION_CATALOG.md`. ثم افحص HEAD وPR #3 وActions الحالية من GitHub. لا تفترض أن التقرير بديل عن التحقق المباشر. حافظ على PR مفتوحًا حتى مراجعة التغييرات ونجاح CI/security على آخر SHA. لا تفتح LIVE ولا تدّعِ أن المشروع مكتمل أو مربح قبل استيفاء المعايير أعلاه.

## خلاصة الحالة
المشروع حاليًا أساس متقدم للتحليل وبنية backend وتجارب المخاطر/الاستعادة، لكنه ليس منتج تداول حقيقي مكتملًا أو معتمدًا للإنتاج. أهم الأولويات: تنظيف آمن قابل للمراجعة، ضمان أن لا تنفيذ يتجاوز Risk Gate، إكمال اختبار Testnet، ثم المصادقة والتخزين والنشر والتوثيق لكل adapter.
