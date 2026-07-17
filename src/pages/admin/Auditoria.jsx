import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/donbaron';
import { Search } from 'lucide-react';

const ACTION_LABELS = {
  check_in: { label: 'Check-in', tone: 'bg-emerald-100 text-emerald-700' },
  check_in_manual: { label: 'Check-in Manual', tone: 'bg-amber-100 text-amber-700' },
  check_in_fora_horario: { label: 'Check-in Fora Horário', tone: 'bg-red-100 text-red-700' },
  pin_incorreto: { label: 'PIN Incorreto', tone: 'bg-red-100 text-red-700' },
  pagamento: { label: 'Pagamento', tone: 'bg-blue-100 text-blue-700' },
  novo_cadastro: { label: 'Novo Cadastro', tone: 'bg-emerald-100 text-emerald-700' },
  edicao_cadastro: { label: 'Edição', tone: 'bg-blue-100 text-blue-700' },
  inativacao: { label: 'Inativação', tone: 'bg-red-100 text-red-700' },
  reativacao: { label: 'Reativação', tone: 'bg-emerald-100 text-emerald-700' },
  senha_master_incorreta: { label: 'Senha Master Inválida', tone: 'bg-red-100 text-red-700' },
  login: { label: 'Login', tone: 'bg-slate-100 text-slate-700' },
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const list = await base44.entities.Auditoria.list('-data_hora', 200);
      setLogs(list);
      setLoading(false);
    };
    load();
    const unsub = base44.entities.Auditoria.subscribe(() => load());
    return () => unsub();
  }, []);

  const filtered = logs.filter((l) =>
    l.acao?.toLowerCase().includes(search.toLowerCase()) ||
    l.usuario?.toLowerCase().includes(search.toLowerCase()) ||
    l.detalhes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">Registro permanente de todas as ações do sistema</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ação, usuário, detalhe..." className="pl-9" />
      </div>

      <Card className="border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Data/Hora</TableHead>
              <TableHead className="w-[180px]">Ação</TableHead>
              <TableHead className="hidden md:table-cell">Usuário</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
            ) : (
              filtered.map((l) => {
                const cfg = ACTION_LABELS[l.acao] || { label: l.acao, tone: 'bg-slate-100 text-slate-700' };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDateTime(l.data_hora)}</TableCell>
                    <TableCell><Badge className={cfg.tone + ' hover:' + cfg.tone}>{cfg.label}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{l.usuario}</TableCell>
                    <TableCell className="text-sm">{l.detalhes}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}