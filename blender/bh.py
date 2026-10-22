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
    bpy.context.view_layer.update()  # fresh objects have a stale matrix_world until the scene updates
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


# =====================================================================
#  Smooth-form helpers (v2): rounded, higher-detail stylized shapes
# =====================================================================

def smooth_angle(obj, deg=40):
    """Smooth shading, but keep edges sharper than `deg` crisp (exported as split normals)."""
    me = obj.data
    bm = bmesh.new(); bm.from_mesh(me)
    lim = math.radians(deg)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
            e.smooth = False
    bm.to_mesh(me); bm.free()
    return obj


def _fin2(obj, m, deg=40):
    col().objects.link(obj)
    if m:
        obj.data.materials.append(m)
    smooth_angle(obj, deg)
    return obj


def mod_apply(obj, kind, **kw):
    md = obj.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        setattr(md, k, v)
    apply_mods(obj)
    return obj


def subsurf(obj, levels=1, deg=40):
    mod_apply(obj, 'SUBSURF', levels=levels, render_levels=levels)
    return smooth_angle(obj, deg)


def solidify(obj, t=0.012, deg=40):
    mod_apply(obj, 'SOLIDIFY', thickness=t, offset=0.0, use_even_offset=True)
    return smooth_angle(obj, deg)


def ell(name, r, loc=(0, 0, 0), m=None, scale=(1, 1, 1), seg=20, rings=12, rot=(0, 0, 0), quat=None, deg=80):
    """Smooth ellipsoid. scale multiplies radius per axis. quat (mathutils.Quaternion) overrides rot."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[1]; v.co.z *= scale[2]
    o = _mesh_obj(name, bm)
    o.location = loc
    if quat is not None:
        o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = quat
    else:
        o.rotation_euler = rot
    return _fin2(o, m, deg)


def lathe(name, prof, loc=(0, 0, 0), m=None, seg=24, scale=(1, 1, 1), rot=(0, 0, 0), wob=None, cap=True, deg=50):
    """Revolve profile [(r, z), ...] (bottom->top) around Z. r=0 makes a pole.
    wob(angle, z) -> extra radius (cloth folds, flutes). Angle 0 = +X, pi/2 = +Y."""
    bm = bmesh.new()
    rings = []
    for (r, z) in prof:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z * scale[2]))]); continue
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rr = r + (wob(a, z) if wob else 0.0)
            ring.append(bm.verts.new((math.cos(a) * rr * scale[0], math.sin(a) * rr * scale[1], z * scale[2])))
        rings.append(ring)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[(i + 1) % seg], B[i]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
        else:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    if cap:
        if len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return _fin2(o, m, deg)


def _catmull(pts, n):
    P = [Vector(p) for p in pts]
    if len(P) == 2:
        return [P[0].lerp(P[1], j / n) for j in range(n + 1)]
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for j in range(n):
            t = j / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return out


def tube(name, pts, radii, m=None, seg=10, sub=4, caps=('round', 'round'), flat=1.0, up=(0, 0, 1), deg=70, cap_rings=3):
    """Smooth tube through pts (Catmull-Rom). radii: list (interpolated along the tube) or f(t).
    flat < 1 squashes the cross-section along the `up` direction (ribbons, hair clumps).
    caps: 'round' (dome, no sharp tip), 'flat' or None for each end."""
    C = _catmull(pts, sub)
    N = len(C)

    def R(i):
        t = i / (N - 1)
        if callable(radii):
            return radii(t)
        idx = t * (len(radii) - 1)
        k = min(int(idx), len(radii) - 2)
        f = idx - k
        return radii[k] * (1 - f) + radii[k + 1] * f

    T = [(C[min(i + 1, N - 1)] - C[max(i - 1, 0)]).normalized() for i in range(N)]
    u = Vector(up)
    n0 = u - T[0] * u.dot(T[0])
    if n0.length < 1e-5:
        n0 = T[0].orthogonal()
    Ns = [n0.normalized()]
    for i in range(1, N):
        n = Ns[-1] - T[i] * Ns[-1].dot(T[i])
        if n.length < 1e-6:
            n = T[i].orthogonal()
        Ns.append(n.normalized())
    bm = bmesh.new()

    def ring_at(c, t, n, r, back=0.0):
        b = t.cross(n)
        return [bm.verts.new(c + (n * math.cos(2 * math.pi * j / seg) * flat + b * math.sin(2 * math.pi * j / seg)) * r + t * back)
                for j in range(seg)]

    rings = [ring_at(C[i], T[i], Ns[i], R(i)) for i in range(N)]

    def bridge(A, B):
        for j in range(seg):
            bm.faces.new((A[j], A[(j + 1) % seg], B[(j + 1) % seg], B[j]))

    for i in range(N - 1):
        bridge(rings[i], rings[i + 1])

    def cap(end):
        i = 0 if end == 0 else N - 1
        kind = caps[end]
        if not kind:
            return
        ring = rings[i]
        if kind == 'flat':
            bm.faces.new(ring if end == 1 else list(reversed(ring)))
            return
        sgn = -1 if end == 0 else 1
        r = R(i); prev = ring
        for k in range(1, cap_rings + 1):
            ph = (k / (cap_rings + 1)) * math.pi / 2
            nr = ring_at(C[i], T[i], Ns[i], r * math.cos(ph), back=sgn * r * math.sin(ph))
            if end == 0:
                bridge(nr, prev)
            else:
                bridge(prev, nr)
            prev = nr
        tip = bm.verts.new(C[i] + T[i] * sgn * r)
        for j in range(seg):
            if end == 0:
                bm.faces.new((prev[(j + 1) % seg], prev[j], tip))
            else:
                bm.faces.new((prev[j], prev[(j + 1) % seg], tip))

    cap(0); cap(1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _mesh_obj(name, bm)
    return _fin2(o, m, deg)


def rbox(name, size, loc=(0, 0, 0), m=None, r=0.02, seg=3, rot=(0, 0, 0), taper=None, sub=0, deg=35):
    """Box with rounded edges. taper=(sx, sy) scales the top face. sub=subdivision levels (softer)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if taper and v.co.z > 0:
            v.co.x *= taper[0]; v.co.y *= taper[1]
    if r > 0:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=r, segments=seg, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    o = _mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    _fin2(o, m, deg)
    if sub:
        subsurf(o, sub, deg)
    return o


def sheet(name, nu, nv, fn, m=None, thick=0.012, deg=60):
    """Cloth sheet: fn(u, v) -> (x, y, z) with u in [-1, 1] across, v in [0, 1] down. Solidified."""
    bm = bmesh.new()
    grid = [[bm.verts.new(fn(-1 + 2 * i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = _mesh_obj(name, bm)
    _fin2(o, m, deg)
    if thick:
        solidify(o, thick, deg)
    return o


def xf(objs, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    """Move a group of objects together (rotate around the world origin, then translate)."""
    M = Matrix.Translation(Vector(loc)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Scale(scale, 4)
    for o in objs:
        o.matrix_world = M @ o.matrix_world
    return objs


def skin_point(center, radii, az, el, push=0.0):
    """Point + normal on an ellipsoid. az 0 = front (-Y), +az toward +X; el up from the equator (degrees)."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    p = Vector((center[0] + d.x * radii[0], center[1] + d.y * radii[1], center[2] + d.z * radii[2]))
    n = Vector((d.x / radii[0], d.y / radii[1], d.z / radii[2])).normalized()
    return p + n * push, n


def decal_ell(name, center, radii, az, el, size, m, push=0.0, seg=10, rings=7, tilt=0.0):
    """Flattened ellipsoid lying on a head/body surface (eyes, blush, gems). size=(w, h, thickness)."""
    p, n = skin_point(center, radii, az, el, push)
    q = n.to_track_quat('Z', 'Y')
    if tilt:
        q = q @ Euler((0, 0, tilt)).to_quaternion()
    return ell(name, 1.0, p, m, scale=size, seg=seg, rings=rings, quat=q)


def surface_arc(center, radii, pts_azel, push=0.0):
    return [skin_point(center, radii, az, el, push)[0] for (az, el) in pts_azel]


def fist(px, center, m, side, knuckleM=None, size=1.0):
    """Closed fist around a handle running along Y (forward) through `center`.
    side: +1 left hand, -1 right hand (knuckles face outward)."""
    s = side; c = Vector(center); k = size
    objs = [rbox(px + "palm", (0.078 * k, 0.096 * k, 0.088 * k), c, m, r=0.03 * k, seg=1, sub=1)]
    for i in range(4):  # finger rolls wrapped round the handle, knuckles on the outer side
        y = (-0.033 + i * 0.022) * k
        objs.append(ell(px + f"kn{i}", 0.021 * k, c + Vector((s * 0.03 * k, y, -0.012 * k)), knuckleM or m,
                        scale=(1.0, 0.95, 1.2), seg=8, rings=6))
    objs.append(ell(px + "thumb", 0.02 * k, c + Vector((-s * 0.026 * k, -0.03 * k, 0.03 * k)), m,
                    scale=(1.0, 1.7, 0.9), seg=12, rings=8, rot=(0.4, 0, 0)))
    return objs


def blade(name, prof, m=None, deg=55, xoff=None):
    """Blade along +Z with a lens cross-section. prof = [(z, half_width, half_thickness), ...] bottom->top.
    A ring with half_width 0 becomes the (slightly rounded) tip. xoff(z) -> sideways offset (curved blades)."""
    bm = bmesh.new()
    rings = []
    for (z, w, t) in prof:
        dx = xoff(z) if xoff else 0.0
        if w <= 1e-6:
            rings.append([bm.verts.new((dx, 0, z))]); continue
        sec = [(w, 0), (w * 0.78, t * 0.55), (0, t), (-w * 0.78, t * 0.55), (-w, 0), (-w * 0.78, -t * 0.55), (0, -t), (w * 0.78, -t * 0.55)]
        rings.append([bm.verts.new((dx + x, y, z)) for (x, y) in sec])
    n = 8
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(B) == 1:
            for i in range(n):
                bm.faces.new((A[i], A[(i + 1) % n], B[0]))
        elif len(A) == 1:
            for i in range(n):
                bm.faces.new((A[0], B[(i + 1) % n], B[i]))
        else:
            for i in range(n):
                bm.faces.new((A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _mesh_obj(name, bm)
    return _fin2(o, m, deg)


def wrap_grip(px, z0, z1, r, m, mBand=None, turns=5):
    """Leather-wrapped grip: core cylinder plus raised wrap rings."""
    objs = [tube(px + "core", [(0, 0, z0), (0, 0, z1)], [r], m, seg=12, sub=1, caps=('flat', 'flat'))]
    for i in range(turns):
        z = z0 + (z1 - z0) * (i + 0.5) / turns
        objs.append(torus(px + f"w{i}", r * 1.02, r * 0.28, (0, 0, z), mBand or m, seg=12, mseg=5, rot=(0.18, 0, 0)))
    return objs
