"use client";
import { useState } from "react";

export function EmailForm() {
  const [state,setState] = useState("");
  async function submit(formData:FormData) {
    setState("Sending...");
    const response = await fetch("/api/email/send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        to:formData.get("to"),
        subject:formData.get("subject"),
        html:formData.get("html")
      })
    });
    const body = await response.json();
    setState(response.ok ? "Email sent successfully." : body.error ?? "Email failed.");
  }
  return <form action={submit} className="card">
    <div className="field"><label>Recipient</label><input name="to" type="email" required /></div>
    <div className="field"><label>Subject</label><input name="subject" required /></div>
    <div className="field"><label>HTML message</label><textarea name="html" rows={10} required /></div>
    <button className="btn btn-primary">Send through Microsoft 365</button>
    {state && <p className="muted" style={{marginTop:12}}>{state}</p>}
  </form>;
}
