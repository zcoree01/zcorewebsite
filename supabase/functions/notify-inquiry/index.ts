// Šalje e-poštu na kontakt@zcore.ba kad stigne novi upit s web stranice.
// Poziva ga okidač u bazi (pg_net) s { id }. Funkcija sama čita upit servisnim ključem,
// šalje samo za upite mlađe od 15 minuta i samo jednom (kolona notified_at),
// pa nasumičan poziv ne može slati poruke po želji.
// Objavljeno kao Supabase Edge Function "notify-inquiry" (verify_jwt: false).
// Tajna SMTP_PASS (lozinka za kontakt@zcore.ba) se upisuje u Supabase: Edge Functions → Secrets.
// Neobavezno: SMTP_HOST (mail.zcore.ba), SMTP_PORT (465), SMTP_TLS_NAME (matrix.global.ba:
// ime iz certifikata Globalhost servera), SMTP_USER, NOTIFY_TO.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const enc = new TextEncoder();
const b64 = (s: string) => { let bin = ""; for (const b of enc.encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
const wrap76 = (s: string) => s.replace(/.{1,76}/g, (l) => l + "\r\n");
const hdr = (s: string) => `=?UTF-8?B?${b64(s)}?=`;
const addr = (s: string) => s.replace(/[<>\r\n"\s]/g, "");

// Minimalan SMTP klijent preko TLS-a (port 465). Spaja se na host, a certifikat provjerava po tlsName.
async function smtpSend(o: { host: string; port: number; tlsName: string; user: string; pass: string; from: string; to: string; raw: string }) {
  const tcp = await Deno.connect({ hostname: o.host, port: o.port });
  const conn = await Deno.startTls(tcp, { hostname: o.tlsName });
  const dec = new TextDecoder();
  let buf = "";
  const read = async (): Promise<string> => {
    const lines: string[] = [];
    while (true) {
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(line);
        if (/^\d{3} /.test(line)) return lines.join("\n");
      }
      const chunk = new Uint8Array(4096);
      const n = await conn.read(chunk);
      if (n === null) throw new Error("veza zatvorena: " + lines.join(" | "));
      buf += dec.decode(chunk.subarray(0, n));
    }
  };
  const cmd = async (line: string | null, expect: string, label?: string) => {
    if (line !== null) await conn.write(enc.encode(line + "\r\n"));
    const r = await read();
    if (!r.split("\n").pop()!.startsWith(expect)) throw new Error(`${label ?? line ?? "pozdrav"} -> ${r}`);
    return r;
  };
  try {
    await cmd(null, "220");
    await cmd("EHLO zcore.ba", "250");
    await cmd("AUTH LOGIN", "334");
    await cmd(b64(o.user), "334", "AUTH korisnik");
    await cmd(b64(o.pass), "235", "AUTH lozinka");
    await cmd(`MAIL FROM:<${o.from}>`, "250");
    await cmd(`RCPT TO:<${o.to}>`, "250");
    await cmd("DATA", "354");
    const body = o.raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await cmd(body + "\r\n.", "250", "poruka");
    try { await cmd("QUIT", "221"); } catch { /* nije bitno */ }
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

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

  const boundary = "zc" + crypto.randomUUID().replace(/-/g, "");
  const replyEmail = addr(String(row.email || ""));
  const raw = [
    `From: ${hdr("Zcore web stranica")} <${user}>`,
    `To: <${to}>`,
    ...(replyEmail ? [`Reply-To: ${hdr(clean(row.name) || replyEmail)} <${replyEmail}>`] : []),
    `Subject: ${hdr(`Novi upit: ${clean(row.company)}`.slice(0, 150))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@zcore.ba>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(htmlBody)),
    `--${boundary}--`,
  ].join("\r\n");

  try {
    await smtpSend({
      host: env("SMTP_HOST", "mail.zcore.ba"), port: Number(env("SMTP_PORT", "465")),
      tlsName: env("SMTP_TLS_NAME", "matrix.global.ba"), user, pass, from: user, to, raw,
    });
  } catch (e) {
    // vrati oznaku da se može pokušati ponovo
    await db.from("inquiries").update({ notified_at: null }).eq("id", id);
    console.error("SMTP", String(e));
    return new Response("SMTP error", { status: 502 });
  }
  return new Response("Sent", { status: 200 });
});
