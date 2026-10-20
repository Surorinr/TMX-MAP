# 用法：node tools/make-shape-thumbs.js | python3 tools/make-shape-thumbs.py
import json, sys, base64, os
from PIL import Image
out = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'assets', 'shapes')
os.makedirs(out, exist_ok=True)
for e in json.load(sys.stdin):
    im = Image.frombytes('RGBA', (e['w'], e['h']), base64.b64decode(e['rgba']))
    side = 96
    k = side / max(e['w'], e['h'])
    im = im.resize((max(1, round(e['w'] * k)), max(1, round(e['h'] * k))), Image.NEAREST)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    canvas.save(os.path.join(out, e['id'] + '.png'), optimize=True)
    print(e['id'], im.size)
