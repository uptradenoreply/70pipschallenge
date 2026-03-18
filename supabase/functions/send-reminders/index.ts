import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type UserRow = {
  username: string;
  email: string;
};

function requiredEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function sendEmailResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SERVICE_ROLE_KEY');

    const resendApiKey = requiredEnv('RESEND_API_KEY');
    const fromEmail = requiredEnv('REMINDER_FROM');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('users')
      .select('username,email')
      .eq('reminder_enabled', true)
      .not('email', 'is', null);

    if (error) throw new Error(error.message);

    const users = (data ?? []) as UserRow[];

    const subject = 'Trading Reminder — GOLD TRACKER';
    const html = `
      <div style="font-family: ui-sans-serif, system-ui; background:#020617; color:#e2e8f0; padding:24px; border-radius:16px;">
        <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#60a5fa; font-weight:800;">Trading Gold Special Edition</div>
        <h2 style="margin:12px 0 8px; font-size:20px; color:#fff;">Time to check your plan</h2>
        <p style="margin:0; color:#94a3b8; font-size:14px; line-height:1.6;">
          Reminder untuk eksekusi trading plan kamu. Fokus pada setup berkualitas, bukan frekuensi.
        </p>
        <div style="margin-top:16px; padding:12px 14px; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25); border-radius:12px;">
          <div style="font-weight:800; color:#bfdbfe; font-size:13px;">Checklist cepat</div>
          <ul style="margin:8px 0 0; padding-left:18px; color:#cbd5e1; font-size:13px;">
            <li>Session aktif? (Tokyo/NY)</li>
            <li>Risk sesuai rule</li>
            <li>Entry hanya jika ada setup</li>
          </ul>
        </div>
      </div>
    `;

    let ok = 0;
    const failures: { username: string; error: string }[] = [];

    for (const u of users) {
      try {
        await sendEmailResend({
          apiKey: resendApiKey,
          from: fromEmail,
          to: u.email,
          subject,
          html,
        });
        ok += 1;
      } catch (e) {
        failures.push({ username: u.username, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return Response.json({ sent: ok, total: users.length, failures }, { status: 200 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
});
