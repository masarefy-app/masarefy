// node tests/parser.test.js
const M = require('../parser.js');
const cats = M.defaultCategories();
const today = '2026-11-02'; // الاتنين

const cases = [
  ['انا شربت قهوه ب 20 جنيه', [['قهوه', 20, 'fun-drinks']], '2026-11-02'],
  ['قهوة 20', [['قهوة', 20, 'fun-drinks']]],
  ['شربت قهوة بـ20', [['قهوة', 20, 'fun-drinks']]],
  ['قهوة ٢٠ ج', [['قهوة', 20, 'fun-drinks']]],
  ['اشتريت عيش ب 10 وجبنه ب 45', [['عيش', 10, 'food-grocery'], ['جبنه', 45, 'food-grocery']]],
  ['امبارح ركبت أوبر بـ 85، وشربت قهوة بـ 40', [['أوبر', 85, 'tr-taxi'], ['قهوة', 40, 'fun-drinks']], '2026-11-01'],
  ['اول امبارح بنزين 400', [['بنزين', 400, 'tr-fuel']], '2026-10-31'],
  ['دفعت الايجار 3500', [['ايجار', 3500, 'home-rent']]],
  ['شحنت رصيد 50', [['رصيد', 50, 'home-net']]],
  ['2 قهوة ب 40', [['2 قهوة', 40, 'fun-drinks']]],
  ['خمسين جنيه بنزين', [['بنزين', 50, 'tr-fuel']]],
  ['قهوة بعشرين', [['قهوة', 20, 'fun-drinks']]],
  ['كشري بخمسة وعشرين', [['كشري', 25, 'food-out']]],
  ['اكلت كشري بمية وخمسين', [['كشري', 150, 'food-out']]],
  ['تلات تلاف ايجار', [['ايجار', 3000, 'home-rent']]],
  ['20 قهوة 30 عيش', [['قهوة', 20, 'fun-drinks'], ['عيش', 30, 'food-grocery']]],
  ['قهوة 20 + سجاير 95 + اوبر 60', [['قهوة', 20, 'fun-drinks'], ['سجاير', 95, 'fun-smoke'], ['اوبر', 60, 'tr-taxi']]],
  ['يوم الخميس سوبرماركت 520', [['سوبرماركت', 520, 'food-grocery']], '2026-10-29'],
  ['يوم 25 بنزين 300', [['بنزين', 300, 'tr-fuel']], '2026-10-25'],
  ['1,250 لابتوب', [['لابتوب', 1250, 'learn-work']]],
  ['كشف دكتور 300', [['كشف دكتور', 300, 'health-doctor']]],
  ['هدية لماما 300', [['هدية لماما', 300, 'gift-gifts']]],
  ['ركبت مترو 10', [['مترو', 10, 'tr-public']]],
  ['ركبت ب 60', [['أوبر وتاكسي', 60, 'tr-taxi']]],
  ['سهرة مع صحابي 150', [['سهرة مع صحابي', 150, 'other']]],
  ['قهوة', [['قهوة', null, 'fun-drinks']]],
  ['كوتشي جديد 1200', [['كوتشي جديد', 1200, 'pers-clothes']]],
  ['كريم شعر 80', [['كريم شعر', 80, 'pers-care']]],
  ['تغيير زيت العربية 650', [['تغيير زيت العربية', 650, 'tr-car']]],
  ['بصلحلي عربيتي 900', [['بصلحلي عربيتي', 900, 'tr-car']]],
  ['ازازة مية بعشرة', [['ازازة مية', 10, 'fun-drinks']]],
  ['فاتورة الكهربا 650', [['فاتورة الكهربا', 650, 'home-utils']]],
  ['5/10 جيم 400', [['جيم', 400, 'health-gym']], '2026-10-05'],
  ['قسط العربية 2500', [['قسط العربية', 2500, 'dues-install']]],
  ['اتغديت ب 120', [['أكل بره', 120, 'food-out']]],
  ['نص كيلو لحمة 250', [['نص كيلو لحمة', 250, 'food-meat']]],
  ['عصير قصب 15 وفطار فول وطعمية 35', [['عصير قصب', 15, 'fun-drinks'], ['فطار فول وطعمية', 35, 'food-out']]],
  ['2 كيلو طماطم ب 30', [['2 كيلو طماطم', 30, 'food-veg']]],
  ['دفعت 3500 ايجار و 450 نت', [['ايجار', 3500, 'home-rent'], ['نت', 450, 'home-net']]],
  ['اوبر 85.5', [['اوبر', 85.5, 'tr-taxi']]],
  ['قهوة 20ج', [['قهوة', 20, 'fun-drinks']]],
  ['سجاير ١٠٠ جنيه', [['سجاير', 100, 'fun-smoke']]],
  ['فطار فول وطعمية بخمسة وعشرين', [['فطار فول وطعمية', 25, 'food-out']]],
  ['اتغديت بمية وعشرين', [['أكل بره', 120, 'food-out']]],
  ['الف وخمسمية ايجار', [['ايجار', 1500, 'home-rent']]],
  ['ألفين جنيه قسط', [['قسط', 2000, 'dues-install']]],
  ['جبت هدية بـ 250 امبارح', [['هدية', 250, 'gift-gifts']], '2026-11-01'],
  ['اول امبارح تاكسي 60', [['تاكسي', 60, 'tr-taxi']], '2026-10-31'],
  ['يوم السبت جيم 400', [['جيم', 400, 'health-gym']], '2026-10-31'],
  ['كارت شحن فودافون 100', [['كارت شحن فودافون', 100, 'home-net']]],
  ['علاج بـ ٣٥٠', [['علاج', 350, 'health-pharmacy']]],
  ['تلات قهوة بـ 75', [['تلات قهوة', 75, 'fun-drinks']]],
  ['دفعت فاتورة الغاز 120', [['فاتورة الغاز', 120, 'home-utils']]],
  ['نص كيلو بن 180', [['نص كيلو بن', 180, 'fun-drinks']]],
  ['قصة شعر 100', [['قصة شعر', 100, 'pers-care']]],
  ['باركينج 20 وبنزين 300', [['باركينج', 20, 'tr-car'], ['بنزين', 300, 'tr-fuel']]],
  ['كتاب 250 جنيه', [['كتاب', 250, 'learn-courses']]],
  ['مصروف البيت 2000', [['مصروف البيت', 2000, 'dues-family']]],
  ['سلفت أحمد 500', [['سلفت أحمد', 500, 'dues-loans']]],
  ['تبرع للجامع 200', [['تبرع للجامع', 200, 'gift-charity']]],
  ['بطيخة 90', [['بطيخة', 90, 'food-veg']]],
  ['مكرونة ورز وزيت 140', [['مكرونة ورز وزيت', 140, 'food-grocery']]],
  ['تذكرة مترو ١٠ وميكروباص ٨', [['تذكرة مترو', 10, 'tr-public'], ['ميكروباص', 8, 'tr-public']]],
  ['كريب 65 و كانز 20', [['كريب', 65, 'food-out'], ['كانز', 20, 'fun-drinks']]],
  ['الف جنيه', [['مصروف', 1000, 'other']]],
];

// فواتير شهرية: [النص، الاسم، المبلغ، اليوم]
const bills = [
  ['فاتورة النت 450 كل شهر يوم 2', 'فاتورة النت', 450, 2],
  ['الإيجار 3500 أول كل شهر', 'إيجار', 3500, 1],
  ['فاتورة الكهربا كل شهر يوم 10', 'فاتورة الكهربا', null, 10],
  ['نتفليكس 120 شهري', 'نتفليكس', 120, null],
  ['قسط العربية 2500 يوم 5 من كل شهر', 'قسط العربية', 2500, 5],
  ['اشتراك الجيم بأربعمية كل شهر يوم 15', 'اشتراك الجيم', 400, 15],
  ['فاتورة المياه آخر كل شهر', 'فاتورة المياه', null, 31],
];

let pass = 0, fail = 0;
for (const [text, name, amount, day] of bills) {
  const r = M.parse(text, { categories: cats, today });
  const it = r.items[0] || {};
  const ok = r.isBill && r.items.length === 1 && it.name === name && it.amount === amount && it.bill && it.bill.day === day;
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  bill: ' + text + '\n      ' + JSON.stringify([it.name, it.amount, it.bill && it.bill.day, r.isBill]));
}
// «يوم 5» من غير «كل شهر» لسه تاريخ مش فاتورة
{
  const r = M.parse('يوم 25 بنزين 300', { categories: cats, today });
  const ok = !r.isBill && r.date === '2026-10-25';
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  not a bill: يوم 25 بنزين 300');
}

for (const [text, expect, expDate] of cases) {
  const r = M.parse(text, { categories: cats, today });
  const got = r.items.map(i => [i.name, i.amount, i.cat]);
  const ok = JSON.stringify(got) === JSON.stringify(expect) && (!expDate || r.date === expDate);
  if (ok) pass++; else fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + text + '\n      ' + JSON.stringify(got) + ' ' + r.date + (ok ? '' : '\n   want ' + JSON.stringify(expect) + ' ' + (expDate || '')));
}

// التعلّم
const c2 = M.defaultCategories();
const w = M.learnTarget('سهرة مع صحابي', c2);
M.learn(c2, w, 'fun-outing');
const r2 = M.parse('سهرة امبارح 200', { categories: c2, today });
const ok2 = w === 'سهرة' && r2.items[0].cat === 'fun-outing';
console.log((ok2 ? 'ok  ' : 'FAIL') + '  learn: ' + w + ' -> ' + r2.items[0].cat);
ok2 ? pass++ : fail++;

const w3 = M.learnTarget('كريم مرطب', c2);
M.learn(c2, w3, 'pers-care');
const r3 = M.parse('كريم مرطب 90', { categories: c2, today });
const r4 = M.parse('كريم للشغل 70', { categories: c2, today });
const ok3 = w3 === 'كريم مرطب' && r3.items[0].cat === 'pers-care' && r4.items[0].cat === 'tr-taxi';
console.log((ok3 ? 'ok  ' : 'FAIL') + '  learn phrase: ' + w3 + ' -> ' + r3.items[0].cat + ', كريم للشغل -> ' + r4.items[0].cat);
ok3 ? pass++ : fail++;

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
