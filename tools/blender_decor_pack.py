import bpy, os, random, math, json
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','aquarium_decor_blender'))
OUT=os.path.join(ROOT,'glb'); TEX=os.path.join(ROOT,'textures')
os.makedirs(OUT,exist_ok=True); os.makedirs(TEX,exist_ok=True); random.seed(50)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
COL=bpy.data.collections.new('AQUARIUM_DECOR_50'); bpy.context.scene.collection.children.link(COL)
def link(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    COL.objects.link(o)
def ico(n,loc,scale):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);link(o);return o
def cone(n,loc,r1,r2,h):
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r1,radius2=r2,depth=h,location=(loc[0],loc[1],loc[2]+h/2));o=bpy.context.object;o.name=n;link(o);return o
def torus(n,loc,a,b):
    bpy.ops.mesh.primitive_torus_add(major_radius=a,minor_radius=b,major_segments=12,minor_segments=6,location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=n;link(o);return o
def join(a,n):
    bpy.ops.object.select_all(action='DESELECT')
    for o in a:o.select_set(True)
    bpy.context.view_layer.objects.active=a[0];bpy.ops.object.join();a[0].name=n;return a[0]
def uv(o):
    bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
def texture(fam,color):
    s=256;im=bpy.data.images.new(fam+'Base',s,s,alpha=False);im.filepath_raw=os.path.join(TEX,fam+'-basecolor.png');im.file_format='PNG';pix=[]
    for y in range(s):
        for x in range(s):
            v=.73+.14*math.sin(x*.15+y*.08)+.08*math.sin(x*.41-y*.28);pix += [max(0,min(1,c*v)) for c in color]+[1]
    im.pixels.foreach_set(pix);im.save()
    no=bpy.data.images.new(fam+'Normal',s,s,alpha=False);no.filepath_raw=os.path.join(TEX,fam+'-normal.png');no.file_format='PNG';no.pixels.foreach_set([.5,.5,1,1]*(s*s));no.save()
    he=bpy.data.images.new(fam+'Height',s,s,alpha=False);he.filepath_raw=os.path.join(TEX,fam+'-height.png');he.file_format='PNG';he.pixels.foreach_set([.6,.6,.6,1]*(s*s));he.save()
    m=bpy.data.materials.new('M_'+fam);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color']);n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=no;nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.5;m.node_tree.links.new(n.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal']);bs.inputs['Roughness'].default_value=.72;return m
MAT={k:texture(k,v) for k,v in {'stone':(.60,.64,.68),'coral':(.96,.45,.52),'wood':(.30,.16,.08),'shell':(.94,.70,.60),'ceramic':(.28,.60,.64),'algae':(.25,.65,.38)}.items()}
def end(o,fam):
    o.data.materials.append(MAT[fam]);uv(o);o['height_map']='textures/'+fam+'-height.png';return o
def build(n,kind,i):
    if kind=='rock':
        a=[ico(n,(0,0,.62),(1.0+i%3*.12,.72,.62))]
        for q in range(5+i%4):a.append(ico(n,(math.sin(q*2.4)*.75,math.cos(q*2.4)*.55,.55+q%2*.25),(.12+.04*(q%3),)*3))
        return end(join(a,n),'stone')
    if kind=='arch': return end(torus(n,(0,0,.85),.75+i%3*.08,.20),'stone')
    if kind=='coral':
        a=[]
        for q in range(4+i%4):
            o=cone(n,(math.cos(q*2.2)*.32,math.sin(q*2.2)*.32,0),.13,.035,1.1+q%3*.3);o.rotation_euler=(.25*math.sin(q),.25*math.cos(q),0);a.append(o)
        return end(join(a,n),'coral')
    if kind=='grass':
        a=[]
        for q in range(8):
            o=cone(n,(math.cos(q)*.25,math.sin(q)*.25,0),.045,.012,1.2+q%3*.18);o.rotation_euler=(.3*math.sin(q),.3*math.cos(q),0);a.append(o)
        return end(join(a,n),'algae')
    if kind=='wood':
        a=[cone(n,(0,0,0),.18,.07,1.5)]
        for q in range(2):
            o=cone(n,((q-.5)*.35,0,.55+q*.25),.1,.025,.72);o.rotation_euler=(0,(-.7 if q==0 else .7),0);a.append(o)
        return end(join(a,n),'wood')
    if kind=='shell': return end(torus(n,(0,0,.22),.50,.17),'shell')
    if kind=='pot': return end(cone(n,(0,0,0),.50,.32,.8),'ceramic')
    return end(join([cone(n,((q-1)*.3,0,0),.20,.15,.7+q*.2) for q in range(3)],n),'stone')
labels=['PumiceRound','PumiceTwin','PorousCave','PumiceArch','LayeredMesa','RiverStonePair','VolcanicSpire','HollowRingRock','FlatShelfRock','ErodedBridge','PebbleCluster','StandingMonolith','SplitBoulder','CoralBranchFan','CoralBranchTower','PlateCoral','SoftAnemone','SeaGrassClump','SeaGrassArch','SpongeColumn','SpongeCluster','BarnacleRock','ShellSpiral','ShellPair','BrokenShell','DriftwoodFork','TwistedRoot','SunkenBranch','CeramicPot','BrokenAmphora','CeramicTube','SandRipple','SandCastle','CaveStack','RockWindow','CoralGarden','AlgaeRock','StoneMushrooms','CoralCrown','ShellCave','BubbleRock','LayeredArch','RootShelter','PorousPlate','MiniReef','SpongeGate','TidePoolRock','StonePillarPair','SeagrassRock','GrandReefArch']
kinds=['rock']*13+['coral']*4+['grass']*3+['sponge']*2+['rock']+['shell']*3+['wood']*3+['pot']*3+['rock']*3+['arch']*2+['coral','grass','rock','coral','shell','rock','arch','wood','rock','coral','sponge','arch','rock','grass','arch']
data=[]
for i,(label,kind) in enumerate(zip(labels,kinds),1):
    name='DECOR_%02d_%s'%(i,label);o=build(name,kind,i);data.append({'name':name,'file':name+'.glb','kind':kind})
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO')
for i,o in enumerate(COL.objects):o.location=((i%10)*2.6-12,(i//10)*2.6-5,0)
bpy.ops.mesh.primitive_plane_add(size=32,location=(0,0,-.02));stage=bpy.context.object;stage.data.materials.append(MAT['stone'])
bpy.ops.object.light_add(type='AREA',location=(0,-5,10));bpy.context.object.data.energy=1800;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(14,-19,15));cam=bpy.context.object;bpy.context.scene.camera=cam;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=os.path.join(ROOT,'preview.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'aquarium_decor_50.blend'))
json.dump({'count':50,'assets':data},open(os.path.join(ROOT,'manifest.json'),'w'),indent=2)
