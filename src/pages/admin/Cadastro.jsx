import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import MotoboyForm from '@/components/MotoboyForm';
import CheckInManualDialog from '@/components/CheckInManualDialog';
import BloqueioDialog from '@/components/BloqueioDialog';
import ExcluirDialog from '@/components/ExcluirDialog';
import { logAuditoria, formatDate, todayISO, cicloSemanal, labelCiclo } from '@/lib/donbaron';
import {
  Plus, MoreVertical, Pencil, Ban, Check, Search, Clock, ShieldOff, ShieldCheck, Trash2, Filter,
} from 'lucide-react';

const STATUS_BADGES = {
  ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  inativo: { label: 'Inativo', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  bloqueado: { label: 'Bloqueado', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'inativo', label: 'Inativos' },
  { key: 'bloqueado', label: 'Bloqueados' },
  { key: 'checkin_hoje', label: 'Check-in hoje' },
  { key: 'sem_checkin_hoje', label: 'Sem check-in hoje' },
  { key: 'ausente_2', label: 'Ausentes 2 dias' },
  { key: 'ausente_7', label: 'Ausentes 7 dias' },
];

export default function Cadastro() {
  const [motoboys, setMotoboys] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [checkinModal, setCheckinModal] = useState(null);
  const [bloqueioModal, setBloqueioModal] = useState(null);
  const [excluirModal, setExcluirModal] = useState(null);

  const load = async () => {
    const list = await base44.entities.Motoboy.list('-created_date', 200);
    const today = todayISO();
    const [todayCheckIns, pags] = await Promise.all([
      base44.entities.CheckIn.filter({ data: today, status: 'sucesso' }, '-hora', 200),
      base44.entities.Pagamento.list('-data', 300),
    ]);
    // Ordem alfabética por nome
    list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
    setMotoboys(list);
    setCheckIns(todayCheckIns);
    setPagamentos(pags);
    setLoading(false);
  };

  // Semana fechada (qua–ter anterior) — é a que se paga na quarta
  const cicloPagto = cicloSemanal(-1);
  const pagouSemana = (motoboyId) =>
    pagamentos.some((p) => {
      if (p.motoboy_id !== motoboyId) return false;
      if (p.periodo_inicio) return p.periodo_inicio === cicloPagto.startISO;
      return p.data >= cicloPagto.startISO; // pagamentos antigos sem período
    });

  useEffect(() => { load(); }, []);

  const handleNew = () => { setEditing(null); setFormOpen(true); };
  const handleEdit = (m) => { setEditing(m); setFormOpen(true); };

  const toggleStatus = async (m) => {
    const newStatus = m.status === 'ativo' ? 'inativo' : 'ativo';
    await base44.entities.Motoboy.update(m.id, { status: newStatus });
    await logAuditoria(
      newStatus === 'inativo' ? 'inativacao' : 'reativacao',
      `${m.nome} foi ${newStatus === 'inativo' ? 'inativado' : 'reativado'}`,
      m.id
    );
    load();
  };

  const handleDesbloquear = async (m) => {
    try {
      await base44.functions.invoke('gerenciarMotoboy', { acao: 'desbloquear', motoboy_id: m.id });
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const checkInTodayIds = new Set(checkIns.map((c) => c.motoboy_id));
  const today = todayISO();
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const twoDaysAgo = localISO(new Date(Date.now() - 2 * 86400000));
  const sevenDaysAgo = localISO(new Date(Date.now() - 7 * 86400000));

  // Último check-in por motoboy (para filtros de ausência, usamos os check-ins carregados)
  // Como não temos todo o histórico aqui, os filtros de ausência são baseados em data_entrada como aproximação
  // e na ausência de check-in hoje. Para precisão total, seria necessária uma query mais ampla.
  const filtered = motoboys.filter((m) => {
    const matchesSearch =
      m.nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.telefone?.includes(search);

    if (!matchesSearch) return false;

    switch (filter) {
      case 'ativo': return m.status === 'ativo';
      case 'inativo': return m.status === 'inativo';
      case 'bloqueado': return m.status === 'bloqueado';
      case 'checkin_hoje': return checkInTodayIds.has(m.id);
      case 'sem_checkin_hoje': return m.status === 'ativo' && !checkInTodayIds.has(m.id);
      case 'ausente_2': return m.status === 'ativo' && !checkInTodayIds.has(m.id) && (!m.data_entrada || m.data_entrada <= twoDaysAgo);
      case 'ausente_7': return m.status === 'ativo' && !checkInTodayIds.has(m.id) && (!m.data_entrada || m.data_entrada <= sevenDaysAgo);
      default: return true;
    }
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Cadastro de Motoboys</h1>
          <p className="text-sm text-muted-foreground mt-1">{motoboys.length} motoboy(s) cadastrado(s)</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Motoboy
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email, telefone..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Banco</TableHead>
              <TableHead className="hidden md:table-cell">Entrada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center" title="Pagamento da semana fechada">Pagto</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum motoboy encontrado.</TableCell></TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id} className={m.status === 'bloqueado' ? 'bg-red-50/30' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                        {m.nome?.[0]}
                      </div>
                      <div>
                        {m.nome}
                        {m.status === 'bloqueado' && m.motivo_bloqueio && (
                          <p className="text-xs text-red-600 truncate max-w-[180px]">{m.motivo_bloqueio}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{m.telefone || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{m.email}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{m.banco || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.data_entrada)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_BADGES[m.status]?.className || ''}>
                      {STATUS_BADGES[m.status]?.label || m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      title={pagouSemana(m.id)
                        ? `Semana ${labelCiclo(cicloPagto)} paga`
                        : `Semana ${labelCiclo(cicloPagto)} pendente`}
                      className={`inline-block w-3 h-3 rounded-full ${pagouSemana(m.id) ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => handleEdit(m)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCheckinModal(m)}>
                          <Clock className="w-4 h-4 mr-2" /> Check-in Manual
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {m.status === 'bloqueado' ? (
                          <DropdownMenuItem onClick={() => handleDesbloquear(m)} className="text-emerald-600">
                            <ShieldCheck className="w-4 h-4 mr-2" /> Desbloquear
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => toggleStatus(m)} className={m.status === 'ativo' ? 'text-amber-600' : 'text-emerald-600'}>
                              {m.status === 'ativo' ? <><Ban className="w-4 h-4 mr-2" /> Inativar</> : <><Check className="w-4 h-4 mr-2" /> Reativar</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setBloqueioModal(m)} className="text-red-600">
                              <ShieldOff className="w-4 h-4 mr-2" /> Bloquear Acesso
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setExcluirModal(m)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir Definitivamente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <MotoboyForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} motoboy={editing} />
      {checkinModal && (
        <CheckInManualDialog open={!!checkinModal} onClose={() => setCheckinModal(null)} motoboy={checkinModal} onSaved={load} />
      )}
      {bloqueioModal && (
        <BloqueioDialog open={!!bloqueioModal} onClose={() => setBloqueioModal(null)} motoboy={bloqueioModal} onSaved={load} />
      )}
      {excluirModal && (
        <ExcluirDialog open={!!excluirModal} onClose={() => setExcluirModal(null)} motoboy={excluirModal} onSaved={load} />
      )}
    </div>
  );
}