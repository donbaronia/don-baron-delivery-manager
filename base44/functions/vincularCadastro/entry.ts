import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ===== Helper de fuso horário (Teresina/PI = America/Fortaleza) =====
const TZ = 'America/Fortaleza';
function agora() {
  const d = new Date();
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '00';
  return { data: `${g('year')}-${g('month')}-${g('day')}`, iso: d.toISOString() };
}

// Vincula a conta (email/senha) criada pelo próprio motoboy ao cadastro
// feito pelo admin, usando o PIN pessoal de 5 dígitos como chave.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const pin = String(body.pin || '').trim();
    if (!/^\d{5}$/.test(pin)) {
      return Response.json({ error: 'Informe o PIN pessoal de 5 dígitos.' }, { status: 400 });
    }

    const t = agora();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Conta já vinculada a algum cadastro?
    const jaVinculado = await base44.asServiceRole.entities.Motoboy.filter({ email: user.email });
    if (jaVinculado.length > 0) {
      return Response.json({ error: 'Sua conta já está vinculada a um cadastro.' }, { status: 400 });
    }

    // Procura cadastro com esse PIN pessoal e SEM email (disponível para vincular)
    const candidatos = await base44.asServiceRole.entities.Motoboy.filter({ pin });
    const livres = candidatos.filter((m: any) => !m.email);

    if (livres.length === 0) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'vinculo_falhou',
        usuario: user.email,
        detalhes: `Tentativa de vínculo com PIN ${pin} falhou (PIN inexistente ou cadastro já vinculado). IP: ${ip}`,
        data_hora: t.iso,
        ip,
      });
      return Response.json({ error: 'PIN não encontrado ou cadastro já vinculado. Confira com a administração.' }, { status: 404 });
    }
    if (livres.length > 1) {
      return Response.json({ error: 'Mais de um cadastro com este PIN. Procure a administração para ajustar.' }, { status: 409 });
    }

    const motoboy = livres[0];
    await base44.asServiceRole.entities.Motoboy.update(motoboy.id, {
      email: user.email,
      user_id: user.id || '',
    });

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'vinculo_conta',
      usuario: user.email,
      detalhes: `Conta ${user.email} vinculada ao cadastro de ${motoboy.nome} via PIN pessoal. IP: ${ip}`,
      data_hora: t.iso,
      ip,
      motoboy_id: motoboy.id,
    });

    return Response.json({ success: true, nome: motoboy.nome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
