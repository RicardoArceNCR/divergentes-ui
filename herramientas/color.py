import math
def hex2rgb(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def Y(h):
    r,g,b=map(lin,hex2rgb(h)); return 0.2126*r+0.7152*g+0.0722*b
def wcag(a,b):
    ya,yb=Y(a),Y(b); hi,lo=max(ya,yb),min(ya,yb); return (hi+0.05)/(lo+0.05)
# APCA 0.0.98G-4g
def apca(txt,bg):
    def sY(h):
        r,g,b=hex2rgb(h)
        return 0.2126729*r**2.4+0.7151522*g**2.4+0.0721750*b**2.4
    def clamp(y): return y if y>0.022 else y+(0.022-y)**1.414
    Yt,Yb=clamp(sY(txt)),clamp(sY(bg))
    if abs(Yb-Yt)<0.0005: return 0
    if Yb>Yt:
        S=(Yb**0.56-Yt**0.57)*1.14
        return 0 if S<0.1 else (S-0.027)*100
    else:
        S=(Yb**0.65-Yt**0.62)*1.14
        return 0 if S>-0.1 else (S+0.027)*100
def oklch(h):
    r,g,b=map(lin,hex2rgb(h))
    l=(0.4122214708*r+0.5363325363*g+0.0514459929*b)**(1/3)
    m=(0.2119034982*r+0.6806995451*g+0.1073969566*b)**(1/3)
    s=(0.0883024619*r+0.2817188376*g+0.6299787005*b)**(1/3)
    L=0.2104542553*l+0.793617785*m-0.0040720468*s
    A=1.9779984951*l-2.428592205*m+0.4505937099*s
    B=0.0259040371*l+0.7827717662*m-0.808675766*s
    C=math.hypot(A,B); H=math.degrees(math.atan2(B,A))%360
    return L,C,H
def oklch2hex(L,C,H):
    a=C*math.cos(math.radians(H)); b=C*math.sin(math.radians(H))
    l_=L+0.3963377774*a+0.2158037573*b
    m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r=4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    def enc(c):
        return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
    rgb=[enc(c) for c in (r,g,bb)]
    ok=all(-1e-4<=c<=1+1e-4 for c in rgb)
    return '#%02X%02X%02X'%tuple(round(min(1,max(0,c))*255) for c in rgb), ok
def in_gamut(L,C,H):
    return oklch2hex(L,C,H)[1]
def gamut_map(L,C,H):
    lo,hi=0,C
    if in_gamut(L,C,H): return oklch2hex(L,C,H)[0]
    for _ in range(30):
        mid=(lo+hi)/2
        if in_gamut(L,mid,H): lo=mid
        else: hi=mid
    return oklch2hex(L,lo,H)[0]
