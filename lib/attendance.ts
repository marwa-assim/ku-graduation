export type AttendanceScan={ticket_id?:string|null;scanned_at?:string|null;result?:string|null};
export type AttendanceTicket={id:string;person_id?:string|null;user_id?:string|null;seat_id?:string|null};
export type AttendanceSeat={id:string;seat_type?:string|null};

export function buildAttendance(tickets:AttendanceTicket[],seats:AttendanceSeat[],scans:AttendanceScan[]){
 const seatById=new Map(seats.map(seat=>[String(seat.id),seat]));
 const acceptedByTicket=new Map<string,AttendanceScan>();
 for(const scan of scans){
  if(scan.result!=="accepted"||!scan.ticket_id)continue;
  const key=String(scan.ticket_id),previous=acceptedByTicket.get(key);
  if(!previous||String(scan.scanned_at||"")>String(previous.scanned_at||""))acceptedByTicket.set(key,scan);
 }
 const personEntryByKey=new Map<string,{entered:true;scannedAt:string|null;ticketId:string;ticketType:string}>();
 let guestTotal=0,guestEntered=0,studentTicketTotal=0,studentTicketEntered=0,staffTicketTotal=0,staffTicketEntered=0;
 for(const ticket of tickets){
  const ticketType=String(seatById.get(String(ticket.seat_id||""))?.seat_type||"");
  const accepted=acceptedByTicket.get(String(ticket.id));
  const entered=Boolean(accepted);
  if(ticketType==="graduate"){studentTicketTotal++;if(entered)studentTicketEntered++}
  if(ticketType==="staff"){staffTicketTotal++;if(entered)staffTicketEntered++}
  if(ticketType==="free_guest"||ticketType==="paid_guest"){guestTotal++;if(entered)guestEntered++}
  if((ticketType==="graduate"||ticketType==="staff")&&entered){
   const status={entered:true as const,scannedAt:accepted?.scanned_at||null,ticketId:String(ticket.id),ticketType};
   for(const key of [ticket.person_id,ticket.user_id].filter(Boolean) as string[]){
    const previous=personEntryByKey.get(String(key));
    if(!previous||String(status.scannedAt||"")>String(previous.scannedAt||""))personEntryByKey.set(String(key),status);
   }
  }
 }
 return {seatById,acceptedByTicket,personEntryByKey,guestTotal,guestEntered,studentTicketTotal,studentTicketEntered,staffTicketTotal,staffTicketEntered};
}
