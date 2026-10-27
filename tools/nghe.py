"""mega-shot · nghe.py — local speech recognition worker for narration checks (faster-whisper on the CPU).

Why: VoiceStudio's own Whisper (large-v3, GPU) does not fit in a 6 GB card next to the OmniVoice voice model, so every
check swapped models in and out (1–2 min each) and the voice model spilled into system RAM (synthesis 25–80× slower).
Here the recognition runs in a separate process on the CPU, so VoiceStudio keeps only the voice model on the GPU.

Protocol (one process per `xp` run, model loaded once): read one JSON line {"path": "...wav", "lang": "vi"} from stdin,
write one JSON line {"text": "...", "words": [[word, start, end], ...]} (or {"error": "..."}) to stdout.
Run: uv run --with faster-whisper --with numpy python nghe.py [--model small] [--threads N]
"""
import sys, json, os, argparse, subprocess

ap = argparse.ArgumentParser(); ap.add_argument('--model', default='small'); ap.add_argument('--threads', type=int, default=max(4, (os.cpu_count() or 8) - 4))
a = ap.parse_args()
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(a.model, device='cpu', compute_type='int8', cpu_threads=a.threads)
print(json.dumps({'ready': a.model}), flush=True)

def load(path):   # decode with ffmpeg (faster-whisper's PyAV decoder breaks on some PyAV versions)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

for line in sys.stdin:
    if not line.strip(): continue
    try:
        q = json.loads(line)
        segs, _ = m.transcribe(load(q['path']), language=q.get('lang') or None, word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
        words = [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for s in segs for w in (s.words or []) if w.word.strip()]
        out = {'text': ' '.join(w[0] for w in words), 'words': words}
    except Exception as e:
        out = {'error': f'{type(e).__name__}: {e}'}
    print(json.dumps(out), flush=True)   # ASCII escapes: a cp1252 console (Git Bash on Windows) cannot print Vietnamese
