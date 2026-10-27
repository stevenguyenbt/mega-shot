"""mega-shot · bring a user's 3D character (GLB/glTF/FBX) to life: auto-rig a T-pose chibi biped, idle animation, studio render.

  blender -b --factory-startup --python rig_glb.py -- <model.glb> <out_dir> <landmarks.json> [--frames 72] [--size 900] [--still] [--name cat]

landmarks.json (metres, Z up, character faces −Y; measure once per model — see references/characters.md):
  { "neck_z": .95, "top_z": 1.9, "hip_z": .42, "shoulder": [.24, -.15, .74], "elbow": [.48, -.17, .74], "hand": [.72, -.13, .66],
    "leg_x": .15, "leg_y": -.14, "tail": [[0, .22, .36], [.04, .4, .26], [.12, .52, .17], [.32, .68, .12]], "ear": [.5, -.1, 1.72],
    "arms_down_deg": 62, "bg": "#efe7f6", "cam": [-2.4, -6.2, 2.4], "target_z": .95, "focus": [0, -.6, 1.3] }
Bones: root, spine, head, ear.L/R, arm.L/R + forearm.L/R, leg.L/R, tail.1..n (automatic weights, then each bone is
confined to its own body region so a waving arm never drags the head or belly). Pose = rest (arms lowered from the T-pose)
composed with animation, both written as world-axis rotations converted to bone space. Loop is seamless.
"""
import bpy, json, math, os, sys
from mathutils import Vector, Quaternion, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, LJ = a[0], a[1], a[2]
FR = int(a[a.index('--frames') + 1]) if '--frames' in a else 72
SIZE = int(a[a.index('--size') + 1]) if '--size' in a else 900
NAME = a[a.index('--name') + 1] if '--name' in a else os.path.splitext(os.path.basename(SRC))[0]
STILL = '--still' in a
L = json.load(open(LJ, encoding='utf-8'))
TAU = 2 * math.pi

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, FR; sc.render.fps = 24
sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = sc.render.resolution_y = SIZE
try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
for k, v in (('taa_render_samples', 96), ('use_shadows', True), ('use_raytracing', True), ('use_gtao', True)):
    try: setattr(sc.eevee, k, v)
    except Exception: pass

ext = os.path.splitext(SRC)[1].lower()
if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=SRC)
elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=SRC)
elif ext == '.obj': bpy.ops.wm.obj_import(filepath=SRC)
else: raise SystemExit('unsupported format ' + ext)
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes:                                                                  # bake transforms so weights/regions use world coordinates
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # AI-generated / game exports split the mesh along UV seams; bone-heat weights then differ per island → cracks when bending.
    # Welding coincident vertices keeps the UVs (they live on face corners) and gives one continuous skin.
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=.0008); bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth()

def V(p): return Vector(p)
def mir(p): return Vector((-p[0], p[1], p[2]))
nz, tz, hz = L['neck_z'], L['top_z'], L['hip_z']; sh, el, hd = V(L['shoulder']), V(L['elbow']), V(L['hand'])
bones = [('root', (0, 0, 0), (0, 0, hz * .5), None), ('spine', (0, 0, hz * .5), (0, 0, nz), 'root'), ('head', (0, 0, nz), (0, 0, tz), 'spine')]
if 'ear' in L:
    e = V(L['ear']); bones += [('ear.R', (e.x * .55, e.y, e.z - .12), (e.x, e.y, e.z + .16), 'head'), ('ear.L', (-e.x * .55, e.y, e.z - .12), (-e.x, e.y, e.z + .16), 'head')]
bones += [('arm.R', (sh.x * .45, sh.y, sh.z), tuple(el), 'spine'), ('forearm.R', tuple(el), tuple(hd), 'arm.R'),
          ('arm.L', tuple(mir((sh.x * .45, sh.y, sh.z))), tuple(mir(el)), 'spine'), ('forearm.L', tuple(mir(el)), tuple(mir(hd)), 'arm.L'),
          ('leg.R', (L['leg_x'], L['leg_y'], hz), (L['leg_x'], L['leg_y'], 0), 'root'), ('leg.L', (-L['leg_x'], L['leg_y'], hz), (-L['leg_x'], L['leg_y'], 0), 'root')]
tail = [V(p) for p in L.get('tail', [])]
for i in range(len(tail) - 1): bones.append((f'tail.{i + 1}', tuple(tail[i]), tuple(tail[i + 1]), 'root' if i == 0 else f'tail.{i}'))

ad = bpy.data.armatures.new('rig'); ao = bpy.data.objects.new('rig', ad); sc.collection.objects.link(ao)
for x in bpy.context.selected_objects: x.select_set(False)
ao.select_set(True); bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in bones:
    b = ad.edit_bones.new(n); b.head, b.tail = h, t
    if p: b.parent = ad.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
for m in meshes: m.select_set(True)
bpy.context.view_layer.objects.active = ao
try: bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except Exception as ex: print('auto weights failed → envelope', ex); bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')

# confine each bone's influence to its region (world coords; character faces −Y)
armx = sh.x * .9
afy, lfy = L.get('arm_front_y', 9), L.get('leg_front_y', 9)   # plush/round bodies: limbs only where they stick out in front
ez = L.get('ear', [0, 0, 9])[2]; ex = abs(L.get('ear', [.5])[0]); atop = L.get('arm_top_z', nz - .07)   # arms must stay below the cheeks
REG = {'head': lambda p: p.z > nz - .03, 'ear.R': lambda p: p.z > ez - .1 and p.x > ex * .65, 'ear.L': lambda p: p.z > ez - .1 and p.x < -ex * .65,
       'arm.R': lambda p: p.x > armx and p.z < atop and p.z > hz and p.y < afy, 'forearm.R': lambda p: p.x > el.x - .06 and p.z < atop and p.z > hz and p.y < afy,
       'arm.L': lambda p: p.x < -armx and p.z < atop and p.z > hz and p.y < afy, 'forearm.L': lambda p: p.x < -el.x + .06 and p.z < atop and p.z > hz and p.y < afy,
       'leg.R': lambda p: p.z < hz and p.x > .0 and p.y < min(lfy, tail[0].y if tail else .3), 'leg.L': lambda p: p.z < hz and p.x < .0 and p.y < min(lfy, tail[0].y if tail else .3)}
for i in range(1, len(tail)): REG[f'tail.{i}'] = lambda p, i=i: p.y > tail[0].y - .03 and p.z < nz * .7
for m in meshes:
    fb = m.vertex_groups.get('spine') or m.vertex_groups.new(name='spine')
    for n, test in REG.items():
        vg = m.vertex_groups.get(n)
        if not vg: continue
        drop = [(v.index, g.weight) for v in m.data.vertices for g in v.groups if g.group == vg.index and g.weight > 0 and not test(v.co)]
        for idx, w in drop: vg.remove([idx]); fb.add([idx], w, 'ADD')

for m in meshes:                                                                 # soften the region borders (no creases)
    for x in bpy.context.selected_objects: x.select_set(False)
    m.select_set(True); bpy.context.view_layer.objects.active = m
    try:
        bpy.ops.object.mode_set(mode='WEIGHT_PAINT'); bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=.6, repeat=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception as ex: print('weight smooth skipped', ex); bpy.ops.object.mode_set(mode='OBJECT')
# world-axis rotations → bone-local quaternions
def local(pb, *rots):
    q = Quaternion()
    for axis, ang in rots: q = Quaternion(axis, ang) @ q
    R = pb.bone.matrix_local.to_quaternion(); return R.inverted() @ q @ R
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
down = math.radians(L.get('arms_down_deg', 62))
def sst(e0, e1, u): t = max(0, min(1, (u - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def pose(u):
    P = ao.pose.bones; wave = sst(.28, .38, u) * (1 - sst(.72, .82, u))
    P['root'].location = (0, 0, 0); P['root'].rotation_quaternion = local(P['root'], (Z, .08 * math.sin(TAU * u)))
    P['spine'].rotation_quaternion = local(P['spine'], (Y, .05 * math.sin(TAU * u)), (X, .03 * math.sin(TAU * u * 2)))
    P['spine'].scale = (1 + .015 * math.sin(TAU * u * 2), 1, 1 - .012 * math.sin(TAU * u * 2))
    P['head'].rotation_quaternion = local(P['head'], (Y, -.16 * math.sin(TAU * u + .5)), (X, .07 * math.sin(TAU * u * 2 + 1)), (Z, .1 * math.sin(TAU * u)))
    P['arm.L'].rotation_quaternion = local(P['arm.L'], (Y, -down + .06 * math.sin(TAU * u * 2)))
    P['forearm.L'].rotation_quaternion = local(P['forearm.L'], (Y, -.15))
    # wave beside the cheek (chibi arms are short; a high wave would hide behind the big head): upper arm out + a little forward,
    # forearm folded up, waving side to side
    P['arm.R'].rotation_quaternion = local(P['arm.R'], (Y, down * (1 - wave) - .1 * wave + .06 * math.sin(TAU * u * 2) * (1 - wave)), (Z, -.45 * wave))
    P['forearm.R'].rotation_quaternion = local(P['forearm.R'], (Y, .15 * (1 - wave) - wave * 1.35), (Z, wave * .4 * math.sin(TAU * u * 6)))
    for s in ('L', 'R'):
        if f'ear.{s}' in P: P[f'ear.{s}'].rotation_quaternion = local(P[f'ear.{s}'], (Y, (1 if s == 'R' else -1) * .22 * max(0, math.sin(TAU * (u * 3 + (.3 if s == 'R' else 0)))) ** 6))
    for i in range(1, len(tail)):
        P[f'tail.{i}'].rotation_quaternion = local(P[f'tail.{i}'], (Z, .35 * math.sin(TAU * u * 2 - i * .8)), (X, .12 * math.sin(TAU * u * 2 - i * .8 + 1)))
n = FR // 2
for i in range(n + 1):
    u = i / n; pose(u)
    for pb in ao.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=1 + FR * u); pb.keyframe_insert('location', frame=1 + FR * u); pb.keyframe_insert('scale', frame=1 + FR * u)

# ---------- stage ----------
def hexc(h): h = h.lstrip('#'); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))
bg = hexc(L.get('bg', '#efe7f6')); target = Vector((0, 0, L.get('target_z', tz * .5)))
fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*bg, 1); fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .85
bpy.ops.mesh.primitive_plane_add(size=400); bpy.context.object.data.materials.append(fm)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (*bg, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .85
def area(name, loc, energy, size, colr=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = colr; o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
k = tz / 2.4
area('key', (-4.5 * k, -5 * k, 6.5 * k), 1100 * k * k, 4.5 * k, (1, .95, .88)); area('fill', (5.5 * k, -3.5 * k, 2.8 * k), 320 * k * k, 7 * k, (.82, .88, 1)); area('rim', (2 * k, 5.5 * k, 5 * k), 900 * k * k, 3.5 * k, (1, .9, .95))
cd = bpy.data.cameras.new('cam'); cd.lens = 58; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = V(L.get('cam', (-2.4, -6.2, 2.4))); cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cd.dof.use_dof = True; cd.dof.focus_distance = (V(L.get('focus', (0, -.6, tz * .7))) - cam.location).length; cd.dof.aperture_fstop = 2.4

os.makedirs(OUT, exist_ok=True)
if STILL: sc.frame_set(int(FR * .5)); sc.render.filepath = os.path.join(OUT, f'{NAME}_still.png'); bpy.ops.render.render(write_still=True)
else: sc.render.filepath = os.path.join(OUT, f'{NAME}_'); sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(animation=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f'{NAME}_rigged.blend'))
print('RIG_GLB DONE', NAME)
