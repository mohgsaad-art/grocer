const { solveLP } = require('./engine.js');
let pass=0, fail=0;
function chk(name, got, want, tol){
  tol = tol||1e-6;
  const ok = Math.abs(got-want) < tol;
  console.log((ok?"  PASS ":"  FAIL ")+name+"  got "+(+got.toFixed(6))+" want "+want);
  ok?pass++:fail++;
}

// 1. textbook max 3x+5y -> min -3x-5y ; x<=4, 2y<=12, 3x+2y<=18  => 36 at (2,6)
let r = solveLP(2,[-3,-5],[
  {a:[1,0],op:"<=",b:4},{a:[0,2],op:"<=",b:12},{a:[3,2],op:"<=",b:18}]);
console.log("1. classic max (expect 36 at 2,6)  status="+r.status);
chk("obj", -r.z, 36); chk("x", r.x[0], 2); chk("y", r.x[1], 6);

// 2. Stigler-style diet: min cost, two foods, protein>=60, kcal>=2000
//    f1: 1 kr, 10 protein, 200 kcal ; f2: 2 kr, 30 protein, 150 kcal
r = solveLP(2,[1,2],[
  {a:[10,30],op:">=",b:60},{a:[200,150],op:">=",b:2000}]);
console.log("\n2. diet min cost  status="+r.status);
// optimum: solve 10a+30b>=60, 200a+150b>=2000 -> a=9.2,b=0.6? check LP
console.log("   x =", r.x.map(v=>+v.toFixed(4)), "cost =", +r.z.toFixed(4));
// constraints are >=, so check they're MET, and that cost beats alternatives
const prot=10*r.x[0]+30*r.x[1], kc=200*r.x[0]+150*r.x[1];
console.log("   protein="+prot.toFixed(2)+" (>=60) kcal="+kc.toFixed(2)+" (>=2000)");
(prot>=60-1e-6 && kc>=2000-1e-6)?(pass++,console.log("  PASS constraints met")):(fail++,console.log("  FAIL constraints violated"));
// brute-force the optimum on a grid to confirm the LP found the true minimum
let bf=Infinity;
for(let a=0;a<=200;a++)for(let b=0;b<=200;b++){const A=a/10,B=b/10;
  if(10*A+30*B>=60 && 200*A+150*B>=2000) bf=Math.min(bf,A+2*B);}
chk("matches brute force", r.z, bf, 1e-3);

// 3. equality + bounds
r = solveLP(3,[1,1,1],[
  {a:[1,1,1],op:"=",b:10},{a:[1,0,0],op:"<=",b:3},{a:[0,1,0],op:"<=",b:3}]);
console.log("\n3. equality  status="+r.status);
chk("sum", r.x[0]+r.x[1]+r.x[2], 10); chk("obj", r.z, 10);

// 4. infeasible
r = solveLP(1,[1],[{a:[1],op:">=",b:5},{a:[1],op:"<=",b:2}]);
console.log("\n4. infeasible  status="+r.status, "ok="+r.ok);
(r.status==="infeasible")?(pass++,console.log("  PASS detected")):(fail++,console.log("  FAIL not detected"));

// 5. unbounded
r = solveLP(1,[-1],[{a:[1],op:">=",b:1}]);
console.log("\n5. unbounded  status="+r.status);
(r.status==="unbounded")?(pass++,console.log("  PASS detected")):(fail++,console.log("  FAIL not detected"));

// 6. negative cost with an upper bound (the "eat the expiring stock" case):
//    credit for using stock, bounded by what's there
r = solveLP(2,[-5,2],[{a:[1,0],op:"<=",b:3},{a:[1,1],op:">=",b:4}]);
console.log("\n6. credit bounded  status="+r.status, "x="+r.x.map(v=>+v.toFixed(3)));
chk("uses all credit stock", r.x[0], 3); chk("buys the rest", r.x[1], 1);

// 7. bigger random feasibility/consistency sweep
let bad=0;
for(let t=0;t<40;t++){
  const n=6,m=8, A=[],obj=[];
  for(let j=0;j<n;j++) obj.push(Math.random()*5-1);
  const cons=[];
  for(let i=0;i<m;i++){
    const a=[]; for(let j=0;j<n;j++) a.push(Math.random()*3);
    cons.push({a:a,op:"<=",b:5+Math.random()*10});
  }
  for(let j=0;j<n;j++){const a=new Array(n).fill(0);a[j]=1;cons.push({a:a,op:"<=",b:4});}
  const s=solveLP(n,obj,cons);
  if(!s.ok){bad++;continue;}
  // verify feasibility of the returned point
  for(const c of cons){
    let lhs=0; for(let j=0;j<n;j++) lhs+=c.a[j]*s.x[j];
    if(lhs > c.b + 1e-6){bad++;break;}
  }
}
console.log("\n7. random sweep: "+(40-bad)+"/40 solved and feasible");
(bad===0)?pass++:fail++;

console.log("\n==== "+pass+" passed, "+fail+" failed ====");
process.exit(fail?1:0);
