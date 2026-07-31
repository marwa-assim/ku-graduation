function clean(value:any){return String(value??"").trim()}
function isOpaque(value:string){return /[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)||value.length>28}
export function visibleSeatLabel(seat:any):string{
  if(!seat)return"—";
  if(seat.is_aisle)return"AISLE";
  const label=clean(seat.label); if(label&&!isOpaque(label))return label;
  const code=clean(seat.code); if(code&&!isOpaque(code))return code;
  const prefix=clean(seat.seat_prefix||seat.section||seat.seat_type||"S").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,6)||"S";
  const row=Math.max(1,Number(seat.row_number||1));
  const serial=Math.max(1,Number(seat.column_number||1));
  return `${prefix}-R${String(row).padStart(2,"0")}-S${String(serial).padStart(3,"0")}`;
}
