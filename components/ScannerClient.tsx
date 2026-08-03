"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {BrowserQRCodeReader,IScannerControls} from "@zxing/browser";
import {Camera,CameraOff,CheckCircle2,Clock3,Focus,IdCard,Keyboard,MapPin,RefreshCcw,ScanLine,Ticket,UserRound,XCircle,Video} from "lucide-react";

type ScanResult={ok:boolean;title:string;text:string;personName?:string;referenceNumber?:string;college?:string;program?:string;ticketType?:string;seatCode?:string;arrivedAt?:string;raw?:string};
type ScanHistoryItem=ScanResult&{id:string;scannedAt:string};
type FocusBox={left:number;top:number;width:number;height:number}|null;

const ticketLabel=(value?:string)=>({graduate:"Graduate",staff:"Academic Staff",free_guest:"Free Guest",paid_guest:"Paid Guest"}[value||""]||"Event Ticket");
const cameraErrorMessage=(error:any)=>{const name=String(error?.name||"");const message=String(error?.message||"");if(/NotAllowedError|Permission denied|Permissions policy/i.test(`${name} ${message}`))return"Camera access is blocked. Allow camera access for this site and reload the page.";if(/NotFoundError|DevicesNotFoundError/i.test(name))return"No camera was detected on this device.";if(/NotReadableError|TrackStartError/i.test(name))return"The camera is already in use by another application.";if(typeof window!=="undefined"&&!window.isSecureContext)return"Camera access requires HTTPS or localhost.";return message||"The camera could not be started."};

export function ScannerClient(){
 const[token,setToken]=useState("");
 const[result,setResult]=useState<ScanResult|null>(null);
 const[history,setHistory]=useState<ScanHistoryItem[]>([]);
 const[camera,setCamera]=useState(false);
 const[busy,setBusy]=useState(false);
 const[status,setStatus]=useState("Preparing scanner…");
 const[detected,setDetected]=useState(0);
 const[devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const[selectedDevice,setSelectedDevice]=useState("");
 const[focusBox,setFocusBox]=useState<FocusBox>(null);
 const[engine,setEngine]=useState<"native"|"zxing"|"">("");

 const videoRef=useRef<HTMLVideoElement|null>(null);
 const frameRef=useRef<HTMLDivElement|null>(null);
 const controlsRef=useRef<IScannerControls|null>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const animationRef=useRef<number|null>(null);
 const videoFrameRef=useRef<number|null>(null);
 const busyRef=useRef(false);
 const startingRef=useRef(false);
 const mountedRef=useRef(true);
 const lastValueRef=useRef("");
 const lastScanAtRef=useRef(0);
 const lastDetectAttemptRef=useRef(0);
 const clearResultRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clearFocusRef=useRef<ReturnType<typeof setTimeout>|null>(null);

 const playFeedback=useCallback((ok:boolean)=>{try{if("vibrate" in navigator)navigator.vibrate(ok?[90]:[130,70,130]);const AC=window.AudioContext||(window as any).webkitAudioContext;if(!AC)return;const c=new AC(),o=c.createOscillator(),g=c.createGain();o.frequency.value=ok?920:210;g.gain.setValueAtTime(.075,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.17)}catch{}},[]);

 const validate=useCallback(async(value:string)=>{
  const normalized=value.trim();
  if(!normalized||busyRef.current)return;
  const now=Date.now();
  if(lastValueRef.current===normalized&&now-lastScanAtRef.current<4200)return;
  lastValueRef.current=normalized;lastScanAtRef.current=now;busyRef.current=true;setBusy(true);setStatus("QR recognized - validating ticket…");setDetected(x=>x+1);
  if(clearResultRef.current)clearTimeout(clearResultRef.current);
  let next:ScanResult;
  try{
   const response=await fetch("/api/scans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:normalized}),cache:"no-store"});
   const raw=await response.text();let body:any={};
   try{body=raw?JSON.parse(raw):{}}catch{body={error:raw||"The scanner service returned an invalid response."}}
   if(!response.ok){
    if(body.alreadyScanned){next={ok:false,title:"Already scanned",text:body.error||"This ticket was previously scanned.",personName:body.personName,referenceNumber:body.referenceNumber,college:body.college,program:body.program,ticketType:ticketLabel(body.ticketType),seatCode:body.seatCode,arrivedAt:body.arrivedAt,raw:normalized}}
    else throw new Error(body.error||"This QR code could not be accepted.");
   }else{
    next={ok:true,title:"Entry approved",text:"Ticket verified and attendance updated.",personName:body.personName||"Ticket holder",referenceNumber:body.referenceNumber||body.reference,college:body.college,program:body.program,ticketType:ticketLabel(body.ticketType),seatCode:body.seatCode,arrivedAt:body.arrivedAt,raw:normalized};
    setToken("");
   }
   setStatus(response.ok?"Ready for the next QR code":"Ready to scan again");
  }catch(e:any){const message=String(e?.message||"Invalid QR code.");const already=/already|used|duplicate/i.test(message);next={ok:false,title:already?"Already scanned":"Entry rejected",text:message,raw:normalized};setStatus("Ready to scan again")}
  finally{busyRef.current=false;setBusy(false)}
  setResult(next);setHistory(items=>[{...next,id:crypto.randomUUID(),scannedAt:new Date().toISOString()},...items].slice(0,8));playFeedback(next.ok);clearResultRef.current=setTimeout(()=>setResult(null),6200);
 },[playFeedback]);

 const stopDetectionLoop=useCallback(()=>{
  if(animationRef.current!==null){cancelAnimationFrame(animationRef.current);animationRef.current=null}
  const video:any=videoRef.current;
  if(videoFrameRef.current!==null&&video?.cancelVideoFrameCallback){video.cancelVideoFrameCallback(videoFrameRef.current);videoFrameRef.current=null}
 },[]);

 const stopCamera=useCallback(()=>{
  stopDetectionLoop();
  controlsRef.current?.stop();controlsRef.current=null;
  streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
  if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null}
  setFocusBox(null);startingRef.current=false;
  if(mountedRef.current){setCamera(false);setEngine("");setStatus("Camera stopped")}
 },[stopDetectionLoop]);

 const showDetectionBox=useCallback((box:any)=>{
  const video=videoRef.current,frame=frameRef.current;if(!video||!frame||!box||!video.videoWidth||!video.videoHeight)return;
  const cw=frame.clientWidth,ch=frame.clientHeight,vw=video.videoWidth,vh=video.videoHeight;
  const scale=Math.max(cw/vw,ch/vh),rw=vw*scale,rh=vh*scale,ox=(cw-rw)/2,oy=(ch-rh)/2;
  const left=Math.max(4,Math.min(cw-8,box.x*scale+ox));const top=Math.max(4,Math.min(ch-8,box.y*scale+oy));
  const width=Math.max(38,Math.min(cw-left-4,box.width*scale));const height=Math.max(38,Math.min(ch-top-4,box.height*scale));
  setFocusBox({left,top,width,height});
  if(clearFocusRef.current)clearTimeout(clearFocusRef.current);
  clearFocusRef.current=setTimeout(()=>setFocusBox(null),1100);
 },[]);

 const applyCameraEnhancements=useCallback(async(stream:MediaStream)=>{
  try{
   const track=stream.getVideoTracks()[0] as any;if(!track)return;
   const caps=track.getCapabilities?.()||{};const advanced:any[]=[];
   if(Array.isArray(caps.focusMode)&&caps.focusMode.includes("continuous"))advanced.push({focusMode:"continuous"});
   if(Array.isArray(caps.exposureMode)&&caps.exposureMode.includes("continuous"))advanced.push({exposureMode:"continuous"});
   if(Array.isArray(caps.whiteBalanceMode)&&caps.whiteBalanceMode.includes("continuous"))advanced.push({whiteBalanceMode:"continuous"});
   if(caps.zoom){const min=Number(caps.zoom.min||1),max=Number(caps.zoom.max||1);const ideal=Math.min(max,Math.max(min,1.15));advanced.push({zoom:ideal})}
   if(advanced.length)await track.applyConstraints({advanced} as any);
  }catch{}
 },[]);

 const startNativeLoop=useCallback((detector:any)=>{
  const video:any=videoRef.current;
  if(!video)return;
  let stopped=false;
  const tick=async(now:number)=>{
   if(stopped||!mountedRef.current)return;
   if(!busyRef.current&&video.readyState>=2&&now-lastDetectAttemptRef.current>=85){
    lastDetectAttemptRef.current=now;
    try{
     const codes=await detector.detect(video);
     const qr=codes?.find((x:any)=>!x.format||String(x.format).toLowerCase().includes("qr"))||codes?.[0];
     if(qr?.rawValue){showDetectionBox(qr.boundingBox);setStatus("QR recognized - checking ticket…");void validate(qr.rawValue)}
    }catch{}
   }
   if(video.requestVideoFrameCallback){videoFrameRef.current=video.requestVideoFrameCallback((t:number)=>void tick(t))}
   else animationRef.current=requestAnimationFrame(tick);
  };
  if(video.requestVideoFrameCallback)videoFrameRef.current=video.requestVideoFrameCallback((t:number)=>void tick(t));
  else animationRef.current=requestAnimationFrame(tick);
  return()=>{stopped=true;stopDetectionLoop()};
 },[showDetectionBox,stopDetectionLoop,validate]);

 const startCamera=useCallback(async(deviceId?:string)=>{
  if(!videoRef.current||startingRef.current)return;
  stopCamera();setResult(null);
  if(!window.isSecureContext){setStatus("Camera unavailable");setResult({ok:false,title:"Camera unavailable",text:"Camera access requires HTTPS or localhost."});return}
  startingRef.current=true;setStatus("Requesting camera access…");
  try{
   const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
   const constraints:MediaStreamConstraints={audio:false,video:deviceId?{deviceId:{exact:deviceId},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:60}}:{facingMode:{ideal:mobile?"environment":"user"},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:60}}};
   const NativeDetector=(window as any).BarcodeDetector;
   if(NativeDetector){
    const stream=await navigator.mediaDevices.getUserMedia(constraints);streamRef.current=stream;
    await applyCameraEnhancements(stream);
    const video=videoRef.current;video.srcObject=stream;await video.play();
    const available=await navigator.mediaDevices.enumerateDevices();const cameras=available.filter(d=>d.kind==="videoinput");if(mountedRef.current)setDevices(cameras);
    const activeId=stream.getVideoTracks()[0]?.getSettings().deviceId||deviceId||"";if(activeId)setSelectedDevice(activeId);
    const detector=new NativeDetector({formats:["qr_code"]});startNativeLoop(detector);setEngine("native");
   }else{
    const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:25,delayBetweenScanSuccess:500});
    const available=await BrowserQRCodeReader.listVideoInputDevices();if(mountedRef.current)setDevices(available);
    const preferredId=deviceId||selectedDevice||(mobile?(available.find(d=>/back|rear|environment|wide/i.test(d.label))?.deviceId):(available.find(d=>/integrated|front|facetime|webcam|camera/i.test(d.label)&&!/virtual|obs|snap|manycam/i.test(d.label))?.deviceId))||available.find(d=>!/virtual|obs|snap|manycam/i.test(d.label))?.deviceId||available[0]?.deviceId||"";
    if(preferredId)setSelectedDevice(preferredId);
    const onDecode=(decoded:any)=>{if(decoded&&!busyRef.current){setStatus("QR recognized - checking ticket…");void validate(decoded.getText())}};
    const controls=preferredId?await reader.decodeFromVideoDevice(preferredId,videoRef.current,onDecode):await reader.decodeFromConstraints(constraints,videoRef.current,onDecode);
    controlsRef.current=controls;setEngine("zxing");
    const stream=videoRef.current.srcObject as MediaStream|null;if(stream){streamRef.current=stream;await applyCameraEnhancements(stream)}
   }
   if(!mountedRef.current){stopCamera();return}
   setCamera(true);setStatus("Scanner ready - center the complete QR code in the frame");
  }catch(e:any){if(mountedRef.current){setCamera(false);setEngine("");setStatus("Camera unavailable");setResult({ok:false,title:"Camera unavailable",text:cameraErrorMessage(e)})}}
  finally{startingRef.current=false}
 },[applyCameraEnhancements,selectedDevice,startNativeLoop,stopCamera,validate]);

 useEffect(()=>{mountedRef.current=true;const timer=setTimeout(()=>void startCamera(),180);return()=>{mountedRef.current=false;clearTimeout(timer);stopCamera();if(clearResultRef.current)clearTimeout(clearResultRef.current);if(clearFocusRef.current)clearTimeout(clearFocusRef.current)}},[]); // eslint-disable-line react-hooks/exhaustive-deps

 const rows=useMemo(()=>result?[result.personName&&{icon:<UserRound size={16}/>,label:"Name",value:result.personName},result.referenceNumber&&{icon:<IdCard size={16}/>,label:"Reference",value:result.referenceNumber},result.ticketType&&{icon:<Ticket size={16}/>,label:"Ticket",value:result.ticketType},result.seatCode&&{icon:<MapPin size={16}/>,label:"Seat",value:result.seatCode},result.college&&{icon:<IdCard size={16}/>,label:"College",value:result.college},result.program&&{icon:<IdCard size={16}/>,label:"Programme",value:result.program},{icon:<Clock3 size={16}/>,label:"Scan time",value:new Date(result.arrivedAt||Date.now()).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}].filter(Boolean) as {icon:React.ReactNode;label:string;value:string}[]:[],[result]);

 return <>
  <div className="page-head scanner-page-head"><div><span className="eyebrow">GATE ENTRY</span><h1>QR entry scanner</h1><p>Point the camera at a ticket. Recognition and validation are automatic.</p></div><span className={`scanner-live-pill ${camera?"on":"off"}`}><i/>{camera?"Scanner ready":"Camera off"}</span></div>
  <section className="card scanner-shell production-scanner">
   <div className="scanner-camera">
    <div ref={frameRef} className={`scanner-frame ${camera?"active":""} ${busy?"busy":""} ${focusBox?"locked":""}`}>
     <video ref={videoRef} playsInline muted autoPlay/>
     {!camera&&<div className="scanner-placeholder"><Camera size={46}/><strong>Camera scanner</strong><span>Allow camera access, then place a clear QR code in front of the camera.</span></div>}
     <div className="scanner-target" aria-hidden="true"><span/><span/><span/><span/><i className="scan-line"/></div>
     {focusBox&&<div className="scanner-focus-box" style={{left:focusBox.left,top:focusBox.top,width:focusBox.width,height:focusBox.height}}><i/><i/><i/><i/><b>QR detected</b></div>}
     <div className="scanner-status"><ScanLine size={16}/>{status}</div>
     {result&&<div className={`scanner-feedback ${result.ok?"success":"error"}`} role="status" aria-live="assertive">{result.ok?<CheckCircle2 size={44}/>:<XCircle size={44}/>}<strong>{result.title}</strong><p>{result.personName?`${result.personName}${result.seatCode?` · Seat ${result.seatCode}`:""}`:result.text}</p></div>}
    </div>
    <div className="scanner-controls">
     {devices.length>1&&<label className="scanner-camera-select"><Video size={16}/><span>Camera</span><select value={selectedDevice} onChange={e=>{const id=e.target.value;setSelectedDevice(id);void startCamera(id)}}>{devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Camera ${index+1}`}</option>)}</select></label>}
     {camera?<button className="btn btn-secondary" onClick={stopCamera}><CameraOff size={17}/>Stop camera</button>:<button className="btn btn-primary" onClick={()=>void startCamera(selectedDevice||undefined)}><Camera size={17}/>Start camera</button>}
     {camera&&<span className="scanner-engine"><Focus size={14}/>{engine==="native"?"Fast device scanner":"Compatibility scanner"}</span>}
    </div>
   </div>
   <aside className="scanner-details">
    <div className={`scanner-detail-card ${result?(result.ok?"success":"error"):"idle"}`}><div className="scanner-detail-heading">{result?(result.ok?<CheckCircle2 size={22}/>:<XCircle size={22}/>):<ScanLine size={22}/>}<div><span className="eyebrow">LATEST RESULT</span><h2>{result?.title||"Ready to scan"}</h2></div></div>{!result?<p className="scanner-detail-empty">Participant, ticket and seat details appear immediately after recognition.</p>:<><p className="scanner-detail-message">{result.text}</p>{rows.length>0&&<dl className="scanner-detail-grid">{rows.map(r=><div key={r.label}><dt>{r.icon}{r.label}</dt><dd>{r.value}</dd></div>)}</dl>}</>}</div>
    <div className="scanner-manual"><div><span className="eyebrow">BACKUP ENTRY</span><h2><Keyboard size={20}/>Handheld scanner or manual input</h2><p>USB/Bluetooth scanners can enter the QR content directly.</p></div><label>QR content<input value={token} onChange={e=>setToken(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void validate(token)} placeholder="Scan or paste ticket QR content" autoComplete="off"/></label><button className="btn btn-primary" onClick={()=>void validate(token)} disabled={busy||!token.trim()}>{busy?<><RefreshCcw className="spin" size={17}/>Verifying…</>:"Verify entry"}</button><small className="scanner-counter">QR detections this session: {detected}</small></div>
    {history.length>0&&<div className="scanner-history"><div className="scanner-history-title"><Clock3 size={17}/><strong>Recent scans</strong></div>{history.map(item=><div className={`scanner-history-item ${item.ok?"success":"error"}`} key={item.id}><span>{item.ok?<CheckCircle2 size={16}/>:<XCircle size={16}/>}</span><div><strong>{item.personName||item.title}</strong><small>{item.ticketType||item.text}</small></div><time>{new Date(item.scannedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</time></div>)}</div>}
   </aside>
  </section>
 </>;
}
