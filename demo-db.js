/* IV Hub demo: a stand-in for the database.

   The demo pages are the real pages. They talk to `supabase.createClient()`
   exactly as the live site does; this file answers in its place, from sample
   data held in this browser tab. Nothing is sent anywhere and no real person
   appears in it. Closing the tab, or "Reset sample data", puts it all back.

   Only what the pages actually use is implemented: table reads with the
   filters they call, inserts, updates, upserts and deletes, the handful of
   database functions, sign-in, and no-op realtime channels. */
(function(){
  'use strict';
  var KEY='ivdemo_db_v4', SESSION='ivdemo_session';

  /* ── sample data ─────────────────────────────────────────── */
  function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function addDays(s,n){ var d=new Date(s+'T12:00'); d.setDate(d.getDate()+n); return iso(d); }
  function today(){ return iso(new Date()); }

  var FIRST_M=['Adil','Arman','Bilal','Danyal','Faiz','Hamza','Idris','Jamil','Kamran','Luqman','Mikail','Nadir','Omar','Rafiq','Sahil','Tariq','Usman','Wasim','Yasin','Zain','Rehan','Shaan'];
  var FIRST_F=['Aleena','Anaya','Dina','Farah','Hana','Inaya','Jasmin','Kiran','Laila','Maryam','Nadia','Noor','Rania','Sabah','Saira','Tania','Yasmin','Zara','Zoya','Amal','Mina','Sana'];
  var LAST=['Alidina','Bhimani','Charania','Damji','Esmail','Fazal','Gulamali','Hirji','Jetha','Kanji','Lalani','Manji','Nanji','Pirani','Rajan','Samji','Tejani','Virani','Walji','Kassam','Ladak','Merali'];

  function buildMembers(){
    var out=[], id=1;
    ['A','B'].forEach(function(team,ti){
      for(var i=0;i<44;i++){
        var male=i%2===0, n=Math.floor(i/2);
        var first=(male?FIRST_M:FIRST_F)[(n+ti*11)%22], last=LAST[(n*3+ti*7+(male?0:5))%22];
        var age=n<5?'child':n<12?'youth':'adult';
        var yr=age==='child'?2016+(n%3):age==='youth'?2010+(n%5):1978+((n*3)%24);
        var rank=n===21?(male?'Team Leader':'Assistant Team Lead'):'Member';
        out.push({id:id++,team:team,name:first+' '+last,gender:male?'Male':'Female',age_group:age,status:'active',
          created_at:'2026-06-01T00:00:00Z',nandi:age==='adult'&&n>=12&&n<16,rank:rank,
          spec:(age!=='child'&&n%3===1)?['AV']:[],linked_username:null,
          phone:'021 555 '+String(1000+id*7).slice(-4),email:(first+'.'+last).toLowerCase()+'@example.org',
          away:[],prefs:{prefer:[],avoid:[]},notes:'',dob:yr+'-'+String(1+(n*5)%12).padStart(2,'0')+'-'+String(1+(n*7)%27).padStart(2,'0')});
      }
    });
    return out;
  }

  var EVENTS=[['2026-10-02','Friday Majlis','friday','A','Casual',false],['2026-10-09','Friday Majlis','friday','A','Casual',true],
    ['2026-10-11','Chandraat','chandraat','B','Formal',false],['2026-10-16','Friday Majlis','friday','B','Casual',false],
    ['2026-10-17','Baithulkhayal','baithulkhayal','B','Formal',false],['2026-10-19','Paanch Baar Saal','pbs','B','Casual',false],
    ['2026-10-23','Friday Majlis','friday','B','Casual',true],['2026-10-24','Student Majlis','student','B','Casual',false],
    ['2026-10-30','Friday Majlis','friday','B','Casual',true],['2026-11-06','Friday Majlis','friday','B','Casual',true],
    ['2026-11-10','Chandraat','chandraat','A','Formal',false],['2026-11-13','Friday Majlis','friday','A','Casual',true],
    ['2026-11-17','Paanch Baar Saal','pbs','A','Casual',false],['2026-11-20','Friday Majlis','friday','A','Casual',true],
    ['2026-11-27','Friday Majlis','friday','A','Casual',true],['2026-12-04','Friday Majlis','friday','A','Casual',true],
    ['2026-12-09','Chandraat','chandraat','B','Formal',false],['2026-12-11','Friday Majlis','friday','B','Casual',true],
    ['2026-12-12','Baithulkhayal','baithulkhayal','B','Casual',false],['2026-12-17','Paanch Baar Saal','pbs','B','Casual',false],
    ['2026-12-18','Friday Majlis','friday','B','Casual',true],['2026-12-19','Student Majlis','student','B','Casual',false],
    ['2026-12-25','Friday Majlis','friday','B','Casual',true],['2027-01-01','Friday Majlis','friday','B','Casual',true],
    ['2027-01-08','Friday Majlis','friday','A','Casual',true],['2027-01-15','Friday Majlis','friday','A','Casual',true],
    ['2027-01-16','Paanch Baar Saal','pbs','A','Casual',false],['2027-01-22','Friday Majlis','friday','A','Casual',true],
    ['2027-01-29','Friday Majlis','friday','A','Casual',true],['2027-02-05','Friday Majlis','friday','A','Casual',true],
    ['2027-02-12','Friday Majlis','friday','B','Casual',true],['2027-02-15','Paanch Baar Saal','pbs','B','Casual',false],
    ['2027-02-19','Friday Majlis','friday','B','Casual',true],['2027-02-26','Friday Majlis','friday','B','Casual',true]];

  // duty key, males, females, who is preferred
  var CORE=[['nandi_labelling',1,1,'adult'],['number_1',1,1,'adult'],['ph_entrance',2,2,'child'],['shoe_entrance',1,1,'youth'],
    ['seating',2,2,'any'],['sukreet',2,2,'adult'],['ghatpaat_closing',1,1,'youth'],['safety_exit',0,1,'adult'],['nandi',1,1,'nandi'],
    ['nandi_setup',1,1,'adult'],['nandi_centre',1,0,'adult'],['nandi_trolley',0,1,'adult'],['nandi_distribution',1,1,'adult'],
    ['nandi_line',4,4,'any'],['nandi_passing',3,3,'child']];
  var CHAI=[['chai',1,0,'adult'],['chai_packup',2,1,'any'],['mph_paat_windup',1,0,'any']];
  var MPH=[['mph_entrance',1,1,'youth'],['mph_seating',1,1,'youth'],['mph_sukreet',1,1,'youth']];

  function buildRoster(ev,members,seed){
    var used={}, assign={};
    function pick(gender,pref){
      var pool=members.filter(function(m){ return m.team===ev.team&&m.gender===gender&&!used[m.id]; });
      var ok=function(m){ return pref==='child'?m.age_group==='child':pref==='youth'?m.age_group==='youth':pref==='nandi'?m.nandi:pref==='adult'?m.age_group==='adult':m.age_group!=='child'; };
      var first=pool.filter(ok), rest=pool.filter(function(m){ return !ok(m)&&(pref==='child'||m.age_group!=='child'); });
      var list=first.length?first:rest; if(!list.length) return null;
      var m=list[seed%list.length]; used[m.id]=1; return {id:m.id,name:m.name};
    }
    var duties=CORE.concat(ev.type==='friday'||ev.type==='chandraat'?CHAI:[]);
    duties.forEach(function(d){
      var slot={m:[],f:[],x:[]};
      for(var i=0;i<d[1];i++){ var p=pick('Male',d[3]); if(p) slot.m.push(p); }
      for(var j=0;j<d[2];j++){ var q=pick('Female',d[3]); if(q) slot.f.push(q); }
      assign[d[0]]=slot;
    });
    if(ev.type==='friday'&&ev.youth){ used={}; MPH.forEach(function(d){   // youth may hold one core and one MPH duty
      var slot={m:[],f:[],x:[]}; var p=pick('Male','youth'); if(p) slot.m.push(p); var q=pick('Female','youth'); if(q) slot.f.push(q); assign[d[0]]=slot; }); }
    return {assign:assign,manual:{},warn:{},gen_at:ev.date+'T00:00:00Z'};
  }

  function seed(){
    var T=today(), db={};
    var members=db.iv_members=buildMembers();
    var leadA=members.filter(function(m){ return m.team==='A'&&m.rank==='Team Leader'; })[0];
    var leadB=members.filter(function(m){ return m.team==='B'&&m.rank==='Team Leader'; })[0];
    var volA=members.filter(function(m){ return m.team==='A'&&m.age_group==='adult'&&m.rank==='Member'; })[3];
    var avPeople=members.filter(function(m){ return m.spec.indexOf('AV')>=0; });
    function prof(n,email,display,perms,member){ return {id:'00000000-0000-4000-8000-0000000000'+String(n).padStart(2,'0'),username:email.split('@')[0],display:display,
      role:perms[0]||'',perms:perms,created_at:addDays(T,-200+n*9)+'T09:00:00Z',email:email,member_id:member||null,last_seen:addDays(T,-(n%6))+'T08:30:00Z'}; }
    db.profiles=[
      prof(1,'owner@demo.ivhub','Demo Owner',['owner'],null),
      prof(2,'teamlead@demo.ivhub',leadA.name,['tl_a'],leadA.id),
      prof(3,'avlead@demo.ivhub',avPeople[0].name,['av_admin'],avPeople[0].id),
      prof(4,'volunteer@demo.ivhub',volA.name,['team_a'],volA.id),
      prof(5,'director@demo.ivhub','Sample Director',['director'],null),
      prof(6,'facilitator@demo.ivhub','Sample Facilitator',['facilitator'],null),
      prof(7,'teamlead.b@demo.ivhub',leadB.name,['tl_b'],leadB.id),
      prof(8,'av.assistant@demo.ivhub',avPeople[1].name,['av_atl'],avPeople[1].id),
      prof(9,'new.person@demo.ivhub','New Person',[],null)];
    db.profiles[8].last_seen=null;

    db.iv_events=EVENTS.map(function(e,i){ var past=e[0]<T, near=e[0]>=addDays(T,-45)&&e[0]<=addDays(T,16);
      return {id:i+1,date:e[0],name:e[1],type:e[2],created_at:'2026-09-01T00:00:00Z',team:e[3],uniform:e[4],youth:e[5],
        confirmed:past||near,cover_uid:null,cover_name:null,cover_by:null,confirmed_at:(past||near)?addDays(e[0],-6)+'T07:00:00Z':null}; });
    db.iv_roster=[]; db.iv_attendance=[];
    db.iv_events.forEach(function(ev,i){
      if(ev.date<addDays(T,-45)||ev.date>addDays(T,30)) return;
      var r=buildRoster(ev,members,i*5+3);
      db.iv_roster.push({date:ev.date,data:r,updated_at:ev.date+'T00:00:00Z',event_id:ev.id});
      if(ev.date<T){ var seen={}, n=0;
        Object.keys(r.assign).forEach(function(k){ ['m','f','x'].forEach(function(c){ r.assign[k][c].forEach(function(p){
          if(seen[p.id]) return; seen[p.id]=1; n++;
          var st=(n+i)%11===0?'absent':(n+i)%9===0?'late':(n+i)%14===0?'excused':'present';
          db.iv_attendance.push({event_id:ev.id,member_id:p.id,status:st,marked_by:'teamlead',marked_at:ev.date+'T07:30:00Z',walk_in:false,walk_in_duty:null,in_uniform:null});
        }); }); });
      }
    });

    var DAYSETS=[['Mon','Tue','Fri','Sat','Sun'],['Mon','Wed','Thu','Fri'],['Tue','Wed','Thu','Fri','Sun'],['Mon','Tue','Wed','Sat','Sun'],['Tue','Wed','Thu','Fri','Sat'],['Mon','Wed','Thu','Sat','Sun'],['Mon','Tue','Thu','Fri','Sun']];
    var AVROLES=[['AV Team Lead'],['AV Assistant Team Lead'],['Supervisor','MPH Certified Member'],['Supervisor'],['MPH Certified Member'],['Team Member'],['Team Member'],['Junior Team Member']];
    db.volunteers=avPeople.map(function(m,i){ var roles=AVROLES[Math.min(i,AVROLES.length-1)]; if(i>=8) roles=i%3===0?['Supervisor','MPH Certified Member']:i%3===1?['Team Member']:['MPH Certified Member'];
      var v={id:9000+i,name:m.name,gender:m.gender,status:'active',days:DAYSETS[i%DAYSETS.length],roles:roles,type:roles[0],
        mph:roles.indexOf('MPH Certified Member')>=0||i<2,bds:i%4===0?addDays(T,9+i):'',hub_id:m.id};
      return {id:v.id,data:v,created_at:'2026-06-01T00:00:00Z'}; });
    db.roster=[];
    db.majalis=[[addDays(T,5),'Paanch Baar Saal','Majalis'],[addDays(T,12),'Baithulkhayal','Majalis'],[addDays(T,19),'Student Majlis','Majalis']].map(function(x,i){
      var d={id:7000+i,date:x[0],name:x[1],time:'',type:x[2],uniform:'Casual',category:''};
      return {id:d.id,date:d.date,name:d.name,type:d.type,time:'',data:d}; });
    db.app_users=[];
    db.app_settings=[{key:'day_capacity',value:JSON.stringify({0:2,1:3,2:4,3:4,4:3,5:2,6:3})},
      {key:'active_month',value:JSON.stringify({mo:new Date().getMonth(),yr:new Date().getFullYear()})}];
    db.iv_settings=[{key:'active_team',value:'A'},{key:'anchor',value:{date:'2026-06-15',team:'B'}},{key:'chandraat_overrides',value:{}}];
    db.announcements=[
      {id:1,team:'A',text:'Formal uniform for Chandraat. Please arrive 30 minutes before the first duty.',author:leadA.name,created_at:addDays(T,-3)+'T05:00:00Z'},
      {id:2,team:'A',text:'Nandi certification refresher after Friday Majlis next week.',author:leadA.name,created_at:addDays(T,-9)+'T05:00:00Z'},
      {id:3,team:'B',text:'Roster for the next cycle goes on the calendar this weekend.',author:leadB.name,created_at:addDays(T,-2)+'T05:00:00Z'}];
    db.audit_logs=[
      {id:1,ts:addDays(T,-1)+'T06:10:00Z',username:'teamlead',user_display:leadA.name,action:'attendance',category:'attendance',detail:volA.name+' \u203a present',data:null,user_email:'teamlead@demo.ivhub',team:'A'},
      {id:2,ts:addDays(T,-2)+'T03:40:00Z',username:'owner',user_display:'Demo Owner',action:'Updated login',category:'login',detail:'teamlead.b@demo.ivhub - permissions unchanged (Team B Lead)',data:null,user_email:'owner@demo.ivhub',team:null},
      {id:3,ts:addDays(T,-4)+'T08:00:00Z',username:'teamlead',user_display:leadA.name,action:'Signed in',category:'login',detail:leadA.name+' signed in',data:null,user_email:'teamlead@demo.ivhub',team:null}];
    db.view_logs=[]; db.iv_checklist=[]; db.iv_invite_batches=[]; db.iv_invite_items=[]; db.safety_roster=[];
    return db;
  }

  /* ── storage ─────────────────────────────────────────────── */
  var DB=null;
  function load(){ if(DB) return DB;
    try{ DB=JSON.parse(sessionStorage.getItem(KEY)||'null'); }catch(e){ DB=null; }
    if(!DB){ DB=seed(); save(); }
    return DB; }
  function save(){ try{ sessionStorage.setItem(KEY,JSON.stringify(DB)); }catch(e){} }
  function table(t){ var db=load(); if(!db[t]) db[t]=[]; return db[t]; }
  function clone(x){ return x==null?x:JSON.parse(JSON.stringify(x)); }
  function me(){ try{ return JSON.parse(sessionStorage.getItem(SESSION)||'null'); }catch(e){ return null; } }
  function myProfile(){ var s=me(); return s?table('profiles').filter(function(p){ return p.id===s.id; })[0]||null:null; }
  function myMember(){ var p=myProfile(); return p&&p.member_id!=null?table('iv_members').filter(function(m){ return m.id===p.member_id; })[0]||null:null; }

  var PK={iv_roster:['event_id'],iv_attendance:['event_id','member_id'],iv_settings:['key'],app_settings:['key'],roster:['date'],
    app_users:['username'],safety_roster:['date'],iv_checklist:['team','day']};

  /* ── query builder ───────────────────────────────────────── */
  function Q(t){ this.t=t; this.op='select'; this.f=[]; this.ord=[]; this.lim=null; this.one=null; this.ret=false; this.opts={}; }
  var cmp=function(a,b){ return a==null&&b==null?0:a==null?-1:b==null?1:a<b?-1:a>b?1:0; };
  var same=function(a,b){ return String(a)===String(b); };
  Q.prototype={
    select:function(c,o){ if(this.op!=='select') this.ret=true; this.opts=o||{}; return this; },
    insert:function(r){ this.op='insert'; this.rows=r; return this; },
    upsert:function(r,o){ this.op='upsert'; this.rows=r; this.conflict=o&&o.onConflict; return this; },
    update:function(p){ this.op='update'; this.patch=p; return this; },
    delete:function(){ this.op='delete'; return this; },
    eq:function(c,v){ this.f.push(function(r){ return same(r[c],v); }); return this; },
    neq:function(c,v){ this.f.push(function(r){ return !same(r[c],v); }); return this; },
    in:function(c,v){ var s=(v||[]).map(String); this.f.push(function(r){ return s.indexOf(String(r[c]))>=0; }); return this; },
    gte:function(c,v){ this.f.push(function(r){ return cmp(r[c],v)>=0; }); return this; },
    lte:function(c,v){ this.f.push(function(r){ return cmp(r[c],v)<=0; }); return this; },
    gt:function(c,v){ this.f.push(function(r){ return cmp(r[c],v)>0; }); return this; },
    lt:function(c,v){ this.f.push(function(r){ return cmp(r[c],v)<0; }); return this; },
    is:function(c,v){ this.f.push(function(r){ return v===null?r[c]==null:r[c]===v; }); return this; },
    not:function(c,op,v){ this.f.push(function(r){ return op==='is'?r[c]!=null:!same(r[c],v); }); return this; },
    ilike:function(c,v){ var re=new RegExp('^'+String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*')+'$','i'); this.f.push(function(r){ return re.test(String(r[c]||'')); }); return this; },
    contains:function(c,v){ this.f.push(function(r){ var a=r[c]; return Array.isArray(a)&&[].concat(v).every(function(x){ return a.indexOf(x)>=0; }); }); return this; },
    order:function(c,o){ this.ord.push([c,o&&o.ascending===false?-1:1]); return this; },
    limit:function(n){ this.lim=n; return this; },
    range:function(a,b){ this.off=a; this.lim=b-a+1; return this; },
    maybeSingle:function(){ this.one='maybe'; return this; },
    single:function(){ this.one='single'; return this; },
    match:function(o){ var self=this; Object.keys(o).forEach(function(k){ self.eq(k,o[k]); }); return this; },
    _hit:function(r){ return this.f.every(function(fn){ return fn(r); }); },
    _run:function(){
      var rows=table(this.t), self=this, out=[];
      if(this.op==='select'){
        out=rows.filter(function(r){ return self._hit(r); });
        this.ord.slice().reverse().forEach(function(o){ out.sort(function(a,b){ return cmp(a[o[0]],b[o[0]])*o[1]; }); });
        var count=out.length;
        if(this.off) out=out.slice(this.off);
        if(this.lim!=null) out=out.slice(0,this.lim);
        if(this.opts.head) return {data:null,count:count,error:null};
        out=clone(out);
        if(this.one) return {data:out[0]||null,error:(this.one==='single'&&!out.length)?{message:'No rows found'}:null};
        return {data:out,count:count,error:null};
      }
      var now=new Date().toISOString();
      if(this.op==='insert'||this.op==='upsert'){
        var list=[].concat(this.rows||[]), keys=this.conflict?String(this.conflict).split(',').map(function(s){ return s.trim(); }):(PK[this.t]||['id']);
        list.forEach(function(row){
          row=clone(row);
          var at=-1;
          if(self.op==='upsert'&&keys.every(function(k){ return row[k]!=null; }))
            rows.forEach(function(r,i){ if(keys.every(function(k){ return same(r[k],row[k]); })) at=i; });
          if(at>=0){ Object.assign(rows[at],row); out.push(rows[at]); }
          else{
            if(row.id==null&&!PK[self.t]) row.id=rows.reduce(function(m,r){ return Math.max(m,Number(r.id)||0); },0)+1;
            if(row.created_at===undefined&&/^(iv_members|iv_events|announcements|volunteers|profiles)$/.test(self.t)) row.created_at=now;
            if(self.t==='audit_logs'||self.t==='view_logs') row.ts=row.ts||now;
            rows.push(row); out.push(row);
          }
        });
      } else if(this.op==='update'){
        rows.forEach(function(r){ if(self._hit(r)){ Object.assign(r,clone(self.patch)); out.push(r); } });
      } else if(this.op==='delete'){
        for(var i=rows.length-1;i>=0;i--){ if(self._hit(rows[i])){ out.push(rows[i]); rows.splice(i,1); } }
      }
      save();
      out=clone(out);
      if(this.one) return {data:out[0]||null,error:null};
      return {data:this.ret?out:(this.op==='delete'?out:null),error:null};
    },
    then:function(res,rej){ var r; try{ r=this._run(); }catch(e){ r={data:null,error:{message:String(e&&e.message||e)}}; } return Promise.resolve(r).then(res,rej); }
  };

  /* ── database functions the pages call ───────────────────── */
  function totals(rows){ var t={present:0,late:0,excused:0,absent:0,marked:0}; rows.forEach(function(a){ if(t[a.status]!=null) t[a.status]++; t.marked++; }); return t; }
  var RPC={
    member_attendance_totals:function(a){ var ev={}; table('iv_events').forEach(function(e){ if(e.team===a.p_team) ev[e.id]=1; });
      var by={}; table('iv_attendance').forEach(function(x){ if(ev[x.event_id]) (by[x.member_id]=by[x.member_id]||[]).push(x); });
      return Object.keys(by).map(function(id){ return Object.assign({member_id:+id},totals(by[id])); }); },
    my_attendance_totals:function(){ var m=myMember(); return totals(m?table('iv_attendance').filter(function(x){ return x.member_id===m.id; }):[]); },
    my_member:function(){ var m=myMember(); return m?[clone(m)]:[]; },
    my_member_view:function(){ var m=myMember(); return {member:clone(m),linked:!!m}; },
    set_my_away:function(a){ var m=myMember(); if(!m) throw new Error('Your account is not linked to a member yet. Ask your Team Lead.');
      m.away=(a.dates||[]).filter(function(d){ return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d>today(); }).sort(); return clone(m.away); },
    set_my_details:function(a){ var m=myMember(); if(!m) throw new Error('Your account is not linked to a member yet. Ask your Team Lead.');
      m.phone=a.p_phone||null; m.email=a.p_email||null; m.dob=a.p_dob||null; if(a.p_gender) m.gender=a.p_gender; return clone(m); },
    set_my_display:function(a){ var p=myProfile(), n=String(a.p_display||'').trim(); if(n.length<2) throw new Error('A name needs 2 to 60 characters.'); if(p) p.display=n; return n; },
    touch_last_seen:function(){ var p=myProfile(); if(p) p.last_seen=new Date().toISOString(); return null; },
    roster_seen:function(a){ var r=table('iv_roster').filter(function(x){ return x.event_id===a.p_event_id; })[0], ids=[];
      if(r) Object.keys(r.data.assign||{}).forEach(function(k){ ['m','f','x'].forEach(function(c){ (r.data.assign[k][c]||[]).forEach(function(p,i){ if((p.id+i)%3) ids.push(p.id); }); }); });
      return ids; }
  };

  var NOT_IN_DEMO={message:'function not available in the demo'};
  var client={
    from:function(t){ return new Q(t); },
    rpc:function(name,args){ var fn=RPC[name];
      return Promise.resolve().then(function(){ if(!fn) return {data:null,error:NOT_IN_DEMO};
        try{ var d=fn(args||{}); save(); return {data:d,error:null}; }catch(e){ return {data:null,error:{message:e.message}}; } }); },
    channel:function(){ var ch={on:function(){ return ch; },subscribe:function(){ return ch; },unsubscribe:function(){}}; return ch; },
    removeChannel:function(){},
    functions:{invoke:function(){ return Promise.resolve({data:{error:'Email invitations and password resets are switched off in the demo.'},error:null}); }},
    auth:{
      getSession:function(){ var s=me(); return Promise.resolve({data:{session:s?{user:{id:s.id,email:s.email}}:null},error:null}); },
      signInWithPassword:function(c){ var email=String(c&&c.email||'').trim().toLowerCase();
        var p=table('profiles').filter(function(x){ return x.email===email; })[0];
        if(!p) return Promise.resolve({data:{user:null},error:{message:'Invalid login credentials'}});
        sessionStorage.setItem(SESSION,JSON.stringify({id:p.id,email:p.email}));
        return Promise.resolve({data:{user:{id:p.id,email:p.email},session:{user:{id:p.id,email:p.email}}},error:null}); },
      signOut:function(){ sessionStorage.removeItem(SESSION); try{ localStorage.removeItem('ivhub_session'); }catch(e){} return Promise.resolve({error:null}); },
      updateUser:function(){ return Promise.resolve({data:{},error:null}); },
      onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; }
    }
  };
  window.supabase={createClient:function(){ return client; }};

  /* What the sign-in screen and the "sample data" label use. */
  window.IVDEMO={
    accounts:[
      {email:'teamlead@demo.ivhub',role:'Team A Lead',note:'Builds rosters, marks attendance, manages Team A.'},
      {email:'owner@demo.ivhub',role:'Owner',note:'Sees everything, including accounts and audit logs.'},
      {email:'avlead@demo.ivhub',role:'AV Team Lead',note:'Runs the AV roster and its volunteers.'},
      {email:'volunteer@demo.ivhub',role:'Volunteer',note:'Sees their own duties and details.'}],
    reset:function(){ sessionStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); try{ localStorage.removeItem('ivhub_session'); }catch(e){} location.href='index.html'; }
  };
  // A stale session from before a reset would name an account that no longer exists.
  try{ var ls=JSON.parse(localStorage.getItem('ivhub_session')||'null'); if(ls&&!me()) localStorage.removeItem('ivhub_session'); }catch(e){}
})();
