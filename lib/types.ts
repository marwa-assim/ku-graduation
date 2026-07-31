export type AppRole = "student"|"admin"|"scanner"|"regcom"|"vip"|"land"|"finance"|"tailor"|"photographer"|"academic_staff";
export type PersonType = "student"|"academic_staff"|"administrative_staff"|"guest"|"vip";
export type Profile={id:string;organization_id:string;email:string;full_name:string;role:AppRole;person_type:PersonType;reference_number:string|null;college:string|null;department:string|null;program:string|null;phone:string|null;avatar_url?:string|null};
export type SeatRecord={id:string;organization_id:string;event_id:string;zone_id?:string|null;code:string;label?:string|null;section:string;seat_type?:string;price_bhd:number;status:"available"|"held"|"booked"|"blocked";row_number?:number|null;column_number?:number|null;color?:string|null;is_aisle?:boolean};
