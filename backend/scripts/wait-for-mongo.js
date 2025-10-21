#!/usr/bin/env node
const { MongoClient } = require("mongodb");
const { spawn } = require("child_process");

function splitArgs(argv){
  const i = argv.indexOf("--");
  return { opts: argv.slice(2, i === -1 ? argv.length : i), cmd: i === -1 ? [] : argv.slice(i+1) };
}
function kv(opts){ const o={}; for (const s of opts){ const [k,v] = s.split("="); o[k]=v??true; } return o; }

async function wait(uri, selMs=1000, maxMs=120000){
  const end = Date.now()+maxMs; let n=0;
  while (true){
    n++;
    try{
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: selMs });
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      await client.close();
      return;
    }catch(e){
      const msg = e instanceof Error ? e.message : String(e);
      process.stdout.write(`wait-for-mongo: attempt ${n} -> ${msg}\n`);
      if (Date.now() >= end) throw new Error("Mongo not ready in time");
      await new Promise(r=>setTimeout(r,1000));
    }
  }
}

(async () => {
  const { opts, cmd } = splitArgs(process.argv);
  const args = kv(opts);
  const uri = args.uri || process.env.MONGODB_URI;
  if (!uri){ console.error("wait-for-mongo: missing MONGODB_URI (env or uri=...)"); process.exit(2); }

  await wait(uri, Number(args.timeoutMs ?? 1000), Number(args.maxWaitMs ?? 120000));
  console.log("wait-for-mongo: Mongo is ready ✅");

  if (!cmd.length) process.exit(0);
  const child = spawn(cmd[0], cmd.slice(1), { stdio: "inherit", shell: true });
  child.on("exit", code => process.exit(code ?? 0));
})();
