import json
from statistics import NormalDist
import os; B=os.path.dirname(os.path.abspath(__file__))+'/'
def load(t): d=json.load(open(B+t+'.json')); return {c['a1']:c['value'] for row in d['cells'] for c in row}
I=load('Inputs_and_Summary'); C=load('Countries'); V=load('Variety_Replacement'); K=load('Katie_Stunting')
SC=I['B3']; idx={'Pessimistic':'B','Median':'C','Optimistic':'D'}[SC]
act=lambda r: I[f'{idx}{r}']
F24,F25,F26,F40,F41,F42,F43=[act(r) for r in (24,25,26,40,41,42,43)]
F12=I[f'{idx}6']*0.5*0.6; F13=I[f'{idx}7']*0.25*0.6; F14=I[f'{idx}8']*0.5*0.6
F34=act(34); F62,F63,F65=act(62),act(63),act(65)
tier={I[f'A{r}']:act(r) for r in range(17,22)}
B29=0.025/3; B30=I['B30']; B31=I['B31']; B32=I['B32']; B33=I['B33']; B36=I['B36']; B37=I['B37']; B44=I['B44']; B64=I['B64']; B66=I['B66']
ret_zn=[I['B46'],I['C46'],I['D46']]; ret_fe=[I['B47'],I['C47'],I['D47']]
reg={I[f'A{r}']:(I[f'B{r}'],I[f'C{r}']) for r in range(69,76)}
N=75; rows=range(4,79)
col=lambda c,r: C.get(f'{c}{r}')
pop=[col('C',r) for r in rows]; pop5=[col('D',r) for r in rows]
share=[[col('V',r)/col('U',r) for r in rows],[col('X',r)/col('U',r) for r in rows],[col('AB',r)/col('U',r) for r in rows]]
AV=[col('AV',r) for r in rows]; S=[col('S',r) for r in rows]; T=[col('T',r) for r in rows]
J=[max(2030,tier[col('E',r)]) for r in rows]
B48=min(1,1.5e9/sum(p*1e6*a for p,a in zip(pop,AV))); B28=0.02*B48
# fiber per country
AU=[]
for r in rows:
    x0,rate=reg[col('B',r)]; dl=F62*(col('AB',r)/col('U',r)); x1=min(B64,x0+dl)
    rr0=F63**((x0-B64)/7); paf0=(rr0-1)/rr0; rr1=F63**((x1-B64)/7); paf1=(rr1-1)/rr1
    mf=0 if paf0<=0 else (paf0-paf1)/paf0; AU.append(rate*mf*F65)
YEARS=range(2030,2051)
def vr(crop,i,y):
    off=(5,85,165)[crop]; Z=V.get(f'Z{off+i}'); AA=V.get(f'AA{off+i}')
    if y<J[i]: return 0.0
    if Z is None or Z=='': v=min(F24,(F24/F25)*F26*(y-J[i]+1))
    else: v=min(F24,F41*Z/100,(AA/100)*F26*(y-J[i]+1))
    return v*F40
# Katie
nd=NormalDist(); 
B9=K['B9']; dHAZ=K['B6']*F34*K['B7']/K['B8']
kreg={K[f'A{r}']:(K[f'B{r}'],K[f'C{r}']) for r in range(20,27)}
W=[];Vk=[]
cdf=lambda x,m: NormalDist(m,B9).cdf(x)
for i,r in enumerate(rows):
    p=T[i]
    try: F=-2-B9*nd.inv_cdf(p)
    except Exception: F=0
    H=F+dHAZ
    def bins(m): return (1-cdf(-1,m), cdf(-1,m)-cdf(-2,m), cdf(-2,m)-cdf(-3,m), cdf(-3,m))
    b0=bins(F); b1=bins(H)
    rrs=(1,K['B10'],K['B11'],K['B12'])
    M=sum(a*b for a,b in zip(b0,rrs)); R=sum(a*b for a,b in zip(b1,rrs))
    Sx=0 if M==0 else 1-R/M
    u5,le=kreg[col('B',r)]; Tx=(u5*K['B14']/1000)*Sx; Vk.append(Tx*(le-K['B13']))
    W.append(0 if b0[2]+b0[3]==0 else 1-(b1[2]+b1[3])/(b0[2]+b0[3]))
W_calc=W[:]
out={}
tot={}
kat={}
USE_SHEET_W=False  # True: use Katie Stunting!W values from the sheet (removes NORMSINV precision noise)
if USE_SHEET_W: W=[K[f'W{30+i}'] for i in range(N)]
for k,y in enumerate(YEARS):
    sec_s=(1-F42)**k; sec_m=(1-F43)**k
    crop_tot=[0,0,0]; katie=[0,0,0]; cap=0
    vrs=[[vr(c,i,y) for i in range(N)] for c in range(3)]
    for i in range(N):
        sums={'zn':0,'fe':0,'pw':0}
        for c in range(3):
            base=vrs[c][i]*(1-B32)
            zn=sec_m*pop[i]*1e6*share[c][i]*AV[i]*B28*F12*ret_zn[c]*base
            fe=sec_m*pop[i]*1e6*share[c][i]*S[i]*B29*F13*ret_fe[c]*base
            pw=sec_s*pop[i]*1e6*share[c][i]*T[i]*B30*F14*base
            st=sec_s*pop5[i]*1e6*share[c][i]*T[i]*B37*B31*(W[i] if B44=='HAZ shift' else F34)*base
            crop_tot[c]+=zn+fe+pw+st
            katie[c]+=sec_s*pop5[i]*1e6*share[c][i]*B37*(1-B32)*Vk[i]*vrs[c][i]
            sums['zn']+=zn; sums['fe']+=fe; sums['pw']+=pw
            out[(c,i,y)]=dict(vr=vrs[c][i],zn=zn,fe=fe,pw=pw,st=st)
        crop_tot[2]+=pop[i]*1e6*AU[i]*vrs[2][i]*(1-B66)
        g=sum(share[c][i]*vrs[c][i] for c in range(3))
        for key,eff in (('zn',F12),('fe',F13),('pw',F14)):
            gg=eff*g; cap+=sums[key]*(1-(1 if gg==0 else min(1,gg)/gg))
    tot[y]=[x*B36 for x in crop_tot]+[sum(crop_tot)*B36-cap*B36]
    kat[y]=katie
if __name__=='__main__':
    print('B48',B48,I['B48'])
    print('W max diff',max(abs(a-K[f'W{30+i}']) for i,a in enumerate(W_calc)))
    cols='BCDEFGHIJKLMNOPQRSTUV'
    md=0
    for k,y in enumerate(YEARS):
        for j,r in enumerate((80,81,82,83)):
            sv=I[f'{cols[k]}{r}']; md=max(md,abs(tot[y][j]-sv)/max(1,abs(sv)))
    print('max rel diff yearly rows',md)
    print([sum(tot[y][j] for y in YEARS) for j in range(4)],[I[f'W{r}'] for r in (80,81,82,83)])
    # Katie-style rows 179-182: (Zn+Fe+protein wasting)+Katie mortality, x B36, minus cap
    kt=[]
    for k,y in enumerate(YEARS):
        row=[]
        for c in range(3):
            v=sum(out[(c,i,y)]['zn']+out[(c,i,y)]['fe']+out[(c,i,y)]['pw'] for i in range(N))+kat[y][c]
            if c==2: v+=sum(pop[i]*1e6*AU[i]*out[(2,i,y)]['vr']*(1-B66) for i in range(N))
            row.append(v*B36)
        kt.append(row)
    print('Katie totals', [sum(r[c] for r in kt) for c in range(3)], [I[f'W{r}'] for r in (179,180,181)])
