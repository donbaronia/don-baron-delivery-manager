import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { formatBRL, getDiaria, formatDate } from '@/lib/donbaron';
import { Utensils, Search, CalendarDays, CheckCircle2, QrCode } from 'lucide-react';
import QrCodeSheet from '@/components/financeiro/QrCodeSheet';

export default function DailyView({ motoboys, checkIns, consumos, config }) {
  const [date, setDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [qrTarget, setQrTarget] = useState(null);

  const dateISO = useMemo(() => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [date]);

  // Check-ins do dia selecionado
  const dayCheckIns = useMemo(
    () => checkIns.filter((c) => c.data === dateISO && c.status === 'sucesso'),
    [checkIns, dateISO]
  );

  // Mapa motoboy_id -> check-in do dia
  const checkInMap = useMemo(() => {
    const map = {};
    dayCheckIns.forEach((c) => { map[c.motoboy_id] = c; });
    return map;
  }, [dayCheckIns]);

  // Consumo do dia por motoboy
  const consumoDoDia = useMemo(() => {
    const byMotoboy = {};
    consumos
      .filter((c) => c.data === dateISO && c.status !== 'cancelado')
      .forEach((c) => {
        if (!byMotoboy[c.motoboy_id]) byMotoboy[c.motoboy_id] = [];
        byMotoboy[c.motoboy_id].push(c);
      });
    return byMotoboy;
  }, [consumos, dateISO]);

  // Lista: APENAS motoboys presentes no dia (com filtro de busca)
  const rows = useMemo(() => {
    const presentes = motoboys.filter((m) => checkInMap[m.id]);
    const filtrados = presentes.filter((m) =>
      !search ||
      m.nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.telefone?.includes(search) ||
      m.pix?.toLowerCase().includes(search.toLowerCase())
    );
    return filtrados
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }))
      .map((m) => {
        const checkIn = checkInMap[m.id];
        const consumos = consumoDoDia[m.id] || [];
        const consumoTotal = consumos.reduce((s, c) => s + (c.valor_total || 0), 0);
        const diaria = getDiaria(m, config);
        const liquido = diaria - consumoTotal;
        return { m, checkIn, consumos, consumoTotal, diaria, liquido };
      });
  }, [motoboys, search, checkInMap, consumoDoDia, config]);

  const totals = rows.reduce((acc, r) => ({
    diarias: acc.diarias + r.diaria,
    consumo: acc.consumo + r.consumoTotal,
    liquido: acc.liquido + r.liquido,
  }), { diarias: 0, consumo: 0, liquido: 0 });

  return (
    <div className="space-y-6">
      {/* Calendário + busca */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="p-4 border-border/60 shadow-sm w-fit">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold">Selecionar data</p>
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-lg border border-border/40"
          />
        </Card>

        <div className="flex-1 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou PIX..." className="pl-9" />
          </div>

          {/* Resumo do dia */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 border-border/60 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Data</p>
              <p className="text-base font-bold mt-1">{formatDate(dateISO)}</p>
            </Card>
            <Card className="p-4 border-border/60 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Presentes</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{rows.length}</p>
            </Card>
            <Card className="p-4 border-border/60 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Diárias</p>
              <p className="text-xl font-bold mt-1">{formatBRL(totals.diarias)}</p>
            </Card>
            <Card className="p-4 border-border/60 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Consumo</p>
              <p className="text-xl font-bold text-orange-600 mt-1">−{formatBRL(totals.consumo)}</p>
            </Card>
          </div>
        </div>
      </div>

      {/* Tabela do dia — apenas presentes */}
      <Card className="border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motoboy</TableHead>
              <TableHead className="hidden md:table-cell">Check-in</TableHead>
              <TableHead className="text-right">Diária</TableHead>
              <TableHead className="text-right">Consumo</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-center">QR PIX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum motoboy presente nesta data.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.m.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 uppercase">
                        {r.m.nome?.[0]}
                      </div>
                      {r.m.nome}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {r.checkIn?.hora || '—'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatBRL(r.diaria)}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {r.consumoTotal > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Utensils className="w-3 h-3" />
                        −{formatBRL(r.consumoTotal)}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatBRL(r.liquido)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setQrTarget({ m: r.m, valor: null, subtitle: `${formatDate(dateISO)} • Líquido: ${formatBRL(r.liquido)}` })}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <QrCodeSheet target={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}