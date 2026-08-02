import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayment } from "@/lib/payment";
import { z } from "zod";
import { sendBookingConfirmation } from "@/lib/booking-confirmation";

const schema=z.object({eventId:z.string().uuid(),seatIds:z.array(z.string().uuid()).min(1).max(10)});

async function releasePaidBooking(bookingId:string){
 const admin=createAdminClient();
 const {data:links}=await admin.from("booking_seats").select("seat_id").eq("booking_id",bookingId);
 const seatIds=(links??[]).map((x:any)=>String(x.seat_id)).filter(Boolean);
 if(seatIds.length){
  await admin.from("seats").update({status:"available",held_until:null}).in("id",seatIds).eq("status","held");
 }
 await admin.from("bookings").update({status:"expired"}).eq("id",bookingId).eq("status","held");
 await admin.from("booking_seats").delete().eq("booking_id",bookingId);
 return seatIds;
}

export async function POST(request:Request){
 let payload:unknown;
 try{payload=await request.json()}catch{return NextResponse.json({error:"Invalid reservation request."},{status:400})}
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:"Invalid reservation request."},{status:400});

 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user?.email)return NextResponse.json({error:"Unauthenticated."},{status:401});

 const {data:event,error:eventError}=await supabase.from("events").select("organization_id,student_seat_access_mode,allow_guest_booking").eq("id",parsed.data.eventId).single();
 if(eventError||!event)return NextResponse.json({error:"Event not found."},{status:404});
 if(event.student_seat_access_mode!=="book"||event.allow_guest_booking===false)return NextResponse.json({error:"Seat booking is currently view-only. Seats must be assigned by the University."},{status:403});

 const {data,error}=await supabase.rpc("reserve_seats",{p_event_id:parsed.data.eventId,p_seat_ids:parsed.data.seatIds,p_user_id:user.id});
 if(error)return NextResponse.json({error:error.message},{status:409});
 const result:any=data||{};

 if(result.free_booking_id){
  try{await sendBookingConfirmation(result.free_booking_id)}catch(e){console.error("Free-ticket confirmation email failed",e)}
 }
 if(!result.paid_booking_id){
  return NextResponse.json({bookingId:result.free_booking_id,freeConfirmed:Number(result.free_count||0),paidHeld:0});
 }

 try{
  const {data:booking,error:bookingError}=await supabase.from("bookings").select("id,total_bhd,status,user_id").eq("id",result.paid_booking_id).eq("user_id",user.id).single();
  if(bookingError||!booking)throw new Error(bookingError?.message||"Paid booking could not be loaded.");
  if(booking.status!=="held")throw new Error("Paid booking is not ready for checkout.");
  if(Number(booking.total_bhd)<=0)throw new Error("The paid ticket amount is zero. Check the event paid-ticket price and booking dates.");

  const payment=await createPayment({bookingId:booking.id,amountBhd:Number(booking.total_bhd),customerEmail:user.email});
  const admin=createAdminClient();
  const {error:paymentInsertError}=await admin.from("payments").insert({organization_id:event.organization_id,event_id:parsed.data.eventId,booking_id:booking.id,provider:process.env.PAYMENT_PROVIDER??"ottu",provider_transaction_id:payment.transactionId,amount_bhd:booking.total_bhd,status:"pending"});
  if(paymentInsertError)throw new Error(paymentInsertError.message);

  return NextResponse.json({checkoutUrl:payment.checkoutUrl,bookingId:booking.id,freeBookingId:result.free_booking_id,freeConfirmed:Number(result.free_count||0),paidHeld:Number(result.paid_count||0),amountBhd:Number(booking.total_bhd)});
 }catch(e:any){
  const releasedSeatIds=await releasePaidBooking(String(result.paid_booking_id));
  return NextResponse.json({error:e?.message||"The payment gateway could not be opened. No paid seat was reserved.",freeConfirmed:Number(result.free_count||0),paidHeld:0,paidReleased:true,releasedSeatIds},{status:502});
 }
}
