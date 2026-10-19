"""Xuất TransitDB (xlsx, chỉ đọc) thành JSON gọn cho app Tiktak Bus.

Đọc theo VỊ TRÍ cột (header trong DB đang lệch so với dữ liệu):
  ROUTES      : route_id, route_code, route_name, operator, first, last, frequency, cost, operation_time, ...
  STOPS       : stop_id, stop_code, stop_name, lat, lng, street, source, imported_at
  ROUTE_STOPS : record_key, route_id, direction, stop_sequence, stop_id, stop_name, lat, lng, fleet_over
"""
import json, sys, collections, openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True)

def rows(name):
    return list(wb[name].iter_rows(values_only=True))[1:]

def parse_hours(s):
    # "0|T2 - T6|05:00,21:05;...###1|T2 - T6|05:00,21:00;..." -> {"GO": "05:00-21:05", "RETURN": ...} (T2-T6)
    # -> {"GO": {"wd": "05:00-21:05", "sa": ..., "su": ...}, "RETURN": {...}}
    res = {}
    if not s:
        return res
    daymap = {'T2-T6': 'wd', 'T7': 'sa', 'CN': 'su'}
    for block in str(s).split('###'):
        for part in block.split(';'):
            p = part.split('|')
            if len(p) != 3:
                continue
            day = daymap.get(p[1].replace(' ', ''))
            if not day:
                continue
            d = 'GO' if p[0].strip() == '0' else 'RETURN'
            a, b = (p[2].split(',') + [''])[:2]
            if a and b:
                res.setdefault(d, {})[day] = f"{a.strip()}-{b.strip()}"
    return res

routes = {}
for r in rows('ROUTES'):
    if not r[0]:
        continue
    routes[str(r[0])] = {
        'c': str(r[1]), 'n': r[2] or '', 'f': r[4] or '', 'l': r[5] or '',
        'q': (r[6] or '').replace('  ', ' ').strip(), 'p': r[7] or '',
        'h': parse_hours(r[8]),
    }

stops = {}
for r in rows('STOPS'):
    if r[0] is None or not isinstance(r[3], (int, float)) or not isinstance(r[4], (int, float)):
        continue
    stops[str(r[0])] = [r[2] or '', round(r[3], 6), round(r[4], 6)]

seq = collections.defaultdict(list)
missing_stop = 0
for r in rows('ROUTE_STOPS'):
    rid, d, n, sid = str(r[1]), r[2], r[3], str(r[4])
    if rid not in routes or d not in ('GO', 'RETURN'):
        continue
    if sid not in stops:
        if isinstance(r[6], (int, float)) and isinstance(r[7], (int, float)):
            stops[sid] = [r[5] or '', round(r[6], 6), round(r[7], 6)]
        else:
            missing_stop += 1
            continue
    seq[(rid, d)].append((float(n), sid))

patterns = []
for (rid, d), lst in sorted(seq.items()):
    lst.sort()
    ids = [s for _, s in lst]
    if len(ids) >= 2:
        patterns.append([rid, d, ids])

data = {'v': 1, 'source': 'TransitDB 1fX6Onc (TIMBUS)', 'routes': routes, 'stops': stops, 'patterns': patterns}
with open(out, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))

print(f"routes={len(routes)} stops={len(stops)} patterns={len(patterns)} "
      f"route_stops={sum(len(p[2]) for p in patterns)} missing_stop={missing_stop}")
no_pat = [routes[r]['c'] for r in routes if not any(p[0] == r for p in patterns)]
print('routes without pattern:', no_pat)
