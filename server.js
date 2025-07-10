const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cluster = require('cluster');
const os = require('os');

const app = express();
app.use(cors({
  origin: ['https://chegar-primeiro.netlify.app', 'http://localhost:8888'],
  credentials: true
}));
app.options('*', cors());
app.use(bodyParser.json());

// === CONFIGURAÇÃO DE CLUSTER PARA MÁXIMA PERFORMANCE ===
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  console.log(`Iniciando ${numCPUs} workers`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} morreu`);
    cluster.fork();
  });
} else {
  startServer();
}

function startServer() {
  // === POOL DE CONEXÕES ULTRA-OTIMIZADO ===
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_G43vPwgWaRkh@ep-empty-snow-acqkbuow-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    // Configurações extremamente otimizadas
    max: 50, // Máximo absoluto de conexões
    min: 10, // Sempre 10 conexões ativas
    idleTimeoutMillis: 30000, // 30 segundos
    connectionTimeoutMillis: 8000, // 8 segundos
    acquireTimeoutMillis: 60000, // 1 minuto
    allowExitOnIdle: false,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 20000, // 20 segundos
    query_timeout: 15000, // 15 segundos
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    // Configurações de performance
    application_name: 'chegar_primeiro_api',
    // Prepared statements para queries repetitivas
    max_prepared_statements: 100,
  });

  // === CACHE EM MEMÓRIA PARA MÁXIMA VELOCIDADE ===
  const cache = new Map();
  const CACHE_TTL = 300000; // 5 minutos

  function setCache(key, value) {
    cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  function getCache(key) {
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
    cache.delete(key);
    return null;
  }

  // Limpeza automática do cache
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
  }, 60000); // A cada minuto

  // === SISTEMA DE FILA DE EMAILS ULTRA-RÁPIDO ===
  const filaEmails = [];
  const filaEmailsUrgentes = []; // Fila prioritária
  let processandoFila = false;

  // Transporter otimizado para máxima velocidade
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    pool: true,
    maxConnections: 30, // Máximo de conexões simultâneas
    maxMessages: 2000, // Mensagens por conexão
    rateDelta: 100, // 100ms entre emails
    rateLimit: 20, // 20 emails por segundo
    connectionTimeout: 10000, // 10 segundos
    socketTimeout: 15000, // 15 segundos
    retryDelay: 1000, // 1 segundo
    maxRetries: 2, // Apenas 2 tentativas
  });

  // Processamento paralelo de emails
  async function processarFilaEmails() {
    if (processandoFila) return;
    processandoFila = true;

    const processarLote = async (lote) => {
      const promessas = lote.map(async (email) => {
        try {
          await transporter.sendMail(email);
          console.log(`✓ Email enviado: ${email.to}`);
        } catch (error) {
          console.error(`✗ Erro email ${email.to}:`, error.message);
          // Recolocar na fila normal se falhou
          if (email.tentativas < 2) {
            email.tentativas = (email.tentativas || 0) + 1;
            filaEmails.push(email);
          }
        }
      });
      await Promise.allSettled(promessas);
    };

    while (filaEmailsUrgentes.length > 0 || filaEmails.length > 0) {
      const lote = [];
      
      // Prioriza emails urgentes
      while (filaEmailsUrgentes.length > 0 && lote.length < 10) {
        lote.push(filaEmailsUrgentes.shift());
      }
      
      // Completa o lote com emails normais
      while (filaEmails.length > 0 && lote.length < 10) {
        lote.push(filaEmails.shift());
      }

      if (lote.length > 0) {
        await processarLote(lote);
      }
    }

    processandoFila = false;
  }

  function adicionarEmailFila(dadosEmail, urgente = false) {
    const email = {
      ...dadosEmail,
      tentativas: 0,
      timestamp: Date.now()
    };
    
    if (urgente) {
      filaEmailsUrgentes.push(email);
    } else {
      filaEmails.push(email);
    }
    
    // Processa imediatamente se não estiver processando
    if (!processandoFila) {
      setImmediate(processarFilaEmails);
    }
  }

  // === PREPARED STATEMENTS PARA MÁXIMA VELOCIDADE ===
  const queries = {
    inserirSolicitacao: `
      INSERT INTO solicitacoes
      (tipo, nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, 
       servico_atual, novo_servico, telefone, melhor_horario, descricao, data_registro, status, protocolo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15,$16) 
      RETURNING id
    `,
    inserirCliente: `
      INSERT INTO clientes
      (nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, servico, senha)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    verificarDuplicidade: `
      SELECT 1 FROM clientes WHERE cpf = $1 OR email = $2 LIMIT 1
    `,
    buscarClientePorCPF: `
      SELECT * FROM clientes WHERE cpf = $1 ORDER BY nome_cliente LIMIT 10
    `,
    buscarSolicitacaoPorProtocolo: `
      SELECT * FROM solicitacoes WHERE protocolo = $1 LIMIT 1
    `,
    buscarSolicitacaoPorCPF: `
      SELECT * FROM solicitacoes WHERE cpf = $1 AND tipo = $2 ORDER BY data_registro DESC LIMIT 1
    `
  };

  // === FUNÇÕES ULTRA-OTIMIZADAS ===
  
  // Geração de protocolo otimizada
  function gerarProtocolo() {
    const now = new Date();
    return now.getFullYear().toString() +
           (now.getMonth() + 1).toString().padStart(2, '0') +
           now.getDate().toString().padStart(2, '0') +
           now.getHours().toString().padStart(2, '0') +
           now.getMinutes().toString().padStart(2, '0') +
           now.getSeconds().toString().padStart(2, '0') +
           now.getMilliseconds().toString().padStart(3, '0').slice(0, 2);
  }

  // Execução de query com retry ultra-rápido
  async function executarQuery(query, params = [], maxTentativas = 2) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const result = await pool.query(query, params);
        return result;
      } catch (error) {
        if (tentativa === maxTentativas) throw error;
        await new Promise(resolve => setTimeout(resolve, 200 * tentativa));
      }
    }
  }

  // Função otimizada para salvar solicitação
  async function salvarSolicitacao(dados) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let senhaHash = null;
      if (dados.tipo === 'novo_cliente' && dados.senha) {
        // Hash assíncrono para não bloquear
        senhaHash = await bcrypt.hash(dados.senha, 8); // Reduzido para 8 rounds
      }
      
      // Verificação de duplicidade apenas para novos clientes
      if (dados.tipo === 'novo_cliente') {
        const existe = await client.query(queries.verificarDuplicidade, [dados.cpf, dados.email]);
        if (existe.rows.length > 0) {
          await client.query('ROLLBACK');
          return { jaExiste: true };
        }
      }
      
      const protocolo = gerarProtocolo();
      
      // Inserção da solicitação
      const result = await client.query(queries.inserirSolicitacao, [
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
      ]);
      
      // Inserção do cliente se necessário
      if (dados.tipo === 'novo_cliente') {
        await client.query(queries.inserirCliente, [
          dados.nome_cliente || null,
          dados.cpf || null,
          dados.cep || null,
          dados.email || null,
          dados.endereco || null,
          dados.apartamento || null,
          dados.bloco || null,
          dados.nome_empreendimento || null,
          dados.novo_servico || null,
          senhaHash
        ]);
      }
      
      await client.query('COMMIT');
      
      // Email assíncrono - não bloqueia a resposta
      if (dados.email) {
        setImmediate(() => {
          adicionarEmailFila({
            from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
            to: dados.email,
            subject: '✅ Protocolo da sua solicitação',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Solicitação Registrada!</h2>
                <p>Sua solicitação foi registrada com sucesso.</p>
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0; color: #1e40af;">Protocolo: ${protocolo}</h3>
                </div>
                <p>Mantenha este protocolo para acompanhar sua solicitação.</p>
              </div>
            `
          }, true); // Marca como urgente
        });
      }
      
      return protocolo;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // === ARMAZENAMENTO OTIMIZADO DE CÓDIGOS ===
  const codigosVerificacao = new Map();
  
  // Limpeza ultra-rápida a cada 2 minutos
  setInterval(() => {
    const agora = Date.now();
    const tempoExpiracao = 300000; // 5 minutos
    
    for (const [email, dados] of codigosVerificacao.entries()) {
      if (agora - dados.timestamp > tempoExpiracao) {
        codigosVerificacao.delete(email);
      }
    }
  }, 120000); // 2 minutos

  // === ROTAS ULTRA-OTIMIZADAS ===
  
  // Rota principal - inserir solicitação
  app.post('/api/solicitacoes', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const resultado = await salvarSolicitacao(req.body);
      
      if (resultado && resultado.jaExiste) {
        return res.status(200).json({ 
          success: false, 
          motivo: 'ja_existe',
          responseTime: Date.now() - startTime
        });
      }
      
      res.status(200).json({ 
        success: true, 
        protocolo: resultado,
        responseTime: Date.now() - startTime
      });
      
    } catch (err) {
      console.error('Erro ao salvar solicitação:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor',
        responseTime: Date.now() - startTime
      });
    }
  });

  // Buscar cliente por CPF com cache
  app.get('/api/clientes/:cpf', async (req, res) => {
    const cpf = req.params.cpf;
    const cacheKey = `cliente_${cpf}`;
    
    try {
      // Verifica cache primeiro
      let cliente = getCache(cacheKey);
      
      if (!cliente) {
        const result = await executarQuery(queries.buscarSolicitacaoPorCPF, [cpf, 'novo_cliente']);
        cliente = result.rows[0];
        
        if (cliente) {
          setCache(cacheKey, cliente);
        }
      }
      
      if (cliente) {
        res.status(200).json({ success: true, cliente });
      } else {
        res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      }
    } catch (err) {
      console.error('Erro ao buscar cliente:', err);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Login otimizado
  app.post('/api/login', async (req, res) => {
    const { cpf, senha } = req.body;
    
    try {
      const result = await executarQuery(queries.buscarClientePorCPF, [cpf]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'CPF ou senha inválidos' });
      }
      
      // Verifica senhas em paralelo
      const verificacoes = result.rows.map(async (cliente) => {
        const senhaOk = await bcrypt.compare(senha, cliente.senha);
        return senhaOk ? cliente : null;
      });
      
      const resultados = await Promise.all(verificacoes);
      const clienteAutenticado = resultados.find(c => c !== null);
      
      if (!clienteAutenticado) {
        return res.status(401).json({ success: false, error: 'CPF ou senha inválidos' });
      }
      
      delete clienteAutenticado.senha;
      res.status(200).json({ success: true, cliente: clienteAutenticado });
      
    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Buscar cliente completo com cache
  app.get('/api/cliente-completo/:cpf', async (req, res) => {
    const cpf = req.params.cpf;
    const cacheKey = `cliente_completo_${cpf}`;
    
    try {
      let clientes = getCache(cacheKey);
      
      if (!clientes) {
        const result = await executarQuery(queries.buscarClientePorCPF, [cpf]);
        clientes = result.rows.map(cliente => {
          delete cliente.senha;
          return cliente;
        });
        
        if (clientes.length > 0) {
          setCache(cacheKey, clientes);
        }
      }
      
      if (clientes.length === 0) {
        return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      }
      
      if (clientes.length > 1) {
        res.status(200).json({ success: true, clientes });
      } else {
        res.status(200).json({ success: true, cliente: clientes[0] });
      }
      
    } catch (err) {
      console.error('Erro ao buscar cliente completo:', err);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Buscar solicitação por protocolo com cache
  app.get('/api/solicitacao/:protocolo', async (req, res) => {
    const protocolo = req.params.protocolo;
    const cacheKey = `solicitacao_${protocolo}`;
    
    try {
      let solicitacao = getCache(cacheKey);
      
      if (!solicitacao) {
        const result = await executarQuery(queries.buscarSolicitacaoPorProtocolo, [protocolo]);
        solicitacao = result.rows[0];
        
        if (solicitacao) {
          setCache(cacheKey, solicitacao);
        }
      }
      
      if (solicitacao) {
        res.status(200).json({ success: true, solicitacao });
      } else {
        res.status(404).json({ success: false, error: 'Solicitação não encontrada' });
      }
      
    } catch (err) {
      console.error('Erro ao buscar solicitação:', err);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Enviar código de verificação
  app.post('/api/enviar-codigo-email', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'E-mail não informado' });
    }
    
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosVerificacao.set(email, {
      codigo,
      timestamp: Date.now()
    });
    
    // Email urgente para códigos
    adicionarEmailFila({
      from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Código de verificação',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Código de Verificação</h2>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="margin: 0; color: #1e40af; font-size: 2.5em; letter-spacing: 3px;">${codigo}</h1>
          </div>
          <p>Este código expira em 5 minutos.</p>
        </div>
      `
    }, true); // Urgente
    
    res.json({ success: true });
  });

  // Validar código
  app.post('/api/validar-codigo-email', (req, res) => {
    const { email, codigo } = req.body;
    
    if (!email || !codigo) {
      return res.status(400).json({ success: false, error: 'Dados incompletos' });
    }
    
    const dadosCodigo = codigosVerificacao.get(email);
    if (!dadosCodigo) {
      return res.json({ success: false, error: 'Código não encontrado ou expirado' });
    }
    
    if (Date.now() - dadosCodigo.timestamp > 300000) { // 5 minutos
      codigosVerificacao.delete(email);
      return res.json({ success: false, error: 'Código expirado' });
    }
    
    if (dadosCodigo.codigo === codigo) {
      codigosVerificacao.delete(email);
      return res.json({ success: true });
    }
    
    res.json({ success: false, error: 'Código inválido' });
  });

  // Health check otimizado
  app.get('/health', async (req, res) => {
    const startTime = Date.now();
    
    try {
      await pool.query('SELECT 1');
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        database: 'connected',
        cache: {
          size: cache.size,
          emailQueue: filaEmails.length,
          urgentEmailQueue: filaEmailsUrgentes.length,
          verificationCodes: codigosVerificacao.size
        },
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      });
      
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message
      });
    }
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Fechando servidor...');
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ultra-otimizado rodando na porta ${PORT}`);
    console.log(`📊 Worker PID: ${process.pid}`);
  });
}