"""mega-shot · nghe.py — local speech-recognition worker for the narration checks (listen-back + word timestamps).

Backend and Whisper model are chosen for this computer by tools/hw.py (`python tools/hw.py` shows the plan):
  · mlx       mlx-whisper on the Apple GPU (Apple Silicon Macs)
  · faster-whisper on CUDA (big NVIDIA GPUs) or on the CPU with int8 (everything else)
If the preferred backend cannot start (missing package, no CUDA libraries…), it falls back to faster-whisper on the CPU,
so a narration check never fails because of the speech engine.

Why a separate process: the voice model (VoiceStudio) keeps the GPU on small cards; recognition runs here, loaded once.
Protocol (one process per `xp` run): read one JSON line {"path": "...wav", "lang": "vi"} from stdin, write one JSON line
{"text": "...", "words": [[word, start, end], ...]} (or {"error": "..."}). First line out: {"ready": "<backend> <model> <device>"}.
Run: uv run --with faster-whisper --with numpy [--with mlx-whisper] python nghe.py --backend mlx|faster-whisper --model M --device cpu|cuda|metal
"""
import argparse, json, os, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('--backend', default='faster-whisper'); ap.add_argument('--model', default='small'); ap.add_argument('--device', default='cpu')
ap.add_argument('--compute', default=''); ap.add_argument('--fallback', default='small')
ap.add_argument('--threads', type=int, default=max(2, (os.cpu_count() or 8) - 4))
a = ap.parse_args()
import numpy as np


def load(path):   # decode with ffmpeg (faster-whisper's PyAV decoder breaks on some PyAV versions)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768


def mlx_engine(model):
    import mlx_whisper                                                           # Apple Silicon only
    def run(audio, lang):
        r = mlx_whisper.transcribe(audio, path_or_hf_repo=model, language=lang or None, word_timestamps=True, condition_on_previous_text=False, verbose=None)
        return [[w['word'].strip(), round(float(w['start']), 3), round(float(w['end']), 3)] for s in r.get('segments', []) for w in (s.get('words') or []) if w['word'].strip()]
    run(np.zeros(16000, np.float32), 'en')                                       # warm-up: downloads/loads the model now, not on the first line
    return run


def fw_engine(model, device, compute):
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device=device, compute_type=compute or ('float16' if device == 'cuda' else 'int8'), cpu_threads=a.threads)
    def run(audio, lang):
        segs, _ = m.transcribe(audio, language=lang or None, word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
        return [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for s in segs for w in (s.words or []) if w.word.strip()]
    if device == 'cuda': run(np.zeros(16000, np.float32), 'en')                  # CUDA errors (missing cuBLAS/cuDNN) show up on first use
    return run


try:
    eng = mlx_engine(a.model) if a.backend == 'mlx' else fw_engine(a.model, a.device, a.compute)
    used = f'{a.backend} {a.model} {a.device}'
except Exception as e:                                                          # preferred backend unavailable → CPU, always works
    print(f'[nghe] {a.backend}/{a.device} unavailable ({type(e).__name__}: {str(e)[:160]}) — using faster-whisper {a.fallback} on the CPU', file=sys.stderr, flush=True)
    eng = fw_engine(a.fallback, 'cpu', 'int8'); used = f'faster-whisper {a.fallback} cpu (fallback)'
print(json.dumps({'ready': used}), flush=True)

for line in sys.stdin:
    if not line.strip(): continue
    try:
        q = json.loads(line); words = eng(load(q['path']), q.get('lang'))
        out = {'text': ' '.join(w[0] for w in words), 'words': words}
    except Exception as e:
        out = {'error': f'{type(e).__name__}: {e}'}
    print(json.dumps(out), flush=True)   # ASCII escapes: a cp1252 console (Git Bash on Windows) cannot print Vietnamese
