"""mega-shot · normalise an imported character model: face −Y, feet on z = 0, given height, optional decimation → GLB.

  blender -b --factory-startup --python normalize_glb.py -- in.glb out.glb [--height 1.9] [--yaw-deg -90] [--decimate .3]
yaw: rotation about Z applied first (e.g. a model facing +X needs −90). Textures/UVs are kept (decimate collapses edges only).
"""
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
opt = lambda k, d: float(a[a.index(k) + 1]) if k in a else d
H, YAW, DEC = opt('--height', 1.9), opt('--yaw-deg', 0), opt('--decimate', 1.0)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
o = bpy.context.view_layer.objects.active; bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if DEC < 1: m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = DEC; bpy.ops.object.modifier_apply(modifier=m.name)
o.data.transform(Matrix.Rotation(math.radians(YAW), 4, 'Z'))
vs = [v.co for v in o.data.vertices]; zmin = min(v.z for v in vs); zmax = max(v.z for v in vs); cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2; cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
s = H / (zmax - zmin); o.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -zmin)))
for x in list(bpy.context.scene.objects):
    if x != o: bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB')
print('NORMALIZED', len(o.data.vertices), 'verts')
