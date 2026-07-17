import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatBRL, formatDate, todayISO } from '@/lib/donbaron';
import { Utensils, Printer, X, PackageSearch, User, TrendingUp } from 'lucide-react';

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
};

export default function ConsumoMotoboy() {
  const [motoboys, setMotoboys] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [allConsumos, setAllConsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [motoboyId, setMotoboyId] = useState('');
  const [produtoMode, setProdutoMode] = useState('estoque'); // 'estoque' | 'manual'
  const [estoqueId, setEstoqueId] = useState('');
  const [produto, setProduto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnitario, setValorUnitario] = useState(0);
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  // Motoboy info
  const [motoboyInfo, setMotoboyInfo] = useState(null);

  const load = async () => {
    const [m, e, c] = await Promise.all([
      base44.entities.Motoboy.list('-nome', 200),
      base44.entities.Estoque.list('-nome', 200),
      base44.entities.ConsumoMotoboy.list('-data', 200),
    ]);
    setMotoboys(m.filter((x) => x.status === 'ativo'));
    setEstoque(e);
    setAllConsumos(c);
    setConsumos(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedMotoboy = motoboys.find((m) => m.id === motoboyId);
  const selectedEstoque = estoque.find((e) => e.id === estoqueId);

  // Auto-fill from estoque selection
  useEffect(() => {
    if (produtoMode === 'estoque' && selectedEstoque) {
      setProduto(selectedEstoque.nome);
      setCategoria(selectedEstoque.categoria || '');
      setValorUnitario(selectedEstoque.valor || 0);
    }
  }, [estoqueId, produtoMode]);

  // Load motoboy weekly info
  useEffect(() => {
    if (!selectedMotoboy) { setMotoboyInfo(null); return; }
    const fetchInfo = async () => {
      const week = getWeekRange();
      const [weekCheckIns, weekConsumos] = await Promise.all([
        base44.entities.CheckIn.filter({ motoboy_id: selectedMotoboy.id }, '-data', 100),
        base44.entities.ConsumoMotoboy.filter({ motoboy_id: selectedMotoboy.id }, '-data', 100),
      ]);
      const weekCI = weekCheckIns.filter((c) => c.data >= week.start && c.data <= week.end && c.status === 'sucesso');
      const weekCons = weekConsumos.filter((c) => c.data >= week.start && c.data <= week.end && c.status === 'ativo');
      const totalConsumido = weekCons.reduce((sum, c) => sum + (c.valor_total || 0), 0);
      const diaria = selectedMotoboy.diaria || 90;
      const diasTrabalhados = weekCI.length;
      const saldoPrevisto = (diasTrabalhados * diaria) - totalConsumido - (selectedMotoboy.descontos || 0) + (selectedMotoboy.bonus || 0);
      setMotoboyInfo({ diasTrabalhados, totalConsumido, saldoPrevisto, diaria });
    };
    fetchInfo();
  }, [motoboyId]);

  const valorTotal = useMemo(() => quantidade * valorUnitario, [quantidade, valorUnitario]);

  const handleSave = async () => {
    setError('');
    if (!motoboyId) { setError('Selecione o motoboy'); return; }
    if (!produto.trim()) { setError('Informe o produto'); return; }
    if (!quantidade || quantidade <= 0) { setError('Quantidade inválida'); return; }
    if (!valorUnitario || valorUnitario <= 0) { setError('Valor unitário inválido'); return; }

    setSaving(true);
    try {
      const res = await base44.functions.invoke('registrarConsumo', {
        motoboy_id: motoboyId,
        produto: produto.trim(),
        categoria,
        quantidade: Number(quantidade),
        valor_unitario: Number(valorUnitario),
        observacao,
        estoque_id: produtoMode === 'estoque' && estoqueId ? estoqueId : null,
      });
      if (res.data?.success) {
        imprimirRecibo(res.data.consumo);
        // Reset form
        setEstoqueId(''); setProduto(''); setCategoria(''); setQuantidade(1); setValorUnitario(0); setObservacao('');
        await load();
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const imprimirRecibo = (consumo) => {
    const w = window.open('', '', 'width=400,height=600');
    w.document.write(`
      <html><head><title>Pedido Motoboy</title>
      <style>
        * { font-family: 'Courier New', monospace; }
        body { padding: 20px; font-size: 14px; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .title { text-align: center; font-weight: bold; font-size: 18px; }
        .label { font-weight: bold; }
        .center { text-align: center; }
      </style></head><body>
        <div class="center">************************</div>
        <div class="title">PEDIDO MOTOBOY</div>
        <div class="center">************************</div>
        <hr>
        <p><span class="label">Motoboy</span><br>${consumo.motoboy_nome}</p>
        <p><span class="label">Produto</span><br>${consumo.produto}</p>
        <p><span class="label">Quantidade</span><br>${consumo.quantidade}</p>
        <p><span class="label">Valor</span><br>R$ ${(consumo.valor_total || 0).toFixed(2)}</p>
        <p><span class="label">Hora</span><br>${consumo.hora?.substring(0, 5) || ''}</p>
        <div class="center">************************</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const handleCancelar = async (consumo) => {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo || !motivo.trim()) return;
    try {
      await base44.functions.invoke('cancelarConsumo', { consumo_id: consumo.id, motivo });
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Utensils className="w-6 h-6 text-accent" />
          Consumo do Motoboy
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Registre consumos — o valor é descontado automaticamente na folha semanal</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="p-5 border-border/60 shadow-sm space-y-4">
          <h3 className="font-heading font-bold">Novo Consumo</h3>

          {/* Motoboy */}
          <div>
            <Label>Motoboy *</Label>
            <Select value={motoboyId} onValueChange={setMotoboyId}>
              <SelectTrigger><SelectValue placeholder="Selecione o motoboy..." /></SelectTrigger>
              <SelectContent>
                {motoboys.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Motoboy info */}
          {motoboyInfo && (
            <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Dias na semana</p>
                <p className="font-bold text-lg">{motoboyInfo.diasTrabalhados}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumido</p>
                <p className="font-bold text-lg text-red-600">{formatBRL(motoboyInfo.totalConsumido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo previsto</p>
                <p className="font-bold text-lg text-emerald-600">{formatBRL(motoboyInfo.saldoPrevisto)}</p>
              </div>
            </div>
          )}

          {/* Produto mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setProdutoMode('estoque')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${produtoMode === 'estoque' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <PackageSearch className="w-3.5 h-3.5 inline mr-1" /> Do Estoque
            </button>
            <button
              onClick={() => { setProdutoMode('manual'); setEstoqueId(''); }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${produtoMode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Digitar Manual
            </button>
          </div>

          {/* Produto */}
          {produtoMode === 'estoque' ? (
            <div>
              <Label>Produto do Estoque *</Label>
              <Select value={estoqueId} onValueChange={setEstoqueId}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                <SelectContent>
                  {estoque.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={e.quantidade <= 0}>
                      {e.nome} — {formatBRL(e.valor)} ({e.quantidade} {e.unidade || 'un'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto *</Label>
                <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Nome do produto" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria" />
              </div>
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Qtd *</Label>
              <Input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
            <div>
              <Label>Valor Unit. *</Label>
              <Input type="number" step="0.01" value={valorUnitario} onChange={(e) => setValorUnitario(Number(e.target.value))} disabled={produtoMode === 'estoque'} />
            </div>
            <div>
              <Label>Total</Label>
              <Input value={formatBRL(valorTotal)} readOnly className="font-bold bg-muted/40" />
            </div>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Opcional..." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Printer className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar e Imprimir'}
          </Button>
        </Card>

        {/* History */}
        <Card className="p-5 border-border/60 shadow-sm">
          <h3 className="font-heading font-bold mb-3">Histórico de Consumos</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {consumos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum consumo registrado.</p>
            ) : (
              consumos.map((c) => (
                <div key={c.id} className={`flex items-center justify-between border rounded-lg p-3 ${c.status === 'cancelado' ? 'bg-red-50/40 border-red-200/60 opacity-60' : 'border-border/60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{c.produto}</p>
                      {c.status === 'cancelado' && <Badge variant="outline" className="text-red-600 border-red-300">Cancelado</Badge>}
                      {c.estoque_baixado && c.status === 'ativo' && <Badge variant="outline" className="text-xs">Estoque</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.motoboy_nome} • {formatDate(c.data)} {c.hora?.substring(0, 5)} • {c.quantidade}x • {c.usuario}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${c.status === 'cancelado' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {formatBRL(c.valor_total)}
                    </span>
                    {c.status === 'ativo' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleCancelar(c)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}