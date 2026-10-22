import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *

# Weapons: origin = grip center, blade/shaft along +Z, flat side faces -Y (front)
steel = mat("M_Steel", "#aeb3c2", rough=0.35, metal=0.7)
steelD = mat("M_SteelDark", "#6c7183", rough=0.4, metal=0.6)
gripRed = mat("M_GripRed", "#8e1d22", rough=0.8)
gem = mat("M_GemRed", "#ff2a3a", emit="#ff2030", emit_strength=2.0)
fire = mat("M_FireBlade", "#ff5a1a", emit="#ff4a10", emit_strength=3.0)
fireCore = mat("M_FireCore", "#ffd04a", emit="#ffb020", emit_strength=4.0)
darkRed = mat("M_DarkMetalRed", "#4a1c1c", rough=0.5, metal=0.5)
ice = mat("M_Ice", "#7fd8ff", emit="#4ab8ff", emit_strength=2.0, rough=0.2)
iceDark = mat("M_IceDark", "#2a3c66", rough=0.4, metal=0.5)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
wood = mat("M_WoodDark", "#4a3326", rough=0.8)
violet = mat("M_Lightning", "#9a6bff", emit="#8a5cff", emit_strength=4.0)
blueOrb = mat("M_OrbBlue", "#3a6bff", emit="#4a7cff", emit_strength=4.0)
poison = mat("M_Poison", "#5aff3a", emit="#3aff20", emit_strength=3.0)
poisonD = mat("M_PoisonSteel", "#4a5a52", rough=0.35, metal=0.6)
wrapTeal = mat("M_WrapTeal", "#2e5a6a", rough=0.8)
holyBlue = mat("M_HolyGem", "#5ad0ff", emit="#4ac0ff", emit_strength=3.0)
stone = mat("M_HammerSteel", "#8a8c99", rough=0.4, metal=0.6)

def blade_pts(w, L, tip):
    return [(-w, 0), (w, 0), (w * 0.95, L - tip), (0, L), (-w * 0.95, L - tip)]

def build_sword(N, bladeM, edgeM, gripM, guardM, gemM, L=0.62, w=0.055, flame=False):
    delete_hierarchy(N)
    R = empty(N)
    objs = []
    if flame:
        # jagged flame-like blade
        pts = [(-0.06, 0), (0.06, 0), (0.08, 0.15), (0.05, 0.2), (0.085, 0.32), (0.045, 0.38), (0.07, 0.5),
               (0.0, L + 0.06), (-0.05, 0.48), (-0.075, 0.42), (-0.04, 0.33), (-0.085, 0.24), (-0.05, 0.16)]
        b = poly_extrude("_blade", pts, 0.035, (0, 0, 0.09), bladeM, plane='XZ')
        core = poly_extrude("_core", [(-0.022, 0), (0.022, 0), (0.0, L - 0.08)], 0.04, (0, 0, 0.1), edgeM, plane='XZ')
        objs += [b, core]
    else:
        b = poly_extrude("_blade", blade_pts(w, L, 0.12), 0.03, (0, 0, 0.09), bladeM, plane='XZ')
        fuller = poly_extrude("_fuller", blade_pts(w * 0.28, L - 0.12, 0.06), 0.034, (0, 0, 0.12), edgeM, plane='XZ')
        objs += [b, fuller]
    objs += [
        box("_guard", (0.22, 0.06, 0.05), (0, 0, 0.07), guardM, bevel=0.012, taper=(1.0, 1.0)),
        cone("_guardTipL", 0.03, 0.06, (0.13, 0, 0.075), guardM, verts=4, rot=(0, math.radians(-70), 0)),
        cone("_guardTipR", 0.03, 0.06, (-0.13, 0, 0.075), guardM, verts=4, rot=(0, math.radians(70), 0)),
        sph("_gem", 0.026, (0, -0.033, 0.07), gemM, seg=6, rings=4, smooth=False),
        cyl("_grip", 0.026, 0.16, (0, 0, -0.02), gripM, verts=6),
        box("_wrap1", (0.058, 0.058, 0.015), (0, 0, 0.02), guardM),
        box("_wrap2", (0.058, 0.058, 0.015), (0, 0, -0.05), guardM),
        sph("_pommel", 0.035, (0, 0, -0.11), guardM, seg=6, rings=4, smooth=False),
    ]
    m = part(f"{N}_Mesh", objs, (0, 0, 0), R)
    return R

build_sword("W_Sword", steel, steelD, gripRed, steelD, gem)
build_sword("W_FireSword", fire, fireCore, darkRed, darkRed, gem, flame=True)

# ---- Ice Bow (held at grip, limbs along Z, string toward +Y (back)) ----
N = "W_IceBow"; delete_hierarchy(N); R = empty(N)
objs = [cyl("_gripB", 0.03, 0.14, (0, 0, 0), iceDark, verts=6)]
for s in (1, -1):
    # each limb: 3 segments curving forward (-Y)
    pts = [(0.0, 0.07), (-0.05, 0.22), (-0.07, 0.38), (-0.045, 0.5)]
    for i in range(3):
        a = Vector(pts[i]); b = Vector(pts[i + 1])
        mid = (a + b) / 2; d = b - a
        L = d.length
        ang = math.atan2(-d.x, d.y * s)  # R_x(θ)·Z = (0, -sinθ, cosθ)
        seg = box(f"_limb{s}{i}", (0.035, 0.05, L + 0.02), (0, mid.x, mid.y * s), iceDark if i < 2 else ice,
                  rot=(ang, 0, 0))
        objs.append(seg)
    # crystal spikes on limbs
    objs.append(cone(f"_cr{s}", 0.03, 0.12, (0, -0.1, 0.27 * s), ice, verts=4, rot=(math.radians(-60 if s > 0 else -120), 0, 0)))
    objs.append(cone(f"_tip{s}", 0.025, 0.1, (0, -0.045, 0.54 * s), ice, verts=4, rot=(0 if s > 0 else math.pi, 0, 0)))
objs.append(cyl("_string", 0.005, 1.0, (0, 0.0, 0), ice, verts=4))
objs.append(sph("_icegem", 0.035, (0, -0.04, 0), ice, seg=6, rings=4, smooth=False))
m = part(f"{N}_Mesh", objs, (0, 0, 0), R)

# ice arrow (projectile) – along +Z
N = "P_IceArrow"; delete_hierarchy(N); R = empty(N)
objs = [cyl("_shaft", 0.012, 0.5, (0, 0, 0), iceDark, verts=5),
        cone("_head", 0.04, 0.12, (0, 0, 0.3), ice, verts=4),
        box("_fl1", (0.07, 0.005, 0.08), (0, 0, -0.22), ice), box("_fl2", (0.005, 0.07, 0.08), (0, 0, -0.22), ice)]
part(f"{N}_Mesh", objs, (0, 0, 0), R)

# ---- Lightning staff ----
N = "W_LightningStaff"; delete_hierarchy(N); R = empty(N)
objs = [
    cyl("_shaftS", 0.028, 0.95, (0, 0, 0.2), wood, verts=6),
    box("_bandA", (0.07, 0.07, 0.03), (0, 0, 0.0), gold, bevel=0.008),
    box("_bandB", (0.07, 0.07, 0.03), (0, 0, 0.42), gold, bevel=0.008),
    cone("_foot", 0.04, 0.12, (0, 0, -0.32), gold, verts=4, rot=(math.pi, 0, 0)),
    cyl("_headBase", 0.06, 0.08, (0, 0, 0.7), gold, verts=6, r2=0.09),
    sph("_orb", 0.1, (0, 0, 0.84), blueOrb, seg=10, rings=7),
]
for k in range(4):
    a = k * math.pi / 2 + math.pi / 4
    objs.append(cone(f"_prong{k}", 0.03, 0.22, (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.86), gold, verts=4,
                     rot=(-math.sin(a) * 0.35, math.cos(a) * 0.35, 0)))
objs.append(cone("_spire", 0.03, 0.12, (0, 0, 1.0), gold, verts=4))
for k in range(3):
    a = k * 2.1
    objs.append(cone(f"_bolt{k}", 0.012, 0.16, (math.cos(a) * 0.13, math.sin(a) * 0.13, 0.84), violet, verts=3,
                     rot=(math.cos(a) * 1.2, math.sin(a) * 1.2, a)))
part(f"{N}_Mesh", objs, (0, 0, 0), R)

# ---- Poison dagger ----
N = "W_PoisonDagger"; delete_hierarchy(N); R = empty(N)
pts = [(-0.045, 0), (0.04, 0), (0.06, 0.1), (0.03, 0.18), (0.05, 0.24), (-0.01, 0.36), (-0.03, 0.22), (-0.055, 0.15)]
objs = [
    poly_extrude("_bladeD", pts, 0.025, (0, 0, 0.06), poisonD, plane='XZ'),
    poly_extrude("_edgeD", [(0.035, 0.0), (0.05, 0.0), (0.065, 0.1), (0.035, 0.18), (0.055, 0.24), (0.0, 0.36), (0.03, 0.22), (0.045, 0.1)], 0.03, (0.005, 0, 0.065), poison, plane='XZ'),
    box("_guardD", (0.13, 0.05, 0.035), (0, 0, 0.05), wrapTeal, bevel=0.01),
    cyl("_gripD", 0.022, 0.12, (0, 0, -0.01), wrapTeal, verts=6),
    sph("_pomD", 0.03, (0, 0, -0.085), poison, seg=6, rings=4, smooth=False),
]
part(f"{N}_Mesh", objs, (0, 0, 0), R)

# ---- Holy hammer ----
N = "W_HolyHammer"; delete_hierarchy(N); R = empty(N)
objs = [
    cyl("_shaftH", 0.03, 0.75, (0, 0, 0.2), wood, verts=6),
    box("_bandH", (0.075, 0.075, 0.04), (0, 0, -0.05), gold, bevel=0.01),
    cone("_footH", 0.045, 0.1, (0, 0, -0.22), gold, verts=4, rot=(math.pi, 0, 0)),
    box("_headH", (0.3, 0.2, 0.2), (0, 0, 0.62), stone, bevel=0.03, seg=1),
    box("_faceL", (0.06, 0.24, 0.24), (0.17, 0, 0.62), gold, bevel=0.02),
    box("_faceR", (0.06, 0.24, 0.24), (-0.17, 0, 0.62), gold, bevel=0.02),
    box("_crown", (0.12, 0.12, 0.08), (0, 0, 0.75), gold, bevel=0.015),
    sph("_holyGem", 0.055, (0, -0.1, 0.62), holyBlue, seg=4, rings=3, smooth=False, scale=(1, 0.6, 1.3)),
    cone("_spikeH", 0.035, 0.1, (0, 0, 0.83), gold, verts=4),
]
part(f"{N}_Mesh", objs, (0, 0, 0), R)

# lay out for preview
xs = {"W_Sword": -1.2, "W_FireSword": -0.7, "W_IceBow": -0.2, "P_IceArrow": 0.15, "W_LightningStaff": 0.5, "W_PoisonDagger": 0.95, "W_HolyHammer": 1.4}
for n, x in xs.items():
    bpy.data.objects[n].location = (x, 2.0, 0.3)
    print(n, tris(n))
