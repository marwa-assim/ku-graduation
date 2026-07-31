import crypto from "node:crypto";
export type CreatePaymentInput={bookingId:string;amountBhd:number;customerEmail:string;customerId?:string;customerFirstName?:string;customerLastName?:string};
export async function createPayment(input:CreatePaymentInput){
 const base=(process.env.OTTU_BASE_URL||process.env.PAYMENT_API_URL||"").replace(/\/$/,"");
 const apiKey=process.env.OTTU_API_KEY||process.env.PAYMENT_API_KEY;const appUrl=process.env.NEXT_PUBLIC_APP_URL;
 const pgCodes=(process.env.OTTU_PG_CODES||process.env.PAYMENT_MERCHANT_ID||"").split(",").map(x=>x.trim()).filter(Boolean);
 if(!base||!apiKey||!appUrl||!pgCodes.length)throw new Error("Ottu payment gateway is not configured.");
 const endpoint=base.includes("/b/checkout/")?base:`${base}/b/checkout/v1/pymt-txn/`;
 const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":`Api-Key ${apiKey}`},body:JSON.stringify({type:"e_commerce",amount:input.amountBhd.toFixed(3),currency_code:"BHD",pg_codes:pgCodes,payment_type:"one_off",order_no:input.bookingId,customer_email:input.customerEmail,customer_id:input.customerId||input.bookingId,customer_first_name:input.customerFirstName,customer_last_name:input.customerLastName,language:"en",shortify_checkout_url:true,generate_qr_code:true,redirect_url:`${appUrl}/dashboard/tickets?payment=return`,webhook_url:`${appUrl}/api/payments/webhook`}),cache:"no-store"});
 const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.detail||body?.message||body?.error||`Ottu rejected the request (${response.status}).`);
 const checkoutUrl=body.checkout_short_url||body.checkout_url||body.checkout_page_url;if(!checkoutUrl||!body.session_id)throw new Error("Ottu response did not include checkout_url/session_id.");
 return {transactionId:String(body.session_id),checkoutUrl:String(checkoutUrl),state:body.state,orderNo:body.order_no,qrCodeUrl:body.qr_code_url};
}
export function verifyWebhook(rawBody:string,signature:string|null){
 const secret=process.env.PAYMENT_WEBHOOK_SECRET;if(!secret)return true;if(!signature)return false;
 const expected=crypto.createHmac("sha256",secret).update(rawBody).digest("hex");const a=Buffer.from(expected,"utf8"),b=Buffer.from(signature,"utf8");return a.length===b.length&&crypto.timingSafeEqual(a,b)
}
