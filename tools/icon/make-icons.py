#!/usr/bin/env python3
"""
3.15.0：由 icon-source.png（从用户提供的插画中抠出的「海陆战区地图」主体，透明背景，1024²）
生成全部平台图标。可重复运行：python3 tools/icon/make-icons.py

输出：
  Android  res/mipmap-*/ic_launcher.png（圆角方形，旧版启动器）
           res/mipmap-*/ic_launcher_round.png（圆形）
           res/mipmap-*/ic_launcher_foreground.png（自适应图标前景，主体落在 66/108 安全区内）
  PC       desktop/icons/32x32.png 64x64.png 128x128.png 128x128@2x.png icon.png icon.ico icon.icns
  Web      app/src/main/assets/icons/icon-192.png icon-512.png（页面 favicon / 启动屏）
自适应图标背景色在 res/drawable/ic_launcher_background.xml 中（与这里的 BG_TOP / BG_BOTTOM 保持一致）。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RES = os.path.join(ROOT, 'app', 'src', 'main', 'res')
DESK = os.path.join(ROOT, 'desktop', 'icons')
WEB = os.path.join(ROOT, 'app', 'src', 'main', 'assets', 'icons')
BG_TOP, BG_BOTTOM = (62, 80, 108), (17, 26, 44)   # 石板蓝 → 深海军蓝：衬托地图的黑色描边与蓝色海域
GLOW = (120, 190, 255)
SRC = Image.open(os.path.join(HERE, 'icon-source.png')).convert('RGBA')


def gradient(size):
    """竖向线性渐变 + 中心偏上的柔光"""
    g = Image.new('RGBA', (size, size))
    px = g.load()
    for y in range(size):
        t = y / (size - 1)
        col = tuple(round(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3)) + (255,)
        for x in range(size):
            px[x, y] = col
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    r = size * 0.42
    d.ellipse((size / 2 - r, size * 0.44 - r, size / 2 + r, size * 0.44 + r), fill=GLOW + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    return Image.alpha_composite(g, glow)


def place(canvas, scale, dy=0.0):
    """把主体按 canvas 边长的 scale 比例居中贴上，带一层柔和投影"""
    size = canvas.size[0]
    s = round(size * scale)
    obj = SRC.resize((s, s), Image.LANCZOS)
    x = (size - s) // 2
    y = (size - s) // 2 + round(size * dy)
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    a = obj.split()[3].point(lambda v: v * 0.55)
    blk = Image.new('RGBA', obj.size, (0, 0, 0, 255)); blk.putalpha(a)
    shadow.paste(blk, (x, y + round(size * 0.025)), blk)
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, size * 0.02)))
    out = Image.alpha_composite(canvas, shadow)
    out.alpha_composite(obj, (x, y))
    return out


def mask(size, kind):
    m = Image.new('L', (size * 4, size * 4), 0)
    d = ImageDraw.Draw(m)
    if kind == 'round':
        d.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 * 0.225, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def full_icon(size, kind='square'):
    big = 1024
    img = place(gradient(big), 0.86 if kind == 'square' else 0.78, 0.005)
    # 内描边高光，让图标在深色桌面上也有边界
    hl = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(hl)
    if kind == 'round': d.ellipse((6, 6, big - 7, big - 7), outline=(255, 255, 255, 46), width=8)
    else: d.rounded_rectangle((6, 6, big - 7, big - 7), radius=big * 0.21, outline=(255, 255, 255, 46), width=8)
    img = Image.alpha_composite(img, hl)
    img.putalpha(mask(big, kind))
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    # 自适应图标：108dp 画布，安全区为中心 66dp 圆（≈61%）；主体对角线也要落在圆内，取 0.60
    can = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    return place(can, 0.60).resize((size, size), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print('wrote', os.path.relpath(path, ROOT), img.size)


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENS.items():
    d = os.path.join(RES, f'mipmap-{name}')
    save(full_icon(round(48 * k)), os.path.join(d, 'ic_launcher.png'))
    save(full_icon(round(48 * k), 'round'), os.path.join(d, 'ic_launcher_round.png'))
    save(foreground(round(108 * k)), os.path.join(d, 'ic_launcher_foreground.png'))

for s, n in [(32, '32x32.png'), (64, '64x64.png'), (128, '128x128.png'), (256, '128x128@2x.png'), (512, 'icon.png')]:
    save(full_icon(s), os.path.join(DESK, n))
master = full_icon(1024)
master.save(os.path.join(DESK, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('wrote desktop/icons/icon.ico')
try:
    master.save(os.path.join(DESK, 'icon.icns'))
    print('wrote desktop/icons/icon.icns')
except Exception as e:  # 旧版 Pillow 不支持写 icns
    print('icns skipped:', e)
save(full_icon(192), os.path.join(WEB, 'icon-192.png'))
save(full_icon(512), os.path.join(WEB, 'icon-512.png'))
