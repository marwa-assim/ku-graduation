export const MESSAGE_PLACEHOLDERS=[
  "{{name}}","{{id}}","{{email}}","{{college}}","{{degree}}","{{program}}","{{event}}","{{date}}","{{time}}","{{venue}}","{{location}}","{{gps_link}}","{{system_link}}"
] as const;

export function replacePlaceholders(template:string,values:Record<string,string|number|null|undefined>){
  return Object.entries(values).reduce((out,[key,value])=>out.replaceAll(`{{${key}}}`,String(value??"—")),template||"");
}

export function escapeHtml(value:unknown){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]||c))}
