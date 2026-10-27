"""Blender scene template: sunset HDRI, sandy ground, rock, slowly dollying camera. Render: xp blender <scene-id> [--chi 0 | --nhap]."""
import math
import msb

def build(ms, ctx):
    ms.hdri('polyhaven/syferfontein_1d_clear_puresky/syferfontein_1d_clear_puresky_4k.hdr', sun_azimuth=150)
    ms.sun(strength=4, elevation=10)
    sand = ms.pbr('sand_01', scale=60, macro=.4); stone = ms.pbr('large_sandstone_blocks', scale=.5)
    ms.plane('Dat', 600, subdiv=4, mat=sand)
    ms.box('Khoi', (3, 3, 2), (0, 0, 1), stone, bevel=.05)
    ms.cam = ms.camera(lens=40, dof_focus=9, fstop=2.8)

def animate(ms, ctx, t, lt):
    D = ctx['t1'] - ctx['t0']; u = msb.ease(lt / D)
    ms.look(ms.cam, msb.vlerp((9, -6, 2.2), (6, -9, 1.6), u), (0, 0, 1))
