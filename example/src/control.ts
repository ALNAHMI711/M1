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
  }
  async function api(path: string, options: RequestInit = {}) {
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
    if (!response.ok) throw new Error('الخدمة غير متاحة أو الطلب غير صالح. تحقق من تشغيل Backend على نفس الموقع.');
    return response.json();
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
      await refresh();
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
}
