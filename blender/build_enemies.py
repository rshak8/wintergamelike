import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *

bone = mat("M_Bone", "#e9dcc0", rough=0.7)
boneD = mat("M_BoneShade", "#b8a88a", rough=0.8)
socket = mat("M_Socket", "#120c0c", rough=0.9)
eyeRed = mat("M_EyeRed", "#ff3030", emit="#ff2020", emit_strength=5.0)
eyePurple = mat("M_EyePurple", "#c06bff", emit="#a040ff", emit_strength=5.0)
eyeCyan = mat("M_EyeCyan", "#6bf0ff", emit="#40e0ff", emit_strength=5.0)
armor = mat("M_ArmorDark", "#3e4252", rough=0.45, metal=0.6)
armorL = mat("M_ArmorLight", "#6a7086", rough=0.4, metal=0.6)
cloth = mat("M_ClothRed", "#8a1a22", rough=0.85)
hood = mat("M_HoodGreen", "#3d4a2c", rough=0.85)
hoodD = mat("M_HoodGreenDark", "#2a3320", rough=0.85)
robeP = mat("M_RobePurple", "#3a2350", rough=0.85)
robePD = mat("M_RobePurpleDark", "#24153a", rough=0.85)
purpleGlow = mat("M_PurpleTrim", "#9a4cff", emit="#8a3cff", emit_strength=2.5)
robeW = mat("M_RobeWhite", "#e4e6ee", rough=0.8)
robeB = mat("M_RobeBlue", "#2f5fae", rough=0.8)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
leather = mat("M_Leather", "#7a4a2a", rough=0.8)
leatherD = mat("M_LeatherDark", "#4f2f1b", rough=0.8)
wood = mat("M_BowWood", "#7a4a26", rough=0.8)
string = mat("M_String", "#d8d0b8", rough=0.8)
steel = mat("M_Steel", "#aeb3c2", rough=0.35, metal=0.7)
steelD = mat("M_SteelDark", "#6c7183", rough=0.4, metal=0.6)
gripRed = mat("M_GripRed", "#8e1d22", rough=0.8)
orbM = mat("M_NecroOrb", "#b060ff", emit="#9a40ff", emit_strength=5.0)
crystal = mat("M_Crystal", "#6be6ff", emit="#40d0ff", emit_strength=4.0)
kingArmor = mat("M_KingArmor", "#2e2a30", rough=0.45, metal=0.6)
kingArmorL = mat("M_KingArmorL", "#5a5058", rough=0.4, metal=0.6)
kingCape = mat("M_KingCape", "#8a1622", rough=0.85)
kingCapeD = mat("M_KingCapeDark", "#5a0e18", rough=0.85)
bossBlade = mat("M_BossBlade", "#3a2a30", rough=0.4, metal=0.6)
bossGlow = mat("M_BossGlow", "#ff2a2a", emit="#ff1a1a", emit_strength=4.0)


def skull(px, H, eyeM, r=0.2):
    objs = [
        sph(px + "cran", r, (0, 0.01, H + 0.02), bone, scale=(1.0, 1.05, 0.95), seg=12, rings=8),
        box(px + "jaw", (r * 1.15, r * 0.9, r * 0.55), (0, -r * 0.35, H - r * 0.62), bone, bevel=0.03, seg=1, taper=(1.15, 1.0)),
        sph(px + "sockL", r * 0.3, (r * 0.4, -r * 0.82, H - r * 0.05), socket, scale=(1, 0.6, 1.05), seg=8, rings=5),
        sph(px + "sockR", r * 0.3, (-r * 0.4, -r * 0.82, H - r * 0.05), socket, scale=(1, 0.6, 1.05), seg=8, rings=5),
        sph(px + "eyeL", r * 0.12, (r * 0.4, -r * 0.92, H - r * 0.05), eyeM, seg=6, rings=4),
        sph(px + "eyeR", r * 0.12, (-r * 0.4, -r * 0.92, H - r * 0.05), eyeM, seg=6, rings=4),
        cone(px + "nose", r * 0.1, r * 0.18, (0, -r * 0.95, H - r * 0.38), socket, verts=3, rot=(math.pi, 0, 0)),
    ]
    for k in range(4):  # teeth
        x = (k - 1.5) * r * 0.2
        objs.append(box(px + f"t{k}", (r * 0.14, r * 0.06, r * 0.16), (x, -r * 0.82, H - r * 0.55), boneD))
    return objs


def skeleton(N, eyeM, scale=1.0, head_r=0.2, robe=False):
    """Returns dict of root & part objects; parts built at scale 1 then root scaled."""
    delete_hierarchy(N)
    R = empty(N)
    HIP = 0.34; NECK = 0.6
    P = {}
    # legs
    for side, s in (('L', 1), ('R', -1)):
        x = 0.07 * s
        objs = [
            cyl(f"_femur{side}", 0.025, 0.15, (x, 0, HIP - 0.08), bone, verts=6),
            sph(f"_knee{side}", 0.035, (x, 0, HIP - 0.17), boneD, seg=6, rings=4),
            cyl(f"_tibia{side}", 0.022, 0.13, (x, 0, HIP - 0.25), bone, verts=6),
            box(f"_foot{side}", (0.07, 0.12, 0.04), (x, -0.025, 0.025), bone, bevel=0.015),
        ]
        P['Leg' + side] = (objs, (x, 0, HIP - 0.01))
    # body
    body = [
        box("_pelvis", (0.2, 0.12, 0.07), (0, 0, HIP), bone, bevel=0.025),
        cyl("_spine", 0.025, 0.24, (0, 0.02, HIP + 0.12), boneD, verts=6),
    ]
    for k in range(3):
        body.append(torus(f"_rib{k}", 0.085 - k * 0.006, 0.016, (0, 0.0, NECK - 0.07 - k * 0.055), bone, seg=10, mseg=4, scale=(1.15, 0.85, 1.0)))
    body.append(box("_clav", (0.3, 0.06, 0.04), (0, 0.0, NECK - 0.02), bone, bevel=0.015))
    P['Body'] = (body, (0, 0, HIP))
    P['Head'] = (skull("_", NECK + 0.2 * head_r / 0.2 + 0.03, eyeM, head_r), (0, 0, NECK))
    for side, s in (('L', 1), ('R', -1)):
        sx = 0.16 * s
        objs = [
            sph(f"_shoulder{side}", 0.035, (sx, 0, NECK - 0.03), boneD, seg=6, rings=4),
            cyl(f"_hum{side}", 0.02, 0.13, (sx + 0.005 * s, 0, NECK - 0.11), bone, verts=6),
            cyl(f"_rad{side}", 0.018, 0.11, (sx + 0.01 * s, 0, NECK - 0.24), bone, verts=6),
            sph(f"_hand{side}", 0.035, (sx + 0.012 * s, 0, NECK - 0.31), bone, seg=6, rings=4),
        ]
        P['Arm' + side] = (objs, (sx, 0, NECK - 0.03))
    return R, P, HIP, NECK


def assemble(N, R, P, extra, sc=1.0):
    """extra: dict partName -> list of extra objs to merge in. Creates hierarchy."""
    for k, v in extra.items():
        if k not in P:
            P[k] = ([], v[1]) if isinstance(v, tuple) else ([], (0, 0, 0))
    def objs_of(k):
        base = P[k][0]
        ex = extra.get(k, [])
        if isinstance(ex, tuple):
            ex = ex[0]
        return base + ex
    body = part(f"{N}_Body", objs_of('Body'), P['Body'][1], R)
    for k in ('LegL', 'LegR'):
        part(f"{N}_{k}", objs_of(k), P[k][1], R)
    part(f"{N}_Head", objs_of('Head'), P['Head'][1], body)
    for k in ('ArmL', 'ArmR'):
        a = part(f"{N}_{k}", objs_of(k), P[k][1], body)
        hx = P[k][1][0] + (0.012 if k == 'ArmL' else -0.012)
        h = empty(f"{N}_Hand{k[-1]}", (hx, -0.01, P[k][1][2] - 0.28), 0.04)
        parent(h, a)
    if 'Cape' in extra:
        part(f"{N}_Cape", objs_of('Cape'), P['Cape'][1], body)
    R.scale = (sc, sc, sc)
    return R

# ================= Skeleton Warrior =================
N = "SkelWarrior"
R, P, HIP, NECK = skeleton(N, eyeRed)
extra = {
    'Body': [
        box("_chest", (0.24, 0.17, 0.16), (0, 0, NECK - 0.1), armor, bevel=0.03, taper=(1.1, 1.0)),
        box("_chestRim", (0.25, 0.18, 0.03), (0, 0, NECK - 0.17), armorL, bevel=0.01),
        box("_belt", (0.22, 0.14, 0.04), (0, 0, HIP + 0.03), leatherD, bevel=0.01),
        poly_extrude("_loin", [(-0.06, 0), (0.06, 0), (0.07, -0.14), (0.02, -0.11), (-0.01, -0.16), (-0.07, -0.12)], 0.02, (0, -0.075, HIP + 0.02), cloth),
        poly_extrude("_loinB", [(-0.08, 0), (0.08, 0), (0.09, -0.15), (0.03, -0.12), (-0.02, -0.17), (-0.09, -0.13)], 0.02, (0, 0.075, HIP + 0.02), cloth),
        torus("_scarf", 0.1, 0.03, (0, 0, NECK + 0.0), cloth, seg=10, mseg=4, scale=(1.1, 1.0, 0.8)),
    ],
    'ArmL': [sph("_padL", 0.07, (0.17, 0, NECK - 0.01), armorL, scale=(1.1, 1.0, 0.75), seg=8, rings=5),
             cyl("_bracL", 0.032, 0.06, (0.172, 0, NECK - 0.24), armor, verts=6)],
    'ArmR': [sph("_padR", 0.07, (-0.17, 0, NECK - 0.01), armorL, scale=(1.1, 1.0, 0.75), seg=8, rings=5),
             cyl("_bracR", 0.032, 0.06, (-0.172, 0, NECK - 0.24), armor, verts=6)],
    'LegL': [box("_greaveL", (0.065, 0.07, 0.08), (0.07, -0.01, HIP - 0.25), armor, bevel=0.01)],
    'LegR': [box("_greaveR", (0.065, 0.07, 0.08), (-0.07, -0.01, HIP - 0.25), armor, bevel=0.01)],
}
assemble(N, R, P, extra)

# warrior sword (weapon)
N = "W_EnemySword"; delete_hierarchy(N); Rw = empty(N)
objs = [poly_extrude("_b", [(-0.045, 0), (0.045, 0), (0.04, 0.42), (0, 0.5), (-0.04, 0.42)], 0.025, (0, 0, 0.07), steel, plane='XZ'),
        box("_g", (0.16, 0.05, 0.035), (0, 0, 0.06), steelD, bevel=0.01),
        cyl("_h", 0.022, 0.12, (0, 0, -0.01), gripRed, verts=6),
        sph("_p", 0.028, (0, 0, -0.08), steelD, seg=6, rings=4, smooth=False)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Skeleton Archer =================
N = "SkelArcher"
R, P, HIP, NECK = skeleton(N, eyeRed)
H = NECK + 0.23
extra = {
    'Head': [
        sph("_hood", 0.25, (0, 0.1, H + 0.03), hood, scale=(1.0, 0.95, 1.0), seg=12, rings=8),
        cone("_hoodTip", 0.12, 0.22, (0, 0.17, H + 0.12), hood, verts=6, rot=(math.radians(70), 0, 0)),
    ],
    'Body': [
        cyl("_cloak", 0.2, 0.34, (0, 0.02, NECK - 0.14), hoodD, verts=8, r2=0.13),
        box("_beltA", (0.2, 0.13, 0.035), (0, 0, HIP + 0.04), leather),
        # quiver on back with arrows
        cyl("_quiver", 0.05, 0.26, (0.06, 0.13, NECK - 0.08), leather, verts=6, rot=(math.radians(-15), math.radians(20), 0)),
        box("_qStrap", (0.03, 0.2, 0.34), (0.0, 0.0, NECK - 0.12), leatherD, rot=(0, math.radians(-35), 0)),
    ] + [cyl(f"_arw{k}", 0.008, 0.16, (0.06 + 0.02 * (k - 1), 0.16 + 0.02 * k, NECK + 0.08), wood, verts=4, rot=(math.radians(-15), math.radians(20), 0)) for k in range(3)]
      + [cone(f"_fl{k}", 0.02, 0.05, (0.08 + 0.02 * (k - 1), 0.18 + 0.02 * k, NECK + 0.15), string, verts=3, rot=(math.radians(-15), math.radians(20), 0)) for k in range(3)],
    'Cape': ([poly_extrude("_cloakBack", [(-0.15, 0), (0.15, 0), (0.18, -0.3), (0.08, -0.26), (0.0, -0.33), (-0.09, -0.27), (-0.18, -0.31)], 0.02, (0, 0.12, NECK), hood, plane='XZ', rot=(math.radians(10), 0, 0))], (0, 0.12, NECK)),
}
assemble(N, R, P, extra)

N = "W_ArcherBow"; delete_hierarchy(N); Rw = empty(N)
objs = [cyl("_gr", 0.025, 0.12, (0, 0, 0), leatherD, verts=6),
        box("_wrap", (0.06, 0.06, 0.05), (0, 0, 0), mat("M_WrapGreen", "#5a7a4a")),
        ]
pts = [(0.0, 0.06), (-0.05, 0.2), (-0.06, 0.33), (-0.03, 0.42)]
for s in (1, -1):
    for i in range(3):
        a = Vector(pts[i]); b = Vector(pts[i + 1]); mid = (a + b) / 2; d = b - a
        objs.append(box(f"_l{s}{i}", (0.03, 0.04, d.length + 0.02), (0, mid.x, mid.y * s), wood, rot=(math.atan2(-d.x, d.y * s), 0, 0)))
objs.append(cyl("_str", 0.004, 0.86, (0, 0.0, 0), string, verts=4))
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

N = "P_Arrow"; delete_hierarchy(N); Rw = empty(N)
objs = [cyl("_s", 0.01, 0.42, (0, 0, 0), wood, verts=4), cone("_h", 0.03, 0.08, (0, 0, 0.24), steelD, verts=4),
        box("_f1", (0.05, 0.004, 0.07), (0, 0, -0.18), string), box("_f2", (0.004, 0.05, 0.07), (0, 0, -0.18), string)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Necromancer =================
N = "Necro"
R, P, HIP, NECK = skeleton(N, eyePurple)
H = NECK + 0.23
extra = {
    'Head': [sph("_nhood", 0.255, (0, 0.1, H + 0.03), robeP, scale=(1.0, 0.95, 1.02), seg=12, rings=8),
             cone("_nhoodTip", 0.13, 0.26, (0, 0.13, H + 0.2), robeP, verts=6, rot=(math.radians(35), 0, 0))],
    'Body': [
        cyl("_robe", 0.14, 0.5, (0, 0, NECK - 0.3), robeP, verts=8, r2=0.27 * 0 + 0.13, scale=(1, 1, 1)),
        cyl("_robeSkirt", 0.25, 0.3, (0, 0, 0.15), robePD, verts=8, r2=0.15),
        torus("_trim", 0.25, 0.018, (0, 0, 0.02), purpleGlow, seg=12, mseg=4),
        box("_sash", (0.05, 0.02, 0.3), (0, -0.16, 0.2), purpleGlow),
        cone("_spikeL", 0.05, 0.14, (0.18, 0, NECK + 0.04), armor, verts=4, rot=(0, math.radians(-35), 0)),
        cone("_spikeR", 0.05, 0.14, (-0.18, 0, NECK + 0.04), armor, verts=4, rot=(0, math.radians(35), 0)),
        sph("_padNL", 0.075, (0.17, 0, NECK - 0.02), armor, scale=(1.1, 1, 0.7), seg=8, rings=5),
        sph("_padNR", 0.075, (-0.17, 0, NECK - 0.02), armor, scale=(1.1, 1, 0.7), seg=8, rings=5),
    ],
    'ArmL': [cyl("_sleeveL", 0.05, 0.2, (0.175, 0, NECK - 0.15), robeP, verts=6, r2=0.04)],
    'ArmR': [cyl("_sleeveR", 0.05, 0.2, (-0.175, 0, NECK - 0.15), robeP, verts=6, r2=0.04)],
    'Cape': ([poly_extrude("_ncape", [(-0.16, 0), (0.16, 0), (0.24, -0.5), (0.1, -0.45), (0.0, -0.55), (-0.1, -0.46), (-0.24, -0.5)], 0.02, (0, 0.11, NECK), robePD, plane='XZ', rot=(math.radians(6), 0, 0))], (0, 0.11, NECK)),
}
assemble(N, R, P, extra)

N = "W_NecroOrb"; delete_hierarchy(N); Rw = empty(N)
objs = [sph("_core", 0.09, (0, 0, 0), orbM, seg=10, rings=7)]
for k in range(4):
    a = k * math.pi / 2
    objs.append(cone(f"_claw{k}", 0.025, 0.16, (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.0), armor, verts=4,
                     rot=(-math.sin(a) * 1.3, math.cos(a) * 1.3, 0)))
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Healer =================
N = "Healer"
R, P, HIP, NECK = skeleton(N, eyeCyan)
H = NECK + 0.23
extra = {
    'Head': [sph("_hhood", 0.255, (0, 0.1, H + 0.03), robeW, scale=(1.0, 0.95, 1.05), seg=12, rings=8),
             torus("_hhoodRim", 0.2, 0.022, (0, -0.12, H + 0.0), robeB, seg=12, mseg=4, rot=(math.radians(90), 0, 0), scale=(1, 1.1, 1))],
    'Body': [
        cyl("_hrobe", 0.15, 0.5, (0, 0, NECK - 0.3), robeW, verts=8),
        cyl("_hskirt", 0.24, 0.3, (0, 0, 0.15), robeW, verts=8, r2=0.15),
        box("_hpanel", (0.1, 0.02, 0.5), (0, -0.165, 0.28), robeB),
        box("_hbelt", (0.3, 0.3, 0.04), (0, 0, HIP + 0.06), gold, bevel=0.01, taper=(1, 1)),
        torus("_htrim", 0.24, 0.016, (0, 0, 0.02), gold, seg=12, mseg=4),
        sph("_hpadL", 0.07, (0.17, 0, NECK - 0.02), robeB, scale=(1.1, 1, 0.7), seg=8, rings=5),
        sph("_hpadR", 0.07, (-0.17, 0, NECK - 0.02), robeB, scale=(1.1, 1, 0.7), seg=8, rings=5),
    ],
    'ArmL': [cyl("_hsleeveL", 0.05, 0.2, (0.175, 0, NECK - 0.15), robeW, verts=6, r2=0.04)],
    'ArmR': [cyl("_hsleeveR", 0.05, 0.2, (-0.175, 0, NECK - 0.15), robeW, verts=6, r2=0.04)],
}
assemble(N, R, P, extra)

N = "W_Scepter"; delete_hierarchy(N); Rw = empty(N)
objs = [cyl("_sh", 0.022, 0.8, (0, 0, 0.15), leatherD, verts=6),
        box("_b1", (0.055, 0.055, 0.025), (0, 0, 0.0), gold),
        cyl("_hb", 0.04, 0.06, (0, 0, 0.56), gold, verts=6, r2=0.07),
        torus("_ring", 0.1, 0.018, (0, 0, 0.7), gold, seg=10, mseg=4, rot=(math.radians(90), 0, 0)),
        sph("_cr", 0.065, (0, 0, 0.7), crystal, seg=4, rings=3, smooth=False, scale=(0.8, 0.8, 1.5)),
        cone("_top", 0.025, 0.08, (0, 0, 0.84), gold, verts=4)]
part(f"{N}_Mesh", objs, (0, 0, 0), Rw)

# ================= Skeleton King (boss) =================
N = "SkelKing"
R, P, HIP, NECK = skeleton(N, eyeRed, head_r=0.21)
H = NECK + 0.24
spk = []
for k in range(5):
    a = (k - 2) * 0.55
    spk.append(cone(f"_cs{k}", 0.035, 0.16 if k != 2 else 0.22, (math.sin(a) * 0.17, -math.cos(a) * 0.17, H + 0.24 + (0.03 if k == 2 else 0)), gold, verts=4))
for k in range(3):
    a = math.pi + (k - 1) * 0.7
    spk.append(cone(f"_csb{k}", 0.03, 0.13, (math.sin(a) * 0.17, -math.cos(a) * 0.17, H + 0.22), gold, verts=4))
extra = {
    'Head': [
        cyl("_crown", 0.19, 0.08, (0, 0, H + 0.15), gold, verts=10, r2=0.2),
        sph("_crownGem", 0.035, (0, -0.2, H + 0.15), bossGlow, seg=4, rings=3, smooth=False, scale=(1, 0.6, 1.3)),
    ] + spk,
    'Body': [
        box("_kchest", (0.3, 0.2, 0.22), (0, 0, NECK - 0.12), kingArmor, bevel=0.03, taper=(1.15, 1.0)),
        box("_kchestPlate", (0.14, 0.03, 0.14), (0, -0.105, NECK - 0.12), kingArmorL, bevel=0.01),
        sph("_kgem", 0.03, (0, -0.125, NECK - 0.1), bossGlow, seg=4, rings=3, smooth=False),
        box("_kbelt", (0.26, 0.18, 0.05), (0, 0, HIP + 0.04), gold, bevel=0.01),
        poly_extrude("_ktabard", [(-0.07, 0), (0.07, 0), (0.08, -0.26), (0.0, -0.22), (-0.08, -0.26)], 0.02, (0, -0.1, HIP + 0.05), kingCape),
        box("_kcollar", (0.3, 0.18, 0.06), (0, 0.02, NECK + 0.01), kingArmorL, bevel=0.02),
    ],
    'ArmL': [sph("_kpadL", 0.1, (0.2, 0, NECK), kingArmor, scale=(1.1, 1.0, 0.8), seg=8, rings=5),
             cone("_kpsL", 0.04, 0.14, (0.25, 0, NECK + 0.08), kingArmorL, verts=4, rot=(0, math.radians(-30), 0)),
             cyl("_kbracL", 0.04, 0.09, (0.175, 0, NECK - 0.24), kingArmor, verts=6),
             sph("_kfistL", 0.05, (0.176, 0, NECK - 0.31), kingArmor, seg=6, rings=4)],
    'ArmR': [sph("_kpadR", 0.1, (-0.2, 0, NECK), kingArmor, scale=(1.1, 1.0, 0.8), seg=8, rings=5),
             cone("_kpsR", 0.04, 0.14, (-0.25, 0, NECK + 0.08), kingArmorL, verts=4, rot=(0, math.radians(30), 0)),
             cyl("_kbracR", 0.04, 0.09, (-0.175, 0, NECK - 0.24), kingArmor, verts=6),
             sph("_kfistR", 0.05, (-0.176, 0, NECK - 0.31), kingArmor, seg=6, rings=4)],
    'LegL': [box("_kgrL", (0.08, 0.09, 0.14), (0.07, -0.0, HIP - 0.23), kingArmor, bevel=0.015),
             box("_kbootL", (0.09, 0.14, 0.06), (0.07, -0.025, 0.03), kingArmorL, bevel=0.015)],
    'LegR': [box("_kgrR", (0.08, 0.09, 0.14), (-0.07, -0.0, HIP - 0.23), kingArmor, bevel=0.015),
             box("_kbootR", (0.09, 0.14, 0.06), (-0.07, -0.025, 0.03), kingArmorL, bevel=0.015)],
    'Cape': ([poly_extrude("_kcape", [(-0.2, 0), (0.2, 0), (0.3, -0.56), (0.18, -0.5), (0.08, -0.6), (-0.04, -0.52), (-0.16, -0.6), (-0.3, -0.54)], 0.025, (0, 0.13, NECK + 0.02), kingCape, plane='XZ', rot=(math.radians(10), 0, 0))], (0, 0.13, NECK + 0.02)),
}
assemble(N, R, P, extra, sc=1.0)

N = "W_BossSword"; delete_hierarchy(N); Rw = empty(N)
pts = [(-0.07, 0), (0.07, 0), (0.09, 0.12), (0.07, 0.2), (0.1, 0.32), (0.075, 0.44), (0.095, 0.56), (0.05, 0.7), (0.0, 0.82),
       (-0.06, 0.68), (-0.09, 0.55), (-0.07, 0.45), (-0.1, 0.33), (-0.075, 0.2), (-0.095, 0.1)]
objs = [poly_extrude("_bb", pts, 0.04, (0, 0, 0.1), bossBlade, plane='XZ'),
        poly_extrude("_bg", [(-0.02, 0), (0.02, 0), (0.012, 0.66), (0, 0.72), (-0.012, 0.66)], 0.046, (0, 0, 0.12), bossGlow, plane='XZ'),
        box("_bgd", (0.26, 0.07, 0.06), (0, 0, 0.08), kingArmorL, bevel=0.015),
        cone("_bgl", 0.035, 0.09, (0.16, 0, 0.1), kingArmorL, verts=4, rot=(0, math.radians(-60), 0)),
        cone("_bgr", 0.035, 0.09, (-0.16, 0, 0.1), kingArmorL, verts=4, rot=(0, math.radians(60), 0)),
        cyl("_bh", 0.03, 0.18, (0, 0, -0.03), kingCapeD, verts=6),
        sph("_bp", 0.04, (0, 0, -0.13), bossGlow, seg=4, rings=3, smooth=False)]
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
