"""mega-shot · `xp text-styles` — render the animated subtitle/title style previews (GIF) shown to users.

  xp text-styles                 all styles → references/text-styles/*.gif + overview grids
  xp text-styles --only highlight,spring
  xp text-styles --width 360 --fps 20

Each GIF is rendered by the real engine (engine/core/textfx.js via textfx_demo.html), so what users see is exactly what
`phong_cach: { subtitle_style: <id>, title_style: <id> }` produces in a video.
"""
import base64, functools, http.server, os, shutil, subprocess, tempfile, threading

def _gif(frames_dir, out, fps, width):
    pal = os.path.join(frames_dir, 'pal.png'); src = os.path.join(frames_dir, '%04d.jpg')
    vf = f'fps={fps},scale={width}:-1:flags=lanczos'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', src, '-vf', vf + ',palettegen=stats_mode=diff:max_colors=200', pal], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', src, '-i', pal, '-lavfi', vf + ' [v]; [v][1:v] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', out], check=True)

def _grid(gifs, out, cols, cell):
    n = len(gifs); rows = (n + cols - 1) // cols; ins = sum([['-i', g] for g in gifs], [])
    sc = ''.join(f'[{i}:v]scale={cell}:-1:flags=lanczos,setpts=PTS-STARTPTS[v{i}];' for i in range(n))
    h = int(cell * 16 / 9); lay = '|'.join(f'{(i % cols) * cell}_{(i // cols) * h}' for i in range(n))
    fc = sc + ''.join(f'[v{i}]' for i in range(n)) + f'xstack=inputs={n}:layout={lay}:fill=black:shortest=1,split[a][b];[a]palettegen=stats_mode=diff:max_colors=200[p];[b][p]paletteuse=dither=bayer:bayer_scale=4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-loop', '0', out], check=True)

def main(a, X):
    from playwright.sync_api import sync_playwright
    eng = os.path.join(X.SKILL, 'engine', 'core'); out_dir = os.path.join(X.SKILL, 'references', 'text-styles'); os.makedirs(out_dir, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *x: None}), directory=eng))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    only = set(x.strip() for x in (a.only or '').split(',') if x.strip()); made = {'sub': [], 'title': []}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']); pg = b.new_page(viewport={'width': 1080, 'height': 1920})
        pg.goto(f'http://127.0.0.1:{srv.server_port}/textfx_demo.html'); pg.wait_for_function('window.draw && window.MS && MS.tfx')
        ids = pg.evaluate('({sub: MS.tfx.SUB_IDS, title: MS.tfx.TITLE_IDS, sd: SUB_DUR, td: TITLE_DUR})')
        for kind, dur in (('sub', ids['sd']), ('title', ids['td'])):
            for sid in ids[kind]:
                name = ('subtitle-' if kind == 'sub' else 'title-') + sid; gif = os.path.join(out_dir, name + '.gif'); made[kind].append(gif)
                if only and sid not in only: continue
                tmp = tempfile.mkdtemp(prefix='tfx-'); n = int(dur * a.fps)
                for k in range(n):
                    data = pg.evaluate(f'draw({kind!r}, {sid!r}, {k / a.fps})'); open(os.path.join(tmp, f'{k:04d}.jpg'), 'wb').write(base64.b64decode(data.split(',', 1)[1]))
                _gif(tmp, gif, a.fps, a.width); shutil.rmtree(tmp, ignore_errors=True)
                X.log(f'✓ {os.path.relpath(gif, X.SKILL)} · {os.path.getsize(gif) / 1e6:.1f} MB')
        b.close()
    srv.shutdown()
    for kind, gifs, cols in (('sub', made['sub'], 4), ('title', made['title'], 4)):
        gifs = [g for g in gifs if os.path.exists(g)]
        if len(gifs) >= 2: g = os.path.join(out_dir, f'overview-{"subtitles" if kind == "sub" else "titles"}.gif'); _grid(gifs, g, cols, 240); X.log(f'✓ {os.path.relpath(g, X.SKILL)} · {os.path.getsize(g) / 1e6:.1f} MB')
