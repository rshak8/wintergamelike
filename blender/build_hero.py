import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *
from mathutils import Vector

# Hero: chibi knight, ~1.3 units tall. Rigid parts (no skinning): Body, Head, Scarf, Cape, ArmL/R (+HandL/R), LegL/R.
# Hand sockets sit in the middle of each fist; a weapon grip runs through the fist along -Y (forward).
N = "Hero"
delete_hierarchy(N)
R = empty(N)

skin = mat("M_Skin", "#f4d6c2", rough=0.75)
skinD = mat("M_SkinShade", "#e2b49c", rough=0.8)
blush = mat("M_Blush", "#f2a39a", rough=0.8)
eyeDark = mat("M_EyeDark", "#1b2340", rough=0.35)
iris = mat("M_IrisBlue", "#3f7fe0", emit="#2a5ab8", emit_strength=0.4, rough=0.3)
pupil = mat("M_Pupil", "#0a0d1a", rough=0.3)
glint = mat("M_EyeGlint", "#ffffff", emit="#ffffff", emit_strength=1.5)
lash = mat("M_Lash", "#241a24", rough=0.6)
mouthM = mat("M_Mouth", "#7a3434", rough=0.6)
hair = mat("M_HairWhite", "#ece8f4", rough=0.55)
hairS = mat("M_HairShade", "#c9c2de", rough=0.6)
red = mat("M_ScarfRed", "#d42532", rough=0.75)
redD = mat("M_ScarfRedDark", "#9c1624", rough=0.8)
coat = mat("M_CoatNavy", "#2c3350", rough=0.75)
coatD = mat("M_CoatDark", "#1d2236", rough=0.8)
plate = mat("M_PlateWhite", "#d3d6e0", rough=0.32, metal=0.55)
plateD = mat("M_PlateShade", "#9ea3b5", rough=0.4, metal=0.55)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
gem = mat("M_GemRed", "#ff2a3a", emit="#ff2030", emit_strength=2.0)
leather = mat("M_Leather", "#7a4a2a", rough=0.75)
leatherD = mat("M_LeatherDark", "#4f2f1b", rough=0.8)
silver = mat("M_Silver", "#d7d9e0", rough=0.3, metal=0.8)
glove = mat("M_Glove", "#3a3446", rough=0.65)

HIP = 0.37
NECK = 0.64
H = 0.92                      # head centre
HR = (0.25, 0.235, 0.232)     # head radii
HC = (0, 0, H)

# ---------------- legs ----------------
def leg(side):
    s = 1 if side == 'L' else -1
    x = 0.08 * s
    o = [
        tube(f"_pant{side}", [(x, 0, HIP + 0.02), (x, 0, 0.27), (x, -0.004, 0.17)], [0.074, 0.066, 0.062], coat, seg=14, sub=4),
        ell(f"_knee{side}", 0.05, (x, -0.048, 0.215), plate, scale=(0.95, 0.55, 0.85), seg=18, rings=10),
        ell(f"_kneeR{side}", 0.012, (x, -0.074, 0.222), gold, seg=10, rings=6),
        lathe(f"_bootS{side}", [(0.066, 0.06), (0.069, 0.11), (0.072, 0.15), (0.077, 0.172)], (x, 0, 0), leather, seg=20, cap=True),
        lathe(f"_cuff{side}", [(0.072, 0.158), (0.086, 0.166), (0.088, 0.182), (0.08, 0.194), (0.06, 0.194)], (x, 0, 0), leatherD, seg=20),
        ell(f"_foot{side}", 0.07, (x, -0.035, 0.058), leather, scale=(1.0, 1.55, 0.86), seg=20, rings=12),
        rbox(f"_sole{side}", (0.138, 0.215, 0.03), (x, -0.038, 0.016), leatherD, r=0.013, seg=3),
        rbox(f"_buckle{side}", (0.014, 0.042, 0.032), (x + s * 0.072, -0.01, 0.112), silver, r=0.005, seg=2),
    ]
    return part(f"{N}_Leg{side}", o, (x, 0, HIP - 0.01), R)

legL = leg('L'); legR = leg('R')

# ---------------- body ----------------
fold = lambda a, z: 0.011 * math.sin(a * 7) * max(0.0, (0.43 - z) / 0.14)
body_objs = [
    lathe("_torso", [(0.0, 0.33), (0.12, 0.335), (0.136, 0.38), (0.142, 0.45), (0.153, 0.53), (0.15, 0.59), (0.122, 0.632),
                     (0.07, 0.657), (0.0, 0.662)], (0, 0, 0), coat, seg=28, scale=(1, 0.78, 1)),
    solidify(lathe("_skirt", [(0.183, 0.27), (0.172, 0.31), (0.16, 0.37), (0.153, 0.43)], (0, 0, 0), coatD, seg=36,
                   scale=(1, 0.8, 1), wob=fold, cap=False), 0.012),
    torus("_belt", 0.156, 0.024, (0, 0, 0.418), leather, seg=32, mseg=8, scale=(1, 0.8, 0.85)),
    rbox("_buckle", (0.072, 0.022, 0.058), (0, -0.131, 0.418), silver, r=0.01, seg=3),
    rbox("_buckleIn", (0.038, 0.026, 0.028), (0, -0.133, 0.418), leatherD, r=0.006, seg=2),
    rbox("_pouchL", (0.07, 0.05, 0.072), (0.118, -0.082, 0.382), leather, r=0.017, seg=3, rot=(0, 0, math.radians(32))),
    rbox("_pouchLf", (0.074, 0.054, 0.026), (0.118, -0.082, 0.413), leatherD, r=0.01, seg=3, rot=(0, 0, math.radians(32))),
    ell("_pouchLs", 0.009, (0.104, -0.112, 0.402), gold, seg=10, rings=6),
    rbox("_pouchR", (0.064, 0.048, 0.066), (-0.128, -0.06, 0.379), leather, r=0.016, seg=3, rot=(0, 0, math.radians(-40))),
    rbox("_pouchRf", (0.068, 0.052, 0.024), (-0.128, -0.06, 0.408), leatherD, r=0.009, seg=3, rot=(0, 0, math.radians(-40))),
    # breastplate + trim + gem
    rbox("_plate", (0.215, 0.07, 0.16), (0, -0.088, 0.542), plate, r=0.03, seg=3, taper=(1.12, 1.0), sub=1),
    tube("_plateTrim", [(-0.108, -0.112, 0.474), (0, -0.13, 0.464), (0.108, -0.112, 0.474)], [0.009], gold, seg=8, sub=6),
    tube("_plateRidge", [(0, -0.128, 0.48), (0, -0.131, 0.6)], [0.006], plateD, seg=8, sub=2),
    ell("_gemSet", 0.034, (0, -0.126, 0.556), gold, scale=(0.85, 0.35, 1.05), seg=18, rings=10),
    ell("_gem", 0.025, (0, -0.136, 0.556), gem, scale=(0.75, 0.35, 1.0), seg=16, rings=10),
    # cape clasps
    ell("_claspL", 0.024, (0.12, -0.035, 0.625), gold, scale=(1, 0.6, 1), seg=14, rings=8),
    ell("_claspR", 0.024, (-0.12, -0.035, 0.625), gold, scale=(1, 0.6, 1), seg=14, rings=8),
]
body = part(f"{N}_Body", body_objs, (0, 0, HIP), R)

# ---------------- head ----------------
head_objs = [
    ell("_skull", 1.0, HC, skin, scale=HR, seg=28, rings=18),
    decal_ell("_ears_L", HC, HR, 90, -4, (0.032, 0.046, 0.022), skin, push=-0.004),
    decal_ell("_ears_R", HC, HR, -90, -4, (0.032, 0.046, 0.022), skin, push=-0.004),
    decal_ell("_blushL", HC, HR, 36, -22, (0.042, 0.022, 0.008), blush, push=0.001),
    decal_ell("_blushR", HC, HR, -36, -22, (0.042, 0.022, 0.008), blush, push=0.001),
    decal_ell("_nose", HC, HR, 0, -20, (0.011, 0.009, 0.007), skinD, push=0.0),
    tube("_mouth", surface_arc(HC, HR, [(-7, -31), (0, -32.5), (7, -31)], push=0.002), [0.0055], mouthM, seg=8, sub=4),
]
for side, s in (('L', 1), ('R', -1)):
    az = 21 * s
    head_objs += [
        decal_ell(f"_eye{side}", HC, HR, az, -9, (0.05, 0.064, 0.016), eyeDark, push=0.002),
        decal_ell(f"_iris{side}", HC, HR, az, -11, (0.036, 0.046, 0.012), iris, push=0.006),
        decal_ell(f"_pupil{side}", HC, HR, az, -10.5, (0.019, 0.027, 0.01), pupil, push=0.009),
        decal_ell(f"_glintA{side}", HC, HR, az + 5 * s, -4, (0.014, 0.017, 0.006), glint, push=0.012),
        decal_ell(f"_glintB{side}", HC, HR, az - 4 * s, -15, (0.007, 0.008, 0.005), glint, push=0.012),
        tube(f"_lash{side}", surface_arc(HC, HR, [(az - 12 * s, -6), (az - 4 * s, 2.5), (az + 6 * s, 2.5), (az + 13 * s, -3)], push=0.006),
             [0.006, 0.009, 0.009, 0.005], lash, seg=8, sub=4),
        tube(f"_brow{side}", surface_arc(HC, HR, [(az - 10 * s, 9), (az + 1 * s, 12), (az + 12 * s, 10)], push=0.008),
             [0.007, 0.009, 0.006], hairS, seg=8, sub=4),
    ]

# hair cap: a shell over the top and back of the skull (front/bottom cut away so the face shows)
cap = ell("_hairCap", 1.0, (0, 0.012, H + 0.018), hair, scale=(HR[0] + 0.018, HR[1] + 0.02, HR[2] + 0.02), seg=28, rings=16)
bm = bmesh.new(); bm.from_mesh(cap.data)
sc = (HR[0] + 0.018, HR[1] + 0.02, HR[2] + 0.02)
nv = lambda v: (v.co.x / sc[0], v.co.y / sc[1], v.co.z / sc[2])
kill = [v for v in bm.verts if (nv(v)[1] < -0.35 and nv(v)[2] < 0.45) or (nv(v)[2] < -0.55 and nv(v)[1] < 0.35) or nv(v)[2] < -0.93]
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(cap.data); bm.free()
solidify(cap, 0.01, 80)
head_objs.append(cap)

CC = (0, 0.012, H + 0.018)
CR = (HR[0] + 0.02, HR[1] + 0.022, HR[2] + 0.022)

def clump(name, az, el, L, r, back=0.55, lift=0.25, droop=0.0, m=hair, flat=0.55):
    """Soft, curved hair clump with a rounded tip. Grows from the scalp, swept back/up."""
    p, n = skin_point(CC, CR, az, el, push=-0.03)
    sweep = Vector((0, back, lift))
    d = (n + sweep).normalized()
    side = Vector((math.sin(math.radians(az)), 0, 0)) * 0.15
    p1 = p + d * L * 0.38 + side * L
    d2 = (d + Vector((0, 0.25, -0.35 - droop))).normalized()
    p2 = p1 + d2 * L * 0.38
    p3 = p2 + (d2 + Vector((0, 0.15, -0.4 - droop))).normalized() * L * 0.3
    return tube(name, [p, p1, p2, p3], [r, r * 0.92, r * 0.62, r * 0.3], m, seg=8, sub=3, flat=flat, up=tuple(n), cap_rings=2)

layout = [
    # (az, el, length, radius, back, lift, droop)
    (0, 70, 0.27, 0.085, 0.7, 0.55, 0.0), (35, 62, 0.25, 0.08, 0.6, 0.45, 0.0), (-35, 62, 0.25, 0.08, 0.6, 0.45, 0.0),
    (80, 55, 0.24, 0.078, 0.5, 0.35, 0.1), (-80, 55, 0.24, 0.078, 0.5, 0.35, 0.1),
    (130, 50, 0.22, 0.085, 0.5, 0.15, 0.35), (-130, 50, 0.22, 0.085, 0.5, 0.15, 0.35), (180, 48, 0.22, 0.09, 0.5, 0.1, 0.35),
    (60, 28, 0.2, 0.07, 0.4, 0.1, 0.25), (-60, 28, 0.2, 0.07, 0.4, 0.1, 0.25),
    (105, 22, 0.19, 0.08, 0.4, 0.0, 0.5), (-105, 22, 0.19, 0.08, 0.4, 0.0, 0.5),
    (150, 18, 0.19, 0.085, 0.4, -0.1, 0.6), (-150, 18, 0.19, 0.085, 0.4, -0.1, 0.6), (180, 12, 0.19, 0.09, 0.4, -0.1, 0.6),
    (125, -8, 0.18, 0.068, 0.4, -0.1, 0.5), (-125, -8, 0.18, 0.068, 0.4, -0.1, 0.5),
    (165, -12, 0.18, 0.07, 0.4, -0.1, 0.5), (-165, -12, 0.18, 0.07, 0.4, -0.1, 0.5),
    # back layer that drapes down over the nape
    (150, 30, 0.2, 0.09, 0.25, -0.25, 0.6), (-150, 30, 0.2, 0.09, 0.25, -0.25, 0.6), (180, 32, 0.21, 0.095, 0.25, -0.25, 0.6),
    (140, -22, 0.16, 0.08, 0.2, -0.3, 0.7), (-140, -22, 0.16, 0.08, 0.2, -0.3, 0.7), (180, -25, 0.16, 0.085, 0.2, -0.3, 0.7),
    (100, -18, 0.15, 0.07, 0.25, -0.3, 0.7), (-100, -18, 0.15, 0.07, 0.25, -0.3, 0.7),
]
for i, (az, el, L, r, b, l, dr) in enumerate(layout):
    head_objs.append(clump(f"_clump{i}", az, el, L, r, b, l, dr, m=hair if i % 3 else hairS))

# fringe: soft locks falling over the forehead, swept to one side; tips stop above the eyes
fringe = [(-30, 0.05), (-14, 0.07), (2, 0.08), (17, 0.075), (32, 0.06)]
for j, (az, sx) in enumerate(fringe):
    p, n = skin_point(CC, CR, az, 42, push=-0.02)
    q1, _ = skin_point(CC, CR, az + 9, 22, push=0.012)
    q2, _ = skin_point(CC, CR, az + 15, 6, push=0.01)
    head_objs.append(tube(f"_bang{j}", [p, q1, q2], [0.06, 0.05, 0.018], hair if j % 2 else hairS, seg=9, sub=4,
                          flat=0.5, up=tuple(n)))
# side locks framing the face
for side, s in (('L', 1), ('R', -1)):
    p, n = skin_point(CC, CR, 62 * s, 25, push=-0.02)
    q1, _ = skin_point(CC, CR, 70 * s, -5, push=0.016)
    q2, _ = skin_point(CC, CR, 66 * s, -32, push=0.012)
    head_objs.append(tube(f"_lock{side}", [p, q1, q2], [0.055, 0.045, 0.016], hairS, seg=9, sub=4, flat=0.55, up=tuple(n)))
# ahoge (rounded cowlick)
p, n = skin_point(CC, CR, 10, 80, push=-0.02)
head_objs.append(tube("_ahoge", [p, p + Vector((0.02, -0.03, 0.09)), p + Vector((0.06, -0.06, 0.12)), p + Vector((0.09, -0.05, 0.1))],
                      [0.03, 0.026, 0.018, 0.01], hair, seg=8, sub=4, flat=0.6, up=(0, -1, 0)))
head = part(f"{N}_Head", head_objs, (0, 0, NECK), body)

# ---------------- scarf ----------------
scarf_objs = [
    torus("_scarfRing", 0.112, 0.046, (0, 0, NECK + 0.006), red, seg=28, mseg=12, scale=(1.0, 0.94, 0.9)),
    ell("_scarfKnot", 0.04, (0.07, -0.1, NECK - 0.025), redD, scale=(1.2, 0.85, 1.0), seg=16, rings=10),
    tube("_tailA", [(0.07, -0.108, NECK - 0.04), (0.092, -0.128, NECK - 0.11), (0.085, -0.13, NECK - 0.18)],
         [0.032, 0.03, 0.026], red, seg=10, sub=4, flat=0.32, up=(0, 1, 0)),
    tube("_tailB", [(0.06, -0.105, NECK - 0.04), (0.04, -0.125, NECK - 0.1), (0.05, -0.13, NECK - 0.15)],
         [0.028, 0.026, 0.022], redD, seg=10, sub=4, flat=0.32, up=(0, 1, 0)),
]
scarf = part(f"{N}_Scarf", scarf_objs, (0, 0, NECK), body)

# ---------------- cape ----------------
def cape_fn(u, v):
    w = 0.15 + 0.1 * v
    hem = 1.0 - 0.05 * (0.5 + 0.5 * math.cos(u * math.pi * 3.0))      # soft scallops, no points
    vv = v * hem
    x = u * w
    z = NECK - 0.02 - vv * 0.44
    y = 0.118 + 0.07 * vv + 0.045 * (1 - u * u) * (0.3 + vv) + 0.014 * math.sin(u * math.pi * 3.5) * vv
    return (x, y, z)

cape = sheet("_cape", 16, 12, cape_fn, red, thick=0.014)
cape = part(f"{N}_Cape", [cape], (0, 0.12, NECK - 0.02), body)

# ---------------- arms ----------------
def arm(side):
    s = 1 if side == 'L' else -1
    sx = 0.19 * s
    hs = Vector((sx + 0.02 * s, -0.004, NECK - 0.335))   # hand socket (fist centre)
    dome = solidify(lathe(f"_pdome{side}", [(0.089, -0.032), (0.086, 0.0), (0.072, 0.036), (0.045, 0.056), (0.0, 0.062)],
                          (0, 0, 0), plate, seg=24, cap=False, scale=(1, 1.06, 1)), 0.012)
    rim = torus(f"_prim{side}", 0.089, 0.01, (0, 0, -0.032), gold, seg=24, mseg=6, scale=(1, 1.06, 1))
    rivet = ell(f"_priv{side}", 0.012, (0, 0, 0.064), gold, seg=10, rings=6)
    xf([dome, rim, rivet], loc=(sx + 0.018 * s, 0, NECK - 0.07), rot=(0, math.radians(-24) * s, 0))
    objs = [dome, rim, rivet,
            tube(f"_upper{side}", [(sx, 0, NECK - 0.07), (sx + 0.012 * s, 0, NECK - 0.21)], [0.047, 0.043], coat, seg=14, sub=2),
            lathe(f"_bracer{side}", [(0.046, -0.07), (0.05, -0.04), (0.055, 0.0), (0.06, 0.012), (0.054, 0.024)],
                  (sx + 0.016 * s, 0, NECK - 0.235), leather, seg=18),
            torus(f"_band{side}", 0.057, 0.009, (sx + 0.016 * s, 0, NECK - 0.222), silver, seg=18, mseg=6),
            ] + fist(f"_f{side}", hs, glove, s)
    a = part(f"{N}_Arm{side}", objs, (sx, 0, NECK - 0.06), body)
    hand = empty(f"{N}_Hand{side}", tuple(hs), 0.05)
    parent(hand, a)
    return a

armL = arm('L'); armR = arm('R')
print("Hero tris:", tris(N))
