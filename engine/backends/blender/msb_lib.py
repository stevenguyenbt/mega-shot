"""mega-shot · msb_lib — 3D WORKSHOP: shared Blender scene-building recipes for EVERY kind of scene (characters, props, environments, architecture, products…).
Collected from the guides in references/blender/ (blender-skills, MIT): proportion → blockout → soft forms (subdivision + bevel stack) → lookdev
(material recipes) → three-point / sky lighting → camera + DOF → style pack → render. Attached to msb.MS (ms.vl, ms.khoi, ms.den_3_diem, …).

  ms.phong_cach('do-choi'|'anime-cel'|'low-poly'|'dat-set'|'noir'|'kien-truc'|'kinh-di'|'tu-nhien')   style pack: engine, colour, lights, camera
  ms.vl(kind, color, **kw)   material: da vinyl nhua su vai len kim-loai kinh nuoc go be-tong gach phat-sang toon dat-set mo
  ms.khoi(kind, loc, size, mat, mem=2, rot=…)   shape: cau hop tru nang xuyen non   (mem = subdivision level for soft shapes)
  ms.blob(name, [(kind, loc, r, size)], mat)   seamless organic form (metaball → smooth mesh, correct size)
  ms.ong(points, r, mat) · ms.chu(text, …) · ms.rai(obj, n, (x0,x1,y0,y1), seed, scale, z) · ms.low_poly(o, ratio)
  ms.den_3_diem(target, key=…, mau=…) · ms.bau_troi(cao, phuong_vi) · ms.nen(color) · ms.may(target, dist, az, el, lens, fstop)
  ms.chup(path)   render a single image
"""
import bpy, bmesh, math, random
from mathutils import Vector, Euler

def srgb(h):
    if not isinstance(h, str): return tuple(h[:3])
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in c)

class Kit:
    style = 'tu-nhien'
    # ================= materials (lookdev recipes) =================
    def vl(self, kind, color='#cccccc', name=None, rough=None, **kw):
        c = srgb(color); m = bpy.data.materials.new(name or f'{kind}_{color}'); m.use_nodes = True; nt = m.node_tree; N, Lk = nt.nodes, nt.links; b = N['Principled BSDF']
        b.inputs['Base Color'].default_value = (*c, 1); I = b.inputs
        def bump(tex, strength, scale, **p):
            t = N.new(tex); t.inputs['Scale'].default_value = scale
            for k, v in p.items():
                try: setattr(t, k, v)
                except Exception: t.inputs[k].default_value = v
            bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; Lk.new(t.outputs[0 if tex != 'ShaderNodeTexWave' else 'Fac'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], I['Normal']); return t
        def sss(w, rad=(1, .45, .3), sc=.05): I['Subsurface Weight'].default_value = w; I['Subsurface Radius'].default_value = rad; I['Subsurface Scale'].default_value = sc
        R = lambda v: I['Roughness'].__setattr__('default_value', rough if rough is not None else v)
        if kind == 'da': R(.42); sss(.4); I['Coat Weight'].default_value = .12
        elif kind == 'vinyl': R(.36); sss(.15, sc=.02); I['Coat Weight'].default_value = .25; I['Coat Roughness'].default_value = .3
        elif kind == 'nhua': R(.25); I['Coat Weight'].default_value = .4
        elif kind == 'su': R(.12); I['Coat Weight'].default_value = .7; I['Coat Roughness'].default_value = .05
        elif kind == 'vai': R(.82); I['Sheen Weight'].default_value = .4; bump('ShaderNodeTexNoise', .06, kw.get('scale', 180))
        elif kind == 'len': R(.7); I['Sheen Weight'].default_value = .3; bump('ShaderNodeTexWave', .4, kw.get('scale', 60), wave_type='BANDS', bands_direction='Z')
        elif kind == 'kim-loai': R(.25); I['Metallic'].default_value = 1; (kw.get('xuoc') and bump('ShaderNodeTexNoise', .05, 400))
        elif kind == 'kinh': R(.02); I['Transmission Weight'].default_value = 1; I['IOR'].default_value = 1.45
        elif kind == 'nuoc': R(.03); I['Transmission Weight'].default_value = .95; I['IOR'].default_value = 1.33; bump('ShaderNodeTexNoise', .15, 8)
        elif kind == 'go':
            R(.5); w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = kw.get('scale', 6); w.inputs['Distortion'].default_value = 6; r = N.new('ShaderNodeValToRGB')
            r.color_ramp.elements[0].color = (*[v * .55 for v in c], 1); r.color_ramp.elements[1].color = (*c, 1); Lk.new(w.outputs['Fac'], r.inputs['Fac']); Lk.new(r.outputs['Color'], I['Base Color'])
        elif kind == 'be-tong': R(.9); bump('ShaderNodeTexNoise', .2, 30)
        elif kind == 'gach':
            R(.4); br = N.new('ShaderNodeTexBrick'); br.offset = kw.get('lech', 0); br.squash = 1; br.inputs['Scale'].default_value = kw.get('scale', 6); br.inputs['Mortar Size'].default_value = kw.get('mach', .025)
            br.inputs['Color1'].default_value = (*c, 1); br.inputs['Color2'].default_value = (*[v * .93 for v in c], 1); br.inputs['Mortar'].default_value = (*srgb(kw.get('mau_mach', '#eeeeee')), 1)
            Lk.new(br.outputs['Color'], I['Base Color']); bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = .3; bp.invert = True; Lk.new(br.outputs['Fac'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], I['Normal'])
        elif kind == 'phat-sang': I['Emission Color'].default_value = (*c, 1); I['Emission Strength'].default_value = kw.get('sang', 8)
        elif kind == 'dat-set': R(.75); sss(.1, sc=.03); bump('ShaderNodeTexNoise', .25, 90); bump('ShaderNodeTexVoronoi', .08, 25)
        elif kind == 'toon':                                                # cel bands (EEVEE: Shader to RGB → constant ramp); Cycles falls back to the flat base
            if self.style == 'anime-cel':
                N.remove(b); d = N.new('ShaderNodeBsdfDiffuse'); d.inputs['Color'].default_value = (*c, 1); s2r = N.new('ShaderNodeShaderToRGB'); r = N.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'
                r.color_ramp.elements[0].position = 0; r.color_ramp.elements[0].color = (*[v * .55 for v in c], 1); r.color_ramp.elements[1].position = kw.get('nguong', .35); r.color_ramp.elements[1].color = (*c, 1)
                e = r.color_ramp.elements.new(.85); e.color = (*[min(1, v * 1.25 + .05) for v in c], 1)
                em = N.new('ShaderNodeEmission'); Lk.new(d.outputs[0], s2r.inputs[0]); bw = N.new('ShaderNodeRGBToBW'); mu = N.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = kw.get('do_sang', .25)
                Lk.new(s2r.outputs['Color'], bw.inputs[0]); Lk.new(bw.outputs[0], mu.inputs[0]); Lk.new(mu.outputs[0], r.inputs['Fac']); Lk.new(r.outputs['Color'], em.inputs['Color']); Lk.new(em.outputs[0], N['Material Output'].inputs['Surface'])
            else: R(.6)
        else: R(.6)                                                         # 'mo' matte
        return m

    # ================= geometry (blockout → soft forms) =================
    def _soft(self, o, mem, bevel=0, flat=False):
        if bevel: b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
        if mem: s = o.modifiers.new('subd', 'SUBSURF'); s.levels = min(mem, 2); s.render_levels = mem
        if o.type == 'MESH':
            for p in o.data.polygons: p.use_smooth = not flat
        return o
    def khoi(self, kind, loc=(0, 0, 0), size=(1, 1, 1), mat=None, mem=2, rot=(0, 0, 0), name=None, bevel=0):
        """size = full dimensions (x, y, z); mem = subdivision level (0 = hard)."""
        sx, sy, sz = size if isinstance(size, (tuple, list)) else (size,) * 3
        if kind == 'cau': bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc); s = (sx / 2, sy / 2, sz / 2); mem = min(mem, 1)
        elif kind == 'hop': bpy.ops.mesh.primitive_cube_add(size=1, location=loc); s = (sx, sy, sz); bevel = bevel or min(sx, sy, sz) * .12
        elif kind == 'tru': bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.5, depth=1, location=loc); s = (sx, sy, sz); bevel = bevel or min(sx, sz) * .1
        elif kind == 'non': bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=.5, depth=1, location=loc); s = (sx, sy, sz)
        elif kind == 'xuyen': bpy.ops.mesh.primitive_torus_add(major_radius=.5, minor_radius=.5 * sz / max(sx, 1e-6), location=loc); s = (sx, sy, sx); mem = min(mem, 1)
        elif kind == 'nang':                                                 # capsule along Z
            o = self.blob(name or 'nang', [('CAPSULE', (0, 0, 0), sx / 2, (max(0, sz / 2 - sx / 2), 0, 0), (0, math.pi / 2, 0))], mat); o.location = loc; o.rotation_euler = rot; return o
        else: raise ValueError(kind)
        o = bpy.context.active_object; o.name = name or kind; o.scale = s; o.rotation_euler = rot; bpy.ops.object.transform_apply(scale=True)
        self._soft(o, mem, bevel if kind in ('hop', 'tru') else 0)
        if mat: o.data.materials.append(mat)
        return o
    def blob(self, name, elems, mat=None, res=.02):
        """organic forms that merge smoothly (bodies, toys, food, rocks). elems: (BALL|ELLIPSOID|CAPSULE, loc, radius, size_xyz|None, rot|None).
        Converted to a mesh so the surface sits exactly where you put it (metaball radius → surface radius corrected)."""
        mb = bpy.data.metaballs.new(name); mb.resolution = res; mb.render_resolution = res * .5; mb.threshold = .6; o = bpy.data.objects.new(name, mb); bpy.context.collection.objects.link(o)
        for e in elems:
            typ, loc, r = e[0], e[1], e[2]; size = e[3] if len(e) > 3 else None; rot = e[4] if len(e) > 4 else None
            el = mb.elements.new(type=typ); el.co = loc; el.radius = r * 1.3; el.stiffness = 2
            if size: el.size_x, el.size_y, el.size_z = size
            if rot: el.rotation = Euler(rot).to_quaternion()
        bpy.context.view_layer.objects.active = o; [x.select_set(False) for x in bpy.context.selected_objects]; o.select_set(True)
        bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object; o.name = name
        # metaball surfaces shrink unevenly → fit the mesh to the bounding box the elements describe, so sizes / joints are exact
        lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
        for e in elems:
            typ, loc, r = e[0], Vector(e[1]), e[2]; sz = Vector(e[3]) if len(e) > 3 and e[3] else Vector((1, 1, 1))
            ext = Vector((r * sz.x, r * sz.y, r * sz.z)) if typ != 'CAPSULE' else Vector((r + (sz.x if len(e) > 3 and e[3] else 0),) * 3)
            lo = Vector(map(min, lo, loc - ext)); hi = Vector(map(max, hi, loc + ext))
        vs = [o.matrix_world @ v.co for v in o.data.vertices]
        if vs:
            alo = Vector(map(min, *vs)) if len(vs) > 1 else vs[0]; ahi = Vector(map(max, *vs)) if len(vs) > 1 else vs[0]
            sc = Vector(((hi - lo)[i] / max(1e-6, (ahi - alo)[i]) for i in range(3))); c_t, c_a = (lo + hi) / 2, (alo + ahi) / 2
            for v in o.data.vertices: w = o.matrix_world @ v.co; v.co = o.matrix_world.inverted() @ (c_t + Vector(((w - c_a)[i] * sc[i] for i in range(3))))
        for p in o.data.polygons: p.use_smooth = True
        sm = o.modifiers.new('mem', 'SMOOTH'); sm.factor = .5; sm.iterations = 4
        if mat: o.data.materials.append(mat)
        return o
    def ong(self, points, r, mat=None, name='ong', caps=True):
        cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 6; cu.use_fill_caps = caps
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
        for p, c in zip(sp.bezier_points, points): p.co = c; p.handle_left_type = p.handle_right_type = 'AUTO'
        o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
        if mat: cu.materials.append(mat)
        return o
    def chu(self, text, loc=(0, 0, 0), size=1, depth=.1, mat=None, rot=(math.pi / 2, 0, 0), font=None):
        cu = bpy.data.curves.new('chu', 'FONT'); cu.body = text; cu.size = size; cu.extrude = depth; cu.bevel_depth = depth * .15; cu.align_x = 'CENTER'
        if font: cu.font = bpy.data.fonts.load(font)
        o = bpy.data.objects.new('chu', cu); bpy.context.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
        if mat: cu.materials.append(mat)
        return o
    def rai(self, obj, n, area, seed=1, scale=(.7, 1.3), z=0.0, xoay=True, tranh=None):
        """scatter linked duplicates over a rectangle (set dressing / vegetation); tranh = (x, y, r) keep-out circle."""
        rnd = random.Random(seed); out = []
        for i in range(n * 3):
            if len(out) >= n: break
            x, y = rnd.uniform(area[0], area[1]), rnd.uniform(area[2], area[3])
            if tranh and (x - tranh[0]) ** 2 + (y - tranh[1]) ** 2 < tranh[2] ** 2: continue
            d = obj.copy(); bpy.context.collection.objects.link(d); d.location = (x, y, z(x, y) if callable(z) else z)
            s = rnd.uniform(*scale); d.scale = (obj.scale[0] * s, obj.scale[1] * s, obj.scale[2] * s)
            if xoay: d.rotation_euler = (obj.rotation_euler[0], obj.rotation_euler[1], rnd.uniform(0, 2 * math.pi))
            out.append(d)
        return out
    def low_poly(self, o, ratio=.25):
        d = o.modifiers.new('lowpoly', 'DECIMATE'); d.ratio = ratio
        for p in o.data.polygons: p.use_smooth = False
        return o

    # ================= lighting =================
    def _area(self, name, loc, target, energy, size, color):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.size = size; L.color = color; o = bpy.data.objects.new(name, L); bpy.context.collection.objects.link(o)
        o.location = loc; o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o
    def den_3_diem(self, target=(0, 0, 0), dist=3.0, key=400, ti_le=None, mau=((1, .88, .74), (.8, .88, 1), (1, .95, .9)), az_key=-45):
        """key 45° above, ~30–45° to the side; fill opposite at 1/3; rim behind for separation (lighting skill)."""
        T = Vector(target); A = math.radians(az_key); ti_le = ti_le or ((.08, .45) if self.style == 'anime-cel' else (.35, .6))   # cel: weak fill keeps the shadow band
        k = self._area('LGT_Key', T + Vector((math.cos(A - math.pi / 2) * dist, math.sin(A - math.pi / 2) * dist, dist * .9)), T, key, dist * .6, mau[0])
        f = self._area('LGT_Fill', T + Vector((math.cos(A + math.pi / 2) * dist, math.sin(A + math.pi / 2) * dist * .6 - dist * .6, dist * .35)), T, key * ti_le[0], dist * .9, mau[1])
        r = self._area('LGT_Rim', T + Vector((math.cos(A) * dist * .6, dist * 1.1, dist * .8)), T, key * ti_le[1], dist * .4, mau[2])
        return k, f, r
    def nen(self, color='#d8cfc4', strength=.4):
        w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (*srgb(color), 1); bg.inputs['Strength'].default_value = strength; return w
    def bau_troi(self, cao=25, phuong_vi=135, strength=1.0, nang=3.0):
        """physical sky + matching sun (archviz / exteriors)."""
        w = bpy.data.worlds.new('sky'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; sky = nt.nodes.new('ShaderNodeTexSky')
        for t in ('NISHITA', 'MULTIPLE_SCATTERING', 'SINGLE_SCATTERING'):
            try: sky.sky_type = t; break
            except Exception: pass
        try: sky.sun_elevation = math.radians(cao); sky.sun_rotation = math.radians(phuong_vi)
        except Exception: pass
        nt.links.new(sky.outputs['Color'], nt.nodes['Background'].inputs['Color']); nt.nodes['Background'].inputs['Strength'].default_value = strength
        s = bpy.data.lights.new('sun', 'SUN'); s.energy = nang; s.angle = math.radians(1.5); s.color = (1, .92, .82); o = bpy.data.objects.new('sun', s); bpy.context.collection.objects.link(o)
        e, a = math.radians(cao), math.radians(phuong_vi); o.rotation_euler = Vector((-math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), -math.sin(e))).to_track_quat('-Z', 'Y').to_euler(); return o
    # ================= camera (camera-cinematography: lens + DOF) =================
    def may(self, target, dist=3.0, az=-50, el=12, lens=50, fstop=None, lech=(0, 0, 0)):
        T = Vector(target); a, e = math.radians(az), math.radians(el); pos = T + Vector((math.sin(a) * math.cos(e) * dist, -math.cos(a) * math.cos(e) * dist, math.sin(e) * dist)) + Vector(lech)
        c = self.camera(lens=lens, dof_focus=(T - pos).length if fstop else None, fstop=fstop or 4); self.look(c, pos, T); return c
    # ================= style packs (style skills → engine / colour / defaults) =================
    def phong_cach(self, name):
        self.style = name; sc = bpy.context.scene
        def look(*names):
            for n in names:
                try: sc.view_settings.look = n; return
                except Exception: pass
        if name in ('anime-cel',):
            eng = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else 'BLENDER_EEVEE'
            sc.view_settings.view_transform = 'Standard'; sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 2.6
            vl = bpy.context.view_layer; vl.use_freestyle = True
            try:
                ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new('lines'); ls.select_by_visibility = True; ls.select_silhouette = ls.select_border = ls.select_crease = True
                ls.linestyle = ls.linestyle or bpy.data.linestyles.new('net'); ls.linestyle.color = (.16, .08, .06); ls.linestyle.thickness = 2.6
            except Exception as e: print('[msb] freestyle:', e)
            try: sc.eevee.taa_render_samples = 32
            except Exception: pass
        elif name == 'noir': sc.view_settings.view_transform = 'AgX'; look('AgX - Greyscale', 'AgX - High Contrast')
        elif name == 'do-choi': sc.view_settings.view_transform = 'AgX'; look('AgX - Punchy', 'AgX - Medium High Contrast')
        elif name == 'kinh-di': sc.view_settings.view_transform = 'AgX'; look('AgX - High Contrast'); sc.view_settings.exposure = -.6
        elif name == 'low-poly': sc.view_settings.view_transform = 'AgX'; look('AgX - Punchy', 'AgX - Base Contrast'); sc.view_settings.exposure = -.4
        else: sc.view_settings.view_transform = 'AgX'; look('AgX - Medium High Contrast')
        return name
    def chup(self, path):
        sc = bpy.context.scene; sc.render.filepath = path; bpy.ops.render.render(write_still=True); print('[msb] image →', path, flush=True); return path
