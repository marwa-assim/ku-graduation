import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyWebhook} from "@/lib/payment";
import {sendBookingConfirmation} from "@/lib/booking-confirmation";

export async function POST(request:Request){
 const raw=await request.text();const signature=request.headers.get("x-payment-signature")||request.headers.get("signature");
 if(!verifyWebhook(raw,signature))return NextResponse.json({error:"Invalid signature."},{status:401});
 let payload:any;try{payload=JSON.parse(raw)}catch{return NextResponse.json({error:"Invalid payload."},{status:400})}
 const bookingId=payload.order_no||payload.orderId||payload.reference_number;const transactionId=payload.session_id||payload.transactionId||payload.reference_number;
 const rawState=String(payload.state||payload.status||"").toLowerCase();const status=rawState==="paid"?"paid":["failed","expired","invalided"].includes(rawState)?"failed":["cancelled","canceled"].includes(rawState)?"cancelled":null;
 if(!bookingId||!transactionId||!status)return NextResponse.json({ok:true,ignored:true});
 const admin=createAdminClient();const {error}=await admin.rpc("process_payment_webhook",{p_booking_id:bookingId,p_transaction_id:transactionId,p_status:status});
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(status==="paid"){try{await sendBookingConfirmation(bookingId)}catch(e){console.error("Booking confirmation email failed",e)}}
 return NextResponse.json({ok:true});
}
