import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *
from mathutils import Vector

# Enemies: chibi skeletons with rigid parts Body, Head, ArmL/R (+HandL/R sockets in the fists), LegL/R, optional Cape.
bone = mat("M_Bone", "#ece0c4", rough=0.6)
boneD = mat("M_BoneShade", "#bfae8c", rough=0.7)
socket = mat("M_Socket", "#140d10", rough=0.9)
eyeRed = mat("M_EyeRed", "#ff3030", emit="#ff2020", emit_strength=5.0)
eyePurple = mat("M_EyePurple", "#c06bff", emit="#a040ff", emit_strength=5.0)
eyeCyan = mat("M_EyeCyan", "#6bf0ff", emit="#40e0ff", emit_strength=5.0)
eyeGreen = mat("M_EyeGreen", "#9bff6b", emit="#60ff40", emit_strength=5.0)
rust = mat("M_ArmorDark", "#4a4f60", rough=0.45, metal=0.6)
rustL = mat("M_ArmorLight", "#7a8098", rough=0.38, metal=0.6)
rustR = mat("M_ArmorRust", "#8a5a3a", rough=0.7, metal=0.3)
cloth = mat("M_ClothRed", "#8a1a22", rough=0.85)
hood = mat("M_HoodGreen", "#44532f", rough=0.85)
hoodD = mat("M_HoodGreenDark", "#2c3620", rough=0.85)
robeP = mat("M_RobePurple", "#3e2656", rough=0.8)
robePD = mat("M_RobePurpleDark", "#26163c", rough=0.85)
purpleGlow = mat("M_PurpleTrim", "#9a4cff", emit="#8a3cff", emit_strength=2.5)
robeW = mat("M_RobeWhite", "#e8eaf2", rough=0.75)
robeB = mat("M_RobeBlue", "#2f5fae", rough=0.75)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
halo = mat("M_Halo", "#ffe27a", emit="#ffd040", emit_strength=3.0)
leather = mat("M_Leather", "#7a4a2a", rough=0.75)
leatherD = mat("M_LeatherDark", "#4f2f1b", rough=0.8)
wood = mat("M_BowWood", "#7a4a26", rough=0.75)
string = mat("M_String", "#d8d0b8", rough=0.8)
steel = mat("M_Steel", "#c3c8d6", rough=0.28, metal=0.75)
steelD = mat("M_SteelDark", "#6c7183", rough=0.4, metal=0.6)
gripRed = mat("M_GripRed", "#8e1d22", rough=0.8)
orbM = mat("M_NecroOrb", "#b060ff", emit="#9a40ff", emit_strength=5.0)
crystal = mat("M_Crystal", "#6be6ff", emit="#40d0ff", emit_strength=4.0)
kingArmor = mat("M_KingArmor", "#2e2a34", rough=0.4, metal=0.65)
kingArmorL = mat("M_KingArmorL", "#5c5262", rough=0.35, metal=0.65)
kingCape = mat("M_KingCape", "#8e1824", rough=0.8)
kingCapeD = mat("M_KingCapeDark", "#5a0e18", rough=0.85)
fur = mat("M_Fur", "#d9d2c6", rough=0.95)
bossBlade = mat("M_BossBlade", "#3a2a30", rough=0.35, metal=0.65)
bossGlow = mat("M_BossGlow", "#ff2a2a", emit="#ff1a1a", emit_strength=4.0)

HIP = 0.34
NECK = 0.6


def bone_tube(name, a, b, r, m=bone):
    """Long bone with knobbly ends."""
    return tube(name, [a, b], [r * 1.45, r * 1.0, r * 0.95, r * 1.35], m, seg=8, sub=2, cap_rings=2)


def skull(HC, eyeM, R=1.0, angry=True):
    """Skull centred at HC. R scales the whole skull."""
    cr = (0.2 * R, 0.205 * R, 0.19 * R)
    cc = (HC[0], HC[1] + 0.01 * R, HC[2] + 0.02 * R)
    o = [ell("_cran", 1.0, cc, bone, scale=cr, seg=22, rings=14),
         ell("_cheek", 1.0, (HC[0], HC[1] - 0.06 * R, HC[2] - 0.075 * R), bone, scale=(0.16 * R, 0.13 * R, 0.11 * R), seg=16, rings=10),
         rbox("_jaw", (0.19 * R, 0.15 * R, 0.07 * R), (HC[0], HC[1] - 0.065 * R, HC[2] - 0.165 * R), bone, r=0.03 * R, seg=2, sub=1, taper=(1.12, 1.0))]
    for side, s in (('L', 1), ('R', -1)):
        o += [decal_ell(f"_sock{side}", cc, cr, 27 * s, -10, (0.052 * R, 0.058 * R, 0.03 * R), socket, push=-0.006 * R),
              decal_ell(f"_eye{side}", cc, cr, 27 * s, -11, (0.02 * R, 0.022 * R, 0.014 * R), eyeM, push=0.004 * R),
              decal_ell(f"_nose{side}", cc, cr, 5 * s, -29, (0.016 * R, 0.026 * R, 0.012 * R), socket, push=-0.004 * R, tilt=0.35 * s)]
        if angry:
            o.append(tube(f"_brow{side}", surface_arc(cc, cr, [(10 * s, 5), (25 * s, 8), (42 * s, 1)], push=0.004 * R),
                          [0.016 * R, 0.014 * R, 0.01 * R], boneD, seg=8, sub=3))
    for k in range(6):
        x = (k - 2.5) * 0.026 * R
        o.append(ell(f"_tooth{k}", 0.014 * R, (HC[0] + x, HC[1] - 0.137 * R + abs(x) * 0.5, HC[2] - 0.125 * R), boneD if k % 2 else bone,
                     scale=(0.85, 0.6, 1.2), seg=8, rings=5))
    return o


def skeleton_parts(eyeM, R_head=1.0, bony_arms=True, bony_legs=True, ribs=True, torso=None):
    torso = ribs if torso is None else torso
    P = {}
    # legs
    for side, s in (('L', 1), ('R', -1)):
        x = 0.07 * s
        objs = []
        if bony_legs:
            objs += [bone_tube(f"_femur{side}", (x, 0, HIP - 0.03), (x, 0, HIP - 0.155), 0.019),
                     ell(f"_knee{side}", 0.03, (x, -0.006, HIP - 0.17), boneD, seg=12, rings=8),
                     bone_tube(f"_tibia{side}", (x, 0, HIP - 0.19), (x, 0, 0.07), 0.017)]
        objs += [rbox(f"_foot{side}", (0.07, 0.115, 0.045), (x, -0.025, 0.03), bone, r=0.018, seg=2, sub=1),
                 ell(f"_toes{side}", 0.025, (x, -0.08, 0.025), boneD, scale=(1.3, 0.8, 0.7), seg=12, rings=6)]
        P['Leg' + side] = [objs, (x, 0, HIP - 0.01)]
    # torso: pelvis, spine, ribs, clavicles
    body = [tube("_neck", [(0, 0.02, NECK - 0.03), (0, 0.01, NECK + 0.04)], [0.022], boneD, seg=8, sub=1)]
    if torso:  # robed enemies hide their torso bones, so skip them there
        body += [ell("_pelvis", 1.0, (0, 0.005, HIP + 0.005), bone, scale=(0.105, 0.065, 0.05), seg=16, rings=8),
                 ell("_iliumL", 1.0, (0.07, 0.01, HIP + 0.03), boneD, scale=(0.045, 0.03, 0.04), seg=10, rings=6),
                 ell("_iliumR", 1.0, (-0.07, 0.01, HIP + 0.03), boneD, scale=(0.045, 0.03, 0.04), seg=10, rings=6)]
        for k in range(5):
            body.append(ell(f"_vert{k}", 0.022, (0, 0.035, HIP + 0.05 + k * 0.045), boneD, scale=(1.1, 1, 0.75), seg=10, rings=6))
    for k in range(4 if ribs else 0):
        z = NECK - 0.07 - k * 0.048
        w = 0.105 - k * 0.006
        for s in (1, -1):
            body.append(tube(f"_rib{k}{s}", [(0, 0.045, z + 0.01), (s * w * 0.75, 0.03, z + 0.005), (s * w, -0.01, z - 0.01),
                                             (s * w * 0.6, -0.06, z - 0.02), (s * 0.02, -0.07, z - 0.02)],
                             [0.013, 0.014, 0.014, 0.012, 0.011], bone, seg=6, sub=2, cap_rings=1))
    if ribs:
        body += [tube("_sternum", [(0, -0.072, NECK - 0.04), (0, -0.075, NECK - 0.2)], [0.016, 0.012], bone, seg=8, sub=2, cap_rings=1),
                 tube("_clavL", [(0.01, -0.03, NECK - 0.02), (0.08, -0.02, NECK - 0.015), (0.15, 0.0, NECK - 0.02)], [0.014], bone, seg=6, sub=2, cap_rings=1),
                 tube("_clavR", [(-0.01, -0.03, NECK - 0.02), (-0.08, -0.02, NECK - 0.015), (-0.15, 0.0, NECK - 0.02)], [0.014], bone, seg=6, sub=2, cap_rings=1)]
    P['Body'] = [body, (0, 0, HIP)]
    HC = (0, 0, NECK + 0.2 * R_head + 0.03)
    P['Head'] = [skull(HC, eyeM, R_head), (0, 0, NECK)]
    P['HC'] = HC
    for side, s in (('L', 1), ('R', -1)):
        sx = 0.16 * s
        hs = (sx + 0.012 * s, -0.004, NECK - 0.31)
        objs = [ell(f"_shoulder{side}", 0.03, (sx, 0, NECK - 0.025), boneD, seg=12, rings=8)]
        if bony_arms:
            objs += [bone_tube(f"_hum{side}", (sx, 0, NECK - 0.04), (sx + 0.006 * s, 0, NECK - 0.16), 0.016),
                     ell(f"_elbow{side}", 0.024, (sx + 0.006 * s, 0.006, NECK - 0.17), boneD, seg=10, rings=6),
                     bone_tube(f"_rad{side}", (sx + 0.007 * s, 0, NECK - 0.18), (sx + 0.011 * s, 0, NECK - 0.27), 0.014)]
        objs += fist(f"_fist{side}", hs, bone, s, boneD, size=0.82)
        P['Arm' + side] = [objs, (sx, 0, NECK - 0.03), hs]
    return P


def assemble(N, P, extra, sc=1.0):
    delete_hierarchy(N)
    R = empty(N)
    for k, v in extra.items():
        if k in P:
            P[k][0] += v if isinstance(v, list) else v[0]
        else:
            P[k] = [v[0], v[1]]
    body = part(f"{N}_Body", P['Body'][0], P['Body'][1], R)
    for k in ('LegL', 'LegR'):
        part(f"{N}_{k}", P[k][0], P[k][1], R)
    part(f"{N}_Head", P['Head'][0], P['Head'][1], body)
    for k in ('ArmL', 'ArmR'):
        a = part(f"{N}_{k}", P[k][0], P[k][1], body)
        h = empty(f"{N}_Hand{k[-1]}", P[k][2], 0.04)
        parent(h, a)
    if 'Cape' in P:
        part(f"{N}_Cape", P['Cape'][0], P['Cape'][1], body)
    R.scale = (sc, sc, sc)
    return R


def hood_shell(name, HC, radii, m, open_deg=62, tilt=22, thick=0.012, rim_m=None):
    """A hood: an ellipsoid shell with a clean round face opening (pole pointing forward and a bit down),
    plus an optional rim that follows the opening edge exactly. Returns a list of objects."""
    th = math.radians(open_deg)
    M = Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0)) @ Euler((math.radians(90 + tilt), 0, 0)).to_matrix().to_4x4()
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=22, v_segments=14, radius=1.0)
    bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.z > math.cos(th) + 1e-4], context='VERTS')
    b.transform(M)
    sh = bh._mesh_obj(name, b); sh.location = HC
    bh._fin2(sh, m, 70)
    solidify(sh, thick, 70)
    out = [sh]
    if rim_m:
        rb = bmesh.new()
        segs, ms = 24, 6
        rings = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring = []
            for j in range(ms):
                c = 2 * math.pi * j / ms
                rr = math.sin(th) + 0.035 * math.cos(c)
                ring.append(rb.verts.new((math.cos(a) * rr, math.sin(a) * rr, math.cos(th) + 0.035 * math.sin(c))))
            rings.append(ring)
        for i in range(segs):
            for j in range(ms):
                rb.faces.new((rings[i][j], rings[(i + 1) % segs][j], rings[(i + 1) % segs][(j + 1) % ms], rings[i][(j + 1) % ms]))
        rb.transform(M)
        bmesh.ops.recalc_face_normals(rb, faces=rb.faces[:])
        rim = bh._mesh_obj(name + "Rim", rb); rim.location = HC
        out.append(bh._fin2(rim, rim_m, 80))
    return out


def cloth_skirt(name, top_r, bot_r, z_top, z_bot, m, folds=8, amp=0.012, sy=0.85, hem_wave=0.012, seg=24):
    """Flared robe/skirt with soft folds and a gently waved (never pointy) hem."""
    rings = 4
    prof = [(top_r + (bot_r - top_r) * (i / rings) ** 1.3, z_top + (z_bot - z_top) * i / rings) for i in range(rings + 1)]
    prof = list(reversed(prof))
    wob = lambda a, z: amp * math.sin(a * folds) * (z_top - z) / (z_top - z_bot)
    o = lathe(name, prof, (0, 0, 0), m, seg=seg, scale=(1, sy, 1), wob=wob, cap=False)
    b = bmesh.new(); b.from_mesh(o.data)
    for v in b.verts:
        if abs(v.co.z - z_bot) < 1e-4:
            a = math.atan2(v.co.y / sy, v.co.x)
            v.co.z += hem_wave * math.sin(a * folds + 1.0)
    b.to_mesh(o.data); b.free()
    return solidify(o, 0.012)


def cape_sheet(name, top_w, bot_w, length, top_z, y0, m, bulge=0.05, folds=3.5):
    def fn(u, v):
        hem = 1.0 - 0.05 * (0.5 + 0.5 * math.cos(u * math.pi * 3))
        vv = v * hem
        return (u * (top_w + (bot_w - top_w) * v), y0 + 0.06 * vv + bulge * (1 - u * u) * (0.3 + vv) + 0.012 * math.sin(u * math.pi * folds) * vv,
                top_z - vv * length)
    return sheet(name, 14, 10, fn, m, thick=0.014)


# ================= Skeleton Warrior =================
N = "SkelWarrior"
P = skeleton_parts(eyeRed, ribs=False, torso=True)
HC = P['HC']
helmet = solidify(lathe("_helm", [(0.215, -0.02), (0.218, 0.03), (0.2, 0.1), (0.15, 0.16), (0.08, 0.195), (0.0, 0.205)],
                        (HC[0], HC[1] + 0.01, HC[2] + 0.02), rust, seg=28, cap=False, scale=(1, 1.04, 1)), 0.014)
extra = {
    'Head': [helmet,
             torus("_helmRim", 0.218, 0.014, (HC[0], HC[1] + 0.01, HC[2] + 0.0), rustL, seg=28, mseg=6, scale=(1, 1.04, 1)),
             tube("_nasal", [(0, -0.21, HC[2] + 0.07), (0, -0.225, HC[2] + 0.0), (0, -0.215, HC[2] - 0.05)], [0.018, 0.016, 0.012], rustL, seg=8, sub=3),
             tube("_hornL", [(0.17, 0.0, HC[2] + 0.1), (0.24, -0.01, HC[2] + 0.15), (0.26, -0.03, HC[2] + 0.23)], [0.032, 0.022, 0.012], bone, seg=10, sub=4),
             tube("_hornR", [(-0.17, 0.0, HC[2] + 0.1), (-0.24, -0.01, HC[2] + 0.15), (-0.26, -0.03, HC[2] + 0.23)], [0.032, 0.022, 0.012], bone, seg=10, sub=4),
             ell("_rivetF", 0.012, (0, -0.205, HC[2] + 0.1), rustL, seg=10, rings=6)],
    'Body': [rbox("_chest", (0.23, 0.17, 0.15), (0, -0.005, NECK - 0.11), rust, r=0.04, seg=3, taper=(1.1, 1.0), sub=1),
             tube("_chestRim", [(-0.11, -0.085, NECK - 0.18), (0, -0.1, NECK - 0.19), (0.11, -0.085, NECK - 0.18)], [0.012], rustL, seg=8, sub=4),
             ell("_rustA", 0.03, (0.05, -0.088, NECK - 0.09), rustR, scale=(1, 0.3, 0.8), seg=12, rings=6),
             torus("_belt", 0.098, 0.018, (0, 0, HIP + 0.04), leatherD, seg=24, mseg=6, scale=(1.05, 0.75, 1)),
             rbox("_buckle", (0.04, 0.016, 0.034), (0, -0.075, HIP + 0.04), rustL, r=0.007, seg=2),
             cloth_skirt("_loin", 0.1, 0.13, HIP + 0.04, HIP - 0.12, cloth, folds=7, amp=0.01, sy=0.75, hem_wave=0.02),
             torus("_scarf", 0.09, 0.03, (0, 0, NECK + 0.0), cloth, seg=20, mseg=8, scale=(1.1, 1.0, 0.8))],
    'LegL': [lathe("_greaveL", [(0.03, 0.08), (0.034, 0.12), (0.032, 0.16)], (0.07, -0.008, 0), rust, seg=14)],
    'LegR': [lathe("_greaveR", [(0.03, 0.08), (0.034, 0.12), (0.032, 0.16)], (-0.07, -0.008, 0), rust, seg=14)],
}
for side, s in (('L', 1), ('R', -1)):
    d = solidify(lathe(f"_pad{side}", [(0.075, -0.03), (0.07, 0.01), (0.05, 0.045), (0.0, 0.055)], (0, 0, 0), rustL, seg=20, cap=False), 0.012)
    rim = torus(f"_padRim{side}", 0.075, 0.009, (0, 0, -0.03), rust, seg=20, mseg=6)
    xf([d, rim], loc=(0.165 * s, 0, NECK - 0.02), rot=(0, math.radians(-25) * s, 0))
    extra['Arm' + side] = [d, rim, lathe(f"_brac{side}", [(0.026, -0.04), (0.03, 0.0), (0.028, 0.03)], (0.17 * s, 0, NECK - 0.235), rust, seg=14)]
# round buckler on the left forearm
bk = [lathe("_buckler", [(0.0, -0.01), (0.1, -0.01), (0.11, 0.0), (0.1, 0.012), (0.06, 0.024), (0.0, 0.03)], (0, 0, 0), rust, seg=28),
      torus("_bkRim", 0.104, 0.012, (0, 0, 0.0), rustL, seg=28, mseg=6),
      ell("_bkBoss", 0.035, (0, 0, 0.026), rustL, scale=(1, 1, 0.6), seg=16, rings=8)]
xf(bk, loc=(0.215, -0.01, NECK - 0.23), rot=(0, math.pi / 2, 0))
extra['ArmL'] += bk
assemble(N, P, extra)

# warrior sword (rusty short sword)
N = "W_EnemySword"; delete_hierarchy(N); Rw = empty(N)
objs = [blade("_b", [(0.06, 0.042, 0.01), (0.35, 0.04, 0.01), (0.44, 0.024, 0.008), (0.5, 0.0, 0.0)], steelD),
        ell("_nick", 0.012, (0.04, 0, 0.3), rustR, scale=(1, 1.2, 1.5), seg=8, rings=6),
        tube("_g", [(-0.075, 0, 0.062), (0, 0, 0.055), (0.075, 0, 0.062)], [0.013, 0.016, 0.013], rust, seg=8, sub=3),
        ] + wrap_grip("_gr", -0.055, 0.045, 0.02, gripRed, leatherD, turns=4) + [
        ell("_p", 0.024, (0, 0, -0.075), rust, seg=12, rings=8)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Skeleton Archer =================
N = "SkelArcher"
P = skeleton_parts(eyeGreen, ribs=False, torso=True)
HC = P['HC']
hd = hood_shell("_hood", (HC[0], HC[1] + 0.025, HC[2] + 0.02), (0.235, 0.24, 0.235), hood, rim_m=hoodD)
extra = {
    'Head': hd + [
             tube("_hoodTail", [(0, 0.2, HC[2] + 0.12), (0, 0.29, HC[2] + 0.06), (0, 0.31, HC[2] - 0.05)], [0.07, 0.045, 0.02], hood, seg=10, sub=4),
             tube("_mask", surface_arc((HC[0], HC[1], HC[2]), (0.205, 0.205, 0.2), [(-60, -38), (-25, -46), (0, -48), (25, -46), (60, -38)], push=0.012),
                  [0.035, 0.04, 0.042, 0.04, 0.035], hoodD, seg=10, sub=3, flat=0.45)],
    'Body': [cloth_skirt("_tunic", 0.1, 0.135, NECK - 0.03, HIP - 0.08, hoodD, folds=8, amp=0.008, sy=0.8, hem_wave=0.014),
             torus("_beltA", 0.105, 0.016, (0, 0, HIP + 0.04), leather, seg=24, mseg=6, scale=(1.05, 0.8, 1)),
             tube("_strap", [(0.1, -0.075, NECK - 0.02), (0.0, -0.095, NECK - 0.12), (-0.1, -0.08, HIP + 0.06)], [0.013], leatherD, seg=8, sub=3, flat=0.5, up=(0, -1, 0)),
             lathe("_quiver", [(0.042, -0.13), (0.048, -0.12), (0.05, 0.1), (0.056, 0.12), (0.05, 0.13)], (0, 0, 0), leather, seg=16)],
    'Cape': [[cape_sheet("_cloak", 0.13, 0.19, 0.34, NECK, 0.1, hood)], (0, 0.1, NECK)],
}
q = extra['Body'][-1]
arrows = []
for k in range(3):
    x = (k - 1) * 0.022
    arrows += [tube(f"_arw{k}", [(x, 0.0, 0.1), (x, 0.0, 0.2)], [0.006], wood, seg=6, sub=1),
               tube(f"_fl{k}", [(x, 0.0, 0.19), (x, 0.0, 0.24)], [0.018, 0.008], string, seg=6, sub=1, flat=0.2, up=(1, 0, 0))]
xf([q] + arrows, loc=(0.06, 0.13, NECK - 0.12), rot=(math.radians(-14), math.radians(22), 0))
extra['Body'] += arrows
for side, s in (('L', 1), ('R', -1)):
    extra['Arm' + side] = [lathe(f"_braceA{side}", [(0.024, -0.045), (0.03, 0.0), (0.03, 0.035)], (0.17 * s, 0, NECK - 0.235), leather, seg=14)]
assemble(N, P, extra)

N = "W_ArcherBow"; delete_hierarchy(N); Rw = empty(N)
objs = [tube("_limbU", [(0, 0, 0.04), (0, -0.04, 0.18), (0, -0.05, 0.32), (0, -0.02, 0.42)], [0.022, 0.019, 0.014, 0.009], wood, seg=10, sub=4, flat=0.75, up=(0, 1, 0)),
        tube("_limbD", [(0, 0, -0.04), (0, -0.04, -0.18), (0, -0.05, -0.32), (0, -0.02, -0.42)], [0.022, 0.019, 0.014, 0.009], wood, seg=10, sub=4, flat=0.75, up=(0, 1, 0)),
        tube("_str", [(0, -0.018, 0.42), (0, 0.01, 0), (0, -0.018, -0.42)], [0.0035], string, seg=6, sub=1)] + wrap_grip("_gr", -0.055, 0.055, 0.024, leatherD, mat("M_WrapGreen", "#5a7a4a"))
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

N = "P_Arrow"; delete_hierarchy(N); Rw = empty(N)
objs = [tube("_s", [(0, 0, -0.2), (0, 0, 0.2)], [0.009], wood, seg=6, sub=1),
        blade("_h", [(0.19, 0.022, 0.008), (0.23, 0.024, 0.008), (0.27, 0.0, 0.0)], steelD),
        tube("_f1", [(0, 0, -0.21), (0, 0, -0.13)], [0.026, 0.01], string, seg=6, sub=1, flat=0.15, up=(0, 1, 0)),
        tube("_f2", [(0, 0, -0.21), (0, 0, -0.13)], [0.026, 0.01], string, seg=6, sub=1, flat=0.15, up=(1, 0, 0))]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Necromancer =================
N = "Necro"
P = skeleton_parts(eyePurple, bony_legs=False, ribs=False, bony_arms=False)
HC = P['HC']
hd = hood_shell("_nhood", (HC[0], HC[1] + 0.03, HC[2] + 0.03), (0.24, 0.245, 0.25), robeP, rim_m=purpleGlow)
extra = {
    'Head': hd + [
             tube("_nhornL", [(0.12, 0.02, HC[2] + 0.17), (0.2, 0.0, HC[2] + 0.25), (0.22, 0.05, HC[2] + 0.34), (0.17, 0.09, HC[2] + 0.38)], [0.04, 0.03, 0.02, 0.011], robePD, seg=10, sub=4),
             tube("_nhornR", [(-0.12, 0.02, HC[2] + 0.17), (-0.2, 0.0, HC[2] + 0.25), (-0.22, 0.05, HC[2] + 0.34), (-0.17, 0.09, HC[2] + 0.38)], [0.04, 0.03, 0.02, 0.011], robePD, seg=10, sub=4),
             ],
    'Body': [cloth_skirt("_robe", 0.11, 0.26, NECK - 0.02, 0.01, robeP, folds=9, amp=0.016, sy=0.85, hem_wave=0.015),
             torus("_trim", 0.262, 0.014, (0, 0, 0.02), purpleGlow, seg=36, mseg=6, scale=(1, 0.85, 1)),
             tube("_sash", [(0, -0.12, HIP + 0.05), (0, -0.17, 0.25), (0, -0.21, 0.08)], [0.03, 0.028, 0.026], purpleGlow, seg=8, sub=3, flat=0.3, up=(0, 1, 0)),
             torus("_nbelt", 0.115, 0.016, (0, 0, HIP + 0.06), robePD, seg=24, mseg=6, scale=(1.05, 0.85, 1)),
             solidify(lathe("_mantle", [(0.2, NECK - 0.1), (0.19, NECK - 0.06), (0.15, NECK - 0.01), (0.09, NECK + 0.02)], (0, 0, 0), robePD, seg=28, cap=False,
                            scale=(1, 0.85, 1), wob=lambda a, z: 0.01 * math.sin(a * 8)), 0.012)],
    'Cape': [[cape_sheet("_ncape", 0.14, 0.26, 0.55, NECK, 0.1, robePD, bulge=0.06)], (0, 0.1, NECK)],
}
for side, s in (('L', 1), ('R', -1)):
    extra['Arm' + side] = [solidify(lathe(f"_sleeve{side}", [(0.065, -0.27), (0.055, -0.2), (0.045, -0.1), (0.04, 0.0)], (0.168 * s, 0, NECK - 0.03), robeP, seg=16, cap=False,
                                          wob=lambda a, z: 0.006 * math.sin(a * 5)), 0.01),
                           tube(f"_spike{side}", [(0.17 * s, 0, NECK + 0.0), (0.22 * s, 0, NECK + 0.06), (0.24 * s, 0.02, NECK + 0.12)], [0.03, 0.02, 0.01], bone, seg=8, sub=3)]
assemble(N, P, extra)

N = "W_NecroOrb"; delete_hierarchy(N); Rw = empty(N)
objs = [ell("_core", 0.08, (0, 0, 0), orbM, seg=20, rings=14), ell("_inner", 0.05, (0, -0.035, 0.0), mat("M_OrbCore", "#f0d0ff", emit="#e0b0ff", emit_strength=6), seg=12, rings=8)]
for k in range(4):
    a = k * math.pi / 2
    c, s = math.cos(a), math.sin(a)
    objs.append(tube(f"_claw{k}", [(c * 0.06, s * 0.06, -0.06), (c * 0.1, s * 0.1, 0.0), (c * 0.07, s * 0.07, 0.07), (c * 0.03, s * 0.03, 0.1)], [0.016, 0.013, 0.009, 0.005], bone, seg=8, sub=3))
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Healer =================
N = "Healer"
P = skeleton_parts(eyeCyan, bony_legs=False, ribs=False, bony_arms=False)
HC = P['HC']
hd = hood_shell("_hhood", (HC[0], HC[1] + 0.03, HC[2] + 0.03), (0.235, 0.24, 0.245), robeW, rim_m=robeB)
extra = {
    'Head': hd + [
             torus("_circlet", 0.2, 0.012, (HC[0], HC[1] + 0.02, HC[2] + 0.09), gold, seg=28, mseg=6, scale=(1, 1.05, 1)),
             ell("_circGem", 0.022, (HC[0], HC[1] - 0.2, HC[2] + 0.09), crystal, scale=(1, 0.5, 1.3), seg=12, rings=8),
             torus("_halo", 0.13, 0.014, (HC[0], HC[1] + 0.03, HC[2] + 0.32), halo, seg=28, mseg=8)],
    'Body': [cloth_skirt("_hrobe", 0.11, 0.25, NECK - 0.02, 0.01, robeW, folds=8, amp=0.013, sy=0.85, hem_wave=0.012),
             torus("_htrim", 0.252, 0.013, (0, 0, 0.02), gold, seg=36, mseg=6, scale=(1, 0.85, 1)),
             tube("_hpanel", [(0, -0.115, NECK - 0.05), (0, -0.16, 0.3), (0, -0.21, 0.04)], [0.04, 0.045, 0.05], robeB, seg=8, sub=3, flat=0.25, up=(0, 1, 0)),
             torus("_hbelt", 0.117, 0.016, (0, 0, HIP + 0.06), gold, seg=24, mseg=6, scale=(1.05, 0.85, 1)),
             solidify(lathe("_hcollar", [(0.19, NECK - 0.09), (0.18, NECK - 0.05), (0.14, NECK - 0.01), (0.09, NECK + 0.02)], (0, 0, 0), robeB, seg=28, cap=False,
                            scale=(1, 0.85, 1)), 0.012),
             torus("_hcollarTrim", 0.19, 0.01, (0, 0, NECK - 0.09), gold, seg=28, mseg=6, scale=(1, 0.85, 1))],
}
for side, s in (('L', 1), ('R', -1)):
    extra['Arm' + side] = [solidify(lathe(f"_hsleeve{side}", [(0.062, -0.27), (0.052, -0.2), (0.044, -0.1), (0.04, 0.0)], (0.168 * s, 0, NECK - 0.03), robeW, seg=16, cap=False), 0.01),
                           torus(f"_hcuff{side}", 0.062, 0.008, (0.168 * s, 0, NECK - 0.3), gold, seg=16, mseg=5)]
assemble(N, P, extra)

N = "W_Scepter"; delete_hierarchy(N); Rw = empty(N)
objs = [tube("_sh", [(0, 0, -0.25), (0, 0, 0.55)], [0.019], leatherD, seg=10, sub=1),
        torus("_b1", 0.022, 0.007, (0, 0, 0.06), gold, seg=12, mseg=5), torus("_b2", 0.022, 0.007, (0, 0, -0.06), gold, seg=12, mseg=5),
        ell("_foot", 0.026, (0, 0, -0.26), gold, scale=(1, 1, 1.3), seg=12, rings=8),
        lathe("_hb", [(0.02, 0.53), (0.04, 0.57), (0.06, 0.6), (0.05, 0.62)], (0, 0, 0), gold, seg=16),
        torus("_ring", 0.09, 0.013, (0, 0, 0.71), gold, seg=24, mseg=6, rot=(math.radians(90), 0, 0)),
        ell("_cr", 0.05, (0, 0, 0.71), crystal, scale=(0.8, 0.8, 1.4), seg=14, rings=10),
        ell("_top", 0.022, (0, 0, 0.81), gold, seg=12, rings=8)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Skeleton King (boss) =================
N = "SkelKing"
P = skeleton_parts(eyeRed, R_head=1.06, ribs=False, torso=True)
HC = P['HC']
crown = [solidify(lathe("_crown", [(0.19, 0.0), (0.2, 0.08)], (HC[0], HC[1] + 0.01, HC[2] + 0.13), gold, seg=32, cap=False), 0.014),
         torus("_crownB", 0.192, 0.014, (HC[0], HC[1] + 0.01, HC[2] + 0.13), gold, seg=32, mseg=6),
         torus("_crownT", 0.2, 0.011, (HC[0], HC[1] + 0.01, HC[2] + 0.21), gold, seg=32, mseg=6)]
for k in range(7):
    a = k / 7 * 2 * math.pi
    c, s = math.sin(a), -math.cos(a)
    h = 0.13 if k == 0 else 0.1
    base = Vector((HC[0] + c * 0.198, HC[1] + 0.01 + s * 0.198, HC[2] + 0.2))
    tip = base + Vector((c * 0.02, s * 0.02, h))
    crown += [tube(f"_cpt{k}", [base, base.lerp(tip, 0.6) + Vector((c * 0.01, s * 0.01, 0)), tip], [0.03, 0.02, 0.012], gold, seg=8, sub=3),
              ell(f"_cball{k}", 0.02, tip, gold, seg=10, rings=6)]
    if k % 2 == 0:
        crown.append(ell(f"_cgem{k}", 0.018, (HC[0] + c * 0.208, HC[1] + 0.01 + s * 0.208, HC[2] + 0.17), bossGlow, scale=(1, 1, 1.3), seg=10, rings=6))
fur_ring = [ell(f"_fur{k}", 0.05, (math.cos(k / 14 * 6.283) * 0.16, math.sin(k / 14 * 6.283) * 0.13 + 0.01, NECK + 0.0 + 0.01 * math.sin(k * 1.7)), fur,
                scale=(1.1, 1.0, 0.85), seg=12, rings=8) for k in range(14)]
extra = {
    'Head': crown,
    'Body': [rbox("_kchest", (0.28, 0.2, 0.2), (0, 0, NECK - 0.12), kingArmor, r=0.05, seg=3, taper=(1.15, 1.0), sub=1),
             rbox("_kplate", (0.13, 0.03, 0.13), (0, -0.105, NECK - 0.12), kingArmorL, r=0.015, seg=2, sub=1),
             ell("_kgem", 0.026, (0, -0.124, NECK - 0.11), bossGlow, scale=(1, 0.5, 1.2), seg=12, rings=8),
             torus("_kbelt", 0.12, 0.02, (0, 0, HIP + 0.045), gold, seg=28, mseg=6, scale=(1.05, 0.8, 1)),
             ell("_kbuckle", 0.03, (0, -0.1, HIP + 0.045), gold, scale=(1.2, 0.5, 1), seg=12, rings=8),
             cloth_skirt("_ktabard", 0.12, 0.15, HIP + 0.05, HIP - 0.15, kingCape, folds=7, amp=0.01, sy=0.75, hem_wave=0.02)] + fur_ring,
    'LegL': [lathe("_kgrL", [(0.035, 0.07), (0.042, 0.13), (0.04, 0.2), (0.034, 0.22)], (0.07, -0.005, 0), kingArmor, seg=16),
             rbox("_kbootL", (0.085, 0.13, 0.055), (0.07, -0.025, 0.03), kingArmorL, r=0.02, seg=2, sub=1)],
    'LegR': [lathe("_kgrR", [(0.035, 0.07), (0.042, 0.13), (0.04, 0.2), (0.034, 0.22)], (-0.07, -0.005, 0), kingArmor, seg=16),
             rbox("_kbootR", (0.085, 0.13, 0.055), (-0.07, -0.025, 0.03), kingArmorL, r=0.02, seg=2, sub=1)],
    'Cape': [[cape_sheet("_kcape", 0.19, 0.3, 0.58, NECK + 0.02, 0.12, kingCape, bulge=0.07)], (0, 0.12, NECK + 0.02)],
}
for side, s in (('L', 1), ('R', -1)):
    d = solidify(lathe(f"_kpad{side}", [(0.1, -0.04), (0.095, 0.01), (0.07, 0.055), (0.0, 0.07)], (0, 0, 0), kingArmor, seg=22, cap=False), 0.014)
    rim = torus(f"_kpadRim{side}", 0.1, 0.012, (0, 0, -0.04), gold, seg=22, mseg=6)
    spk = tube(f"_kspk{side}", [(0, 0, 0.06), (0, 0, 0.12), (0.02, 0, 0.17)], [0.028, 0.018, 0.01], kingArmorL, seg=8, sub=3)
    xf([d, rim, spk], loc=(0.185 * s, 0, NECK - 0.015), rot=(0, math.radians(-28) * s, 0))
    extra['Arm' + side] = [d, rim, spk, lathe(f"_kbrac{side}", [(0.034, -0.05), (0.042, 0.0), (0.04, 0.035)], (0.172 * s, 0, NECK - 0.235), kingArmor, seg=16)]
assemble(N, P, extra)

N = "W_BossSword"; delete_hierarchy(N); Rw = empty(N)
prof = [(0.09, 0.07, 0.016), (0.2, 0.085, 0.017), (0.32, 0.07, 0.016), (0.44, 0.088, 0.016), (0.56, 0.07, 0.015), (0.68, 0.06, 0.013), (0.78, 0.03, 0.01), (0.84, 0.0, 0.0)]
objs = [blade("_bb", prof, bossBlade),
        blade("_bg", [(0.1, 0.014, 0.019), (0.62, 0.012, 0.019), (0.7, 0.0, 0.0)], bossGlow),
        rbox("_bgd", (0.09, 0.06, 0.06), (0, 0, 0.075), kingArmorL, r=0.018, seg=2),
        tube("_wingL", [(0.04, 0, 0.075), (0.11, 0, 0.09), (0.16, 0, 0.14)], [0.026, 0.02, 0.012], kingArmorL, seg=9, sub=3),
        tube("_wingR", [(-0.04, 0, 0.075), (-0.11, 0, 0.09), (-0.16, 0, 0.14)], [0.026, 0.02, 0.012], kingArmorL, seg=9, sub=3),
        ell("_bgem", 0.024, (0, -0.032, 0.075), bossGlow, scale=(1, 0.5, 1.2), seg=12, rings=8),
        ] + wrap_grip("_gr", -0.065, 0.05, 0.026, kingCapeD, gold) + [
        ell("_bp", 0.034, (0, 0, -0.09), bossGlow, seg=14, rings=10)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# preview layout
lay = {"SkelWarrior": -1.6, "SkelArcher": -0.8, "Necro": 0.0, "Healer": 0.8, "SkelKing": 1.9}
for n, x in lay.items():
    bpy.data.objects[n].location = (x, -2.0, 0)
    print(n, tris(n))
bpy.data.objects["SkelKing"].scale = (1.6, 1.6, 1.6)
wl = {"W_EnemySword": -1.6, "W_ArcherBow": -0.8, "P_Arrow": -0.5, "W_NecroOrb": 0.0, "W_Scepter": 0.8, "W_BossSword": 1.9}
for n, x in wl.items():
    bpy.data.objects[n].location = (x, -3.2, 0.3)
