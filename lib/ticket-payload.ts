/**
 * Canonical KU ticket QR format.
 *
 * V2 intentionally keeps the QR payload short so it remains easy to scan from
 * phone screens and printed tickets. All participant information is resolved
 * securely from Supabase after the token is validated.
 *
 * Legacy KU-TICKET payloads and raw tokens remain readable during migration.
 */
export type TicketQrPayload={
  v:2;
  token:string;
};

const PREFIX="KU2:";
const LEGACY_PREFIX="KU-TICKET:";

export function encodeTicketQr(input:{token:string}){
  const token=String(input.token||"").trim();
  if(!token)throw new Error("Ticket QR token is missing.");
  return `${PREFIX}${token}`;
}

export function decodeTicketQr(value:string):TicketQrPayload|null{
  const text=String(value||"").trim();
  if(!text)return null;
  if(text.startsWith(PREFIX)){
    const token=text.slice(PREFIX.length).trim();
    return token?{v:2,token}:null;
  }
  if(text.startsWith(LEGACY_PREFIX)){
    try{
      const parsed=JSON.parse(fromBase64Url(text.slice(LEGACY_PREFIX.length)));
      const token=String(parsed?.token||"").trim();
      return token?{v:2,token}:null;
    }catch{return null;}
  }
  // Backward compatibility for emailed/raw database tokens.
  if(/^[A-Za-z0-9_-]{16,256}$/.test(text))return{v:2,token:text};
  return null;
}

function fromBase64Url(value:string){
  let base64=value.replace(/-/g,"+").replace(/_/g,"/");
  while(base64.length%4)base64+="=";
  if(typeof Buffer!=="undefined")return Buffer.from(base64,"base64").toString("utf8");
  const binary=atob(base64);const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
