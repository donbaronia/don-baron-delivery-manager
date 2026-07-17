import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { pin, dispositivo } = body;

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ email: user.email });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });
    if (motoboy.status !== 'ativo') return Response.json({ error: 'Motoboy inativo. Procure a administração.' }, { status: 403 });

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

    if (motoboy.pin !== pin) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'pin_incorreto',
        usuario: user.email,
        detalhes: `Tentativa de PIN incorreto para ${motoboy.nome}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'PIN incorreto. Tente novamente.' }, { status: 400 });
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeMinutes = hour * 60 + minute;
    const windowStart = 17 * 60;
    const windowEnd = 18 * 60 + 30;

    if (timeMinutes < windowStart || timeMinutes > windowEnd) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_fora_horario',
        usuario: user.email,
        detalhes: `Tentativa de check-in fora do horário por ${motoboy.nome}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'check_in_encerrado' }, { status: 400 });
    }

    const today = now.toISOString().split('T')[0];
    const existing = await base44.asServiceRole.entities.CheckIn.filter({
      motoboy_id: motoboy.id,
      data: today,
      status: 'sucesso'
    });
    if (existing.length > 0) {
      return Response.json({ error: 'check_in_duplicado' }, { status: 400 });
    }

    const checkIn = await base44.asServiceRole.entities.CheckIn.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: today,
      hora: now.toTimeString().substring(0, 8),
      usuario: user.email,
      dispositivo: dispositivo || 'web',
      ip,
      tipo: 'automatico',
      status: 'sucesso'
    });

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'check_in',
      usuario: user.email,
      detalhes: `Check-in realizado por ${motoboy.nome}`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, checkIn });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});