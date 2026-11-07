# Derives the dusk and night wallpapers from the two Commons photos by colour grading (and, for night, drawing stars in the sky only).
# Run: python3 tools/make-wallpapers.py   (reads tools/src-wallpapers/morning.jpg + dolomites.jpg, writes dawn/day/dusk/night.jpg into app/wallpapers)
# Each scene gets the dark top/bottom scrim and a fine dither baked in, so the app needs no full-screen gradient or grain layers (those cost ~15 fps on the TV).
import random
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter
W, H = 1920, 1080

def load(n):
    im = Image.open(f'tools/src-wallpapers/{n}.jpg').convert('RGB'); r = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    return im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))

def vgrad(top, bottom):  # vertical gradient image
    g = Image.new('RGB', (1, H)); 
    for y in range(H): g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * y / (H - 1)) for i in range(3)))
    return g.resize((W, H))

# ---- dusk: plum-to-amber sky light soft-blended over the whole scene, warm cast, deeper shadows
d = load('morning')
glow = vgrad((150, 70, 130), (255, 150, 70))                                  # plum at the top, amber at the horizon
d = ImageChops.multiply(d, Image.new('RGB', (W, H), (255, 214, 186)))         # warm cast
d = Image.blend(d, ImageChops.overlay(d, glow), .62)                           # sky colour carried into rock and water
d = ImageEnhance.Color(d).enhance(1.25); d = ImageEnhance.Contrast(d).enhance(1.18); d = ImageEnhance.Brightness(d).enhance(.78)
dusk = d

# ---- night: dark navy, muted colour (also tames the red jacket), stars only where the sky is bright in the original
n = load('dolomites'); lum = n.convert('L')
night = ImageEnhance.Color(n).enhance(.45)                                     # mute colour first
night = ImageChops.multiply(night, Image.new('RGB', (W, H), (58, 84, 150)))   # navy cast
night = ImageEnhance.Contrast(night).enhance(1.25); night = ImageEnhance.Brightness(night).enhance(1.55)
night = ImageChops.screen(night, vgrad((6, 10, 30), (8, 16, 42)))              # deep night-sky floor
sky = lum.point(lambda v: 255 if v > 150 else 0).filter(ImageFilter.GaussianBlur(10))
rows = Image.new('L', (W, H), 0); ImageDraw.Draw(rows).rectangle([0, 0, W, int(H * .5)], fill=255)
mask = ImageChops.multiply(sky, rows)
stars = Image.new('RGB', (W, H), (0, 0, 0)); sd = ImageDraw.Draw(stars); random.seed(7)
for _ in range(700):
    x, y = random.randrange(W), random.randrange(int(H * .5)); b = random.choice((110, 150, 200, 255)); r = random.choice((1, 1, 1, 2))
    sd.ellipse([x - r, y - r, x + r, y + r], fill=(b, b, min(255, b + 25)))
stars = stars.filter(ImageFilter.GaussianBlur(.8))
night = ImageChops.screen(night, ImageChops.multiply(stars, Image.merge('RGB', (mask, mask, mask))))


def finish(im, name):
    # same vertical scrim the CSS used to draw (.58 at the top, .28 at 34%, .78 at the bottom), then +-2.5 levels of noise against banding
    g = Image.new('L', (1, H)); 
    for y in range(H):
        t = y / (H - 1); a = .58 + (.28 - .58) * t / .34 if t < .34 else .28 + (.78 - .28) * (t - .34) / .66
        g.putpixel((0, y), int(a * 255))
    a = g.resize((W, H)); dark = Image.new('RGB', (W, H), (6, 8, 10))
    im = Image.composite(dark, im, a)
    noise = Image.effect_noise((W, H), 6).convert('L')             # mean 128, spread ~6
    im = ImageChops.add(im, Image.merge('RGB', (noise, noise, noise)), 1, -128)
    im.save(f'app/wallpapers/{name}.jpg', quality=88)
finish(load('morning'), 'dawn'); finish(load('dolomites'), 'day'); finish(dusk, 'dusk'); finish(night, 'night')
print('dawn, day, dusk, night written')
