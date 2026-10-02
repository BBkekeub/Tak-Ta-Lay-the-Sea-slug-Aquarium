import bpy,json,os,sys,math
directory=sys.argv[sys.argv.index('--')+1]
vertices=[];faces=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH': continue
 mesh=obj.data; mesh.calc_loop_triangles(); moss=obj.name.startswith('Moss')
 for tri in mesh.loop_triangles:
  ids=[]
  for li in tri.loops:
   loop=mesh.loops[li]; v=mesh.vertices[loop.vertex_index]
   entry={'p':list(obj.matrix_world@v.co),'n':list(v.normal),'uv':[0,0],'material':3 if moss else mesh.polygons[tri.polygon_index].material_index}
   if moss: entry['col']=[max(0,c)**(1/2.2)*255 for c in mesh.color_attributes['Moss paint'].data[loop.vertex_index].color[:3]]
   else:
    uv=mesh.uv_layers.active.data[li].uv;entry['uv']=[uv.x if math.isfinite(uv.x) else .5,1-uv.y if math.isfinite(uv.y) else .5]
   ids.append(len(vertices));vertices.append(entry)
  faces.append(ids)
with open(os.path.join(directory,'game-mesh.json'),'w') as f:json.dump({'vertices':vertices,'faces':faces,'extent':[max(abs(v['p'][k]) for v in vertices)+.1 for k in [0,1]],'visualHeight':max(v['p'][2] for v in vertices)+.1},f)
