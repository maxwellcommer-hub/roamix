import re,sys,os
S=os.path.dirname(os.path.abspath(__file__))
P=os.path.expanduser('~/roamix-privacy')
wm=open(S+'/wm.txt').read()
sparks=re.search(r'<g class="sparks">.*?</g>',wm,re.S).group(0)
globe=[p for p in re.findall(r'<path d="[^"]*"/>',wm) if p.startswith('<path d="M77.22')][0]
rpath=[p for p in re.findall(r'<path d="[^"]*"/>',wm) if p.startswith('<path d="M39.14')][0]
world=re.search(r'<path[^>]*/>',open(P+'/assets/world.svg').read(),re.S).group(0)
FONTS=f'''
@font-face{{font-family:B;src:url(file://{P}/fonts/BricolageGrotesque-ExtraBold.ttf)}}
@font-face{{font-family:T;src:url(file://{P}/fonts/SchibstedGrotesk-Medium.ttf)}}
@font-face{{font-family:M;src:url(file://{P}/fonts/MartianMono-Regular.ttf)}}
'''
DEFS=f'''<svg width=0 height=0 style="position:absolute"><defs>
<g id="globe">{sparks}{globe}{rpath}</g>{wm}
<g id="world">{world}</g></defs></svg>'''
V,C,K,VD='#E8401E','#F7F4ED','#16150F','#C0300F'

def page(w,h,body,css=''):
    return f'''<!doctype html><html><head><meta charset=utf-8><style>{FONTS}
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:{V}}}
.a{{position:absolute}} {css}</style></head><body>{DEFS}{body}</body></html>'''

# globe bbox (in wm units), measured once by the browser; fit by viewBox
GB='28 14 64 81'   # x y w h around sparks+globe; checked in render
def avatar(size, scale):
    # scale = fraction of the canvas the globe+sparks span (height)
    gw,gh=77,81
    vh=gh/scale; vw=vh
    x=14.5+gw/2-vw/2; y=14+gh/2-vh/2
    return page(size,size,f'<svg class=a style="inset:0" width={size} height={size} viewBox="{x:.2f} {y:.2f} {vw:.2f} {vh:.2f}" fill="{C}"><use href="#globe"/></svg>')

def banner(w,h,safe,wmw,tag,tagsize,atlas,plain=False):
    # atlas: (x,y,width) of world map in px; safe: (x,y,w,h) where type lives
    ax,ay,aw=atlas
    sx,sy,sw,sh=safe
    arc=f'''<svg class=a style="inset:0" width={w} height={h} viewBox="0 0 {w} {h}">
      <g transform="translate({ax},{ay}) scale({aw/2000})"><use href="#world"/></g></svg>'''
    body=arc+f'''
    <div class=a style="left:{sx}px;top:{sy}px;width:{sw}px;height:{sh}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:{tagsize*0.7}px;color:{C}">
      <svg width={wmw} viewBox="0 0 247.43 108.6" style="display:block;fill:{C};margin:-{wmw*0.08}px 0" ><use href="#wm"/></svg>
      <div style="font:{tagsize}px/1 M;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap">{tag}</div>
    </div>'''
    return page(w,h,arc if plain else body)

TAG='Fly back through any trip&nbsp;&nbsp;·&nbsp;&nbsp;No servers&nbsp;&nbsp;·&nbsp;&nbsp;No tracking'
out={}
out['avatar']=(avatar(1080,0.7),1080,1080)
# X header 1500x500. Avatar overlaps bottom-left; keep type centred-right.
out['x-header']=(banner(1500,500,(330,60,1110,330),560,TAG,19,(-60,-150,1620)),1500,500)
# YouTube 2560x1440, safe 1546x423 centred (507,508)
out['youtube-banner']=(banner(2560,1440,(507,508,1546,423),820,TAG,32,(-80,-130,2720)),2560,1440)
# Facebook 1640x720 (2x of 820x360); desktop shows 1640x624 middle, mobile 1280x720 middle -> safe 1280x624 centred
out['facebook-cover']=(banner(1640,720,(180,48,1280,624),640,TAG,20,(-40,-170,1720)),1640,720)
for k,(html,w,h) in out.items():
    open(f'{S}/{k}.html','w').write(html)
    print(k,w,h)

out2={'x-header-plain':(banner(1500,500,(330,60,1110,330),560,TAG,19,(-60,-150,1620),True),1500,500),
      'facebook-cover-plain':(banner(1640,720,(180,48,1280,624),640,TAG,20,(-40,-170,1720),True),1640,720)}
for k,(html,w,h) in out2.items(): open(f'{S}/{k}.html','w').write(html)
