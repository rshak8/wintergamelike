import sys, importlib, math
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *
from mathutils import Vector

# Treasure chest and the Mimic. Parts: <N>_Base and <N>_Lid (lid pivot on the back hinge).
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
chestBlue = mat("M_ChestBlue", "#2f4f8f", rough=0.6)
chestBlueD = mat("M_ChestBlueDark", "#1e3266", rough=0.65)
mimicR = mat("M_MimicRed", "#7a2244", rough=0.6)
mimicD = mat("M_MimicDark", "#3a0e22", rough=0.6)
mimicTrim = mat("M_MimicTrim", "#8a6a3a", rough=0.45, metal=0.55)
mouth = mat("M_MimicMouth", "#1a0508", rough=0.9)
tongue = mat("M_Tongue", "#e0506a", rough=0.5)
tooth = mat("M_Tooth", "#f4ecd8", rough=0.5)
mEye = mat("M_MimicEye", "#ffe040", emit="#ffd020", emit_strength=5.0)
pupilM = mat("M_Pupil", "#0a0d1a", rough=0.3)

W, D, Hb = 0.9, 0.6, 0.42


def planks(px, z0, z1, m, mD, front=True):
    """Plank grooves on the front and back faces."""
    o = []
    n = 3
    for i in range(1, n):
        z = z0 + (z1 - z0) * i / n
        for y in ((-D / 2 - 0.003), (D / 2 + 0.003)):
            o.append(tube(f"{px}g{i}{'f' if y < 0 else 'b'}", [(-W / 2 + 0.07, y, z), (W / 2 - 0.07, y, z)], [0.006], mD, seg=6, sub=1, flat=0.5, up=(0, 1, 0)))
    return o


def chest(N, bodyM, darkM, trimM, mimic=False):
    delete_hierarchy(N)
    R = empty(N)
    base = [rbox("_cb", (W, D, Hb), (0, 0, Hb / 2), bodyM, r=0.035, seg=3),
            rbox("_cbt", (W + 0.035, D + 0.035, 0.055), (0, 0, 0.035), trimM, r=0.014, seg=2),
            rbox("_cbt2", (W + 0.035, D + 0.035, 0.045), (0, 0, Hb - 0.022), trimM, r=0.012, seg=2)] + planks("_pb", 0.06, Hb - 0.05, bodyM, darkM)
    for sx in (1, -1):
        base.append(rbox(f"_cv{sx}", (0.075, D + 0.045, Hb - 0.02), (sx * (W / 2 - 0.06), 0, Hb / 2), trimM, r=0.014, seg=2))
        for zz in (0.1, Hb - 0.1):
            base.append(ell(f"_stud{sx}{zz}", 0.014, (sx * (W / 2 - 0.06), -D / 2 - 0.024, zz), gold, seg=10, rings=6))
    if mimic:
        base.append(rbox("_mouthIn", (W - 0.08, D - 0.08, 0.05), (0, 0, Hb - 0.01), mouth, r=0.02, seg=2))
        base.append(tube("_tongue", [(0, 0.12, Hb + 0.0), (0, -0.05, Hb + 0.05), (0.03, -0.24, Hb + 0.02), (0.06, -0.36, Hb - 0.08)],
                         [0.09, 0.085, 0.07, 0.05], tongue, seg=12, sub=4, flat=0.35))
        for k in range(7):
            x = -0.36 + k * 0.12
            base.append(tube(f"_tb{k}", [(x, -D / 2 + 0.05, Hb - 0.01), (x, -D / 2 + 0.045, Hb + 0.06), (x, -D / 2 + 0.04, Hb + 0.1)],
                             [0.032, 0.024, 0.01], tooth, seg=8, sub=2))
    part(f"{N}_Base", base, (0, 0, 0), R)

    # lid: rounded barrel top
    lid_prof = [(0.0, -W / 2), (0.2, -W / 2)]
    lidbody = lathe("_lt", [(0.0, -W / 2 + 0.001), (D / 2, -W / 2 + 0.002), (D / 2, W / 2 - 0.002), (0.0, W / 2 - 0.001)], (0, 0, Hb), bodyM, seg=24,
                    rot=(0, math.pi / 2, 0))
    # keep only the upper half of the drum and flatten it a little
    b = bmesh.new(); b.from_mesh(lidbody.data)
    for v in b.verts:
        if v.co.x > 0.0:   # after rotation X(local) points down
            v.co.x = 0.0
        v.co.x *= 0.75
    bmesh.ops.remove_doubles(b, verts=b.verts[:], dist=1e-5)
    b.to_mesh(lidbody.data); b.free()
    smooth_angle(lidbody, 40)
    lid = [lidbody,
           rbox("_lb", (W + 0.035, D + 0.035, 0.045), (0, 0, Hb + 0.02), trimM, r=0.012, seg=2)]
    for sx in (1, -1):
        band = torus(f"_lv{sx}", D / 2 + 0.008, 0.02, (sx * (W / 2 - 0.06), 0, Hb), trimM, seg=24, mseg=6, rot=(0, math.pi / 2, 0), scale=(0.75, 1, 1))
        lid.append(band)
    if not mimic:
        lid += [rbox("_lock", (0.14, 0.05, 0.16), (0, -D / 2 - 0.02, Hb + 0.0), trimM, r=0.02, seg=2),
                ell("_lockH", 0.018, (0, -D / 2 - 0.047, Hb - 0.01), darkM, scale=(1, 0.5, 1.4), seg=10, rings=6),
                ell("_lockGem", 0.02, (0, -D / 2 - 0.047, Hb + 0.045), mat("M_GemRed", "#ff2a3a", emit="#ff2030", emit_strength=2.0), scale=(1, 0.5, 1), seg=10, rings=6)]
    else:
        for k in range(7):
            x = -0.36 + k * 0.12
            lid.append(tube(f"_tt{k}", [(x, -D / 2 + 0.05, Hb + 0.03), (x, -D / 2 + 0.045, Hb - 0.03), (x, -D / 2 + 0.04, Hb - 0.07)],
                            [0.03, 0.022, 0.01], tooth, seg=8, sub=2))
        for side, s in (('L', 1), ('R', -1)):
            lid += [ell(f"_eye{side}", 0.075, (0.2 * s, -D / 2 + 0.06, Hb + 0.17), mEye, scale=(1, 0.8, 1), seg=16, rings=10),
                    ell(f"_pup{side}", 0.022, (0.2 * s, -D / 2 - 0.0, Hb + 0.17), pupilM, scale=(0.6, 0.5, 1.6), seg=10, rings=6),
                    tube(f"_lidBrow{side}", [(0.29 * s, -D / 2 + 0.03, Hb + 0.27), (0.2 * s, -D / 2 + 0.0, Hb + 0.25), (0.11 * s, -D / 2 + 0.02, Hb + 0.21)],
                         [0.022, 0.026, 0.02], darkM, seg=8, sub=3),
                    tube(f"_horn{side}", [(0.3 * s, 0.05, Hb + 0.2), (0.36 * s, 0.06, Hb + 0.3), (0.34 * s, 0.1, Hb + 0.38)], [0.045, 0.03, 0.014], darkM, seg=10, sub=3)]
    part(f"{N}_Lid", lid, (0, D / 2, Hb), R)
    return R


chest("T_Chest", chestBlue, chestBlueD, gold)
chest("T_Mimic", mimicR, mimicD, mimicTrim, mimic=True)
bpy.data.objects["T_Chest"].location = (-1, 4, 0)
bpy.data.objects["T_Mimic"].location = (0.2, 4, 0)
print(tris("T_Chest"), tris("T_Mimic"))
