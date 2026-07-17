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
  return {
    data: `${g('year')}-${g('month')}-${g('day')}`,
    hora: `${g('hour')}:${g('minute')}:${g('second')}`,
    iso: d.toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { motoboy_id, senha_master, motivo } = body;

    const MASTER = Deno.env.get("SENHA_MASTER") || "DONBARON_MASTER_2024";
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = new Date();

    if (senha_master !== MASTER) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'senha_master_incorreta',
        usuario: user.email,
        detalhes: 'Tentativa de login emergencial com senha master incorreta',
        data_hora: now.toISOString(),
        ip
      });
      return Response.json({ error: 'Senha master incorreta' }, { status: 403 });
    }

    if (!motivo || !motivo.trim()) return Response.json({ error: 'Motivo é obrigatório' }, { status: 400 });

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    const today = agora().data;

    const checkIn = await base44.asServiceRole.entities.CheckIn.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: today,
      hora: agora().hora,
      usuario: user.email,
      dispositivo: 'manual_admin',
      ip,
      tipo: 'manual',
      status: 'sucesso',
      motivo: motivo.trim()
    });

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'check_in_manual',
      usuario: user.email,
      detalhes: `Check-in MANUAL para ${motoboy.nome}. Motivo: ${motivo.trim()}`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, checkIn });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});