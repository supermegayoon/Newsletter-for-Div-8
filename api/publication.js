const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";
const FILE_PATH="publication-current.json";
async function gh(url){
  if(!process.env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
  const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);return j;
}
module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Cache-Control","no-store");
  try{
    const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`);
    const content=Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8");
    return res.status(200).json(JSON.parse(content));
  }catch(e){return res.status(404).json({error:"No validated publication yet"});}
};
