import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *

N = "Hero"
delete_hierarchy(N)
R = empty(N)

# palette (from ref)
skin = mat("M_Skin", "#f2d2bd", rough=0.8)
eye = mat("M_EyeBlack", "#101018", rough=0.3)
eyeG = mat("M_EyeGlint", "#ffffff", emit="#ffffff", emit_strength=1.0)
hair = mat("M_HairWhite", "#e6e1f0", rough=0.7)
hairS = mat("M_HairShade", "#b9b2cf", rough=0.7)
red = mat("M_ScarfRed", "#d0202a", rough=0.8)
redD = mat("M_ScarfRedDark", "#9a1420", rough=0.8)
coat = mat("M_CoatNavy", "#2a3042", rough=0.8)
coatD = mat("M_CoatDark", "#1c2030", rough=0.8)
plate = mat("M_PlateWhite", "#c9cbd6", rough=0.45, metal=0.3)
leather = mat("M_Leather", "#7a4a2a", rough=0.8)
leatherD = mat("M_LeatherDark", "#4f2f1b", rough=0.8)
silver = mat("M_Silver", "#d7d9e0", rough=0.3, metal=0.8)
glove = mat("M_Glove", "#2f3340", rough=0.7)

HIP = 0.36
NECK = 0.63

# ---------- legs ----------
def leg(side):
    s = 1 if side == 'L' else -1
    x = 0.085 * s
    objs = [
        cyl(f"_thigh{side}", 0.068, 0.2, (x, 0, HIP - 0.1), coat, verts=8),
        cyl(f"_cuff{side}", 0.074, 0.04, (x, 0, 0.13), plate, verts=8),
        box(f"_boot{side}", (0.13, 0.19, 0.11), (x, -0.025, 0.055), leather, bevel=0.03, seg=2),
        box(f"_bootTop{side}", (0.14, 0.15, 0.035), (x, -0.0, 0.11), leatherD, bevel=0.01),
        box(f"_sole{side}", (0.135, 0.2, 0.02), (x, -0.028, 0.01), leatherD, bevel=0.005),
    ]
    return part(f"{N}_Leg{side}", objs, (x, 0, HIP - 0.01), R)

legL = leg('L'); legR = leg('R')

# ---------- body (torso + belt + pouches) ----------
body_objs = [
    box("_torso", (0.3, 0.2, 0.26), (0, 0, 0.5), coat, bevel=0.05, seg=2, taper=(1.08, 1.0)),
    box("_hips", (0.28, 0.19, 0.08), (0, 0, 0.38), coatD, bevel=0.03, seg=1),
    box("_belt", (0.31, 0.21, 0.045), (0, 0, 0.405), leather, bevel=0.012),
    box("_buckle", (0.075, 0.02, 0.05), (0, -0.108, 0.405), silver, bevel=0.008),
    box("_buckleIn", (0.04, 0.022, 0.025), (0, -0.11, 0.405), leatherD),
    box("_pouchL", (0.075, 0.06, 0.075), (0.115, -0.1, 0.375), leather, bevel=0.015),
    box("_pouchR", (0.075, 0.06, 0.075), (-0.12, -0.095, 0.37), leather, bevel=0.015),
    box("_pouchBack", (0.09, 0.05, 0.07), (0.06, 0.11, 0.38), leather, bevel=0.015),
    # cross strap
    box("_strap", (0.04, 0.215, 0.3), (0.0, 0, 0.51), leatherD, rot=(0, math.radians(38), 0)),
    box("_strapBuckle", (0.04, 0.02, 0.035), (0.03, -0.11, 0.53), silver, rot=(0, math.radians(38), 0)),
    # collar plates
    box("_chestPlate", (0.12, 0.03, 0.09), (0.0, -0.1, 0.56), coatD, bevel=0.01),
]
body = part(f"{N}_Body", body_objs, (0, 0, HIP), R)

# ---------- head ----------
H = NECK + 0.27  # head center
head_objs = [
    sph("_head", 0.255, (0, 0, H), skin, scale=(1.0, 0.95, 0.95), seg=14, rings=10),
    # big black eyes (chibi)
    sph("_eyeL", 0.055, (0.085, -0.215, H - 0.035), eye, scale=(0.8, 0.45, 1.15), seg=10, rings=6),
    sph("_eyeR", 0.055, (-0.085, -0.215, H - 0.035), eye, scale=(0.8, 0.45, 1.15), seg=10, rings=6),
    sph("_glintL", 0.013, (0.07, -0.24, H - 0.005), eyeG, seg=6, rings=4),
    sph("_glintR", 0.013, (-0.1, -0.24, H - 0.005), eyeG, seg=6, rings=4),
    # hair cap
    sph("_hairCap", 0.268, (0, 0.025, H + 0.04), hair, scale=(1.04, 1.02, 0.9), seg=14, rings=8),
]
from mathutils import Vector

def spike(name, base, direction, L, r, m, flat=1.0):
    d = Vector(direction).normalized()
    c = cone(name, r, L, (0, 0, 0), m, verts=5, scale=(1.0, flat, 1.0))
    q = d.to_track_quat('Z', 'Y')
    c.rotation_mode = 'QUATERNION'
    c.rotation_quaternion = q
    c.location = Vector(base) + d * (L * 0.5)
    return c

C = Vector((0, 0.02, H + 0.04))
sweep = Vector((0, 0.55, 0.35))  # hair swept back & up
i = 0
# spherical layout: (elevation deg, azimuth deg, length, radius)  azimuth 0 = front(-Y)
layout = [
    (80, 0, 0.26, 0.11),
    (55, 20, 0.25, 0.1), (55, -20, 0.25, 0.1), (55, 70, 0.26, 0.1), (55, -70, 0.26, 0.1),
    (55, 120, 0.26, 0.1), (55, -120, 0.26, 0.1), (55, 180, 0.27, 0.1),
    (25, 60, 0.22, 0.095), (25, -60, 0.22, 0.095), (25, 105, 0.24, 0.1), (25, -105, 0.24, 0.1),
    (25, 150, 0.24, 0.1), (25, -150, 0.24, 0.1), (20, 180, 0.24, 0.1),
    (-5, 85, 0.2, 0.085), (-5, -85, 0.2, 0.085), (-10, 130, 0.22, 0.09), (-10, -130, 0.22, 0.09),
    (-15, 170, 0.2, 0.09), (-15, -170, 0.2, 0.09),
]
for (el, az, L, r) in layout:
    e = math.radians(el); a = math.radians(az)
    n = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    d = (n + sweep * 0.9).normalized() if az not in (0,) else (n + Vector((0, 0.3, 0.2))).normalized()
    if abs(az) > 90:
        d = (n + Vector((0, 0.35, -0.15))).normalized()
    base = C + n * 0.2
    head_objs.append(spike(f"_spk{i}", base, d, L, r, hair if i % 4 else hairS)); i += 1
# fringe over forehead – chunky shards hanging down over the eyes (side-swept)
for j, (x, z, dx, L) in enumerate([(0.0, 0.1, 0.25, 0.2), (0.11, 0.09, 0.35, 0.18), (-0.11, 0.1, 0.15, 0.19),
                                    (0.19, 0.04, 0.4, 0.17), (-0.19, 0.05, -0.1, 0.16), (0.05, 0.12, 0.3, 0.17)]):
    base = Vector((x, -0.2, H + z))
    d = Vector((dx, -0.35, -1.0))
    head_objs.append(spike(f"_bang{j}", base, d, L, 0.075, hair if j % 2 else hairS, flat=0.5))
head = part(f"{N}_Head", head_objs, (0, 0, NECK), body)

# ---------- scarf (on body) ----------
scarf_objs = [
    torus("_scarfRing", 0.13, 0.06, (0, 0, NECK + 0.01), red, seg=12, mseg=6, scale=(1.0, 0.95, 1.0)),
    box("_scarfKnot", (0.09, 0.06, 0.07), (0.07, -0.13, NECK - 0.04), redD, bevel=0.02),
]
scarf = part(f"{N}_Scarf", scarf_objs, (0, 0, NECK), body)

# ---------- cape (pivot at upper back) ----------
cape_pts = [(-0.17, 0.0), (0.17, 0.0), (0.24, -0.38), (0.12, -0.33), (0.04, -0.42), (-0.06, -0.34), (-0.16, -0.41), (-0.24, -0.36)]
cape = poly_extrude("_cape", cape_pts, 0.025, (0, 0.13, NECK - 0.02), red, plane='XZ', bevel=0.0,
                    rot=(math.radians(16), 0, 0))
cape2 = box("_scarfTail", (0.09, 0.03, 0.22), (0.05, 0.145, NECK - 0.13), redD, rot=(math.radians(-8), 0, math.radians(6)), taper=(1.3, 1.0))
cape = part(f"{N}_Cape", [cape, cape2], (0, 0.13, NECK - 0.02), body)

# ---------- arms ----------
def arm(side):
    s = 1 if side == 'L' else -1
    sx = 0.19 * s
    objs = [
        sph(f"_pad{side}", 0.075, (sx + 0.01 * s, 0, NECK - 0.07), plate, scale=(1.1, 1.0, 0.8), seg=8, rings=5),
        cyl(f"_upper{side}", 0.045, 0.13, (sx + 0.02 * s, 0, NECK - 0.15), coat, verts=8),
        cyl(f"_bracer{side}", 0.055, 0.07, (sx + 0.025 * s, 0, NECK - 0.24), glove, verts=8),
        box(f"_bracerBand{side}", (0.115, 0.115, 0.02), (sx + 0.025 * s, 0, NECK - 0.21), leatherD),
        sph(f"_hand{side}", 0.055, (sx + 0.03 * s, 0, NECK - 0.31), glove, seg=8, rings=6),
    ]
    a = part(f"{N}_Arm{side}", objs, (sx, 0, NECK - 0.06), body)
    hand = empty(f"{N}_Hand{side}", (sx + 0.03 * s, -0.01, NECK - 0.31), 0.05)
    parent(hand, a)
    return a

armL = arm('L'); armR = arm('R')

print("Hero tris:", tris(N))
