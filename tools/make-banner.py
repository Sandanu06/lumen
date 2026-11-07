# Draws docs/media/banner.png (1280x640): the README banner and the GitHub social-preview image.
# Needs Pillow and docs/media/01-home.jpg (from `npm run docs:media`). Uses the macOS system font; edit FONT for Linux.
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
FONT = '/System/Library/Fonts/SFNS.ttf'
W, H = 1280, 640
bg = Image.open('app/wallpapers/dusk.jpg').convert('RGB').resize((W, int(W * 1080 / 1920)), Image.LANCZOS).crop((0, 60, W, 60 + H)).filter(ImageFilter.GaussianBlur(10))
shade = Image.new('RGB', (W, H), (7, 10, 16)); mask = Image.linear_gradient('L').rotate(90).resize((W, H)).point(lambda v: int(255 * (0.93 - 0.55 * v / 255)))
img = Image.composite(shade, bg, mask).convert('RGBA')

def font(size, wt='Regular'):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_name(wt)
    except Exception: pass
    return f
ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)   # draw on a transparent layer so translucent shapes blend properly

def mark(x, y, w):  # same glyph as the app
    u = w / 100.0
    d.rounded_rectangle([x, y + 6 * u, x + 100 * u, y + 74 * u], radius=11 * u, outline='white', width=max(3, int(6 * u)))
    for x0, top in ((18, 40), (36, 26), (54, 34), (72, 48)): d.rounded_rectangle([x + x0 * u, y + top * u, x + (x0 + 11) * u, y + 62 * u], radius=3 * u, fill='white')
    d.rounded_rectangle([x + 34 * u, y + 84 * u, x + 66 * u, y + 90 * u], radius=3 * u, fill='white'); d.rectangle([x + 47 * u, y + 74 * u, x + 53 * u, y + 86 * u], fill='white')
mark(64, 84, 84)
d.text((170, 80), 'Lumen', font=font(88, 'Semibold'), fill='white')
d.text((66, 214), 'A live, remote-friendly', font=font(40, 'Medium'), fill=(255, 255, 255, 240))
d.text((66, 264), 'home screen for LG TVs', font=font(40, 'Medium'), fill=(255, 255, 255, 240))
x, y = 66, 346
for label in ['Bluetooth speaker', 'Spotify', 'Live wallpaper', 'Usage stats']:
    f = font(21, 'Semibold'); w = d.textlength(label, font=f) + 34
    if x + w > 560: x, y = 66, y + 56
    d.rounded_rectangle([x, y, x + w, y + 42], radius=21, fill=(255, 255, 255, 36), outline=(255, 255, 255, 80)); d.text((x + 17, y + 8), label, font=f, fill='white'); x += w + 10
d.text((66, 478), 'Plain HTML, CSS and JS  \u00b7  MIT licensed', font=font(23, 'Regular'), fill=(255, 255, 255, 175))
img.alpha_composite(ov)

# screenshot card on the right
shot = Image.open('docs/media/01-home.jpg').convert('RGB'); sw = 590; sh = int(sw * shot.height / shot.width); shot = shot.resize((sw, sh), Image.LANCZOS)
card = Image.new('RGBA', (sw, sh), (0, 0, 0, 0)); card.paste(shot, (0, 0)); m = Image.new('L', (sw, sh), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=22, fill=255); card.putalpha(m)
shadow = Image.new('RGBA', (sw + 120, sh + 120), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle([60, 70, sw + 60, sh + 70], radius=26, fill=(0, 0, 0, 170)); shadow = shadow.filter(ImageFilter.GaussianBlur(26))
px, py = 636, 158
img.alpha_composite(shadow, (px - 60, py - 60)); img.alpha_composite(card, (px, py))
ImageDraw.Draw(img).rounded_rectangle([px, py, px + sw - 1, py + sh - 1], radius=22, outline=(255, 255, 255, 60), width=2)
img.convert('RGB').save('docs/media/banner.png', optimize=True); print('docs/media/banner.png')

# 2x2 collage of the four time-of-day scenes (docs/media/scenes.jpg)
names = ['dawn', 'day', 'dusk', 'night']; cw, ch = 800, 450; g = 10
col = Image.new('RGB', (2 * cw + g, 2 * ch + g), (10, 12, 16))
for i, n in enumerate(names): col.paste(Image.open('docs/media/scene-%s.jpg' % n).convert('RGB').resize((cw, ch), Image.LANCZOS), ((i % 2) * (cw + g), (i // 2) * (ch + g)))
col.save('docs/media/scenes.jpg', quality=86, optimize=True); print('docs/media/scenes.jpg')
