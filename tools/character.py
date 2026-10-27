"""mega-shot · `xp character` — code-drawn cartoon characters (engine/core/puppet.js).

  xp character demo                 render preview GIFs → references/characters/ (talking emperor + expression line-up)
  xp character demo --still 2.5     one PNG frame of each demo at t = 2.5 s (fast visual check)
  xp character styles [--still 2]   the five drawing styles (kawaii, flat, paper, pixel, watercolor) → references/characters/style-*.gif

Characters are data specs (head, skin, hair, beard, hat, outfit, colours, proportions). To build one from a reference
image the user provides, see references/characters.md.
"""
import base64, functools, http.server, os, shutil, tempfile, threading

def main(a, X):
    from playwright.sync_api import sync_playwright
    import textstyles
    eng = os.path.join(X.SKILL, 'engine', 'core'); out_dir = os.path.join(X.SKILL, 'references', 'characters'); os.makedirs(out_dir, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *x: None}), directory=eng))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']); pg = b.new_page(viewport={'width': 1080, 'height': 1920})
        pg.on('pageerror', lambda e: X.log(f'⚠ page error: {e}'))
        styles = a.action in ('styles', 'critters'); crit = a.action == 'critters'
        if styles: pg.set_viewport_size({'width': 1280, 'height': 720})
        pg.goto(f'http://127.0.0.1:{srv.server_port}/' + (('critters_demo.html' if crit else 'puppet_styles.html') if styles else 'puppet_demo.html')); pg.wait_for_function('window.draw && window.MS && (MS.puppet || MS.critters)')
        dur = pg.evaluate('DUR')
        for kind in ((('mochi', 'bao', 'tuck', 'fizz', 'hop', 'lineup') if crit else ('mochi', 'pip', 'coco', 'bo', 'lua', 'lineup')) if styles else ('talk', 'lineup')):
            if a.still is not None:
                p = os.path.join(out_dir, f'still-{kind}.png' if not styles else (f'critter-{kind}.png' if crit else f'style-{kind}.png')); open(p, 'wb').write(base64.b64decode(pg.evaluate(f'draw({kind!r}, {a.still})').split(',', 1)[1])); X.log(f'✓ {p}'); continue
            tmp = tempfile.mkdtemp(prefix='pup-'); n = int(dur[kind] * a.fps)
            for k in range(n): open(os.path.join(tmp, f'{k:04d}.jpg'), 'wb').write(base64.b64decode(pg.evaluate(f'draw({kind!r}, {k / a.fps})').split(',', 1)[1]))
            gif = os.path.join(out_dir, ((f'critter-{kind}.gif' if kind != 'lineup' else 'critters-lineup.gif') if crit else (f'style-{kind}.gif' if kind != 'lineup' else 'styles-lineup.gif')) if styles else f'demo-{kind}.gif'); textstyles._gif(tmp, gif, a.fps, a.width); shutil.rmtree(tmp, ignore_errors=True)
            X.log(f'✓ {os.path.relpath(gif, X.SKILL)} · {os.path.getsize(gif) / 1e6:.1f} MB')
        b.close()
    srv.shutdown()

