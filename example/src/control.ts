/** Same-origin control API. Tokens never go to storage, URLs, or console logs. */
declare const __M1_API_BASE__: string;

export function attachControlPanel() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = el<HTMLDialogElement>('control-dialog');
  const form = el<HTMLFormElement>('login-form');
  let token = '';
  let busy = false;
  function message(text: string) { el('control-message').textContent = text; }
  function reset() {
    token = '';
    form.hidden = false;
    el('authenticated-controls').hidden = true;
    el('readiness-output').textContent = el('audit-output').textContent = '';
    el('paper-account-output').textContent = el('paper-result').textContent = '';
    el('paper-write-controls').hidden = true;
  }
  async function api(path: string, options: RequestInit = {}, format: 'json' | 'text' = 'json') {
    const response = await fetch(__M1_API_BASE__ + path, {
      ...options, credentials: 'same-origin', cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    if (response.status === 401) {
      reset();
      throw new Error('انتهت الجلسة أو بيانات الدخول غير صحيحة.');
    }
    if (response.status === 403) throw new Error('صلاحيات هذا الحساب لا تسمح بهذه العملية.');
    if (response.status === 429) throw new Error('تجاوزت حد المحاولات؛ انتظر دقيقة وأعد المحاولة.');
    if (!response.ok) {
      if (path.startsWith('/v1/paper/')) {
        const body = await response.json().catch(() => null);
        const reason = typeof body?.detail === 'string' ? body.detail : body?.detail?.reason;
        const labels: Record<string, string> = {
          kill_switch: 'مفتاح الإيقاف مفعّل.',
          paper_idempotency_conflict: 'استُخدم معرّف الأمر مع بيانات مختلفة. لم تُنفّذ تعبئة جديدة.',
          insufficient_paper_cash: 'الرصيد الافتراضي غير كافٍ.',
          insufficient_paper_position: 'الكمية تتجاوز المركز الافتراضي؛ البيع المكشوف ممنوع.',
          daily_loss_limit: 'بلغت خسائر اليوم حد الدخول المسموح.',
          open_risk_limit: 'مخاطر المراكز تتجاوز الحد المسموح.',
          paper_trade_risk_limit: 'مخاطرة الأمر تتجاوز الحد المسموح.',
          notional_limit: 'قيمة الأمر تتجاوز حد الخادم.',
          score_below_threshold: 'درجة الإشارة أقل من الحد المسموح.',
          reward_risk_below_threshold: 'العائد إلى المخاطرة أقل من الحد المسموح.',
          invalid_paper_risk_reward_levels: 'مستويات الدخول والوقف والهدف غير صالحة.',
          position_levels_mismatch: 'مستويات المركز المفتوح مختلفة؛ لا يمكن تغييرها ضمن زيادة الكمية.',
          spread_or_slippage_above_limit: 'افتراض السبريد أو الانزلاق يتجاوز الحد.',
          paper_position_count_limit: 'بلغت الحد الأقصى للمراكز الافتراضية.',
        };
        const text = typeof reason === 'string' ? reason.split(',').map(r => labels[r]).filter(Boolean).join(' ') : '';
        throw new Error(text || 'بيانات أمر PAPER غير صالحة أو إعدادات المحاكي ناقصة. لم تُرسل أي معاملة للبورصة.');
      }
      throw new Error('الخدمة غير متاحة أو الطلب غير صالح. تحقق من تشغيل Backend على نفس الموقع.');
    }
    return format === 'text' ? response.text() : response.json();
  }
  async function action(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.id !== 'control-close');
    buttons.forEach(b => { b.disabled = true; });
    try { await task(); } catch (error) {
      message(error instanceof Error && !error.message.includes('fetch') ? error.message : 'تعذر الاتصال بالخدمة. تحقق من إعداد الخادم.');
    } finally {
      busy = false;
      buttons.forEach(b => { b.disabled = false; });
    }
  }
  async function refresh() {
    const [status, audit] = await Promise.all([api('/v1/control/readiness'), api('/v1/control/audit?limit=20')]);
    el('readiness-output').textContent = JSON.stringify(status, null, 2);
    el('audit-output').textContent = JSON.stringify(audit.items, null, 2);
    message(status.kill_switch ? 'مفتاح الإيقاف مفعّل. لا توجد صلاحية لتداول حقيقي.' : 'حالة الخدمة محدودة؛ التداول الحقيقي معطّل.');
  }
  async function refreshPaper() {
    const account = await api('/v1/paper/account');
    const { recent_orders, ...summary } = account;
    el('paper-account-output').textContent = JSON.stringify({ ...summary, recent_order_count: recent_orders.length }, null, 2);
  }
  el('control-open').addEventListener('click', () => dialog.showModal());
  el('control-close').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const username = el<HTMLInputElement>('login-user').value;
    const password = el<HTMLInputElement>('login-password').value;
    el<HTMLInputElement>('login-password').value = '';
    void action(async () => {
      const result = await api('/v1/auth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      });
      token = result.access_token;
      const user = await api('/v1/auth/me');
      el('control-user').textContent = `${user.username} · ${user.role}`;
      form.hidden = true;
      el('authenticated-controls').hidden = false;
      el('paper-write-controls').hidden = !user.scopes.includes('paper:write');
      el('kill-on').hidden = el('kill-off').hidden = !user.scopes.includes('admin');
      await refresh();
      await refreshPaper();
    });
  });
  el('control-refresh').addEventListener('click', () => void action(refresh));
  el('control-logout').addEventListener('click', () => void action(async () => {
    try { await api('/v1/auth/logout', { method: 'POST' }); }
    finally { reset(); message('حُذفت الجلسة من الصفحة.'); }
  }));
  for (const [id, enabled] of [['kill-on', true], ['kill-off', false]] as const) {
    el(id).addEventListener('click', () => void action(async () => {
      await api('/v1/control/kill-switch', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      await refresh();
    }));
  }
  el<HTMLTextAreaElement>('signal-json').value = JSON.stringify({
    symbol: 'BTCUSDT', side: 'LONG', entry: 100, stop_loss: 90, take_profit: 120,
    score: 90, rr: 2, source: 'MANUAL', mode: 'PAPER', signal_id: 'manual-preview-001',
  }, null, 2);
  el('validate-signal').addEventListener('click', () => void action(async () => {
    let payload: unknown;
    try { payload = JSON.parse(el<HTMLTextAreaElement>('signal-json').value); }
    catch { throw new Error('صيغة JSON غير صالحة. لم يُرسل أي طلب.'); }
    const result = await api('/v1/signals/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    el('signal-output').textContent = JSON.stringify(result, null, 2);
    message('اكتمل التحقق فقط؛ لم يُرسل أمر تداول.');
  }));
  function preparePaper(side: 'BUY' | 'SELL') {
    el<HTMLTextAreaElement>('paper-json').value = JSON.stringify({
      mode: 'PAPER', client_order_id: `paper-${side.toLowerCase()}-${Date.now()}`,
      symbol: 'BTCUSDT', side, quantity: '1', price: side === 'BUY' ? '100' : '110',
      ...(side === 'BUY' ? { stop_loss: '90', take_profit: '125', score: 90 } : {}),
      spread_bps: '0', slippage_bps: '0',
    }, null, 2);
  }
  preparePaper('BUY');
  el('paper-buy-example').addEventListener('click', () => preparePaper('BUY'));
  el('paper-sell-example').addEventListener('click', () => preparePaper('SELL'));
  el('paper-refresh').addEventListener('click', () => void action(refreshPaper));
  el('paper-submit').addEventListener('click', () => void action(async () => {
    let payload: unknown;
    try { payload = JSON.parse(el<HTMLTextAreaElement>('paper-json').value); }
    catch { throw new Error('صيغة JSON غير صالحة؛ لم تتغير المحفظة الافتراضية.'); }
    const result = await api('/v1/paper/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    el('paper-result').textContent = JSON.stringify(result, null, 2);
    await refreshPaper();
    message(result.replayed ? 'إيصال سابق فقط؛ لم تُنفّذ تعبئة ثانية.' : 'اكتملت محاكاة PAPER فقط. لا أمر أو أموال في البورصة.');
  }));
  el('paper-export').addEventListener('click', () => void action(async () => {
    const csv = await api('/v1/paper/ledger.csv', {}, 'text');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'm1-paper-ledger.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('تم تصدير السجل الافتراضي لحسابك فقط.');
  }));
}
