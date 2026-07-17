import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import PaymentDialog from '@/components/PaymentDialog';
import { formatBRL, getDiaria, todayISO } from '@/lib/donbaron';
import { DollarSign } from 'lucide-react';

export default function Financeiro() {
  const [motoboys, setMotoboys] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);

  const load = async () => {
    const [m, c, p, conf] = await Promise.all([
      base44.entities.Motoboy.filter({ status: 'ativo' }),
      base44.entities.CheckIn.list('-data', 500),
      base44.entities.Pagamento.list('-data', 500),
      base44.entities.ConfigDiaria.list(),
    ]);
    setMotoboys(m);
    setCheckIns(c);
    setPayments(p);
    setConfig(conf[0] || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return motoboys.map((m) => {
      const monthCheckIns = checkIns.filter((c) => {
        if (c.motoboy_id !== m.id || c.status !== 'sucesso') return false;
        const d = new Date(c.data + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const dias = monthCheckIns.length;
      const diarias = dias * getDiaria(m, config);
      const bonus = m.bonus || 0;
      const descontos = m.descontos || 0;
      const bruto = diarias + bonus;
      const liquido = bruto - descontos;

      const monthPayments = payments.filter((p) => {
        if (p.motoboy_id !== m.id) return false;
        const d = new Date(p.data + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const totalPagoMes = monthPayments.reduce((s, p) => s + (p.valor || 0), 0);
      const status = totalPagoMes >= liquido ? 'pago' : 'pendente';

      return { m, dias, diarias, bonus, descontos, bruto, liquido, totalPagoMes, status };
    });
  }, [motoboys, checkIns, payments, config]);

  const totals = rows.reduce((acc, r) => ({
    diarias: acc.diarias + r.diarias,
    bruto: acc.bruto + r.bruto,
    liquido: acc.liquido + r.liquido,
    pago: acc.pago + r.totalPagoMes,
  }), { diarias: 0, bruto: 0, liquido: 0, pago: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Painel Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-border/60 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Folha bruta</p>
          <p className="text-xl font-bold mt-1">{formatBRL(totals.bruto)}</p>
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
          <p className="text-xl font-bold text-amber-600 mt-1">{formatBRL(totals.liquido - totals.pago)}</p>
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
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum motoboy ativo.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.m.id}>
                  <TableCell className="font-medium">{r.m.nome}</TableCell>
                  <TableCell className="text-center">{r.dias}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-muted-foreground">{formatBRL(r.diarias)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-emerald-600">{formatBRL(r.bonus)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell text-red-500">{formatBRL(r.descontos)}</TableCell>
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
                      disabled={r.liquido <= 0 || r.status === 'pago'}
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
          onClose={() => setPayTarget(null)}
          motoboy={payTarget.m}
          valorLiquido={payTarget.liquido}
          dias={payTarget.dias}
        />
      )}
    </div>
  );
}