export type EmailAttachment={
  name:string;
  contentType:string;
  contentBytes:string;
  isInline?:boolean;
  contentId?:string;
};

async function getGraphToken() {
  const tenant = process.env.MS_TENANT_ID;
  const client = process.env.MS_CLIENT_ID;
  const secret = process.env.MS_CLIENT_SECRET;
  if (!tenant || !client || !secret) throw new Error("Microsoft Graph is not configured.");
  const body = new URLSearchParams({client_id:client,client_secret:secret,scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials"});
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  if(!response.ok) throw new Error(`Unable to obtain Microsoft Graph token (${response.status}).`);
  return (await response.json()).access_token as string;
}

export async function sendGraphEmail(input:{to:string;cc?:string|string[];subject:string;html:string;attachments?:EmailAttachment[]}) {
  const sender=process.env.MS_SENDER_EMAIL;
  if(!sender) throw new Error("MS_SENDER_EMAIL is missing.");
  const token=await getGraphToken();
  const attachments=(input.attachments??[]).map(a=>({
    "@odata.type":"#microsoft.graph.fileAttachment",
    name:a.name,
    contentType:a.contentType,
    contentBytes:a.contentBytes,
    isInline:Boolean(a.isInline),
    ...(a.contentId?{contentId:a.contentId}:{})
  }));
  const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({message:{subject:input.subject,body:{contentType:"HTML",content:input.html},toRecipients:[{emailAddress:{address:input.to}}],ccRecipients:(Array.isArray(input.cc)?input.cc:(input.cc?[input.cc]:[])).filter(Boolean).map(address=>({emailAddress:{address}})),attachments},saveToSentItems:true}),
    cache:"no-store"
  });
  if(!response.ok){const detail=await response.text();throw new Error(`Microsoft Graph send failed (${response.status}): ${detail.slice(0,300)}`)}
}
