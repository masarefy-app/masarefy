#!/usr/bin/env python3
"""
اختبارات الجودة لمصاريفي: الشكل على 3 مقاسات موبايل فاتح وغامق، وأسماء الأزرار،
والسرعة مع سنة كاملة من البيانات، والشغل من غير نت، وملف التطبيق والأيقونات.

التشغيل:  python3 tests/quality_test.py
"""
import functools, http.server, json, os, random, socketserver, struct, sys, threading, time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'results')
os.makedirs(OUT, exist_ok=True)
FONT = os.environ.get('MASAREFY_FONT')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % srv.server_address[1]

results, metrics = [], {}
def check(group, name, ok, got=None):
    results.append({'group': group, 'name': name, 'ok': bool(ok), 'got': got})
    print(('ok   ' if ok else 'FAIL ') + '[' + group + '] ' + name + ('' if ok else '   got=%r' % (got,)))

def year_of_data():
    """سنة كاملة: حوالي 5 مصاريف في اليوم، و6 فواتير."""
    random.seed(11)
    items = [('قهوة', 'fun-drinks', 20, 40), ('سوبرماركت', 'food-grocery', 150, 600), ('أوبر', 'tr-taxi', 40, 120),
             ('بنزين', 'tr-fuel', 300, 450), ('غدا', 'food-out', 50, 180), ('مترو', 'tr-public', 10, 20),
             ('صيدلية', 'health-pharmacy', 40, 300), ('شيبسي', 'fun-sweets', 10, 30), ('فراخ', 'food-meat', 150, 300)]
    entries, d, k = [], date(2025, 11, 1), 0
    while d <= date(2026, 11, 2):
        for _ in range(random.randint(2, 8)):
            n, c, lo, hi = random.choice(items)
            k += 1
            entries.append({'id': 'q%d' % k, 'date': d.isoformat(), 'name': n, 'amount': random.randint(lo, hi), 'cat': c, 'note': '', 'raw': '', 'ts': k})
        d += timedelta(days=1)
    bills = [{'id': 'qb%d' % i, 'name': n, 'amount': a, 'variable': a == 0, 'day': dd, 'remind': 1, 'time': '10:00', 'cat': c,
              'payments': {}, 'created': '2025-11-01'} for i, (n, a, dd, c) in enumerate([
                  ('إيجار', 3500, 1, 'dues-bills'), ('فاتورة النت', 450, 2, 'dues-bills'), ('فاتورة الكهربا', 0, 10, 'dues-bills'),
                  ('قسط العربية', 2500, 20, 'dues-install'), ('اشتراك الجيم', 400, 15, 'dues-bills'), ('نتفليكس', 120, 28, 'dues-bills')])]
    for b in bills:
        for m in range(11):
            y, mm = (2025 + (10 + m) // 12, (10 + m) % 12 + 1)
            b['payments']['%d-%02d' % (y, mm)] = {'paid': True, 'date': '%d-%02d-%02d' % (y, mm, min(b['day'], 28)), 'amount': b['amount'] or 600, 'entryId': None}
    return entries, bills

def run():
    entries, bills = year_of_data()
    with sync_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

        def new_ctx(w=390, scheme='light'):
            ctx = browser.new_context(viewport={'width': w, 'height': 800}, device_scale_factor=2, locale='ar-EG',
                                      timezone_id='Africa/Cairo', color_scheme=scheme, has_touch=True, is_mobile=True)
            if FONT:
                fb = open(FONT, 'rb').read()
                css = "@font-face{font-family:'Readex Pro';src:url(https://fonts.gstatic.com/r.ttf) format('truetype');font-weight:200 700}"
                ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=css))
                ctx.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=200, content_type='font/ttf', body=fb))
            return ctx

        errors = []
        def watch(pg):
            pg.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            pg.on('dialog', lambda d: d.accept())

        def seed(pg):
            pg.goto(BASE)
            pg.wait_for_selector('#q')
            pg.evaluate("([e, b]) => { const d = JSON.parse(localStorage.getItem('masarefy.v1') || 'null') || {}; "
                        "localStorage.setItem('masarefy.v1', JSON.stringify(Object.assign(d, { entries: e, bills: b, settings: Object.assign(d.settings || {}, { budget: 9000 }) }))); }",
                        [entries, bills])
            pg.clock.set_fixed_time(time.mktime((2026, 11, 2, 12, 0, 0, 0, 0, -1)))
            pg.reload()
            pg.wait_for_selector('#q')

        # ---------- الشكل: مفيش حاجة طالعة برّه الشاشة ----------
        views = ['today', 'log', 'bills', 'stats', 'cats', 'settings']
        overflow = []
        for w in (360, 390, 430):
            for scheme in ('light', 'dark'):
                ctx = new_ctx(w, scheme); pg = ctx.new_page(); watch(pg); seed(pg)
                for v in views:
                    pg.evaluate("v => location.hash = v", '#' + v); pg.wait_for_timeout(150)
                    sw = pg.evaluate('document.documentElement.scrollWidth')
                    if sw > w: overflow.append((w, scheme, v, sw))
                pg.evaluate("location.hash = '#today'"); pg.wait_for_timeout(100)
                pg.fill('#q', 'امبارح ركبت أوبر بـ 85 وشربت قهوة بـ 40 وفاتورة النت')
                pg.wait_for_timeout(100)
                if pg.evaluate('document.documentElement.scrollWidth') > w: overflow.append((w, scheme, 'draft', 0))
                for opener in ['#receipt .rrow', None]:
                    if opener and pg.locator(opener).count():
                        pg.click(opener + ' >> nth=0'); pg.wait_for_timeout(150)
                        if pg.evaluate("(s => !s.open || s.scrollWidth > s.clientWidth + 1)(document.querySelector('#sheet'))"): overflow.append((w, scheme, 'sheet-edit', 0))
                        pg.keyboard.press('Escape')
                pg.evaluate("location.hash = '#bills'"); pg.wait_for_timeout(150)
                pg.click('[data-action=bill-edit] >> nth=0'); pg.wait_for_timeout(150)
                if pg.evaluate("(s => !s.open || s.scrollWidth > s.clientWidth + 1)(document.querySelector('#sheet'))"): overflow.append((w, scheme, 'sheet-bill', 0))
                pg.keyboard.press('Escape')
                if w == 390:
                    pg.evaluate("location.hash = '#stats'"); pg.wait_for_timeout(150)
                    pg.screenshot(path=os.path.join(OUT, 'stats-%s.png' % scheme), full_page=True)
                ctx.close()
        check('الشكل', 'مفيش حاجة طالعة برّه الشاشة: 6 شاشات و3 شيتات × 3 مقاسات (360 و390 و430) × فاتح وغامق = 54 حالة', not overflow, overflow)

        # ---------- كل زرار وخانة ليهم اسم ----------
        ctx = new_ctx(); pg = ctx.new_page(); watch(pg); seed(pg)
        missing, total_controls = [], 0
        for v in views:
            pg.evaluate("v => location.hash = v", '#' + v); pg.wait_for_timeout(150)
            r = pg.evaluate("""() => {
              const els = [...document.querySelectorAll('button, a[href], input, select, textarea')].filter(e => e.offsetParent !== null || e.closest('dialog[open]'));
              const name = e => (e.getAttribute('aria-label') || e.textContent || '').trim() || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label') || e.getAttribute('title') || (e.type === 'file');
              return { n: els.length, bad: els.filter(e => !name(e)).map(e => e.outerHTML.slice(0, 80)) };
            }""")
            total_controls += r['n']; missing += r['bad']
        check('أسماء الأزرار', 'كل زرار وخانة ليهم اسم بيتقري (%d عنصر في 6 شاشات)' % total_controls, not missing, missing[:3])
        metrics['controls'] = total_controls

        # ---------- السرعة مع سنة بيانات ----------
        size_kb = pg.evaluate("Math.round(localStorage.getItem('masarefy.v1').length * 2 / 1024)")
        metrics['entries'] = len(entries); metrics['storage_kb'] = size_kb
        timing = {}
        for v in ['log', 'bills', 'stats', 'cats', 'today']:
            ms = []
            for _ in range(3):
                pg.evaluate("location.hash = '#settings'"); pg.wait_for_timeout(80)
                ms.append(pg.evaluate("""v => new Promise(res => {
                  const t0 = performance.now();
                  new MutationObserver((m, o) => { o.disconnect(); document.body.offsetHeight; requestAnimationFrame(() => res(performance.now() - t0)); }).observe(document.querySelector('#view'), { childList: true });
                  location.hash = v;
                })""", '#' + v))
            timing[v] = round(sorted(ms)[1], 1)
        pg.wait_for_timeout(100)
        typing = pg.evaluate("""() => { const q = document.querySelector('#q'); const out = [];
          for (let i = 0; i < 20; i++) { q.value = 'امبارح ركبت أوبر بـ 85 وشربت قهوة بـ 40 ' + i; const t0 = performance.now();
            q.dispatchEvent(new Event('input', { bubbles: true })); out.push(performance.now() - t0); }
          out.sort((a, b) => a - b); return out[10]; }""")
        timing['typing'] = round(typing, 2)
        metrics['timing_ms'] = timing
        slow = {k: v for k, v in timing.items() if v > 300}
        check('السرعة', 'مع %d مصروف (%d كيلوبايت): كل شاشة بتفتح وتترسم في أقل من 300 مللي ثانية' % (len(entries), size_kb), not slow, timing)
        check('السرعة', 'فهم الجملة وانت بتكتب أقل من 30 مللي ثانية (%s)' % timing['typing'], timing['typing'] < 30, timing['typing'])
        pg.evaluate("location.hash = '#stats'"); pg.wait_for_timeout(200)
        check('السرعة', 'شاشة الشهر بتعرض نوفمبر صح مع سنة بيانات', 'نوفمبر 2026' in pg.inner_text('.month-nav'))
        ctx.close()

        # ---------- من غير نت ----------
        ctx = new_ctx(); pg = ctx.new_page(); watch(pg)
        pg.goto(BASE); pg.wait_for_selector('#q'); pg.wait_for_timeout(1500)
        reg = pg.evaluate("navigator.serviceWorker.getRegistration().then(r => !!(r && (r.active || r.installing || r.waiting)))")
        pg.reload(); pg.wait_for_timeout(800)
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_selector('#q', timeout=5000)
        pg.fill('#q', 'قهوة 20'); pg.press('#q', 'Enter'); pg.wait_for_timeout(200)
        ok = 'قهوة' in pg.inner_text('#receipt')
        check('من غير نت', 'التطبيق بيفتح ويسجل من غير نت بعد أول مرة', reg and ok, (reg, ok))
        ctx.set_offline(False)
        errors_offline = [e for e in errors if 'net::' in e or 'Failed to load' in e]
        for e in errors_offline: errors.remove(e)
        ctx.close()

        # ---------- ملف التطبيق والأيقونات ----------
        ctx = new_ctx(); pg = ctx.new_page()
        man = pg.request.get(BASE + 'manifest.webmanifest').json()
        need = all(k in man for k in ('name', 'short_name', 'start_url', 'display', 'icons'))
        sizes_ok = True
        for ic in man['icons']:
            r = pg.request.get(BASE + ic['src'])
            body = r.body()
            w, h = struct.unpack('>II', body[16:24])
            sizes_ok = sizes_ok and r.ok and ('%dx%d' % (w, h)) == ic['sizes']
        apple = pg.request.get(BASE + 'icons/apple-touch-icon.png')
        check('التطبيق على الموبايل', 'ملف manifest كامل، و%d أيقونات بالمقاسات الصح، وأيقونة الآيفون 180' % len(man['icons']),
              need and sizes_ok and apple.ok and struct.unpack('>II', apple.body()[16:24]) == (180, 180))
        check('التطبيق على الموبايل', 'اختصارات الأيقونة: %s' % '، '.join(s['short_name'] for s in man.get('shortcuts', [])), len(man.get('shortcuts', [])) == 3)
        ctx.close()

        check('الأخطاء', 'مفيش errors في الكونسول', not errors, errors[:5])
        browser.close()

    ok = sum(r['ok'] for r in results)
    json.dump({'ok': ok, 'fail': len(results) - ok, 'checks': results, 'metrics': metrics},
              open(os.path.join(OUT, 'quality.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n%d ok, %d fail' % (ok, len(results) - ok))
    print(json.dumps(metrics, ensure_ascii=False))
    return len(results) - ok

if __name__ == '__main__':
    sys.exit(1 if run() else 0)
