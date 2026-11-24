/**
 * รับข้อมูลรถหายจากฟอร์มบนเว็บ แล้วเพิ่มเป็นแถวใหม่ในแท็บ "รถจักรยานยนต์หาย"
 * วิธีติดตั้ง: เปิดชีทข้อมูลท้องถิ่น > ส่วนขยาย > Apps Script > วางโค้ดนี้แทนของเดิม > บันทึก
 *            > ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > ประเภท "เว็บแอป"
 *            > เรียกใช้ในฐานะ "ฉัน" > ผู้ที่มีสิทธิ์เข้าถึง "ทุกคน" > ทำให้ใช้งานได้
 *            > คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) ส่งให้ผู้ดูแลเว็บ
 */
var SHEET_ID = '1961H33DBY2Q1iLwByXm0ZB70-s-3jYyZWHzFeELZ4Wg';   // ชีทข้อมูลท้องถิ่น
var SHEET_NAME = 'รถจักรยานยนต์หาย';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sh) return out({ ok: false, error: 'ไม่พบแท็บ ' + SHEET_NAME });
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    // หัวข้อที่ฟอร์มส่งมาแต่ยังไม่มีในชีท (เช่น หัวข้อเจ้าของรถ/ผู้ครอบครอง) -> เพิ่มคอลัมน์ท้ายตารางให้อัตโนมัติ
    var add = Object.keys(d).filter(function (k) { return /เจ้าของ\/ผู้ครอบครอง/.test(k) && head.indexOf(k) < 0; });
    if (add.length) { sh.getRange(1, head.length + 1, 1, add.length).setValues([add]).setFontWeight('bold'); head = head.concat(add); }
    var last = sh.getLastRow();
    var row = head.map(function (h) {
      h = h.trim();
      if (h === 'ลำดับ') return last;                       // แถวหัวตาราง = 1 จึงได้ลำดับต่อจากเดิม
      var v = d[h];
      if (v === undefined || v === null || v === '') return '';
      if (/^วันที่/.test(h)) { var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : v; }
      if (h === 'ละติจูด' || h === 'ลองจิจูด') { var n = parseFloat(v); return isFinite(n) ? n : ''; }
      return String(v).slice(0, 500);
    });
    sh.getRange(last + 1, 1, 1, row.length).setValues([row]);
    return out({ ok: true, row: last + 1 });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, ready: true }); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
