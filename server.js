const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
  origin: ['https://chegar-primeiro.netlify.app', 'http://localhost:8888'],
  credentials: true
}));
app.options('*', cors());
app.use(bodyParser.json());

// Configuração do banco Neon (PostgreSQL)
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_G43vPwgWaRkh@ep-empty-snow-acqkbuow-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  // Substitua pelos seus dados do Neon
});

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

async function salvarCadastroNoBanco(dados) {
  // Adapte os campos conforme seu formulário/tabela
  await pool.query(
    'INSERT INTO cadastros (nome, cpf, cep, apartamento, bloco) VALUES ($1, $2, $3, $4, $5)',
    [dados.nome, dados.cpf, dados.cep, dados.apartamento, dados.bloco]
  );
}

// Função para gerar protocolo único com ano, mês, dia, hora, minuto e segundo
function gerarProtocolo() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// Função para inserir solicitação genérica
async function salvarSolicitacao(dados) {
  let senhaHash = null;
  if (dados.tipo === 'novo_cliente' && dados.senha) {
    senhaHash = await bcrypt.hash(dados.senha, 10);
  }
  // Se for novo cliente, verifica duplicidade antes de inserir na tabela clientes
  if (dados.tipo === 'novo_cliente') {
    const existe = await pool.query(
      'SELECT 1 FROM clientes WHERE cpf = $1 OR email = $2',
      [dados.cpf, dados.email]
    );
    if (existe.rows.length > 0) {
      // Não cadastra, retorna erro específico
      return { jaExiste: true };
    }
  }
  // Gera protocolo único
  const protocolo = gerarProtocolo();
  // Insere na tabela solicitacoes
  const result = await pool.query(
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
  // Se for novo cliente, insere também na tabela clientes
  if (dados.tipo === 'novo_cliente') {
    await pool.query(
      `INSERT INTO clientes
        (nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, servico, senha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
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
      ]
    );
  }
  // Envia o protocolo por e-mail, se houver e-mail
  if (dados.email) {
    try {
      await transporter.sendMail({
        from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
        to: dados.email,
        subject: 'Protocolo da sua solicitação',
        text: `Sua solicitação foi registrada com sucesso!\nProtocolo: ${protocolo}`,
        html: `<p>Sua solicitação foi registrada com sucesso!<br>Protocolo: <b>${protocolo}</b></p>`
      });
    } catch (err) {
      // Não impede o fluxo, apenas loga o erro
      console.error('Erro ao enviar e-mail de protocolo:', err.message);
    }
  }
  return protocolo;
}

// Função para buscar cliente (novo_cliente) por CPF
async function buscarClientePorCPF(cpf) {
  const result = await pool.query(
    'SELECT * FROM solicitacoes WHERE cpf = $1 AND tipo = $2',
    [cpf, 'novo_cliente']
  );
  return result.rows[0];
}

// Rota única para inserir qualquer solicitação
app.post('/api/solicitacoes', async (req, res) => {
  try {
    const resultado = await salvarSolicitacao(req.body);
    if (resultado && resultado.jaExiste) {
      return res.status(200).json({ success: false, motivo: 'ja_existe' });
    }
    res.status(200).json({ success: true, protocolo: resultado });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para buscar cliente por CPF (apenas novo_cliente)
app.get('/api/clientes/:cpf', async (req, res) => {
  try {
    const cliente = await buscarClientePorCPF(req.params.cpf);
    if (cliente) {
      res.status(200).json({ success: true, cliente });
    } else {
      res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de login de cliente
app.post('/api/login', async (req, res) => {
  const { cpf, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM clientes WHERE cpf = $1', [cpf]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'CPF ou senha inválidos' });
    }
    const cliente = result.rows[0];
    const senhaOk = await bcrypt.compare(senha, cliente.senha);
    if (!senhaOk) {
      return res.status(401).json({ success: false, error: 'CPF ou senha inválidos' });
    }
    delete cliente.senha;
    res.status(200).json({ success: true, cliente });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Novo endpoint para buscar dados completos do cliente por CPF
app.get('/api/cliente-completo/:cpf', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes WHERE cpf = $1', [req.params.cpf]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    const cliente = result.rows[0];
    delete cliente.senha; // Não envie a senha!
    res.status(200).json({ success: true, cliente });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Novo endpoint para buscar solicitação por protocolo (protocolo)
app.get('/api/solicitacao/:protocolo', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM solicitacoes WHERE protocolo = $1', [req.params.protocolo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Solicitação não encontrada' });
    }
    const solicitacao = result.rows[0];
    res.status(200).json({ success: true, solicitacao });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para enviar código de verificação
app.post('/api/enviar-codigo-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'E-mail não informado' });
  // Gera código de 6 dígitos
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  codigosVerificacao[email] = codigo;
  // Envia o e-mail
  try {
    await transporter.sendMail({
      from: `Chegar Primeiro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de verificação',
      text: `Seu código de verificação é: ${codigo}`,
      html: `<p>Seu código de verificação é: <b>${codigo}</b></p>`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao enviar e-mail' });
  }
});

// Endpoint para validar código de verificação
app.post('/api/validar-codigo-email', (req, res) => {
  const { email, codigo } = req.body;
  if (!email || !codigo) return res.status(400).json({ success: false, error: 'Dados incompletos' });
  if (codigosVerificacao[email] && codigosVerificacao[email] === codigo) {
    delete codigosVerificacao[email]; // Remove após uso
    return res.json({ success: true });
  }
  res.json({ success: false, error: 'Código inválido' });
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
}); 