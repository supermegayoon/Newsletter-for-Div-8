function baseUrl(req){
  const proto=req.headers["x-forwarded-proto"]||"https";
  const host=req.headers["x-forwarded-host"]||req.headers.host;
  return `${proto}://${host}`;
}
module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Cache-Control","no-store");
  try{
    const headers={};
    if(process.env.CRON_SECRET){
      headers.Authorization=`Bearer ${process.env.CRON_SECRET}`;
    }
    const r=await fetch(`${baseUrl(req)}/api/daily-update`,{method:"GET",headers});
    const text=await r.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
    return res.status(r.status).json({
      wrapper:"manual-publish",
      upstreamStatus:r.status,
      ...data
    });
  }catch(e){
    return res.status(500).json({
      ok:false,
      wrapper:"manual-publish",
      error:e.message
    });
  }
};