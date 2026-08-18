module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({
    ok:true,
    service:"8담당 Daily Market Brief external scheduler",
    utc:new Date().toISOString(),
    expectedSchedule:"23:00 UTC Sun-Thu = 08:00 KST Mon-Fri",
    publishEndpoint:"/api/manual-publish"
  });
};