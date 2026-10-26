# 3.26.0：多语言词典构建脚本。用法：python3 tools/i18n/build.py
# 词典格式（part*.txt）：每行「简体原文|English|Français|Deutsch|日本語|한국어|Русский|Español」，共 8 列；
# 繁體中文不需要逐条翻译，由 phr.txt（词组）+ s2t.txt（逐字）自动转换。输出：app/src/main/assets/i18n.js
import json, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
D = {}; errs = []
for f in ['part1.txt', 'part2.txt', 'part3.txt']:
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip(): continue
        parts = line.split('|')
        if len(parts) != 8: errs.append(f'{f}:{n} 列数 {len(parts)}: {line[:40]}'); continue
        k = parts[0].strip()
        if k in D and D[k] != parts[1:]: errs.append(f'{f}:{n} 重复键且译文不同: {k}')
        D[k] = [p.strip() for p in parts[1:]]
if errs: print('\n'.join(errs)); sys.exit(1)
pairs = open('s2t.txt', encoding='utf-8').read().split()
phr = [l.split() for l in open('phr.txt', encoding='utf-8') if l.strip()]
phr.sort(key=lambda x: -len(x[0]))  # 长词组优先（文件夹 先于 文件）
src = open('engine.js', encoding='utf-8').read()
src = src.replace('/*__DICT__*/{}', json.dumps(D, ensure_ascii=False, separators=(',', ':')))
src = src.replace("/*__S2T__*/''", json.dumps(''.join(pairs), ensure_ascii=False))
src = src.replace('/*__PHR__*/[]', json.dumps(phr, ensure_ascii=False))
open(os.path.join('..', '..', 'app', 'src', 'main', 'assets', 'i18n.js'), 'w', encoding='utf-8').write(src)
print('entries', len(D), 'bytes', len(src.encode()))
