import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Autenticação com GCP
const credsPath = path.resolve(__dirname, '../credentials.json');
const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

const serviceAccountAuth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet('1NNXGHxCv6TrlChOdLuZfTAv3Zdbibmsi11hh2hNnOhQ', serviceAccountAuth);

// Cache simples para evitar bater no limite de API do Google nas requisições seguidas
let cachedData: any = null;
let lastFetch = 0;

async function fetchFromSheets() {
  if (cachedData && Date.now() - lastFetch < 5000) {
    return cachedData; // Cache de 5 segundos
  }
  
  await doc.loadInfo();
  
  const getRows = async (title: string) => {
    const sheet = Object.values(doc.sheetsById).find(s => s.title === title);
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(r => r.toObject());
  };

  const pedidos = await getRows('Pedidos');
  const ocorrencias = await getRows('Ocorrencias');
  const progresso = await getRows('Progresso_Diario');
  const metricas = await getRows('Metricas_Resumo');

  cachedData = { pedidos, ocorrencias, progresso, metricas };
  lastFetch = Date.now();
  return cachedData;
}

// Endpoint para puxar dashboard pelo ID do pedido
app.get('/api/dashboard/:pedidoId', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const data = await fetchFromSheets();
    
    // Filtrar tudo para o pedidoId
    const pedidoBase = data.pedidos.find((p: any) => p.PedidoID === pedidoId);
    
    if(!pedidoBase) return res.status(404).json({error: "Pedido não encontrado"});

    const responseData = {
      pedido: pedidoBase,
      metricas: data.metricas.filter((m: any) => m.PedidoID === pedidoId),
      progresso: data.progresso.filter((p: any) => p.PedidoID === pedidoId),
      ocorrencias: data.ocorrencias.filter((o: any) => o.PedidoID === pedidoId),
    };

    res.json(responseData);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao ler dados da planilha" });
  }
});

// Endpoint Público para o Cliente (Baseado no Token Criptografado)
app.get('/api/tracking/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const data = await fetchFromSheets();
    
    // Obscure route: We only find by TokenAcesso!
    const pedidoBase = data.pedidos.find((p: any) => p.TokenAcesso === token);
    
    if(!pedidoBase) return res.status(404).json({error: "Link de rastreio inválido ou expirado"});

    const pedidoId = pedidoBase.PedidoID;
    const responseData = {
      pedido: pedidoBase,
      metricas: data.metricas.filter((m: any) => m.PedidoID === pedidoId),
      progresso: data.progresso.filter((p: any) => p.PedidoID === pedidoId),
      ocorrencias: data.ocorrencias.filter((o: any) => o.PedidoID === pedidoId),
    };

    res.json(responseData);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Endpoint Admin: Atualizar Email do Cliente e Gerar Token
app.put('/api/admin/pedidos/:pedidoId', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { email } = req.body;
    
    await doc.loadInfo();
    const sheet = Object.values(doc.sheetsById).find(s => s.title === 'Pedidos');
    if (!sheet) return res.status(500).json({error: "Aba Pedidos não encontrada"});
    
    // Força a existência dos cabeçalhos na planilha
    await sheet.loadHeaderRow();
    if (!sheet.headerValues.includes('TokenAcesso')) {
        const newHeaders = [...sheet.headerValues];
        if (!newHeaders.includes('EmailCliente')) newHeaders.push('EmailCliente');
        newHeaders.push('TokenAcesso');
        await sheet.setHeaderRow(newHeaders);
    }
    
    const rows = await sheet.getRows();
    const targetRow = rows.find(r => r.get('PedidoID') === pedidoId);
    
    if (!targetRow) return res.status(404).json({error: "Pedido não encontrado na planilha"});
    
    let token = targetRow.get('TokenAcesso');
    if (!token) {
      token = randomUUID();
      targetRow.assign({ TokenAcesso: token });
    }
    
    // Suporta qualquer alteração vinda do Front
    const updates: any = {};
    if (email !== undefined) updates.EmailCliente = email;
    if (req.body.Coordenador !== undefined) updates.Coordenador = req.body.Coordenador;
    if (req.body.ResponsavelCampo !== undefined) updates.ResponsavelCampo = req.body.ResponsavelCampo;
    if (req.body.StatusPrazo !== undefined) updates.StatusPrazo = req.body.StatusPrazo;
    if (req.body.Percentual !== undefined) updates.Percentual = req.body.Percentual;
    
    if (Object.keys(updates).length > 0) {
       targetRow.assign(updates);
    }
    
    await targetRow.save();
    cachedData = null; // Força recarregar os dados novos após atualizar a planilha
    
    res.json({ success: true, token, baseData: targetRow.toObject() });
  } catch(e) {
    console.error(e);
    res.status(500).json({error: "Erro ao tentar atualizar o pedido."});
  }
});

// Endpoint Admin: Criar Pedido Novo
app.post('/api/admin/pedidos', async (req, res) => {
  try {
    const { PedidoID, Coordenador, ResponsavelCampo, Percentual, StatusPrazo } = req.body;
    await doc.loadInfo();
    const sheet = Object.values(doc.sheetsById).find(s => s.title === 'Pedidos');
    if (!sheet) return res.status(500).json({error: "Aba não encontrada"});
    
    await sheet.loadHeaderRow();
    
    const newRowData = {
      PedidoID,
      Coordenador: Coordenador || 'Pendente',
      ResponsavelCampo: ResponsavelCampo || 'Pendente',
      Percentual: Percentual || '0',
      StatusPrazo: StatusPrazo || 'Em andamento',
      DataRelatorio: new Date().toISOString().split('T')[0]
    };
    
    await sheet.addRow(newRowData);
    cachedData = null;
    res.json({ success: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({error: "Erro na inserção do pedido"});
  }
});

// Endpoint Admin: Deletar Pedido (Cascade)
app.delete('/api/admin/pedidos/:pedidoId', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    await doc.loadInfo();
    
    const sheetsToClear = ['Pedidos', 'Ocorrencias', 'Progresso_Diario', 'Metricas_Resumo'];
    
    for (const title of sheetsToClear) {
      const sheet = Object.values(doc.sheetsById).find(s => s.title === title);
      if(sheet) {
        const rows = await sheet.getRows();
        const toDelete = rows.filter(r => r.get('PedidoID') === pedidoId);
        
        // Deletamos individualmente
        for (const row of toDelete) {
          await row.delete();
        }
      }
    }
    
    cachedData = null;
    res.json({success: true, message: "Exclusão multi-planilhas concluída."});
  } catch(e) {
    console.error(e);
    res.status(500).json({error: "Falha catastrófica durante exclusão"});
  }
});

// Endpoint Genérico (Lista todos)
app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await fetchFromSheets());
  } catch(e) {
    res.status(500).json({ error: "Erro ao ler dados da planilha" });
  }
});

// Socket.io para tempo real (simulado aqui via polling a cada 10 segs, ou notificação do google-script)
io.on('connection', (socket) => {
  console.log('Frontend conectado no Socket:', socket.id);
  // Emissão inicial
  fetchFromSheets().then((d: any) => socket.emit('data_updated', d));
});

// Simulador: De tempos em tempos (ex: 20 segs), o servidor checa a planilha em busca de atualizações
setInterval(async () => {
    try {
        const oldDataStr = JSON.stringify(cachedData);
        cachedData = null; // força invalidação local
        const newData = await fetchFromSheets();
        
        if (oldDataStr !== JSON.stringify(newData) && oldDataStr !== "null") {
            console.log("Mudança detectada! Emitindo atualização para todos...");
            io.emit('data_updated', newData);
        }
    } catch(e) {}
}, 20000); 

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend inicializado na porta ${PORT}`);
});
