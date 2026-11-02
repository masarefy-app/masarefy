/* مصاريفي: التطبيق */
(function () {
  'use strict';

  var M = window.Masarefy;
  var I = window.MasarefyIcons;
  var KEY = 'masarefy.v1';
  var VERSION = '1.1.1';
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

  /* ================= أدوات ================= */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayStr() { return M.ymd(new Date()); }
  function thisMonth() { return todayStr().slice(0, 7); }
  function parseD(s) { return M.toDate(s); }
  function addDaysStr(s, n) { return M.ymd(M.addDays(parseD(s), n)); }
  function addMonths(m, n) {
    var p = m.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthName(m) { return MONTHS[+m.split('-')[1] - 1]; }
  function monthFull(m) { return monthName(m) + ' ' + m.slice(0, 4); }
  function daysInMonth(m) { var p = m.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
  function yearSuffix(d) { return d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''; }
  function dayLong(s) { var d = parseD(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + yearSuffix(d); }
  function dayDate(s) { var d = parseD(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + yearSuffix(d); }
  function dayRel(s) {
    var t = todayStr();
    if (s === t) return 'النهارده';
    if (s === addDaysStr(t, -1)) return 'امبارح';
    if (s === addDaysStr(t, -2)) return 'أول امبارح';
    return null;
  }
  function dayShort(s) { return dayRel(s) || dayLong(s); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function cur() { return db.settings.currency || 'ج'; }
  function money(n) { return fmt(n) + '\u00a0' + cur(); }
  function plural(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return n + ' ' + few;
    return n + ' ' + many;
  }
  function nEntries(n) { return plural(n, 'مصروف واحد', 'مصروفين', 'مصاريف', 'مصروف'); }
  function nTimes(n) { return plural(n, 'مرة واحدة', 'مرتين', 'مرات', 'مرة'); }
  function nSubs(n) { return n ? plural(n, 'بند فرعي واحد', 'بندين فرعيين', 'بنود فرعية', 'بند فرعي') : 'من غير بنود فرعية'; }
  function nDays(n) { return plural(n, 'يوم واحد', 'يومين', 'أيام', 'يوم'); }
  function parseAmount(s) {
    var t = M.toLatinDigits(String(s || '')).replace(/٫/g, '.').replace(/[,٬\s]/g, '');
    var n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }
  function sum(list) { return list.reduce(function (s, e) { return s + (+e.amount || 0); }, 0); }
  function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
  function svg(n, s) { return I.svg(n, s); }

  /* ================= البيانات ================= */
  function freshDB() {
    return {
      v: 1,
      entries: [],
      cats: M.defaultCategories(),
      bills: [],
      settings: { currency: 'ج', budget: 0, theme: 'auto', learn: true, voiceAutoSave: true },
      meta: { created: Date.now(), lastBackup: null, billsCat: true }
    };
  }
  function migrate(d) {
    var f = freshDB();
    if (!d || typeof d !== 'object') return f;
    d.entries = Array.isArray(d.entries) ? d.entries.filter(function (e) { return e && e.date && isFinite(+e.amount); }) : [];
    d.cats = Array.isArray(d.cats) && d.cats.length ? d.cats : f.cats;
    d.settings = Object.assign({}, f.settings, d.settings || {});
    d.meta = Object.assign({}, f.meta, d.meta || {});
    d.cats.forEach(function (c) {
      c.kw = c.kw || [];
      c.learned = c.learned || [];
      if (!c.parent && c.budget == null) c.budget = 0;
      if (!c.parent && !c.color) c.color = '#555B66';
      if (!c.icon) c.icon = 'box';
    });
    if (!d.cats.some(function (c) { return c.id === 'other'; })) {
      d.cats.push(f.cats.filter(function (c) { return c.id === 'other'; })[0]);
    }
    d.bills = Array.isArray(d.bills) ? d.bills.filter(function (b) { return b && b.id && b.day; }) : [];
    d.bills.forEach(function (b) {
      b.payments = b.payments || {};
      if (b.remind == null) b.remind = 1;
      if (!b.time) b.time = '10:00';
      if (!b.created) b.created = M.ymd(new Date());
    });
    // بند «فواتير شهرية» تحت التزامات، مرة واحدة للبيانات القديمة
    if (!d.meta.billsCat) {
      d.meta.billsCat = true;
      var hasDues = d.cats.some(function (c) { return c.id === 'dues'; });
      if (hasDues && !d.cats.some(function (c) { return c.id === 'dues-bills'; })) {
        var last = -1;
        d.cats.forEach(function (c, i) { if (c.id === 'dues' || c.parent === 'dues') last = i; });
        var bc = f.cats.filter(function (c) { return c.id === 'dues-bills'; })[0];
        if (bc) d.cats.splice(last + 1, 0, bc);
      }
    }
    d.v = 1;
    return d;
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.warn(e); }
    return freshDB();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('مقدرتش أحفظ: مساحة المتصفح مليانة. نزّل نسخة احتياطية من الإعدادات.'); return false; }
  }

  var db = load();
  var idxCache = null;
  function index() { if (!idxCache) idxCache = M.buildIndex(db.cats); return idxCache; }
  function catsChanged() { idxCache = null; save(); }

  function cat(id) {
    for (var i = 0; i < db.cats.length; i++) if (db.cats[i].id === id) return db.cats[i];
    return otherCat();
  }
  function otherCat() { return db.cats.filter(function (c) { return c.id === 'other'; })[0]; }
  function mainOf(c) { return c.parent ? cat(c.parent) : c; }
  function mains() { return db.cats.filter(function (c) { return !c.parent; }); }
  function subsOf(id) { return db.cats.filter(function (c) { return c.parent === id; }); }
  function colorOf(c) { return mainOf(c).color || '#555B66'; }
  function catPath(c) { return c.parent ? mainOf(c).name + ' › ' + c.name : c.name; }
  function tile(c, cls, size) {
    return '<span class="tile ' + (cls || '') + '" style="--c:' + esc(colorOf(c)) + '">' + svg(c.icon, size || 18) + '</span>';
  }

  function entriesOn(day) {
    return db.entries.filter(function (e) { return e.date === day; }).sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  }
  function entriesIn(month) { return db.entries.filter(function (e) { return e.date.slice(0, 7) === month; }); }

  /* ================= الحالة والتنقل ================= */
  var ui = {
    view: 'today', day: todayStr(), logMonth: thisMonth(), statsMonth: thisMonth(),
    logQuery: '', logMain: 'all', statsOpen: null, statsDay: null, catsOpen: {},
    dayPinned: false, draftText: '', draftDate: null, draftRemind: 1, overrides: {}, listening: false, flash: [], quick: []
  };
  var VIEWS = { today: renderToday, log: renderLog, bills: renderBills, stats: renderStats, cats: renderCats, settings: renderSettings };
  var TITLES = { today: 'مصاريفي', log: 'السجل', bills: 'الفواتير', stats: 'الشهر', cats: 'البنود', settings: 'الإعدادات' };

  function goTo(v) {
    if (location.hash !== '#' + v) location.hash = v;
    else route();
  }
  function route() {
    var v = (location.hash || '').slice(1);
    if (!VIEWS[v]) v = 'today';
    if (ui.view !== v) stopListening(true);
    ui.view = v;
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    $('#title').textContent = TITLES[ui.view];
    $$('.tab').forEach(function (t) {
      if (t.dataset.go === ui.view) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    updateBadge();
    $('#backBtn').hidden = ui.view !== 'settings';
    $('#settingsBtn').hidden = ui.view === 'settings';
    VIEWS[ui.view]();
  }
  function refresh() {
    if (ui.view === 'today') { renderToday(); updateBadge(); }
    else render();
  }

  /* ================= النهارده ================= */
  var draft = { items: [], date: null, dateFound: false };

  function renderToday() {
    $('#view').innerHTML =
      '<div class="month-strip" id="monthStrip"></div>' +
      '<section class="card bills-banner" id="billsBanner" aria-label="فواتير قرب معادها" hidden></section>' +
      '<section class="card composer' + (ui.listening ? ' listening' : '') + '" id="composer" aria-label="سجّل مصروف">' +
      '<label for="q">صرفت إيه؟ اكتب أو اتكلم</label>' +
      '<div class="composer-row">' +
      '<textarea id="q" rows="1" placeholder="مثلًا: شربت قهوة بـ 20" enterkeyhint="done" autocomplete="off" spellcheck="false"></textarea>' +
      '<button class="mic" id="mic" type="button" data-action="mic"></button>' +
      '</div>' +
      '<div class="draft" id="draft" aria-live="polite"></div>' +
      '</section>' +
      '<div class="quick scroller" id="quick"></div>' +
      '<div class="receipt-wrap"><section class="receipt" id="receipt" aria-label="مصاريف اليوم"></section></div>';
    var q = $('#q');
    q.value = ui.draftText || '';
    autoGrow(q);
    renderMic();
    renderMonthStrip();
    renderBillsBanner();
    renderDraft();
    renderQuick();
    renderReceipt();
  }

  function renderMonthStrip() {
    var el = $('#monthStrip');
    if (!el) return;
    var m = thisMonth();
    var total = sum(entriesIn(m));
    var b = +db.settings.budget || 0;
    var label = monthName(m) + ' لحد النهارده';
    if (b > 0) {
      el.className = 'month-strip' + (total > b ? ' over' : '');
      el.innerHTML = '<div class="line"><span>' + label + '</span><span><b class="num">' + fmt(total) + '</b> من ' + fmt(b) + ' ' + esc(cur()) + '</span></div>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.min(100, total / b * 100) + '%"></span></span>';
    } else {
      el.className = 'month-strip';
      el.innerHTML = '<div class="line"><span>' + label + '</span><span><b class="num">' + fmt(total) + '</b> ' + esc(cur()) + '</span></div>';
    }
  }

  function computeDraft() {
    var q = $('#q');
    if (q) ui.draftText = q.value;
    var text = ui.draftText || '';
    if (!text.trim()) { draft = { items: [], date: null, dateFound: false, isBill: false }; return; }
    draft = M.parse(text, { categories: db.cats, index: index(), today: todayStr(), base: baseDay() });
    draft.items.forEach(function (it, i) {
      var o = ui.overrides[i];
      var overridden = o && o.name === it.name;
      if (overridden) it.cat = o.cat;
      if (it.bill) {
        // فاتورة جديدة بتتكرر كل شهر
        it.bill.guessed = !it.bill.day;
        if (!it.bill.day) it.bill.day = parseD(todayStr()).getDate();
        if (!overridden) it.cat = defaultBillCat(it.cat);
      } else {
        // يمكن تكون فاتورة موجودة واتدفعت
        var mb = matchBill(it.name);
        if (mb) {
          it.pay = mb;
          if (!overridden) it.cat = mb.bill.cat;
          if (!(it.amount > 0) && !mb.bill.variable && mb.bill.amount > 0) it.amount = mb.bill.amount;
        }
      }
    });
  }
  // اليوم اللي بيتسجل فيه أي مصروف من غير تاريخ: النهارده، إلا لو انت فتحت يوم تاني بنفسك
  function baseDay() { return ui.dayPinned ? ui.day : todayStr(); }
  function showDay(d) { if (d !== ui.day) { ui.day = d; ui.dayPinned = false; } }
  function draftDate() { return ui.draftDate || (draft.dateFound ? draft.date : baseDay()); }
  function draftReady() {
    return draft.items.length > 0 && draft.items.every(function (it) { return it.bill ? !!it.name : it.amount > 0; });
  }
  var REMIND_LABELS = { 0: 'فكّرني في نفس اليوم', 1: 'فكّرني قبلها بيوم', 3: 'فكّرني قبلها بـ 3 أيام' };

  function renderDraft() {
    var el = $('#draft');
    if (!el) return;
    computeDraft();
    var html = '';
    if (ui.listening) {
      html += '<div class="listen-note"><b>بسمعك…</b><span>قول اللي صرفته عادي، حتى لو أكتر من حاجة</span></div>';
    }
    var items = draft.items;
    if (items.length) {
      items.forEach(function (it, i) {
        var c = cat(it.cat);
        var unsure = it.cat === 'other';
        var sub, tileHtml;
        if (it.bill) {
          tileHtml = billTile({ name: it.name, cat: it.cat }, '', 19);
          sub = '<button type="button" class="link-btn" data-action="draft-bill" data-i="' + i + '">' +
            esc('فاتورة شهرية، كل شهر يوم ' + it.bill.day + (it.bill.guessed ? ' (دوس وغيّره)' : '')) + '</button>';
        } else if (it.pay) {
          tileHtml = '<span class="tile" style="--c:#157A57">' + svg('check', 19) + '</span>';
          sub = '<span class="paid-note">هتتعلّم إنها اتدفعت لشهر ' + monthName(it.pay.period) + '</span>';
        } else {
          tileHtml = tile(c, '', 19);
          sub = '<button type="button" class="link-btn' + (unsure ? ' unsure' : '') + '" data-action="draft-cat" data-i="' + i + '">' +
            esc(unsure ? 'مش عارف البند، دوس واختاره' : catPath(c)) + '</button>';
        }
        var amt;
        if (it.amount > 0) amt = '<span class="amt">' + fmt(it.amount) + ' <small>' + esc(cur()) + '</small></span>';
        else if (it.bill) amt = '<span class="amt est">بيتغير</span>';
        else amt = '<span class="amt missing">ناقص المبلغ</span>';
        html += '<div class="draft-item">' + tileHtml + '<span class="main"><span class="name">' + esc(it.name) + '</span>' + sub + '</span>' + amt + '</div>';
      });
      var n = items.length;
      var allBills = items.every(function (it) { return it.bill; });
      var label;
      if (allBills) label = n === 1 ? 'ضيف الفاتورة' : n === 2 ? 'ضيف الفاتورتين' : 'ضيف الـ ' + n + ' فواتير';
      else label = n === 1 ? 'سجّل' : n === 2 ? 'سجّل الاتنين' : 'سجّل الـ ' + n;
      var d = draftDate();
      var left = allBills
        ? '<button type="button" class="chip" data-action="draft-remind">' + svg('bell', 16) + '<span>' + REMIND_LABELS[ui.draftRemind] + '</span></button>'
        : '<label class="chip date-chip">' + svg('calendar', 16) + '<span>' + esc(dayShort(d)) + '</span>' +
          '<input type="date" id="draftDate" value="' + d + '" max="' + todayStr() + '" aria-label="يوم المصروف"></label>';
      html += '<div class="draft-foot">' + left +
        '<button type="button" class="btn solid" data-action="add"' + (draftReady() ? '' : ' disabled') + '>' + label + '</button>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  function renderMic() {
    var b = $('#mic');
    if (!b) return;
    b.innerHTML = ui.listening ? svg('stop', 22) : svg('mic', 24);
    b.setAttribute('aria-label', ui.listening ? 'وقّف التسجيل' : 'سجّل بصوتك');
    var c = $('#composer');
    if (c) c.classList.toggle('listening', ui.listening);
  }

  function addEntries(list, opts) {
    db.entries.push.apply(db.entries, list);
    save();
    ui.flash = list.map(function (a) { return a.id; });
    var msg = list.length === 1
      ? 'اتسجل: ' + list[0].name + ' ' + money(list[0].amount)
      : 'اتسجلوا ' + nEntries(list.length) + ' بـ ' + money(sum(list));
    var d = list[0].date;
    if (d !== todayStr()) msg += '، ' + dayShort(d);
    toast(msg, {
      action: 'تراجع',
      onAction: function () {
        var ids = list.map(function (a) { return a.id; });
        db.entries = db.entries.filter(function (e) { return ids.indexOf(e.id) < 0; });
        save();
        if (opts && opts.restoreText != null) ui.draftText = opts.restoreText;
        refresh();
        toast(opts && opts.restoreText ? 'اتلغى، والكلام رجع في الخانة لو حبيت تعدّله' : 'اتلغى');
      }
    });
  }

  function addDraft() {
    computeDraft();
    if (!draftReady()) return false;
    var d = draftDate();
    var raw = ui.draftText;
    var now = Date.now();
    var added = [], created = [], paid = [];
    draft.items.forEach(function (it, i) {
      if (it.bill) {
        var b = newBill({ name: it.name, amount: it.amount, day: it.bill.day, remind: ui.draftRemind, cat: it.cat });
        db.bills.push(b);
        created.push(b);
        return;
      }
      var e = { id: uid(), date: d, name: it.name, amount: it.amount, cat: it.cat, note: '', raw: raw, ts: now + i };
      if (it.pay) {
        e.billId = it.pay.bill.id;
        e.period = it.pay.period;
        it.pay.bill.payments[it.pay.period] = { paid: true, date: d, amount: it.amount, entryId: e.id };
        paid.push({ bill: it.pay.bill, period: it.pay.period });
      }
      added.push(e);
    });
    ui.draftText = '';
    ui.draftDate = null;
    ui.overrides = {};
    if (ui.view === 'today') {
      var q = $('#q');
      if (q) { q.value = ''; autoGrow(q); }
    }
    if (added.length) {
      showDay(d);
      db.entries.push.apply(db.entries, added);
      ui.flash = added.map(function (a) { return a.id; });
    }
    save();
    if (ui.view === 'today') { renderMonthStrip(); renderBillsBanner(); renderDraft(); renderQuick(); renderReceipt(); }
    updateBadge();

    function undo() {
      var ids = added.map(function (a) { return a.id; });
      db.entries = db.entries.filter(function (e) { return ids.indexOf(e.id) < 0; });
      paid.forEach(function (p) { delete p.bill.payments[p.period]; });
      var bids = created.map(function (b) { return b.id; });
      db.bills = db.bills.filter(function (b) { return bids.indexOf(b.id) < 0; });
      save();
      ui.draftText = raw;
      refresh();
      toast('اتلغى، والكلام رجع في الخانة لو حبيت تعدّله');
    }

    if (created.length && !added.length) {
      var b0 = created[0];
      var msg = created.length === 1
        ? 'اتضافت ' + b0.name + '، كل شهر يوم ' + b0.day
        : 'اتضافت ' + plural(created.length, 'فاتورة', 'فاتورتين', 'فواتير', 'فاتورة');
      var st = billState(b0);
      if (created.length === 1 && st.status === 'overdue') {
        toast(msg + '. معادها عدّى الشهر ده.', { action: 'اتدفعت خلاص', onAction: function () { markPaidNoEntry(b0, st.period); } });
      } else {
        toast(msg, { action: 'حطها في التقويم', onAction: function () { openCalendar(created.map(function (b) { return b.id; })); } });
      }
      return true;
    }
    var msg2;
    if (added.length === 1) msg2 = (paid.length ? 'اتسجلت ' : 'اتسجل: ') + added[0].name + ' ' + money(added[0].amount);
    else msg2 = 'اتسجلوا ' + nEntries(added.length) + ' بـ ' + money(sum(added));
    if (d !== todayStr()) msg2 += '، ' + dayShort(d);
    if (created.length) msg2 += '، واتضافت ' + plural(created.length, 'فاتورة', 'فاتورتين', 'فواتير', 'فاتورة');
    toast(msg2, { action: 'تراجع', onAction: undo });
    return true;
  }

  function frequent() {
    var since = addDaysStr(todayStr(), -60);
    var map = {};
    db.entries.forEach(function (e) {
      if (e.date < since) return;
      var k = M.normalize(e.name) + '|' + e.amount + '|' + e.cat;
      if (!map[k]) map[k] = { name: e.name, amount: e.amount, cat: e.cat, n: 0, last: 0 };
      map[k].n++;
      map[k].last = Math.max(map[k].last, e.ts || 0);
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n || b.last - a.last; })
      .slice(0, 5);
  }

  function renderQuick() {
    var el = $('#quick');
    if (!el) return;
    var list = frequent();
    ui.quick = list;
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span>بتكررهم:</span>' + list.map(function (x, i) {
      return '<button type="button" class="chip sm" data-action="quick" data-i="' + i + '" aria-label="سجّل ' + esc(x.name) + ' ' + esc(money(x.amount)) + '">' +
        esc(x.name) + ' ' + fmt(x.amount) + '</button>';
    }).join('');
  }

  function renderReceipt() {
    var el = $('#receipt');
    if (!el) return;
    var d = ui.day;
    var t = todayStr();
    var list = entriesOn(d);
    var rel = dayRel(d);
    var html = '<div class="day-nav">' +
      '<button type="button" class="icon-btn" data-action="day" data-step="-1" aria-label="اليوم اللي قبله">' + svg('chevR', 20) + '</button>' +
      '<label class="mid date-chip" style="height:auto"><b>' + esc(rel || DAYS[parseD(d).getDay()]) + '</b><span>' + esc(rel ? dayLong(d) : dayDate(d)) + '</span>' +
      '<input type="date" id="dayPick" value="' + d + '" max="' + t + '" aria-label="اختار يوم"></label>' +
      '<button type="button" class="icon-btn" data-action="day" data-step="1" aria-label="اليوم اللي بعده"' + (d >= t ? ' disabled' : '') + '>' + svg('chevL', 20) + '</button>' +
      '</div><div class="rule"></div>';
    if (!list.length) {
      html += d === t
        ? '<p class="empty"><b>لسه مفيش مصاريف النهارده</b>اكتب اللي صرفته فوق، أو دوس على المايك وقوله.</p>'
        : '<p class="empty"><b>مفيش مصاريف متسجلة في اليوم ده</b>' + (ui.dayPinned ? 'لو نسيت حاجة، اكتبها فوق وهتتسجل في اليوم ده.' : '') + '</p>';
    } else {
      list.forEach(function (e) {
        var c = cat(e.cat);
        html += '<button type="button" class="rrow' + (ui.flash.indexOf(e.id) >= 0 ? ' new' : '') + '" data-action="edit" data-id="' + e.id + '">' +
          tile(c, 'sm', 17) +
          '<span class="main"><span>' + esc(e.name) + '</span><span>' + esc(c.name) + '</span></span>' +
          '<span class="leader" aria-hidden="true"></span>' +
          '<span class="val">' + fmt(e.amount) + '</span></button>';
      });
      html += '<div class="total"><span>الإجمالي</span><span class="amt">' + fmt(sum(list)) + ' <small>' + esc(cur()) + '</small></span></div>';
    }
    el.innerHTML = html;
    ui.flash = [];
  }

  /* ================= الصوت ================= */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, recBase = '', recGot = false, recManual = false;

  function setListening(on) {
    ui.listening = on;
    renderMic();
    renderDraft();
  }
  function startListening() {
    if (!SR) {
      toast('المتصفح ده مش بيدعم التسجيل بالصوت. دوس على المايك اللي في الكيبورد واتكلم.');
      var q0 = $('#q'); if (q0) q0.focus();
      return;
    }
    try { rec = new SR(); } catch (e) { rec = null; toast('مقدرتش أشغّل المايك. استخدم مايك الكيبورد.'); return; }
    rec.lang = 'ar-EG';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    var q = $('#q');
    recBase = q && q.value.trim() ? q.value.trim() + '، ' : '';
    recGot = false;
    recManual = false;
    rec.onresult = function (ev) {
      var s = '';
      for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript;
      s = s.trim();
      if (s) recGot = true;
      var qq = $('#q');
      if (qq) { qq.value = recBase + s; autoGrow(qq); }
      ui.draftText = recBase + s;
      renderDraft();
    };
    rec.onerror = function (ev) {
      var m = {
        'not-allowed': 'اسمح للصفحة تستخدم المايك من إعدادات المتصفح، وجرّب تاني.',
        'service-not-allowed': 'التسجيل بالصوت مقفول هنا. استخدم مايك الكيبورد.',
        'no-speech': 'مسمعتش حاجة. دوس على المايك وجرّب تاني.',
        'audio-capture': 'مفيش مايك شغال على الجهاز.',
        'network': 'التسجيل بالصوت محتاج نت.'
      }[ev.error];
      if (m) toast(m);
    };
    rec.onend = function () {
      var manual = recManual;
      rec = null;
      setListening(false);
      if (!manual && recGot && db.settings.voiceAutoSave && ui.view === 'today') {
        computeDraft();
        if (draftReady()) addDraft();
      }
    };
    try { rec.start(); setListening(true); }
    catch (e) { rec = null; toast('مقدرتش أشغّل المايك. جرّب تاني.'); }
  }
  function stopListening(manual) {
    if (rec) { recManual = !!manual; try { rec.stop(); } catch (e) { } }
  }

  /* ================= السجل ================= */
  function monthNav(kind, m, sub) {
    var canNext = addMonths(m, 1) <= thisMonth();
    return '<div class="month-nav">' +
      '<button type="button" class="icon-btn" data-action="month" data-kind="' + kind + '" data-step="-1" aria-label="الشهر اللي قبله">' + svg('chevR', 20) + '</button>' +
      '<div class="mid"><b>' + monthFull(m) + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-action="month" data-kind="' + kind + '" data-step="1" aria-label="الشهر اللي بعده"' + (canNext ? '' : ' disabled') + '>' + svg('chevL', 20) + '</button>' +
      '</div>';
  }

  function renderLog() {
    var m = ui.logMonth;
    var all = entriesIn(m);
    var totals = {};
    all.forEach(function (e) { var mm = mainOf(cat(e.cat)); totals[mm.id] = (totals[mm.id] || 0) + (+e.amount); });
    var present = mains().filter(function (c) { return totals[c.id]; }).sort(function (a, b) { return totals[b.id] - totals[a.id]; });
    if (ui.logMain !== 'all' && !totals[ui.logMain]) ui.logMain = 'all';
    var html = monthNav('log', m, all.length ? nEntries(all.length) + '، ' + money(sum(all)) : 'مفيش مصاريف');
    html += '<label class="search">' + svg('search', 17) +
      '<input type="search" id="logQ" placeholder="دوّر: قهوة، بنزين، كارفور…" aria-label="دوّر في المصاريف" autocomplete="off"></label>';
    if (present.length > 1) {
      html += '<div class="scroller" role="group" aria-label="فلتر بالبند">' +
        '<button type="button" class="chip" data-action="log-main" data-id="all" aria-pressed="' + (ui.logMain === 'all') + '">الكل</button>' +
        present.map(function (c) {
          return '<button type="button" class="chip" data-action="log-main" data-id="' + c.id + '" aria-pressed="' + (ui.logMain === c.id) + '">' +
            '<span class="dot sm" style="--c:' + esc(c.color) + '"></span>' + esc(c.name) + '</button>';
        }).join('') + '</div>';
    }
    html += '<div id="logList" style="display:flex;flex-direction:column;gap:14px"></div>';
    $('#view').innerHTML = html;
    $('#logQ').value = ui.logQuery;
    renderLogList();
  }

  function renderLogList() {
    var el = $('#logList');
    if (!el) return;
    var m = ui.logMonth;
    var q = M.normalize(ui.logQuery);
    var list = entriesIn(m).filter(function (e) {
      var c = cat(e.cat);
      if (ui.logMain !== 'all' && mainOf(c).id !== ui.logMain) return false;
      if (!q) return true;
      return M.normalize(e.name + ' ' + (e.note || '') + ' ' + catPath(c) + ' ' + e.amount).indexOf(q) >= 0;
    });
    if (!list.length) {
      el.innerHTML = q
        ? '<p class="empty"><b>مفيش نتايج لـ «' + esc(ui.logQuery) + '»</b>جرّب كلمة تانية، أو شهر تاني.</p>'
        : '<p class="empty"><b>مفيش مصاريف في ' + monthFull(m) + '</b>المصاريف اللي هتسجلها هتظهر هنا متقسمة على الأيام.</p>';
      return;
    }
    var days = {};
    list.forEach(function (e) { (days[e.date] = days[e.date] || []).push(e); });
    var keys = Object.keys(days).sort().reverse();
    var html = '';
    if (q || ui.logMain !== 'all') {
      html += '<p class="hint" style="padding:0 4px">اللي ظاهر: ' + nEntries(list.length) + '، بـ ' + money(sum(list)) + '</p>';
    }
    keys.forEach(function (d) {
      var items = days[d].sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      var rel = dayRel(d);
      html += '<section class="log-day"><h2><span>' + esc(rel ? rel + '، ' + dayLong(d) : dayLong(d)) + '</span><span class="num">' + money(sum(items)) + '</span></h2>' +
        '<div class="card log-card">' + items.map(function (e) {
          var c = cat(e.cat);
          return '<button type="button" class="lrow" data-action="edit" data-id="' + e.id + '">' + tile(c, 'sm', 16) +
            '<span class="main"><span>' + esc(e.name) + '</span><span>' + esc(catPath(c)) + (e.note ? ' · ' + esc(e.note) : '') + '</span></span>' +
            '<span class="val">' + fmt(e.amount) + '</span></button>';
        }).join('') + '</div></section>';
    });
    el.innerHTML = html;
  }

  /* ================= الشهر ================= */
  function renderStats() {
    var m = ui.statsMonth;
    var t = todayStr();
    var isCur = m === thisMonth();
    var list = entriesIn(m);
    var total = sum(list);
    var dim = daysInMonth(m);
    var elapsed = isCur ? parseD(t).getDate() : dim;
    var html = monthNav('stats', m);

    if (!list.length) {
      html += '<p class="empty"><b>مفيش مصاريف في ' + monthFull(m) + '</b>' +
        (isCur ? 'أول ما تسجل مصاريف هتلاقي الإحصائيات هنا.' : 'جرّب شهر تاني.') + '</p>';
      html += monthsPanel(m);
      $('#view').innerHTML = html;
      return;
    }

    // الإجمالي والمقارنة
    var prevM = addMonths(m, -1);
    var prevAll = entriesIn(prevM);
    var prevCmp = isCur ? prevAll.filter(function (e) { return +e.date.slice(8) <= elapsed; }) : prevAll;
    var prevTotal = sum(prevCmp);
    var delta;
    if (!prevAll.length) {
      delta = '<span class="delta">مفيش مصاريف متسجلة في ' + monthName(prevM) + ' عشان نقارن</span>';
    } else {
      var diff = total - prevTotal;
      var base = monthName(prevM) + (isCur ? ' لحد نفس اليوم' : '');
      var pct = prevTotal ? Math.round(Math.abs(diff) / prevTotal * 100) : 100;
      if (Math.abs(diff) < 0.5) delta = '<span class="delta">زي ' + base + ' بالظبط</span>';
      else if (diff < 0) delta = '<span class="delta down">' + svg('down', 16) + 'أقل من ' + base + ' بـ ' + pct + '%، يعني وفّرت ' + money(-diff) + '</span>';
      else delta = '<span class="delta up">' + svg('up', 16) + 'أكتر من ' + base + ' بـ ' + pct + '% (' + money(diff) + ')</span>';
    }
    html += '<section class="big-total" aria-label="الإجمالي"><span class="label">صرفت في ' + monthName(m) + (isCur ? ' لحد النهارده' : '') + '</span>' +
      '<span class="value">' + fmt(total) + ' <small>' + esc(cur()) + '</small></span>' + delta + '</section>';

    // الميزانية
    var b = +db.settings.budget || 0;
    if (b > 0) {
      var left = b - total;
      var ratio = total / b;
      var cls = ratio > 1 ? ' over' : ratio >= 0.85 ? ' warn' : '';
      var perDay = '';
      if (isCur && left > 0) {
        var daysLeft = dim - elapsed + 1;
        perDay = '<span class="per-day">يعني تقدر تصرف حوالي ' + money(Math.floor(left / daysLeft)) + ' في اليوم لآخر الشهر (' + nDays(daysLeft) + ')</span>';
      }
      html += '<section class="card budget' + cls + '" aria-label="الميزانية"><div class="line"><span class="muted">من ميزانية ' + money(b) + '</span>' +
        '<span class="left">' + (left >= 0 ? 'فاضل ' + money(left) : 'عدّيت الميزانية بـ ' + money(-left)) + '</span></div>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.min(100, ratio * 100) + '%"></span></span>' + perDay + '</section>';
    }

    // أرقام سريعة
    var dayTot = [];
    for (var i = 0; i < dim; i++) dayTot.push(0);
    list.forEach(function (e) { dayTot[+e.date.slice(8) - 1] += +e.amount; });
    var maxV = Math.max.apply(null, dayTot);
    var maxDay = dayTot.indexOf(maxV) + 1;
    html += '<section class="card tiles3" aria-label="أرقام سريعة">' +
      '<div><b>' + fmt(Math.round(total / Math.max(1, elapsed))) + ' <small>' + esc(cur()) + '</small></b><span>متوسط اليوم</span></div>' +
      '<div><b>' + fmt(maxV) + ' <small>' + esc(cur()) + '</small></b><span>أعلى يوم (' + maxDay + ')</span></div>' +
      '<div><b>' + list.length + '</b><span>مصروف</span></div></section>';

    html += donutPanel(list, total);
    html += dailyPanel(m, dayTot, total, elapsed, isCur);
    html += topPanel(list);
    html += monthsPanel(m);
    $('#view').innerHTML = html;
  }

  function donutPanel(list, total) {
    var byMain = {};
    list.forEach(function (e) { var mm = mainOf(cat(e.cat)); byMain[mm.id] = (byMain[mm.id] || 0) + (+e.amount); });
    var rows = Object.keys(byMain).map(function (id) { return { c: cat(id), v: byMain[id] }; })
      .sort(function (a, b) { return b.v - a.v; });
    var r = 54, C = 2 * Math.PI * r, off = 0, gap = rows.length > 1 ? 1.5 : 0;
    var circles = rows.map(function (row) {
      var len = row.v / total * C;
      var dash = Math.max(0.01, len - gap);
      var col = esc(row.c.color);
      var s = '<circle cx="60" cy="60" r="' + r + '" stroke="' + col + '" style="stroke:color-mix(in srgb,' + col + ' var(--ink-pct),#fff)" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"' +
        (ui.statsOpen && ui.statsOpen !== row.c.id ? ' opacity="0.3"' : '') + '></circle>';
      off += len;
      return s;
    }).join('');
    var tStr = fmt(Math.round(total));
    var fs = tStr.length > 8 ? 12 : tStr.length > 6 ? 14 : 16;
    var html = '<section class="card panel" aria-label="صرفت على إيه"><h2 class="section-title">صرفت على إيه</h2>' +
      '<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="توزيع المصاريف على البنود">' +
      '<g transform="rotate(-90 60 60)" fill="none" stroke-width="13">' + circles + '</g>' +
      '<text x="60" y="60" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="currentColor">' + tStr + '</text>' +
      '<text x="60" y="75" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.65">' + esc(cur() === 'ج' ? 'جنيه' : cur()) + '</text></svg></div>' +
      '<div class="legend">';
    var max = rows.length ? rows[0].v : 1;
    rows.forEach(function (row) {
      var c = row.c;
      var pct = Math.round(row.v / total * 100);
      var leg = '<button type="button" class="leg" data-action="stats-open" data-id="' + c.id + '" aria-expanded="' + (ui.statsOpen === c.id) + '">' +
        '<span class="top-line"><span class="dot" style="--c:' + esc(c.color) + '"></span><span class="nm">' + esc(c.name) + '</span>' +
        (c.budget > 0 ? '<span class="of' + (row.v > c.budget ? ' over' : '') + '">من ' + fmt(c.budget) + '</span>' : '') +
        '<span class="pc">' + pct + '%</span><span class="v">' + fmt(row.v) + '</span></span>' +
        '<span class="bar-track"><span class="bar-fill" style="--c:' + esc(c.color) + ';width:' + (row.v / max * 100) + '%"></span></span></button>';
      if (ui.statsOpen === c.id) {
        var subT = {};
        list.forEach(function (e) {
          var ec = cat(e.cat);
          if (mainOf(ec).id !== c.id) return;
          var k = ec.parent ? ec.id : '_main';
          subT[k] = (subT[k] || 0) + (+e.amount);
        });
        var subs = Object.keys(subT).map(function (k) { return { name: k === '_main' ? c.name + ' (عام)' : cat(k).name, v: subT[k] }; })
          .sort(function (a, b) { return b.v - a.v; });
        var smax = subs.length ? subs[0].v : 1;
        leg = '<div class="leg-open">' + leg + '<div class="subs">' + subs.map(function (s) {
          return '<div class="sub-line"><span class="nm">' + esc(s.name) + '</span><span class="bar-track"><span class="bar-fill" style="--c:' + esc(c.color) + ';width:' + (s.v / smax * 100) + '%"></span></span><span class="v">' + fmt(s.v) + '</span></div>';
        }).join('') + '</div></div>';
      }
      html += leg;
    });
    return html + '</div></section>';
  }

  function dailyPanel(m, dayTot, total, elapsed, isCur) {
    var dim = dayTot.length;
    var max = Math.max.apply(null, dayTot) || 1;
    var H = 120;
    var bars = dayTot.map(function (v, i) {
      var future = isCur && i + 1 > elapsed;
      var h = future ? 0 : v > 0 ? Math.max(3, Math.round(v / max * H)) : 1;
      var cls = 'bar' + (future ? ' future' : '') + (v === max && v > 0 ? ' max' : '') + (ui.statsDay === i + 1 ? ' sel' : '');
      return '<button type="button" class="' + cls + '" style="height:' + h + 'px" data-action="stats-day" data-d="' + (i + 1) + '" aria-label="يوم ' + (i + 1) + ': ' + money(v) + '"' + (future ? ' disabled' : '') + '></button>';
    }).join('');
    var marks = [1, 5, 10, 15, 20, 25, dim];
    var labels = dayTot.map(function (v, i) { return '<span>' + (marks.indexOf(i + 1) >= 0 ? i + 1 : '') + '</span>'; }).join('');
    var avg = total / Math.max(1, elapsed);
    var avgY = Math.round(avg / max * H);
    var caption;
    if (ui.statsDay) {
      var dstr = m + '-' + String(ui.statsDay).padStart(2, '0');
      var de = entriesOn(dstr).sort(function (a, b) { return b.amount - a.amount; });
      var names = de.slice(0, 3).map(function (e) { return e.name; }).join('، ');
      caption = '<div class="day-caption"><p class="hint">' + esc(dayLong(dstr)) + ': <b style="color:var(--ink);font-weight:600">' + money(dayTot[ui.statsDay - 1]) + '</b>' +
        (names ? '، فيه ' + esc(names) + (de.length > 3 ? ' وغيرهم' : '') : '') + '</p>' +
        (de.length ? '<button type="button" class="btn soft sm" data-action="open-day" data-date="' + dstr + '">افتح اليوم</button>' : '') + '</div>';
    } else {
      var md = m + '-' + String(dayTot.indexOf(max) + 1).padStart(2, '0');
      caption = '<p class="hint">أعلى يوم ' + esc(dayLong(md)) + ': <b style="color:var(--ink);font-weight:600">' + money(max) + '</b>. دوس على أي يوم تشوف صرفت فيه إيه.</p>';
    }
    return '<section class="card panel" aria-label="كل يوم في الشهر"><h2 class="section-title">كل يوم في الشهر</h2>' +
      '<div class="bars-box" style="height:' + H + 'px"><div class="bars">' + bars + '</div>' +
      '<div class="avg-line" style="bottom:' + avgY + 'px"></div><span class="avg-label" style="bottom:' + avgY + 'px">المتوسط ' + fmt(Math.round(avg)) + '</span></div>' +
      '<div class="bar-labels" aria-hidden="true">' + labels + '</div>' + caption + '</section>';
  }

  function topPanel(list) {
    var g = {};
    list.forEach(function (e) {
      var k = M.normalize(e.name).replace(/\d+(\.\d+)?/g, '').replace(/^ال(?=\S{3,})/, '').trim() || M.normalize(e.name);
      if (!g[k]) g[k] = { name: e.name, n: 0, v: 0, cat: e.cat, ts: 0 };
      g[k].n++;
      g[k].v += +e.amount;
      if ((e.ts || 0) > g[k].ts) { g[k].ts = e.ts || 0; g[k].cat = e.cat; }
    });
    var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5);
    return '<section class="card panel" aria-label="أكتر حاجات صرفت عليها"><h2 class="section-title">أكتر حاجات صرفت عليها</h2><div>' +
      rows.map(function (r) {
        return '<div class="top-item">' + tile(cat(r.cat), 'sm', 16) + '<span class="main"><span>' + esc(r.name) + '</span><span>' + nTimes(r.n) + '</span></span><span class="val">' + fmt(r.v) + '</span></div>';
      }).join('') + '</div></section>';
  }

  function monthsPanel(m) {
    var data = [];
    for (var k = -5; k <= 0; k++) {
      var mm = addMonths(m, k);
      data.push({ m: mm, v: sum(entriesIn(mm)) });
    }
    if (!data.some(function (d) { return d.v > 0; })) return '';
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
    function short(v) {
      if (v >= 1000) return (Math.round(v / 100) / 10).toString() + ' ألف';
      return fmt(Math.round(v));
    }
    return '<section class="card panel" aria-label="آخر 6 شهور"><h2 class="section-title">آخر 6 شهور</h2>' +
      '<div class="months">' + data.map(function (d) {
        return '<div class="' + (d.m === m ? 'cur' : '') + '"><span class="mv">' + (d.v ? short(d.v) : '') + '</span>' +
          '<button type="button" class="mb" style="height:' + Math.max(2, Math.round(d.v / max * 84)) + 'px;border:0;padding:0" data-action="stats-month" data-m="' + d.m + '" aria-label="' + monthFull(d.m) + ': ' + money(d.v) + '"></button></div>';
      }).join('') + '</div>' +
      '<div class="month-names" aria-hidden="true">' + data.map(function (d) { return '<span>' + monthName(d.m) + '</span>'; }).join('') + '</div></section>';
  }

  /* ================= البنود ================= */
  function renderCats() {
    var m = thisMonth();
    var list = entriesIn(m);
    var byCat = {}, byMain = {};
    list.forEach(function (e) {
      var c = cat(e.cat);
      byCat[c.id] = (byCat[c.id] || 0) + (+e.amount);
      var mm = mainOf(c);
      byMain[mm.id] = (byMain[mm.id] || 0) + (+e.amount);
    });
    var anyLearned = db.cats.some(function (c) { return c.learned && c.learned.length; });
    var html = '<p class="hint" style="padding:0 4px">كل مصروف بيتحط تحت بند فرعي جوه بند رئيسي. التطبيق بيعرف البند من الكلمات اللي تحت كل بند، وبيزوّد عليها لما تصلّحله. الأرقام هنا بتاعة ' + monthName(m) + '.</p>';
    mains().forEach(function (mn) {
      var subs = subsOf(mn.id);
      var open = !!ui.catsOpen[mn.id];
      var t = byMain[mn.id] || 0;
      html += '<section class="card cat-card">' +
        '<div class="cat-head"><button type="button" class="open" data-action="cat-toggle" data-id="' + mn.id + '" aria-expanded="' + open + '">' +
        tile(mn, 'lg', 20) + '<span class="titles"><b>' + esc(mn.name) + '</b><span>' + (mn.id === 'other' && !subs.length ? 'أي حاجة التطبيق مش عارف بندها' : nSubs(subs.length)) + '</span></span>' +
        '<span class="sum' + (t ? '' : ' zero') + '">' + money(t) + '</span>' + svg(open ? 'chevU' : 'chevD', 18) + '</button>' +
        '<button type="button" class="icon-btn edit" data-action="cat-edit" data-id="' + mn.id + '" aria-label="عدّل ' + esc(mn.name) + '">' + svg('pencil', 16) + '</button></div>';
      if (mn.budget > 0) {
        html += '<div class="cat-budget"><span class="bar-track"><span class="bar-fill" style="--c:' + esc(mn.color) + ';width:' + Math.min(100, t / mn.budget * 100) + '%"></span></span><span>من ' + fmt(mn.budget) + '</span></div>';
      }
      if (open) {
        if ((mn.kw && mn.kw.length) || (mn.learned && mn.learned.length)) {
          html += '<button type="button" class="sub-row" data-action="cat-edit" data-id="' + mn.id + '"><span class="head"><span class="nm muted">كلمات «' + esc(mn.name) + '» نفسه</span></span>' + kwChips(mn) + '</button>';
        }
        subs.forEach(function (s) {
          var v = byCat[s.id] || 0;
          html += '<button type="button" class="sub-row" data-action="cat-edit" data-id="' + s.id + '">' +
            '<span class="head">' + tile(s, 'xs', 15) + '<span class="nm">' + esc(s.name) + '</span><span class="v' + (v ? '' : ' zero') + '">' + money(v) + '</span></span>' +
            kwChips(s) + '</button>';
        });
        html += '<button type="button" class="add-sub" data-action="cat-new" data-parent="' + mn.id + '">' + svg('plus', 16) + 'بند فرعي جديد تحت ' + esc(mn.name) + '</button>';
      }
      html += '</section>';
    });
    if (anyLearned) html += '<p class="learned-note"><span class="kw learned">كلمة</span>يعني اتعلمها من تصليحك</p>';
    html += '<button type="button" class="add-main" data-action="cat-new">' + svg('plus', 18) + 'بند رئيسي جديد</button>';
    $('#view').innerHTML = html;
  }

  function kwChips(c) {
    var learned = c.learned || [];
    var kw = c.kw || [];
    var all = learned.map(function (w) { return { w: w, l: true }; }).concat(kw.map(function (w) { return { w: w, l: false }; }));
    if (!all.length) return '<span class="kws"><span class="kw more">مفيش كلمات لسه</span></span>';
    var shown = all.slice(0, 6);
    return '<span class="kws">' + shown.map(function (x) {
      return '<span class="kw' + (x.l ? ' learned' : '') + '">' + (x.l ? svg('check', 11) : '') + esc(x.w) + '</span>';
    }).join('') + (all.length > 6 ? '<span class="kw more">و' + (all.length - 6) + ' كمان</span>' : '') + '</span>';
  }

  /* ================= الفواتير الشهرية ================= */
  var GENERIC = new Set(['فاتوره', 'فواتير', 'اشتراك', 'حساب', 'دفع', 'سداد', 'شهر', 'الشهر', 'شهري', 'شهريه', 'بتاع', 'بتاعت', 'بتاعه', 'مصاريف', 'قيمه']);
  function keyWords(name) {
    return M.normalize(name).split(' ').map(function (w) { return w.indexOf('ال') === 0 && w.length >= 4 ? w.slice(2) : w; })
      .filter(function (w) { return w.length >= 2 && !/\d/.test(w) && !GENERIC.has(w); });
  }
  function billById(id) { return db.bills.filter(function (b) { return b.id === id; })[0]; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dueDate(b, m) { return m + '-' + pad2(Math.min(b.day, daysInMonth(m))); }
  function diffDays(a, b) { return Math.round((parseD(a) - parseD(b)) / 86400000); }

  // حالة الفاتورة دلوقتي: متأخرة، النهارده، قربت، لسه، اتدفعت، مش هتتدفع
  function billState(b) {
    var t = todayStr(), m = thisMonth(), pm = addMonths(m, -1);
    var cm = (b.created || t).slice(0, 7);
    var pays = b.payments || {};
    if (pm >= cm && !pays[pm]) {
      var pd = dueDate(b, pm);
      return { bill: b, period: pm, due: pd, status: 'overdue', days: diffDays(pd, t) };
    }
    var due = dueDate(b, m), p = pays[m];
    if (p) {
      var nm = addMonths(m, 1), ndue = dueDate(b, nm), dn = diffDays(ndue, t);
      if (dn <= (b.remind || 0) && !pays[nm]) return { bill: b, period: nm, due: ndue, status: 'soon', days: dn };
      return { bill: b, period: m, due: due, status: p.paid ? 'paid' : 'skipped', days: diffDays(due, t), pay: p };
    }
    var d = diffDays(due, t);
    var s = d < 0 ? 'overdue' : d === 0 ? 'today' : d <= (b.remind || 0) ? 'soon' : 'later';
    return { bill: b, period: m, due: due, status: s, days: d };
  }
  var RANK = { overdue: 0, today: 1, soon: 2, later: 3, paid: 4, skipped: 5 };
  function sortStates(a, b) { return RANK[a.status] - RANK[b.status] || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0); }
  function billsAttention() {
    return db.bills.map(billState).filter(function (st) { return st.status === 'overdue' || st.status === 'today' || st.status === 'soon'; }).sort(sortStates);
  }
  function lastAmounts(b) {
    var pays = b.payments || {};
    return Object.keys(pays).sort().reverse().filter(function (k) { return pays[k].paid && pays[k].amount > 0; }).map(function (k) { return pays[k].amount; });
  }
  function billEstimate(b) { return b.variable ? (lastAmounts(b)[0] || b.amount || 0) : (b.amount || 0); }
  function billAmountHTML(b) {
    if (!b.variable) return '<span class="bill-amt">' + fmt(b.amount) + '</span>';
    var est = billEstimate(b);
    return '<span class="bill-amt est">' + (est ? 'حوالي ' + fmt(est) : 'بيتغير') + '</span>';
  }
  var BILL_ICONS = [
    [['نت', 'انترنت', 'واي', 'راوتر', 'وي', 'we', 'wifi'], 'wifi'], [['كهربا', 'كهربه'], 'bolt'], [['مياه', 'ميه', 'مايه'], 'droplet'],
    [['غاز'], 'flame'], [['ايجار', 'شقه', 'سكن'], 'key'], [['موبايل', 'تليفون', 'رصيد', 'باقه', 'خط'], 'phone'],
    [['قسط', 'اقساط', 'فيزا', 'بطاقه', 'قرض', 'فاليو', 'كريدت'], 'card'], [['جيم', 'نادي', 'تمرين'], 'dumbbell'],
    [['نتفليكس', 'شاهد', 'سبوتيفاي', 'انغامي', 'يوتيوب'], 'tv'], [['مدرسه', 'جامعه', 'كورس', 'دروس', 'باص'], 'book'],
    [['عربيه', 'تامين', 'جراج'], 'car'], [['جمعيه', 'سلف'], 'repeat']
  ];
  function billIcon(b) {
    var ws = M.normalize(b.name).split(' ').map(function (w) { return w.indexOf('ال') === 0 && w.length >= 4 ? w.slice(2) : w; });
    for (var i = 0; i < BILL_ICONS.length; i++) {
      for (var j = 0; j < BILL_ICONS[i][0].length; j++) if (ws.indexOf(BILL_ICONS[i][0][j]) >= 0) return BILL_ICONS[i][1];
    }
    var c = cat(b.cat);
    return c.icon || 'calendarClock';
  }
  function billTile(b, cls, size) {
    return '<span class="tile ' + (cls || '') + '" style="--c:' + esc(colorOf(cat(b.cat))) + '">' + svg(billIcon(b), size || 18) + '</span>';
  }
  function defaultBillCat(catId) {
    var c = cat(catId);
    if (mainOf(c).id === 'dues' && c.id !== 'dues') return c.id;
    if (db.cats.some(function (x) { return x.id === 'dues-bills'; })) return 'dues-bills';
    if (db.cats.some(function (x) { return x.id === 'dues'; })) return 'dues';
    return catId || 'other';
  }
  function newBill(o) {
    return {
      id: 'b' + uid(), name: o.name, amount: o.amount > 0 ? o.amount : 0, variable: !(o.amount > 0),
      day: Math.max(1, Math.min(31, o.day || 1)), remind: o.remind == null ? 1 : o.remind, time: o.time || '10:00',
      cat: o.cat || defaultBillCat(null), payments: {}, created: todayStr()
    };
  }
  // «دفعت فاتورة الكهربا 650» → فاتورة الكهربا اللي لسه متدفعتش
  function matchBill(name) {
    var iw = keyWords(name);
    if (!iw.length) return null;
    for (var i = 0; i < db.bills.length; i++) {
      var b = db.bills[i];
      var bw = keyWords(b.name);
      if (!bw.length) continue;
      var all = bw.every(function (w) { return iw.indexOf(w) >= 0; });
      var subset = iw.every(function (w) { return bw.indexOf(w) >= 0; });
      if (!all && !subset) continue;
      var st = billState(b);
      if (st.status === 'paid' || st.status === 'skipped') continue;
      return { bill: b, period: st.period };
    }
    return null;
  }
  function lateText(n) { return plural(n, 'يوم', 'يومين', 'أيام', 'يوم'); }
  function statusText(st) {
    var b = st.bill, dd = parseD(st.due).getDate();
    switch (st.status) {
      case 'overdue':
        if (st.period !== thisMonth()) return 'متأخرة من ' + monthName(st.period) + '، كانت يوم ' + dd;
        return 'متأخرة ' + lateText(-st.days) + '، كانت يوم ' + dd;
      case 'today': return 'معادها النهارده';
      case 'soon':
      case 'later':
        return (st.days === 1 ? 'معادها بكرة' : 'بعد ' + nDays(st.days)) + '، يوم ' + dd;
      case 'paid': {
        var nx = dueDate(b, addMonths(st.period, 1));
        return (st.pay.date ? 'اتدفعت ' + dayDate(st.pay.date) : 'اتدفعت') + '، ومعادها الجاي ' + dayDate(nx);
      }
      case 'skipped': return 'مش هتتدفع الشهر ده، ومعادها الجاي ' + dayDate(dueDate(b, addMonths(st.period, 1)));
    }
    return '';
  }
  function billRow(st, inBanner) {
    var b = st.bill;
    var payable = st.status === 'overdue' || st.status === 'today' || st.status === 'soon';
    var tileHtml = st.status === 'paid' ? '<span class="tile" style="--c:#157A57">' + svg('check', 18) + '</span>' : billTile(b, '', 18);
    var amt = st.status === 'paid'
      ? '<span class="bill-amt est">' + fmt(st.pay.amount || billEstimate(b)) + '</span>'
      : billAmountHTML(b);
    return '<div class="bill-row">' +
      '<button type="button" class="bill-open" data-action="bill-edit" data-id="' + b.id + '">' + tileHtml +
      '<span class="main"><span>' + esc(b.name) + '</span><span class="st ' + st.status + '">' + esc(statusText(st)) + '</span></span>' + amt + '</button>' +
      (payable ? '<button type="button" class="btn solid sm" data-action="bill-pay" data-id="' + b.id + '" data-period="' + st.period + '">دفعتها</button>' : '') +
      '</div>';
  }

  function renderBillsBanner() {
    var el = $('#billsBanner');
    if (!el) return;
    var list = billsAttention();
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    var urgent = list.filter(function (st) { return st.status !== 'soon'; }).length;
    var title = urgent
      ? 'عندك ' + plural(urgent, 'فاتورة', 'فاتورتين', 'فواتير', 'فاتورة') + ' ' + (urgent === 1 ? 'محتاجة تتدفع' : 'محتاجين يتدفعوا')
      : 'فاتورة قرب معادها';
    if (!urgent && list.length > 1) title = plural(list.length, 'فاتورة', 'فاتورتين', 'فواتير', 'فاتورة') + ' قرب معادها';
    el.hidden = false;
    el.innerHTML = '<div class="bb-head"><span class="ttl"><span class="bell-tile' + (urgent ? '' : ' soft') + '">' + svg('bell', 16) + '</span>' + title + '</span>' +
      '<button type="button" class="btn ghost sm" data-go="bills">كل الفواتير</button></div>' +
      list.slice(0, 3).map(function (st) { return billRow(st, true); }).join('') +
      (list.length > 3 ? '<button type="button" class="more-link" data-go="bills">و' + (list.length - 3) + ' كمان</button>' : '');
  }

  function updateBadge() {
    var n = billsAttention().length;
    var bd = $('#billBadge');
    if (bd) { bd.hidden = !n; bd.textContent = n; }
    try {
      if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(function () { });
      else if (!n && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () { });
    } catch (e) { }
  }

  function renderBills() {
    var v = $('#view');
    if (!db.bills.length) {
      v.innerHTML = '<section class="card set-section"><h2>مفيش فواتير لسه</h2>' +
        '<p class="hint">ضيف أي حاجة بتدفعها كل شهر في معاد ثابت: الإيجار، النت، الكهربا، الأقساط، الاشتراكات. وأنا أفكّرك بيها في معادها.</p>' +
        '<p class="hint">ممكن تقولها أو تكتبها من «النهارده»، زي: «فاتورة النت 450 كل شهر يوم 2» أو «الإيجار 3500 أول كل شهر».</p>' +
        '<button type="button" class="btn accent" data-action="bill-new">' + svg('plus', 18) + 'فاتورة جديدة</button></section>';
      return;
    }
    var m = thisMonth();
    var states = db.bills.map(billState);
    var paidSum = 0, remaining = 0, nPaid = 0, nCount = 0, unknown = 0;
    db.bills.forEach(function (b) {
      var p = (b.payments || {})[m];
      if ((b.created || todayStr()).slice(0, 7) > m) return;
      if (p && p.skipped) return;
      nCount++;
      if (p && p.paid) { paidSum += p.amount || 0; nPaid++; }
      else { remaining += billEstimate(b); if (!billEstimate(b)) unknown++; }
    });
    states.forEach(function (st) { if (st.status === 'overdue' && st.period !== m) remaining += billEstimate(st.bill); });
    var total = paidSum + remaining;
    var pending = states.filter(function (st) { return st.status !== 'paid' && st.status !== 'skipped'; }).sort(sortStates);
    var done = states.filter(function (st) { return st.status === 'paid' || st.status === 'skipped'; }).sort(sortStates);
    var html = '<section class="card bills-sum" aria-label="ملخص فواتير الشهر"><span class="label">فاضل تدفعه في ' + monthName(m) + '</span>' +
      '<span class="value">' + fmt(Math.round(remaining)) + ' <small>' + esc(cur()) + '</small></span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + (total ? paidSum / total * 100 : 0) + '%"></span></span>' +
      '<span class="hint">اتدفع ' + fmt(paidSum) + ' من ' + fmt(Math.round(total)) + '، ' +
      (nPaid ? plural(nPaid, 'فاتورة واحدة', 'فاتورتين', 'فواتير', 'فاتورة') + ' من ' + nCount : 'ولسه مفيش فاتورة اتدفعت') +
      (unknown ? '. ومن غير ' + plural(unknown, 'فاتورة', 'فاتورتين', 'فواتير', 'فاتورة') + ' مبلغها لسه مش معروف' : '') + '</span></section>';
    html += '<section class="cal-card" aria-label="التنبيه"><span class="ic-box">' + svg('bell', 18) + '</span>' +
      '<span class="txt">' + (db.meta.calendarAt
        ? 'لو ضفت فاتورة جديدة أو غيّرت معاد، حطها في تقويم الموبايل تاني عشان يجيلك الإشعار.'
        : 'عشان يجيلك إشعار في المعاد بالظبط حتى لو التطبيق مقفول، حط الفواتير في تقويم الموبايل.') + '</span>' +
      '<button type="button" class="btn accent sm" data-action="bill-cal-all">حطهم</button></section>';
    if (pending.length) {
      html += '<h2 class="list-title">محتاجة تتدفع</h2><div class="card bills-list">' + pending.map(function (st) { return billRow(st); }).join('') + '</div>';
    }
    if (done.length) {
      html += '<h2 class="list-title">اتدفعت</h2><div class="card bills-list">' + done.map(function (st) { return billRow(st); }).join('') + '</div>';
    }
    html += '<button type="button" class="add-main" data-action="bill-new">' + svg('plus', 18) + 'فاتورة جديدة</button>' +
      '<p class="hint" style="padding:0 4px">أو قولها من «النهارده»: «فاتورة النت 450 كل شهر يوم 2». ولما تدفع قول «دفعت فاتورة النت».</p>';
    v.innerHTML = html;
  }

  /* --- الدفع --- */
  function payBill(id, period) {
    var b = billById(id);
    if (!b) return;
    if (b.variable || !(b.amount > 0)) return openBillPay(b, period);
    doPay(b, period, b.amount, todayStr());
  }
  function doPay(b, period, amount, date) {
    var e = { id: uid(), date: date, name: b.name, amount: amount, cat: b.cat, note: '', raw: '', ts: Date.now(), billId: b.id, period: period };
    db.entries.push(e);
    b.payments[period] = { paid: true, date: date, amount: amount, entryId: e.id };
    save();
    closeSheet();
    ui.flash = [e.id];
    if (ui.view === 'today') showDay(date);
    refresh();
    toast('اتسجلت ' + b.name + ' ' + money(amount), {
      action: 'تراجع',
      onAction: function () {
        db.entries = db.entries.filter(function (x) { return x.id !== e.id; });
        delete b.payments[period];
        save();
        refresh();
        toast('اتلغى');
      }
    });
  }
  function markPaidNoEntry(b, period) {
    b.payments[period] = { paid: true, date: null, amount: billEstimate(b), entryId: null };
    save();
    closeSheet();
    refresh();
    toast('تمام، ' + b.name + ' اتعلّمت إنها اتدفعت لشهر ' + monthName(period));
  }
  function skipBill(b, period) {
    b.payments[period] = { skipped: true };
    save();
    closeSheet();
    refresh();
    toast(b.name + ': مش هتتدفع في ' + monthName(period), {
      action: 'تراجع', onAction: function () { delete b.payments[period]; save(); refresh(); }
    });
  }
  function unpayBill(b, period) {
    var p = b.payments[period];
    if (!p) return;
    if (p.entryId) db.entries = db.entries.filter(function (x) { return x.id !== p.entryId; });
    delete b.payments[period];
    save();
    closeSheet();
    refresh();
    toast(b.name + ' رجعت مش مدفوعة' + (p.entryId ? '، واتشال المصروف بتاعها' : ''));
  }

  var payCtx = null;
  function openBillPay(b, period) {
    payCtx = { id: b.id, period: period };
    var prev = lastAmounts(b);
    var hint = prev.length
      ? (prev.length === 1 ? 'المرة اللي فاتت ' + money(prev[0]) + '.' : 'المرة اللي فاتت ' + money(prev[0]) + '، واللي قبلها ' + money(prev[1]) + '.')
      : '';
    openSheet('<div class="grabber" aria-hidden="true"></div><div class="sheet-head"><div class="head-with-tile">' + billTile(b, 'lg', 20) +
      '<div><h2 id="sheetTitle">دفعت ' + esc(b.name) + '</h2><span class="was">كان معادها يوم ' + parseD(dueDate(b, period)).getDate() + ' ' + monthName(period) + '</span></div></div>' +
      '<button type="button" class="icon-btn" data-action="close-sheet" aria-label="اقفل">' + svg('x', 18) + '</button></div>' +
      '<label class="field">دفعت كام؟<span class="big-amt"><input id="pAmt" inputmode="decimal" placeholder="' + (prev[0] || '') + '" aria-label="المبلغ"><span>' + esc(cur()) + '</span></span>' +
      (hint ? '<span>' + hint + '</span>' : '') + '</label>' +
      '<label class="field">دفعتها يوم<input class="input" type="date" id="pDate" value="' + todayStr() + '" max="' + todayStr() + '"></label>' +
      '<p class="hint">هتتسجل في مصاريف اليوم ده تحت «' + esc(catPath(cat(b.cat))) + '»، وتختفي من التنبيه لحد معادها الجاي.</p>' +
      '<div class="sheet-actions col"><button type="button" class="btn accent block" data-action="bill-pay-save">سجّل إنها اتدفعت</button>' +
      '<button type="button" class="btn ghost" data-action="bill-skip" data-id="' + b.id + '" data-period="' + period + '" style="color:var(--muted)">مش هتتدفع الشهر ده</button></div>');
    if (!b.variable && b.amount > 0) $('#pAmt').value = b.amount;
    setTimeout(function () { var a = $('#pAmt'); if (a) a.focus(); }, 60);
  }
  function savePay() {
    var b = billById(payCtx.id);
    if (!b) return closeSheet();
    var amt = parseAmount($('#pAmt').value);
    if (!(amt > 0)) { $('#pAmt').focus(); return toastIn('اكتب المبلغ اللي دفعته'); }
    doPay(b, payCtx.period, amt, $('#pDate').value || todayStr());
  }

  /* --- إضافة وتعديل --- */
  var billCtx = null;
  var TIMES = [['08:00', '8 الصبح'], ['09:00', '9 الصبح'], ['10:00', '10 الصبح'], ['12:00', '12 الضهر'], ['14:00', '2 الضهر'], ['17:00', '5 العصر'], ['19:00', '7 بالليل'], ['21:00', '9 بالليل']];
  function openBillEdit(id, prefill) {
    var isNew = !id;
    var b = isNew ? newBill(prefill || { name: '', amount: 0, day: parseD(todayStr()).getDate(), remind: 1 }) : JSON.parse(JSON.stringify(billById(id)));
    if (!b) return;
    billCtx = { isNew: isNew, b: b, fromDraft: !!prefill };
    pickCtx = { mode: 'bill' };
    var days = '';
    for (var d = 1; d <= 31; d++) days += '<button type="button" role="radio" data-bill-day="' + d + '" aria-checked="' + (b.day === d) + '">' + d + '</button>';
    var times = TIMES.slice();
    if (!times.some(function (t) { return t[0] === b.time; })) times.push([b.time, b.time]);
    var html = sheetHead(isNew ? 'فاتورة جديدة' : 'تعديل الفاتورة') +
      '<div class="row"><label class="field" style="flex:1.6">الاسم<input class="input" id="bName" placeholder="مثلًا: فاتورة النت"></label>' +
      '<label class="field">المبلغ<input class="input num" id="bAmt" inputmode="decimal" placeholder="' + (b.variable ? 'تقريبًا' : '') + '"></label></div>' +
      '<label class="check-row"><input type="checkbox" id="bVar"' + (b.variable ? ' checked' : '') + '><span>المبلغ بيتغير كل شهر، زي الكهربا. هسألك عليه وانت بتدفع.</span></label>' +
      '<div class="field"><span>بتتدفع كل شهر يوم</span><div class="day-grid" role="radiogroup" aria-label="يوم الدفع">' + days + '</div>' +
      '<span>لو الشهر أقصر من كده، بتبقى آخر يوم فيه.</span></div>' +
      '<div class="field"><span>فكّرني</span><div class="chips-row" role="group" aria-label="التنبيه">' +
      [[0, 'في نفس اليوم'], [1, 'قبلها بيوم'], [3, 'قبلها بـ 3 أيام']].map(function (r) {
        return '<button type="button" class="chip" data-bill-remind="' + r[0] + '" aria-pressed="' + (b.remind === r[0]) + '">' + r[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="time-row">الساعة<select class="input" id="bTime" style="width:auto">' +
      times.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === b.time ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="field"><span>لما تدفعها بتتسجل في</span><button type="button" class="select-btn" data-action="bill-cat" id="bCatBtn"></button><div id="billPicker" hidden></div></div>';
    if (!isNew) html += monthBox(billById(id));
    html += '<div class="sheet-actions col"><button type="button" class="btn accent block" data-action="bill-save">احفظ</button>' +
      '<button type="button" class="btn soft" data-action="bill-cal-one" style="height:46px">' + svg('calendar', 17) + 'حطها في تقويم الموبايل</button>' +
      (isNew ? '' : '<button type="button" class="btn ghost" data-action="bill-del" style="color:var(--danger)">امسح الفاتورة</button>') + '</div>';
    openSheet(html);
    $('#bName').value = b.name || '';
    $('#bAmt').value = b.amount > 0 ? b.amount : '';
    renderBillCatBtn();
  }
  function renderBillCatBtn() {
    var c = cat(billCtx.b.cat);
    $('#bCatBtn').innerHTML = tile(c, 'xs', 14) + '<span>' + esc(catPath(c)) + '</span>' + svg('chevL', 16);
  }
  function monthBox(b) {
    var st = billState(b);
    var label = 'شهر ' + monthName(st.period);
    var body;
    if (st.status === 'paid') {
      body = '<span>' + esc(label) + ': ' + esc(statusText(st)) + '</span><div class="btns">' +
        '<button type="button" class="btn sm" data-action="bill-unpay" data-period="' + st.period + '">رجّعها مش مدفوعة</button></div>';
    } else if (st.status === 'skipped') {
      body = '<span>' + esc(label) + ': مش هتتدفع</span><div class="btns">' +
        '<button type="button" class="btn sm" data-action="bill-unpay" data-period="' + st.period + '">رجّعها</button></div>';
    } else {
      body = '<span>' + esc(label) + ': ' + esc(statusText(st)) + '</span><div class="btns">' +
        '<button type="button" class="btn solid sm" data-action="bill-pay" data-id="' + b.id + '" data-period="' + st.period + '">دفعتها</button>' +
        '<button type="button" class="btn sm" data-action="bill-paid-noentry" data-period="' + st.period + '">اتدفعت من غير ما أسجلها</button>' +
        '<button type="button" class="btn sm" data-action="bill-skip" data-id="' + b.id + '" data-period="' + st.period + '">مش هتتدفع الشهر ده</button></div>';
    }
    return '<div class="month-box">' + body + '</div>';
  }
  function readBillForm() {
    var b = billCtx.b;
    b.name = $('#bName').value.trim();
    var a = parseAmount($('#bAmt').value);
    b.amount = a > 0 ? a : 0;
    b.variable = $('#bVar').checked || !(b.amount > 0);
    b.time = $('#bTime').value || '10:00';
    return b;
  }
  function saveBill(thenCalendar) {
    var b = readBillForm();
    if (!b.name) { $('#bName').focus(); toastIn('اكتب اسم الفاتورة'); return null; }
    if (billCtx.isNew) {
      db.bills.push(b);
      if (billCtx.fromDraft) {
        ui.draftText = '';
        ui.overrides = {};
        var q = $('#q');
        if (q) { q.value = ''; autoGrow(q); }
      }
    } else {
      var orig = billById(b.id);
      Object.keys(b).forEach(function (k) { orig[k] = b[k]; });
    }
    var wasNew = billCtx.isNew;
    save();
    closeSheet();
    refresh();
    if (thenCalendar) openCalendar([b.id]);
    else toast(wasNew ? 'اتضافت ' + b.name + '، كل شهر يوم ' + b.day : 'اتحفظت ' + b.name,
      wasNew ? { action: 'حطها في التقويم', onAction: function () { openCalendar([b.id]); } } : null);
    return b;
  }
  function deleteBill() {
    var b = billById(billCtx.b.id);
    if (!b) return closeSheet();
    if (!confirm('هتمسح «' + b.name + '» من الفواتير. المصاريف اللي اتسجلت منها هتفضل زي ما هي. تكمل؟')) return;
    db.bills = db.bills.filter(function (x) { return x.id !== b.id; });
    save();
    closeSheet();
    refresh();
    toast('اتمسحت ' + b.name + '. لو حطيتها في التقويم، امسحها من هناك كمان.');
  }

  /* --- التقويم --- */
  function reminderDate(b, m) {
    var dim = daysInMonth(m);
    var due = b.day >= 29 ? dim : Math.min(b.day, dim);
    return addDaysStr(m + '-' + pad2(due), -(b.remind || 0));
  }
  function nextReminder(b) {
    var t = todayStr();
    for (var k = 0; k < 3; k++) {
      var r = reminderDate(b, addMonths(thisMonth(), k));
      if (r >= t) return r;
    }
    return reminderDate(b, addMonths(thisMonth(), 1));
  }
  function calRule(b) {
    var r = b.remind || 0, d = b.day;
    if (d >= 29) {
      if (!r) { var days = []; for (var x = 28; x <= d; x++) days.push(x); return 'FREQ=MONTHLY;BYMONTHDAY=' + days.join(',') + ';BYSETPOS=-1'; }
      return 'FREQ=MONTHLY;BYMONTHDAY=' + (-(1 + r));
    }
    var rd = d - r;
    return 'FREQ=MONTHLY;BYMONTHDAY=' + (rd >= 1 ? rd : rd - 1);
  }
  function calTitle(b) {
    var n = /^فا?تور/.test(b.name) ? b.name : 'فاتورة ' + b.name;
    return n + (b.variable ? '' : ' (' + fmt(b.amount) + ' ' + cur() + ')');
  }
  function calDetails(b) {
    var r = b.remind || 0;
    return 'معادها يوم ' + b.day + ' من كل شهر' + (r ? '، والتنبيه ده قبلها ' + (r === 1 ? 'بيوم' : 'بـ ' + r + ' أيام') : '') +
      '. افتح مصاريفي وسجّلها لما تدفعها: ' + location.origin + location.pathname + '#bills';
  }
  function stamp(dateStr, time, plusMin) {
    var p = time.split(':').map(Number);
    var dt = parseD(dateStr);
    dt.setHours(p[0], p[1] + (plusMin || 0), 0, 0);
    return dt.getFullYear() + pad2(dt.getMonth() + 1) + pad2(dt.getDate()) + 'T' + pad2(dt.getHours()) + pad2(dt.getMinutes()) + '00';
  }
  function icsEsc(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function icsFold(line) {
    var enc = new TextEncoder();
    if (enc.encode(line).length <= 74) return line;
    var out = [], cur = '', curBytes = 0, first = true;
    Array.from(line).forEach(function (ch) {
      var bl = enc.encode(ch).length;
      var limit = first ? 74 : 73;
      if (curBytes + bl > limit) { out.push(cur); cur = ''; curBytes = 0; first = false; }
      cur += ch; curBytes += bl;
    });
    out.push(cur);
    return out.join('\r\n ');
  }
  function ics(bills) {
    var now = new Date();
    var dtstamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + 'T' + pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + '00Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Masarefy//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:فواتير مصاريفي'];
    bills.forEach(function (b) {
      var start = nextReminder(b);
      L.push('BEGIN:VEVENT', 'UID:bill-' + b.id + '@masarefy', 'DTSTAMP:' + dtstamp,
        'DTSTART:' + stamp(start, b.time), 'DTEND:' + stamp(start, b.time, 30), 'RRULE:' + calRule(b),
        'SUMMARY:' + icsEsc(calTitle(b)), 'DESCRIPTION:' + icsEsc(calDetails(b)),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(calTitle(b)), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function googleUrl(b) {
    var start = nextReminder(b);
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(calTitle(b)) +
      '&dates=' + stamp(start, b.time) + '/' + stamp(start, b.time, 30) +
      '&details=' + encodeURIComponent(calDetails(b)) +
      '&recur=' + encodeURIComponent('RRULE:' + calRule(b)) +
      (tz ? '&ctz=' + encodeURIComponent(tz) : '');
  }
  var calIds = [];
  function openCalendar(ids) {
    calIds = ids.filter(function (id) { return billById(id); });
    if (!calIds.length) return;
    var list = calIds.map(billById);
    var html = sheetHead(list.length === 1 ? 'حطها في تقويم الموبايل' : 'حط الفواتير في تقويم الموبايل') +
      '<p class="hint">التقويم هو اللي هيبعتلك الإشعار في المعاد اللي اخترته، حتى لو التطبيق مقفول. كل فاتورة بتتكرر لوحدها كل شهر.</p>' +
      '<div class="cal-option"><b>آيفون، أو أي موبايل تقويمه بيفتح ملفات (زي سامسونج)</b>' +
      '<button type="button" class="btn accent" data-action="cal-ics">' + svg('download', 17) + (list.length === 1 ? 'نزّل ملف التقويم' : 'نزّل ملف فيه ' + plural(list.length, 'فاتورة', 'الفاتورتين', 'فواتير', 'فاتورة')) + '</button>' +
      '<span class="hint">افتح الملف، وهيسألك تضيف المواعيد للتقويم.</span></div>' +
      '<div class="cal-option"><b>Google Calendar</b><span class="hint">كل فاتورة في زرار لوحدها. هتفتحلك صفحة الحدث، دوس فيها «Save».</span><div class="gcal-list">' +
      list.map(function (b) { return '<a class="btn soft sm" href="' + esc(googleUrl(b)) + '" target="_blank" rel="noopener">' + svg('calendar', 15) + esc(b.name) + '</a>'; }).join('') +
      '</div></div>' +
      '<p class="hint">لو غيّرت معاد فاتورة بعد كده، امسح القديمة من التقويم وحطها تاني.</p>';
    openSheet(html);
  }
  function downloadIcs() {
    var list = calIds.map(billById).filter(Boolean);
    if (!list.length) return;
    var name = list.length === 1 ? 'masarefy-' + list[0].name.replace(/[\\/:*?"<>|\s]+/g, '-') + '.ics' : 'masarefy-bills.ics';
    download(name, ics(list), 'text/calendar;charset=utf-8');
    db.meta.calendarAt = Date.now();
    save();
    if (ui.view === 'bills') renderBills();
  }

  /* ================= الإعدادات ================= */
  var installPrompt = null;
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  function renderSettings() {
    var s = db.settings;
    var shortcut = location.origin + location.pathname + '?add=';
    var lb = db.meta.lastBackup;
    var backupNote = lb ? 'آخر نسخة نزلتها: ' + dayShort(M.ymd(new Date(lb))) + '.' : 'لسه منزلتش أي نسخة.';
    var html = '';

    html += '<section class="card set-section"><h2>الميزانية الشهرية</h2>' +
      '<label class="field">كام تحب تصرف في الشهر؟<input class="input num" id="setBudget" inputmode="decimal" placeholder="مثلًا 8000" value="' + (s.budget > 0 ? s.budget : '') + '"></label>' +
      '<p class="hint">سيبها فاضية لو مش عاوز ميزانية. وتقدر تحط ميزانية لكل بند رئيسي من «البنود».</p></section>';

    html += '<section class="card set-section"><h2>الشكل</h2><div class="seg" role="group" aria-label="الشكل">' +
      [['auto', 'زي الموبايل'], ['light', 'فاتح'], ['dark', 'غامق']].map(function (o) {
        return '<button type="button" data-action="theme" data-v="' + o[0] + '" aria-pressed="' + (s.theme === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="field">العملة اللي بتظهر جنب الأرقام<input class="input" id="setCur" value="' + esc(s.currency) + '" maxlength="6"></label></section>';

    html += '<section class="card set-section"><h2>التسجيل</h2>' +
      '<label class="switch-row"><span>سجّل لوحده أول ما أسكت<small>بعد الكلام بيتسجل على طول ويظهرلك «تراجع». لو قفلتها، هتدوس «سجّل» بنفسك.</small></span><input type="checkbox" class="switch" id="setVoice"' + (s.voiceAutoSave ? ' checked' : '') + '></label>' +
      '<label class="switch-row"><span>افتكر البند لما أصلّحه<small>لما تغيّر بند مصروف، التطبيق بيزوّد الكلمة على البند الجديد.</small></span><input type="checkbox" class="switch" id="setLearn"' + (s.learn ? ' checked' : '') + '></label></section>';

    html += '<section class="card set-section"><h2>نسخة احتياطية</h2>' +
      '<p class="hint">بياناتك متسجلة على الجهاز ده بس. لو مسحت بيانات المتصفح أو غيّرت الموبايل هتضيع، فنزّل نسخة كل فترة. ' + backupNote + '</p>' +
      '<div class="btn-grid">' +
      '<button type="button" class="btn" data-action="backup">' + svg('download', 17) + 'نزّل نسخة</button>' +
      '<button type="button" class="btn" data-action="restore-file">' + svg('upload', 17) + 'رجّع من ملف</button>' +
      '<button type="button" class="btn" data-action="copy-code">' + svg('copy', 17) + 'انسخ كود</button>' +
      '<button type="button" class="btn" data-action="show-restore-code">' + svg('repeat', 17) + 'رجّع من كود</button>' +
      '</div><input type="file" id="restoreFile" accept="application/json,.json" hidden>' +
      '<div id="codeArea"></div>' +
      '<button type="button" class="btn soft" data-action="csv">' + svg('table', 17) + 'نزّل كل المصاريف لـ Excel</button></section>';

    html += '<section class="card set-section"><h2>على الموبايل</h2>';
    if (installPrompt && !isStandalone()) {
      html += '<button type="button" class="btn accent" data-action="install">نزّل التطبيق على الجهاز</button>';
    } else if (!isStandalone()) {
      html += isIOS()
        ? '<ol class="steps"><li>افتح الصفحة من Safari.</li><li>دوس على زرار المشاركة تحت.</li><li>اختار «Add to Home Screen».</li></ol>'
        : '<ol class="steps"><li>افتح الصفحة من Chrome.</li><li>دوس على التلات نقط فوق.</li><li>اختار «Add to Home screen» أو «Install app».</li></ol>';
    } else {
      html += '<p class="hint">التطبيق متنزل على الجهاز.</p>';
    }
    html += '<p class="hint">تقدر تسجل مصروف من اختصار من غير ما تفتح التطبيق. اللينك ده بيسجل أي كلام تحطه بعد «=»:</p>' +
      '<div class="linkbox"><code id="scLink">' + esc(shortcut) + '</code><button type="button" class="btn sm soft" data-action="copy-link">انسخ</button></div>' +
      '<p class="hint"><b style="color:var(--ink)">آيفون (Siri):</b> افتح تطبيق Shortcuts، واعمل اختصار جديد فيه «Dictate Text»، وبعده «URL» فيه اللينك وبعده «Dictated Text»، وبعدهم «Open URLs». سمّيه «مصروف»، وبعدها قول لـ Siri «مصروف» واتكلم.</p>' +
      '<p class="hint"><b style="color:var(--ink)">أندرويد:</b> دوس دوسة طويلة على أيقونة التطبيق، هتلاقي «سجّل مصروف» بيفتح التسجيل بالصوت على طول.</p></section>';

    html += '<section class="card set-section"><h2>مسح البيانات</h2><p class="hint">بيمسح كل المصاريف والبنود والإعدادات من الجهاز ده. نزّل نسخة الأول.</p>' +
      '<button type="button" class="btn danger" data-action="wipe">' + svg('trash', 17) + 'امسح كل حاجة</button></section>';

    html += '<p class="foot-note">مصاريفي ' + VERSION + '. بياناتك على جهازك ومش بتتبعت لحد. التسجيل بالصوت بيستخدم خدمة الكلام بتاعة المتصفح.</p>';
    $('#view').innerHTML = html;
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function toCode() {
    var json = JSON.stringify(db);
    return 'MSRF1:' + btoa(unescape(encodeURIComponent(json)));
  }
  function fromCode(code) {
    code = String(code || '').trim();
    if (code.indexOf('MSRF1:') === 0) code = code.slice(6);
    return JSON.parse(decodeURIComponent(escape(atob(code))));
  }
  function restoreFrom(obj) {
    if (!obj || !Array.isArray(obj.entries) || !Array.isArray(obj.cats)) { toast('الملف ده مش نسخة من مصاريفي.'); return; }
    if (!confirm('ده هيبدّل بياناتك الحالية (' + nEntries(db.entries.length) + ') بالنسخة دي (' + nEntries(obj.entries.length) + '). تكمل؟')) return;
    db = migrate(obj);
    idxCache = null;
    save();
    applyTheme();
    render();
    toast('رجعت البيانات من النسخة الاحتياطية');
  }
  function csv() {
    var rows = [['التاريخ', 'اليوم', 'البند الرئيسي', 'البند', 'الوصف', 'المبلغ', 'ملاحظة']];
    db.entries.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0); }).forEach(function (e) {
      var c = cat(e.cat);
      rows.push([e.date, DAYS[parseD(e.date).getDay()], mainOf(c).name, c.parent ? c.name : '', e.name, e.amount, e.note || '']);
    });
    var text = rows.map(function (r) {
      return r.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
    }).join('\r\n');
    download('masarefy-' + todayStr() + '.csv', '﻿' + text, 'text/csv;charset=utf-8');
  }
  function copyText(t, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast(okMsg); }, function () { showCode(t); });
    } else showCode(t);
  }
  function showCode(t) {
    var el = $('#codeArea');
    if (!el) return;
    el.innerHTML = '<textarea class="code-box" readonly aria-label="الكود"></textarea><p class="hint">انسخ الكود ده وابعته لنفسك.</p>';
    var ta = el.querySelector('textarea');
    ta.value = t;
    ta.select();
  }

  /* ================= الشيت ================= */
  var sheet = null;
  function openSheet(html) {
    sheet.innerHTML = '<div class="sheet-inner">' + html + '</div>';
    if (!sheet.open) {
      if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
    }
  }
  function closeSheet() { if (sheet.open) { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); } }
  function sheetHead(title) {
    return '<div class="grabber" aria-hidden="true"></div><div class="sheet-head"><h2 id="sheetTitle">' + esc(title) + '</h2>' +
      '<button type="button" class="icon-btn" data-action="close-sheet" aria-label="اقفل">' + svg('x', 18) + '</button></div>';
  }

  function pickerHTML(selected) {
    var html = '<label class="search sunk">' + svg('search', 16) + '<input type="search" id="pickQ" placeholder="دوّر على بند" aria-label="دوّر على بند" autocomplete="off"></label><div class="picker" id="picker">';
    mains().forEach(function (mn) {
      var subs = subsOf(mn.id);
      html += '<div class="pick-group"><span><span class="dot sm" style="--c:' + esc(mn.color) + '"></span>' + esc(mn.name) + '</span><div class="pick-chips">';
      subs.forEach(function (s) { html += pickChip(s, s.name, selected === s.id, ''); });
      html += pickChip(mn, subs.length ? mn.name + ' (عام)' : mn.name, selected === mn.id, subs.length ? 'main-only' : '');
      html += '</div></div>';
    });
    return html + '</div>';
  }
  function pickChip(c, label, sel, cls) {
    return '<button type="button" class="chip ' + cls + '" data-pick="' + c.id + '" data-n="' + esc(M.normalize(label + ' ' + mainOf(c).name + ' ' + (c.kw || []).join(' ') + ' ' + (c.learned || []).join(' '))) + '" aria-pressed="' + sel + '">' +
      (sel ? svg('check', 14) : '') + esc(label) + '</button>';
  }
  function filterPicker(q) {
    q = M.normalize(q);
    $$('#picker .pick-group').forEach(function (g) {
      var any = false;
      $$('[data-pick]', g).forEach(function (b) {
        var show = !q || b.dataset.n.indexOf(q) >= 0;
        b.hidden = !show;
        if (show) any = true;
      });
      g.hidden = !any;
    });
  }
  function markPicked(id) {
    $$('#picker [data-pick]').forEach(function (b) {
      var on = b.dataset.pick === id;
      b.setAttribute('aria-pressed', on);
      var ic = b.querySelector('svg');
      if (on && !ic) b.insertAdjacentHTML('afterbegin', svg('check', 14));
      if (!on && ic) ic.remove();
    });
  }

  // اختيار بند لمصروف لسه متسجلش
  var pickCtx = null;
  function openDraftPicker(i) {
    computeDraft();
    var it = draft.items[i];
    if (!it) return;
    var word = db.settings.learn ? M.learnTarget(it.name, db.cats) : null;
    pickCtx = { mode: 'draft', i: i, name: it.name, word: word };
    openSheet(sheetHead('اختار البند') + '<p class="hint">«' + esc(it.name) + '»</p>' + pickerHTML(it.cat) +
      (word ? '<label class="learn-box"><input type="checkbox" id="learnChk" checked><span>افتكر إن «' + esc(word) + '» تحت البند اللي هتختاره</span></label>' : ''));
  }

  // تعديل مصروف
  function openEdit(id) {
    var e = db.entries.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    var c = cat(e.cat);
    pickCtx = { mode: 'edit', id: id, orig: c.id, sel: c.id };
    openSheet(sheetHead('تعديل المصروف') +
      '<div class="row"><label class="field" style="flex:2">الوصف<input class="input" id="eName"></label>' +
      '<label class="field">المبلغ<input class="input num" id="eAmt" inputmode="decimal"></label></div>' +
      '<div class="field"><span style="display:flex;justify-content:space-between"><span>البند</span><span class="was" id="eWas" hidden>كان: ' + esc(c.name) + '</span></span></div>' +
      pickerHTML(c.id) +
      '<label class="learn-box" id="learnBox" hidden><input type="checkbox" id="learnChk"' + (db.settings.learn ? ' checked' : '') + '><span id="learnTxt"></span></label>' +
      '<div class="row"><label class="field">اليوم<input class="input" type="date" id="eDate" max="' + todayStr() + '"></label>' +
      '<label class="field" style="flex:1.3">ملاحظة<input class="input" id="eNote" placeholder="مش لازم"></label></div>' +
      '<div class="sheet-actions"><button type="button" class="btn accent block" data-action="edit-save">احفظ</button>' +
      '<button type="button" class="btn danger" data-action="edit-del" style="height:50px;border-radius:25px">' + svg('trash', 17) + 'امسح</button></div>');
    $('#eName').value = e.name;
    $('#eAmt').value = e.amount;
    $('#eDate').value = e.date;
    $('#eNote').value = e.note || '';
  }
  function updateLearnBox() {
    if (!pickCtx || pickCtx.mode !== 'edit') return;
    var changed = pickCtx.sel !== pickCtx.orig;
    $('#eWas').hidden = !changed;
    var box = $('#learnBox');
    var word = M.learnTarget($('#eName').value, db.cats);
    pickCtx.word = word;
    box.hidden = !changed || !word;
    if (!box.hidden) $('#learnTxt').textContent = 'افتكر إن «' + word + '» تحت «' + cat(pickCtx.sel).name + '» بعد كده';
  }
  function saveEdit() {
    var e = db.entries.filter(function (x) { return x.id === pickCtx.id; })[0];
    if (!e) return closeSheet();
    var amt = parseAmount($('#eAmt').value);
    if (!(amt > 0)) { $('#eAmt').focus(); return toastIn('اكتب مبلغ صحيح'); }
    var name = $('#eName').value.trim() || e.name;
    var date = $('#eDate').value || e.date;
    var learned = null;
    if (pickCtx.sel !== e.cat && $('#learnChk') && $('#learnChk').checked && !$('#learnBox').hidden && pickCtx.word) {
      if (M.learn(db.cats, pickCtx.word, pickCtx.sel)) { learned = pickCtx.word; idxCache = null; }
    }
    e.name = name;
    e.amount = amt;
    e.cat = pickCtx.sel;
    e.date = date;
    e.note = $('#eNote').value.trim();
    if (e.billId) {
      var eb = billById(e.billId);
      var ep = eb && eb.payments[e.period];
      if (ep && ep.entryId === e.id) { ep.amount = amt; ep.date = date; }
    }
    save();
    closeSheet();
    if (ui.view === 'today') showDay(date);
    refresh();
    toast(learned ? 'اتحفظ، وهفتكر إن «' + learned + '» تحت «' + cat(e.cat).name + '»' : 'اتحفظ');
  }
  function deleteEntry() {
    var idx = -1;
    db.entries.forEach(function (x, i) { if (x.id === pickCtx.id) idx = i; });
    if (idx < 0) return closeSheet();
    var removed = db.entries.splice(idx, 1)[0];
    var rb = removed.billId ? billById(removed.billId) : null;
    var rp = rb && rb.payments[removed.period];
    if (rp && rp.entryId === removed.id) delete rb.payments[removed.period];
    else rp = null;
    save();
    closeSheet();
    refresh();
    toast('اتمسح: ' + removed.name + ' ' + money(removed.amount) + (rp ? '، والفاتورة رجعت مش مدفوعة' : ''), {
      action: 'تراجع',
      onAction: function () {
        db.entries.push(removed);
        if (rp) rb.payments[removed.period] = rp;
        save(); refresh(); toast('رجع');
      }
    });
  }


  // تعديل أو إضافة بند
  var catCtx = null;
  function openCatEdit(id, parentForNew, newMain) {
    var isNew = !id;
    var c;
    if (isNew) {
      var used = mains().map(function (x) { return x.color; });
      var color = M.PALETTE.filter(function (p) { return used.indexOf(p) < 0; })[0] || M.PALETTE[0];
      c = { id: 'c' + uid(), name: '', icon: parentForNew ? cat(parentForNew).icon : 'box', color: color, parent: newMain ? null : (parentForNew || null), kw: [], learned: [], budget: 0 };
    } else {
      c = JSON.parse(JSON.stringify(cat(id)));
    }
    var hasSubs = !isNew && subsOf(c.id).length > 0;
    catCtx = { isNew: isNew, c: c, hasSubs: hasSubs };
    var parentSelect = '';
    if (!hasSubs && !c.fixed) {
      parentSelect = '<label class="field">تحت بند<select class="input" id="cParent"><option value="">بند رئيسي لوحده</option>' +
        mains().filter(function (m) { return m.id !== c.id; }).map(function (m) {
          return '<option value="' + m.id + '"' + (c.parent === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
        }).join('') + '</select></label>';
    }
    var title = isNew ? (c.parent ? 'بند فرعي جديد' : 'بند رئيسي جديد') : 'تعديل بند';
    var html = sheetHead(title) +
      '<div class="row"><label class="field" style="flex:1.4">الاسم<input class="input" id="cName" placeholder="مثلًا: جيم"></label>' + parentSelect + '</div>' +
      '<div class="field"><span>الأيقونة</span><div class="icon-grid" role="radiogroup" aria-label="الأيقونة">' +
      I.list.map(function (n) {
        return '<button type="button" role="radio" data-icon-pick="' + n + '" aria-checked="' + (c.icon === n) + '" aria-label="' + n + '">' + svg(n, 18) + '</button>';
      }).join('') + '</div></div>' +
      '<div id="mainOnly"' + (c.parent ? ' hidden' : '') + ' style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="field"><span>اللون</span><div class="swatches" role="radiogroup" aria-label="اللون">' +
      M.PALETTE.map(function (p) { return '<button type="button" role="radio" data-color-pick="' + p + '" aria-checked="' + (c.color === p) + '" aria-label="لون" style="background:' + p + '"></button>'; }).join('') +
      '</div></div>' +
      '<label class="field">ميزانية الشهر للبند ده<input class="input num" id="cBudget" inputmode="decimal" placeholder="مش لازم"></label></div>' +
      '<div class="field"><span>الكلمات اللي بيتعرف بيها</span><div class="kw-edit" id="kwList"></div>' +
      '<div class="row"><input class="input" id="kwNew" placeholder="زوّد كلمة، مثلًا: كابتشينو" aria-label="زوّد كلمة" style="flex:1"><button type="button" class="btn soft" data-action="kw-add" style="flex:none;height:46px;border-radius:12px">زوّد</button></div>' +
      '<p class="hint" id="kwHint"></p></div>' +
      '<div class="sheet-actions"><button type="button" class="btn accent block" data-action="cat-save">احفظ</button></div>' +
      (!isNew && !c.fixed ? '<button type="button" class="btn ghost" data-action="cat-del" style="color:var(--danger);align-self:center">امسح البند، ومصاريفه تروح «أخرى»</button>' : '');
    openSheet(html);
    $('#cName').value = c.name;
    if ($('#cBudget')) $('#cBudget').value = c.budget > 0 ? c.budget : '';
    renderKwList();
  }
  function renderKwList() {
    var c = catCtx.c;
    var el = $('#kwList');
    var all = (c.learned || []).map(function (w, i) { return { w: w, t: 'learned', i: i }; })
      .concat((c.kw || []).map(function (w, i) { return { w: w, t: 'kw', i: i }; }));
    el.innerHTML = all.length ? all.map(function (x) {
      return '<span class="kw' + (x.t === 'learned' ? ' learned' : '') + '">' + esc(x.w) +
        '<button type="button" data-action="kw-del" data-t="' + x.t + '" data-i="' + x.i + '" aria-label="شيل ' + esc(x.w) + '">' + svg('x', 13) + '</button></span>';
    }).join('') : '<span class="hint">مفيش كلمات لسه.</span>';
    var parent = $('#cParent') ? $('#cParent').value : c.parent;
    $('#kwHint').textContent = parent
      ? 'أي مصروف فيه كلمة من دول بيتحط هنا. افصل بين الكلمات بفاصلة لو هتزوّد كذا كلمة.'
      : 'الكلمات هنا بتحط المصروف في البند الرئيسي نفسه. الأحسن تحط الكلمات في البنود الفرعية.';
  }
  function addKw() {
    var input = $('#kwNew');
    var words = input.value.split(/[،,]/).map(function (w) { return w.trim(); }).filter(Boolean);
    var c = catCtx.c;
    var have = (c.kw || []).concat(c.learned || []).map(M.normalize);
    words.forEach(function (w) {
      var n = M.normalize(w);
      if (n && have.indexOf(n) < 0) { c.kw.unshift(w); have.push(n); }
    });
    input.value = '';
    renderKwList();
    input.focus();
  }
  function saveCat() {
    var c = catCtx.c;
    var name = $('#cName').value.trim();
    if (!name) { $('#cName').focus(); return toastIn('اكتب اسم البند'); }
    c.name = name;
    if ($('#cParent')) c.parent = $('#cParent').value || null;
    if (!c.parent) {
      var b = parseAmount($('#cBudget') ? $('#cBudget').value : '');
      c.budget = b > 0 ? b : 0;
      if (!c.color) c.color = M.PALETTE[0];
    }
    // الكلمات الجديدة متتكررش في بنود تانية
    var mine = (c.kw || []).concat(c.learned || []).map(M.normalize);
    db.cats.forEach(function (o) {
      if (o.id === c.id) return;
      o.kw = (o.kw || []).filter(function (w) { return mine.indexOf(M.normalize(w)) < 0; });
      o.learned = (o.learned || []).filter(function (w) { return mine.indexOf(M.normalize(w)) < 0; });
    });
    if (catCtx.isNew) {
      if (c.parent) {
        // بعد آخر بند فرعي في نفس الرئيسي
        var lastIdx = -1;
        db.cats.forEach(function (x, i) { if (x.id === c.parent || x.parent === c.parent) lastIdx = i; });
        db.cats.splice(lastIdx + 1, 0, c);
      } else {
        var otherIdx = db.cats.indexOf(otherCat());
        db.cats.splice(otherIdx, 0, c);
      }
      if (c.parent) ui.catsOpen[c.parent] = true;
    } else {
      var orig = cat(c.id);
      Object.keys(c).forEach(function (k) { orig[k] = c[k]; });
    }
    catsChanged();
    closeSheet();
    render();
    toast(catCtx.isNew ? 'اتضاف «' + name + '»' : 'اتحفظ «' + name + '»');
  }
  function deleteCat() {
    var c = cat(catCtx.c.id);
    if (!c || c.fixed) return;
    var subs = subsOf(c.id);
    var ids = [c.id].concat(subs.map(function (s) { return s.id; }));
    var n = db.entries.filter(function (e) { return ids.indexOf(e.cat) >= 0; }).length;
    var msg = 'هتمسح «' + c.name + '»' + (subs.length ? ' ومعاه ' + nSubs(subs.length) : '') + '.' +
      (n ? ' ال' + nEntries(n) + ' اللي فيه هيتنقلوا لـ «أخرى».' : '') + ' تكمل؟';
    if (!confirm(msg)) return;
    db.entries.forEach(function (e) { if (ids.indexOf(e.cat) >= 0) e.cat = 'other'; });
    db.bills.forEach(function (b) { if (ids.indexOf(b.cat) >= 0) b.cat = 'other'; });
    db.cats = db.cats.filter(function (x) { return ids.indexOf(x.id) < 0; });
    catsChanged();
    closeSheet();
    render();
    toast('اتمسح «' + c.name + '»');
  }

  /* ================= التوست ================= */
  var toastTimer = null;
  function toast(msg, opt) {
    var el = $('#toast');
    clearTimeout(toastTimer);
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (opt && opt.action ? '<button type="button">' + esc(opt.action) + '</button>' : '');
    el.hidden = false;
    if (opt && opt.action) {
      el.querySelector('button').onclick = function () { el.hidden = true; opt.onAction(); };
    }
    toastTimer = setTimeout(function () { el.hidden = true; }, opt && opt.action ? 6500 : 3500);
  }
  // رسالة جوه الشيت (التوست بيبقى ورا الشيت)
  function toastIn(msg) {
    var inner = sheet.querySelector('.sheet-inner');
    var old = sheet.querySelector('.sheet-msg');
    if (old) old.remove();
    inner.insertAdjacentHTML('beforeend', '<p class="hint sheet-msg" role="alert" style="color:var(--danger);text-align:center">' + esc(msg) + '</p>');
  }

  /* ================= الأحداث ================= */
  function onClick(ev) {
    var g = ev.target.closest('[data-go]');
    if (g) { goTo(g.dataset.go); return; }
    var pick = ev.target.closest('[data-pick]');
    if (pick && pickCtx) { onPick(pick.dataset.pick); return; }
    var bd = ev.target.closest('[data-bill-day]');
    if (bd && billCtx) {
      billCtx.b.day = +bd.dataset.billDay;
      $$('[data-bill-day]').forEach(function (x) { x.setAttribute('aria-checked', x === bd); });
      return;
    }
    var br = ev.target.closest('[data-bill-remind]');
    if (br && billCtx) {
      billCtx.b.remind = +br.dataset.billRemind;
      $$('[data-bill-remind]').forEach(function (x) { x.setAttribute('aria-pressed', x === br); });
      return;
    }
    var ip = ev.target.closest('[data-icon-pick]');
    if (ip && catCtx) {
      catCtx.c.icon = ip.dataset.iconPick;
      $$('[data-icon-pick]').forEach(function (b) { b.setAttribute('aria-checked', b === ip); });
      return;
    }
    var cp = ev.target.closest('[data-color-pick]');
    if (cp && catCtx) {
      catCtx.c.color = cp.dataset.colorPick;
      $$('[data-color-pick]').forEach(function (b) { b.setAttribute('aria-checked', b === cp); });
      return;
    }
    if (ev.target.id === 'draftDate' || ev.target.id === 'dayPick') {
      try { ev.target.showPicker && ev.target.showPicker(); } catch (e) { }
      return;
    }
    var a = ev.target.closest('[data-action]');
    if (!a) return;
    var act = a.dataset.action;
    switch (act) {
      case 'mic':
        if (ui.listening) stopListening(true); else startListening();
        break;
      case 'add':
        if (ui.listening) { recManual = true; stopListening(true); }
        if (!addDraft()) toast('اكتب المبلغ عشان أسجله');
        break;
      case 'draft-cat': openDraftPicker(+a.dataset.i); break;
      case 'draft-remind': ui.draftRemind = ui.draftRemind === 1 ? 3 : ui.draftRemind === 3 ? 0 : 1; renderDraft(); break;
      case 'draft-bill': {
        computeDraft();
        var di = draft.items[+a.dataset.i];
        if (di && di.bill) openBillEdit(null, { name: di.name, amount: di.amount, day: di.bill.day, remind: ui.draftRemind, cat: di.cat });
        break;
      }
      case 'bill-new': openBillEdit(null); break;
      case 'bill-edit': openBillEdit(a.dataset.id); break;
      case 'bill-pay': payBill(a.dataset.id, a.dataset.period); break;
      case 'bill-pay-save': savePay(); break;
      case 'bill-skip': { var sb = billById(a.dataset.id); if (sb) skipBill(sb, a.dataset.period); break; }
      case 'bill-unpay': { var ub = billCtx && billById(billCtx.b.id); if (ub) unpayBill(ub, a.dataset.period); break; }
      case 'bill-paid-noentry': { var nb = billCtx && billById(billCtx.b.id); if (nb) markPaidNoEntry(nb, a.dataset.period); break; }
      case 'bill-save': saveBill(false); break;
      case 'bill-cal-one': saveBill(true); break;
      case 'bill-cal-all': openCalendar(db.bills.map(function (b) { return b.id; })); break;
      case 'bill-del': deleteBill(); break;
      case 'bill-cat': {
        var bp = $('#billPicker');
        if (bp.hidden) { bp.innerHTML = pickerHTML(billCtx.b.cat); bp.hidden = false; }
        else { bp.hidden = true; bp.innerHTML = ''; }
        break;
      }
      case 'cal-ics': downloadIcs(); break;
      case 'quick': {
        var x = ui.quick[+a.dataset.i];
        if (x) addEntries([{ id: uid(), date: baseDay(), name: x.name, amount: x.amount, cat: x.cat, note: '', raw: '', ts: Date.now() }]);
        renderMonthStrip(); renderQuick(); renderReceipt();
        break;
      }
      case 'day': {
        var nd = addDaysStr(ui.day, +a.dataset.step);
        if (nd > todayStr()) return;
        ui.day = nd;
        ui.dayPinned = nd !== todayStr();
        renderReceipt();
        renderDraft();
        break;
      }
      case 'edit': openEdit(a.dataset.id); break;
      case 'close-sheet': closeSheet(); break;
      case 'edit-save': saveEdit(); break;
      case 'edit-del': deleteEntry(); break;
      case 'month': {
        var k = a.dataset.kind === 'log' ? 'logMonth' : 'statsMonth';
        var nm = addMonths(ui[k], +a.dataset.step);
        if (nm > thisMonth()) return;
        ui[k] = nm;
        ui.statsDay = null;
        render();
        break;
      }
      case 'log-main': ui.logMain = a.dataset.id; render(); break;
      case 'stats-open': ui.statsOpen = ui.statsOpen === a.dataset.id ? null : a.dataset.id; renderStats(); break;
      case 'stats-day': {
        var d = +a.dataset.d;
        ui.statsDay = ui.statsDay === d ? null : d;
        renderStats();
        var btn = $('[data-action="stats-day"][data-d="' + d + '"]');
        if (btn) btn.focus({ preventScroll: true });
        break;
      }
      case 'stats-month': ui.statsMonth = a.dataset.m; ui.statsDay = null; renderStats(); break;
      case 'open-day': ui.day = a.dataset.date; ui.dayPinned = ui.day !== todayStr(); goTo('today'); break;
      case 'cat-toggle': ui.catsOpen[a.dataset.id] = !ui.catsOpen[a.dataset.id]; renderCats(); break;
      case 'cat-edit': openCatEdit(a.dataset.id); break;
      case 'cat-new': openCatEdit(null, a.dataset.parent || null, !a.dataset.parent); break;
      case 'cat-save': saveCat(); break;
      case 'cat-del': deleteCat(); break;
      case 'kw-add': addKw(); break;
      case 'kw-del': {
        var list = a.dataset.t === 'learned' ? catCtx.c.learned : catCtx.c.kw;
        list.splice(+a.dataset.i, 1);
        renderKwList();
        break;
      }
      case 'theme': db.settings.theme = a.dataset.v; save(); applyTheme(); renderSettings(); break;
      case 'backup':
        db.meta.lastBackup = Date.now();
        save();
        download('masarefy-backup-' + todayStr() + '.json', JSON.stringify(db, null, 1), 'application/json');
        renderSettings();
        toast('نزلت النسخة. احفظها في مكان تاني غير الموبايل.');
        break;
      case 'restore-file': $('#restoreFile').click(); break;
      case 'copy-code':
        db.meta.lastBackup = Date.now();
        save();
        copyText(toCode(), 'اتنسخ الكود. ابعته لنفسك على واتساب.');
        break;
      case 'show-restore-code':
        $('#codeArea').innerHTML = '<textarea class="code-box" id="restoreCode" placeholder="الصق الكود هنا" aria-label="الكود"></textarea>' +
          '<button type="button" class="btn soft" data-action="restore-code">رجّع</button>';
        $('#restoreCode').focus();
        break;
      case 'restore-code':
        try { restoreFrom(fromCode($('#restoreCode').value)); }
        catch (e) { toast('الكود ده مش مظبوط. اتأكد إنك نسخته كله.'); }
        break;
      case 'csv':
        if (!db.entries.length) { toast('مفيش مصاريف لسه'); break; }
        csv();
        break;
      case 'copy-link': copyText($('#scLink').textContent, 'اتنسخ اللينك'); break;
      case 'install':
        if (installPrompt) {
          installPrompt.prompt();
          installPrompt.userChoice.finally(function () { installPrompt = null; renderSettings(); });
        }
        break;
      case 'wipe':
        if (!confirm('هتمسح كل المصاريف والبنود والإعدادات من الجهاز ده. متأكد؟')) break;
        if (!confirm('آخر مرة: مفيش رجوع بعد كده. أمسح؟')) break;
        db = freshDB();
        idxCache = null;
        save();
        applyTheme();
        ui.day = todayStr();
        ui.dayPinned = false;
        goTo('today');
        toast('اتمسح كل حاجة');
        break;
    }
  }

  function onPick(id) {
    if (pickCtx.mode === 'draft') {
      var chk = $('#learnChk');
      var learned = null;
      if (chk && chk.checked && pickCtx.word) {
        if (M.learn(db.cats, pickCtx.word, id)) { learned = pickCtx.word; catsChanged(); }
      }
      ui.overrides[pickCtx.i] = { name: pickCtx.name, cat: id };
      closeSheet();
      renderDraft();
      if (learned) toast('هفتكر إن «' + learned + '» تحت «' + cat(id).name + '»');
    } else if (pickCtx.mode === 'edit') {
      pickCtx.sel = id;
      markPicked(id);
      updateLearnBox();
    } else if (pickCtx.mode === 'bill' && billCtx) {
      billCtx.b.cat = id;
      renderBillCatBtn();
      var bp = $('#billPicker');
      bp.hidden = true;
      bp.innerHTML = '';
    }
  }

  function onInput(ev) {
    var t = ev.target;
    if (t.id === 'q') {
      autoGrow(t);
      ui.overrides = {};
      renderDraft();
    } else if (t.id === 'logQ') {
      ui.logQuery = t.value;
      renderLogList();
    } else if (t.id === 'pickQ') {
      filterPicker(t.value);
    } else if (t.id === 'eName') {
      updateLearnBox();
    }
  }

  function onChange(ev) {
    var t = ev.target;
    switch (t.id) {
      case 'draftDate':
        if (t.value) { ui.draftDate = t.value > todayStr() ? todayStr() : t.value; renderDraft(); }
        break;
      case 'dayPick':
        if (t.value) { ui.day = t.value > todayStr() ? todayStr() : t.value; ui.dayPinned = ui.day !== todayStr(); renderReceipt(); renderDraft(); }
        break;
      case 'setBudget': {
        var b = parseAmount(t.value);
        db.settings.budget = b > 0 ? b : 0;
        save();
        toast(b > 0 ? 'الميزانية بقت ' + money(b) + ' في الشهر' : 'شلت الميزانية');
        break;
      }
      case 'setCur':
        db.settings.currency = t.value.trim() || 'ج';
        save();
        break;
      case 'setVoice': db.settings.voiceAutoSave = t.checked; save(); break;
      case 'setLearn': db.settings.learn = t.checked; save(); break;
      case 'cParent': {
        var isMain = !t.value;
        $('#mainOnly').hidden = !isMain;
        renderKwList();
        break;
      }
      case 'restoreFile': {
        var f = t.files && t.files[0];
        if (!f) break;
        var r = new FileReader();
        r.onload = function () {
          try { restoreFrom(JSON.parse(r.result)); }
          catch (e) { toast('مقدرتش أقرا الملف ده.'); }
        };
        r.readAsText(f);
        t.value = '';
        break;
      }
    }
  }

  function onKey(ev) {
    var t = ev.target;
    if (t.id === 'q' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      computeDraft();
      if (!draft.items.length) return;
      if (!addDraft()) toast('اكتب المبلغ عشان أسجله');
    } else if (t.id === 'kwNew' && ev.key === 'Enter') {
      ev.preventDefault();
      addKw();
    }
  }

  /* ================= الشكل ================= */
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    var t = db.settings.theme;
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    var dark = t === 'dark' || (t !== 'light' && darkMQ.matches);
    $('#themeColor').setAttribute('content', dark ? '#12131A' : '#EEF0F3');
  }

  /* ================= البداية ================= */
  function handleParams() {
    var p = new URLSearchParams(location.search);
    var add = p.get('add') || p.get('q');
    var mic = p.get('mic');
    if (add == null && !mic) return;
    history.replaceState(null, '', location.pathname + (location.hash || '#today'));
    if (ui.view !== 'today') goTo('today');
    if (add != null && add.trim()) {
      ui.draftText = add;
      ui.day = todayStr();
      ui.dayPinned = false;
      renderToday();
      computeDraft();
      if (draftReady()) addDraft();
      else toast(draft.items.length ? 'كمّل المبلغ وبعدين دوس «سجّل»' : 'اكتب اللي صرفته ودوس «سجّل»');
    } else if (mic) {
      var q = $('#q');
      if (q) q.focus();
      startListening();
    }
  }

  function init() {
    sheet = $('#sheet');
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    sheet.addEventListener('close', function () {
      if (sheet.open) return;
      pickCtx = null; catCtx = null; billCtx = null; payCtx = null;
    });
    $$('[data-icon]').forEach(function (s) { s.innerHTML = svg(s.dataset.icon, 22); });
    $('#settingsBtn').innerHTML = svg('sliders', 22);
    $('#backBtn').innerHTML = svg('arrowR', 22);
    $('#backBtn').addEventListener('click', function () { goTo('today'); });
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', route);
    if (darkMQ.addEventListener) darkMQ.addEventListener('change', applyTheme);
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installPrompt = e;
      if (ui.view === 'settings') renderSettings();
    });
    // لو اليوم اتغير والتطبيق مفتوح
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var t = todayStr();
      if (ui.lastToday && ui.lastToday !== t) { if (ui.day === ui.lastToday || !ui.dayPinned) { ui.day = t; ui.dayPinned = false; } refresh(); }
      else updateBadge();
      ui.lastToday = t;
    });
    // لو اتعدل من تابة تانية
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { db = load(); idxCache = null; applyTheme(); refresh(); }
    });
    ui.lastToday = todayStr();
    applyTheme();
    route();
    handleParams();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }

  init();
})();
