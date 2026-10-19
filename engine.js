// Tiktak Bus – bộ tìm đường chạy trên máy người dùng.
// Đi thẳng hoặc đổi xe 1 lần. Ưu tiên cho người cao tuổi: ít đổi xe, ít đi bộ.
// Khoảng cách đi bộ là ĐƯỜNG CHIM BAY (ước tính), không phải đường phố thật.
(function (root) {
  'use strict';

  var R = 6371000;
  function dist(a, b) { // a,b: [lat,lng]
    var dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
    var la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  var CELL = 0.004; // ~440 m

  function Engine(data) {
    this.routes = data.routes;
    this.stops = data.stops;           // id -> [name, lat, lng]
    this.patterns = data.patterns;     // [routeId, dir, [stopIds]]
    this.grid = {};
    this.atStop = {};                  // stopId -> [[patternIdx, posIdx]]
    var self = this;
    Object.keys(this.stops).forEach(function (id) {
      var s = self.stops[id], k = self._cell(s[1], s[2]);
      (self.grid[k] = self.grid[k] || []).push(id);
    });
    this.patterns.forEach(function (p, pi) {
      p[2].forEach(function (sid, i) { (self.atStop[sid] = self.atStop[sid] || []).push([pi, i]); });
    });
  }

  Engine.prototype._cell = function (lat, lng) { return Math.floor(lat / CELL) + ':' + Math.floor(lng / CELL); };
  Engine.prototype.pos = function (id) { var s = this.stops[id]; return [s[1], s[2]]; };

  Engine.prototype.near = function (pt, radius) {
    var r = Math.ceil(radius / 440) + 1, cy = Math.floor(pt[0] / CELL), cx = Math.floor(pt[1] / CELL), out = [];
    for (var y = cy - r; y <= cy + r; y++) for (var x = cx - r; x <= cx + r; x++) {
      var list = this.grid[y + ':' + x]; if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var d = dist(pt, this.pos(list[i]));
        if (d <= radius) out.push([list[i], d]);
      }
    }
    return out.sort(function (a, b) { return a[1] - b[1]; });
  };

  // Điểm số: thấp hơn là tốt hơn. 4 chế độ ưu tiên.
  var MODES = {
    easy:     { walk: 1.0, transfer: 1800, xferWalk: 2.0, stop: 45 },   // Dễ đi (cân bằng)
    lesswalk: { walk: 3.0, transfer: 1200, xferWalk: 4.0, stop: 30 },   // Ít đi bộ
    lessxfer: { walk: 1.0, transfer: 6000, xferWalk: 2.0, stop: 45 },   // Ít đổi xe
    lessstop: { walk: 1.0, transfer: 1500, xferWalk: 2.0, stop: 150 }   // Ít trạm
  };
  var W = MODES.easy;

  Engine.prototype.plan = function (A, B, opts) {
    opts = opts || {};
    W = MODES[opts.mode] || MODES.easy;
    this._now = opts.now || null;
    var maxWalk = opts.maxWalk || 800, xferRadius = opts.xferRadius || 200, limit = opts.limit || 3;
    var direct = dist(A, B);
    var self = this;
    var nearA = this.near(A, maxWalk), nearB = this.near(B, maxWalk);
    if (!nearA.length) nearA = this.near(A, maxWalk * 1.6);
    if (!nearB.length) nearB = this.near(B, maxWalk * 1.6);
    var res = { walkOnly: direct, options: [], nearA: nearA.length, nearB: nearB.length };
    if (!nearA.length || !nearB.length) return res;

    // board[pi] = best boarding position on pattern pi near A
    var boardBest = {}; // pi -> {i, walk}
    nearA.forEach(function (n) {
      (self.atStop[n[0]] || []).forEach(function (pp) {
        var cur = boardBest[pp[0]];
        // keep all candidates? keep the earliest position with small walk: store list
        (boardBest[pp[0]] = cur || []).push({ i: pp[1], walk: n[1] });
      });
    });
    var alightBest = {};
    nearB.forEach(function (n) {
      (self.atStop[n[0]] || []).forEach(function (pp) {
        (alightBest[pp[0]] = alightBest[pp[0]] || []).push({ j: pp[1], walk: n[1] });
      });
    });

    var cands = [];

    // 1) Đi thẳng
    Object.keys(boardBest).forEach(function (pi) {
      var al = alightBest[pi]; if (!al) return;
      var best = null;
      boardBest[pi].forEach(function (b) {
        al.forEach(function (a) {
          if (a.j <= b.i) return;
          var stopsN = a.j - b.i, walk = b.walk + a.walk;
          var sc = walk * W.walk + stopsN * W.stop;
          if (!best || sc < best.score) best = { score: sc, legs: [{ p: +pi, i: b.i, j: a.j }], walk: walk, walkA: b.walk, walkB: a.walk, xfer: 0, stopsN: stopsN, xferWalk: 0 };
        });
      });
      if (best) cands.push(best);
    });

    // 2) Đổi xe 1 lần
    // Từ A: các trạm đi tới được trên pattern P1 (sau điểm lên)
    var fromA = {}; // stopId -> best {pi, i, k, walk, n}
    Object.keys(boardBest).forEach(function (pi) {
      var p = self.patterns[pi][2];
      var b = boardBest[pi].reduce(function (m, x) { return (!m || x.walk + x.i * 0 < m.walk) ? x : m; }, null);
      for (var k = b.i + 1; k < p.length; k++) {
        var sid = p[k], n = k - b.i, sc = b.walk * W.walk + n * W.stop;
        var cur = fromA[sid];
        if (!cur || sc < cur.sc) fromA[sid] = { pi: +pi, i: b.i, k: k, walk: b.walk, n: n, sc: sc };
      }
    });
    // Tới B: các trạm có thể lên P2 để tới B
    var toB = {}; // stopId -> list of best per pattern
    Object.keys(alightBest).forEach(function (pi) {
      var p = self.patterns[pi][2];
      var a = alightBest[pi].reduce(function (m, x) { return (!m || x.walk < m.walk) ? x : m; }, null);
      for (var m = 0; m < a.j; m++) {
        var sid = p[m], n = a.j - m, sc = a.walk * W.walk + n * W.stop;
        var cur = toB[sid];
        if (!cur || sc < cur.sc) toB[sid] = { pi: +pi, m: m, j: a.j, walk: a.walk, n: n, sc: sc };
      }
    });
    var xbest = {}; // key p1|p2 -> cand
    Object.keys(fromA).forEach(function (sid) {
      var f = fromA[sid];
      self.near(self.pos(sid), xferRadius).forEach(function (nn) {
        var t = toB[nn[0]]; if (!t || t.pi === f.pi) return;
        if (self.patterns[t.pi][0] === self.patterns[f.pi][0]) return; // cùng tuyến chiều ngược
        var sc = f.sc + t.sc + W.transfer + nn[1] * W.xferWalk;
        var key = f.pi + '|' + t.pi, cur = xbest[key];
        if (!cur || sc < cur.score) xbest[key] = {
          score: sc, legs: [{ p: f.pi, i: f.i, j: f.k }, { p: t.pi, i: t.m, j: t.j }],
          walk: f.walk + t.walk + nn[1], walkA: f.walk, walkB: t.walk, xfer: 1, xferWalk: nn[1], stopsN: f.n + t.n
        };
      });
    });
    Object.keys(xbest).forEach(function (k) { cands.push(xbest[k]); });

    // Giờ chạy: tuyến đã hết chuyến bị đẩy xuống cuối
    if (opts.now) {
      cands.forEach(function (c) {
        c.legs.forEach(function (l) {
          var st = self.service(self.patterns[l.p][0], self.patterns[l.p][1], opts.now);
          if (st.state === 'ended' || st.state === 'notyet') c.score += 100000;
        });
      });
    }
    cands.sort(function (a, b) { return a.score - b.score; });

    // Gom các tuyến cùng điểm lên/xuống: "đi xe 21A, 25 hoặc 28" — xe nào đến trước thì lên.
    var groups = {}, order = [];
    cands.forEach(function (c) {
      var key = c.legs.map(function (l) { var ids = self.patterns[l.p][2]; return ids[l.i] + '>' + ids[l.j]; }).join('|');
      var g = groups[key];
      if (!g) { g = groups[key] = { best: c, alts: [] }; order.push(key); }
      else if (c.score <= g.best.score + 300) g.alts.push(c);
    });
    var out = [], usedRoutes = {};
    for (var o = 0; o < order.length && out.length < limit; o++) {
      var g = groups[order[o]];
      var first = self.patterns[g.best.legs[0].p][0];
      // đa dạng: không đưa cùng tuyến chính ở điểm lên khác nhau
      if (usedRoutes[first] && g.best.xfer === 0) continue;
      usedRoutes[first] = 1;
      var d = self._describe(g.best, A, B);
      if (g.best.xfer === 0) {
        var codes = [d.legs[0].code];
        g.alts.forEach(function (a) { var c = self.routes[self.patterns[a.legs[0].p][0]].c; if (codes.indexOf(c) < 0) codes.push(c); });
        d.legs[0].codes = codes;
      } else {
        d.legs.forEach(function (l) { l.codes = [l.code]; });
      }
      out.push(d);
    }
    res.options = out;
    return res;
  };

  Engine.prototype._describe = function (c, A, B) {
    var self = this;
    var legs = c.legs.map(function (l) {
      var pat = self.patterns[l.p], r = self.routes[pat[0]], ids = pat[2];
      return {
        routeId: pat[0], code: r.c, name: r.n, dir: pat[1],
        toward: pat[1] === 'GO' ? r.l : r.f,
        from: ids[l.i], to: ids[l.j],
        fromName: self.stops[ids[l.i]][0], toName: self.stops[ids[l.j]][0],
        fromPos: self.pos(ids[l.i]), toPos: self.pos(ids[l.j]),
        stops: l.j - l.i, freq: r.q, price: r.p,
        service: self._now ? self.service(pat[0], pat[1], self._now) : null,
        stopIds: ids.slice(l.i, l.j + 1)
      };
    });
    return {
      legs: legs, transfers: c.xfer, walkStart: Math.round(c.walkA), walkEnd: Math.round(c.walkB),
      walkXfer: Math.round(c.xferWalk || 0), walkTotal: Math.round(c.walk), stopsTotal: c.stopsN, score: Math.round(c.score)
    };
  };

  // Tình trạng giờ chạy theo lịch trong DB (giờ xuất bến đầu/cuối tại đầu tuyến), giờ Hà Nội.
  function hnNow(d) { var u = d.getTime() + d.getTimezoneOffset() * 60000; return new Date(u + 7 * 3600000); }
  function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  Engine.prototype.service = function (routeId, dir, now) {
    var r = this.routes[routeId], hn = hnNow(now), dow = hn.getDay();
    var dk = dow === 0 ? 'su' : dow === 6 ? 'sa' : 'wd';
    var span = r && r.h && r.h[dir] && r.h[dir][dk];
    if (!span) return { state: 'unknown' };
    var se = span.split('-'), a = toMin(se[0]), b = toMin(se[1]), m = hn.getHours() * 60 + hn.getMinutes();
    var out = { first: se[0], last: se[1] };
    if (m < a) out.state = 'notyet';
    else if (m > b) out.state = 'ended';
    else if (b - m <= 45) { out.state = 'ending'; out.left = b - m; }
    else out.state = 'running';
    return out;
  };

  // Các tuyến dừng ở một trạm (và các trạm cùng tên/sát bên)
  Engine.prototype.routesAt = function (stopId, radius) {
    var self = this, seen = {}, out = [];
    var near = this.near(this.pos(stopId), radius || 60);
    near.forEach(function (n) {
      (self.atStop[n[0]] || []).forEach(function (pp) {
        var pat = self.patterns[pp[0]], key = pat[0] + pat[1];
        if (seen[key]) return; seen[key] = 1;
        var r = self.routes[pat[0]];
        if (pp[1] === pat[2].length - 1) return; // trạm cuối, không lên được
        out.push({ routeId: pat[0], code: r.c, name: r.n, dir: pat[1], toward: pat[1] === 'GO' ? r.l : r.f, freq: r.q, price: r.p, stopName: self.stops[n[0]][0] });
      });
    });
    return out.sort(function (a, b) { return a.code.localeCompare(b.code, 'vi', { numeric: true }); });
  };

  Engine.prototype.findRoute = function (q) {
    var nq = norm(q).replace(/^(tuyen|xe|so)\s+/, '').replace(/\s+/g, '');
    var self = this;
    return Object.keys(this.routes).filter(function (id) { return norm(self.routes[id].c) === nq; })
      .concat(Object.keys(this.routes).filter(function (id) { var c = norm(self.routes[id].c); return c !== nq && c.indexOf(nq) === 0; }))
      .slice(0, 6);
  };
  Engine.prototype.routeStops = function (routeId) {
    var self = this;
    return this.patterns.filter(function (p) { return p[0] === routeId; })
      .map(function (p) { return { dir: p[1], stops: p[2].map(function (id) { return { id: id, name: cleanName(self.stops[id][0]) }; }) }; });
  };

  // "từ Bạch Mai về Mỹ Đình" -> {from, to}
  Engine.parseTrip = function (text) {
    var t = String(text || '').trim();
    var m = t.match(/^(?:đi\s+)?(?:từ|tu)\s+(.+?)\s+(?:đến|den|về|ve|tới|toi|sang|qua|ra|lên|len|xuống|xuong)\s+(.+)$/i);
    if (m) return { from: m[1].trim(), to: m[2].trim() };
    m = t.match(/^(?:đi\s+|di\s+)?(?:đến|den|về|ve|tới|toi|ra)\s+(.+)$/i);
    if (m) return { to: m[1].trim() };
    return null;
  };

  // Tìm trạm/điểm theo tên (không dấu)
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  Engine.prototype.search = function (q, limit) {
    var nq = norm(q); if (nq.length < 2) return [];
    var words = nq.split(' '), self = this, seen = {}, hits = [];
    Object.keys(this.stops).forEach(function (id) {
      var nm = self.stops[id][0], key = norm(cleanName(nm));
      if (seen[key]) return;
      var kw = ' ' + key + ' ';
      // các từ trước phải khớp trọn âm tiết; từ cuối (đang gõ dở) chỉ cần khớp đầu
      var ok = words.every(function (w, wi) { return kw.indexOf(' ' + w + (wi < words.length - 1 ? ' ' : '')) >= 0; });
      if (ok) {
        seen[key] = 1;
        var phrase = kw.indexOf(' ' + nq) >= 0 ? 0 : 50; // khớp nguyên cụm được ưu tiên
        hits.push({ id: id, name: cleanName(nm), pos: self.pos(id), rank: phrase + kw.indexOf(' ' + words[0]) + key.length / 100 });
      }
    });
    hits.sort(function (a, b) { return a.rank - b.rank; });
    var alias = ALIASES[nq];
    if (alias) {
      var extra = this.search(alias, 1).filter(function (h) { return !hits.some(function (x) { return x.id === h.id; }); });
      hits = extra.concat(hits);
    }
    return hits.slice(0, limit || 8);
  };
  // Địa danh phổ biến mà tên trạm gọi khác (chỉ trỏ tới tên trạm có thật trong dữ liệu)
  var ALIASES = { 'ho guom': 'bo ho', 'ho hoan kiem': 'bo ho', 'pho co': 'bo ho' };

  function cleanName(n) {
    return String(n || '').replace(/^\([A-Z]\)\s*/, '').replace(/\s*-\s*Tuyến\s+[\w\s-]+$/i, '')
      .replace(/\bBX\b/g, 'Bến xe').replace(/\bĐH\b/g, 'Đại học').replace(/\bKĐT\b/g, 'Khu đô thị')
      .replace(/\s+/g, ' ').trim();
  }

  Engine.dist = dist; Engine.norm = norm; Engine.cleanName = cleanName;
  root.TiktakEngine = Engine;
  if (typeof module !== 'undefined') module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
