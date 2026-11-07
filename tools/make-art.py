# Pre-renders one piece of card art per app (brand-coloured light on dark, with grain so dark gradients don't band).
# Run after `npm run sync`: python3 tools/make-art.py
import json, random, re, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops
random.seed(11); os.makedirs('app/art', exist_ok=True)


brand = json.load(open('tools/brand.json'))
apps = json.loads(re.search(r'window\.APPS = (\[.*\]);', open('app/apps.js').read(), re.S).group(1))
W, H = 640, 340

def art(rgb, name):
    r, g_, b = rgb
    im = Image.new('RGB', (W, H), (int(9 + r * .045), int(11 + g_ * .045), int(14 + b * .045)))
    def blob(cx, cy, rx, ry, col, a, blur):
        layer = Image.new('RGB', (W, H), (0, 0, 0)); ImageDraw.Draw(layer).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=tuple(int(c * a) for c in col))
        return ImageChops.add(im, layer.filter(ImageFilter.GaussianBlur(blur)))
    im = blob(W * .84, H * 1.0, W * .36, H * .62, (r, g_, b), .62, 80)                       # main brand light, bottom-right
    im = blob(W * .12, H * 1.1, W * .34, H * .5, (int(b * .7), int(r * .7), int(g_ * .7)), .26, 80)   # cooler counter-light, bottom-left
    sheen = Image.new('RGB', (W, H), (0, 0, 0)); sd = ImageDraw.Draw(sheen)
    sd.polygon([(0, 0), (int(W * .55), 0), (0, int(H * .75))], fill=(22, 22, 24))             # soft diagonal sheen, top-left
    im = ImageChops.add(im, sheen.filter(ImageFilter.GaussianBlur(40)))
    px = im.load()
    for y in range(H):
        for x in range(W):                                                                    # grain
            n = random.randint(-7, 7); p = px[x, y]; px[x, y] = (max(0, min(255, p[0] + n)), max(0, min(255, p[1] + n)), max(0, min(255, p[2] + n)))
    im.save(f'app/art/{name}.jpg', quality=88)

for a in apps:
    rgb = [int(v) for v in brand.get(a['id'], a['color']).split(',')]
    art(rgb, re.sub(r'[^\w.-]', '_', a['id']))
art((48, 200, 110), 'input-on'); art((120, 132, 150), 'input-off'); art((90, 120, 230), 'live'); art((110, 80, 235), 'liked'); art((255, 120, 70), 'stat-week'); art((90, 140, 255), 'stat-top'); art((160, 100, 255), 'stat-when')
print(len(apps) + 3, 'card arts written')
