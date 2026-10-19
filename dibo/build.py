# Đóng gói TikTak Đi Bộ thành site/dibo/index.html (tạm đặt chung tên miền bus).
# Chạy: python3 dibo/build.py   |  Test: node --test dibo/engine.test.mjs dibo/stepcounter.test.mjs
import os
d = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(d, f), encoding='utf-8').read()
strip = lambda s: s.replace('export function', 'function').replace('export const', 'const')
src = rd('app.src.html').replace('/*ENGINE*/', strip(rd('engine.mjs'))).replace('/*STEPS*/', strip(rd('stepcounter.mjs')))
head = ('<!doctype html><html lang="vi"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#23704A"><style>:root{padding-top:env(safe-area-inset-top,0px);'
        'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style></head><body>')
out = os.path.join(d, '..', 'site', 'dibo', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
i = src.index('<style>')  # title, meta, font link đưa vào <head>
head = head.replace('</head><body>', src[:i] + '</head><body>')
open(out, 'w', encoding='utf-8').write(head + src[i:] + '</body></html>')
print('OK', out)
