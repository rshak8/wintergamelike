"""Blender helpers for building chibi low-poly game assets from primitives.
Convention: Z up, characters face -Y (becomes +Z forward in three.js after glTF export).
Each asset = root EMPTY named <Asset>, child meshes named <Asset>_<Part> with origins at joints.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

COL_NAME = "COL_Export"


def col(name=COL_NAME):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def mat(name, color, emit=None, emit_strength=1.0, rough=0.75, metal=0.0, alpha=None):
    """color/emit given as hex strings (sRGB)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hexcol(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        e = hexcol(emit)
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*e, 1)
                break
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
    m.diffuse_color = (*rgb, 1)
    return m


def _finish(obj, m, smooth=False, bevel=0.0, bevel_seg=1):
    col().objects.link(obj)
    if m:
        obj.data.materials.append(m)
    if bevel > 0:
        mod = obj.modifiers.new("bev", 'BEVEL')
        mod.width = bevel
        mod.segments = bevel_seg
        mod.limit_method = 'ANGLE'
        apply_mods(obj)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def apply_mods(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def _mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def box(name, size, loc=(0, 0, 0), m=None, bevel=0.0, seg=1, rot=(0, 0, 0), taper=None):
    """size=(x,y,z). taper=(sx,sy) scales the top face."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if taper and v.co.z > 0:
            v.co.x *= taper[0]; v.co.y *= taper[1]
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, False, bevel, seg)


def sph(name, r, loc=(0, 0, 0), m=None, scale=(1, 1, 1), seg=10, rings=7, smooth=True, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[1]; v.co.z *= scale[2]
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, smooth)


def cyl(name, r, depth, loc=(0, 0, 0), m=None, verts=8, r2=None, rot=(0, 0, 0), smooth=False, bevel=0.0, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[1]; v.co.z *= scale[2]
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, smooth, bevel)


def cone(name, r, depth, loc=(0, 0, 0), m=None, verts=6, rot=(0, 0, 0), smooth=False, scale=(1, 1, 1)):
    return cyl(name, r, depth, loc, m, verts, r2=0.0, rot=rot, smooth=smooth, scale=scale)


def torus(name, R, r, loc=(0, 0, 0), m=None, seg=12, mseg=6, rot=(0, 0, 0), scale=(1, 1, 1)):
    bm = bmesh.new()
    verts_ring = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x * scale[0], y * scale[1], z * scale[2])))
        verts_ring.append(ring)
    for i in range(seg):
        for j in range(mseg):
            a = verts_ring[i][j]; b = verts_ring[(i + 1) % seg][j]
            c = verts_ring[(i + 1) % seg][(j + 1) % mseg]; d = verts_ring[i][(j + 1) % mseg]
            bm.faces.new((a, b, c, d))
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, True)


def poly_extrude(name, pts2d, depth, loc=(0, 0, 0), m=None, rot=(0, 0, 0), plane='XZ', bevel=0.0):
    """Extrude a 2D outline (list of (u,v)) along the remaining axis. plane XZ -> extrude along Y."""
    bm = bmesh.new()
    vs = []
    for (u, v) in pts2d:
        if plane == 'XZ':
            vs.append(bm.verts.new((u, -depth / 2, v)))
        elif plane == 'XY':
            vs.append(bm.verts.new((u, v, -depth / 2)))
        else:  # YZ
            vs.append(bm.verts.new((-depth / 2, u, v)))
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    vec = {'XZ': (0, depth, 0), 'XY': (0, 0, depth), 'YZ': (depth, 0, 0)}[plane]
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=vec)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, False, bevel)


def join(objs, name):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    # merge duplicate material slots
    return o


def origin_to(obj, point):
    """Move object origin to world point without moving geometry."""
    point = Vector(point)
    mw = obj.matrix_world.copy()
    local = mw.inverted() @ point
    obj.data.transform(Matrix.Translation(-local))
    obj.matrix_world = mw @ Matrix.Translation(local)


def apply_xf(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def empty(name, loc=(0, 0, 0), size=0.1):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    col().objects.link(e)
    return e


def parent(child, par):
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_world = mw


def part(name, objs, pivot, par=None):
    """Join objs into one mesh named name, origin at pivot (world), rotation/scale applied."""
    o = join(objs, name) if len(objs) > 1 else objs[0]
    o.name = name
    bpy.context.view_layer.update()
    apply_xf(o)
    origin_to(o, pivot)
    bpy.context.view_layer.update()
    if par:
        parent(o, par)
    return o


def delete_hierarchy(root_name):
    r = bpy.data.objects.get(root_name)
    if not r:
        return
    objs = [r] + list(r.children_recursive)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def tris(root_name):
    r = bpy.data.objects.get(root_name)
    n = 0
    for o in [r] + list(r.children_recursive):
        if o.type == 'MESH':
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def mirror_x(obj, name):
    """Duplicate mesh mirrored across world X=0."""
    d = obj.copy()
    d.data = obj.data.copy()
    d.name = name
    col().objects.link(d)
    d.parent = None
    d.data.transform(obj.matrix_world)
    d.matrix_world = Matrix.Identity(4)
    d.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    d.data.flip_normals()
    return d
