// File: /api/archive.js
// Lists or reads daily archived brief snapshots stored in GitHub.

const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";

async function gh(url){
  if(!process.env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
  const text=await r.text();let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);return j;
}
async function read(path){
  const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
  return JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8"));
}
module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Cache-Control","no-store");
  try{
    const index=await read("archive/index.json").catch(()=>({dates:[]}));
    const date=String(req.query?.date||"").trim();
    if(!date)return res.status(200).json(index);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Invalid date"});
    const [market,news,ai]=await Promise.all([
      read(`archive/${date}/market.json`).catch(()=>null),
      read(`archive/${date}/news.json`).catch(()=>null),
      read(`archive/${date}/ai.json`).catch(()=>null)
    ]);
    if(!market&&!news&&!ai)return res.status(404).json({error:"Archive not found"});
    return res.status(200).json({date,market,news,ai});
  }catch(e){return res.status(500).json({error:e.message});}
};
