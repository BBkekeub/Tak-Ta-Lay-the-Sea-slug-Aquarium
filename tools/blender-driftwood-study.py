"""One-piece wood study using the user's installed Blender; no game save access."""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
variant=args[0] if args else None
out=os.path.join(root,'assets','decor','driftwood','natural-v1',variant) if variant else os.path.join(root,'assets','decor','driftwood','blender-study')
stem=variant or 'root-crown'
os.makedirs(out,exist_ok=True)
with open(os.path.join(out,'source.json'),encoding='utf8') as f: data=json.load(f)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
verts=data['vertices']; faces=data['faces']
woodfaces=[f for f in faces if verts[f[0]]['material']!=3 and (Vector(verts[f[1]]['p'])-Vector(verts[f[0]]['p'])).cross(Vector(verts[f[2]]['p'])-Vector(verts[f[0]]['p'])).length>1e-10]
woodpoints=[Vector(v['p']) for v in verts]
tree=BVHTree.FromPolygons(woodpoints,woodfaces,all_triangles=True)

def make(name, indices):
    used=sorted(set(i for f in indices for i in f)); mapping={v:i for i,v in enumerate(used)}
    mesh=bpy.data.meshes.new(name); mesh.from_pydata([verts[i]['p'] for i in used],[],[[mapping[i] for i in f] for f in indices]); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
    return obj,used

materials=[]
for name,file in [('Bark','wood-color.png'),('End grain','wood-end-color.png')]:
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.9
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(os.path.join(root,'assets/decor/driftwood/consistent-v2',file)); tex.image.pack()
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']); materials.append(mat)
wood,_=make('Wood — unified branch collars',woodfaces)
bpy.context.view_layer.objects.active=wood; wood.select_set(True)
bm=bmesh.new(); bm.from_mesh(wood.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(wood.data); bm.free()
# Voxel remeshing replaces intersecting tubes with a single watertight surface.
remesh=wood.modifiers.new('Fuse trunk and roots','REMESH'); remesh.mode='VOXEL'; remesh.voxel_size=.105; remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=wood.modifiers.new('Soften crotches','SMOOTH'); smooth.factor=1.25; smooth.iterations=9
bpy.ops.object.modifier_apply(modifier=smooth.name)
for mat in materials: wood.data.materials.append(mat)
uv=wood.data.uv_layers.new(name='Transferred painted wood')
for poly in wood.data.polygons:
    center=sum((wood.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
    hit=tree.find_nearest(center); tri=woodfaces[hit[2]]
    poly.material_index=1 if verts[tri[0]]['material']==1 else 0
    poly.use_smooth=True
    for li in poly.loop_indices:
        p=wood.data.vertices[wood.data.loops[li].vertex_index].co
        mapped=barycentric_transform(p,*[woodpoints[i] for i in tri],*[Vector((*verts[i]['uv'],0)) for i in tri])
        uv.data[li].uv=(mapped.x,1-mapped.y)

moss,used=make('Moss leaves', [f for f in faces if verts[f[0]]['material']==3])
colors=moss.data.color_attributes.new(name='Moss paint',type='FLOAT_COLOR',domain='POINT')
for j,i in enumerate(used):
    c=verts[i].get('col',[80,105,40]); colors.data[j].color=tuple((max(0,min(255,x))/255)**2.2 for x in c)+(1,)
mat=bpy.data.materials.new('Soft moss'); mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=1
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name='Moss paint'; mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color']); moss.data.materials.append(mat)

scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.cycles.use_denoising=True; scene.render.resolution_x=800; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.film_transparent=True; scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.76,.8,1); scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8; scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'; scene.view_settings.exposure=0; scene.view_settings.gamma=1
bpy.ops.object.light_add(type='AREA',location=(-10,-14,26)); bpy.context.object.data.energy=4500; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=18
bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; cam.data.type='ORTHO'
height=max(v['p'][2] for v in verts); span=max(math.hypot(v['p'][0],v['p'][1])*2 for v in verts)
cam.data.ortho_scale=max(span,height)*1.16
target=Vector((0,0,height*.45))
for angle in [0,90,180,270]:
    a=math.radians(angle); cam.location=(27*math.cos(a)-24*math.sin(a),-24*math.cos(a)-27*math.sin(a),24)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(out,stem+'-'+str(angle)+'.png'); bpy.ops.render.render(write_still=True)
bpy.context.view_layer.objects.active=wood
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,stem+'.blend'))
with open(os.path.join(out,'report.json'),'w') as f: json.dump({'blender':bpy.app.version_string,'wood_vertices':len(wood.data.vertices),'wood_faces':len(wood.data.polygons),'method':'voxel union, smooth crotches, transfer UV, original moss','prototype_only':True},f,indent=2)
