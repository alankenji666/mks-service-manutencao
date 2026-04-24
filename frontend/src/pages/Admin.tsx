import { useEffect, useState } from 'react';
import axios from 'axios';
import { Copy, Plus, AlertTriangle, X, Edit, Trash2 } from 'lucide-react';
import '../App.css';

export default function Admin() {
  const [data, setData] = useState<any>(null);
  const [emailsInputs, setEmailsInputs] = useState<Record<string, string>>({});

  // Modals state
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [activePedido, setActivePedido] = useState<any>(null);

  // Form states
  const [form, setForm] = useState({
    PedidoID: '', Coordenador: '', ResponsavelCampo: '', StatusPrazo: 'No Prazo', Percentual: '0'
  });

  const fetchDashboard = () => {
    axios.get('http://localhost:3001/api/dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCopyLink = async (pedido: any) => {
    let currentToken = pedido.TokenAcesso;
    const email = emailsInputs[pedido.PedidoID] || '';
    
    // Atualiza token ou email dinamicamente mantendo a estrutura antiga
    if (!currentToken || email) {
       try {
         const res = await axios.put(`http://localhost:3001/api/admin/pedidos/${pedido.PedidoID}`, {
            email: email === '' ? undefined : email
         });
         currentToken = res.data.token;
         fetchDashboard();
       } catch(e) {
          alert("Erro ao validar acesso na Planilha!");
          return;
       }
    }

    const trackingLink = `${window.location.origin}/tracking/${currentToken}`;
    navigator.clipboard.writeText(trackingLink);
    alert(`Link de Rastreio Copiado Seguro:\n${trackingLink}`);
  };

  const handleEmailChange = (pedidoId: string, value: string) => {
    setEmailsInputs(prev => ({...prev, [pedidoId]: value}));
  };

  // Funções CRUD Adicionais
  const openCreateModal = () => {
    setForm({ PedidoID: '', Coordenador: '', ResponsavelCampo: '', StatusPrazo: 'No Prazo', Percentual: '0' });
    setCreateModalOpen(true);
  };

  const openEditModal = (pedido: any) => {
    setActivePedido(pedido);
    setForm({
      PedidoID: pedido.PedidoID,
      Coordenador: pedido.Coordenador || '',
      ResponsavelCampo: pedido.ResponsavelCampo || '',
      StatusPrazo: pedido.StatusPrazo || 'Em andamento',
      Percentual: pedido.Percentual || '0'
    });
    setEditModalOpen(true);
  };

  const handleCreate = async () => {
    if(!form.PedidoID) return alert("O ID do Pedido é obrigatório!");
    try {
      await axios.post('http://localhost:3001/api/admin/pedidos', form);
      setCreateModalOpen(false);
      fetchDashboard();
    } catch(e) {
      alert("Erro ao criar pedido");
    }
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`http://localhost:3001/api/admin/pedidos/${activePedido.PedidoID}`, {
        Coordenador: form.Coordenador,
        ResponsavelCampo: form.ResponsavelCampo,
        StatusPrazo: form.StatusPrazo,
        Percentual: form.Percentual
      });
      setEditModalOpen(false);
      fetchDashboard();
    } catch(e) {
      alert("Erro ao atualizar pedido");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`http://localhost:3001/api/admin/pedidos/${activePedido.PedidoID}`);
      setDeleteAlertOpen(false);
      setEditModalOpen(false);
      fetchDashboard();
    } catch(e) {
      alert("Erro ao excluir. O banco pode não ter respondido.");
    }
  };

  if(!data) return <div style={{textAlign: 'center', marginTop: '50px'}}>Carregando Gerenciador de Serviços...</div>;

  return (
    <div className="dashboard-container">
      <div className="top-logo">
        <h1>MKS</h1>
        <span>Admin Panel ✓</span>
      </div>

      <div className="header-banner" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>Gerenciador de Serviços e Acessos</h2>
        <button 
          onClick={openCreateModal}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px',
            background: 'white', color: 'var(--mks-green)', fontWeight: 800, border: 'none', borderRadius: '4px', cursor: 'pointer'
        }}>
          <Plus size={20} /> Cadastrar Novo Pedido
        </button>
      </div>

      <div className="card">
        <table className="mks-table">
          <thead>
            <tr>
              <th>Pedido ID</th>
              <th>Status do Prazo</th>
              <th>Email do Cliente</th>
              <th>Ações Administrativas</th>
            </tr>
          </thead>
          <tbody>
            {data.pedidos.map((p: any, idx: number) => (
              <tr key={idx}>
                <td>
                  <span 
                    onClick={() => openEditModal(p)}
                    style={{color: 'var(--mks-green)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline'}}>
                    {p.PedidoID}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${p.StatusPrazo === 'No prazo' ? 'status-resolvido' : p.StatusPrazo === 'Atrasado' ? 'status-atrasado' : 'status-emandamento'}`}>
                    {p.StatusPrazo}
                  </span>
                  <br/>
                  <small>{(parseFloat(p.Percentual || 0)*100).toFixed(0)}% Pronto</small>
                </td>
                <td>
                  <input 
                    type="email" 
                    placeholder="cliente@empresa.com"
                    defaultValue={p.EmailCliente || ''}
                    onChange={(e) => handleEmailChange(p.PedidoID, e.target.value)}
                    style={{
                      padding: '8px', 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      width: '200px'
                    }}
                  />
                </td>
                <td style={{display: 'flex', gap: '10px'}}>
                  <button 
                    onClick={() => handleCopyLink(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px',
                      background: 'var(--mks-green)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}>
                    <Copy size={16} /> Link de Rastreio
                  </button>
                  <button 
                    onClick={() => openEditModal(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px',
                      background: '#334155', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}>
                    <Edit size={16} /> Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL CADASTRAR */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div className="modal-header">
               <h3>Cadastrar Novo Pedido</h3>
               <X className="close-icon" onClick={() => setCreateModalOpen(false)}/>
             </div>
             <div className="modal-body">
               <label>ID do Pedido (Ex: PED-2024-0800)</label>
               <input type="text" value={form.PedidoID} onChange={(e) => setForm({...form, PedidoID: e.target.value})} className="modal-input" />

               <label>Nome do Coordenador</label>
               <input type="text" value={form.Coordenador} onChange={(e) => setForm({...form, Coordenador: e.target.value})} className="modal-input" />
               
               <label>Responsável de Campo</label>
               <input type="text" value={form.ResponsavelCampo} onChange={(e) => setForm({...form, ResponsavelCampo: e.target.value})} className="modal-input" />

               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                  <div>
                    <label>Status Operacional</label>
                    <select value={form.StatusPrazo} onChange={(e) => setForm({...form, StatusPrazo: e.target.value})} className="modal-input">
                       <option value="No prazo">No prazo</option>
                       <option value="Em andamento">Em andamento</option>
                       <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                  <div>
                    <label>Progresso Inicial (%)</label>
                    <input type="number" step="0.01" max="1" placeholder="Ex: 0.10 para 10%" value={form.Percentual} onChange={(e) => setForm({...form, Percentual: e.target.value})} className="modal-input"/>
                  </div>
               </div>

             </div>
             <div className="modal-footer">
               <button className="btn-save" onClick={handleCreate}>Salvar Novo Pedido</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / EXCLUIR */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div className="modal-header">
               <h3>Gerenciamento: {activePedido?.PedidoID}</h3>
               <X className="close-icon" onClick={() => setEditModalOpen(false)}/>
             </div>
             {!isDeleteAlertOpen ? (
               <>
                  <div className="modal-body">
                     <label>Nome do Coordenador</label>
                     <input type="text" value={form.Coordenador} onChange={(e) => setForm({...form, Coordenador: e.target.value})} className="modal-input" />
                     
                     <label>Responsável de Campo</label>
                     <input type="text" value={form.ResponsavelCampo} onChange={(e) => setForm({...form, ResponsavelCampo: e.target.value})} className="modal-input" />

                     <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                        <div>
                          <label>Status Operacional</label>
                          <select value={form.StatusPrazo} onChange={(e) => setForm({...form, StatusPrazo: e.target.value})} className="modal-input">
                             <option value="No Prazo">No Prazo</option>
                             <option value="Em andamento">Em andamento</option>
                             <option value="Atrasado">Atrasado</option>
                          </select>
                        </div>
                        <div>
                          <label>Atualizar Progresso (%)</label>
                           <input type="number" step="0.01" max="1" placeholder="Ex: 0.85 para 85%" value={form.Percentual} onChange={(e) => setForm({...form, Percentual: e.target.value})} className="modal-input"/>
                        </div>
                     </div>
                  </div>
                  <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between'}}>
                    <button className="btn-delete" onClick={() => setDeleteAlertOpen(true)}><Trash2 size={16}/> APAGAR PEDIDO</button>
                    <button className="btn-save" onClick={handleUpdate}>ATUALIZAR DADOS</button>
                  </div>
               </>
             ) : (
               <div className="modal-body" style={{textAlign: 'center', padding: '30px 20px'}}>
                  <AlertTriangle size={64} color="#ef4444" style={{margin: '0 auto 20px'}}/>
                  <h3 style={{color: '#ef4444'}}>DELEÇÃO IRREVERSÍVEL (CASCATA)</h3>
                  <p style={{marginTop: '10px', fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5'}}>
                    Atenção Crítica: Você está prestes a excluir o pedido <strong>{activePedido?.PedidoID}</strong>.<br/>
                    Isso invocará o mecanismo de lixeira multi-abas que <strong>NUKARÁ PARA SEMPRE</strong> as propriedades deste serviço incluindo Progresso Diário, Métricas, Ocorrências e Cadastros.
                  </p>
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px'}}>
                     <button className="btn-cancel" onClick={() => setDeleteAlertOpen(false)}>Cancelar, Me tire daqui</button>
                     <button className="btn-delete-confirm" onClick={handleDelete}>Sim, Extinguir no Google Sheets</button>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

    </div>
  )
}
