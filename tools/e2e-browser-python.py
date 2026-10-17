import json, threading, http.server, socketserver, functools, sys, os, time
from playwright.sync_api import sync_playwright
ROOT='/home/claude/proj'; OUT=ROOT+'/tools/out/shots'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
httpd=socketserver.TCPServer(('127.0.0.1',0),functools.partial(Q,directory=ROOT)); port=httpd.server_address[1]
threading.Thread(target=httpd.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{port}/'
ONB=json.dumps({'consent':{'version':'1.0','acceptedAt':'2026-10-10T00:00:00Z'},'tutorial':{'status':'skipped','at':'2026-10-10T00:00:00Z'}})
res={}
def check(n,ok,info=None):
    res[n]={'ok':bool(ok),'info':info}; print(('PASS ' if ok else 'FAIL ')+n, json.dumps(info)[:300] if info is not None else '')
with sync_playwright() as pw:
    br=pw.chromium.launch(args=['--no-sandbox'])
    def open_(save=None):
        ctx=br.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        page=ctx.new_page(); errs=[]
        page.on('pageerror',lambda e:errs.append(str(e)))
        page.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        page.add_init_script("([onb,save])=>{try{localStorage.setItem('arrowflow.onboarding.v1',onb);if(save)localStorage.setItem('arrowflow.save.v1',save);}catch(e){}}" if False else "")
        page.add_init_script(f"try{{localStorage.setItem('arrowflow.onboarding.v1',{json.dumps(ONB)});{('localStorage.setItem(\"arrowflow.save.v1\",'+json.dumps(save)+');') if save else ''}}}catch(e){{}}")
        page.goto(base,wait_until='load'); page.wait_for_timeout(400)
        return ctx,page,errs
    # 1. every level, real engine
    ctx,page,errs=open_()
    r=page.evaluate("""()=>{document.documentElement.dataset.motion='reduced';const bad=[];let moves=0;
      for(let id=1;id<=AF.Levels.TOTAL;id++){const snap=AF.Game.loadLevel(id);if(!snap){bad.push([id,'did not load']);continue;}
        const p=AF.Game.getPuzzle();const order=AF.Rules.solve(p).order;
        for(const a of order){if(!AF.Game.canArrowExit(a)){bad.push([id,'arrow '+a+' not free']);break;}
          const r=AF.Game.attemptArrowMove(a);moves++;if(r!=='moving'){bad.push([id,'move '+a+' -> '+r]);break;}}
        const st=AF.Game.getState();if(st.status!=='complete'||st.lives!==3||st.cleared!==p.arrows.length)bad.push([id,'ended '+st.status+' lives '+st.lives+' cleared '+st.cleared+'/'+p.arrows.length]);}
      return {bad,moves,highest:AF.Storage.getHighestUnlocked()}}""")
    check('all 1000 levels play to completion in the real game engine, no life lost',len(r['bad'])==0,{'failures':r['bad'][:5],'moves':r['moves'],'highestUnlockedAfter':r['highest']})
    check('no page errors while playing all levels',len(errs)==0,errs[:3]); ctx.close()
    # 2. real taps (mouse clicks on the rendered SVG arrows) through whole levels, spread over the campaign and all tiers
    ctx,page,errs=open_()
    page.evaluate("document.documentElement.dataset.motion='reduced'")
    sample=sorted(set(list(range(51,1001,40))+[139,400,700,1000]))
    tiers=page.evaluate("()=>Object.fromEntries(AF.Levels.all.map(l=>[l.id,l.tier]))")
    bad=[];taps=0;blocked_ok=0;blocked_n=0;seen_t={}
    for lid in sample:
        page.evaluate("(i)=>{AF.Game.loadLevel(i);AF.UI.renderGame(AF.Game.getState());AF.UI.show('game','fade');}",lid)
        page.wait_for_function("()=>AF.Game.getState().status==='playing'",timeout=3000)
        page.wait_for_timeout(120)
        order=page.evaluate("()=>AF.Rules.solve(AF.Game.getPuzzle()).order")
        def pt(aid):
            return page.evaluate("""(id)=>{const g=document.querySelector('#board .arrow[data-id="'+id+'"]');if(!g)return null;const p=g.querySelector('.arrow__hit');const L=p.getTotalLength();
              const q=p.getPointAtLength(L*0.5);const m=p.getScreenCTM();return [m.a*q.x+m.c*q.y+m.e, m.b*q.x+m.d*q.y+m.f];}""",aid)
        # one real tap on a blocked arrow first: must cost exactly one life
        blk=page.evaluate("()=>{const p=AF.Game.getPuzzle();const a=p.arrows.find(a=>!AF.Game.canArrowExit(a.id));return a?a.id:null}")
        if blk:
            x,y=pt(blk); page.mouse.click(x,y); blocked_n+=1
            if page.evaluate("()=>AF.Game.getState().lives")==2: blocked_ok+=1
            page.evaluate("()=>AF.Game.restartLevel()"); page.wait_for_function("()=>{const s=AF.Game.getState();return s.status==='playing'&&s.lives===3&&s.cleared===0}",timeout=3000); page.wait_for_timeout(60)
        for aid in order:
            p_=pt(aid)
            if p_ is None: bad.append([lid,'arrow '+aid+' missing from DOM']);break
            page.mouse.click(p_[0],p_[1]); taps+=1
            page.wait_for_function("(id)=>!document.querySelector('#board .arrow[data-id=\"'+id+'\"]') || document.querySelector('#board .arrow[data-id=\"'+id+'\"]').classList.contains('arrow--gone') || true",arg=aid,timeout=2000)
        page.wait_for_timeout(60)
        st=page.evaluate("()=>AF.Game.getState()")
        n=len(order)
        if st['status']!='complete' or st['cleared']!=n or st['lives']!=3: bad.append([lid,st['status'],st['cleared'],n,st['lives']])
        # a player sees the win sheet and taps through it; do the same so it never covers the next board
        try: page.wait_for_selector('.sheet.is-open',timeout=2000)
        except Exception: pass
        page.evaluate("()=>AF.UI.closeSheet()"); page.wait_for_timeout(80)
        seen_t[tiers[str(lid)]]=seen_t.get(tiers[str(lid)],0)+1
    check(f'real mouse/touch taps clear {len(sample)} sampled levels completely (taps on actual arrow shapes)',len(bad)==0,{'failures':bad[:5],'taps':taps,'tiers':seen_t})
    check('a tap on a blocked arrow costs exactly one life (real taps)',blocked_ok==blocked_n,{'ok':blocked_ok,'of':blocked_n})
    check('no page errors during real-tap play',len(errs)==0,errs[:3]); ctx.close()
    # 3. hint/undo/restart on a redesigned level
    ctx,page,errs=open_()
    r=page.evaluate("""()=>{document.documentElement.dataset.motion='reduced';AF.Game.loadLevel(400);const p=AF.Game.getPuzzle();
      const blocked=p.arrows.find(a=>!AF.Game.canArrowExit(a.id));const l0=AF.Game.getState().lives;const res=AF.Game.attemptArrowMove(blocked.id);const l1=AF.Game.getState().lives;
      const hint=AF.Game.hint();const free=p.arrows.find(a=>AF.Game.canArrowExit(a.id));AF.Game.attemptArrowMove(free.id);const u=AF.Game.undo();const c=AF.Game.getState().cleared;AF.Game.restartLevel();
      return {res,l0,l1,hint:hint.status,undo:u.status,c,after:AF.Game.getState().cleared,lives:AF.Game.getState().lives}}""")
    check('level 400: blocked tap costs a life; hint, undo, restart work',r['res']=='blocked' and r['l1']==r['l0']-1 and r['hint']=='ok' and r['undo']=='ok' and r['c']==0 and r['after']==0 and r['lives']==3,r); ctx.close()
    # 4. saves
    ctx,page,errs=open_(json.dumps({'highestUnlocked':50,'allCleared':True,'currentLevel':50,'levelProgress':None,'settings':{'sound':True,'vibration':True,'reduceMotion':False}}))
    r=page.evaluate("()=>({h:AF.Storage.getHighestUnlocked(),c50:AF.Storage.isCompleted(50),c51:AF.Storage.isCompleted(51),count:AF.Storage.completedCount()})")
    check('existing save (50 cleared) still continues at level 51',r['h']==51 and r['c50'] and not r['c51'] and r['count']==50,r); ctx.close()
    ctx,page,errs=open_(json.dumps({'highestUnlocked':23,'allCleared':False,'currentLevel':23,'levelProgress':{'levelId':23,'exited':[],'lives':2},'settings':{'sound':True,'vibration':True,'reduceMotion':True}}))
    m=page.evaluate("""()=>{const p=AF.Levels.get(23).puzzle,first=AF.Rules.solve(p).order.slice(0,2);AF.Storage.saveLevelProgress(23,first,2);const s=AF.Game.loadLevel(23,AF.Storage.getLevelProgress(23));return {cleared:s.cleared,lives:s.lives,h:AF.Storage.getHighestUnlocked()}}""")
    check('mid-level save for an untouched original level resumes correctly',m['cleared']==2 and m['lives']==2 and m['h']==23,m); ctx.close()
    # 5. screenshots of redesigned levels in the real UI (phone viewport)
    ctx,page,errs=open_(json.dumps({'highestUnlocked':200,'allCleared':False,'currentLevel':51,'levelProgress':None,'settings':{'sound':False,'vibration':False,'reduceMotion':True}}))
    for lid in [1,60,120,400,700,950]:
        page.evaluate("(i)=>{document.documentElement.dataset.motion='reduced';AF.Game.loadLevel(i);AF.UI.renderGame(AF.Game.getState());AF.UI.show('game','fade');}",lid)
        page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/level-{lid}.png')
    check('no page errors on game screens',len(errs)==0,errs[:3]); ctx.close()
    br.close()
bad=[k for k,v in res.items() if not v['ok']]
json.dump(res,open(ROOT+'/tools/out/e2e-report.json','w'),indent=1)
print('E2E FAILED' if bad else 'E2E PASSED', len(res)-len(bad),'/',len(res))
