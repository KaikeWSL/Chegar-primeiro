const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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

async function salvarCadastroNoBanco(dados) {
  // Adapte os campos conforme seu formulário/tabela
  await pool.query(
    'INSERT INTO cadastros (nome, cpf, cep, apartamento, bloco) VALUES ($1, $2, $3, $4, $5)',
    [dados.nome, dados.cpf, dados.cep, dados.apartamento, dados.bloco]
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
  // Insere na tabela solicitacoes
  const result = await pool.query(
    `INSERT INTO solicitacoes
      (tipo, nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, servico_atual, novo_servico, telefone, melhor_horario, descricao, data_registro, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15) RETURNING id`,
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
      'Em análise'
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
  return result.rows[0].id;
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

// Novo endpoint para buscar solicitação por protocolo (id)
app.get('/api/solicitacao/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM solicitacoes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Solicitação não encontrada' });
    }
    const solicitacao = result.rows[0];
    res.status(200).json({ success: true, solicitacao });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
}); 