import json
tpl=open('app.template.html',encoding='utf-8').read()
data=open('data/transit.json',encoding='utf-8').read().replace('</','<\\/')
eng=open('engine.js',encoding='utf-8').read()
out=tpl.replace('{{DATA}}',data).replace('{{ENGINE}}',eng)
import os;os.makedirs('dist',exist_ok=True)
open('dist/tiktak-bus.html','w',encoding='utf-8').write(out)
print(len(out.encode()),'bytes')
