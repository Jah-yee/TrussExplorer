import json,subprocess,re,sys
js=json.load(open('js_out.json'))
for n,v in js.items():
    if v.get('unstable'): 
        p=subprocess.run([sys.executable,'py_'+n+'.py'],capture_output=True,text=True,env={'MPLBACKEND':'Agg','PATH':'/usr/bin'})
        print(n,'JS unstable; PY:',p.stdout.splitlines()[2] if p.stdout else p.stderr[-200:]); continue
    p=subprocess.run([sys.executable,'py_'+n+'.py'],capture_output=True,text=True,env={'MPLBACKEND':'Agg','PATH':'/usr/bin'})
    if p.returncode: print(n,'PY ERROR',p.stderr[-500:]); continue
    import pandas as pd
    csv=re.search(r"CSV_OUT\s*=\s*'([^']+)'",open('py_'+n+'.py').read()).group(1)
    df=pd.read_csv(csv)
    F=list(df['F (N)'])
    m=re.search(r"D_max = ([\d.]+) mm .*M = ([\d.]+) g",p.stdout)
    dF=max(abs(a-b) for a,b in zip(F,v['F']))
    print(f"{n:9s} members {len(F)}={len(v['F'])}  maxdF={dF:.3f}  D py={m.group(1)} js={v['D']}  M py={m.group(2)} js={v['M']}  {v['det']}")
