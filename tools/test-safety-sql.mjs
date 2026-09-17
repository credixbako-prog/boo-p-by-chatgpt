/**
 * Local PostgreSQL regression runner; never connects to Supabase or a network.
 * Usage: node tools/test-safety-sql.mjs [tests/another-access.sql ...]
 * Install @electric-sql/pglite (validated with 0.5.8) in the project or a separate
 * directory. PGLITE_MODULE may point to that package's directory. The existing
 * local .tmp/pg-test/node_modules installation is also discovered automatically.
 *
 * Limits: tests/fixtures/safety-base.sql reconstructs the five original app
 * tables absent from repository migration history. Auth/Storage are minimal
 * local metadata models; external Auth/Storage HTTP behavior is covered by JS
 * handler tests. net.http_post is inert. All repository migrations, RLS, grants,
 * application triggers and SQL test transactions execute in real PostgreSQL
 * through PGlite. This does not validate hosted configuration, concurrent
 * connections, or network delivery. Every run uses a fresh in-memory database.
 */
import {createRequire} from 'node:module';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const candidates=process.env.PGLITE_MODULE
  ? [createRequire(path.join(path.resolve(process.env.PGLITE_MODULE),'package.json'))]
  : [createRequire(import.meta.url),createRequire(path.join(root,'.tmp/pg-test/package.json'))];
let runtime;
for(const require of candidates){
  try{runtime={...require('@electric-sql/pglite'),...require('@electric-sql/pglite/contrib/pg_trgm')};break;}
  catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
}
if(!runtime)throw new Error('Install @electric-sql/pglite or set PGLITE_MODULE to its package directory.');
const db=new runtime.PGlite({extensions:{pg_trgm:runtime.pg_trgm}});
const receipts=[];
async function run(label,sql){
  try{
    const results=await db.exec(sql),checks=results.flatMap(r=>r.rows||[]).filter(r=>r.checks);
    receipts.push({label,ok:true,checks});
    console.log('PASS '+label,checks.length?JSON.stringify(checks):'');
  }catch(error){
    console.error('FAIL '+label,JSON.stringify({message:error.message,code:error.code,detail:error.detail,where:error.where,position:error.position}));
    receipts.push({label,ok:false,error:error.message,code:error.code,where:error.where});
    throw error;
  }
}
const tests=process.argv.slice(2).length?process.argv.slice(2):[
  'tests/community-safety-access.sql','tests/account-deletion-access.sql','tests/staff-access.sql',
  'tests/reader-profile-access.sql','tests/reader-sharing-access.sql',
  'tests/reading-cards-access.sql','tests/reader-badges-access.sql',
  'tests/reading-experience-access.sql'
];
try{
  await run('local Supabase baseline',await readFile(path.join(root,'tests/fixtures/safety-base.sql'),'utf8'));
  for(const file of (await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort()){
    let sql=await readFile(path.join(root,'supabase/migrations',file),'utf8');
    // Only the unavailable transport extension is substituted. Its SQL trigger
    // callers still run, using the baseline's no-op net.http_post function.
    sql=sql.replace(/^create extension if not exists pg_net with schema extensions;\r?\n/gm,'');
    await run(file,sql);
  }
  for(const file of tests)await run(file,await readFile(path.resolve(root,file),'utf8'));
}catch{process.exitCode=1;}finally{
  await mkdir(path.join(root,'.tmp'),{recursive:true});
  await writeFile(path.join(root,'.tmp/safety-sql-receipt.json'),JSON.stringify({
    engine:'PGlite PostgreSQL',network:'disabled; local net.http_post stub',
    baseline:'Reconstructed original app schema; minimal Auth/Storage metadata; all repository migrations applied',receipts
  },null,2));
  await db.close();
}
