import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *
from mathutils import Vector

# Weapon convention: origin = centre of the grip (where the fist closes), handle/blade along +Z,
# blade width along X, flat faces toward -Y/+Y. The fist covers z = -0.05..0.05.
steel = mat("M_Steel", "#c3c8d6", rough=0.28, metal=0.75)
steelD = mat("M_SteelDark", "#6c7183", rough=0.4, metal=0.6)
gripRed = mat("M_GripRed", "#8e1d22", rough=0.8)
leatherD = mat("M_LeatherDark", "#4f2f1b", rough=0.8)
gem = mat("M_GemRed", "#ff2a3a", emit="#ff2030", emit_strength=2.0)
fire = mat("M_FireBlade", "#ff5a1a", emit="#ff4a10", emit_strength=3.0)
fireCore = mat("M_FireCore", "#ffd04a", emit="#ffb020", emit_strength=4.0)
darkRed = mat("M_DarkMetalRed", "#4a1c1c", rough=0.45, metal=0.55)
ice = mat("M_Ice", "#8fe0ff", emit="#4ab8ff", emit_strength=2.0, rough=0.15)
iceDark = mat("M_IceDark", "#2a3c66", rough=0.35, metal=0.5)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
wood = mat("M_WoodDark", "#4a3326", rough=0.75)
violet = mat("M_Lightning", "#b08aff", emit="#8a5cff", emit_strength=4.0)
blueOrb = mat("M_OrbBlue", "#3a6bff", emit="#4a7cff", emit_strength=4.0)
poison = mat("M_Poison", "#5aff3a", emit="#3aff20", emit_strength=3.0)
poisonD = mat("M_PoisonSteel", "#4a5a52", rough=0.32, metal=0.65)
wrapTeal = mat("M_WrapTeal", "#2e5a6a", rough=0.8)
holyBlue = mat("M_HolyGem", "#5ad0ff", emit="#4ac0ff", emit_strength=3.0)
hammerM = mat("M_HammerSteel", "#9a9caa", rough=0.35, metal=0.65)
white = mat("M_IceFeather", "#e8f6ff", rough=0.6)


def finish(N, objs):
    delete_hierarchy(N)
    R = empty(N)
    part(f"{N}_Mesh", objs, (0, 0, 0), R)
    return R


def crossguard(px, half, m, ballM, y=0.0, z=0.07, curve=0.02, r=0.016):
    return [tube(px + "bar", [(-half, y, z + curve), (-half * 0.5, y, z + curve * 0.2), (0, y, z), (half * 0.5, y, z + curve * 0.2), (half, y, z + curve)],
                 [r * 0.8, r, r * 1.15, r, r * 0.8], m, seg=10, sub=3),
            ell(px + "bL", r * 1.5, (-half, y, z + curve), ballM, seg=12, rings=8),
            ell(px + "bR", r * 1.5, (half, y, z + curve), ballM, seg=12, rings=8)]


# ---------------- Knight sword (starting weapon) ----------------
objs = [blade("_blade", [(0.07, 0.046, 0.011), (0.12, 0.05, 0.012), (0.5, 0.044, 0.011), (0.6, 0.03, 0.009), (0.665, 0.008, 0.004), (0.675, 0.0, 0.0)], steel),
        tube("_fuller", [(0, -0.008, 0.11), (0, -0.008, 0.5)], [0.008], steelD, seg=8, sub=1, flat=0.4, up=(0, 1, 0)),
        tube("_fullerB", [(0, 0.008, 0.11), (0, 0.008, 0.5)], [0.008], steelD, seg=8, sub=1, flat=0.4, up=(0, 1, 0)),
        rbox("_guardC", (0.05, 0.04, 0.04), (0, 0, 0.068), steelD, r=0.012, seg=2),
        ell("_gem", 0.017, (0, -0.021, 0.068), gem, scale=(1, 0.5, 1.2), seg=12, rings=8),
        ell("_gemB", 0.017, (0, 0.021, 0.068), gem, scale=(1, 0.5, 1.2), seg=12, rings=8),
        ] + crossguard("_cg", 0.1, steelD, gold) + wrap_grip("_gr", -0.06, 0.05, 0.022, gripRed, leatherD) + [
        ell("_pommel", 0.03, (0, 0, -0.082), gold, scale=(1, 1, 0.9), seg=14, rings=10),
        ell("_pomGem", 0.012, (0, -0.026, -0.082), gem, seg=10, rings=6)]
finish("W_Sword", objs)

# ---------------- Fire sword (wavy flame blade) ----------------
prof = []
for i in range(15):
    z = 0.08 + i * 0.045
    t = i / 14
    w = (0.058 - 0.03 * t) * (1 + 0.22 * math.sin(i * 1.3))
    prof.append((z, max(0.012, w), 0.013))
prof += [(0.75, 0.008, 0.005), (0.762, 0.0, 0.0)]
objs = [blade("_flame", prof, fire, xoff=lambda z: 0.012 * math.sin(z * 18)),
        blade("_core", [(0.09, 0.016, 0.015), (0.4, 0.013, 0.015), (0.62, 0.006, 0.01), (0.66, 0.0, 0.0)], fireCore,
              xoff=lambda z: 0.012 * math.sin(z * 18)),
        rbox("_guardC", (0.07, 0.045, 0.05), (0, 0, 0.068), darkRed, r=0.015, seg=2),
        ell("_gem", 0.02, (0, -0.024, 0.07), fireCore, scale=(1, 0.5, 1.2), seg=12, rings=8),
        tube("_hornL", [(0.03, 0, 0.07), (0.08, 0, 0.08), (0.11, 0, 0.12), (0.1, 0, 0.15)], [0.016, 0.014, 0.01, 0.006], darkRed, seg=9, sub=3),
        tube("_hornR", [(-0.03, 0, 0.07), (-0.08, 0, 0.08), (-0.11, 0, 0.12), (-0.1, 0, 0.15)], [0.016, 0.014, 0.01, 0.006], darkRed, seg=9, sub=3),
        ] + wrap_grip("_gr", -0.06, 0.05, 0.023, darkRed, gold) + [
        ell("_pommel", 0.03, (0, 0, -0.083), darkRed, seg=14, rings=10),
        ell("_pomGem", 0.016, (0, -0.024, -0.083), fireCore, seg=10, rings=6)]
finish("W_FireSword", objs)

# ---------------- Ice bow (vertical: limbs along Z, curving forward to -Y, string behind at +Y) ----------------
def limb(s):
    pts = [(0, 0, 0.05 * s), (0, -0.05, 0.2 * s), (0, -0.075, 0.36 * s), (0, -0.04, 0.5 * s)]
    return [tube(f"_limb{s}", pts, [0.026, 0.022, 0.016, 0.01], iceDark, seg=10, sub=4, flat=0.75, up=(0, 1, 0)),
            ell(f"_crys{s}", 0.03, (0, -0.1, 0.27 * s), ice, scale=(0.6, 0.8, 1.6), seg=12, rings=8, rot=(-0.5 * s, 0, 0)),
            ell(f"_tip{s}", 0.022, (0, -0.04, 0.515 * s), ice, scale=(0.8, 0.8, 1.5), seg=12, rings=8)]
objs = limb(1) + limb(-1) + wrap_grip("_gr", -0.06, 0.06, 0.026, iceDark, white) + [
    tube("_string", [(0, -0.035, 0.5), (0, 0.012, 0), (0, -0.035, -0.5)], [0.004], white, seg=6, sub=1),
    ell("_icegem", 0.03, (0, -0.032, 0.0), ice, scale=(0.9, 0.6, 1.3), seg=12, rings=8),
    torus("_ringT", 0.028, 0.007, (0, 0, 0.066), gold, seg=14, mseg=5),
    torus("_ringB", 0.028, 0.007, (0, 0, -0.066), gold, seg=14, mseg=5)]
finish("W_IceBow", objs)

# ice arrow projectile (+Z)
objs = [tube("_shaft", [(0, 0, -0.24), (0, 0, 0.24)], [0.011], iceDark, seg=8, sub=1),
        blade("_head", [(0.22, 0.03, 0.012), (0.28, 0.032, 0.012), (0.33, 0.0, 0.0)], ice),
        tube("_f1", [(0, 0, -0.26), (0, 0, -0.16)], [0.03, 0.012], white, seg=8, sub=1, flat=0.15, up=(0, 1, 0)),
        tube("_f2", [(0, 0, -0.26), (0, 0, -0.16)], [0.03, 0.012], white, seg=8, sub=1, flat=0.15, up=(1, 0, 0))]
finish("P_IceArrow", objs)

# ---------------- Lightning staff ----------------
objs = [tube("_shaft", [(0, 0, -0.3), (0, 0, 0.3), (0, 0, 0.68)], [0.024, 0.026, 0.03], wood, seg=12, sub=2),
        torus("_bandA", 0.03, 0.008, (0, 0, 0.07), gold, seg=14, mseg=5), torus("_bandB", 0.03, 0.008, (0, 0, -0.07), gold, seg=14, mseg=5),
        torus("_bandC", 0.031, 0.009, (0, 0, 0.42), gold, seg=14, mseg=5),
        ell("_foot", 0.03, (0, 0, -0.31), gold, scale=(1, 1, 1.3), seg=12, rings=8),
        lathe("_cup", [(0.032, 0.66), (0.05, 0.7), (0.07, 0.74), (0.072, 0.76), (0.06, 0.765)], (0, 0, 0), gold, seg=18),
        ell("_orb", 0.085, (0, 0, 0.86), blueOrb, seg=20, rings=14)]
for k in range(4):  # crescent prongs cradling the orb, rounded ends
    a = k * math.pi / 2 + math.pi / 4
    c, s = math.cos(a), math.sin(a)
    objs.append(tube(f"_prong{k}", [(c * 0.05, s * 0.05, 0.75), (c * 0.11, s * 0.11, 0.82), (c * 0.1, s * 0.1, 0.93), (c * 0.05, s * 0.05, 0.99)],
                     [0.016, 0.014, 0.011, 0.008], gold, seg=9, sub=3))
for k in range(3):  # little zig-zag sparks around the orb
    a = k * 2.1
    c, s = math.cos(a), math.sin(a)
    objs.append(tube(f"_spark{k}", [(c * 0.11, s * 0.11, 0.8), (c * 0.14, s * 0.13, 0.85), (c * 0.12, s * 0.15, 0.89), (c * 0.15, s * 0.16, 0.94)],
                     [0.007, 0.006, 0.005, 0.003], violet, seg=6, sub=1))
finish("W_LightningStaff", objs)

# ---------------- Poison dagger (curved kris) ----------------
objs = [blade("_blade", [(0.06, 0.036, 0.009), (0.12, 0.04, 0.01), (0.22, 0.034, 0.009), (0.3, 0.022, 0.007), (0.35, 0.006, 0.003), (0.358, 0.0, 0.0)], poisonD,
              xoff=lambda z: 0.04 * math.sin((z - 0.06) * 4.0)),
        blade("_edge", [(0.07, 0.012, 0.011), (0.25, 0.01, 0.011), (0.32, 0.004, 0.006), (0.335, 0.0, 0.0)], poison,
              xoff=lambda z: 0.04 * math.sin((z - 0.06) * 4.0)),
        tube("_guard", [(-0.06, 0, 0.06), (0, 0, 0.05), (0.06, 0, 0.06)], [0.012, 0.016, 0.012], wrapTeal, seg=10, sub=3),
        ell("_guardGem", 0.014, (0, -0.016, 0.052), poison, seg=10, rings=6),
        ] + wrap_grip("_gr", -0.055, 0.045, 0.02, wrapTeal, gold, turns=4) + [
        ell("_pommel", 0.024, (0, 0, -0.072), poison, seg=12, rings=8)]
finish("W_PoisonDagger", objs)

# ---------------- Holy hammer ----------------
objs = [tube("_shaft", [(0, 0, -0.22), (0, 0, 0.56)], [0.026], wood, seg=12, sub=1),
        torus("_bandA", 0.029, 0.008, (0, 0, 0.065), gold, seg=14, mseg=5), torus("_bandB", 0.029, 0.008, (0, 0, -0.065), gold, seg=14, mseg=5),
        ell("_foot", 0.034, (0, 0, -0.23), gold, scale=(1, 1, 1.2), seg=12, rings=8),
        rbox("_head", (0.26, 0.17, 0.17), (0, 0, 0.62), hammerM, r=0.035, seg=3, sub=1),
        lathe("_faceL", [(0.0, -0.04), (0.09, -0.04), (0.1, -0.02), (0.1, 0.02), (0.09, 0.04), (0.0, 0.04)], (0.15, 0, 0.62), gold, seg=20, rot=(0, math.pi / 2, 0)),
        lathe("_faceR", [(0.0, -0.04), (0.09, -0.04), (0.1, -0.02), (0.1, 0.02), (0.09, 0.04), (0.0, 0.04)], (-0.15, 0, 0.62), gold, seg=20, rot=(0, math.pi / 2, 0)),
        rbox("_crown", (0.1, 0.1, 0.06), (0, 0, 0.72), gold, r=0.018, seg=2),
        ell("_spike", 0.03, (0, 0, 0.77), gold, scale=(1, 1, 1.4), seg=12, rings=8),
        ell("_holyGem", 0.045, (0, -0.086, 0.62), holyBlue, scale=(0.9, 0.45, 1.25), seg=14, rings=10),
        ell("_holyGemB", 0.045, (0, 0.086, 0.62), holyBlue, scale=(0.9, 0.45, 1.25), seg=14, rings=10)]
finish("W_HolyHammer", objs)

xs = {"W_Sword": -1.2, "W_FireSword": -0.8, "W_IceBow": -0.4, "P_IceArrow": -0.1, "W_LightningStaff": 0.2, "W_PoisonDagger": 0.55, "W_HolyHammer": 0.9}
for n, x in xs.items():
    bpy.data.objects[n].location = (x, 2.0, 0.4)
    print(n, tris(n))
