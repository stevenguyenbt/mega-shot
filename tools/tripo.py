"""mega-shot · Tripo3D API: photos of a character → textured 3D model (GLB with PBR textures).

  python tripo.py balance
  python tripo.py multiview <out_dir> front.png left.png back.png right.png   (any view may be '-' to skip; front required)
  python tripo.py image <out_dir> photo.png                                   (single image)
Key: TRIPO_API_KEY in .mega-shot/keys.env (never printed). Views: "left" = the character's own left side (nose points to the
viewer's left in a side view). Output: <out_dir>/model.glb + task.json. Uses credits on the user's Tripo account.
"""
import json, mimetypes, os, sys, time, urllib.request, uuid

API = 'https://api.tripo3d.ai/v2/openapi'

def key():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keys
    d = os.getcwd()
    while not os.path.isdir(os.path.join(d, '.mega-shot')) and os.path.dirname(d) != d: d = os.path.dirname(d)
    return keys.get(d, 'TRIPO_API_KEY') or sys.exit('TRIPO_API_KEY missing (environment, .env or .mega-shot/keys.env)')

def req(method, path, body=None, files=None):
    h = {'Authorization': 'Bearer ' + key()}
    if files:
        bd = uuid.uuid4().hex; data = b''
        for name, (fn, blob, ct) in files.items():
            data += f'--{bd}\r\nContent-Disposition: form-data; name="{name}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode() + blob + b'\r\n'
        data += f'--{bd}--\r\n'.encode(); h['Content-Type'] = f'multipart/form-data; boundary={bd}'
    elif body is not None: data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    else: data = None
    try: r = urllib.request.urlopen(urllib.request.Request(API + path, data, h, method=method), timeout=120); j = json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f'Tripo HTTP {e.code}: {e.read().decode(errors="replace")[:400]}')
    if j.get('code') != 0: sys.exit(f'Tripo error: {json.dumps(j)[:400]}')
    return j['data']

def upload(path):
    ct = mimetypes.guess_type(path)[0] or 'image/png'
    d = req('POST', '/upload', files={'file': (os.path.basename(path), open(path, 'rb').read(), ct)})
    return {'type': 'png' if ct.endswith('png') else 'jpg', 'file_token': d['image_token']}

def run(task, out):
    os.makedirs(out, exist_ok=True); tid = req('POST', '/task', task)['task_id']; print('task', tid, flush=True)
    while True:
        d = req('GET', f'/task/{tid}'); st = d.get('status'); print(st, d.get('progress'), flush=True)
        if st in ('success', 'failed', 'cancelled', 'banned', 'expired', 'unknown'): break
        time.sleep(6)
    json.dump(d, open(os.path.join(out, 'task.json'), 'w'), indent=1)
    if st != 'success': sys.exit('task ' + st)
    o = d.get('output', {}); url = o.get('pbr_model') or o.get('model') or o.get('base_model')
    dst = os.path.join(out, 'model.glb'); urllib.request.urlretrieve(url, dst)
    if o.get('rendered_image'): urllib.request.urlretrieve(o['rendered_image'], os.path.join(out, 'preview.webp'))
    print('saved', dst, f'{os.path.getsize(dst) / 1e6:.1f} MB')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'balance': print(req('GET', '/user/balance'))
    elif cmd == 'multiview':
        out, views = sys.argv[2], sys.argv[3:7]
        files = [upload(v) if v != '-' else {} for v in views]
        run({'type': 'multiview_to_model', 'files': files, 'texture': True, 'pbr': True, 'texture_quality': 'detailed'}, out)
    elif cmd == 'image':
        run({'type': 'image_to_model', 'file': upload(sys.argv[3]), 'texture': True, 'pbr': True, 'texture_quality': 'detailed'}, sys.argv[2])
