#!/usr/bin/env python3
"""
دورة تست كاملة لمصاريفي: شهر استخدام حقيقي يوم بيوم، بأرقام معروفة.

بيشغّل التطبيق في Chrome على مقاس موبايل، ويحرّك الساعة يوم بيوم من سبتمبر لديسمبر 2026،
ويكتب المصاريف ويتكلم (بمايك وهمي) ويضيف الفواتير ويدفعها ويعدّل ويمسح،
وبعدين يقارن كل رقم بيظهر في الشاشات بحساب منفصل هنا (مش من كود التطبيق).

التشغيل:  python3 tests/cycle_test.py
المتطلبات: pip install playwright && playwright install chromium   (أو Chrome متسطب)
"""
import csv, io, json, os, re, sys, threading, functools, http.server, socketserver, tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'results')
os.makedirs(OUT, exist_ok=True)
TZ = ZoneInfo('Africa/Cairo')
FONT = os.environ.get('MASAREFY_FONT')  # اختياري: ملف خط Readex Pro لو مفيش نت

# ---------------- سيرفر محلي ----------------
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % srv.server_address[1]

# ---------------- النتايج ----------------
results = []
def check(group, name, ok, got=None, want=None):
    results.append({'group': group, 'name': name, 'ok': bool(ok), 'got': got, 'want': want})
    print(('ok   ' if ok else 'FAIL ') + '[' + group + '] ' + name + ('' if ok else '   got=%r want=%r' % (got, want)))
    return ok

def num(s):
    m = re.findall(r'-?[\d,]+(?:\.\d+)?', s or '')
    return float(m[0].replace(',', '')) if m else None

def fmt(n):
    n = round(n, 2)
    return ('{:,.2f}'.format(n)).rstrip('0').rstrip('.') if n % 1 else '{:,}'.format(int(n))

AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

# ---------------- الدفتر المتوقع (محسوب هنا، مش من التطبيق) ----------------
MAIN_OF = {
    'بقالة وسوبرماركت': 'أكل وشرب', 'لحوم وفراخ': 'أكل وشرب', 'خضار وفاكهة': 'أكل وشرب', 'أكل بره': 'أكل وشرب',
    'قهوة ومشروبات': 'رفاهيات', 'حلويات وسناكس': 'رفاهيات', 'خروجات وترفيه': 'رفاهيات', 'اشتراكات': 'رفاهيات', 'بلايستيشن': 'رفاهيات',
    'بنزين': 'مواصلات', 'أوبر وتاكسي': 'مواصلات', 'مواصلات عامة': 'مواصلات',
    'صيدلية وأدوية': 'صحة', 'دكاترة وتحاليل': 'صحة',
    'لبس وجزم': 'لبس وعناية', 'حلاقة وعناية': 'لبس وعناية', 'هدايا': 'مناسبات وهدايا',
    'فواتير شهرية': 'التزامات وأقساط', 'أقساط': 'التزامات وأقساط',
}
ledger = []  # (date, name, amount, sub)
def expect(d, name, amount, sub):
    ledger.append((d, name, amount, sub))

# ---------------- نموذج الفواتير المتوقع ----------------
BILLS = {}   # name -> dict(day, remind, created, amount, variable)
PAID = defaultdict(set)  # name -> {period}

def ym(d): return d.strftime('%Y-%m')
def add_months(d, n):
    y, m = d.year, d.month + n
    while m > 12: y, m = y + 1, m - 12
    while m < 1: y, m = y - 1, m + 12
    return date(y, m, 1)
def dim(d):
    return (add_months(d, 1) - timedelta(days=1)).day
def due(b, month_first):
    return date(month_first.year, month_first.month, min(b['day'], dim(month_first)))

def model_state(name, today):
    b = BILLS[name]
    m = today.replace(day=1); pm = add_months(m, -1); nm = add_months(m, 1)
    cm = b['created'].replace(day=1)
    if pm >= cm and ym(pm) not in PAID[name]:
        return 'overdue', ym(pm)
    if ym(m) in PAID[name]:
        dn = (due(b, nm) - today).days
        return ('soon' if dn <= b['remind'] else 'paid'), ym(nm)
    d = (due(b, m) - today).days
    return ('overdue' if d < 0 else 'today' if d == 0 else 'soon' if d <= b['remind'] else 'later'), ym(m)

def model_attention(today):
    return sorted(n for n in BILLS if model_state(n, today)[0] in ('overdue', 'today', 'soon'))

# ---------------- المتصفح ----------------
FAKE_SR = """
(() => {
  class FakeSR {
    constructor() { window.__sr.inst = this; window.__sr.created++; }
    start() { window.__sr.started++; }
    stop() { setTimeout(() => this.onend && this.onend(), 20); }
    abort() { this.stop(); }
  }
  window.__sr = { inst: null, created: 0, started: 0 };
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
  window.__sr.say = (text) => {
    const res = [[{ transcript: text }]]; res[0].isFinal = true;
    window.__sr.inst.onresult({ resultIndex: 0, results: res });
  };
  window.__sr.end = () => window.__sr.inst.onend();
})();
"""

def run():
    with sync_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ar-EG',
                                  timezone_id='Africa/Cairo', has_touch=True, is_mobile=True, accept_downloads=True)
        if FONT:
            fb = open(FONT, 'rb').read()
            css = "@font-face{font-family:'Readex Pro';src:url(https://fonts.gstatic.com/r.ttf) format('truetype');font-weight:200 700}"
            ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=css))
            ctx.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=200, content_type='font/ttf', body=fb))
        ctx.add_init_script(FAKE_SR)
        pg = ctx.new_page()
        errors = []
        pg.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('dialog', lambda d: d.accept())

        def go_day(d, hour=12, minute=0):
            t = datetime(d.year, d.month, d.day, hour, minute, tzinfo=TZ)
            pg.clock.set_fixed_time(t.timestamp())
            pg.goto(BASE + '?d=' + d.isoformat() + '#today')
            pg.wait_for_selector('#q')
            pg.wait_for_timeout(150)
            got = pg.evaluate("(() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0'); })()")
            assert got == d.isoformat(), (got, d)

        def say(text):
            pg.fill('#q', text)
            pg.wait_for_timeout(120)
            pg.press('#q', 'Enter')
            pg.wait_for_timeout(250)

        def data():
            return pg.evaluate("JSON.parse(localStorage.getItem('masarefy.v1'))")

        def tab(name):
            pg.click('.tab[data-go=%s]' % name)
            pg.wait_for_timeout(200)

        def badge():
            return 0 if not pg.is_visible('#billBadge') else int(pg.inner_text('#billBadge'))

        def banner():
            return pg.inner_text('#billsBanner') if pg.is_visible('#billsBanner') else ''

        def bill_id(name):
            return [b for b in data()['bills'] if b['name'] == name][0]['id']

        def day_check(d):
            # التنبيه والرقم على تاب الفواتير زي النموذج
            want = model_attention(d)
            check('الفواتير يوم بيوم', d.isoformat() + ': عدد الفواتير في التنبيه', badge() == len(want), badge(), len(want))
            # مجموع اليوم في البيانات زي الدفتر
            got = sum(e['amount'] for e in data()['entries'] if e['date'] == d.isoformat())
            exp = sum(x[2] for x in ledger if x[0] == d.isoformat())
            check('إجمالي كل يوم', d.isoformat() + ': مجموع مصاريف اليوم', abs(got - exp) < 0.001, got, exp)

        # ============ سبتمبر ============
        go_day(date(2026, 9, 5)); say('سوبرماركت 600'); expect('2026-09-05', 'سوبرماركت', 600, 'بقالة وسوبرماركت')
        go_day(date(2026, 9, 12)); say('بنزين 400'); expect('2026-09-12', 'بنزين', 400, 'بنزين')
        go_day(date(2026, 9, 20)); say('قهوة 30 وشاورما 90')
        expect('2026-09-20', 'قهوة', 30, 'قهوة ومشروبات'); expect('2026-09-20', 'شاورما', 90, 'أكل بره')
        go_day(date(2026, 9, 28)); say('كشف دكتور 350'); expect('2026-09-28', 'كشف دكتور', 350, 'دكاترة وتحاليل')

        # ============ أكتوبر ============
        d = date(2026, 10, 1); go_day(d)
        pg.click('#settingsBtn'); pg.wait_for_timeout(150)
        pg.fill('#setBudget', '15000'); pg.press('#setBudget', 'Tab'); pg.wait_for_timeout(150)
        check('الإعدادات', 'الميزانية اتحفظت 15,000', data()['settings']['budget'] == 15000, data()['settings']['budget'], 15000)
        tab('today')
        say('الإيجار 3500 أول كل شهر')
        BILLS['إيجار'] = dict(day=1, remind=1, created=d, amount=3500)
        say('فاتورة النت 450 كل شهر يوم 5')
        BILLS['فاتورة النت'] = dict(day=5, remind=1, created=d, amount=450)
        say('فاتورة الكهربا كل شهر يوم 10')
        BILLS['فاتورة الكهربا'] = dict(day=10, remind=1, created=d, amount=0)
        say('قسط العربية 2500 يوم 20 من كل شهر')
        BILLS['قسط العربية'] = dict(day=20, remind=1, created=d, amount=2500)
        bills = {b['name']: b for b in data()['bills']}
        check('الفواتير', 'اتضافت 4 فواتير بالكلام', sorted(bills) == sorted(BILLS), sorted(bills), sorted(BILLS))
        check('الفواتير', 'أيام الفواتير 1 و5 و10 و20', all(bills[n]['day'] == BILLS[n]['day'] for n in BILLS), {n: bills[n]['day'] for n in bills})
        check('الفواتير', 'الكهربا مبلغها بيتغير', bills['فاتورة الكهربا']['variable'] is True)
        check('الفواتير', 'القسط تحت «أقساط» والباقي «فواتير شهرية»',
              bills['قسط العربية']['cat'] == 'dues-install' and all(bills[n]['cat'] == 'dues-bills' for n in ('إيجار', 'فاتورة النت', 'فاتورة الكهربا')),
              {n: bills[n]['cat'] for n in bills})
        check('الفواتير يوم بيوم', '2026-10-01: الإيجار معادها النهارده في التنبيه', 'إيجار' in banner() and 'معادها النهارده' in banner(), banner())
        pg.click('#billsBanner [data-action=bill-pay]'); pg.wait_for_timeout(250)
        PAID['إيجار'].add('2026-10'); expect('2026-10-01', 'إيجار', 3500, 'فواتير شهرية')
        say('قهوة 25'); expect('2026-10-01', 'قهوة', 25, 'قهوة ومشروبات')
        day_check(d)

        d = date(2026, 10, 2); go_day(d)
        say('اشتريت عيش ب 10 وجبنة ب 45')
        expect('2026-10-02', 'عيش', 10, 'بقالة وسوبرماركت'); expect('2026-10-02', 'جبنة', 45, 'بقالة وسوبرماركت')
        day_check(d)

        d = date(2026, 10, 3); go_day(d)
        say('امبارح ركبت أوبر 70'); expect('2026-10-02', 'أوبر', 70, 'أوبر وتاكسي')
        check('التواريخ', '«امبارح» اتسجل يوم 2 أكتوبر', any(e['name'] == 'أوبر' and e['date'] == '2026-10-02' for e in data()['entries']))
        check('التواريخ', 'بعد «امبارح» الفاتورة بتوريك يوم 2، والمصروف الجاي بيرجع للنهارده', 'النهارده' in pg.inner_text('#draft .date-chip') if pg.locator('#draft .date-chip').count() else True)
        pg.fill('#q', 'قهوة'); pg.wait_for_timeout(100)
        check('التواريخ', 'المصروف الجاي بعد «امبارح» معروض على «النهارده»', 'النهارده' in pg.inner_text('#draft .date-chip'), pg.inner_text('#draft'))
        say('قهوة ٢٥'); expect('2026-10-03', 'قهوة', 25, 'قهوة ومشروبات')
        day_check(d); day_check(date(2026, 10, 2))

        d = date(2026, 10, 4); go_day(d)
        check('الفواتير يوم بيوم', '2026-10-04: النت «معادها بكرة»', 'فاتورة النت' in banner() and 'معادها بكرة' in banner(), banner())
        say('كشري بخمسة وتلاتين'); expect('2026-10-04', 'كشري', 35, 'أكل بره')
        day_check(d)

        d = date(2026, 10, 5); go_day(d)
        check('الفواتير يوم بيوم', '2026-10-05: النت «معادها النهارده»', 'معادها النهارده' in banner(), banner())
        pg.fill('#q', 'دفعت فاتورة النت'); pg.wait_for_timeout(150)
        check('الفواتير', '«دفعت فاتورة النت» من غير مبلغ بياخد 450 من الفاتورة',
              'اتدفعت لشهر أكتوبر' in pg.inner_text('#draft') and '450' in pg.inner_text('#draft'), pg.inner_text('#draft'))
        pg.press('#q', 'Enter'); pg.wait_for_timeout(250)
        PAID['فاتورة النت'].add('2026-10'); expect('2026-10-05', 'فاتورة النت', 450, 'فواتير شهرية')
        day_check(d)

        d = date(2026, 10, 6); go_day(d); say('سوبرماركت كارفور 820'); expect('2026-10-06', 'سوبرماركت كارفور', 820, 'بقالة وسوبرماركت'); day_check(d)
        d = date(2026, 10, 7); go_day(d); say('بنزين 400'); expect('2026-10-07', 'بنزين', 400, 'بنزين'); day_check(d)

        d = date(2026, 10, 8); go_day(d)
        pg.fill('#q', 'سهرة مع صحابي 300'); pg.wait_for_timeout(150)
        check('التصنيف والتعلم', '«سهرة مع صحابي» بند مش معروف', 'مش عارف البند' in pg.inner_text('#draft'))
        pg.click('[data-action=draft-cat]'); pg.wait_for_timeout(200)
        pg.click('#picker [data-pick="fun-outing"]'); pg.wait_for_timeout(200)
        pg.press('#q', 'Enter'); pg.wait_for_timeout(250)
        expect('2026-10-08', 'سهرة مع صحابي', 300, 'خروجات وترفيه')
        day_check(d)

        d = date(2026, 10, 9); go_day(d)
        check('الفواتير يوم بيوم', '2026-10-09: الكهربا «معادها بكرة»', 'فاتورة الكهربا' in banner() and 'معادها بكرة' in banner(), banner())
        say('صيدلية 135'); expect('2026-10-09', 'صيدلية', 135, 'صيدلية وأدوية'); day_check(d)

        d = date(2026, 10, 10); go_day(d)
        pg.click('#billsBanner [data-action=bill-pay]'); pg.wait_for_timeout(250)
        check('الفواتير', 'الكهربا بتسأل «دفعت كام؟»', 'دفعت كام' in pg.inner_text('#sheet'))
        pg.fill('#pAmt', '640'); pg.click('[data-action=bill-pay-save]'); pg.wait_for_timeout(250)
        PAID['فاتورة الكهربا'].add('2026-10'); expect('2026-10-10', 'فاتورة الكهربا', 640, 'فواتير شهرية')
        day_check(d)

        d = date(2026, 10, 11); go_day(d); say('قهوة 25 + شيبسي 15')
        expect('2026-10-11', 'قهوة', 25, 'قهوة ومشروبات'); expect('2026-10-11', 'شيبسي', 15, 'حلويات وسناكس'); day_check(d)
        d = date(2026, 10, 12); go_day(d); say('لحمة 450'); expect('2026-10-12', 'لحمة', 450, 'لحوم وفراخ'); day_check(d)

        d = date(2026, 10, 13); go_day(d)
        pg.fill('#q', 'سهرة 200'); pg.wait_for_timeout(150)
        check('التصنيف والتعلم', '«سهرة» اتعلمها من تصليح 8 أكتوبر', 'خروجات وترفيه' in pg.inner_text('#draft'), pg.inner_text('#draft'))
        pg.press('#q', 'Enter'); pg.wait_for_timeout(250)
        expect('2026-10-13', 'سهرة', 200, 'خروجات وترفيه'); day_check(d)

        d = date(2026, 10, 14); go_day(d); say('ميكروباص 15'); expect('2026-10-14', 'ميكروباص', 15, 'مواصلات عامة'); day_check(d)

        # 15: صوت، بيتسجل لوحده لما تسكت
        d = date(2026, 10, 15); go_day(d)
        pg.click('#mic'); pg.wait_for_timeout(100)
        check('الصوت', 'المايك بيسمع بالمصري (ar-EG)', pg.evaluate('window.__sr.inst.lang') == 'ar-EG', pg.evaluate('window.__sr.inst.lang'))
        pg.evaluate("window.__sr.say('شربت قهوة بـ 30 وأكلت شاورما بـ 95')"); pg.wait_for_timeout(100)
        check('الصوت', 'الكلام ظهر وهو بيسمع ومتسجلش لسه', pg.locator('#draft .draft-item').count() == 2 and
              not any(e['date'] == '2026-10-15' for e in data()['entries']))
        pg.evaluate('window.__sr.end()'); pg.wait_for_timeout(300)
        expect('2026-10-15', 'قهوة', 30, 'قهوة ومشروبات'); expect('2026-10-15', 'شاورما', 95, 'أكل بره')
        check('الصوت', 'بعد ما سكت اتسجلوا لوحدهم ومعاهم «تراجع»', 'تراجع' in pg.inner_text('#toast'), pg.inner_text('#toast'))
        day_check(d)

        # 16: تعديل مبلغ
        d = date(2026, 10, 16); go_day(d); say('كوتشي جديد 1200')
        pg.click('#receipt .rrow:has-text("كوتشي")'); pg.wait_for_timeout(200)
        pg.fill('#eAmt', '1100'); pg.click('[data-action=edit-save]'); pg.wait_for_timeout(250)
        expect('2026-10-16', 'كوتشي جديد', 1100, 'لبس وجزم')
        check('تعديل ومسح', 'تعديل المبلغ من 1200 لـ 1100 ظهر في الفاتورة', num(pg.inner_text('#receipt .total .amt')) == 1100, pg.inner_text('#receipt .total'))
        day_check(d)

        d = date(2026, 10, 17); go_day(d); say('خضار 85'); expect('2026-10-17', 'خضار', 85, 'خضار وفاكهة'); day_check(d)
        d = date(2026, 10, 18); go_day(d); say('اشتراك نتفليكس 120'); expect('2026-10-18', 'اشتراك نتفليكس', 120, 'اشتراكات'); day_check(d)

        d = date(2026, 10, 19); go_day(d)
        check('الفواتير يوم بيوم', '2026-10-19: القسط «معادها بكرة»', 'قسط العربية' in banner() and 'معادها بكرة' in banner(), banner())
        say('قهوة 25'); expect('2026-10-19', 'قهوة', 25, 'قهوة ومشروبات'); day_check(d)

        d = date(2026, 10, 20); go_day(d); tab('bills')
        pg.click('[data-action=bill-pay][data-id="%s"]' % bill_id('قسط العربية')); pg.wait_for_timeout(250)
        PAID['قسط العربية'].add('2026-10'); expect('2026-10-20', 'قسط العربية', 2500, 'أقساط')
        tab('today'); day_check(d)

        # 21: صوت ودوست «سجّل» وهو لسه بيسمع
        d = date(2026, 10, 21); go_day(d)
        pg.click('#mic'); pg.evaluate("window.__sr.say('تذكرة سينما 150')"); pg.wait_for_timeout(100)
        pg.click('#draft [data-action=add]'); pg.wait_for_timeout(400)
        expect('2026-10-21', 'تذكرة سينما', 150, 'خروجات وترفيه')
        check('الصوت', '«سجّل» وهو بيسمع سجّل مرة واحدة بس',
              sum(1 for e in data()['entries'] if e['date'] == '2026-10-21') == 1)
        day_check(d)

        # 22: مسح غلطة
        d = date(2026, 10, 22); go_day(d); say('سوبرماركت 640')
        pg.click('#receipt .rrow:has-text("سوبرماركت")'); pg.wait_for_timeout(200)
        pg.click('[data-action=edit-del]'); pg.wait_for_timeout(250)
        check('تعديل ومسح', 'المسح شال الـ 640', not any(e['amount'] == 640 and e['date'] == '2026-10-22' for e in data()['entries']))
        say('سوبرماركت 460'); expect('2026-10-22', 'سوبرماركت', 460, 'بقالة وسوبرماركت'); day_check(d)

        # 23: بند فرعي جديد
        d = date(2026, 10, 23); go_day(d); tab('cats')
        pg.click('[data-action=cat-toggle][data-id=fun]'); pg.wait_for_timeout(150)
        pg.click('[data-action=cat-new][data-parent=fun]'); pg.wait_for_timeout(200)
        pg.fill('#cName', 'بلايستيشن'); pg.fill('#kwNew', 'بلايستيشن'); pg.click('[data-action=kw-add]')
        pg.click('[data-action=cat-save]'); pg.wait_for_timeout(200)
        tab('today'); say('بلايستيشن 60'); expect('2026-10-23', 'بلايستيشن', 60, 'بلايستيشن')
        check('البنود', 'البند الجديد «بلايستيشن» خد المصروف', 'رفاهيات › بلايستيشن' in pg.evaluate(
            "(() => { const d = JSON.parse(localStorage.getItem('masarefy.v1')); const e = d.entries.find(x => x.name === 'بلايستيشن'); const c = d.cats.find(x => x.id === e.cat); const m = d.cats.find(x => x.id === c.parent); return m.name + ' › ' + c.name; })()"))
        day_check(d)

        d = date(2026, 10, 24); go_day(d); say('هدية لماما 500'); expect('2026-10-24', 'هدية لماما', 500, 'هدايا'); day_check(d)

        # 25: زرار «بتكررهم»
        d = date(2026, 10, 25); go_day(d); say('مترو 20'); expect('2026-10-25', 'مترو', 20, 'مواصلات عامة')
        chips = pg.locator('#quick .chip').all_inner_texts()
        check('بتكررهم', '«قهوة 25» أول اختيار (اتكررت 4 مرات)', chips and chips[0].strip() == 'قهوة 25', chips)
        pg.click('#quick .chip >> nth=0'); pg.wait_for_timeout(250)
        expect('2026-10-25', 'قهوة', 25, 'قهوة ومشروبات'); day_check(d)

        d = date(2026, 10, 26); go_day(d); say('فراخ 210'); expect('2026-10-26', 'فراخ', 210, 'لحوم وفراخ'); day_check(d)

        # 27: تراجع
        d = date(2026, 10, 27); go_day(d); say('بنزين 350')
        pg.click('#toast button'); pg.wait_for_timeout(250)
        check('تعديل ومسح', '«تراجع» شال المصروف ورجّع الكلام', not any(e['date'] == '2026-10-27' for e in data()['entries']) and '350' in pg.input_value('#q'))
        pg.press('#q', 'Enter'); pg.wait_for_timeout(250)
        expect('2026-10-27', 'بنزين', 350, 'بنزين'); day_check(d)

        # 28: تسجيل ليوم فات
        d = date(2026, 10, 28); go_day(d); say('يوم 26 حلاقة 80'); expect('2026-10-26', 'حلاقة', 80, 'حلاقة وعناية')
        check('التواريخ', '«يوم 26» اتسجل يوم 26 أكتوبر', any(e['name'] == 'حلاقة' and e['date'] == '2026-10-26' for e in data()['entries']))
        day_check(d); day_check(date(2026, 10, 26))

        # 29: فتحت يوم 28 بنفسك وكتبت، فاتسجل يوم 28
        d = date(2026, 10, 29); go_day(d)
        pg.click('#receipt [data-action=day][data-step="-1"]'); pg.wait_for_timeout(100)
        say('مياه معدنية 10'); expect('2026-10-28', 'مياه معدنية', 10, 'قهوة ومشروبات')
        check('التواريخ', 'لما تفتح يوم 28 بنفسك وتكتب، المصروف بيتسجل يوم 28', any(e['name'] == 'مياه معدنية' and e['date'] == '2026-10-28' for e in data()['entries']))
        day_check(d); day_check(date(2026, 10, 28))

        # 30: الصوت والتسجيل اللوحده مقفول
        d = date(2026, 10, 30); go_day(d)
        pg.click('#settingsBtn'); pg.wait_for_timeout(150); pg.uncheck('#setVoice'); pg.wait_for_timeout(100); tab('today')
        pg.click('#mic'); pg.evaluate("window.__sr.say('عصير قصب 15')"); pg.evaluate('window.__sr.end()'); pg.wait_for_timeout(300)
        check('الصوت', 'لما «سجّل لوحده» مقفول، الكلام بيستنى «سجّل»', not any(e['date'] == '2026-10-30' for e in data()['entries'])
              and pg.locator('#draft .draft-item').count() == 1)
        pg.click('#draft [data-action=add]'); pg.wait_for_timeout(250)
        expect('2026-10-30', 'عصير قصب', 15, 'قهوة ومشروبات')
        pg.click('#settingsBtn'); pg.wait_for_timeout(150); pg.check('#setVoice'); tab('today')
        day_check(d)

        d = date(2026, 10, 31); go_day(d)
        check('الفواتير يوم بيوم', '2026-10-31: الإيجار بتاع 1 نوفمبر «معادها بكرة»', 'إيجار' in banner() and 'معادها بكرة' in banner(), banner())
        say('عشا 180'); expect('2026-10-31', 'عشا', 180, 'أكل بره'); day_check(d)

        # نص الليل والتطبيق مفتوح
        go_day(d, 23, 58)
        pg.clock.set_fixed_time(datetime(2026, 11, 1, 0, 2, tzinfo=TZ).timestamp())
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(200)
        lbl = pg.inner_text('#receipt .day-nav')
        check('التواريخ', 'بعد نص الليل والتطبيق مفتوح، اليوم بقى 1 نوفمبر', 'النهارده' in lbl and '1 نوفمبر' in lbl, lbl)

        # ============ نوفمبر ============
        d = date(2026, 11, 1); go_day(d)
        check('الفواتير يوم بيوم', '2026-11-01: الإيجار «معادها النهارده»', 'إيجار' in banner() and 'معادها النهارده' in banner(), banner())
        say('دفعت الإيجار 3500'); PAID['إيجار'].add('2026-11'); expect('2026-11-01', 'إيجار', 3500, 'فواتير شهرية')
        say('قهوة 30'); expect('2026-11-01', 'قهوة', 30, 'قهوة ومشروبات'); day_check(d)
        d = date(2026, 11, 2); go_day(d); say('بنزين 400'); expect('2026-11-02', 'بنزين', 400, 'بنزين'); day_check(d)

        # ============ مقارنة البيانات كلها بالدفتر ============
        db = data()
        cats = {c['id']: c for c in db['cats']}
        got = sorted((e['date'], e['name'], e['amount'], cats[e['cat']]['name']) for e in db['entries'])
        want = sorted(ledger)
        check('البيانات', 'كل المصاريف (%d) زي الدفتر بالظبط: التاريخ والاسم والمبلغ والبند' % len(want), got == want,
              [x for x in got if x not in want], [x for x in want if x not in got])

        def agg(month):
            rows = [x for x in ledger if x[0].startswith(month)]
            by_main, by_sub, by_day = defaultdict(float), defaultdict(float), defaultdict(float)
            for dd, n, a, s in rows:
                by_main[MAIN_OF[s]] += a; by_sub[s] += a; by_day[int(dd[8:])] += a
            return rows, by_main, by_sub, by_day

        # ============ شاشة «الشهر»: أكتوبر ============
        tab('stats'); pg.click('[data-action=month][data-step="-1"]'); pg.wait_for_timeout(200)
        pg.click('[data-action=stats-open][data-id=fun]'); pg.wait_for_timeout(150)
        S = pg.evaluate("""() => {
          const q = s => document.querySelector(s), A = s => [...document.querySelectorAll(s)];
          return {
            total: q('.big-total .value').textContent, delta: q('.delta').textContent,
            left: q('.budget .left') && q('.budget .left').textContent,
            tiles: A('.tiles3 > div').map(d => d.textContent),
            legend: A('.leg').map(b => ({ n: b.querySelector('.nm').textContent, pc: b.querySelector('.pc').textContent, v: b.querySelector('.v').textContent })),
            subs: A('.sub-line').map(d => ({ n: d.querySelector('.nm').textContent, v: d.querySelector('.v').textContent })),
            days: A('.bar').map(b => b.getAttribute('aria-label')),
            top: A('.top-item').map(d => ({ n: d.querySelector('.main span').textContent, t: d.querySelectorAll('.main span')[1].textContent, v: d.querySelector('.val').textContent })),
            months: A('.months .mb').map(b => b.getAttribute('aria-label'))
          };
        }""")
        rows, by_main, by_sub, by_day = agg('2026-10')
        total = sum(x[2] for x in rows)
        sep_total = sum(x[2] for x in ledger if x[0].startswith('2026-09'))
        G = 'شاشة الشهر: أكتوبر'
        check(G, 'إجمالي أكتوبر = %s' % fmt(total), num(S['total']) == total, S['total'], total)
        pct = round(abs(total - sep_total) / sep_total * 100)
        check(G, 'المقارنة بسبتمبر (%s): أكتر بـ %d%%' % (fmt(sep_total), pct), ('أكتر من سبتمبر بـ %d%%' % pct) in S['delta'] and fmt(total - sep_total) in S['delta'], S['delta'])
        check(G, 'الميزانية 15,000: فاضل %s' % fmt(15000 - total), num(S['left']) == 15000 - total, S['left'], 15000 - total)
        check(G, 'متوسط اليوم = %d (÷31)' % round(total / 31), num(S['tiles'][0]) == round(total / 31), S['tiles'][0], round(total / 31))
        hd = max(by_day, key=lambda k: by_day[k])
        check(G, 'أعلى يوم = %s يوم %d' % (fmt(by_day[hd]), hd), num(S['tiles'][1]) == by_day[hd] and ('(%d)' % hd) in S['tiles'][1], S['tiles'][1])
        check(G, 'عدد المصاريف = %d' % len(rows), num(S['tiles'][2]) == len(rows), S['tiles'][2], len(rows))
        leg = {x['n']: x for x in S['legend']}
        for m_name, v in sorted(by_main.items(), key=lambda kv: -kv[1]):
            p_ = round(v / total * 100)
            check(G, 'بند %s = %s (%d%%)' % (m_name, fmt(v), p_), m_name in leg and num(leg[m_name]['v']) == v and num(leg[m_name]['pc']) == p_,
                  leg.get(m_name), (v, p_))
        check(G, 'ترتيب البنود من الأكبر للأصغر', [x['n'] for x in S['legend']] == [k for k, _ in sorted(by_main.items(), key=lambda kv: -kv[1])])
        subs = {x['n']: num(x['v']) for x in S['subs']}
        fun_subs = {s: v for s, v in by_sub.items() if MAIN_OF[s] == 'رفاهيات'}
        check(G, 'تفاصيل رفاهيات: ' + '، '.join('%s %s' % (k, fmt(v)) for k, v in sorted(fun_subs.items(), key=lambda kv: -kv[1])), subs == fun_subs, subs, fun_subs)
        bars = {int(re.search(r'يوم (\d+)', a).group(1)): num(a.split(':')[1]) for a in S['days']}
        bad = [k for k in range(1, 32) if bars.get(k) != by_day.get(k, 0)]
        check(G, 'التشارت اليومي: الـ 31 يوم كلهم زي الدفتر', not bad, {k: bars.get(k) for k in bad}, {k: by_day.get(k, 0) for k in bad})
        g = defaultdict(lambda: [0, 0])
        for dd, n, a, s in rows:
            g[n][0] += 1; g[n][1] += a
        top = sorted(g.items(), key=lambda kv: -kv[1][1])[:5]
        check(G, 'أكتر 5 حاجات: ' + '، '.join('%s %s' % (n, fmt(v[1])) for n, v in top),
              [(x['n'], num(x['v'])) for x in S['top']] == [(n, v[1]) for n, v in top], S['top'], top)
        mon = {re.sub(r':.*', '', a): num(a.split(':')[1]) for a in S['months']}
        check(G, 'آخر 6 شهور: سبتمبر %s وأكتوبر %s' % (fmt(sep_total), fmt(total)), mon.get('سبتمبر 2026') == sep_total and mon.get('أكتوبر 2026') == total, mon)

        # سبتمبر
        pg.click('[data-action=month][data-step="-1"]'); pg.wait_for_timeout(200)
        check('شاشة الشهر: سبتمبر', 'إجمالي سبتمبر = %s، ومفيش شهر قبله للمقارنة' % fmt(sep_total),
              num(pg.inner_text('.big-total .value')) == sep_total and 'مفيش مصاريف متسجلة في أغسطس' in pg.inner_text('.delta'))

        # نوفمبر لحد النهارده
        pg.click('[data-action=month][data-step="1"]'); pg.click('[data-action=month][data-step="1"]'); pg.wait_for_timeout(200)
        nrows, nmain, _, _ = agg('2026-11')
        ntot = sum(x[2] for x in nrows)
        oct_cmp = sum(x[2] for x in ledger if x[0].startswith('2026-10') and int(x[0][8:]) <= 2)
        G = 'شاشة الشهر: نوفمبر لحد يوم 2'
        check(G, 'إجمالي نوفمبر = %s' % fmt(ntot), num(pg.inner_text('.big-total .value')) == ntot, pg.inner_text('.big-total .value'))
        dl = pg.inner_text('.delta')
        pc2 = round(abs(ntot - oct_cmp) / oct_cmp * 100)
        check(G, 'بيقارن بأول يومين في أكتوبر (%s): %s بـ %d%%' % (fmt(oct_cmp), 'أكتر' if ntot > oct_cmp else 'أقل', pc2),
              ('لحد نفس اليوم بـ %d%%' % pc2) in dl, dl)
        left = 15000 - ntot
        per_day = left // 29
        bt = pg.inner_text('.budget')
        check(G, 'الميزانية: فاضل %s، يعني %s في اليوم لـ 29 يوم' % (fmt(left), fmt(per_day)), fmt(left) in bt and fmt(per_day) in bt and '29 يوم' in bt, bt)
        check(G, 'متوسط اليوم = %d (÷2)' % round(ntot / 2), num(pg.inner_text('.tiles3 > div')) == round(ntot / 2), pg.inner_text('.tiles3 > div'))

        # ============ شاشة «النهارده» ============
        tab('today')
        ms = pg.inner_text('#monthStrip')
        check('شاشة النهارده', 'شريط الشهر: %s من 15,000' % fmt(ntot), fmt(ntot) in ms and '15,000' in ms, ms)
        # ارجع يوم يوم لحد أول أكتوبر وقارن إجمالي كل يوم في الفاتورة
        bad = []
        for k in range(1, 33):
            pg.click('#receipt [data-action=day][data-step="-1"]'); pg.wait_for_timeout(40)
            dd = date(2026, 11, 2) - timedelta(days=k)
            exp = sum(x[2] for x in ledger if x[0] == dd.isoformat())
            tot = pg.locator('#receipt .total .amt')
            gotv = num(tot.inner_text()) if tot.count() else 0
            lbl = pg.inner_text('#receipt .day-nav')
            if gotv != exp or (str(dd.day) + ' ' + AR_MONTHS[dd.month - 1]) not in lbl:
                bad.append((dd.isoformat(), gotv, exp))
        check('شاشة النهارده', 'الفاتورة اليومية: 32 يوم ورا بعض (أكتوبر كله) نفس أرقام الدفتر', not bad, bad)

        # ============ السجل ============
        tab('log'); pg.click('[data-action=month][data-step="-1"]'); pg.wait_for_timeout(200)
        sub = pg.inner_text('.month-nav .mid span')
        check('السجل', 'أكتوبر: %d مصروف، %s ج' % (len(rows), fmt(total)), ('%d مصروف' % len(rows)) in sub and fmt(total) in sub, sub)
        pg.click('[data-action=log-main][data-id=fun]'); pg.wait_for_timeout(150)
        fun_rows = [x for x in rows if MAIN_OF[x[3]] == 'رفاهيات']
        h = pg.inner_text('#logList .hint')
        check('السجل', 'فلتر رفاهيات: %d مصروف بـ %s' % (len(fun_rows), fmt(sum(x[2] for x in fun_rows))),
              ('%d مصروف' % len(fun_rows)) in h and fmt(sum(x[2] for x in fun_rows)) in h, h)
        pg.click('[data-action=log-main][data-id=all]'); pg.wait_for_timeout(100)
        pg.fill('#logQ', 'شاورما'); pg.wait_for_timeout(150)
        sh = [x for x in rows if 'شاورما' in x[1]]
        h = pg.inner_text('#logList .hint')
        check('السجل', 'البحث «شاورما»: %s بـ %s' % (len(sh), fmt(sum(x[2] for x in sh))), fmt(sum(x[2] for x in sh)) in h, h)
        pg.fill('#logQ', ''); pg.wait_for_timeout(150)
        heads = pg.evaluate("[...document.querySelectorAll('#logList .log-day h2 span:last-child')].map(h => h.textContent)")
        days_with = sorted({x[0] for x in rows}, reverse=True)
        check('السجل', 'مجموع كل يوم في السجل (%d يوم فيهم مصاريف)' % len(days_with),
              [num(h_) for h_ in heads] == [sum(x[2] for x in rows if x[0] == dd) for dd in days_with], heads)

        # ============ البنود ============
        tab('cats')
        cm = pg.evaluate("[...document.querySelectorAll('.cat-head .open')].map(b => [b.querySelector('.titles b').textContent, b.querySelector('.sum').textContent])")
        cm = {a: num(b) for a, b in cm}
        bad = [k for k, v in cm.items() if v != nmain.get(k, 0)]
        check('البنود', 'مصاريف نوفمبر على كل بند رئيسي (' + '، '.join('%s %s' % (k, fmt(v)) for k, v in nmain.items()) + ')', not bad, {k: cm[k] for k in bad})

        # ============ الفواتير يوم 2 نوفمبر ============
        tab('bills')
        paid_now = 3500
        est = {'فاتورة النت': 450, 'فاتورة الكهربا': 640, 'قسط العربية': 2500}
        remaining = sum(est.values())
        sv = pg.inner_text('.bills-sum')
        check('الفواتير', 'نوفمبر: فاضل %s، واتدفع %s من %s، فاتورة واحدة من 4' % (fmt(remaining), fmt(paid_now), fmt(paid_now + remaining)),
              num(pg.inner_text('.bills-sum .value')) == remaining and ('اتدفع %s من %s' % (fmt(paid_now), fmt(paid_now + remaining))) in sv and 'فاتورة واحدة من 4' in sv, sv)
        rows_txt = pg.inner_text('#view')
        check('الفواتير', 'الكهربا متقدرة بآخر مبلغ (حوالي 640)', 'حوالي 640' in rows_txt)
        # التقويم
        pg.click('[data-action=bill-cal-all]'); pg.wait_for_timeout(200)
        hrefs = pg.eval_on_selector_all('.gcal-list a', 'els => els.map(e => decodeURIComponent(e.href))')
        with pg.expect_download() as dl:
            pg.click('[data-action=cal-ics]')
        ics = open(dl.value.path(), encoding='utf-8', newline='').read()
        unf = ics.replace('\r\n ', '')
        events = re.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', unf, re.S)
        ev = {}
        for e in events:
            s_ = re.search(r'SUMMARY:([^\r\n]*)', e).group(1)
            ev[s_] = (re.search(r'DTSTART:(\d{8})', e).group(1), re.search(r'RRULE:(.*)', e).group(1).strip())
        want_ev = {
            'فاتورة إيجار (3\\,500 ج)': ('20261130', 'FREQ=MONTHLY;BYMONTHDAY=-1'),
            'فاتورة النت (450 ج)': ('20261104', 'FREQ=MONTHLY;BYMONTHDAY=4'),
            'فاتورة الكهربا': ('20261109', 'FREQ=MONTHLY;BYMONTHDAY=9'),
            'فاتورة قسط العربية (2\\,500 ج)': ('20261119', 'FREQ=MONTHLY;BYMONTHDAY=19'),
        }
        check('التقويم', 'ملف التقويم: 4 فواتير بتتكرر كل شهر، والتنبيه قبل المعاد بيوم', ev == want_ev, ev, want_ev)
        check('التقويم', 'كل سطور الملف أقل من 75 بايت', all(len(l.encode()) <= 75 for l in ics.split('\r\n')))
        check('التقويم', 'لينكات Google Calendar الأربعة فيها التكرار', len(hrefs) == 4 and all('recur=RRULE:FREQ=MONTHLY' in h for h in hrefs), len(hrefs))
        pg.keyboard.press('Escape')

        # ============ Excel ============
        pg.click('#settingsBtn'); pg.wait_for_timeout(150)
        with pg.expect_download() as dl:
            pg.click('[data-action=csv]')
        raw = open(dl.value.path(), encoding='utf-8-sig').read()
        rdr = list(csv.reader(io.StringIO(raw)))
        amt_sum = sum(float(r[5]) for r in rdr[1:])
        check('Excel', 'الملف فيه %d صف (+ العناوين) ومجموعه %s' % (len(ledger), fmt(sum(x[2] for x in ledger))),
              len(rdr) - 1 == len(ledger) and abs(amt_sum - sum(x[2] for x in ledger)) < 0.001, (len(rdr) - 1, amt_sum))
        check('Excel', 'الأعمدة: التاريخ، اليوم، البند الرئيسي، البند، الوصف، المبلغ، ملاحظة', rdr[0] == ['التاريخ', 'اليوم', 'البند الرئيسي', 'البند', 'الوصف', 'المبلغ', 'ملاحظة'], rdr[0])

        # ============ نسخة احتياطية ومسح ورجوع ============
        before = data()
        with pg.expect_download() as dl:
            pg.click('[data-action=backup]')
        bpath = dl.value.path()
        pg.click('[data-action=wipe]'); pg.wait_for_timeout(300)
        check('النسخة الاحتياطية', 'المسح فضّى البيانات', len(data()['entries']) == 0 and len(data()['bills']) == 0)
        pg.click('#settingsBtn'); pg.wait_for_timeout(150)
        pg.set_input_files('#restoreFile', bpath); pg.wait_for_timeout(400)
        after = data()
        same = (after['entries'] == before['entries'] and after['bills'] == before['bills'] and after['cats'] == before['cats'])
        check('النسخة الاحتياطية', 'الرجوع من الملف رجّع كل حاجة زي ما هي (%d مصروف، %d فاتورة، %d بند)' %
              (len(before['entries']), len(before['bills']), len(before['cats'])), same)
        tab('stats'); pg.click('[data-action=month][data-step="-1"]'); pg.wait_for_timeout(200)
        check('النسخة الاحتياطية', 'إجمالي أكتوبر بعد الرجوع لسه %s' % fmt(total), num(pg.inner_text('.big-total .value')) == total)

        # ============ الفواتير لما المعاد يعدّي ============
        for dd, label in [(date(2026, 11, 4), 'النت «معادها بكرة»'), (date(2026, 11, 12), 'النت متأخرة 7 أيام والكهربا متأخرة يومين'),
                          (date(2026, 12, 2), 'النت والكهربا والقسط «متأخرة من نوفمبر»، والإيجار متأخرة يوم')]:
            go_day(dd)
            want = model_attention(dd)
            b = banner()
            ok = badge() == len(want)
            if dd.day == 4: ok = ok and 'معادها بكرة' in b
            if dd.day == 12: ok = ok and 'متأخرة 7 أيام، كانت يوم 5' in b and 'متأخرة يومين، كانت يوم 10' in b
            if dd.month == 12:
                tab('bills'); b = pg.inner_text('#view')
                ok = ok and b.count('متأخرة من نوفمبر') == 3 and 'متأخرة يوم، كانت يوم 1' in b
            check('الفواتير لما المعاد يعدّي', dd.isoformat() + ': ' + label + ' (العدد %d)' % len(want), ok, (badge(), b), want)

        check('الأخطاء', 'مفيش errors في الكونسول طول الدورة', not errors, errors[:5])
        browser.close()

    ok = sum(r['ok'] for r in results)
    summary = {'ok': ok, 'fail': len(results) - ok, 'entries': len(ledger), 'checks': results,
               'october_total': sum(x[2] for x in ledger if x[0].startswith('2026-10')),
               'september_total': sum(x[2] for x in ledger if x[0].startswith('2026-09')),
               'november_total': sum(x[2] for x in ledger if x[0].startswith('2026-11'))}
    json.dump(summary, open(os.path.join(OUT, 'cycle.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n%d ok, %d fail' % (ok, len(results) - ok))
    return len(results) - ok

if __name__ == '__main__':
    sys.exit(1 if run() else 0)
