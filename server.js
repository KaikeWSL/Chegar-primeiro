const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const upload = multer({
  dest: 'uploads/', // pasta local para salvar arquivos
  limits: { fileSize: 10 * 1024 * 1024 } // até 10MB por arquivo
});

const app = express();
app.use(cors({
  origin: ['https://chegar-primeiro.netlify.app', 'http://localhost:8888'],
  credentials: true
}));
app.options('*', cors());
app.use(bodyParser.json());

// Configuração do banco Neon (PostgreSQL) com conexão persistente
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_G43vPwgWaRkh@ep-empty-snow-acqkbuow-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  max: 20, // Máximo de conexões no pool
  min: 5, // Mínimo de conexões sempre ativas
  idleTimeoutMillis: 0, // 0 = nunca encerra conexões ociosas
  connectionTimeoutMillis: 60000, // 60 segundos para estabelecer conexão
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  statement_timeout: 0, // 0 = sem timeout para queries
  query_timeout: 0, // 0 = sem timeout para queries
  application_name: 'chegar_primeiro_api',
  // Configurações adicionais para manter conexão viva
  ssl: {
    rejectUnauthorized: false
  }
});

// Eventos de monitoramento do pool
pool.on('connect', (client) => {
  console.log(`[${new Date().toISOString()}] [INFO] Nova conexão estabelecida com o banco de dados`);
  
  // Configura o cliente para manter conexão viva
  client.query('SET statement_timeout = 0');
  client.query('SET idle_in_transaction_session_timeout = 0');
});

pool.on('acquire', (client) => {
  console.log(`[${new Date().toISOString()}] [INFO] Conexão adquirida do pool`);
});

pool.on('release', (client) => {
  console.log(`[${new Date().toISOString()}] [INFO] Conexão liberada para o pool`);
});

pool.on('error', (err, client) => {
  console.error(`[${new Date().toISOString()}] [ERROR] Erro no pool de conexões:`, err);
  // Não encerra o processo, apenas loga o erro
});

pool.on('remove', (client) => {
  console.log(`[${new Date().toISOString()}] [INFO] Conexão removida do pool`);
});

// Função para testar a conexão com o banco
async function testarConexao() {
  try {
    console.log(`[${new Date().toISOString()}] [INFO] Testando conexão com o banco de dados...`);
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    client.release();
    console.log(`[${new Date().toISOString()}] [INFO] Conexão com banco estabelecida com sucesso:`, result.rows[0]);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro ao conectar com o banco:`, err);
    // Tenta reconectar automaticamente
    setTimeout(testarConexao, 5000);
    return false;
  }
}

// Função para executar queries com retry automático e reconexão
async function executarQuery(query, params = [], tentativas = 5) {
  for (let i = 0; i < tentativas; i++) {
    try {
      console.log(`[${new Date().toISOString()}] [INFO] Executando query (tentativa ${i + 1}/${tentativas}):`, query.substring(0, 100) + '...');
      const result = await pool.query(query, params);
      console.log(`[${new Date().toISOString()}] [INFO] Query executada com sucesso. Linhas afetadas: ${result.rowCount}`);
      return result;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [ERROR] Erro na query (tentativa ${i + 1}/${tentativas}):`, err.message);
      
      // Se é erro de conexão, tenta reconectar
      if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        console.log(`[${new Date().toISOString()}] [INFO] Erro de conexão detectado, tentando reconectar...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }
      
      if (i === tentativas - 1) throw err;
      // Aguarda um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Função para manter conexões ativas
async function manterConexoesAtivas() {
  try {
    console.log(`[${new Date().toISOString()}] [INFO] Executando query de manutenção para manter conexões ativas...`);
    await executarQuery('SELECT 1 as heartbeat');
    console.log(`[${new Date().toISOString()}] [INFO] Heartbeat executado com sucesso`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no heartbeat:`, err);
  }
}

// Teste inicial da conexão
testarConexao();

// Monitoramento periódico da conexão (a cada 30 segundos)
setInterval(async () => {
  console.log(`[${new Date().toISOString()}] [INFO] Verificação periódica da conexão...`);
  await testarConexao();
}, 30000);

// Heartbeat para manter conexões ativas (a cada 10 segundos)
setInterval(manterConexoesAtivas, 10000);

// Armazenamento temporário dos códigos de verificação (em memória)
const codigosVerificacao = {};

// Configuração do transporter (ajuste para seu provedor de e-mail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log(`[${new Date().toISOString()}] [INFO] Configuração do transporter de e-mail concluída`);

async function salvarCadastroNoBanco(dados) {
  console.log(`[${new Date().toISOString()}] [INFO] Salvando cadastro no banco:`, { nome: dados.nome, cpf: dados.cpf?.substring(0, 3) + '***' });
  try {
    await executarQuery(
      'INSERT INTO cadastros (nome, cpf, cep, apartamento, bloco) VALUES ($1, $2, $3, $4, $5)',
      [dados.nome, dados.cpf, dados.cep, dados.apartamento, dados.bloco]
    );
    console.log(`[${new Date().toISOString()}] [INFO] Cadastro salvo com sucesso`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro ao salvar cadastro:`, err);
    throw err;
  }
}

// Função para gerar protocolo único com ano, mês, dia, hora, minuto e segundo
function gerarProtocolo() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const protocolo = (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
  console.log(`[${new Date().toISOString()}] [INFO] Protocolo gerado: ${protocolo}`);
  return protocolo;
}

// Função para inserir solicitação genérica
async function salvarSolicitacao(dados) {
  console.log(`[${new Date().toISOString()}] [INFO] Iniciando salvamento de solicitação:`, { tipo: dados.tipo, cpf: dados.cpf?.substring(0, 3) + '***' });
  
  let senhaHash = null;
  if (dados.tipo === 'novo_cliente' && dados.senha) {
    console.log(`[${new Date().toISOString()}] [INFO] Gerando hash da senha para novo cliente`);
    senhaHash = await bcrypt.hash(dados.senha, 10);
  }
  
  // Se for novo cliente, verifica duplicidade antes de inserir na tabela clientes
  if (dados.tipo === 'novo_cliente') {
    console.log(`[${new Date().toISOString()}] [INFO] Verificando duplicidade para novo cliente`);
    try {
      const existe = await executarQuery(
        'SELECT 1 FROM clientes WHERE cpf = $1 OR email = $2',
        [dados.cpf, dados.email]
      );
      if (existe.rows.length > 0) {
        console.log(`[${new Date().toISOString()}] [WARN] Cliente já existe no banco`);
        return { jaExiste: true };
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [ERROR] Erro ao verificar duplicidade:`, err);
      throw err;
    }
  }
  
  // Gera protocolo único
  const protocolo = gerarProtocolo();
  
  // Insere na tabela solicitacoes
  console.log(`[${new Date().toISOString()}] [INFO] Inserindo solicitação na tabela solicitacoes`);
  try {
    const result = await executarQuery(
      `INSERT INTO solicitacoes
        (tipo, nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, servico_atual, novo_servico, telefone, melhor_horario, descricao, data_registro, status, protocolo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15,$16) RETURNING id`,
      [
        dados.tipo,
        dados.nome_cliente || null,
        dados.cpf || null,
        dados.cep || null,
        dados.email || null,
        dados.endereco || null,
        dados.apartamento || null,
        dados.bloco || null,
        dados.nome_empreendimento || null,
        dados.servico_atual || null,
        dados.novo_servico || null,
        dados.telefone || null,
        dados.melhor_horario || null,
        dados.descricao || null,
        'Em análise',
        protocolo
      ]
    );
    console.log(`[${new Date().toISOString()}] [INFO] Solicitação inserida com ID: ${result.rows[0].id}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro ao inserir solicitação:`, err);
    throw err;
  }
  
  // Se for novo cliente, insere também na tabela clientes
  if (dados.tipo === 'novo_cliente') {
    console.log(`[${new Date().toISOString()}] [INFO] Inserindo cliente na tabela clientes`);
    try {
      const clienteResult = await executarQuery(
        `INSERT INTO clientes
          (nome, cpf, cep, email, endereco, numero, complemento, bairro, cidade, estado, apartamento, bloco, empreendimento, telefone, celular, senha_hash, fingerprint)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          dados.nome_cliente || null,
          dados.cpf || null,
          dados.cep || null,
          dados.email || null,
          dados.endereco || null,
          dados.numero || null,
          dados.complemento || null,
          dados.bairro || null,
          dados.cidade || null,
          dados.estado || null,
          dados.apartamento || null,
          dados.bloco || null,
          dados.nome_empreendimento || null,
          dados.telefone || null,
          dados.celular || null,
          senhaHash,
          dados.fingerprint || null
        ]
      );
      const clienteId = clienteResult.rows[0].id;
      console.log(`[${new Date().toISOString()}] [INFO] Cliente inserido na tabela clientes com sucesso, ID: ${clienteId}`);
      
      // Associar cliente ao serviço se foi fornecido
      if (dados.servico || dados.novo_servico) {
        const servicoNome = dados.servico || dados.novo_servico;
        console.log(`[${new Date().toISOString()}] [INFO] Associando cliente ao serviço: ${servicoNome}`);
        
        try {
          // Buscar o ID do serviço pelo nome
          const servicoResult = await executarQuery(
            `SELECT id FROM servicos WHERE nome = $1 LIMIT 1`,
            [servicoNome]
          );
          
          if (servicoResult.rows.length > 0) {
            const servicoId = servicoResult.rows[0].id;
            
            // Inserir na tabela cliente_servicos
            await executarQuery(
              `INSERT INTO cliente_servicos (cliente_id, servico_id) VALUES ($1, $2)`,
              [clienteId, servicoId]
            );
            console.log(`[${new Date().toISOString()}] [INFO] Associação cliente-serviço criada com sucesso`);
          } else {
            console.warn(`[${new Date().toISOString()}] [WARN] Serviço não encontrado: ${servicoNome}`);
          }
        } catch (err) {
          console.error(`[${new Date().toISOString()}] [ERROR] Erro ao associar cliente ao serviço:`, err);
        }
      }
      
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [ERROR] Erro ao inserir cliente:`, err);
      throw err;
    }
  }
  
  // Envia o protocolo por e-mail, se houver e-mail
  if (dados.email) {
    console.log(`[${new Date().toISOString()}] [INFO] Enviando protocolo por e-mail para: ${dados.email}`);
    try {
      await transporter.sendMail({
        from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
        to: dados.email,
        subject: 'Protocolo da sua solicitação',
        text: `Sua solicitação foi registrada com sucesso!\nProtocolo: ${protocolo}`,
        html: `<p>Sua solicitação foi registrada com sucesso!<br>Protocolo: <b>${protocolo}</b></p>`
      });
      console.log(`[${new Date().toISOString()}] [INFO] E-mail de protocolo enviado com sucesso`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [ERROR] Erro ao enviar e-mail de protocolo:`, err.message);
    }
  }
  
  console.log(`[${new Date().toISOString()}] [INFO] Solicitação salva com sucesso. Protocolo: ${protocolo}`);
  return protocolo;
}

// Função para buscar cliente (novo_cliente) por CPF
async function buscarClientePorCPF(cpf) {
  console.log(`[${new Date().toISOString()}] [INFO] Buscando cliente por CPF: ${cpf.substring(0, 3)}***`);
  try {
    const result = await executarQuery(
      'SELECT * FROM solicitacoes WHERE cpf = $1 AND tipo = $2',
      [cpf, 'novo_cliente']
    );
    if (result.rows.length > 0) {
      console.log(`[${new Date().toISOString()}] [INFO] Cliente encontrado`);
    } else {
      console.log(`[${new Date().toISOString()}] [INFO] Cliente não encontrado`);
    }
    return result.rows[0];
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro ao buscar cliente:`, err);
    throw err;
  }
}

// Rota única para inserir qualquer solicitação
app.post('/api/solicitacoes', async (req, res) => {
  console.log(`[${new Date().toISOString()}] [INFO] POST /api/solicitacoes - Iniciando processamento`);
  try {
    const resultado = await salvarSolicitacao(req.body);
    if (resultado && resultado.jaExiste) {
      console.log(`[${new Date().toISOString()}] [INFO] Retornando erro: cliente já existe`);
      return res.status(200).json({ success: false, motivo: 'ja_existe' });
    }
    console.log(`[${new Date().toISOString()}] [INFO] Solicitação processada com sucesso`);
    res.status(200).json({ success: true, protocolo: resultado });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no endpoint /api/solicitacoes:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para buscar cliente por CPF (apenas novo_cliente)
app.get('/api/clientes/:cpf', async (req, res) => {
  console.log(`[${new Date().toISOString()}] [INFO] GET /api/clientes/${req.params.cpf.substring(0, 3)}*** - Iniciando busca`);
  try {
    const cliente = await buscarClientePorCPF(req.params.cpf);
    if (cliente) {
      console.log(`[${new Date().toISOString()}] [INFO] Cliente encontrado e retornado`);
      res.status(200).json({ success: true, cliente });
    } else {
      console.log(`[${new Date().toISOString()}] [INFO] Cliente não encontrado`);
      res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no endpoint /api/clientes:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de debug para verificar se cliente existe (sem informações sensíveis)
app.get('/api/debug/cliente-existe/:cpf', async (req, res) => {
  const { cpf } = req.params;
  console.log(`[${new Date().toISOString()}] [DEBUG] Verificando se cliente existe: ${cpf?.substring(0, 3)}***`);
  
  try {
    const result = await executarQuery('SELECT cpf, nome, email, id, created_at, senha_hash IS NOT NULL as tem_senha FROM clientes WHERE cpf = $1', [cpf]);
    
    if (result.rows.length === 0) {
      return res.json({ existe: false, cpf: cpf?.substring(0, 3) + '***' });
    }
    
    const cliente = result.rows[0];
    return res.json({ 
      existe: true, 
      nome: cliente.nome,
      email: cliente.email,
      id: cliente.id,
      cpf: cliente.cpf?.substring(0, 3) + '***',
      tem_senha: cliente.tem_senha,
      created_at: cliente.created_at
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no debug:`, err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Endpoint de login de cliente
app.post('/api/login', async (req, res) => {
  const { cpf, senha } = req.body;
  console.log(`[${new Date().toISOString()}] [INFO] POST /api/login - Tentativa de login para CPF: ${cpf?.substring(0, 3)}***`);
  console.log(`[${new Date().toISOString()}] [DEBUG] Dados recebidos:`, { 
    cpf, 
    cpfLength: cpf?.length, 
    senhaLength: senha?.length,
    bodyKeys: Object.keys(req.body)
  });
  
  // Validações básicas
  if (!cpf || !senha) {
    console.log(`[${new Date().toISOString()}] [WARN] Login falhou: CPF ou senha não fornecidos`);
    return res.status(400).json({ success: false, error: 'CPF e senha são obrigatórios' });
  }
  
  try {
    // Primeiro, vamos ver a estrutura exata do que temos no banco
    console.log(`[${new Date().toISOString()}] [DEBUG] Executando query para buscar cliente...`);
    const result = await executarQuery('SELECT * FROM clientes WHERE cpf = $1', [cpf]);
    console.log(`[${new Date().toISOString()}] [INFO] Query executada, resultados encontrados: ${result.rows.length}`);
    
    if (result.rows.length === 0) {
      console.log(`[${new Date().toISOString()}] [WARN] Login falhou: CPF não encontrado no banco`);
      return res.status(401).json({ success: false, error: 'CPF não encontrado. Verifique se você já fez o cadastro.' });
    }
    
    const cliente = result.rows[0];
    
    // Log detalhado dos campos disponíveis (sem expor senhas)
    const camposCliente = Object.keys(cliente);
    console.log(`[${new Date().toISOString()}] [INFO] Campos disponíveis no cliente:`, camposCliente);
    console.log(`[${new Date().toISOString()}] [INFO] Cliente encontrado:`, {
      id: cliente.id,
      nome: cliente.nome,
      cpf: cliente.cpf?.substring(0, 3) + '***',
      email: cliente.email,
      temSenha: !!(cliente.senha_hash || cliente.senha),
      temSenhaHash: !!cliente.senha_hash,
      temSenhaSimples: !!cliente.senha
    });
    
    // Verificar se o cliente tem senha cadastrada (verificar ambos os campos possíveis)
    const senhaHash = cliente.senha_hash || cliente.senha;
    if (!senhaHash) {
      console.log(`[${new Date().toISOString()}] [WARN] Login falhou: cliente sem senha cadastrada`);
      return res.status(401).json({ 
        success: false, 
        error: 'Senha não cadastrada. Entre em contato com o suporte.' 
      });
    }
    
    console.log(`[${new Date().toISOString()}] [INFO] Verificando senha... (hash length: ${senhaHash.length})`);
    
    // Verificar se parece um hash bcrypt válido
    if (!senhaHash.startsWith('$2b$') && !senhaHash.startsWith('$2a$') && !senhaHash.startsWith('$2y$')) {
      console.log(`[${new Date().toISOString()}] [WARN] Senha não parece ser um hash bcrypt válido: ${senhaHash.substring(0, 10)}...`);
      return res.status(401).json({ 
        success: false, 
        error: 'Senha em formato inválido. Entre em contato com o suporte.' 
      });
    }
    
    const senhaOk = await bcrypt.compare(senha, senhaHash);
    console.log(`[${new Date().toISOString()}] [DEBUG] Resultado da comparação de senha: ${senhaOk}`);
    
    if (!senhaOk) {
      console.log(`[${new Date().toISOString()}] [WARN] Login falhou: senha incorreta para CPF ${cpf?.substring(0, 3)}***`);
      return res.status(401).json({ success: false, error: 'Senha incorreta. Verifique sua senha e tente novamente.' });
    }
    
    // Remover senhas do objeto antes de retornar
    const clienteSeguro = { ...cliente };
    delete clienteSeguro.senha;
    delete clienteSeguro.senha_hash;
    
    console.log(`[${new Date().toISOString()}] [INFO] Login realizado com sucesso para cliente: ${clienteSeguro.nome}`);
    res.status(200).json({ success: true, cliente: clienteSeguro });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no endpoint /api/login:`, err);
    res.status(500).json({ success: false, error: 'Erro interno do servidor. Tente novamente.' });
  }
});

// Novo endpoint para buscar dados completos do cliente por CPF
app.get('/api/cliente-completo/:cpf', async (req, res) => {
  console.log(`[${new Date().toISOString()}] [INFO] GET /api/cliente-completo/${req.params.cpf.substring(0, 3)}*** - Iniciando busca`);
  try {
    const result = await executarQuery('SELECT * FROM clientes WHERE cpf = $1', [req.params.cpf]);
    if (result.rows.length === 0) {
      console.log(`[${new Date().toISOString()}] [INFO] Cliente completo não encontrado`);
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    const cliente = result.rows[0];
    delete cliente.senha;
    console.log(`[${new Date().toISOString()}] [INFO] Cliente completo encontrado e retornado`);
    res.status(200).json({ success: true, cliente });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no endpoint /api/cliente-completo:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Novo endpoint para buscar solicitação por protocolo
app.get('/api/solicitacao/:protocolo', async (req, res) => {
  console.log(`[${new Date().toISOString()}] [INFO] GET /api/solicitacao/${req.params.protocolo} - Iniciando busca`);
  try {
    const result = await executarQuery('SELECT * FROM solicitacoes WHERE protocolo = $1', [req.params.protocolo]);
    if (result.rows.length === 0) {
      console.log(`[${new Date().toISOString()}] [INFO] Solicitação não encontrada`);
      return res.status(404).json({ success: false, error: 'Solicitação não encontrada' });
    }
    const solicitacao = result.rows[0];
    console.log(`[${new Date().toISOString()}] [INFO] Solicitação encontrada e retornada`);
    res.status(200).json({ success: true, solicitacao });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro no endpoint /api/solicitacao:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para enviar código de verificação
app.post('/api/enviar-codigo-email', async (req, res) => {
  const { email } = req.body;
  console.log(`[${new Date().toISOString()}] [INFO] POST /api/enviar-codigo-email - Enviando código para: ${email}`);
  
  if (!email) {
    console.log(`[${new Date().toISOString()}] [WARN] E-mail não informado`);
    return res.status(400).json({ success: false, error: 'E-mail não informado' });
  }
  
  // Gera código de 6 dígitos
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  codigosVerificacao[email] = codigo;
  console.log(`[${new Date().toISOString()}] [INFO] Código de verificação gerado para ${email}`);
  
  // Envia o e-mail
  try {
    await transporter.sendMail({
      from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de verificação',
      text: `Seu código de verificação é: ${codigo}`,
      html: `<p>Seu código de verificação é: <b>${codigo}</b></p>`
    });
    console.log(`[${new Date().toISOString()}] [INFO] Código de verificação enviado com sucesso para ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [ERROR] Erro ao enviar código de verificação:`, err);
    res.status(500).json({ success: false, error: 'Erro ao enviar e-mail' });
  }
});

// Endpoint para validar código de verificação
app.post('/api/validar-codigo-email', (req, res) => {
  const { email, codigo } = req.body;
  console.log(`[${new Date().toISOString()}] [INFO] POST /api/validar-codigo-email - Validando código para: ${email}`);
  
  if (!email || !codigo) {
    console.log(`[${new Date().toISOString()}] [WARN] Dados incompletos para validação`);
    return res.status(400).json({ success: false, error: 'Dados incompletos' });
  }
  
  if (codigosVerificacao[email] && codigosVerificacao[email] === codigo) {
    delete codigosVerificacao[email];
    console.log(`[${new Date().toISOString()}] [INFO] Código validado com sucesso para ${email}`);
    return res.json({ success: true });
  }
  
  console.log(`[${new Date().toISOString()}] [WARN] Código inválido para ${email}`);
  res.json({ success: false, error: 'Código inválido' });
});

// --- Recuperação de senha ---

// Endpoint para buscar e-mail mascarado por CPF
app.post('/api/recuperar-email', async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) return res.status(400).json({ success: false, error: 'CPF não informado' });
  try {
    const result = await executarQuery('SELECT email FROM clientes WHERE cpf = $1', [cpf]);
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(404).json({ success: false, error: 'E-mail não encontrado para este CPF' });
    }
    const email = result.rows[0].email;
    // Mascara o e-mail (ex: kaike*********@gmail.com)
    const [user, domain] = email.split('@');
    const maskedUser = user.length <= 2 ? user[0] + '***' : user.substring(0, 2) + '*'.repeat(user.length - 2);
    const maskedEmail = maskedUser + '@' + domain;
    res.json({ success: true, email: maskedEmail, realEmail: email }); // realEmail só para uso interno do próximo endpoint
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para enviar código de verificação para o e-mail do cliente (recuperação de senha)
const codigosRecuperacaoSenha = {};
app.post('/api/enviar-codigo-recuperacao', async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) return res.status(400).json({ success: false, error: 'CPF não informado' });
  try {
    const result = await executarQuery('SELECT email FROM clientes WHERE cpf = $1', [cpf]);
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(404).json({ success: false, error: 'E-mail não encontrado para este CPF' });
    }
    const email = result.rows[0].email;
    // Gera código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacaoSenha[cpf] = { codigo, email, criadoEm: Date.now() };
    await transporter.sendMail({
      from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de recuperação de senha',
      text: `Seu código de recuperação de senha é: ${codigo}`,
      html: `<p>Seu código de recuperação de senha é: <b>${codigo}</b></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para validar código e trocar senha
app.post('/api/trocar-senha', async (req, res) => {
  const { cpf, codigo, novaSenha } = req.body;
  if (!cpf || !codigo || !novaSenha) {
    return res.status(400).json({ success: false, error: 'Dados incompletos' });
  }
  const registro = codigosRecuperacaoSenha[cpf];
  if (!registro || registro.codigo !== codigo) {
    return res.status(400).json({ success: false, error: 'Código inválido' });
  }
  // Código válido, troca a senha
  try {
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await executarQuery('UPDATE clientes SET senha = $1 WHERE cpf = $2', [senhaHash, cpf]);
    delete codigosRecuperacaoSenha[cpf];
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Recuperação de senha para síndico ---
const codigosRecuperacaoSenhaSindico = {};

// Endpoint para buscar e-mail mascarado por documento
app.post('/api/recuperar-email-sindico', async (req, res) => {
  const { documento } = req.body;
  if (!documento) return res.status(400).json({ success: false, error: 'Documento não informado' });
  try {
    const result = await executarQuery('SELECT email FROM sindico WHERE documento = $1', [documento]);
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(404).json({ success: false, error: 'E-mail não encontrado para este documento' });
    }
    const email = result.rows[0].email;
    // Mascara o e-mail (ex: si****@gmail.com)
    const [user, domain] = email.split('@');
    const maskedUser = user.length <= 2 ? user[0] + '***' : user.substring(0, 2) + '*'.repeat(user.length - 2);
    const maskedEmail = maskedUser + '@' + domain;
    res.json({ success: true, email: maskedEmail, realEmail: email });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para enviar código de verificação para o e-mail do síndico
app.post('/api/enviar-codigo-recuperacao-sindico', async (req, res) => {
  const { documento } = req.body;
  if (!documento) return res.status(400).json({ success: false, error: 'Documento não informado' });
  try {
    const result = await executarQuery('SELECT email FROM sindico WHERE documento = $1', [documento]);
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(404).json({ success: false, error: 'E-mail não encontrado para este documento' });
    }
    const email = result.rows[0].email;
    // Gera código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacaoSenhaSindico[documento] = { codigo, email, criadoEm: Date.now() };
    await transporter.sendMail({
      from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de recuperação de senha',
      text: `Seu código de recuperação de senha é: ${codigo}`,
      html: `<p>Seu código de recuperação de senha é: <b>${codigo}</b></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para validar código e trocar senha do síndico
app.post('/api/trocar-senha-sindico', async (req, res) => {
  const { documento, codigo, novaSenha } = req.body;
  if (!documento || !codigo || !novaSenha) {
    return res.status(400).json({ success: false, error: 'Dados incompletos' });
  }
  const registro = codigosRecuperacaoSenhaSindico[documento];
  if (!registro || registro.codigo !== codigo) {
    return res.status(400).json({ success: false, error: 'Código inválido' });
  }
  // Código válido, troca a senha
  try {
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await executarQuery('UPDATE sindico SET senha = $1 WHERE documento = $2', [senhaHash, documento]);
    delete codigosRecuperacaoSenhaSindico[documento];
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para cadastro de empreendimento (síndico)
app.post('/api/empreendimento', async (req, res) => {
  const {
    empresa_responsavel,
    cnpj_empresa,
    email_responsavel_empresa,
    telefone_responsavel_empresa,
    nome_empreendimento,
    qtd_torres,
    qtd_aptos_por_andar,
    qtd_aptos_total,
    nome_sindico,
    email_sindico,
    telefone_sindico,
    data_entrega,
    existe_rede_operadora,
    qual_operadora
  } = req.body;

  // Validação simples
  if (!empresa_responsavel || !cnpj_empresa || !email_responsavel_empresa || !telefone_responsavel_empresa ||
      !nome_empreendimento || !qtd_torres || !qtd_aptos_por_andar || !qtd_aptos_total ||
      !nome_sindico || !email_sindico || !telefone_sindico || !data_entrega || typeof existe_rede_operadora === 'undefined') {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
  }

  try {
    await executarQuery(
      `INSERT INTO Empreendimento (
        empresa_responsavel, cnpj_empresa, email_responsavel_empresa, telefone_responsavel_empresa,
        nome_empreendimento, qtd_torres, qtd_aptos_por_andar, qtd_aptos_total,
        nome_sindico, email_sindico, telefone_sindico, data_entrega, existe_rede_operadora, qual_operadora
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        empresa_responsavel,
        cnpj_empresa,
        email_responsavel_empresa,
        telefone_responsavel_empresa,
        nome_empreendimento,
        qtd_torres,
        qtd_aptos_por_andar,
        qtd_aptos_total,
        nome_sindico,
        email_sindico,
        telefone_sindico,
        data_entrega,
        !!existe_rede_operadora,
        qual_operadora || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] Falha ao salvar empreendimento:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar empreendimento' });
  }
});

// Endpoint para cadastro de empreendimento da construtora
app.post('/api/empreendimento-construtora', upload.fields([
  { name: 'memorial_descritivo', maxCount: 1 },
  { name: 'projeto_telefonia', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      construtora_responsavel,
      nome_empreendimento,
      cep,
      endereco,
      numero,
      qtd_torres,
      qtd_aptos_por_andar,
      qtd_aptos_total,
      data_inicio_obra,
      data_fim_obra,
      engenheiro_responsavel,
      telefone_responsavel,
      email_responsavel,
      endereco_stand,
      data_inicio_vendas,
      data_fim_vendas,
      nome_responsavel_stand,
      telefone_responsavel_stand,
      email_responsavel_stand
    } = req.body;

    // Caminhos dos arquivos salvos
    const memorialDescritivoBuffer = req.files['memorial_descritivo'] ? require('fs').readFileSync(req.files['memorial_descritivo'][0].path) : null;
    const projetoTelefoniaBuffer = req.files['projeto_telefonia'] ? require('fs').readFileSync(req.files['projeto_telefonia'][0].path) : null;

    // Validação simples
    if (!construtora_responsavel || !nome_empreendimento || !cep || !endereco || !numero ||
        !qtd_torres || !qtd_aptos_por_andar || !qtd_aptos_total || !data_inicio_obra || !data_fim_obra ||
        !engenheiro_responsavel || !telefone_responsavel || !email_responsavel ||
        !memorialDescritivoPath || !projetoTelefoniaPath ||
        !endereco_stand || !data_inicio_vendas || !data_fim_vendas ||
        !nome_responsavel_stand || !telefone_responsavel_stand || !email_responsavel_stand) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
    }

    await executarQuery(
      `INSERT INTO Construtora (
        construtora_responsavel, nome_empreendimento, cep, endereco, numero,
        qtd_torres, qtd_aptos_por_andar, qtd_aptos_total, data_inicio_obra, data_fim_obra,
        engenheiro_responsavel, telefone_responsavel, email_responsavel,
        memorial_descritivo, projeto_telefonia,
        endereco_stand, data_inicio_vendas, data_fim_vendas,
        nome_responsavel_stand, telefone_responsavel_stand, email_responsavel_stand
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        construtora_responsavel,
        nome_empreendimento,
        cep,
        endereco,
        numero,
        qtd_torres,
        qtd_aptos_por_andar,
        qtd_aptos_total,
        data_inicio_obra,
        data_fim_obra,
        engenheiro_responsavel,
        telefone_responsavel,
        email_responsavel,
        memorialDescritivoBuffer,
        projetoTelefoniaBuffer,
        endereco_stand,
        data_inicio_vendas,
        data_fim_vendas,
        nome_responsavel_stand,
        telefone_responsavel_stand,
        email_responsavel_stand
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] Falha ao salvar empreendimento construtora:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar empreendimento' });
  }
});

// === Cadastro de Construtora ===
app.post('/api/construtora', async (req, res) => {
  const { nome, cnpj, senha } = req.body;
  if (!nome || !cnpj || !senha) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
  }
  try {
    // Verifica duplicidade de CNPJ
    const existe = await executarQuery('SELECT 1 FROM construtoras WHERE cnpj = $1', [cnpj]);
    if (existe.rows.length > 0) {
      return res.status(200).json({ success: false, error: 'Já existe cadastro com este CNPJ.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    await executarQuery(
      'INSERT INTO construtoras (nome, cnpj, senha) VALUES ($1, $2, $3)',
      [nome, cnpj, senhaHash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] Falha ao cadastrar construtora:', err);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar construtora' });
  }
});

// Endpoint para cadastro de síndico
app.post('/api/sindico', async (req, res) => {
  const { nome, documento, email, telefone, empreendimentos, senha } = req.body;
  if (!nome || !documento || !email || !telefone || !empreendimentos || !senha) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
  }
  try {
    // Verifica duplicidade
    const existe = await executarQuery('SELECT 1 FROM sindico WHERE documento = $1 OR email = $2', [documento, email]);
    if (existe.rows.length > 0) {
      return res.status(200).json({ success: false, error: 'Já existe cadastro com este documento ou email.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    await executarQuery(
      'INSERT INTO sindico (nome, documento, email, telefone, empreendimentos, senha) VALUES ($1, $2, $3, $4, $5, $6)',
      [nome, documento, email, telefone, JSON.stringify(empreendimentos), senhaHash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] Falha ao cadastrar síndico:', err);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar síndico' });
  }
});

// Endpoint de login de síndico
app.post('/api/sindico-login', async (req, res) => {
  const { documento, senha } = req.body;
  if (!documento || !senha) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
  }
  try {
    const result = await executarQuery('SELECT * FROM sindico WHERE documento = $1', [documento]);
    if (result.rows.length === 0) {
      return res.status(200).json({ success: false, error: 'Documento ou senha inválidos' });
    }
    const sindico = result.rows[0];
    const senhaOk = await bcrypt.compare(senha, sindico.senha);
    if (!senhaOk) {
      return res.status(200).json({ success: false, error: 'Documento ou senha inválidos' });
    }
    // Remove a senha antes de retornar
    delete sindico.senha;
    res.json({ success: true, sindico });
  } catch (err) {
    console.error('[ERRO] Falha no login de síndico:', err);
    res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

// Endpoint de health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await executarQuery('SELECT NOW() as timestamp');
    res.json({ 
      success: true, 
      timestamp: result.rows[0].timestamp,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Middleware para capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] [ERROR] Unhandled Rejection at:`, promise, 'reason:', reason);
  // Não encerra o processo, apenas loga
});

process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] [ERROR] Uncaught Exception:`, error);
  // Não encerra o processo, apenas loga
});

// Removido o graceful shutdown para manter a aplicação sempre rodando
// Os handlers de SIGTERM e SIGINT foram removidos

// Configuração para manter o processo vivo
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] [INFO] Recebido SIGTERM, mas mantendo aplicação rodando...`);
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] [INFO] Recebido SIGINT, mas mantendo aplicação rodando...`);
});

// Restart automático em caso de erro crítico
process.on('exit', (code) => {
  console.log(`[${new Date().toISOString()}] [INFO] Processo terminando com código: ${code}`);
});

app.listen(3000, () => {
  console.log(`[${new Date().toISOString()}] [INFO] Servidor rodando na porta 3000`);
  console.log(`[${new Date().toISOString()}] [INFO] Configuração de conexão persistente ativada`);
});