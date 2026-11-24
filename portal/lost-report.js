/* รายงานสรุปรถจักรยานยนต์หาย ขนาด A4 (พิมพ์ / บันทึก PDF)
 * ใช้ข้อมูลตามตัวกรองปัจจุบันของหน้า "ข้อมูลรถหาย" ผ่าน window.__ltReport.get()
 * ประกอบด้วย: สรุปตัวเลข, แผนที่จุดเกิดเหตุ (ภาพนิ่งจาก OpenStreetMap + เขตตรวจ), นาฬิกาอาชญากรรม 24 ชม.,
 *            สถิติแยกเขต/วัน/สถานที่/การจอด, ข้อสังเกต, ตารางรายการ และช่องลงนาม */
(function(){
  var MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var MONF = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  var HRS = ['00.00–03.59','04.00–07.59','08.00–11.59','12.00–15.59','16.00–19.59','20.00–23.59'];
  var RED = '#c62a32', GREEN = '#15803d', NAVY = '#0f2c5c', GOLD = '#b8860b';
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function $(id){ return document.getElementById(id); }
  function mk(tag, cls, html){ var e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
  function fd(d){ return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + String((d.getFullYear() + 543) % 100) : '-'; }
  function fdf(d){ return d.getDate() + ' ' + MONF[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
  function p2(n){ return ('0' + n).slice(-2); }
  function count(list, key, order){
    var m = {}; list.forEach(function(x){ var k = key(x); if(k) m[k] = (m[k] || 0) + 1; });
    var keys = order ? order.slice() : Object.keys(m).sort(function(a, b){ return m[b] - m[a]; });
    return keys.map(function(k){ return { label: k, n: m[k] || 0 }; });
  }
  function top(c){ var t = c.slice().sort(function(a, b){ return b.n - a.n; })[0]; return t && t.n ? t : null; }

  // ---------- แผนที่ภาพนิ่ง ----------
  var geoP = null;
  function zones(g){ return g ? Promise.resolve(g) : (geoP = geoP || fetch('zones.geojson').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })); }
  function wx(lng, z){ return (lng + 180) / 360 * 256 * Math.pow(2, z); }
  function wy(lat, z){ var s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); }
  function tile(z, x, y){
    return new Promise(function(ok){
      var im = new Image(), t = setTimeout(function(){ ok(null); }, 8000);
      im.crossOrigin = 'anonymous';
      im.onload = function(){ clearTimeout(t); ok(im); }; im.onerror = function(){ clearTimeout(t); ok(null); };
      im.src = 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
    });
  }
  function staticMap(pts, geo, W, H){
    var lo = [], la = [];
    pts.forEach(function(p){ lo.push(p.lng); la.push(p.lat); });
    // มีหมุด: ซูมไปที่บริเวณจุดเกิดเหตุ (กว้างอย่างน้อย ~4 กม.) / ไม่มีหมุด: แสดงทุกเขตตรวจ
    if(lo.length){ var mx = (Math.min.apply(null, lo) + Math.max.apply(null, lo)) / 2, my = (Math.min.apply(null, la) + Math.max.apply(null, la)) / 2; lo.push(mx - .02, mx + .02); la.push(my - .015, my + .015); }
    else if(geo) geo.features.forEach(function(f){ f.geometry.coordinates[0].forEach(function(c){ lo.push(c[0]); la.push(c[1]); }); });
    if(!lo.length){ lo = [100.75, 100.85]; la = [13.55, 13.65]; }
    var w0 = Math.min.apply(null, lo), e0 = Math.max.apply(null, lo), s0 = Math.min.apply(null, la), n0 = Math.max.apply(null, la);
    if(e0 - w0 < .01){ w0 -= .005; e0 += .005; } if(n0 - s0 < .01){ s0 -= .005; n0 += .005; }
    var pad = 46, zx = Math.log2((W - 2 * pad) / (wx(e0, 0) - wx(w0, 0))), zy = Math.log2((H - 2 * pad) / (wy(s0, 0) - wy(n0, 0)));
    var z = Math.min(zx, zy, 17), tz = Math.max(0, Math.min(17, Math.floor(z))), k = Math.pow(2, z - tz);
    var cx = (wx(w0, z) + wx(e0, z)) / 2, cy = (wy(n0, z) + wy(s0, z)) / 2, ox = cx - W / 2, oy = cy - H / 2;
    function P(lng, lat){ return [wx(lng, z) - ox, wy(lat, z) - oy]; }
    var tsz = 256 * k, x0 = Math.floor(ox / tsz), x1 = Math.floor((ox + W) / tsz), y0 = Math.floor(oy / tsz), y1 = Math.floor((oy + H) / tsz), jobs = [];
    for(var tx = x0; tx <= x1; tx++) for(var ty = y0; ty <= y1; ty++) jobs.push({ x: tx, y: ty });
    return Promise.all(jobs.map(function(j){ return tile(tz, j.x, j.y).then(function(im){ j.im = im; return j; }); })).then(function(js){
      function paint(withTiles){
        var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
        g.fillStyle = '#eef1f5'; g.fillRect(0, 0, W, H);
        if(withTiles){ js.forEach(function(j){ if(j.im) g.drawImage(j.im, j.x * tsz - ox, j.y * tsz - oy, tsz + .5, tsz + .5); }); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, W, H); }
        if(geo) geo.features.forEach(function(f){
          var ring = f.geometry.coordinates[0], col = f.properties.color || '#1d4ed8';
          g.beginPath(); ring.forEach(function(p, i){ var q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
          g.globalAlpha = .13; g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.lineWidth = 4; g.strokeStyle = col; g.stroke();
        });
        if(geo) geo.features.forEach(function(f){   // ป้ายชื่อเขต
          var ring = f.geometry.coordinates[0], sx = 0, sy = 0; ring.forEach(function(p){ var q = P(p[0], p[1]); sx += q[0]; sy += q[1]; });
          var q = [sx / ring.length, sy / ring.length], t = f.properties.name, col = f.properties.color || '#1d4ed8';
          g.font = '600 24px Sarabun, Tahoma, sans-serif'; var tw = g.measureText(t).width;
          g.fillStyle = 'rgba(255,255,255,.88)'; g.strokeStyle = col; g.lineWidth = 2;
          g.beginPath(); if(g.roundRect) g.roundRect(q[0] - tw / 2 - 10, q[1] - 17, tw + 20, 34, 8); else g.rect(q[0] - tw / 2 - 10, q[1] - 17, tw + 20, 34); g.fill(); g.stroke();
          g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, q[0], q[1] + 1);
        });
        pts.slice().reverse().forEach(function(p){   // หมุดหมายเลข (เลขน้อยอยู่บนสุด)
          var q = P(p.lng, p.lat), r = 19;
          g.beginPath(); g.arc(q[0], q[1], r + 3, 0, 7); g.fillStyle = '#fff'; g.fill();
          g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fillStyle = p.back ? GREEN : RED; g.fill();
          g.fillStyle = '#fff'; g.font = '700 22px Sarabun, Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(p.no), q[0], q[1] + 1);
        });
        // เข็มทิศ + ที่มา
        g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(W - 62, 14, 46, 60); g.fillStyle = NAVY; g.beginPath(); g.moveTo(W - 39, 22); g.lineTo(W - 50, 52); g.lineTo(W - 39, 45); g.lineTo(W - 28, 52); g.closePath(); g.fill();
        g.font = '700 18px Sarabun, Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('N', W - 39, 70);
        if(withTiles){ g.font = '16px Sarabun, Tahoma, sans-serif'; g.textAlign = 'right'; var at = '© OpenStreetMap contributors'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(W - g.measureText(at).width - 18, H - 28, g.measureText(at).width + 18, 28); g.fillStyle = '#333'; g.fillText(at, W - 9, H - 9); }
        return c.toDataURL('image/jpeg', .9);
      }
      try{ return paint(true); }catch(e){ return paint(false); }
    });
  }

  // ---------- นาฬิกาอาชญากรรม 24 ชั่วโมง ----------
  function clock(L){
    var h = []; for(var i = 0; i < 24; i++) h.push(0);
    L.forEach(function(x){ if(x.hour != null && x.hour >= 0 && x.hour < 24) h[x.hour]++; });
    var mx = Math.max.apply(null, h), C = 150, R1 = 112, R0 = 50, s = '';
    function pt(r, a){ return [C + r * Math.sin(a), C - r * Math.cos(a)]; }
    function col(n){ if(!n) return '#eef1f6'; var t = mx > 1 ? (n - 1) / (mx - 1) : 1; var a = [253, 205, 205], b = [176, 30, 40]; return 'rgb(' + a.map(function(v, i){ return Math.round(v + (b[i] - v) * t); }).join(',') + ')'; }
    // วงนอก: กลางวัน/กลางคืน
    for(i = 0; i < 24; i++){
      var a0 = i * Math.PI / 12, a1 = (i + 1) * Math.PI / 12, q0 = pt(R1 + 4, a0), q1 = pt(R1 + 4, a1), q2 = pt(R1 + 11, a1), q3 = pt(R1 + 11, a0);
      s += '<path d="M' + q0 + 'A' + (R1 + 4) + ',' + (R1 + 4) + ' 0 0 1 ' + q1 + 'L' + q2 + 'A' + (R1 + 11) + ',' + (R1 + 11) + ' 0 0 0 ' + q3 + 'Z" fill="' + (i >= 6 && i < 18 ? '#f2c94c' : '#1e3a6e') + '"/>';
    }
    for(i = 0; i < 24; i++){
      a0 = i * Math.PI / 12 + .012; a1 = (i + 1) * Math.PI / 12 - .012;
      var o0 = pt(R1, a0), o1 = pt(R1, a1), n1 = pt(R0, a1), n0 = pt(R0, a0);
      s += '<path d="M' + o0 + 'A' + R1 + ',' + R1 + ' 0 0 1 ' + o1 + 'L' + n1 + 'A' + R0 + ',' + R0 + ' 0 0 0 ' + n0 + 'Z" fill="' + col(h[i]) + '" stroke="#fff" stroke-width="1"/>';
      if(h[i]){ var m = pt((R0 + R1) / 2 + 10, (i + .5) * Math.PI / 12); s += '<text x="' + m[0] + '" y="' + (m[1] + 5) + '" text-anchor="middle" font-size="14" font-weight="700" fill="' + (h[i] / mx > .5 ? '#fff' : '#7a1218') + '">' + h[i] + '</text>'; }
      var l = pt(R1 + 24, i * Math.PI / 12); s += '<text x="' + l[0] + '" y="' + (l[1] + 4) + '" text-anchor="middle" font-size="' + (i % 6 ? 10 : 13) + '" font-weight="' + (i % 6 ? 400 : 700) + '" fill="' + (i % 6 ? '#6b7280' : NAVY) + '">' + p2(i) + '</text>';
    }
    var tot = h.reduce(function(a, b){ return a + b; }, 0), pk = h.indexOf(mx);
    s += '<circle cx="' + C + '" cy="' + C + '" r="' + (R0 - 4) + '" fill="#fff" stroke="#d6dbe4"/>' +
      '<text x="' + C + '" y="' + (C - 6) + '" text-anchor="middle" font-size="26" font-weight="700" fill="' + NAVY + '">' + tot + '</text>' +
      '<text x="' + C + '" y="' + (C + 14) + '" text-anchor="middle" font-size="11" fill="#555">ครั้ง (ระบุเวลา)</text>';
    return { svg: '<svg viewBox="0 0 300 300" width="100%" style="display:block;margin:0 auto;font-family:Sarabun,Tahoma,sans-serif">' + s + '</svg>', h: h, mx: mx, pk: mx ? pk : -1, tot: tot };
  }

  function bars(list, color){
    list = list.filter(function(x){ return x.n; });
    if(!list.length) return '<div class="none">ไม่มีข้อมูล</div>';
    var mx = Math.max.apply(null, list.map(function(x){ return x.n; }));
    return list.map(function(x){ return '<div class="hb"><span class="l">' + esc(x.label) + '</span><span class="t"><i style="width:' + (x.n * 100 / mx) + '%;background:' + ((typeof color === 'function' ? color(x.label) : color) || NAVY) + '"></i></span><span class="n">' + x.n + '</span></div>'; }).join('');
  }

  // ---------- ประกอบรายงาน ----------
  function build(D){
    var L = D.L.slice().sort(function(a, b){ return (a.d ? +a.d : 0) - (b.d ? +b.d : 0); });
    L.forEach(function(x, i){ x.no = i + 1; });
    var now = new Date(), back = L.filter(function(x){ return x.back; }).length, arr = L.filter(function(x){ return x.arrest; }).length;
    var ds = L.filter(function(x){ return x.d; }).map(function(x){ return x.d; });
    var range = ds.length ? (fdf(ds[0]) + (+ds[ds.length - 1] !== +ds[0] ? ' – ' + fdf(ds[ds.length - 1]) : '')) : '-';
    var cond = ['ช่วงเวลา: ' + D.period, D.zone ? 'เขตตรวจ: ' + D.zone : 'ทุกเขตตรวจ', D.stat ? 'สถานะ: ' + D.stat : '', D.q ? 'คำค้น: "' + D.q + '"' : ''].filter(Boolean).join(' · ');
    var zc = count(L, function(x){ return x.zone; }), dc = count(L.filter(function(x){ return x.d; }), function(x){ return DOW[x.d.getDay()]; }, DOW);
    var pc = count(L, function(x){ return x.ptype; }), kc = count(L, function(x){ return x.lock; }), bc = count(L, function(x){ return x.brand; });
    var hc = count(L.filter(function(x){ return x.hour != null; }), function(x){ return HRS[Math.floor(x.hour / 4)]; }, HRS);
    var ck = clock(L), noTime = L.filter(function(x){ return x.hour == null; }).length, noPt = L.filter(function(x){ return x.lat == null; }).length;
    var logo = (document.querySelector('img.emblem') || {}).src || '';

    // ข้อสังเกต (สร้างจากข้อมูลอัตโนมัติ)
    var obs = [], t;
    if((t = top(hc))) obs.push('ช่วงเวลาที่เกิดเหตุมากที่สุด <b>' + t.label + ' น.</b> (' + t.n + ' ครั้ง)' + (ck.pk >= 0 ? ' โดยชั่วโมงที่เกิดบ่อยที่สุดคือ <b>' + p2(ck.pk) + '.00–' + p2(ck.pk) + '.59 น.</b>' : '') + ' ควรเพิ่มการตรวจตราในช่วงเวลาดังกล่าว');
    if((t = top(dc))) obs.push('วันที่เกิดเหตุมากที่สุดคือ <b>วัน' + t.label + '</b> (' + t.n + ' ครั้ง)');
    if((t = top(zc))) obs.push('เขตตรวจที่เกิดเหตุมากที่สุดคือ <b>' + esc(t.label) + '</b> (' + t.n + ' ครั้ง จาก ' + L.length + ' ครั้ง)');
    if((t = top(pc))) obs.push('สถานที่ที่เกิดเหตุบ่อยคือ <b>' + esc(t.label) + '</b> (' + t.n + ' ครั้ง)');
    var risky = L.filter(function(x){ return /เสียบ|ไม่ได้ล็อก/.test(x.lock || ''); }).length;
    if(risky) obs.push('มีรถที่จอดโดย<b>เสียบกุญแจทิ้งไว้หรือไม่ได้ล็อก ' + risky + ' คัน</b> ควรประชาสัมพันธ์ให้ประชาชนล็อกคอ/ล็อกล้อทุกครั้ง');
    if((t = top(bc))) obs.push('ยี่ห้อรถที่ถูกลักมากที่สุดคือ <b>' + esc(t.label) + '</b> (' + t.n + ' คัน)');
    obs.push('ติดตามได้คืนแล้ว ' + back + ' คัน (' + (L.length ? (back * 100 / L.length).toFixed(1) : '0') + '%) · จับกุมผู้ต้องหาได้ ' + arr + ' ราย');
    if(noTime || noPt) obs.push('<span class="mut">หมายเหตุ: ' + [noTime ? 'ไม่ระบุเวลาเกิดเหตุ ' + noTime + ' รายการ' : '', noPt ? 'ไม่มีพิกัด ' + noPt + ' รายการ (ไม่แสดงบนแผนที่)' : ''].filter(Boolean).join(' · ') + '</span>');

    var head = '<div class="hd"><img src="' + logo + '" alt=""><div><div class="u">ป้องกันปราบปราม สถานีตำรวจภูธรบางเสาธง</div><div class="u2">ตำรวจภูธรจังหวัดสมุทรปราการ · ตำรวจภูธรภาค 1</div></div><div class="dt">พิมพ์เมื่อ ' + fdf(now) + '<br>เวลา ' + p2(now.getHours()) + '.' + p2(now.getMinutes()) + ' น.</div></div>';
    var rowsH = L.map(function(x){
      return '<tr><td class="c">' + x.no + '</td><td>' + fd(x.d) + (x.timeTxt ? ' <small>' + esc(x.timeTxt) + ' น.</small>' : '') + '</td>' +
        '<td>' + esc([x.brand, x.model].filter(Boolean).join(' ') || '-') + (x.color ? ' <small>สี' + esc(x.color) + '</small>' : '') + '</td>' +
        '<td>' + esc(x.plate || '-') + (x.prov ? ' <small>' + esc(x.prov) + '</small>' : '') + '</td>' +
        '<td>' + esc(x.place || '-') + (x.ptype || x.tam ? ' <small>' + esc([x.ptype, x.moo && 'ม.' + x.moo, x.tam && 'ต.' + x.tam].filter(Boolean).join(' · ')) + '</small>' : '') + '</td>' +
        '<td class="c">' + esc(x.zone || '-') + '</td>' +
        '<td class="c"><b style="color:' + (x.back ? GREEN : RED) + '">' + (x.back ? 'ได้คืนแล้ว' : 'ยังไม่ได้คืน') + '</b>' + (x.arrest ? ' <small>จับกุมได้</small>' : '') + (x.cno ? ' <small>คดี ' + esc(x.cno) + '</small>' : '') + '</td></tr>';
    }).join('');
    var page = '<section class="ltr-page one">' + head +
      '<h1>รายงานสรุปสถิติรถจักรยานยนต์หาย</h1>' +
      '<div class="sub">ข้อมูลระหว่างวันที่ ' + range + ' <small>(' + esc(cond) + ')</small></div>' +
      '<div class="kpi"><div><span>แจ้งรถหาย</span><b>' + L.length + '</b><small>คัน</small></div>' +
        '<div class="r"><span>ยังไม่ได้คืน</span><b>' + (L.length - back) + '</b><small>คัน</small></div>' +
        '<div class="g"><span>ได้คืนแล้ว</span><b>' + back + '</b><small>คัน · ' + (L.length ? (back * 100 / L.length).toFixed(0) : 0) + '%</small></div>' +
        '<div><span>จับกุมผู้ต้องหา</span><b>' + arr + '</b><small>ราย</small></div>' +
        '<div class="w"><span>เขต / ช่วงเวลาเสี่ยง</span><b class="s">' + esc((top(zc) || {}).label || '-') + '</b><small>' + ((top(hc) || {}).label ? top(hc).label + ' น.' : '-') + '</small></div></div>' +
      '<h2>1. แผนที่จุดเกิดเหตุ</h2><div class="map"><div class="mapwait">กำลังสร้างแผนที่…</div></div>' +
        '<div class="leg"><span><i style="background:' + RED + '"></i>ยังไม่ได้คืน</span><span><i style="background:' + GREEN + '"></i>ได้คืนแล้ว</span><span>เลขในหมุด = ลำดับในตาราง</span></div>' +
      '<h2>2. สถิติที่สำคัญ</h2><div class="three">' +
        '<div><h3>ช่วงเวลาที่เกิดเหตุ (น.)</h3>' + bars(hc, '#d97706') + '<h3>วันในสัปดาห์</h3>' + bars(dc, '#2563eb') + '</div>' +
        '<div><h3>แยกตามเขตตรวจ</h3>' + bars(zc, function(l){ return D.zcol && D.zcol(l) || NAVY; }) + '<h3>ประเภทสถานที่</h3>' + bars(pc, '#7c3aed') + '</div>' +
        '<div><h3>ลักษณะการจอด</h3>' + bars(kc, function(l){ return /เสียบ|ไม่ได้ล็อก/.test(l) ? RED : '#64748b'; }) + '<h3>ยี่ห้อรถ</h3>' + bars(bc.slice(0, 5), '#0f766e') + '</div></div>' +
      '<h2>3. ข้อสังเกตและข้อเสนอแนะ</h2><ul class="obs">' + obs.map(function(o){ return '<li>' + o + '</li>'; }).join('') + '</ul>' +
      '<h2>4. รายการรถจักรยานยนต์หาย (' + L.length + ' รายการ)</h2>' +
      (L.length ? '<table><thead><tr><th>ที่</th><th>วันที่ / เวลา</th><th>รถ</th><th>ทะเบียน</th><th>สถานที่เกิดเหตุ</th><th>เขตตรวจ</th><th>สถานะ</th></tr></thead><tbody>' + rowsH + '</tbody></table>' : '<div class="none">ไม่มีรายการตามตัวกรอง</div>') +
      '<div class="sign"><div>ลงชื่อ ........................................ ผู้รายงาน<br>(........................................)</div>' +
      '<div>ลงชื่อ ........................................ ผู้ตรวจ<br>(........................................)</div></div>' +
      '</section>';
    return { html: page, L: L, name: 'รายงานรถหาย_' + (now.getFullYear() + 543) + p2(now.getMonth() + 1) + p2(now.getDate()) };
  }

  var CSS = [
    '#ltRep{position:fixed; inset:0; z-index:3000; background:rgba(4,10,24,.94); overflow:auto; -webkit-overflow-scrolling:touch}',
    '#ltRep .bar{position:sticky; top:0; z-index:2; display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:10px 14px; background:#0a1630; border-bottom:1px solid rgba(212,175,55,.35)}',
    '#ltRep .bar b{font-family:Kanit,sans-serif; font-weight:500; color:#f3d98b; flex:1; min-width:140px}',
    '#ltRep .bar button{height:36px; border-radius:10px; border:1px solid #d4af37; background:transparent; color:#f3d98b; padding:0 14px; font:500 .9rem Kanit,sans-serif; cursor:pointer}',
    '#ltRep .bar button.on{background:#d4af37; color:#0a1630}',
    '#ltRep .bar .msg{flex-basis:100%; color:#fca5a5; font-size:.85rem}',
    '#ltRep .pages{padding:16px 0 40px}',
    // ทั้งหมดอยู่ในแผ่นเดียว: ขนาดทุกอย่างเป็น em แล้วย่อ font-size ของหน้าจนพอดี (ดู fit())
    '.ltr-page{width:210mm; height:296mm; margin:0 auto 16px; background:#fff; color:#111; padding:9mm 11mm 8mm; box-sizing:border-box; position:relative; overflow:hidden; font-family:Sarabun,Tahoma,sans-serif; font-size:10pt; line-height:1.3; box-shadow:0 6px 28px rgba(0,0,0,.45); -webkit-print-color-adjust:exact; print-color-adjust:exact}',
    '.ltr-page .hd{display:flex; align-items:center; gap:.9em; border-bottom:.18em solid ' + NAVY + '; padding-bottom:.5em; margin-bottom:.6em}',
    '.ltr-page .hd img{width:4.2em; height:auto}',
    '.ltr-page .hd .u{font:600 1.2em Kanit,Sarabun,sans-serif; color:' + NAVY + '}',
    '.ltr-page .hd .u2{font-size:.85em; color:#555}',
    '.ltr-page .hd .dt{margin-left:auto; text-align:right; font-size:.8em; color:#555}',
    '.ltr-page h1{font:600 1.6em/1.2 Kanit,Sarabun,sans-serif; color:' + NAVY + '; text-align:center; margin:0}',
    '.ltr-page .sub{text-align:center; margin:.15em 0 .6em} .ltr-page .sub small{color:#555; font-size:.85em}',
    '.ltr-page h2{font:600 1.08em/1.25 Kanit,Sarabun,sans-serif; color:' + NAVY + '; margin:.65em 0 .35em; padding-left:.5em; border-left:.35em solid ' + GOLD + '}',
    '.ltr-page h3{font-weight:600; font-size:.9em; color:#333; margin:.4em 0 .15em}',
    '.ltr-page .kpi{display:grid; grid-template-columns:repeat(4,1fr) 1.4fr; gap:.6em}',
    '.ltr-page .kpi>div{border:1px solid #cfd6e2; border-top:.35em solid ' + NAVY + '; border-radius:.4em; padding:.3em .6em; text-align:center; background:#f7f9fc}',
    '.ltr-page .kpi .r{border-top-color:' + RED + '} .ltr-page .kpi .g{border-top-color:' + GREEN + '} .ltr-page .kpi .w{border-top-color:' + GOLD + '}',
    '.ltr-page .kpi span{display:block; font-size:.82em; color:#444}',
    '.ltr-page .kpi b{display:block; font:600 1.7em/1.1 Kanit,Sarabun,sans-serif; color:' + NAVY + '} .ltr-page .kpi .r b{color:' + RED + '} .ltr-page .kpi .g b{color:' + GREEN + '}',
    '.ltr-page .kpi b.s{font-size:1.15em; line-height:1.6} .ltr-page .kpi small{font-size:.8em; color:#555}',
    '.ltr-page .mc{display:grid; grid-template-columns:1fr 17.5em; gap:1.2em; align-items:start}',
    '.ltr-page .map{height:25em; border:1px solid #b9c2d0; border-radius:.4em; overflow:hidden; background:#eef1f5; display:flex; align-items:center; justify-content:center}',
    '.ltr-page .map img{width:100%; height:100%; object-fit:contain; display:block}',
    '.ltr-page .mc svg{width:17.5em !important; max-width:none !important}',
    '.ltr-page .mapwait{color:#777}',
    '.ltr-page .leg{display:flex; gap:1em; flex-wrap:wrap; font-size:.8em; color:#444; margin-top:.25em} .ltr-page .leg.c{justify-content:center}',
    '.ltr-page .leg i{display:inline-block; width:.9em; height:.9em; border-radius:50%; margin-right:.3em; vertical-align:-.1em}',
    '.ltr-page .three{display:grid; grid-template-columns:repeat(3,1fr); gap:1.4em}',
    '.ltr-page .three h3:first-child{margin-top:0}',
    '.ltr-page .hb{display:grid; grid-template-columns:7.5em 1fr 1.8em; gap:.5em; align-items:center; font-size:.85em; margin:.12em 0}',
    '.ltr-page .hb .l{white-space:nowrap; overflow:hidden; text-overflow:ellipsis} .ltr-page .hb .t{height:.85em; background:#eef1f6; border-radius:.25em; overflow:hidden} .ltr-page .hb .t i{display:block; height:100%; border-radius:.25em}',
    '.ltr-page .hb .n{text-align:right; font-weight:600}',
    '.ltr-page .none{font-size:.85em; color:#777; border:1px dashed #c5ccd8; border-radius:.3em; padding:.3em; text-align:center}',
    '.ltr-page .obs{margin:0; padding-left:1.4em; font-size:.92em; columns:2; column-gap:2em} .ltr-page .obs li{margin:.1em 0; break-inside:avoid} .ltr-page .mut{color:#666}',
    '.ltr-page table{width:100%; border-collapse:collapse; font-size:.85em; line-height:1.2}',
    '.ltr-page th,.ltr-page td{border:1px solid #8a94a6; padding:.25em .45em; vertical-align:top; text-align:left}',
    '.ltr-page th{background:#dfe6f2; text-align:center; font-weight:600; vertical-align:middle; white-space:nowrap} .ltr-page td.c{text-align:center}',
    '.ltr-page tbody tr:nth-child(even) td{background:#f5f7fb} .ltr-page td small{color:#555; font-size:.88em}',
    '.ltr-page .sign{display:grid; grid-template-columns:1fr 1fr; gap:2em; margin-top:1.6em; text-align:center; line-height:2}',
    '#ltPdfHost{position:absolute; left:0; top:0; z-index:-1; width:210mm; background:#fff}',
    '#ltPdfHost .ltr-page{margin:0; box-shadow:none}',
    '@page ltA4{size:A4 portrait; margin:0}',
    '@media print{',
    '  body.lrep{background:#fff!important; min-height:0!important}',
    '  body.lrep::before,body.lrep::after{display:none!important}',
    '  body.lrep > *:not(#ltRep){display:none!important}',
    '  body.lrep #ltRep{position:static; background:none; overflow:visible}',
    '  body.lrep #ltRep .bar{display:none}',
    '  body.lrep #ltRep .pages{padding:0; zoom:1!important}',
    '  body.lrep .ltr-page{page:ltA4; margin:0; box-shadow:none}',
    '}'
  ].join('\n');

  var cur = null, h2p = null;
  // ย่อขนาดตัวอักษรของหน้าลงทีละน้อยจนเนื้อหาทั้งหมดอยู่ในกระดาษแผ่นเดียว
  function fit(){
    var pg = document.querySelector('#ltRep .ltr-page'); if(!pg) return;
    var fs = 10.5; pg.style.fontSize = fs + 'pt';
    while(pg.scrollHeight > pg.clientHeight + 1 && fs > 4.5){ fs -= .25; pg.style.fontSize = fs + 'pt'; }
  }
  function fitZoom(){ var p = document.querySelector('#ltRep .pages'); if(!p) return; var w = window.innerWidth - 16, pw = 794; p.style.zoom = w < pw ? (w / pw).toFixed(3) : ''; }
  function close(){ var r = $('ltRep'); if(r) r.parentNode.removeChild(r); var h = $('ltPdfHost'); if(h) h.parentNode.removeChild(h); document.body.classList.remove('lrep'); window.removeEventListener('resize', fitZoom); }
  function msg(t){ var m = document.querySelector('#ltRep .msg'); if(m) m.textContent = t || ''; }
  function open(){
    var api = window.__ltReport; if(!api) return;
    var D = api.get(); if(!D){ alert('ข้อมูลยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'); return; }
    if(!$('ltRepCss')){ var st = mk('style'); st.id = 'ltRepCss'; st.textContent = CSS; document.head.appendChild(st); }
    close();
    cur = build(D);
    var r = mk('div'); r.id = 'ltRep';
    r.innerHTML = '<div class="bar"><b>รายงานสรุปรถหาย (A4)</b><button type="button" class="on" data-a="print">พิมพ์</button><button type="button" data-a="pdf">บันทึก PDF</button><button type="button" data-a="close">ปิด</button><span class="msg"></span></div><div class="pages">' + cur.html + '</div>';
    document.body.appendChild(r); document.body.classList.add('lrep');
    fitZoom(); fit(); window.addEventListener('resize', fitZoom);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    r.addEventListener('click', function(e){ var b = e.target.closest('button[data-a]'); if(!b) return; var a = b.getAttribute('data-a'); if(a === 'close') close(); if(a === 'print') doPrint(); if(a === 'pdf') doPdf(b); });
    var pts = cur.L.filter(function(x){ return x.lat != null; });
    cur.mapReady = zones(D.geo).then(function(g){ return staticMap(pts, g, 1500, 640); }).then(function(src){
      Array.prototype.forEach.call(document.querySelectorAll('#ltRep .map'), function(m){ m.innerHTML = '<img alt="แผนที่จุดเกิดเหตุ" src="' + src + '">'; }); fit();
    }, function(){ Array.prototype.forEach.call(document.querySelectorAll('#ltRep .map'), function(m){ m.innerHTML = '<div class="mapwait">สร้างแผนที่ไม่ได้ (ตรวจสอบอินเทอร์เน็ต)</div>'; }); });
  }
  function doPrint(){
    msg(''); (cur && cur.mapReady || Promise.resolve()).then(function(){
      try{ if(typeof window.print !== 'function') throw 0; window.print(); }
      catch(e){ msg('เบราว์เซอร์นี้สั่งพิมพ์ไม่ได้ ให้กด "บันทึก PDF" แล้วพิมพ์จากไฟล์'); }
    });
  }
  function doPdf(btn){
    msg(''); var old = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังสร้าง PDF…';
    function done(){ var h = $('ltPdfHost'); if(h) h.parentNode.removeChild(h); btn.disabled = false; btn.textContent = old; }
    h2p = h2p || new Promise(function(ok, no){ if(window.html2pdf) return ok(window.html2pdf); var sc = document.createElement('script'); sc.src = '../vendor/html2pdf.bundle.min.js?v=1'; sc.onload = function(){ ok(window.html2pdf); }; sc.onerror = function(){ h2p = null; no(); }; document.head.appendChild(sc); });
    Promise.all([h2p, cur.mapReady, document.fonts && document.fonts.ready]).then(function(a){
      var lib = a[0], host = mk('div'); host.id = 'ltPdfHost'; host.innerHTML = document.querySelector('#ltRep .pages').innerHTML; document.body.appendChild(host);
      return lib().set({ margin: 0, filename: cur.name + '.pdf', image: { type: 'jpeg', quality: .95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: [] } }).from(host).save();
    }).then(done, function(){ done(); msg('สร้าง PDF ไม่สำเร็จ — กด "พิมพ์" แล้วเลือกปลายทางเป็น "บันทึกเป็น PDF" แทน'); });
  }
  window.__ltReportOpen = open;
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('ltRep')) close(); });
})();
