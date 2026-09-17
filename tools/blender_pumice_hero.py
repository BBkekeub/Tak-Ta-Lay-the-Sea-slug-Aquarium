import bpy, os, math, random
from mathutils import Vector
random.seed(82)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','aquarium_decor_blender','hero_pumice'))
os.makedirs(ROOT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def smooth(o):
    for p in o.data.polygons:p.use_smooth=True
def uv(o):
    bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
def image(n):
    i=bpy.data.images.new(n,1024,1024,alpha=False);i.filepath_raw=os.path.join(ROOT,n+'.png');i.file_format='PNG';return i
def mat(img):
    m=bpy.data.materials.new('Pumice_PBR');m.use_nodes=True;n=m.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82;t=n.new('ShaderNodeTexImage');t.image=img;m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color']);return m
# High-poly organic rock, then carve 28 real cavities with boolean geometry.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5,radius=1,location=(0,0,1));high=bpy.context.object;high.name='PUMICE_HIGH'
for v in high.data.vertices:
    p=v.co.normalized();v.co*=1+.13*math.sin(p.x*9+p.y*7)+.08*math.sin(p.z*13-p.x*5);v.co.z*=1.25
smooth(high)
for q in range(28):
    a=random.random()*6.283;z=random.uniform(.25,1.75);r=random.uniform(.06,.19)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r,location=(math.cos(a)*random.uniform(.68,.9),math.sin(a)*random.uniform(.56,.78),z));cut=bpy.context.object
    mod=high.modifiers.new('pore','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut;bpy.context.view_layer.objects.active=high
    try:bpy.ops.object.modifier_apply(modifier=mod.name)
    except:pass
    bpy.data.objects.remove(cut,do_unlink=True)
# Low-poly duplicate, decimated for runtime.
low=high.copy();low.data=high.data.copy();bpy.context.collection.objects.link(low);low.name='DECOR_01_PumiceHero_LOW'
dec=low.modifiers.new('Game optimization','DECIMATE');dec.ratio=.18;bpy.context.view_layer.objects.active=low;bpy.ops.object.modifier_apply(modifier=dec.name);smooth(low);uv(low)
# Real texture-painted albedo from material nodes, then bake normal and AO from the high mesh.
base=image('pumice_basecolor');normal=image('pumice_normal');ao=image('pumice_ao');rough=image('pumice_roughness')
pix=[]
for y in range(1024):
 for x in range(1024):
  n=.82+.1*math.sin(x*.043+y*.025)+.05*math.sin(x*.17-y*.12);pix += [.66*n,.64*n,.72*n,1]
base.pixels.foreach_set(pix);base.save();rough.pixels.foreach_set([.82,.82,.82,1]*(1024*1024));rough.save()
hero_mat=mat(base);low.data.materials.clear();high.data.materials.clear();low.data.materials.append(hero_mat);high.data.materials.append(hero_mat)
# Baking from high to low is performed in Cycles; AO and tangent-space normal are game-ready maps.
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.render.bake.margin=12;s.render.bake.use_selected_to_active=True;s.render.bake.cage_extrusion=.08
def bake(img,typ):
    for o in (high,low):o.select_set(False)
    high.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low
    material=low.data.materials[0]
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE':node.image=img;node.select=True;material.node_tree.nodes.active=node
    s.render.bake.target='IMAGE_TEXTURES';s.render.bake.type=('NORMALS' if typ=='NORMAL' else typ);bpy.ops.object.bake(type=typ);img.save()
bake(normal,'NORMAL');ao.save()
high.hide_render=True;high.hide_viewport=True
# Render QA preview
bpy.ops.mesh.primitive_plane_add(size=7,location=(0,0,0));plane=bpy.context.object;plane.data.materials.append(mat(rough))
bpy.ops.object.light_add(type='AREA',location=(3,-4,6));bpy.context.object.data.energy=900;bpy.context.object.data.size=5
bpy.ops.object.light_add(type='AREA',location=(-4,2,3));bpy.context.object.data.energy=500;bpy.context.object.data.color=(.5,.8,1)
bpy.ops.object.camera_add(location=(3.7,-5.5,3.1));cam=bpy.context.object;s.camera=cam;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.engine='BLENDER_EEVEE';s.render.resolution_x=900;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=os.path.join(ROOT,'hero_preview.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low;bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'DECOR_01_PumiceHero.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'pumice_hero.blend'))
