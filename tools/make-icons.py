# Draws the launcher icons and launch splash with Pillow. Run: python3 tools/make-icons.py
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
S = 4  # supersample

def mark(d, ox, oy, w, col=(255, 255, 255, 255)):
    """A TV screen holding four skyline bars, with a stand. Same glyph as the in-app logo (app/index.html)."""
    u = w / 100.0
    d.rounded_rectangle([ox, oy + 6 * u, ox + 100 * u, oy + 74 * u], radius=11 * u, outline=col, width=max(2, int(6 * u)))
    for x0, top in ((18, 40), (36, 26), (54, 34), (72, 48)):
        d.rounded_rectangle([ox + x0 * u, oy + top * u, ox + (x0 + 11) * u, oy + 62 * u], radius=3 * u, fill=col)
    d.rounded_rectangle([ox + 34 * u, oy + 84 * u, ox + 66 * u, oy + 90 * u], radius=3 * u, fill=col)
    d.rectangle([ox + 47 * u, oy + 74 * u, ox + 53 * u, oy + 86 * u], fill=col)

def gradient(size, c0, c1):
    g = Image.new('RGB', (size, size)); px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x * .35 + y * .65) / size
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    return g

def icon(px):
    big = px * S
    im = gradient(big, (24, 46, 58), (214, 112, 70)).convert('RGBA')   # alpine-lake dusk to warm rock
    glow = Image.new('RGBA', (big, big), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.ellipse([big * .45, big * .55, big * 1.25, big * 1.35], fill=(255, 190, 120, 120)); im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(big * .12)))
    d = ImageDraw.Draw(im); w = big * .6; mark(d, (big - w) / 2, big * .2, w)
    return im.resize((px, px), Image.LANCZOS)

icon(130).save('app/largeIcon.png'); icon(80).save('app/icon.png')

# launch splash: the wallpaper, darkened and blurred, with the mark centred
bg = Image.open('tools/src-wallpapers/morning.jpg').convert('RGB')
r = max(1920 / bg.width, 1080 / bg.height); bg = bg.resize((int(bg.width * r) + 1, int(bg.height * r) + 1), Image.LANCZOS)
bg = bg.crop(((bg.width - 1920) // 2, (bg.height - 1080) // 2, (bg.width - 1920) // 2 + 1920, (bg.height - 1080) // 2 + 1080))
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(14))).enhance(.45).convert('RGBA')
ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov); mark(od, 1920 / 2 - 110, 1080 / 2 - 140, 220)
from PIL import ImageFont
f = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 84)
try: f.set_variation_by_name('Semibold')
except Exception: pass
tw = od.textlength('Lumen', font=f); od.text((1920 / 2 - tw / 2, 1080 / 2 + 110), 'Lumen', font=f, fill=(255, 255, 255, 255))
bg.alpha_composite(ov)
bg.convert('RGB').save('app/splash.jpg', quality=82)
print('icons + splash written')
