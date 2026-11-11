import bpy, io, contextlib, logging, os

# Export every asset in COL_Export to the game's GLB.
# Папка blender/: рядом с этим скриптом или рядом с открытым assets.blend (без абсолютных путей).
_here = globals().get("__file__", "")
BLENDER_DIR = os.path.dirname(os.path.abspath(_here)) if _here.endswith(".py") and os.path.exists(_here) else os.path.dirname(bpy.data.filepath)
OUT = os.path.normpath(os.path.join(BLENDER_DIR, "..", "src", "assets", "assets.glb"))
col = bpy.data.collections["COL_Export"]
bpy.ops.object.select_all(action='DESELECT')
for o in col.all_objects:
    o.hide_set(False)
    o.select_set(True)
logging.disable(logging.INFO)
buf = io.StringIO()
with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
  bpy.ops.export_scene.gltf(
      filepath=OUT,
      export_format='GLB',
      use_selection=True,
      export_yup=True,
      export_apply=True,
      export_animations=False,
      export_materials='EXPORT',
      export_normals=True,
      export_texcoords=False,
  )
logging.disable(logging.NOTSET)
print("exported", len(col.all_objects), "objects to", OUT)
