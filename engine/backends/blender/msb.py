"""mega-shot · library that runs INSIDE Blender (bpy). Loaded by `xp blender` together with the scene script.

A scene script (e.g. videos/<name>/canh/mo_dau.py) defines:
    def build(ms, ctx):   build the scene once (ctx: W, H, fps, t0, t1, data from video.yaml)
    def animate(ms, ctx, t, lt):  set state over time (camera, objects…). Deterministic.
msb handles: render setup (Cycles/EEVEE, GPU, denoising), HDRI + sun, Poly Haven PBR materials, glTF import, rendering each frame → PNG.
"""
import bpy, math, os, sys, json, time
from mathutils import Vector, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from msb_lib import Kit, srgb          # 3D workshop: materials / soft forms / lights / camera / style packs (references/blender/)

class MS(Kit):
    def __init__(self, root, ctx):
        self.root = root; self.ctx = ctx; self.assets = os.path.join(root, '.mega-shot', 'assets')

    # ---------------- scene, render ----------------
    def reset(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = self.ctx['W'], self.ctx['H']; sc.render.resolution_percentage = 100
        sc.render.fps = self.ctx['fps']; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
        sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
        return sc

    def setup_render(self, quality='chuan'):
        sc = bpy.context.scene
        if quality == 'nhap':
            sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
            try: sc.eevee.taa_render_samples = 32; sc.eevee.use_shadows = True; sc.eevee.use_raytracing = True
            except Exception: pass
            return
        sc.render.engine = 'CYCLES'; cy = sc.cycles
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for dev_type in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
            try:
                prefs.compute_device_type = dev_type; prefs.get_devices()
                if any(d.type == dev_type for d in prefs.devices):
                    for d in prefs.devices: d.use = d.type == dev_type
                    cy.device = 'GPU'; print('[msb] GPU:', dev_type, [d.name for d in prefs.devices if d.use]); break
            except Exception: continue
        cy.samples = self.ctx.get('samples', 96); cy.use_adaptive_sampling = True; cy.adaptive_threshold = .02
        cy.use_denoising = True
        try: cy.denoiser = 'OPTIX' if prefs.compute_device_type == 'OPTIX' else 'OPENIMAGEDENOISE'
        except Exception: pass
        cy.max_bounces = 6; cy.caustics_reflective = cy.caustics_refractive = False
        sc.render.use_persistent_data = True                 # keep the BVH between frames → much faster

    # ---------------- world: HDRI + sun ----------------
    def hdri(self, rel, strength=1.0, rotation=0.0, bg_strength=None, sun_azimuth=None):
        """sun_azimuth (degrees, 0 = +X/east, 90 = +Y/north): rotates the HDRI automatically so the sun sits in that direction."""
        w = bpy.data.worlds.new('MS_World'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(self.assets, rel), check_existing=True)
        # find the sun in the image: brightest pixel (sparse sampling). Blender: u = atan2(y,-x)/2π + .5, row 0 at the bottom
        img = env.image; px = img.pixels[:]; W, H = img.size; best, bi = -1, 0
        for i in range(0, W * H, 5):
            L = px[i * 4] * .2126 + px[i * 4 + 1] * .7152 + px[i * 4 + 2] * .0722
            if L > best: best, bi = L, i
        u, v = (bi % W) / W, (bi // W) / H; lon = (u - .5) * 2 * math.pi; lat = (v - .5) * math.pi
        az_img = math.atan2(math.sin(lon), -math.cos(lon))            # sun direction in the image (world azimuth before rotation)
        if sun_azimuth is not None: rotation = az_img - math.radians(sun_azimuth)
        mp.inputs['Rotation'].default_value[2] = rotation               # lookup uses R(rot)·d → the sun appears at azimuth az_img - rot
        az = az_img - rotation
        self.sun_dir = Vector((math.cos(lat) * math.cos(az), math.cos(lat) * math.sin(az), math.sin(lat))).normalized()
        print(f'[msb] sun: azimuth {math.degrees(az) % 360:.0f}°, elevation {math.degrees(lat):.1f}°', flush=True)
        bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength; out = nt.nodes.new('ShaderNodeOutputWorld')
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector']); nt.links.new(env.outputs['Color'], bg.inputs['Color'])
        if bg_strength is not None:      # visible background differs from the lighting strength
            lp = nt.nodes.new('ShaderNodeLightPath'); bg2 = nt.nodes.new('ShaderNodeBackground'); bg2.inputs['Strength'].default_value = bg_strength; mx = nt.nodes.new('ShaderNodeMixShader')
            nt.links.new(env.outputs['Color'], bg2.inputs['Color']); nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac']); nt.links.new(bg.outputs['Background'], mx.inputs[1]); nt.links.new(bg2.outputs['Background'], mx.inputs[2]); nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
        else: nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
        return self.sun_dir

    def sun(self, strength=4.0, color=(1, .86, .7), angle_deg=1.2, elevation=None):
        """Direct sunlight along the HDRI's sun direction; elevation (degrees) raises the sun angle alone while keeping the sky colour."""
        d = bpy.data.lights.new('MS_Sun', 'SUN'); d.energy = strength; d.color = color; d.angle = math.radians(angle_deg)
        o = bpy.data.objects.new('MS_Sun', d); bpy.context.collection.objects.link(o); v = self.sun_dir.copy()
        if elevation is not None: az = math.atan2(v.y, v.x); e = math.radians(elevation); v = Vector((math.cos(e) * math.cos(az), math.cos(e) * math.sin(az), math.sin(e)))
        o.rotation_euler = v.to_track_quat('Z', 'Y').to_euler(); return o

    # ---------------- Poly Haven PBR materials ----------------
    def pbr(self, pid, res='2k', scale=1.0, tint=(1, 1, 1, 1), disp=0.0, rough_mul=1.0, name=None, macro=0.0, macro_scale=.004):
        """macro>0: multiply colour by large-scale noise (world coordinates) to break the tiling of the texture when seen from afar."""
        d = os.path.join(self.assets, 'polyhaven', pid); m = bpy.data.materials.new(name or pid); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links
        bsdf = N['Principled BSDF']; tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale)
        Lk.new(tc.outputs['UV'], mp.inputs['Vector'])
        def tex(kind, srgb):
            f = os.path.join(d, f'{pid}_{kind}_{res}.jpg')
            if not os.path.exists(f): return None
            t = N.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(f, check_existing=True); t.image.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'; Lk.new(mp.outputs['Vector'], t.inputs['Vector']); return t
        c = tex('diff', True); r = tex('rough', False); n = tex('nor_gl', False); dp = tex('disp', False) if disp else None
        if c:
            mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
            Lk.new(c.outputs['Color'], mul.inputs['A']); mul.inputs['B'].default_value = tint; col_out = mul.outputs['Result']
            if macro:
                nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = macro_scale * 100; nz.inputs['Detail'].default_value = 4
                Lk.new(tc.outputs['Object'], nz.inputs['Vector']); mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 1 - macro; mr.inputs['To Max'].default_value = 1 + macro * .4
                Lk.new(nz.outputs['Fac'], mr.inputs['Value']); m2 = N.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1
                Lk.new(col_out, m2.inputs['A']); Lk.new(mr.outputs['Result'], m2.inputs['B']); col_out = m2.outputs['Result']
            Lk.new(col_out, bsdf.inputs['Base Color'])
        if r:
            mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; mm.inputs[1].default_value = rough_mul; Lk.new(r.outputs['Color'], mm.inputs[0]); Lk.new(mm.outputs['Value'], bsdf.inputs['Roughness'])
        if n: nm = N.new('ShaderNodeNormalMap'); Lk.new(n.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        if dp:
            dn = N.new('ShaderNodeDisplacement'); dn.inputs['Scale'].default_value = disp; Lk.new(dp.outputs['Color'], dn.inputs['Height']); Lk.new(dn.outputs['Displacement'], N['Material Output'].inputs['Displacement'])
            try: m.displacement_method = 'BOTH'
            except Exception: m.cycles.displacement_method = 'BOTH'
        return m

    # ---------------- geometry, models ----------------
    def box(self, name, size, loc, mat=None, bevel=0.0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = size
        bpy.ops.object.transform_apply(scale=True)
        if bevel: md = o.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = 2
        self.cube_uv(o)
        if mat: o.data.materials.append(mat)
        return o
    def cube_uv(self, o, size=1.0):
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.cube_project(cube_size=size); bpy.ops.object.mode_set(mode='OBJECT')
    def plane(self, name, size, subdiv=0, mat=None):
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=max(subdiv, 1), y_subdivisions=max(subdiv, 1), size=size); o = bpy.context.active_object; o.name = name
        if mat: o.data.materials.append(mat)
        return o
    def gltf(self, rel, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(self.assets, rel)); new = [o for o in bpy.data.objects if o not in before]
        roots = [o for o in new if o.parent is None]
        for r in roots: r.location = loc; r.rotation_euler = rot; r.scale = (scale, scale, scale)
        return roots

    def camera(self, lens=35, sensor=36, dof_focus=None, fstop=4.0):
        c = bpy.data.cameras.new('MS_Cam'); c.lens = lens; c.sensor_width = sensor; c.clip_start = .1; c.clip_end = 20000; o = bpy.data.objects.new('MS_Cam', c); bpy.context.collection.objects.link(o); bpy.context.scene.camera = o
        if dof_focus: c.dof.use_dof = True; c.dof.focus_distance = dof_focus; c.dof.aperture_fstop = fstop
        return o
    @staticmethod
    def look(cam, pos, target, roll=0.0):
        cam.location = pos; d = Vector(target) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.rotation_euler.rotate_axis('Z', roll)

    def mist(self, start=20, depth=600, density=.002, color=(.85, .7, .55)):
        """Atmospheric fog via a world volume (simple, cheap)."""
        w = bpy.context.scene.world; nt = w.node_tree; vs = nt.nodes.new('ShaderNodeVolumePrincipled'); vs.inputs['Density'].default_value = density; vs.inputs['Color'].default_value = (*color, 1)
        nt.links.new(vs.outputs['Volume'], nt.nodes['World Output'].inputs['Volume'])


def ease(t): t = max(0, min(1, t)); return .5 - .5 * math.cos(math.pi * t)
def lerp(a, b, t): return a + (b - a) * t
def vlerp(a, b, t): return Vector(a).lerp(Vector(b), t)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]; cfg = json.loads(open(argv[0], encoding='utf-8').read())
    sys.path.insert(0, os.path.dirname(cfg['script'])); sys.modules['msb'] = sys.modules[__name__]   # lets scene scripts `import msb`
    import importlib.util
    spec = importlib.util.spec_from_file_location('canh', cfg['script']); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    ms = MS(cfg['root'], cfg); ms.reset(); ms.setup_render(cfg.get('quality', 'chuan'))
    mod.build(ms, cfg)
    if cfg.get('anh'):                                                 # still image mode (xp 3d)
        ms.chup(cfg['anh']); print('[msb] xong', flush=True); return
    sc = bpy.context.scene; fps = cfg['fps']; n = cfg['frames']; out = cfg['out']; os.makedirs(out, exist_ok=True); t_start = time.time()
    for f in range(cfg.get('from', 0), n):
        p = os.path.join(out, f'{f:05d}.png')
        if os.path.exists(p) and not cfg.get('force'): continue      # resumable if interrupted midway
        lt = f / fps; mod.animate(ms, cfg, cfg['t0'] + lt, lt)
        if f == cfg.get('from', 0):
            cam = sc.camera; fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
            print(f'[msb] {len(bpy.data.objects)} objects · camera {tuple(round(v) for v in cam.location)} looking at {tuple(round(v, 2) for v in fwd)}', flush=True)
        sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        el = time.time() - t_start; print(f'[msb] khung {f + 1}/{n} · {el:.0f}s', flush=True)
    print('[msb] xong', flush=True)

if __name__ == '__main__': main()
