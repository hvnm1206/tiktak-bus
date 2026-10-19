from PIL import Image, ImageDraw, ImageFont
import os
def font(sz):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
def icon(size, path, maskable=False):
    im = Image.new('RGB', (size, size), (11, 92, 173))
    d = ImageDraw.Draw(im)
    pad = int(size*(0.2 if maskable else 0.12))
    d.rounded_rectangle([pad, int(size*0.3), size-pad, int(size*0.7)], radius=int(size*0.06), fill=(16, 22, 28))
    f = font(int(size*0.26)); t='BUS'
    w = d.textlength(t, font=f); bb = f.getbbox(t)
    d.text(((size-w)/2, size/2 - (bb[1]+bb[3])/2), t, font=f, fill=(255, 184, 28))
    im.save(path)
icon(192,'pwa/icon-192.png'); icon(512,'pwa/icon-512.png'); icon(512,'pwa/icon-maskable-512.png',True); icon(180,'pwa/apple-touch-icon.png')
