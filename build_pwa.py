"""Đóng gói bản PWA cho bus.nomahubvn.com vào thư mục site/."""
import json, os, shutil, hashlib, datetime
DOMAIN = os.environ.get('TIKTAK_DOMAIN', 'bus.nomahubvn.com')
tpl = open('app.template.html', encoding='utf-8').read()
data = open('data/transit.json', encoding='utf-8').read().replace('</', '<\\/')
eng = open('engine.js', encoding='utf-8').read()
body = tpl.replace('{{DATA}}', data).replace('{{ENGINE}}', eng)
version = hashlib.sha1(body.encode()).hexdigest()[:10]
head = f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b5cad">
<meta name="description" content="Tìm đường xe buýt Hà Nội trên dữ liệu thật: chỉ đường, xe qua trạm, tra tuyến, cảnh báo chuyến cuối.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tiktak Bus">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
'''
tail = '''
<script>
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
</script>
</body>
</html>
'''
os.makedirs('site', exist_ok=True)
open('site/index.html', 'w', encoding='utf-8').write(head + body + tail)
open('site/sw.js', 'w', encoding='utf-8').write(open('pwa/sw.template.js', encoding='utf-8').read().replace('{{VERSION}}', version))
for f in ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']:
    shutil.copy('pwa/' + f, 'site/' + f)
open('site/CNAME', 'w').write(DOMAIN + '\n')
open('site/.nojekyll', 'w').write('')
print('site/ built, version', version, 'domain', DOMAIN, 'index bytes', os.path.getsize('site/index.html'))
