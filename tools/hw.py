"""mega-shot · hw.py — what this computer is, and what that means for mega-shot (no installs, no network).

  profile()          OS, CPU, cores, RAM, Apple Silicon chip, NVIDIA GPU + VRAM (cached per run)
  asr_plan()         which speech-recognition backend / Whisper model / device the narration check should use
  chromium_args()    GPU flags for headless Chromium on this OS (Direct3D on Windows, Metal on macOS, ANGLE/GL on Linux)
  blender_paths(ms)  where Blender may be installed on this OS
  python tools/hw.py [--json]   print the profile and the plan

Whisper choice (override with MS_ASR_BACKEND=mlx|faster-whisper, MS_ASR_MODEL=<name>, MS_ASR_DEVICE=cpu|cuda):
  · Apple Silicon (M1…M4)          → mlx-whisper on the Apple GPU (Metal), fastest on a Mac:
                                     ≥ 16 GB RAM: large-v3-turbo · 8–16 GB: small · < 8 GB: base   (falls back to faster-whisper CPU)
  · NVIDIA GPU with ≥ 10 GB VRAM   → faster-whisper on CUDA, float16, large-v3-turbo (falls back to CPU if CUDA libs are missing)
  · otherwise (Intel Mac, small GPU — the voice model needs it, plain CPU) → faster-whisper on the CPU, int8:
                                     ≥ 12 cores & ≥ 32 GB: medium · ≥ 4 cores & ≥ 8 GB: small · else base
"""
import functools, json, os, platform, re, shutil, subprocess, sys

MODEL_MB = {'tiny': 75, 'base': 145, 'small': 484, 'medium': 1530, 'large-v3': 3100, 'large-v3-turbo': 1620,
            'mlx-community/whisper-base-mlx': 145, 'mlx-community/whisper-small-mlx': 484, 'mlx-community/whisper-large-v3-turbo': 1610}
MLX = {'base': 'mlx-community/whisper-base-mlx', 'small': 'mlx-community/whisper-small-mlx', 'large-v3-turbo': 'mlx-community/whisper-large-v3-turbo',
       'medium': 'mlx-community/whisper-medium-mlx', 'large-v3': 'mlx-community/whisper-large-v3-mlx'}


def _out(cmd, timeout=10):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception: return ''


def _ram_gb():
    s = platform.system()
    try:
        if s == 'Darwin': return int(_out(['sysctl', '-n', 'hw.memsize']) or 0) / 2**30
        if s == 'Linux':
            for ln in open('/proc/meminfo'):
                if ln.startswith('MemTotal:'): return int(ln.split()[1]) / 2**20
        if s == 'Windows':
            import ctypes
            class M(ctypes.Structure): _fields_ = [('l', ctypes.c_ulong), ('m', ctypes.c_ulong), ('t', ctypes.c_ulonglong)] + [(f'x{i}', ctypes.c_ulonglong) for i in range(6)]
            m = M(); m.l = ctypes.sizeof(M); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)); return m.t / 2**30
    except Exception: pass
    return 0.0


def _physical_cores():
    s = platform.system()
    if s == 'Darwin':
        n = _out(['sysctl', '-n', 'hw.perflevel0.physicalcpu']) or _out(['sysctl', '-n', 'hw.physicalcpu'])   # performance cores on Apple Silicon
        if n.isdigit(): return int(n)
    if s == 'Linux':
        try: return len({ln.split(':')[1].strip() for ln in open('/proc/cpuinfo') if ln.startswith('core id')}) or os.cpu_count() or 4
        except OSError: pass
    return max(1, (os.cpu_count() or 4) // 2) if s == 'Windows' else (os.cpu_count() or 4)


@functools.lru_cache(maxsize=1)
def profile():
    s, mach = platform.system(), platform.machine().lower()
    p = {'os': {'Darwin': 'macos'}.get(s, s.lower()), 'arch': mach, 'cpu_threads': os.cpu_count() or 4, 'cores': _physical_cores(), 'ram_gb': round(_ram_gb(), 1),
         'apple_silicon': s == 'Darwin' and mach in ('arm64', 'aarch64'), 'chip': '', 'nvidia': None}
    if s == 'Darwin':
        p['chip'] = _out(['sysctl', '-n', 'machdep.cpu.brand_string'])
        if p['apple_silicon'] and _out(['sysctl', '-n', 'sysctl.proc_translated']) == '1': p['rosetta'] = True   # x86 Python under Rosetta: ML libs run slowly
    smi = shutil.which('nvidia-smi')
    if smi:
        o = _out([smi, '--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'])
        if o:
            name, mem, drv = [x.strip() for x in o.splitlines()[0].split(',')[:3]]
            p['nvidia'] = {'name': name, 'vram_gb': round(float(mem) / 1024, 1), 'driver': drv}
    return p


def asr_plan(p=None):
    """{'backend': 'mlx'|'faster-whisper', 'model', 'device', 'compute', 'threads', 'why', 'download_mb'}"""
    p = p or profile(); env = os.environ
    cores, ram = p['cores'], p['ram_gb'] or 8
    threads = max(2, min(cores, (p['cpu_threads'] or 4) - 1))
    cpu_model = 'medium' if cores >= 12 and ram >= 32 else 'small' if cores >= 4 and ram >= 7.5 else 'base'
    if p['apple_silicon'] and not p.get('rosetta'):
        size = 'large-v3-turbo' if ram >= 15.5 else 'small' if ram >= 7.5 else 'base'
        plan = {'backend': 'mlx', 'model': MLX[size], 'device': 'metal', 'compute': 'float16', 'threads': threads,
                'why': f"Apple Silicon ({p['chip'] or p['arch']}, {ram:.0f} GB) → mlx-whisper on the Apple GPU", 'fallback': cpu_model}
    elif p['nvidia'] and p['nvidia']['vram_gb'] >= 10:
        plan = {'backend': 'faster-whisper', 'model': 'large-v3-turbo', 'device': 'cuda', 'compute': 'float16', 'threads': threads,
                'why': f"{p['nvidia']['name']} {p['nvidia']['vram_gb']:.0f} GB → CUDA (room next to the voice model)", 'fallback': cpu_model}
    else:
        why = (f"{p['nvidia']['name']} {p['nvidia']['vram_gb']:.0f} GB is kept for the voice model → CPU" if p['nvidia'] else
               'x86 Python under Rosetta → CPU (install the arm64 uv/Python for the fast Apple-GPU path)' if p.get('rosetta') else
               'Intel Mac → CPU' if p['os'] == 'macos' else 'no suitable GPU → CPU') + f' ({cores} cores, {ram:.0f} GB)'
        plan = {'backend': 'faster-whisper', 'model': cpu_model, 'device': 'cpu', 'compute': 'int8', 'threads': threads, 'why': why, 'fallback': cpu_model}
    if env.get('MS_ASR_BACKEND') in ('mlx', 'faster-whisper'): plan['backend'] = env['MS_ASR_BACKEND']; plan['why'] += ' · MS_ASR_BACKEND'
    if env.get('MS_ASR_DEVICE') in ('cpu', 'cuda'):
        plan['device'] = env['MS_ASR_DEVICE']; plan['compute'] = 'int8' if env['MS_ASR_DEVICE'] == 'cpu' else 'float16'
    if env.get('MS_ASR_MODEL'):
        m = env['MS_ASR_MODEL']; plan['model'] = MLX.get(m, m) if plan['backend'] == 'mlx' else m; plan['why'] += ' · MS_ASR_MODEL'
    elif plan['backend'] == 'mlx' and not plan['model'].startswith('mlx-community/'): plan['model'] = MLX.get(plan['model'], MLX['small'])
    elif plan['backend'] == 'faster-whisper' and plan['model'].startswith('mlx-community/'): plan['model'] = plan['fallback']
    plan['download_mb'] = MODEL_MB.get(plan['model'], 0)
    return plan


def asr_packages(plan):
    """uv --with packages for tools/nghe.py (faster-whisper is always included as the fallback)."""
    return ['faster-whisper', 'numpy'] + (['mlx-whisper'] if plan['backend'] == 'mlx' else [])


def chromium_args():
    s = platform.system()
    gpu = ['--use-angle=d3d11'] if s == 'Windows' else ['--use-angle=metal'] if s == 'Darwin' else ['--use-angle=gl']
    return gpu + ['--enable-gpu', '--ignore-gpu-blocklist']


def blender_paths(ms):
    import glob
    s, home = platform.system(), os.path.expanduser('~')
    if s == 'Windows':
        c = glob.glob(os.path.join(ms, 'tools', 'blender-*', 'blender.exe')) + glob.glob(os.path.join(os.environ.get('ProgramFiles', 'C:/Program Files'), 'Blender Foundation', 'Blender*', 'blender.exe'))
    elif s == 'Darwin':
        c = glob.glob(os.path.join(ms, 'tools', 'Blender*.app', 'Contents', 'MacOS', 'Blender')) + [p for p in ('/Applications/Blender.app/Contents/MacOS/Blender',
             os.path.join(home, 'Applications', 'Blender.app', 'Contents', 'MacOS', 'Blender')) if os.path.exists(p)]
    else:
        c = glob.glob(os.path.join(ms, 'tools', 'blender-*', 'blender')) + glob.glob('/snap/bin/blender')
    return sorted(c)


def open_path(path):
    """Open a folder/file in the OS file browser."""
    s = platform.system()
    if s == 'Windows': os.startfile(path)                                       # noqa: needs Windows
    else: subprocess.Popen(['open' if s == 'Darwin' else 'xdg-open', path])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    p, a = profile(), asr_plan()
    if '--json' in sys.argv: print(json.dumps({'profile': p, 'asr': a}, indent=1)); sys.exit(0)
    print(json.dumps(p, indent=1)); print(f"speech recognition: {a['backend']} · {a['model']} · {a['device']}/{a['compute']} · {a['threads']} threads — {a['why']}")
