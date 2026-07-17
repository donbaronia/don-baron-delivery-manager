import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import PaymentDialog from '@/components/PaymentDialog';
import { formatBRL, getDiaria, cicloSemanal, dentroDoCiclo, labelCiclo, consumoDoCiclo } from '@/lib/donbaron';
import { DollarSign, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Financeiro() {
  const [motoboys, setMotoboys] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  // -1 = semana fechada (paga na quarta) — visão padrão. 0 = semana em andamento.
  const [weekOffset, setWeekOffset] = useState(-1);

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

  const ciclo = useMemo(() => cicloSemanal(weekOffset), [weekOffset]);

  const rows = useMemo(() => {
    return motoboys.map((m) => {
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
  }, [motoboys, checkIns, payments, config, consumos, ciclo]);

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
        </div>
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
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum motoboy ativo.</TableCell></TableRow>
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
                      onClick={() => setPayTarget(r)}
                      disabled={r.liquido <= 0 || r.status === 'pago' || weekOffset === 0}
                      title={weekOffset === 0 ? 'A semana em andamento só fecha na terça' : undefined}
                      className="gap-1.5"
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

      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          onClose={() => { setPayTarget(null); load(); }}
          motoboy={payTarget.m}
          valorLiquido={payTarget.liquido}
          dias={payTarget.dias}
          detalhes={{
            diarias: payTarget.diarias,
            bonus: payTarget.bonus,
            descontos: payTarget.descontos,
            consumoTotal: payTarget.consumoTotal,
            consumoItens: payTarget.consumoItens,
            consumoPendenteIds: payTarget.consumoPendenteIds,
            bruto: payTarget.bruto,
            periodoInicio: ciclo.startISO,
            periodoFim: ciclo.endISO,
            periodoLabel: labelCiclo(ciclo),
          }}
        />
      )}
    </div>
  );
}
