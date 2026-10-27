"""Regression tests for the mega-shot engine (no VoiceStudio, GPU or API keys needed).
Run: uv run --with playwright==1.63.0 --with pyyaml --with pillow --with numpy --with ruamel.yaml python tests/kiem_thu.py
1. YAML key aliases: an English-key video.yaml and the same video with the original Vietnamese keys load identically.
2. Render: a temporary project from the `blank` template at 9x16, 16x9 and in Chinese (character wrapping), English and
   Vietnamese text. A synthetic voice (sine tone from ffmpeg) → timeline → 3 preview frames → frames are not black,
   have the right size, and the timeline has subtitles.
"""
import json, os, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from PIL import Image, ImageStat
SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); XP = [sys.executable, os.path.join(SKILL, 'tools', 'xp.py')]
sys.path.insert(0, os.path.join(SKILL, 'tools'))
import yaml, yaml_keys
ok = True

# --- 1. English / Vietnamese keys ---
EN = """name: t
format: 9x16
language: en
voice: { sample: documentarian, volume: 0.5, speed: 1.1 }
music: { file: bg.mp3, volume: 0.6, duck: true }
style: { overlays: [tia-nang], subtitle_style: box }
scenes:
  - id: a
    narration: Hello world.
    subtitle: Hello **world**.
    title: Big
    search: [{ query: ocean, type: image, pick: 3 }]
    labels: [{ text: Label, point: [.5, .5], at: .4 }]
"""
VI = """ten: t
khung: 9x16
ngon_ngu: en
giong: { mau: documentarian, am_luong: 0.5, toc_do: 1.1 }
nhac: { file: bg.mp3, am_luong: 0.6, tu_ha: true }
phong_cach: { lop_phu: [tia-nang], subtitle_style: box }
canh:
  - id: a
    loi: Hello world.
    phu_de: Hello **world**.
    chu: Big
    tim: [{ q: ocean, loai: anh, chon: 3 }]
    nhan: [{ chu: Label, diem: [.5, .5], luc: .4 }]
"""
same = yaml_keys.normalize(yaml.safe_load(EN)) == yaml.safe_load(VI)
print(f"[{'OK' if same else 'FAIL'}] English YAML keys == Vietnamese YAML keys"); ok &= same
L = yaml_keys.normalize_series(yaml.safe_load('name: s\ntitle: T\nepisodes: [{ folder: tap-01, title: P1 }]\nopening: { length: 4 }'))
good = L == {'ten': 's', 'tieu_de': 'T', 'tap': [{'thu_muc': 'tap-01', 'tieu_de': 'P1'}], 'mo_dau': {'dai': 4}}
print(f"[{'OK' if good else 'FAIL'}] series keys"); ok &= good

# --- 2. render ---
CASES = [('9x16', 'en', 'This is test sentence number one.'), ('16x9', 'vi', 'Đây là câu thử nghiệm số một.'),
         ('9x16', 'zh', '这是一个用于测试自动换行的很长的中文句子，看看字幕是否正常。')]
for khung, lang, text in CASES:
    d = tempfile.mkdtemp(prefix='ms_test_'); os.makedirs(os.path.join(d, '.mega-shot')); shutil.copytree(os.path.join(SKILL, 'templates', 'trong'), os.path.join(d, 'v'))
    v = os.path.join(d, 'v'); y = open(os.path.join(v, 'video.yaml'), encoding='utf-8').read().replace('__TEN__', 'test').replace('__KHUNG__', khung).replace('language: en', f'language: {lang}')
    y = y.replace('This is the opening line of the video.', text); open(os.path.join(v, 'video.yaml'), 'w', encoding='utf-8').write(y)
    os.makedirs(os.path.join(v, 'build', 'audio'))
    for cid in ('opening', 'main-idea'): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', os.path.join(v, 'build', 'audio', f'{cid}.wav')], check=True)
    env = {**os.environ, 'MS_PROJECT': d}
    subprocess.run(XP + ['timeline'], cwd=v, check=True, env=env); subprocess.run(XP + ['preview', '--at', '1.5,4,6'], cwd=v, check=True, capture_output=True, env=env)
    tl = json.load(open(os.path.join(v, 'build', 'timeline.json'), encoding='utf-8'))
    for k in range(3):
        im = Image.open(os.path.join(v, 'build', 'thu', f'{k:03d}.jpg')); mean = sum(ImageStat.Stat(im.convert('L')).mean)
        good = im.size == {'9x16': (1080, 1920), '16x9': (1920, 1080)}[khung] and mean > 15
        print(f"[{'OK' if good else 'FAIL'}] {khung} {lang} frame {k}: {im.size} brightness {mean:.0f}"); ok &= good
    subs = [s["s"] for s in tl["subs"]]
    good = bool(subs); ok &= good
    print(f"[{'OK' if good else 'FAIL'}]      subtitles: {subs[:3]}")
    shutil.rmtree(d, ignore_errors=True)
print('ALL PASSED' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
