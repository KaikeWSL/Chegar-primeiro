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

// Função para inserir manutenção
async function salvarManutencao(dados) {
  const result = await pool.query(
    `INSERT INTO manutencoes 
      (nome, cpf, cep, endereco, apartamento, bloco, telefone, melhor_horario, data_registro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
    [
      dados.nome,
      dados.cpf,
      dados.cep,
      dados.endereco,
      dados.apartamento,
      dados.bloco,
      dados.telefone,
      dados.melhor_horario
    ]
  );
  return result.rows[0].id;
}

// Função para inserir cliente (com hash de senha)
async function salvarCliente(dados) {
  const hash = await bcrypt.hash(dados.senha, 10);
  const result = await pool.query(
    `INSERT INTO clientes 
      (nome_cliente, cpf, cep, email, endereco, apartamento, bloco, nome_empreendimento, servico, senha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      dados.nome_cliente,
      dados.cpf,
      dados.cep,
      dados.email,
      dados.endereco,
      dados.apartamento,
      dados.bloco,
      dados.nome_empreendimento,
      dados.servico,
      hash
    ]
  );
  const protocolo = result.rows[0].id;
  // Inserir também na tabela solicitacoes_novos_clientes
  await pool.query(
    `INSERT INTO solicitacoes_novos_clientes 
      (protocolo, nome_cliente, cpf, cep, endereco, apartamento, bloco, nome_empreendimento, servico, data_solicitacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      protocolo,
      dados.nome_cliente,
      dados.cpf,
      dados.cep,
      dados.endereco,
      dados.apartamento,
      dados.bloco,
      dados.nome_empreendimento,
      dados.servico
    ]
  );
  return protocolo;
}

// Função para buscar cliente por CPF
async function buscarClientePorCPF(cpf) {
  const result = await pool.query(
    'SELECT * FROM clientes WHERE cpf = $1',
    [cpf]
  );
  return result.rows[0];
}

// Função para inserir troca de serviço
async function salvarTrocaServico(dados) {
  const result = await pool.query(
    `INSERT INTO troca_servico 
      (nome_cliente, cpf_ou_contrato, servico_atual, novo_servico)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      dados.nome_cliente,
      dados.cpf_ou_contrato,
      dados.servico_atual,
      dados.novo_servico
    ]
  );
  return result.rows[0].id;
}

app.post('/api/cadastro', async (req, res) => {
  try {
    await salvarCadastroNoBanco(req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para inserir manutenção
app.post('/api/manutencoes', async (req, res) => {
  try {
    const protocolo = await salvarManutencao(req.body);
    res.status(200).json({ success: true, protocolo });
  } catch (err) {
    console.error('ERRO AO INSERIR MANUTENÇÃO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para inserir cliente
app.post('/api/clientes', async (req, res) => {
  try {
    const protocolo = await salvarCliente(req.body);
    res.status(200).json({ success: true, protocolo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para buscar cliente por CPF
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

// Rota para inserir troca de serviço
app.post('/api/troca-servico', async (req, res) => {
  try {
    const protocolo = await salvarTrocaServico(req.body);
    res.status(200).json({ success: true, protocolo });
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
    // Não retorna a senha!
    delete cliente.senha;
    res.status(200).json({ success: true, cliente });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
}); 