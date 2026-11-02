/*
 * مصاريفي: فهم الكلام المكتوب أو المنطوق، والبنود الافتراضية.
 * بيشتغل في المتصفح (window.Masarefy) وفي Node (للتست).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Masarefy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- تنضيف النص ---------- */
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  function toLatinDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return AR_DIGITS.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return FA_DIGITS.indexOf(d); });
  }

  function normalize(s) {
    return toLatinDigits(s)
      .toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ء/g, '')
      .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setOf(list) {
    var s = new Set();
    list.forEach(function (w) { s.add(normalize(w)); });
    return s;
  }

  /* ---------- الكلمات ---------- */
  var CURRENCY = setOf(['جنيه', 'جنيها', 'جنيهات', 'جنية', 'جني', 'ج', 'جم', 'ج.م', 'le', 'l.e', 'egp', 'pound', 'pounds', 'بالجنيه']);
  var PRICE_MARK = setOf(['ب', 'بـ', 'بسعر', 'بمبلغ', 'بحوالي', 'بتمن', 'بثمن']);
  var THOUSAND = setOf(['الف', 'ألف', 'الاف', 'آلاف', 'تلاف', 'لاف', 'k']);
  var FILLERS = setOf([
    'انا', 'أنا', 'اني', 'احنا', 'إحنا',
    'شربت', 'اشربت', 'شربنا', 'كلت', 'اكلت', 'أكلت', 'كلنا', 'اكلنا', 'اتغديت', 'اتغدينا', 'اتعشيت', 'اتعشينا', 'فطرت', 'فطرنا',
    'اشتريت', 'شتريت', 'اشترينا', 'جبت', 'جيبت', 'جبنا', 'دفعت', 'دفعنا', 'صرفت', 'صرفنا', 'خدت', 'اخدت', 'أخدت',
    'ركبت', 'ركبنا', 'حطيت', 'عملت', 'عملنا', 'شحنت', 'طلبت', 'طلبنا', 'لقيت', 'روحت',
    'ب', 'بـ', 'بسعر', 'بمبلغ', 'بحوالي', 'حوالي', 'تقريبا', 'تقريباً', 'تمن', 'ثمن', 'حق',
    'في', 'فى', 'على', 'علي', 'من', 'كان', 'كانت', 'يعني', 'بس', 'مبلغ', 'فلوس',
    'و', 'وكمان', 'كمان', 'برضو', 'برده', 'ده', 'دي', 'دا',
    'الصبح', 'الصبحيه', 'بالليل', 'بليل', 'الضهر', 'العصر', 'المغرب', 'النهار'
  ]);
  var TODAY_W = setOf(['النهارده', 'النهاردة', 'النهاردا', 'انهارده', 'النهرده', 'النهارضه', 'اليوم']);
  var YEST_W = setOf(['امبارح', 'إمبارح', 'مبارح', 'امس', 'أمس', 'البارحة', 'امبارحه']);
  var WEEKDAYS = {};
  [['الحد', 0], ['الاحد', 0], ['الأحد', 0], ['حد', 0], ['الاتنين', 1], ['الاثنين', 1], ['الإثنين', 1],
    ['التلات', 2], ['الثلاثاء', 2], ['التلاتاء', 2], ['التلات', 2], ['الاربع', 3], ['الأربع', 3], ['الاربعاء', 3], ['الأربعاء', 3], ['الاربعا', 3],
    ['الخميس', 4], ['الجمعه', 5], ['الجمعة', 5], ['السبت', 6]].forEach(function (p) { WEEKDAYS[normalize(p[0])] = p[1]; });
  var WEEKDAY_ALONE = setOf(['الخميس', 'الجمعة', 'السبت', 'الثلاثاء', 'الأربعاء', 'الأحد']);
  var MONTHLY_W = setOf(['شهري', 'شهرية', 'شهريا', 'شهرياً', 'بالشهر']);
  var MONTH_W = setOf(['شهر', 'الشهر']);
  var FIRST_W = setOf(['اول', 'أول', 'بداية']);
  var LAST_W = setOf(['اخر', 'آخر', 'نهاية']);

  var NUMW = {};
  [
    ['واحد', 1], ['واحدة', 1], ['اتنين', 2], ['اثنين', 2], ['اتنان', 2], ['اثنان', 2],
    ['تلاتة', 3], ['ثلاثة', 3], ['تلات', 3], ['ثلاث', 3], ['اربعة', 4], ['اربع', 4], ['خمسة', 5], ['خمس', 5],
    ['ستة', 6], ['سبعة', 7], ['سبع', 7], ['تمانية', 8], ['ثمانية', 8], ['تمان', 8], ['ثمان', 8], ['تسعة', 9], ['تسع', 9], ['عشرة', 10], ['عشر', 10],
    ['حداشر', 11], ['احداشر', 11], ['اتناشر', 12], ['اطناشر', 12], ['تلتاشر', 13], ['تلطاشر', 13], ['اربعتاشر', 14], ['اربعطاشر', 14],
    ['خمستاشر', 15], ['خمسطاشر', 15], ['ستاشر', 16], ['سطاشر', 16], ['سبعتاشر', 17], ['سبعطاشر', 17], ['تمنتاشر', 18], ['تمنطاشر', 18],
    ['تسعتاشر', 19], ['تسعطاشر', 19],
    ['عشرين', 20], ['عشرون', 20], ['تلاتين', 30], ['ثلاثين', 30], ['اربعين', 40], ['خمسين', 50], ['ستين', 60], ['سبعين', 70],
    ['تمانين', 80], ['ثمانين', 80], ['تسعين', 90],
    ['مية', 100], ['ميه', 100], ['مائة', 100], ['مئة', 100], ['ميت', 100], ['مايه', 100],
    ['ميتين', 200], ['متين', 200], ['مائتين', 200], ['مئتين', 200], ['مايتين', 200],
    ['تلتمية', 300], ['تلاتمية', 300], ['ثلاثمائة', 300], ['ثلاثمية', 300], ['ربعمية', 400], ['اربعمية', 400], ['أربعمائة', 400],
    ['خمسمية', 500], ['خمسمائة', 500], ['ستمية', 600], ['ستمائة', 600], ['سبعمية', 700], ['سبعمائة', 700],
    ['تمنمية', 800], ['تمانمية', 800], ['ثمانمائة', 800], ['تسعمية', 900], ['تسعمائة', 900],
    ['الفين', 2000], ['ألفين', 2000], ['الفان', 2000],
    ['نص', 0.5], ['نصف', 0.5], ['ربع', 0.25]
  ].forEach(function (p) { NUMW[normalize(p[0])] = p[1]; });

  function isNumWord(n) { return Object.prototype.hasOwnProperty.call(NUMW, n) || THOUSAND.has(n); }

  /* ---------- البنود الافتراضية ---------- */
  var PALETTE = ['#B06A0B', '#C12F55', '#2369B8', '#157A57', '#0B7584', '#93399A', '#4B7520', '#B44E1C', '#65574B', '#555B66', '#4338CA', '#A1342A'];

  var DEFAULT_CATEGORIES = [
    { id: 'food', name: 'أكل وشرب', icon: 'utensils', color: '#B06A0B', parent: null, kw: [] },
    { id: 'food-grocery', name: 'بقالة وسوبرماركت', icon: 'cart', parent: 'food', kw: ['سوبرماركت', 'سوبر ماركت', 'ماركت', 'بقالة', 'بقال', 'كارفور', 'سبينيس', 'هايبر', 'خير زمان', 'أولاد رجب', 'فتح الله', 'عيش', 'لبن', 'جبنة', 'جبن', 'بيض', 'زيت', 'سكر', 'رز', 'أرز', 'مكرونة', 'زبادي', 'تموين', 'معلبات', 'تونة', 'عسل', 'مربى', 'دقيق', 'سمنة', 'زبدة', 'حاجات من السوبرماركت'] },
    { id: 'food-meat', name: 'لحوم وفراخ', icon: 'drumstick', parent: 'food', kw: ['لحمة', 'لحم', 'فراخ', 'فرخة', 'سمك', 'جمبري', 'كبدة', 'بانيه', 'كفتة', 'جزار', 'مفروم', 'سجق', 'لانشون', 'بسطرمة', 'ديك رومي', 'بط', 'حمام'] },
    { id: 'food-veg', name: 'خضار وفاكهة', icon: 'apple', parent: 'food', kw: ['خضار', 'خضرة', 'فاكهة', 'طماطم', 'بطاطس', 'بصل', 'ثوم', 'موز', 'برتقال', 'تفاح', 'عنب', 'مانجة', 'فراولة', 'فاكهاني', 'خضري', 'ليمون', 'خيار', 'جزر', 'كوسة', 'باذنجان', 'فلفل', 'بطيخ', 'جوافة'] },
    { id: 'food-out', name: 'أكل بره', icon: 'utensils', parent: 'food', kw: ['مطعم', 'أكل', 'اكلة', 'وجبة', 'غدا', 'غداء', 'عشا', 'عشاء', 'فطار', 'فطور', 'كشري', 'فول', 'طعمية', 'فلافل', 'شاورما', 'بيتزا', 'برجر', 'كريب', 'سندوتش', 'ساندوتش', 'سندوتشات', 'كنتاكي', 'ماكدونالدز', 'طلبات', 'دليفري', 'مشويات', 'حواوشي', 'كباب', 'بوفيه', 'فتة', 'كبسة', 'سوشي', 'مندي'] },

    { id: 'fun', name: 'رفاهيات', icon: 'ticket', color: '#C12F55', parent: null, kw: [] },
    { id: 'fun-drinks', name: 'قهوة ومشروبات', icon: 'coffee', parent: 'fun', kw: ['قهوة', 'بن', 'كافيه', 'كافي', 'كوفي', 'نسكافيه', 'اسبريسو', 'لاتيه', 'كابتشينو', 'موكا', 'ستاربكس', 'كوستا', 'شاي', 'عصير', 'عصاير', 'كانز', 'بيبسي', 'كوكاكولا', 'كولا', 'سبرايت', 'ريدبول', 'مشروب', 'مشروبات', 'سحلب', 'ينسون', 'موخيتو', 'سموزي', 'ميلك شيك', 'مياه معدنية', 'ازازة مية', 'ازازة مياه'] },
    { id: 'fun-sweets', name: 'حلويات وسناكس', icon: 'icecream', parent: 'fun', kw: ['شوكولاتة', 'شيكولاتة', 'شوكولا', 'حلويات', 'حلوى', 'بسكوت', 'بسكويت', 'شيبسي', 'سناكس', 'سناك', 'آيس كريم', 'ايس كريم', 'جيلاتي', 'كيك', 'تورتة', 'جاتوه', 'كنافة', 'بسبوسة', 'دونتس', 'لب', 'سوداني', 'مكسرات', 'لبان', 'كرواسون', 'مولتو', 'ويفر'] },
    { id: 'fun-outing', name: 'خروجات وترفيه', icon: 'ticket', parent: 'fun', kw: ['سينما', 'خروجة', 'فسحة', 'ملاهي', 'بلايستيشن', 'بلاي ستيشن', 'بولينج', 'ماتش', 'ملعب', 'حفلة', 'مسرح', 'رحلة', 'مصيف', 'شاليه', 'تذكرة سينما'] },
    { id: 'fun-smoke', name: 'سجاير', icon: 'cigarette', parent: 'fun', kw: ['سجاير', 'سجائر', 'سيجارة', 'علبة سجاير', 'كليوباترا', 'مارلبورو', 'ميريت', 'شيشة', 'معسل', 'فيب', 'ليكويد', 'ولاعة', 'دخان'] },
    { id: 'fun-subs', name: 'اشتراكات', icon: 'tv', parent: 'fun', kw: ['نتفليكس', 'شاهد', 'سبوتيفاي', 'انغامي', 'يوتيوب بريميوم', 'اشتراك', 'واتش ات', 'osn', 'ديزني', 'chatgpt', 'شات جي بي تي', 'claude', 'كلود', 'ابل ميوزك', 'icloud', 'جوجل وان', 'بلايستيشن بلس'] },

    { id: 'transport', name: 'مواصلات', icon: 'car', color: '#2369B8', parent: null, kw: [] },
    { id: 'tr-fuel', name: 'بنزين', icon: 'fuel', parent: 'transport', kw: ['بنزين', 'بنزينة', 'سولار', 'تفويل', 'غاز طبيعي', 'محطة بنزين'] },
    { id: 'tr-taxi', name: 'أوبر وتاكسي', icon: 'car', parent: 'transport', kw: ['أوبر', 'uber', 'كريم', 'careem', 'ديدي', 'didi', 'اندرايف', 'ان درايف', 'indrive', 'تاكسي', 'توك توك', 'تكتك', 'بولت', 'سواق'] },
    { id: 'tr-public', name: 'مواصلات عامة', icon: 'bus', parent: 'transport', kw: ['مترو', 'ميكروباص', 'مكروباص', 'ميكرو', 'اتوبيس', 'باص', 'قطر', 'قطار', 'مواصلات', 'مواصلة', 'أجرة', 'سوبر جيت', 'جو باص', 'سويفل', 'تذكرة مترو', 'كارت مترو', 'مونوريل', 'معدية'] },
    { id: 'tr-car', name: 'العربية', icon: 'wrench', parent: 'transport', kw: ['صيانة', 'ميكانيكي', 'كاوتش', 'غسيل عربية', 'تغيير زيت', 'زيت العربية', 'ركنة', 'باركينج', 'جراج', 'مخالفة', 'ترخيص', 'عربية', 'تأمين العربية', 'سايس', 'بطارية العربية'] },

    { id: 'home', name: 'بيت وفواتير', icon: 'home', color: '#157A57', parent: null, kw: [] },
    { id: 'home-utils', name: 'كهربا ومياه وغاز', icon: 'bolt', parent: 'home', kw: ['كهربا', 'كهرباء', 'عداد', 'كارت الكهربا', 'مياه', 'فاتورة المياه', 'فاتورة الكهربا', 'غاز', 'فاتورة الغاز', 'أنبوبة'] },
    { id: 'home-net', name: 'نت وموبايل', icon: 'phone', parent: 'home', kw: ['نت', 'انترنت', 'راوتر', 'واي فاي', 'wifi', 'وي', 'we', 'فودافون', 'اورنج', 'أورانج', 'اتصالات', 'رصيد', 'كارت شحن', 'شحن', 'باقة', 'باقة النت', 'اشتراك النت', 'فاتورة التليفون', 'فاتورة الموبايل', 'تليفون أرضي'] },
    { id: 'home-rent', name: 'إيجار', icon: 'key', parent: 'home', kw: ['إيجار', 'صاحب الشقة', 'شقة', 'سكن', 'سمسار'] },
    { id: 'home-supplies', name: 'مستلزمات البيت', icon: 'sofa', parent: 'home', kw: ['منظفات', 'صابون', 'كلور', 'مسحوق', 'فيري', 'مناديل', 'أكياس زبالة', 'زبالة', 'لمبة', 'أدوات منزلية', 'حاجات البيت', 'أثاث', 'سباك', 'كهربائي', 'نجار', 'بواب', 'تصليح', 'ستارة', 'مفارش'] },

    { id: 'health', name: 'صحة', icon: 'heart', color: '#0B7584', parent: null, kw: [] },
    { id: 'health-pharmacy', name: 'صيدلية وأدوية', icon: 'pill', parent: 'health', kw: ['صيدلية', 'دوا', 'دواء', 'أدوية', 'علاج', 'برشام', 'مسكن', 'بنادول', 'فيتامين', 'فيتامينات', 'حقنة', 'شراب كحة', 'كمامة', 'مرهم', 'قطرة'] },
    { id: 'health-doctor', name: 'دكاترة وتحاليل', icon: 'stethoscope', parent: 'health', kw: ['دكتور', 'دكتورة', 'كشف', 'عيادة', 'تحاليل', 'تحليل', 'أشعة', 'مستشفى', 'دكتور سنان', 'نضارة', 'عدسات', 'علاج طبيعي', 'روشتة'] },
    { id: 'health-gym', name: 'جيم ورياضة', icon: 'dumbbell', parent: 'health', kw: ['جيم', 'اشتراك الجيم', 'نادي', 'تمرين', 'بروتين', 'كوتش', 'سباحة', 'يوجا', 'كرياتين'] },

    { id: 'personal', name: 'لبس وعناية', icon: 'shirt', color: '#93399A', parent: null, kw: [] },
    { id: 'pers-clothes', name: 'لبس وجزم', icon: 'shirt', parent: 'personal', kw: ['لبس', 'هدوم', 'قميص', 'تيشيرت', 'تيشرت', 'بنطلون', 'جينز', 'جزمة', 'كوتشي', 'شوز', 'صندل', 'شبشب', 'جاكيت', 'جاكت', 'شراب', 'بوكسر', 'فستان', 'بدلة', 'ترنج', 'ترينج', 'شنطة', 'ساعة', 'حزام', 'ترزي'] },
    { id: 'pers-care', name: 'حلاقة وعناية', icon: 'scissors', parent: 'personal', kw: ['حلاق', 'حلاقة', 'شعر', 'ذقن', 'شامبو', 'برفان', 'بارفان', 'ريحة', 'مزيل عرق', 'معجون', 'فرشة سنان', 'كريم شعر', 'جل', 'شفرات', 'موس حلاقة', 'صالون', 'كوافير', 'مكياج', 'عطر', 'لوشن'] },

    { id: 'learn', name: 'تعليم وشغل', icon: 'book', color: '#4B7520', parent: null, kw: [] },
    { id: 'learn-courses', name: 'كورسات وكتب', icon: 'book', parent: 'learn', kw: ['كورس', 'كورسات', 'كتاب', 'كتب', 'دروس', 'درس', 'مذكرة', 'مذكرات', 'كلية', 'جامعة', 'مدرسة', 'مصاريف دراسة', 'يوديمي', 'udemy', 'امتحان', 'شهادة', 'كشكول', 'أقلام', 'مكتبة'] },
    { id: 'learn-work', name: 'أجهزة وشغل', icon: 'laptop', parent: 'learn', kw: ['لابتوب', 'كمبيوتر', 'شاحن', 'سماعة', 'سماعات', 'كابل', 'هارد', 'فلاشة', 'ماوس', 'كيبورد', 'موبايل جديد', 'شاشة', 'دومين', 'استضافة', 'سيرفر', 'برنامج', 'برامج', 'github', 'جيت هاب', 'طابعة', 'حبر'] },

    { id: 'gifts', name: 'مناسبات وهدايا', icon: 'gift', color: '#B44E1C', parent: null, kw: [] },
    { id: 'gift-gifts', name: 'هدايا', icon: 'gift', parent: 'gifts', kw: ['هدية', 'هدايا', 'ورد', 'بوكيه', 'عيد ميلاد'] },
    { id: 'gift-invite', name: 'عزومات ومناسبات', icon: 'users', parent: 'gifts', kw: ['عزومة', 'عزمت', 'عزمنا', 'ضيوف', 'فرح', 'خطوبة', 'سبوع', 'نقطة', 'عزا', 'عزاء'] },
    { id: 'gift-charity', name: 'صدقات وزكاة', icon: 'heart', parent: 'gifts', kw: ['صدقة', 'زكاة', 'تبرع', 'شحات', 'جامع', 'كنيسة', 'عيدية', 'كفارة', 'فطرة', 'أضحية'] },

    { id: 'dues', name: 'التزامات وأقساط', icon: 'card', color: '#65574B', parent: null, kw: [] },
    { id: 'dues-install', name: 'أقساط', icon: 'card', parent: 'dues', kw: ['قسط', 'أقساط', 'تقسيط', 'قسط العربية', 'فاليو', 'valu', 'كونتكت', 'سداد', 'بطاقة ائتمان', 'كريدت', 'فيزا', 'فاتورة الفيزا', 'قرض'] },
    { id: 'dues-family', name: 'مصروف البيت والأهل', icon: 'users', parent: 'dues', kw: ['مصروف البيت', 'مصروف', 'ماما', 'بابا', 'أمي', 'أبويا', 'أخويا', 'أختي', 'مراتي', 'الولاد', 'العيال', 'العيلة', 'بنتي', 'ابني'] },
    { id: 'dues-loans', name: 'سلف وديون', icon: 'repeat', parent: 'dues', kw: ['سلف', 'سلفة', 'سلفت', 'دين', 'ديون', 'رجعت فلوس', 'جمعية', 'سددت'] },
    { id: 'dues-bills', name: 'فواتير شهرية', icon: 'calendarClock', parent: 'dues', kw: ['فواتير شهرية', 'فاتورة شهرية'] },

    { id: 'other', name: 'أخرى', icon: 'box', color: '#555B66', parent: null, kw: [], fixed: true }
  ];

  // أفعال بتدل على البند لو مفيش كلمة أوضح منها
  var HINTS = {
    'fun-drinks': ['شربت', 'اشربت', 'شربنا'],
    'food-out': ['اكلت', 'كلت', 'كلنا', 'اكلنا', 'اتغديت', 'اتغدينا', 'اتعشيت', 'اتعشينا', 'فطرت', 'فطرنا'],
    'tr-taxi': ['ركبت', 'ركبنا'],
    'home-net': ['شحنت'],
    'gift-invite': ['عزمت', 'عزمنا']
  };
  var HINTS_N = {};
  Object.keys(HINTS).forEach(function (id) { HINTS[id].forEach(function (w) { HINTS_N[normalize(w)] = id; }); });

  function defaultCategories() {
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)).map(function (c) {
      c.learned = [];
      if (!c.parent) c.budget = 0;
      return c;
    });
  }

  /* ---------- مطابقة الكلمات ---------- */
  var PREFIXES = ['وبال', 'وال', 'بال', 'فال', 'لل', 'ال', 'و', 'ب', 'ف', 'ل'];

  function variants(tok) {
    var out = [tok];
    PREFIXES.forEach(function (p) {
      if (tok.indexOf(p) === 0 && tok.length - p.length >= 2) out.push(tok.slice(p.length));
    });
    var base = out.slice();
    base.forEach(function (v) {
      var m = v.match(/^(.{2,})ت(ي|ك|نا|ها|هم)$/);
      if (m) out.push(m[1] + 'ه');
      var m2 = v.match(/^(.{3,})(ي|ك|نا|ها)$/);
      if (m2) out.push(m2[1]);
    });
    return out;
  }

  function buildIndex(cats) {
    var list = [];
    var all = new Set();
    (cats || []).forEach(function (c) {
      var words = (c.kw || []).concat(c.learned || []);
      var seen = new Set();
      words.forEach(function (w) {
        var k = normalize(w);
        if (!k || seen.has(k)) return;
        seen.add(k);
        all.add(k);
        list.push({ id: c.id, sub: !!c.parent, k: k, phrase: k.indexOf(' ') >= 0 });
      });
    });
    return { list: list, all: all, ids: new Set((cats || []).map(function (c) { return c.id; })) };
  }

  function classify(tokens, nameN, index) {
    var joined = ' ' + tokens.join(' ') + ' ';
    var best = null;
    var bestScore = 0;
    var tokVariants = tokens.map(variants);
    index.list.forEach(function (e) {
      var s = 0;
      if (e.phrase) {
        if (joined.indexOf(' ' + e.k + ' ') >= 0) s = e.k.length + 2;
        else if (joined.indexOf(e.k) >= 0) s = e.k.length;
      } else {
        tokVariants.forEach(function (vs) {
          vs.forEach(function (v) {
            if (v === e.k) s = Math.max(s, e.k.length + 1);
            else if (e.k.length >= 4 && v.length > e.k.length && v.length - e.k.length <= 2 && v.indexOf(e.k) === 0) s = Math.max(s, e.k.length);
          });
        });
      }
      if (s && nameN && nameN === e.k) s += 50;
      if (s > bestScore || (s && s === bestScore && best && !best.sub && e.sub)) {
        best = e;
        bestScore = s;
      }
    });
    if (best) return { id: best.id, matched: best.k, score: bestScore };
    for (var i = 0; i < tokens.length; i++) {
      var hid = HINTS_N[tokens[i]];
      if (hid && index.ids.has(hid)) return { id: hid, matched: tokens[i], score: 0.5 };
    }
    return { id: 'other', matched: null, score: 0 };
  }

  /* ---------- التواريخ ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toDate(x) {
    if (x instanceof Date) return new Date(x.getFullYear(), x.getMonth(), x.getDate());
    var p = String(x).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; }

  /* ---------- تقطيع الجملة ---------- */
  function tokenize(text) {
    var t = toLatinDigits(text);
    t = t.replace(/٫/g, '.').replace(/(\d)[,٬](?=\d{3}(?!\d))/g, '$1');
    t = t.replace(/[،,؛;\n\r]+/g, ' | ');
    t = t.replace(/\s*\+\s*/g, ' | ');
    t = t.replace(/[!؟?"'«»()\[\]{}:]+/g, ' ');
    t = t.replace(/(\d)([^\d\s.|])/g, '$1 $2').replace(/([^\d\s.|])(\d)/g, '$1 $2');
    t = t.replace(/(\d)\.(?!\d)/g, '$1 ');
    return t.split(/\s+/).filter(Boolean).map(function (raw) {
      return { raw: raw, n: raw === '|' ? '|' : normalize(raw) };
    }).filter(function (tk) { return tk.n; });
  }

  function isNumTok(n) { return /^\d+(\.\d+)?$/.test(n); }

  /*
   * parse(text, {categories, today, base})
   * بيرجع { items: [{name, amount, cat, matched, date}], date, dateFound }
   */
  function parse(text, opts) {
    opts = opts || {};
    var today = toDate(opts.today || new Date());
    var base = opts.base ? toDate(opts.base) : today;
    var index = opts.index || buildIndex(opts.categories || defaultCategories());
    var catsById = {};
    (opts.categories || defaultCategories()).forEach(function (c) { catsById[c.id] = c; });

    var src = String(text || '');
    var date = null;

    // تاريخ مكتوب زي 5/11 أو 5/11/2026
    src = toLatinDigits(src).replace(/(^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?(?=\s|$)/, function (m, sp, d, mo, y) {
      d = +d; mo = +mo;
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return m;
      var yr = y ? (+y < 100 ? 2000 + +y : +y) : today.getFullYear();
      var dt = new Date(yr, mo - 1, d);
      if (!y && dt > today) dt = new Date(yr - 1, mo - 1, d);
      date = dt;
      return sp;
    });

    var T = tokenize(src);
    T.forEach(function (tk) {
      if (tk.n === '|') tk.type = 'sep';
      else if (isNumTok(tk.n)) { tk.type = 'num'; tk.val = parseFloat(tk.n); }
      else if (CURRENCY.has(tk.n.replace(/\./g, '')) || CURRENCY.has(tk.n)) tk.type = 'cur';
      else if (tk.n === 'جنيهين') { tk.type = 'num'; tk.val = 2; tk.withCur = true; }
      else if (PRICE_MARK.has(tk.n)) tk.type = 'mark';
      else tk.type = 'word';
    });

    var hasDigits = T.some(function (tk) { return tk.type === 'num'; });

    // أرقام بالكلام. لو فيه أرقام مكتوبة كمان، بناخد اللي بالكلام بس لو قبله «ب» أو بعده «جنيه»
    (function () {
      var X = [];
      T.forEach(function (tk) {
        if (tk.type === 'word' && !isNumWord(tk.n)) {
          if (tk.n.length > 1 && tk.n[0] === 'ب' && isNumWord(tk.n.slice(1))) {
            X.push({ raw: 'ب', n: 'ب', type: 'mark' });
            X.push({ raw: tk.raw.replace(/^ب/, ''), n: tk.n.slice(1), type: 'word' });
            return;
          }
          if (!hasDigits && tk.n.length > 1 && tk.n[0] === 'و' && isNumWord(tk.n.slice(1))) {
            X.push({ raw: 'و', n: 'و', type: 'word' });
            X.push({ raw: tk.raw.replace(/^و/, ''), n: tk.n.slice(1), type: 'word' });
            return;
          }
        }
        X.push(tk);
      });
      var Y = [];
      for (var i = 0; i < X.length;) {
        var tk = X[i];
        var startsThousand = tk.type === 'word' && THOUSAND.has(tk.n) && tk.n !== 'k';
        if (tk.type === 'word' && isNumWord(tk.n) && (!THOUSAND.has(tk.n) || (startsThousand && !hasDigits))) {
          var total = 0, cur = 0, raws = [], j = i;
          if (startsThousand) { total = 1000; raws.push(tk.raw); j++; }
          while (j < X.length) {
            var n = X[j].n;
            var isW = X[j].type === 'word';
            var attached = isW && n.length > 1 && n[0] === 'و' && Object.prototype.hasOwnProperty.call(NUMW, n.slice(1)) && j > i;
            if (isW && Object.prototype.hasOwnProperty.call(NUMW, n) && (j === i || X[j - 1].n === 'و')) {
              cur += NUMW[n]; raws.push(X[j].raw); j++;
            } else if (attached) {
              cur += NUMW[n.slice(1)]; raws.push(X[j].raw); j++;
            } else if (isW && THOUSAND.has(n) && raws.length) {
              cur = (cur || 1) * 1000; total += cur; cur = 0; raws.push(X[j].raw); j++;
            } else if (n === 'و' && j + 1 < X.length && X[j + 1].type === 'word' && Object.prototype.hasOwnProperty.call(NUMW, X[j + 1].n) && raws.length) {
              raws.push(X[j].raw); j++;
            } else break;
          }
          var prev = Y[Y.length - 1];
          var next = X[j];
          var keep = !hasDigits || (prev && prev.type === 'mark') || (next && next.type === 'cur');
          if (keep) Y.push({ raw: raws.join(' '), n: String(total + cur), type: 'num', val: total + cur, fromWords: true });
          else for (var k2 = i; k2 < j; k2++) Y.push(X[k2]);
          i = j;
        } else { Y.push(tk); i++; }
      }
      T = Y;
    })();

    // 2 الف، 1.5 الف، 20 ونص
    for (var a = 0; a < T.length; a++) {
      if (T[a].type !== 'num') continue;
      var nx = T[a + 1];
      if (nx && nx.type === 'word' && THOUSAND.has(nx.n)) {
        T[a].val *= 1000; T[a].raw += ' ' + nx.raw; T.splice(a + 1, 1);
      } else if (nx && nx.type === 'word' && (nx.n === 'ونص' || nx.n === 'ونصف')) {
        T[a].val += 0.5; T[a].raw += ' ' + nx.raw; T.splice(a + 1, 1);
      }
    }

    // فاتورة بتتكرر كل شهر: «كل شهر»، «شهري»، «يوم 5 من كل شهر»، «أول كل شهر»
    var bill = null;
    for (var q = 0; q < T.length; q++) {
      var bq = T[q], bn = T[q + 1];
      if (bq.type !== 'word') continue;
      if (bq.n === 'كل' && bn && MONTH_W.has(bn.n)) { bill = bill || {}; bq.type = 'bill'; bn.type = 'bill'; q++; }
      else if (MONTHLY_W.has(bq.n)) { bill = bill || {}; bq.type = 'bill'; }
    }
    if (bill) {
      for (var r = 0; r < T.length; r++) {
        var br = T[r], bnx = T[r + 1];
        if (br.type !== 'word') continue;
        if (br.n === 'يوم' && bnx && bnx.type === 'num' && Number.isInteger(bnx.val) && bnx.val >= 1 && bnx.val <= 31 &&
          !(T[r + 2] && T[r + 2].type === 'cur') && !(T[r - 1] && T[r - 1].type === 'mark')) {
          bill.day = bnx.val; br.type = 'bill'; bnx.type = 'bill'; r++;
        } else if ((FIRST_W.has(br.n) || LAST_W.has(br.n)) && bnx && (bnx.type === 'bill' || MONTH_W.has(bnx.n))) {
          bill.day = FIRST_W.has(br.n) ? 1 : 31; br.type = 'bill'; bnx.type = 'bill';
        }
      }
    }

    // التاريخ بالكلام
    for (var b = 0; b < T.length; b++) {
      var w = T[b];
      if (w.type === 'num' || w.type === 'sep') continue;
      var nb = T[b + 1];
      if (w.n === 'اول' && nb && YEST_W.has(nb.n)) {
        date = addDays(today, -2); w.type = 'date'; nb.type = 'date'; b++;
      } else if (YEST_W.has(w.n)) {
        date = addDays(today, -1); w.type = 'date';
      } else if (TODAY_W.has(w.n)) {
        date = today; w.type = 'date';
      } else if (w.n === 'يوم' && nb && nb.type === 'num' && Number.isInteger(nb.val) && nb.val >= 1 && nb.val <= 31 && !(T[b + 2] && T[b + 2].type === 'cur') && !(T[b - 1] && T[b - 1].type === 'mark')) {
        var dd = new Date(today.getFullYear(), today.getMonth(), nb.val);
        if (dd > today) dd = new Date(today.getFullYear(), today.getMonth() - 1, nb.val);
        date = dd; w.type = 'date'; nb.type = 'date'; b++;
      } else if (w.n === 'يوم' && nb && Object.prototype.hasOwnProperty.call(WEEKDAYS, nb.n)) {
        date = lastWeekday(today, WEEKDAYS[nb.n]); w.type = 'date'; nb.type = 'date'; b++;
      } else if (WEEKDAY_ALONE.has(w.n)) {
        date = lastWeekday(today, WEEKDAYS[w.n]); w.type = 'date';
      }
    }

    // أنهي رقم هو المبلغ
    var nums = [];
    T.forEach(function (tk, idx) {
      if (tk.type !== 'num') return;
      var prev = null;
      for (var k = idx - 1; k >= 0; k--) { if (T[k].type !== 'date') { prev = T[k]; break; } }
      var next = T[idx + 1];
      tk.strong = !!(tk.withCur || (prev && prev.type === 'mark') || (next && next.type === 'cur'));
      nums.push(tk);
    });
    var strong = nums.filter(function (x) { return x.strong; });
    var amounts = strong.length ? strong : nums;
    nums.forEach(function (x) {
      if (amounts.indexOf(x) >= 0) x.amount = true;
      else { x.type = 'word'; x.n = normalize(x.raw); }
    });

    // تقسيم لأكتر من مصروف
    var chunks = [[]];
    T.forEach(function (tk) {
      if (tk.type === 'sep') chunks.push([]);
      else chunks[chunks.length - 1].push(tk);
    });

    var segments = [];
    chunks.forEach(function (ch) {
      if (!ch.length) return;
      var amtIdx = [];
      ch.forEach(function (tk, i2) { if (tk.amount) amtIdx.push(i2); });
      if (amtIdx.length <= 1) { segments.push(ch); return; }
      var first = -1;
      for (var f = 0; f < ch.length; f++) {
        var t2 = ch[f];
        if (t2.type === 'mark' || t2.type === 'date' || t2.type === 'cur') continue;
        if (t2.type === 'word' && FILLERS.has(t2.n)) continue;
        first = f; break;
      }
      var numFirst = first >= 0 && ch[first].amount;
      var cuts = [];
      if (numFirst) {
        amtIdx.slice(1).forEach(function (ai) {
          var c = ai;
          if (ch[c - 1] && ch[c - 1].type === 'mark') c--;
          cuts.push(c);
        });
      } else {
        amtIdx.slice(0, -1).forEach(function (ai) {
          var e = ai;
          while (ch[e + 1] && ch[e + 1].type === 'cur') e++;
          cuts.push(e + 1);
        });
      }
      var start = 0;
      cuts.forEach(function (c) { segments.push(ch.slice(start, c)); start = c; });
      segments.push(ch.slice(start));
    });

    var items = [];
    segments.forEach(function (seg, si) {
      var amtTok = null;
      seg.forEach(function (tk) { if (tk.amount && !amtTok) amtTok = tk; });
      var words = seg.filter(function (tk) { return tk.type === 'word'; });
      var nameToks = words.slice();
      var isFiller = function (n) { return FILLERS.has(n) || (n.length > 2 && n[0] === 'و' && FILLERS.has(n.slice(1))); };
      while (nameToks.length && isFiller(nameToks[0].n)) nameToks.shift();
      while (nameToks.length && isFiller(nameToks[nameToks.length - 1].n)) nameToks.pop();
      if (!amtTok && !nameToks.length) return;
      nameToks = nameToks.map(function (tk) { return { raw: tk.raw, n: tk.n }; });
      if (si > 0 && nameToks.length) {
        var f0 = nameToks[0];
        if (f0.n[0] === 'و' && f0.n.length >= 4 && !index.all.has(f0.n)) {
          f0.raw = f0.raw.replace(/^و/, ''); f0.n = f0.n.slice(1);
        }
      }
      if (nameToks.length) {
        var h = nameToks[0];
        if (/^ال/.test(h.raw) && h.n.length >= 5) { h.raw = h.raw.replace(/^ال/, ''); h.n = h.n.slice(2); }
      }
      var name = nameToks.map(function (tk) { return tk.raw; }).join(' ').trim();
      var nameN = normalize(name);
      var cls = classify(words.map(function (tk) { return tk.n; }), nameN, index);
      if (!name) name = cls.id !== 'other' && catsById[cls.id] ? catsById[cls.id].name : 'مصروف';
      items.push({
        name: name,
        amount: amtTok ? Math.round(amtTok.val * 100) / 100 : null,
        cat: cls.id,
        matched: cls.matched,
        date: ymd(date || base),
        bill: bill ? { day: bill.day || null } : null
      });
    });

    return { items: items, date: ymd(date || base), dateFound: !!date, isBill: !!bill };
  }

  function lastWeekday(today, wd) {
    var diff = (today.getDay() - wd + 7) % 7;
    return addDays(today, -diff);
  }

  /* ---------- التعلّم من التصليح ---------- */
  function learnTarget(name, cats) {
    var words = String(name || '').trim().split(/\s+/).map(function (raw) {
      var n = normalize(raw);
      if (/^ال/.test(n) && n.length >= 5) { raw = raw.replace(/^[اأإآ]ل/, ''); n = n.slice(2); }
      return { raw: raw, n: n };
    }).filter(function (w) {
      return w.n && !/\d/.test(w.n) && !FILLERS.has(w.n) && !isNumWord(w.n) && w.n.length >= 2;
    });
    if (!words.length) return null;
    if (words.length === 1) return words[0].raw;
    var idx = buildIndex(cats);
    var known = words.some(function (w) { return idx.all.has(w.n); });
    return known ? words.map(function (w) { return w.raw; }).join(' ') : words[0].raw;
  }

  function learn(cats, word, catId) {
    var k = normalize(word);
    if (!k) return false;
    var target = null;
    cats.forEach(function (c) {
      c.kw = (c.kw || []).filter(function (w) { return normalize(w) !== k; });
      c.learned = (c.learned || []).filter(function (w) { return normalize(w) !== k; });
      if (c.id === catId) target = c;
    });
    if (!target) return false;
    target.learned.unshift(word);
    return true;
  }

  return {
    normalize: normalize,
    toLatinDigits: toLatinDigits,
    parse: parse,
    buildIndex: buildIndex,
    classify: classify,
    defaultCategories: defaultCategories,
    learnTarget: learnTarget,
    learn: learn,
    PALETTE: PALETTE,
    ymd: ymd,
    toDate: toDate,
    addDays: addDays
  };
});
