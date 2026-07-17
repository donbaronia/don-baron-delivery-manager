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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import MotoboyForm from '@/components/MotoboyForm';
import { logAuditoria, formatDate } from '@/lib/donbaron';
import { Plus, MoreVertical, Pencil, Ban, Check, Search } from 'lucide-react';

export default function Cadastro() {
  const [motoboys, setMotoboys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    const list = await base44.entities.Motoboy.list('-created_date', 200);
    setMotoboys(list);
    setLoading(false);
  };

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

  const filtered = motoboys.filter((m) =>
    m.nome?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.telefone?.includes(search)
  );

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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email, telefone..." className="pl-9" />
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
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum motoboy encontrado.</TableCell></TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                        {m.nome?.[0]}
                      </div>
                      {m.nome}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{m.telefone || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{m.email}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{m.banco || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.data_entrada)}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'ativo' ? 'default' : 'secondary'} className={m.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}>
                      {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(m)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(m)} className={m.status === 'ativo' ? 'text-red-600' : 'text-emerald-600'}>
                          {m.status === 'ativo' ? <><Ban className="w-4 h-4 mr-2" /> Inativar</> : <><Check className="w-4 h-4 mr-2" /> Reativar</>}
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
    </div>
  );
}