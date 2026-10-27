"""mega-shot · fix a wrongly coloured region in a generated model's colour texture (e.g. Tripo painting a brown muzzle red).

  blender -b --factory-startup --python retint_glb.py -- in.glb out.glb '<json region>'
region json: {"box": [xmin, xmax, ymin, ymax, zmin, zmax], "match": "red", "hue": .06, "sat": .55, "val": .55}
Every texel inside a UV triangle whose 3D face lies in the box AND matches the source colour gets its hue/saturation set and
its value scaled — shading detail (wrinkles, AO baked in the texture) is preserved. Writes a new GLB with the edited texture.
"""
import bpy, sys, json, colorsys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst, R = a[0], a[1], json.loads(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
o = [x for x in bpy.context.scene.objects if x.type == 'MESH'][0]; me = o.data
img = [i for i in bpy.data.images if i.name.lower().startswith(('color', 'basecolor', 'base_color', 'texture_diffuse', 'diffuse'))][0]
W, H = img.size; px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
x0, x1, y0, y1, z0, z1 = R['box']; uv = me.uv_layers.active.data
def match(c): r, g, b = c[..., 0], c[..., 1], c[..., 2]; return (r > .3) & (r > g * 1.8) & (r > b * 1.8) if R.get('match', 'red') == 'red' else np.ones(r.shape, bool)
mask = np.zeros((H, W), bool); n = 0
for p in me.polygons:
    c = p.center
    if not (x0 <= c.x <= x1 and y0 <= c.y <= y1 and z0 <= c.z <= z1): continue
    L = list(p.loop_indices)
    for k in range(1, len(L) - 1):                                                # fan-triangulate, rasterise in UV space
        T = np.array([uv[L[0]].uv[:], uv[L[k]].uv[:], uv[L[k + 1]].uv[:]]) * [W, H]
        mn = np.floor(T.min(0)).astype(int); mx = np.ceil(T.max(0)).astype(int)
        mn = np.clip(mn, 0, [W - 1, H - 1]); mx = np.clip(mx, 0, [W - 1, H - 1])
        xs, ys = np.meshgrid(np.arange(mn[0], mx[0] + 1), np.arange(mn[1], mx[1] + 1)); P = np.stack([xs + .5, ys + .5], -1)
        v0, v1, v2 = T[1] - T[0], T[2] - T[0], P - T[0]; d = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(d) < 1e-9: continue
        l1 = (v2[..., 0] * v1[1] - v1[0] * v2[..., 1]) / d; l2 = (v0[0] * v2[..., 1] - v2[..., 0] * v0[1]) / d
        ins = (l1 >= -.02) & (l2 >= -.02) & (l1 + l2 <= 1.02); mask[ys[ins], xs[ins]] = True; n += 1
sel = mask & match(px)
# dilate a little so texture-filter fringes are recoloured too
from numpy.lib.stride_tricks import sliding_window_view as swv
pad = np.pad(sel, 2); sel = swv(pad, (5, 5)).any(axis=(-1, -2)) & match(px) | sel
c = px[sel][:, :3]; hsv = np.array([colorsys.rgb_to_hsv(*q) for q in c])
out = np.array([colorsys.hsv_to_rgb(R.get('hue', .06), R.get('sat', .55), v * R.get('val', .55)) for v in hsv[:, 2]], dtype=np.float32)
px[sel, :3] = out; img.pixels[:] = px.ravel(); img.update(); img.pack()
print('RETINT faces', n, 'texels', int(sel.sum()))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB')
