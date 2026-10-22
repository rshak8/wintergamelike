import sys, importlib, math, random
sys.path.insert(0, r"C:\Users\Hp\Desktop\winter\blender")
import bh; importlib.reload(bh)
from bh import *

random.seed(7)
stone = mat("M_StoneFloor", "#3a4258", rough=0.9)
stoneB = mat("M_StoneFloorB", "#343b50", rough=0.9)
stoneEdge = mat("M_StoneFloorEdge", "#2a3042", rough=0.9)
wall = mat("M_Wall", "#3c4560", rough=0.9)
wallTop = mat("M_WallTop", "#58627e", rough=0.85)
wallD = mat("M_WallDark", "#262c3e", rough=0.9)
wood = mat("M_Wood", "#8a5a34", rough=0.85)
woodD = mat("M_WoodDarkP", "#5a3820", rough=0.85)
iron = mat("M_Iron", "#4a4e5c", rough=0.5, metal=0.7)
gold = mat("M_Gold", "#e0a83a", rough=0.3, metal=0.9)
chestBlue = mat("M_ChestBlue", "#2a4c9a", rough=0.6)
chestBlueD = mat("M_ChestBlueD", "#1c3270", rough=0.6)
flame = mat("M_Flame", "#ffb040", emit="#ff8a20", emit_strength=6.0)
banner = mat("M_Banner", "#9a1a26", rough=0.85)
crystal = mat("M_CrystalP", "#4ab0ff", emit="#2a90ff", emit_strength=3.0)
mimicR = mat("M_MimicRed", "#6a1a3a", rough=0.6)
mimicD = mat("M_MimicDark", "#3a0e22", rough=0.6)
tooth = mat("M_Tooth", "#f0ead8", rough=0.6)
tongue = mat("M_Tongue", "#e04a6a", rough=0.6)
mEye = mat("M_MimicEye", "#ffe040", emit="#ffd020", emit_strength=5.0)
mouth = mat("M_Mouth", "#1a0508", rough=0.9)
steel = mat("M_Steel", "#aeb3c2", rough=0.35, metal=0.7)
portal = mat("M_Portal", "#2a7aff", emit="#3a8aff", emit_strength=5.0)
portalD = mat("M_PortalFrame", "#2a3046", rough=0.6, metal=0.4)
bone = mat("M_Bone", "#e9dcc0", rough=0.7)
red = mat("M_RugRed", "#6a1420", rough=0.95)
redTrim = mat("M_RugTrim", "#c08a30", rough=0.6, metal=0.5)

def single(N, objs, pivot=(0, 0, 0)):
    delete_hierarchy(N)
    R = empty(N)
    part(f"{N}_Mesh", objs, pivot, R)
    return R

# floor tiles (1x1, top at z=0)
single("T_Floor", [box("_f", (0.97, 0.97, 0.12), (0, 0, -0.06), stone, bevel=0.03)])
single("T_FloorB", [box("_f", (0.97, 0.97, 0.12), (0, 0, -0.06), stoneB, bevel=0.03),
                    box("_c", (0.4, 0.04, 0.005), (0.1, 0.15, 0.001), stoneEdge, rot=(0, 0, 0.6))])
# wall block 1x1, height 1.3
single("T_Wall", [box("_w", (1.0, 1.0, 1.15), (0, 0, 0.575), wall, bevel=0.03),
                  box("_line1", (1.01, 1.01, 0.03), (0, 0, 0.4), wallD),
                  box("_line2", (1.01, 1.01, 0.03), (0, 0, 0.8), wallD),
                  box("_top", (1.04, 1.04, 0.16), (0, 0, 1.22), wallTop, bevel=0.04)])
# cover pillar / stone block
single("T_Pillar", [box("_p", (0.9, 0.9, 0.95), (0, 0, 0.475), wall, bevel=0.06, seg=2),
                    box("_pt", (0.96, 0.96, 0.14), (0, 0, 1.0), wallTop, bevel=0.04),
                    box("_pb", (0.98, 0.98, 0.1), (0, 0, 0.05), wallD, bevel=0.02)])
# crate
c = [box("_cb", (0.78, 0.78, 0.74), (0, 0, 0.37), wood, bevel=0.02)]
for sx in (1, -1):
    for sy in (1, -1):
        c.append(box(f"_ce{sx}{sy}", (0.1, 0.1, 0.76), (0.35 * sx, 0.35 * sy, 0.38), woodD))
for z in (0.04, 0.72):
    c.append(box(f"_cx{z}", (0.82, 0.1, 0.08), (0, 0.35, z), woodD)); c.append(box(f"_cx2{z}", (0.82, 0.1, 0.08), (0, -0.35, z), woodD))
    c.append(box(f"_cy{z}", (0.1, 0.82, 0.08), (0.35, 0, z), woodD)); c.append(box(f"_cy2{z}", (0.1, 0.82, 0.08), (-0.35, 0, z), woodD))
c.append(box("_diag", (0.08, 0.02, 0.95), (0, -0.395, 0.38), woodD, rot=(0, math.radians(45), 0)))
single("T_Crate", c)
# barrel
b = [cyl("_bb", 0.3, 0.7, (0, 0, 0.35), wood, verts=10, smooth=False, scale=(1, 1, 1)),
     cyl("_bm", 0.33, 0.36, (0, 0, 0.35), wood, verts=10),
     cyl("_h1", 0.335, 0.05, (0, 0, 0.12), iron, verts=10), cyl("_h2", 0.335, 0.05, (0, 0, 0.58), iron, verts=10),
     cyl("_lid", 0.27, 0.02, (0, 0, 0.705), woodD, verts=10)]
single("T_Barrel", b)
# wall torch (mounted on wall face toward -Y; origin at wall surface)
t = [box("_plate", (0.14, 0.04, 0.2), (0, -0.02, 0.0), iron, bevel=0.01),
     cyl("_arm", 0.025, 0.2, (0, -0.1, 0.03), iron, verts=6, rot=(math.radians(60), 0, 0)),
     cyl("_cup", 0.07, 0.1, (0, -0.17, 0.12), iron, verts=8, r2=0.1),
     sph("_fl", 0.07, (0, -0.17, 0.22), flame, scale=(1, 1, 1.6), seg=8, rings=5)]
single("T_Torch", t)
# standing torch / brazier for floor
single("T_Brazier", [cyl("_bp", 0.05, 0.7, (0, 0, 0.35), iron, verts=6), cyl("_bbs", 0.18, 0.05, (0, 0, 0.02), iron, verts=8),
                     cyl("_bc", 0.12, 0.12, (0, 0, 0.74), iron, verts=8, r2=0.18),
                     sph("_bf", 0.12, (0, 0, 0.88), flame, scale=(1, 1, 1.5), seg=8, rings=5)])
# banner (on wall face -Y)
single("T_Banner", [cyl("_rod", 0.02, 0.6, (0, -0.06, 0.0), gold, verts=6, rot=(0, math.radians(90), 0)),
                    poly_extrude("_cloth", [(-0.24, 0), (0.24, 0), (0.24, -0.7), (0, -0.85), (-0.24, -0.7)], 0.02, (0, -0.06, 0.0), banner, plane='XZ'),
                    poly_extrude("_emb", [(0, -0.2), (0.08, -0.35), (0, -0.5), (-0.08, -0.35)], 0.025, (0, -0.065, 0.0), gold, plane='XZ')])

# chest (base + lid separate, lid pivot at back hinge)
def chest(N, bodyM, darkM, trimM, mimic=False):
    delete_hierarchy(N)
    R = empty(N)
    W, D, Hb = 0.9, 0.6, 0.42
    base = [box("_cb", (W, D, Hb), (0, 0, Hb / 2), bodyM, bevel=0.03),
            box("_cbt", (W + 0.03, D + 0.03, 0.06), (0, 0, 0.04), trimM, bevel=0.01),
            box("_cbt2", (W + 0.03, D + 0.03, 0.05), (0, 0, Hb - 0.02), trimM, bevel=0.01)]
    for sx in (1, -1):
        base.append(box(f"_cv{sx}", (0.07, D + 0.04, Hb), (sx * (W / 2 - 0.05), 0, Hb / 2), trimM))
    if mimic:
        base.append(box("_mouthIn", (W - 0.08, D - 0.08, 0.04), (0, 0, Hb - 0.01), mouth))
        base.append(box("_tongue", (0.28, 0.5, 0.06), (0, -0.12, Hb + 0.01), tongue, bevel=0.03, rot=(math.radians(-15), 0, 0)))
        for k in range(6):
            base.append(cone(f"_tb{k}", 0.05, 0.12, (-0.34 + k * 0.136, -D / 2 + 0.05, Hb + 0.05), tooth, verts=4))
    part(f"{N}_Base", base, (0, 0, 0), R)
    lid = [box("_lt", (W, D, 0.2), (0, 0, Hb + 0.1), bodyM, bevel=0.06, seg=2),
           box("_lb", (W + 0.03, D + 0.03, 0.05), (0, 0, Hb + 0.02), trimM, bevel=0.01)]
    for sx in (1, -1):
        lid.append(box(f"_lv{sx}", (0.07, D + 0.04, 0.22), (sx * (W / 2 - 0.05), 0, Hb + 0.11), trimM, bevel=0.02))
    if not mimic:
        lid.append(box("_lock", (0.14, 0.05, 0.16), (0, -D / 2 - 0.02, Hb + 0.0), trimM, bevel=0.015))
        lid.append(box("_lockH", (0.04, 0.06, 0.05), (0, -D / 2 - 0.03, Hb - 0.02), darkM))
    else:
        for k in range(6):
            lid.append(cone(f"_tt{k}", 0.05, 0.12, (-0.34 + k * 0.136, -D / 2 + 0.05, Hb - 0.01), tooth, verts=4, rot=(math.pi, 0, 0)))
        lid.append(sph("_eyeL", 0.07, (0.2, -D / 2 + 0.02, Hb + 0.2), mEye, seg=8, rings=5))
        lid.append(sph("_eyeR", 0.07, (-0.2, -D / 2 + 0.02, Hb + 0.2), mEye, seg=8, rings=5))
        lid.append(box("_pupL", (0.025, 0.02, 0.09), (0.2, -D / 2 - 0.045, Hb + 0.2), mouth))
        lid.append(box("_pupR", (0.025, 0.02, 0.09), (-0.2, -D / 2 - 0.045, Hb + 0.2), mouth))
        lid.append(cone("_hornL", 0.05, 0.16, (0.3, 0.05, Hb + 0.27), darkM, verts=4, rot=(0, math.radians(-30), 0)))
        lid.append(cone("_hornR", 0.05, 0.16, (-0.3, 0.05, Hb + 0.27), darkM, verts=4, rot=(0, math.radians(30), 0)))
    part(f"{N}_Lid", lid, (0, D / 2, Hb), R)
    return R

chest("T_Chest", chestBlue, chestBlueD, gold)
chest("T_Mimic", mimicR, mimicD, mat("M_MimicTrim", "#8a6a3a", rough=0.5, metal=0.5), mimic=True)

# spikes trap: base + spikes (spikes animated up/down)
delete_hierarchy("T_Spikes"); R = empty("T_Spikes")
part("T_Spikes_Base", [box("_sp", (0.96, 0.96, 0.05), (0, 0, 0.0), iron, bevel=0.01)] +
     [cyl(f"_hole{i}{j}", 0.06, 0.012, (-0.3 + i * 0.3, -0.3 + j * 0.3, 0.025), mouth, verts=6) for i in range(3) for j in range(3)], (0, 0, 0), R)
part("T_Spikes_Spikes", [cone(f"_s{i}{j}", 0.07, 0.35, (-0.3 + i * 0.3, -0.3 + j * 0.3, 0.17), steel, verts=4) for i in range(3) for j in range(3)], (0, 0, 0), R)

# crystal pedestal (room decoration / light)
single("T_Crystal", [box("_cp", (0.6, 0.6, 0.2), (0, 0, 0.1), wall, bevel=0.03), box("_cp2", (0.45, 0.45, 0.3), (0, 0, 0.35), wallTop, bevel=0.03),
                     sph("_cr", 0.2, (0, 0, 0.85), crystal, scale=(0.75, 0.75, 1.7), seg=4, rings=3, smooth=False),
                     sph("_cr2", 0.09, (0.16, 0.05, 0.6), crystal, scale=(0.7, 0.7, 1.6), seg=4, rings=3, smooth=False, rot=(0.3, 0.4, 0)),
                     sph("_cr3", 0.08, (-0.14, -0.08, 0.6), crystal, scale=(0.7, 0.7, 1.6), seg=4, rings=3, smooth=False, rot=(-0.3, -0.4, 0))])

# room gate (bars rise into wall). Frame built along X, 2 tiles wide, faces -Y/+Y
delete_hierarchy("T_Gate"); R = empty("T_Gate")
part("T_Gate_Bars", [cyl(f"_bar{i}", 0.04, 1.1, (-0.8 + i * 0.32, 0, 0.55), iron, verts=6) for i in range(6)] +
     [box("_bx", (1.9, 0.08, 0.08), (0, 0, 0.85), iron), box("_bx2", (1.9, 0.08, 0.08), (0, 0, 0.25), iron)] +
     [cone(f"_bt{i}", 0.05, 0.1, (-0.8 + i * 0.32, 0, 0.0), steel, verts=4, rot=(math.pi, 0, 0)) for i in range(6)], (0, 0, 0), R)

# exit door (boss room) – frame + two leaves; center at origin, faces -Y
delete_hierarchy("T_ExitDoor"); R = empty("T_ExitDoor")
part("T_ExitDoor_Frame", [box("_fl", (0.3, 0.5, 2.2), (-1.05, 0, 1.1), portalD, bevel=0.04), box("_fr", (0.3, 0.5, 2.2), (1.05, 0, 1.1), portalD, bevel=0.04),
                          box("_ft", (2.4, 0.55, 0.35), (0, 0, 2.3), portalD, bevel=0.05),
                          box("_glow", (1.8, 0.1, 2.0), (0, 0.12, 1.0), portal),
                          sph("_fgem", 0.12, (0, -0.28, 2.3), portal, seg=4, rings=3, smooth=False, scale=(1, 0.6, 1.3)),
                          cone("_fsL", 0.1, 0.4, (-1.05, 0, 2.5), gold, verts=4), cone("_fsR", 0.1, 0.4, (1.05, 0, 2.5), gold, verts=4),
                          box("_trimL", (0.34, 0.54, 0.08), (-1.05, 0, 1.9), gold), box("_trimR", (0.34, 0.54, 0.08), (1.05, 0, 1.9), gold)], (0, 0, 0), R)
for side, s in (("L", -1), ("R", 1)):
    leaf = [box(f"_leaf{side}", (0.9, 0.12, 1.95), (s * 0.45, -0.05, 0.98), chestBlueD, bevel=0.03),
            box(f"_lt{side}", (0.75, 0.14, 0.08), (s * 0.45, -0.05, 1.6), gold), box(f"_lb{side}", (0.75, 0.14, 0.08), (s * 0.45, -0.05, 0.4), gold),
            box(f"_lr{side}", (0.06, 0.14, 1.9), (s * 0.06, -0.05, 0.98), gold)]
    # skull emblem halves
    leaf.append(sph(f"_sk{side}", 0.18, (s * 0.12, -0.12, 1.15), portal, scale=(0.6, 0.4, 1.0), seg=8, rings=5))
    part(f"T_ExitDoor_Leaf{side}", leaf, (s * 0.9, 0, 0), R)

# red rug (boss room)
single("T_Rug", [box("_rug", (4.0, 3.0, 0.02), (0, 0, 0.01), red), box("_rt1", (4.0, 0.1, 0.025), (0, 1.45, 0.012), redTrim),
                 box("_rt2", (4.0, 0.1, 0.025), (0, -1.45, 0.012), redTrim), box("_rt3", (0.1, 3.0, 0.025), (1.95, 0, 0.012), redTrim),
                 box("_rt4", (0.1, 3.0, 0.025), (-1.95, 0, 0.012), redTrim)])
# bone pile decoration
bp = []
for k in range(6):
    a = random.uniform(0, 6.28); r = random.uniform(0, 0.2)
    bp.append(cyl(f"_bn{k}", 0.025, 0.28, (math.cos(a) * r, math.sin(a) * r, 0.03), bone, verts=5, rot=(math.radians(90), 0, a)))
bp.append(sph("_skl", 0.1, (0.05, 0.0, 0.09), bone, seg=8, rings=6))
bp.append(sph("_sklE", 0.03, (0.07, -0.08, 0.1), mouth, seg=5, rings=4))
single("T_Bones", bp)

props = ["T_Floor", "T_FloorB", "T_Wall", "T_Pillar", "T_Crate", "T_Barrel", "T_Torch", "T_Brazier", "T_Banner", "T_Chest", "T_Mimic",
         "T_Spikes", "T_Crystal", "T_Gate", "T_ExitDoor", "T_Rug", "T_Bones"]
for i, n in enumerate(props):
    bpy.data.objects[n].location = ((i % 6) * 1.5 - 4, 6 + (i // 6) * 2.2, 0)
    print(n, tris(n))
bpy.data.objects["T_Rug"].location = (6, 9, 0)
