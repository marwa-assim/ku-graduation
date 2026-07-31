import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPayment } from "@/lib/payment";

const schema = z.object({ bookingId:z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({error:"Invalid booking."},{status:400});

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({error:"Unauthenticated."},{status:401});

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id,total_bhd,status,user_id")
    .eq("id",parsed.data.bookingId)
    .eq("user_id",user.id)
    .single();

  if (error || !booking) return NextResponse.json({error:"Booking not found."},{status:404});
  if (booking.status !== "held") return NextResponse.json({error:"Booking cannot be paid."},{status:409});

  try {
    const payment = await createPayment({
      bookingId:booking.id,
      amountBhd:Number(booking.total_bhd),
      customerEmail:user.email
    });
    await supabase.from("payments").insert({
      booking_id:booking.id,
      provider:process.env.PAYMENT_PROVIDER ?? "custom",
      provider_transaction_id:payment.transactionId,
      amount_bhd:booking.total_bhd,
      status:"pending"
    });
    return NextResponse.json({checkoutUrl:payment.checkoutUrl});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : "Payment creation failed."},{status:502});
  }
}
