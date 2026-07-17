import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { formatBRL, BANCOS } from '@/lib/donbaron';
import { CheckCircle2, Receipt } from 'lucide-react';

export default function PaymentDialog({ open, onClose, motoboy, valorLiquido, dias, detalhes }) {
  const [forma, setForma] = useState('pix');
  const [banco, setBanco] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handlePay = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('registrarPagamento', {
        motoboy_id: motoboy.id,
        forma,
        banco: forma === 'pix' ? banco : '',
        valor: valorLiquido,
        dias,
        valor_bruto: detalhes?.bruto ?? valorLiquido,
        desconto_consumo: detalhes?.consumoTotal ?? 0,
        consumo_ids: detalhes?.consumoPendenteIds ?? [],
        periodo_inicio: detalhes?.periodoInicio || '',
        periodo_fim: detalhes?.periodoFim || '',
      });
      setResult(res.data);
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setForma('pix');
    setBanco('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {result ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Pagamento Registrado</h3>
              <p className="text-sm text-muted-foreground mt-1">{motoboy.nome} • {formatBRL(valorLiquido)}</p>
            </div>
            <div className="bg-muted rounded-xl p-4 flex items-center gap-3 justify-center">
              <Receipt className="w-5 h-5 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Recibo</p>
                <p className="font-mono font-bold text-foreground">{result.recibo}</p>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pagamento — {motoboy.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-muted rounded-xl p-4 space-y-2">
                {detalhes?.periodoLabel && (
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide text-center pb-1 border-b border-border/40">
                    Semana {detalhes.periodoLabel}
                  </p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Diárias ({dias} dia{dias !== 1 ? 's' : ''})</span>
                  <span className="font-medium">{formatBRL(detalhes?.diarias ?? valorLiquido)}</span>
                </div>
                {(detalhes?.bonus ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bônus</span>
                    <span className="font-medium text-emerald-600">+{formatBRL(detalhes.bonus)}</span>
                  </div>
                )}
                {(detalhes?.descontos ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descontos</span>
                    <span className="font-medium text-red-500">−{formatBRL(detalhes.descontos)}</span>
                  </div>
                )}
                {(detalhes?.consumoTotal ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Consumo do mês</span>
                      <span className="font-medium text-orange-600">−{formatBRL(detalhes.consumoTotal)}</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto rounded-lg bg-background/60 border border-border/40 px-3 py-2 space-y-1">
                      {(detalhes.consumoItens || []).map((c) => (
                        <div key={c.id} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate pr-2">{c.quantidade}x {c.produto}</span>
                          <span className="shrink-0">{formatBRL(c.valor_total)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Valor final a pagar</span>
                  <span className="text-2xl font-bold text-foreground">{formatBRL(valorLiquido)}</span>
                </div>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {forma === 'pix' && (
                <div>
                  <Label>Banco</Label>
                  <Select value={banco} onValueChange={setBanco}>
                    <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                    <SelectContent>{BANCOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handlePay} disabled={saving || (forma === 'pix' && !banco)}>
                {saving ? 'Processando...' : '💰 Pagar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}