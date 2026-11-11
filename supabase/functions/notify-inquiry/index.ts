// Šalje e-poštu na kontakt@zcore.ba kad stigne novi upit s web stranice.
// Poziva ga okidač u bazi (pg_net) s { id }. Funkcija sama čita upit servisnim ključem,
// šalje samo za upite mlađe od 15 minuta i samo jednom (kolona notified_at),
// pa nasumičan poziv ne može slati poruke po želji.
// Objavljeno kao Supabase Edge Function "notify-inquiry" (verify_jwt: false).
// Tajna SMTP_PASS (lozinka za kontakt@zcore.ba) se upisuje u Supabase: Edge Functions → Secrets.
// Neobavezno: SMTP_HOST (zadano mail.zcore.ba; treba DNS zapis A mail -> Globalhost server), SMTP_PORT (465), SMTP_USER, NOTIFY_TO.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let id = "";
  try { id = String((await req.json()).id || ""); } catch { /* prazno */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad request", { status: 400 });

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const since = new Date(Date.now() - 15 * 60e3).toISOString();
  // Zauzmi upit atomarno: samo jedan poziv može postaviti notified_at
  const { data: row, error } = await db.from("inquiries")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id).is("notified_at", null).gte("created_at", since)
    .select("id, company, name, email, employees, message, created_at").maybeSingle();
  if (error) return new Response("DB error", { status: 500 });
  if (!row) return new Response("Nothing to send", { status: 200 });

  const pass = env("SMTP_PASS");
  if (!pass) {
    await db.from("inquiries").update({ notified_at: null }).eq("id", id);
    return new Response("SMTP_PASS not set", { status: 500 });
  }
  const user = env("SMTP_USER", "kontakt@zcore.ba");
  const to = env("NOTIFY_TO", "kontakt@zcore.ba");
  const when = new Date(row.created_at).toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" });
  const lines: [string, unknown][] = [
    ["Firma", row.company], ["Ime", row.name], ["E-pošta", row.email],
    ["Broj zaposlenih", row.employees || "—"], ["Poslano", when],
  ];
  const text = lines.map(([k, v]) => `${k}: ${clean(v)}`).join("\n") +
    `\n\nPoruka:\n${row.message || "—"}\n\nSvi upiti: https://zcore.ba/admin`;
  const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0A0A0A">
<h2 style="margin:0 0 16px">Novi upit s web stranice</h2>
<table style="border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5E5E5E">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>
<p style="margin:20px 0 4px;color:#5E5E5E">Poruka</p><p style="margin:0;white-space:pre-wrap">${esc(row.message || "—")}</p>
<p style="margin:24px 0 0"><a href="https://zcore.ba/admin">Otvori upite u admin panelu</a> · Odgovorite direktno na ovaj mail.</p></div>`;

  const client = new SMTPClient({
    connection: { hostname: env("SMTP_HOST", "mail.zcore.ba"), port: Number(env("SMTP_PORT", "465")), tls: true, auth: { username: user, password: pass } },
  });
  try {
    await client.send({
      from: `Zcore web stranica <${user}>`,
      to,
      replyTo: `${clean(row.name)} <${clean(row.email)}>`,
      subject: `Novi upit: ${clean(row.company)}`.slice(0, 150),
      content: text,
      html: htmlBody,
    });
    await client.close();
  } catch (e) {
    try { await client.close(); } catch { /* ignore */ }
    // vrati oznaku da se može pokušati ponovo
    await db.from("inquiries").update({ notified_at: null }).eq("id", id);
    console.error("SMTP", String(e));
    return new Response("SMTP error", { status: 502 });
  }
  return new Response("Sent", { status: 200 });
});
