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
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });

    const body = await req.json();
    const { motoboy_id, motivo, hora, data } = body;

    if (!motivo || !motivo.trim()) return Response.json({ error: 'Motivo é obrigatório' }, { status: 400 });

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const navegador = req.headers.get('user-agent') || 'unknown';
    const today = data || agora().data;
    const checkInHora = hora || agora().hora;

    // Verificar duplicidade no mesmo dia
    const existing = await base44.asServiceRole.entities.CheckIn.filter({ motoboy_id: motoboy.id, data: today, status: 'sucesso' });
    if (existing.length > 0) {
      const horaExistente = existing[0].hora?.substring(0, 5) || '';
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_manual_duplicado',
        usuario: user.email,
        detalhes: `Tentativa de check-in MANUAL duplicado para ${motoboy.nome}. Check-in já existe às ${horaExistente}. IP: ${ip}. Navegador: ${navegador}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'check_in_duplicado', hora: horaExistente }, { status: 400 });
    }

    // Criar check-in manual
    const checkIn = await base44.asServiceRole.entities.CheckIn.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: today,
      hora: checkInHora,
      usuario: user.email,
      dispositivo: 'manual_admin',
      ip,
      tipo: 'manual',
      status: 'sucesso',
      motivo: motivo.trim()
    });

    // Consumir token se ciclo ativo existir (evita check-in automático posterior)
    const cycles = await base44.asServiceRole.entities.CicloOperacional.filter({ data: today, status: 'ativo' });
    if (cycles.length > 0) {
      const tokens = await base44.asServiceRole.entities.Token.filter({ ciclo_id: cycles[0].id, motoboy_id: motoboy.id });
      if (tokens.length > 0 && !tokens[0].consumido) {
        await base44.asServiceRole.entities.Token.update(tokens[0].id, {
          consumido: true,
          consumido_em: now.toISOString(),
          consumido_ip: ip,
          consumido_dispositivo: 'manual_admin',
          check_in_id: checkIn.id
        });
      }
    }

    // Auditoria completa
    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'check_in_manual',
      usuario: user.email,
      detalhes: `Check-in MANUAL para ${motoboy.nome}. Motivo: ${motivo.trim()}. Data: ${today}. Hora: ${checkInHora}. IP: ${ip}. Navegador: ${navegador}. Resultado: SUCESSO`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, checkIn });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});