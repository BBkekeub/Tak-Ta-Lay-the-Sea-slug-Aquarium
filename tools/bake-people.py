#!/usr/bin/env python3
"""bake-people.py — แปลงตัวละครจาก .fbx ให้เป็น js/people-model.js ที่เกมใช้ได้

ขั้นตอนทั้งหมด (รันบนเครื่องที่มี assimp + python)
  1) apt-get install assimp-utils ; pip install numpy fast-simplification
  2) assimp export assets/LowPolyCharacters/Male.fbx   /tmp/fbx/Male.gltf
     assimp export assets/LowPolyCharacters/Female.fbx /tmp/fbx/Female.gltf
  3) python3 tools/bake-people.py         (อ่านจาก /tmp/fbx  เขียน /tmp/bake/model.json)
  4) ห่อ model.json เป็น js/people-model.js  (ดูท้ายไฟล์)

สิ่งที่สคริปต์นี้ทำ และ "ทำไม":
  · คลี่ skinning เอง (global joint matrix x inverse-bind) — ถ้าใช้ POSITION ดิบ แขนจะแบนเป็นปีก
  · ตัดหมวกซานตาออก (ชิ้น hair/white ที่ลอยต่ำกว่าคอ)
  · จัดทิศการวนหน้าให้เหมือนกันทั้งตัว โดยเทียบกับ NORMAL ของเวอร์เท็กซ์
  · แยกชิ้นตามกระดูก Mixamo -> torso/head/thigh/calf/foot/arm/fore/hand ซ้าย-ขวา
  · แยกทรงผม/เครา ออกเป็นตัวเลือก (Hair, PonyTail, ShortHair_1, Beard, ...)
  · แปลงเป็นระบบพิกัดของเกม (x=ข้าง y=หน้า z=สูง, ส่วนสูง=1) และย้ายจุดกำเนิดไปที่ข้อต่อ

หมายเหตุ: "ห้ามลดจำนวนหน้า" — เคยลองแล้ว ตัวลดทอนตัดตะเข็บระหว่างวัสดุขาด เสื้อกับหัวพรุนเป็นรู
"""
import json,numpy as np
GLTF='/tmp/fbx/%s.gltf'
def nodemat(nd):
    if 'matrix' in nd: return np.array(nd['matrix'],float).reshape(4,4).T
    M=np.eye(4)
    if 'translation' in nd: T=np.eye(4);T[:3,3]=nd['translation'];M=M@T
    if 'rotation' in nd:
        x,y,z,w=nd['rotation'];R=np.eye(4)
        R[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
        M=M@R
    if 'scale' in nd: S=np.eye(4);S[:3,:3]=np.diag(nd['scale']);M=M@S
    return M
def load(name):
    g=json.load(open(GLTF%name))
    bufs=[open('/tmp/fbx/'+b['uri'],'rb').read() for b in g['buffers']]
    def acc(i):
        a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']]
        comp={5120:'i1',5121:'u1',5122:'i2',5123:'u2',5125:'u4',5126:'f4'}[a['componentType']]
        n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        d=np.frombuffer(bufs[bv['buffer']],dtype=np.dtype('<'+comp),count=a['count']*n,offset=off)
        return d.reshape(a['count'],n) if n>1 else d
    nodes=g['nodes'];glob={}
    def walk(i,parent):
        M=parent@nodemat(nodes[i]);glob[i]=M
        for c in nodes[i].get('children',[]): walk(c,M)
    for r in g['scenes'][g.get('scene',0)]['nodes']: walk(r,np.eye(4))
    skin=g['skins'][0];joints=skin['joints']
    IB=acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    JM=np.array([glob[j]@IB[k] for k,j in enumerate(joints)])
    jname=[nodes[j].get('name','j%d'%j) for j in joints]
    jorigin={jname[k]:glob[joints[k]][:3,3] for k in range(len(joints))}
    V=[];T=[];Mt=[];Jd=[];Nd=[];Nrm=[]
    for i,nd in enumerate(nodes):
        if 'mesh' not in nd: continue
        for pr in g['meshes'][nd['mesh']]['primitives']:
            P=acc(pr['attributes']['POSITION']).astype(float)
            J=acc(pr['attributes']['JOINTS_0']).astype(int);W=acc(pr['attributes']['WEIGHTS_0']).astype(float)
            W=W/np.maximum(W.sum(1,keepdims=True),1e-9)
            h=np.c_[P,np.ones(len(P))];out=np.zeros((len(P),3))
            for k in range(4):
                out+=np.einsum('nij,nj->ni',JM[J[:,k]],h)[:,:3]*W[:,k:k+1]
            NR=acc(pr['attributes']['NORMAL']).astype(float)
            nout=np.zeros((len(P),3))
            for k in range(4):
                R=JM[J[:,k]][:,:3,:3]
                nout+=np.einsum('nij,nj->ni',R,NR)*W[:,k:k+1]
            Nrm.extend(nout.tolist())
            base=len(V);V.extend(out.tolist())
            Jd.extend([jname[x] for x in J[np.arange(len(J)),W.argmax(1)]])
            for t in acc(pr['indices']).reshape(-1,3):
                T.append([base+t[0],base+t[1],base+t[2]]);Mt.append(pr.get('material',0));Nd.append(nodes[i].get('name','n%d'%i))
    return dict(g=g,VN=np.array(Nrm),V=np.array(V),T=np.array(T),M=np.array(Mt),J=np.array(Jd),N=np.array(Nd),jorigin=jorigin,
                matnames=[m['name'] for m in g['materials']])

import numpy as np, json

import fast_simplification as fs
PART_OF={}
for s,S in (('L','Left'),('R','Right')):
    PART_OF['mixamorig:%sUpLeg'%S]='thigh'+s; PART_OF['mixamorig:%sLeg'%S]='calf'+s
    PART_OF['mixamorig:%sFoot'%S]='foot'+s;   PART_OF['mixamorig:%sToeBase'%S]='foot'+s
    PART_OF['mixamorig:%sArm'%S]='arm'+s;     PART_OF['mixamorig:%sForeArm'%S]='fore'+s
    PART_OF['mixamorig:%sShoulder'%S]='torso'
    for f in ['Hand','HandThumb1','HandThumb2','HandThumb3','HandIndex1','HandIndex2','HandIndex3',
              'HandMiddle1','HandMiddle2','HandMiddle3','HandRing1','HandRing2','HandRing3',
              'HandPinky1','HandPinky2','HandPinky3']: PART_OF['mixamorig:%s%s'%(S,f)]='hand'+s
for b in ['Hips','Spine','Spine1','Spine2','Neck']: PART_OF['mixamorig:'+b]='torso'
PART_OF['mixamorig:Head']='head'
SLOT={'Shirt':'shirt','Skin':'skin','Material':'pants','Leather':'shoe',
      'Material.001':'hair','Material.002':'dark','Material.004':'white'}
# ชิ้นที่ไฟล์ต้นทาง "จอด" ไว้ผิดที่ (bind ต่างจากตัว) — ยังใช้ไม่ได้ ตัดออกก่อน
SKIP={'Cap','Cap_Hair','Hat','ShortHair_2'}
VARIANT={'Hair':'hair','PonyTail':'hair','ShortHair_1':'hair',
         'Beard':'facial','BeardFull':'facial','Moustache':'facial'}
AXIS={'thigh':('hip','knee'),'calf':('knee','ankle'),'foot':('ankle','toe'),
      'arm':('shoulder','elbow'),'fore':('elbow','wrist'),'hand':('elbow','wrist')}

def runs(ns):
    """สามเหลี่ยมถูกจัดกลุ่มตามวัสดุอยู่แล้ว เก็บเป็นช่วง [slot,start,count] ประหยัดกว่าเก็บทีละอัน"""
    out=[]
    for i,x in enumerate(ns):
        if out and out[-1][0]==x: out[-1][2]+=1
        else: out.append([x,i,1])
    return out
def group(V,tris,slots,budget=None):
    """คืน {v,t,s} โดยรีอินเด็กซ์เฉพาะเวอร์เท็กซ์ที่ใช้ · ลดทอนแยกตามวัสดุถ้ากำหนด budget"""
    nv=[];nt=[];ns=[]
    for sl in sorted(set(slots)):
        m=np.array([x==sl for x in slots]); sub=tris[m]
        uq,inv=np.unique(sub.ravel(),return_inverse=True)
        sv=V[uq]; st=inv.reshape(-1,3).astype(np.int32)
        if budget and len(st)>80:
            try:
                a,b=fs.simplify(sv.astype(np.float32),st,target_count=int(len(st)*budget))
                if len(b)>0: sv,st=a,b
            except Exception: pass
        base=len(nv); nv.extend(np.asarray(sv,float).tolist())
        for t in np.asarray(st): nt.append([base+int(t[0]),base+int(t[1]),base+int(t[2])]); ns.append(sl)
    return np.array(nv),np.array(nt),ns

def reorient(V,VN,T):
    """ไฟล์ต้นทางวนหน้าไม่สม่ำเสมอ ทำให้ตัวตัดหลังหน้า (backface cull) ในเกมกินหน้าหายเป็นรู
       เทียบ normal เชิงเรขาคณิตกับ normal ของเวอร์เท็กซ์ ถ้ากลับทางก็สลับลำดับให้หันออกเหมือนกันหมด"""
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]]
    g=np.cross(b-a,c-a)
    vn=(VN[T[:,0]]+VN[T[:,1]]+VN[T[:,2]])
    flip=(g*vn).sum(1)<0
    T=T.copy(); T[flip]=T[flip][:,[0,2,1]]
    return T,int(flip.sum())
def bake(name):
    d=load(name); V,T,M,J,N=d['V'],d['T'],d['M'],d['J'],d['N']; jo=d['jorigin']; mats=d['matnames']
    T,nf=reorient(V,d['VN'],T); print('  กลับด้านสามเหลี่ยมให้หันออกเหมือนกัน %d หน้า'%nf)
    keep=np.array([n not in SKIP for n in N])
    T,M,N=T[keep],M[keep],N[keep]
    minY=V[:,1].min(); HH=V[:,1].max()-minY
    g=lambda p: np.c_[-p[:,0],p[:,2],p[:,1]-minY]/HH
    Vg=g(V); JO={k:g(v[None])[0] for k,v in jo.items()}
    # จัดให้แกนกลางลำตัวอยู่ที่ x=0,y=0 ไม่งั้นซ้าย-ขวาไม่สมมาตร
    c=JO['mixamorig:Hips'].copy(); c[2]=0
    Vg=Vg-c; JO={k:v-c for k,v in JO.items()}
    joints={}
    for k,l in [('Hips','hips'),('Spine2','chest'),('Neck','neck'),('Head','head')]:
        joints[l]=[round(float(x),5) for x in JO['mixamorig:'+k]]
    for s,S in (('L','Left'),('R','Right')):
        for k,l in [('UpLeg','hip'),('Leg','knee'),('Foot','ankle'),('ToeBase','toe'),
                    ('Arm','shoulder'),('ForeArm','elbow'),('Hand','wrist')]:
            joints[l+s]=[round(float(x),5) for x in JO['mixamorig:%s%s'%(S,k)]]
    ORIGIN={'torso':'hips','head':'head'}
    for s in ('L','R'):
        ORIGIN.update({'thigh'+s:'hip'+s,'calf'+s:'knee'+s,'foot'+s:'ankle'+s,
                       'arm'+s:'shoulder'+s,'fore'+s:'elbow'+s,'hand'+s:'wrist'+s})
    def rec(part,tris,slots,budget=None):
        nv,nt,ns=group(Vg,tris,slots,budget)
        o=np.array(joints[ORIGIN[part]] if part in ORIGIN else joints['head'])
        r={'o':[round(float(x),5) for x in o],
           'v':[round(float(x),4) for x in (nv-o).ravel()],
           't':[int(x) for x in nt.ravel()],'s':runs(ns)}
        base=part[:-1] if part[-1] in 'LR' else part
        if base in AXIS:
            a,b=AXIS[base]; sd=part[-1]
            ax=np.array(joints[b+sd])-np.array(joints[a+sd]); n=np.linalg.norm(ax) or 1
            r['axis']=[round(float(x),5) for x in ax/n]; r['len']=round(float(n),5)
        return r
    body=np.array([VARIANT.get(n) is None for n in N])
    tri_part=np.array([PART_OF.get(J[t[0]],'torso') for t in T])
    tri_slot=np.array([SLOT.get(mats[m],'shirt') for m in M])
    parts={}
    for part in sorted(set(tri_part[body].tolist())):
        m=body&(tri_part==part)
        # ห้ามลดจำนวนหน้า: ตัวลดทอนตัดตะเข็บระหว่างวัสดุขาด ทำให้เสื้อ/หัวพรุนเป็นรู
        bud=None
        parts[part]=rec(part,T[m],list(tri_slot[m]),bud)
    variants={}
    for n in sorted(set(N.tolist())):
        kind=VARIANT.get(n)
        if not kind: continue
        m=N==n
        variants.setdefault(kind,{})[n]=rec('head',T[m],list(tri_slot[m]))
    tot=sum(len(p['t'])//3 for p in parts.values())
    print('  %s: ตัวหลัก %d สามเหลี่ยม · hair=%s · facial=%s'%(name,tot,
          list(variants.get('hair',{})),list(variants.get('facial',{}))))
    for k,v in sorted(parts.items()): print('     %-7s %4d tris'%(k,len(v['t'])//3))
    for kind,vs in variants.items():
        for k,v in vs.items(): print('     [%s] %-12s %4d tris'%(kind,k,len(v['t'])//3))
    return {'joints':joints,'parts':parts,'variants':variants}
out={'male':bake('Male'),'female':bake('Female')}
json.dump(out,open('/tmp/bake/model.json','w'))
print('ขนาด json: %.0f KB'%(len(json.dumps(out))/1024))

# --- ห่อเป็นไฟล์ JS ---
if __name__=='__main__':
    import json as _j
    m=_j.load(open('/tmp/bake/model.json'))
    js=("/* people-model.js — สร้างด้วย tools/bake-people.py · อย่าแก้ด้วยมือ */\n"
        "const PEOPLE_MODEL="+_j.dumps(m,separators=(',',':'),ensure_ascii=False)+";\n")
    open('/tmp/bake/people-model.js','w').write(js)
    print('เขียน /tmp/bake/people-model.js แล้ว — ก๊อปไปวางที่ js/people-model.js')
