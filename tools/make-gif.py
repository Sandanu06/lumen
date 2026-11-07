# Builds the demo media from docs/media/frames (recorded by `npm run docs:media`):
#   docs/media/demo.mp4        full tour, 1280x720
#   docs/media/demo-hero.gif   the first ~16 s, looping, for the top of the README
# Uses ffmpeg when found (FFMPEG env var, or `ffmpeg` on PATH) for small files and MP4; otherwise falls back to Pillow GIFs only.
import json, os, shutil, subprocess, sys
from PIL import Image
D = 'docs/media'; F = D + '/frames'; SEQ = '/tmp/lumen-demo-seq'
meta = json.load(open(F + '/frames.json'))
def bright(p): return sum(Image.open(p).convert('L').resize((32, 18)).tobytes()) / (32 * 18)
start = next((i for i, m in enumerate(meta) if bright(F + '/' + m['f']) < 45), 0)   # start at the dark logo intro
meta = meta[start:]; t0 = meta[0]['t']; end = meta[-1]['t'] - t0
FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
FPS = 10

# constant-rate image sequence (hold the latest frame until the next one arrives)
shutil.rmtree(SEQ, ignore_errors=True); os.makedirs(SEQ)
n = int(end * FPS); j = 0
for k in range(n):
    t = k / FPS
    while j + 1 < len(meta) and meta[j + 1]['t'] - t0 <= t: j += 1
    shutil.copy(F + '/' + meta[j]['f'], '%s/%05d.jpg' % (SEQ, k))
print('sequence:', n, 'frames,', round(end, 1), 's')

def size(p): return round(os.path.getsize(p) / 1e6, 2)
if FFMPEG:
    run = lambda a: subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', SEQ + '/%05d.jpg'] + a, check=True)
    run(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-vf', 'scale=1280:-2', '-movflags', '+faststart', D + '/demo.mp4']); print('demo.mp4', size(D + '/demo.mp4'), 'MB')
    def gif(name, width, fps, colors, seconds=None):
        vf = 'fps=%d,scale=%d:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=%d:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle' % (fps, width, colors)
        run((['-t', str(seconds)] if seconds else []) + ['-vf', vf, '-loop', '0', D + '/' + name]); print(name, size(D + '/' + name), 'MB')
    gif('demo-hero.gif', 640, 8, 96, 16)
else:
    print('ffmpeg not found: building Pillow GIFs only (larger). Install ffmpeg for demo.mp4 and smaller files.')
    def gif(name, width, step, colors, seconds=None):
        fr = sorted(os.listdir(SEQ))[::step]; fr = fr[:int((seconds or end) * FPS / step)]
        ims = [Image.open(SEQ + '/' + f).convert('RGB') for f in fr]; ims = [i.resize((width, round(width * i.height / i.width)), Image.LANCZOS) for i in ims]
        pal = ims[len(ims) // 2].quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE); q = [i.quantize(palette=pal, dither=Image.Dither.NONE) for i in ims]
        q[0].save(D + '/' + name, save_all=True, append_images=q[1:], duration=int(1000 * step / FPS), loop=0, optimize=True); print(name, size(D + '/' + name), 'MB')
    gif('demo-hero.gif', 560, 2, 64, 16)
