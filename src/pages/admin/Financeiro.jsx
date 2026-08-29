import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { formatBRL, getDiaria, cicloSemanal, dentroDoCiclo, labelCiclo, consumoDoCiclo } from '@/lib/donbaron';
import { DollarSign, Utensils, ChevronLeft, ChevronRight, Copy, Check, Search, QrCode } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import QRCode from 'qrcode';
import { Separator } from '@/components/ui/separator';
import { pixPayload } from '@/lib/pix';
import DailyView from '@/components/financeiro/DailyView';
import QrCodeSheet from '@/components/financeiro/QrCodeSheet';

export default function Financeiro() {
  const [motoboys, setMotoboys] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [viewMode, setViewMode] = useState('semana'); // 'semana' | 'dia'
  const [search, setSearch] = useState('');
  const [qrTarget, setQrTarget] = useState(null);

  const copiarPix = (chave) => {
    navigator.clipboard.writeText(chave).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const confirmarPagamento = async () => {
    if (!payTarget || confirmando) return;
    setConfirmando(true);
    try {
      await base44.functions.invoke('registrarPagamento', {
        motoboy_id: payTarget.m.id,
        forma: 'pix',
        banco: payTarget.m.banco || '',
        valor: payTarget.liquido,
        dias: payTarget.dias,
        valor_bruto: payTarget.bruto,
        desconto_consumo: payTarget.consumoTotal,
        consumo_ids: payTarget.consumoPendenteIds,
        periodo_inicio: ciclo.startISO,
        periodo_fim: ciclo.endISO,
      });
      setPayTarget(null);
      load();
    } catch (e) {
      alert('Erro ao registrar pagamento: ' + (e?.message || 'tente novamente'));
    } finally {
      setConfirmando(false);
    }
  };
  // 0 = semana em andamento (visão padrão no dia a dia).
  // Na QUARTA (dia de pagamento) abre direto na semana fechada (-1).
  const [weekOffset, setWeekOffset] = useState(() => (new Date().getDay() === 3 ? -1 : 0));

  const load = async () => {
    const [m, c, p, conf, cons] = await Promise.all([
      base44.entities.Motoboy.filter({ status: 'ativo' }),
      base44.entities.CheckIn.list('-data', 500),
      base44.entities.Pagamento.list('-data', 500),
      base44.entities.ConfigDiaria.list(),
      base44.entities.ConsumoMotoboy.list('-data', 1000),
    ]);
    setMotoboys(m);
    setCheckIns(c);
    setPayments(p);
    setConfig(conf[0] || null);
    setConsumos(cons);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!payTarget) { setQrDataUrl(''); return; }
    const m = payTarget.m;
    const chave = m.pix || '';
    const tipo = m.tipo_chave_pix || 'pix';
    if (!chave) { setQrDataUrl(''); return; }
    const payload = pixPayload(chave, payTarget.liquido, m.nome, 'Teresina', tipo);
    QRCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [payTarget]);

  const ciclo = useMemo(() => cicloSemanal(weekOffset), [weekOffset]);

  const rows = useMemo(() => {
    const filtrados = motoboys.filter((m) =>
      !search ||
      m.nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.telefone?.includes(search) ||
      m.pix?.toLowerCase().includes(search.toLowerCase())
    );
    const ordenados = [...filtrados].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
    return ordenados.map((m) => {
      const weekCheckIns = checkIns.filter(
        (c) => c.motoboy_id === m.id && c.status === 'sucesso' && dentroDoCiclo(c.data, ciclo)
      );
      const dias = weekCheckIns.length;
      const diarias = dias * getDiaria(m, config);
      const bonus = m.bonus || 0;
      const descontos = m.descontos || 0;

      // ===== INTEGRAÇÃO COM CONSUMO (dentro do ciclo) =====
      const consumoItens = consumoDoCiclo(consumos, m.id, ciclo);
      const consumoTotal = consumoItens.reduce((s, c) => s + (c.valor_total || 0), 0);
      const consumoPendenteIds = consumoItens.filter((c) => c.status === 'ativo').map((c) => c.id);

      const bruto = diarias + bonus;
      const liquido = bruto - descontos - consumoTotal;

      // Pagamentos deste ciclo: novos têm periodo_inicio; antigos caem no fallback
      // (data do pagamento entre o início do ciclo e 7 dias após o fim).
      const cicloPayments = payments.filter((p) => {
        if (p.motoboy_id !== m.id) return false;
        if (p.periodo_inicio) return p.periodo_inicio === ciclo.startISO;
        const limite = new Date(ciclo.end);
        limite.setDate(limite.getDate() + 7);
        const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
        return p.data >= ciclo.startISO && p.data <= limiteISO;
      });
      const totalPago = cicloPayments.reduce((s, p) => s + (p.valor || 0), 0);
      const status = liquido > 0 && totalPago >= liquido ? 'pago' : 'pendente';

      return { m, dias, diarias, bonus, descontos, consumoTotal, consumoItens, consumoPendenteIds, bruto, liquido, totalPago, status };
    });
  }, [motoboys, search, checkIns, payments, config, consumos, ciclo]);

  const totals = rows.reduce((acc, r) => ({
    diarias: acc.diarias + r.diarias,
    bruto: acc.bruto + r.bruto,
    consumo: acc.consumo + r.consumoTotal,
    liquido: acc.liquido + r.liquido,
    pago: acc.pago + r.totalPago,
  }), { diarias: 0, bruto: 0, consumo: 0, liquido: 0, pago: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Painel Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Folha semanal • quarta a terça • pagamento na quarta</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle de visão */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'semana' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'dia' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
            >
              Por Dia
            </button>
          </div>
          {viewMode === 'semana' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[220px]">
                <p className="text-sm font-semibold">{labelCiclo(ciclo)}</p>
                <Badge variant="outline" className={weekOffset === -1 ? 'text-accent border-accent/40' : weekOffset === 0 ? 'text-amber-600 border-amber-300' : 'text-muted-foreground'}>
                  {weekOffset === -1 ? 'Semana fechada — pagar agora' : weekOffset === 0 ? 'Semana em andamento' : 'Semana anterior'}
                </Badge>
              </div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => Math.min(0, w + 1))} disabled={weekOffset >= 0}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {weekOffset !== -1 && (
                <Button variant="secondary" size="sm" onClick={() => setWeekOffset(-1)}>
                  Semana a pagar
                </Button>
              )}
              {weekOffset === -1 && (
                <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>
                  Semana atual
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'dia' ? (
        <DailyView motoboys={motoboys} checkIns={checkIns} consumos={consumos} config={config} />
      ) : (
      <>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou PIX..." className="pl-9" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Folha bruta</p>
          <p className="text-xl font-bold mt-1">{formatBRL(totals.bruto)}</p>
        </Card>
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Consumo (semana)</p>
          <p className="text-xl font-bold text-orange-600 mt-1">−{formatBRL(totals.consumo)}</p>
        </Card>
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Folha líquida</p>
          <p className="text-xl font-bold mt-1">{formatBRL(totals.liquido)}</p>
        </Card>
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total pago</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatBRL(totals.pago)}</p>
        </Card>
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatBRL(Math.max(0, totals.liquido - totals.pago))}</p>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motoboy</TableHead>
              <TableHead className="text-center">Dias</TableHead>
              <TableHead className="text-right hidden md:table-cell">Diárias</TableHead>
              <TableHead className="text-right hidden md:table-cell">Bônus</TableHead>
              <TableHead className="text-right hidden md:table-cell">Descontos</TableHead>
              <TableHead className="text-right">Consumo</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">QR PIX</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum motoboy encontrado.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.m.id}>
                  <TableCell className="font-medium">{r.m.nome}</TableCell>
                  <TableCell className="text-center">{r.dias}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-muted-foreground">{formatBRL(r.diarias)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-emerald-600">{formatBRL(r.bonus)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-red-500">{formatBRL(r.descontos)}</TableCell>
                  <TableCell className="text-right text-orange-600">
                    {r.consumoTotal > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Utensils className="w-3 h-3" />
                        −{formatBRL(r.consumoTotal)}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(r.bruto)}</TableCell>
                  <TableCell className="text-right font-bold">{formatBRL(r.liquido)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.status === 'pago' ? 'default' : 'secondary'} className={r.status === 'pago' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                      {r.status === 'pago' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      title="Gerar QR Code PIX sem valor"
                      onClick={() => setQrTarget({ m: r.m, valor: null, subtitle: `${labelCiclo(ciclo)} • Líquido: ${formatBRL(r.liquido)}` })}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={r.liquido <= 0 || r.status === 'pago' || weekOffset === 0}
                      title={weekOffset === 0 ? 'A semana em andamento só fecha na terça' : undefined}
                      className="gap-1.5"
                      onClick={() => { setCopiado(false); setPayTarget(r); }}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Pagar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      </>
      )}

      <Sheet open={!!payTarget} onOpenChange={(o) => { if (!o) { setPayTarget(null); setCopiado(false); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          {payTarget && (() => {
            const m = payTarget.m;
            const chave = m.pix || '';
            const tipo = m.tipo_chave_pix || 'pix';
            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                  <SheetTitle className="text-xl">{m.nome}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{payTarget.dias} dia(s) • {labelCiclo(ciclo)}</p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* QR Code PIX */}
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">PIX</span>
                      <span className="text-xs text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">{tipo}</span>
                    </div>
                    {chave ? (
                      <>
                        {/* QR Code */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="bg-white rounded-xl p-3 shadow-sm border border-emerald-100">
                            {qrDataUrl ? (
                              <img src={qrDataUrl} alt="QR Code PIX" width={208} height={208} className="block" />
                            ) : (
                              <div className="w-[208px] h-[208px] bg-muted animate-pulse rounded" />
                            )}
                          </div>
                          <p className="text-xs text-emerald-700 font-medium">Valor já incluído: <strong>{formatBRL(payTarget.liquido)}</strong></p>
                        </div>
                        {/* Chave + copiar */}
                        <div className="bg-white rounded-xl border border-emerald-100 px-3 py-2 flex items-center gap-2">
                          <p className="flex-1 text-sm font-mono text-emerald-900 break-all">{chave}</p>
                          <button
                            onClick={() => copiarPix(chave)}
                            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg px-2 py-1.5 transition-colors"
                          >
                            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiado ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">⚠️ PIX não cadastrado — atualize o cadastro deste motoboy.</p>
                    )}
                  </div>

                  {/* Extrato */}
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extrato da semana</p>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Diárias ({payTarget.dias} dia{payTarget.dias !== 1 ? 's' : ''})</span>
                        <span>{formatBRL(payTarget.diarias)}</span>
                      </div>
                      {(payTarget.bonus || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Bônus</span>
                          <span className="text-emerald-600">+{formatBRL(payTarget.bonus)}</span>
                        </div>
                      )}
                      {(payTarget.descontos || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Descontos</span>
                          <span className="text-red-500">−{formatBRL(payTarget.descontos)}</span>
                        </div>
                      )}
                      {(payTarget.consumoTotal || 0) > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Consumo</span>
                            <span className="text-orange-600">−{formatBRL(payTarget.consumoTotal)}</span>
                          </div>
                          <div className="rounded-lg bg-muted/60 px-3 py-2 space-y-1">
                            {(payTarget.consumoItens || []).map((c) => (
                              <div key={c.id} className="flex justify-between text-xs text-muted-foreground">
                                <span className="truncate pr-2">{c.quantidade}x {c.produto}</span>
                                <span className="shrink-0">{formatBRL(c.valor_total)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center pt-1">
                        <span className="font-semibold">Total a pagar</span>
                        <span className="text-2xl font-bold text-foreground">{formatBRL(payTarget.liquido)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Botão confirmar fixo no rodapé */}
                <div className="px-6 py-4 border-t border-border/60 bg-background">
                  <button
                    onClick={confirmarPagamento}
                    disabled={confirmando}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground hover:bg-foreground/90 text-background text-base font-bold py-4 transition-colors disabled:opacity-50"
                  >
                    <DollarSign className="w-5 h-5" />
                    {confirmando ? 'Registrando...' : `Confirmar pagamento de ${formatBRL(payTarget.liquido)}`}
                  </button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <QrCodeSheet target={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}