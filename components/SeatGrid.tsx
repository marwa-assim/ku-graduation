"use client";
import {visibleSeatLabel} from "@/lib/seat-label";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SeatRecord } from "@/lib/types";

export function SeatGrid({ initialSeats, eventId, canBook }: {
  initialSeats: SeatRecord[];
  eventId: string;
  canBook: boolean;
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase.channel(`seats:${eventId}`)
      .on("postgres_changes", {
        event:"UPDATE", schema:"public", table:"seats", filter:`event_id=eq.${eventId}`
      }, payload => {
        const changed = payload.new as SeatRecord;
        setSeats(current => current.map(s => s.id === changed.id ? changed : s));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, supabase]);

  function toggle(seat: SeatRecord) {
    if (!canBook || seat.status !== "available") return;
    setSelected(v => v.includes(seat.id) ? v.filter(id => id !== seat.id) : [...v, seat.id]);
  }

  async function reserve() {
    setMessage("Processing...");
    const response = await fetch("/api/bookings/reserve", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ eventId, seatIds:selected })
    });
    const raw = await response.text();
    let body:any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { error: raw || `Server returned ${response.status} without JSON.` }; }
    if (!response.ok) {
      setMessage(body.error ?? "Reservation failed.");
      return;
    }
    if (body.checkoutUrl) window.location.href = body.checkoutUrl;
    else setMessage("Reservation confirmed.");
  }

  return (
    <>
      <div className="seats">
        {seats.map(seat => {
          const isSelected = selected.includes(seat.id);
          return <button key={seat.id}
            className={`seat ${seat.status} ${isSelected ? "selected" : ""}`}
            disabled={seat.status !== "available"}
            onClick={() => toggle(seat)}
            title={`${visibleSeatLabel(seat)} · ${seat.price_bhd.toFixed(3)} BHD`}>
            {visibleSeatLabel(seat)}
          </button>;
        })}
      </div>
      {canBook && <div style={{marginTop:16,display:"flex",gap:12,alignItems:"center"}}>
        <button className="btn btn-primary" disabled={!selected.length} onClick={reserve}>
          Reserve {selected.length} seat{selected.length === 1 ? "" : "s"}
        </button>
        <span className="muted">{message}</span>
      </div>}
    </>
  );
}
