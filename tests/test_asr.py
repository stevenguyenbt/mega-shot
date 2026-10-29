"""Speech-recognition check: the backend/model tools/hw.py picks for this computer must start (or fall back) and
transcribe a short spoken sentence with word timestamps. Uses macOS `say` or Windows SAPI to make the audio; skipped
(exit 0) where neither exists.  Run: uv run --no-project --with pyyaml python tests/test_asr.py"""
import json, os, platform, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hw
TEXT = 'mega shot turns an idea into a finished video'
d = tempfile.mkdtemp(prefix='ms_asr_'); wav = os.path.join(d, 'a.wav')
if platform.system() == 'Darwin' and shutil.which('say'):
    aiff = os.path.join(d, 'a.aiff'); subprocess.run(['say', '-o', aiff, TEXT], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', aiff, '-ar', '16000', '-ac', '1', wav], check=True)
elif platform.system() == 'Windows':
    ps = f"Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('{wav}'); $s.Speak('{TEXT}'); $s.Dispose()"
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], check=True)
else:
    print('SKIP: no speech synthesizer (macOS say / Windows SAPI) on this machine'); sys.exit(0)
pl = hw.asr_plan(); print('plan:', json.dumps({k: pl[k] for k in ('backend', 'model', 'device', 'why')}))
w = [x for pkg in hw.asr_packages(pl) for x in ('--with', pkg)]
cmd = ['uv', 'run', '--quiet', '--no-project', *w, 'python', os.path.join(ROOT, 'tools', 'nghe.py'), '--backend', pl['backend'], '--model', pl['model'],
       '--device', pl['device'], '--compute', pl['compute'], '--threads', str(pl['threads']), '--fallback', pl['fallback']]
r = subprocess.run(cmd, input=json.dumps({'path': wav, 'lang': 'en'}) + '\n', capture_output=True, text=True, encoding='utf-8', timeout=1800)
lines = [json.loads(x) for x in r.stdout.splitlines() if x.startswith('{')]
ready = next((x['ready'] for x in lines if 'ready' in x), None); res = next((x for x in lines if 'words' in x or 'error' in x), {})
print('engine:', ready); print('heard:', res.get('text') or res.get('error'))
if r.stderr.strip(): print('stderr:', r.stderr.strip().splitlines()[-1][:300])
words = res.get('words') or []
ok = bool(ready) and 'video' in (res.get('text') or '').lower() and all(len(x) == 3 and x[2] >= x[1] for x in words) and len(words) >= 5
print('ASR OK' if ok else 'ASR FAILED'); shutil.rmtree(d, ignore_errors=True); sys.exit(0 if ok else 1)
