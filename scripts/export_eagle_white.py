"""Export the purchased rig and its authored idle → takeoff → flight sequence.

Run with Blender in background mode. The purchased source is never modified.
White surfaces retain the feather alpha cutouts and normals from the source.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '_eagle/golden_eagle_blender/golden eagle_blender.blend'
OUTPUT = ROOT / 'public/models/wedgetail-eagle.glb'
CLIPS = ('idle_A0', 'fly_start_A', 'fly_A0', 'fly_A_to_gliding_A', 'gliding_A0')

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bird = bpy.data.objects['Bird']

# The source's image links use the artist's machine paths. Relink locally and
# cap maps at 1024px; their job here is feather relief and cutout detail.
image_files = {file.name.lower(): file for file in SOURCE.parent.glob('*.png')}
for image in bpy.data.images:
    local = image_files.get(image.name.lower())
    if local:
        image.filepath = str(local)
        image.reload()
        if max(image.size) > 1024:
            image.scale(1024, 1024)
            image.pack()

# Deleting alpha exposes the rectangular feather cards, even on a white model.
for material in bpy.data.materials:
    if material.name not in {'body', 'eyes', 'eyelid', 'feather'}:
        continue
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    for name, value in {
        'Base Color': (0.025, 0.035, 0.065, 1) if material.name == 'eyes' else (0.94, 0.96, 1, 1),
        'Roughness': 0.18 if material.name == 'eyes' else 0.26,
        'Metallic': 0.05,
        'Specular IOR Level': 0.5,
        'Coat Weight': 0.28,
        'Coat Roughness': 0.18,
    }.items():
        socket = bsdf.inputs.get(name)
        if socket is not None:
            for link in list(socket.links):
                material.node_tree.links.remove(link)
            socket.default_value = value
    material.diffuse_color = bsdf.inputs['Base Color'].default_value
    for node in material.node_tree.nodes:
        if node.type == 'NORMAL_MAP':
            node.inputs['Strength'].default_value = 0.4
    if material.name == 'feather':
        material.surface_render_method = 'DITHERED'
        material.alpha_threshold = 0.45

for action in bpy.data.actions:
    for slot in action.slots:
        if slot.target_id_type == 'UNSPECIFIED':
            slot.target_id_type = 'OBJECT'

for track in list(bird.animation_data.nla_tracks):
    bird.animation_data.nla_tracks.remove(track)
actions = {name: bpy.data.actions['Bird|Bird|' + name] for name in CLIPS}
bird.animation_data.action = actions['idle_A0']
bird.animation_data.action_slot = actions['idle_A0'].slots[0]
for name in CLIPS[1:]:
    action = actions[name]
    track = bird.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    strip.action_slot = action.slots[0]
    track.mute = True

bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
bird.select_set(True)
for obj in bird.children_recursive:
    if obj.name in {'eagle_body', 'eagle_fur', 'eagle_wings'}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = bird
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_animations=True,
    export_animation_mode='ACTIONS', export_anim_single_armature=False,
    export_merge_animation='NONE', export_reset_pose_bones=True,
    export_nla_strips=False, export_force_sampling=True, export_frame_step=1,
    export_skins=True, export_morph=False, export_materials='EXPORT',
    export_lights=False, export_cameras=False,
)
print('EXPORTED', OUTPUT, 'CLIPS', CLIPS)
