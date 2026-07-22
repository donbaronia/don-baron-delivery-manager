import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { logAuditoria, BANCOS, TIPOS_PIX, todayISO } from '@/lib/donbaron';

// Hash da senha do portal: SHA-256(salt + senha) — nunca guardamos a senha em texto
async function hashSenha(salt, senha) {
  const data = new TextEncoder().encode(salt + senha);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const gerarSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');

export default function MotoboyForm({ open, onClose, onSaved, motoboy }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (motoboy) {
      setForm({ ...motoboy });
    } else {
      setForm({
        nome: '', telefone: '', email: '', pix: '', tipo_chave_pix: 'email',
        banco: '', pin: '', diaria: null, observacoes: '',
        data_entrada: todayISO(), status: 'ativo', bonus: 0, descontos: 0,
      });
    }
    setInviteError('');
    setSenha('');
  }, [motoboy, open]);

  const [senha, setSenha] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome || !form.pin) {
      setInviteError('Preencha nome e PIN pessoal.');
      return;
    }
    if (senha && !form.email) {
      setInviteError('Para definir a senha do portal, informe também o email (é o login do motoboy).');
      return;
    }
    if (senha && senha.length < 4) {
      setInviteError('A senha do portal deve ter pelo menos 4 caracteres.');
      return;
    }
    if (!motoboy && form.email && !senha) {
      setInviteError('Defina a senha do portal para este motoboy (é com ela que ele vai entrar).');
      return;
    }
    if (form.pin.length !== 5) {
      setInviteError('O PIN deve ter 5 dígitos.');
      return;
    }
    setSaving(true);
    setInviteError('');
    let inviteFailed = false;
    try {
      const dados = { ...form };
      if (dados.email) dados.email = dados.email.trim().toLowerCase();
      if (senha) {
        const salt = gerarSalt();
        dados.senha_salt = salt;
        dados.senha_hash = await hashSenha(salt, senha);
      }
      if (motoboy) {
        await base44.entities.Motoboy.update(motoboy.id, dados);
        await logAuditoria('edicao_cadastro', `Motoboy ${form.nome} editado`, motoboy.id);
      } else {
        const created = await base44.entities.Motoboy.create(dados);
        await logAuditoria('novo_cadastro', `Novo motoboy cadastrado: ${form.nome}`, created.id);

      }
      onSaved();
      if (!inviteFailed) onClose();
    } catch (e) {
      setInviteError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{motoboy ? 'Editar Motoboy' : 'Novo Motoboy'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.nome || ''} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do motoboy" />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={form.telefone || ''} onChange={(e) => set('telefone', e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="email de login do motoboy" type="email" />
              <p className="text-[11px] text-muted-foreground mt-1">É o login do motoboy no portal</p>
            </div>
            <div>
              <Label>Senha do portal {motoboy ? '(deixe em branco para manter a atual)' : ''}</Label>
              <Input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={motoboy ? '••••••' : 'Defina a senha de acesso'} type="text" autoComplete="off" />
              <p className="text-[11px] text-muted-foreground mt-1">Você define — o motoboy entra com email + esta senha</p>
            </div>
            <div>
              <Label>Tipo da chave PIX</Label>
              <Select value={form.tipo_chave_pix || 'email'} onValueChange={(v) => set('tipo_chave_pix', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_PIX.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input value={form.pix || ''} onChange={(e) => set('pix', e.target.value)} placeholder="Chave PIX" />
            </div>
            <div>
              <Label>Banco</Label>
              <Select value={form.banco || ''} onValueChange={(v) => set('banco', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{BANCOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>PIN (5 dígitos) *</Label>
              <Input value={form.pin || ''} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="00000" maxLength={5} inputMode="numeric" />
            </div>
            <div>
              <Label>Diária (override)</Label>
              <Input value={form.diaria ?? ''} onChange={(e) => set('diaria', e.target.value ? Number(e.target.value) : null)} placeholder="Auto" type="number" />
            </div>
            <div>
              <Label>Data de entrada</Label>
              <Input value={form.data_entrada || ''} onChange={(e) => set('data_entrada', e.target.value)} type="date" />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} placeholder="Notas internas..." rows={2} />
            </div>
          </div>
          {inviteError && <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">{inviteError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}