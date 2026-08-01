import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {sendBookingConfirmation} from "@/lib/booking-confirmation";

const schema=z.object({eventId:z.string().uuid(),seatIds:z.array(z.string().uuid()).min(1).max(10)});
export async function POST(request:Request){
 const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid reservation request."},{status:400});
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Unauthenticated."},{status:401});
 const {data:event,error:eventError}=await supabase.from("events").select("student_seat_access_mode,allow_guest_booking").eq("id",parsed.data.eventId).single();if(eventError||!event)return NextResponse.json({error:"Event not found."},{status:404});if(event.student_seat_access_mode!=="book"||event.allow_guest_booking===false)return NextResponse.json({error:"Seat booking is currently view-only. Seats must be assigned by the University."},{status:403});
 const {data,error}=await supabase.rpc("reserve_seats",{p_event_id:parsed.data.eventId,p_seat_ids:parsed.data.seatIds,p_user_id:user.id});
 if(error)return NextResponse.json({error:error.message},{status:409});
 const result:any=data||{};
 if(result.free_booking_id){try{await sendBookingConfirmation(result.free_booking_id)}catch(e){console.error("Free-ticket confirmation email failed",e)}}
 if(!result.paid_booking_id)return NextResponse.json({bookingId:result.free_booking_id,freeConfirmed:Number(result.free_count||0),paidHeld:0});
 const payment=await fetch(new URL("/api/payments/create",request.url),{method:"POST",headers:{"Content-Type":"application/json",cookie:request.headers.get("cookie")??""},body:JSON.stringify({bookingId:result.paid_booking_id})});
 const rawPayment=await payment.text();let paymentBody:any={};try{paymentBody=rawPayment?JSON.parse(rawPayment):{}}catch{paymentBody={error:rawPayment||"Payment service returned an empty or invalid response."}}
 if(!payment.ok){await supabase.rpc("release_payment_hold",{p_booking_id:result.paid_booking_id});return NextResponse.json({...paymentBody,freeConfirmed:Number(result.free_count||0),paidHeld:0,paidReleased:true},{status:payment.status});}
 return NextResponse.json({...paymentBody,bookingId:result.paid_booking_id,freeBookingId:result.free_booking_id,freeConfirmed:Number(result.free_count||0),paidHeld:Number(result.paid_count||0)},{status:payment.status});
}
