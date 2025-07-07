const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
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
  await pool.query(
    `INSERT INTO manutencoes 
      (nome_empreendimento, endereco, data_inicio, data_fim, quantidade_torres, andares, aptos_por_andar, nome_sindico, engenheiro_responsavel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      dados.nome_empreendimento,
      dados.endereco,
      dados.data_inicio,
      dados.data_fim,
      dados.quantidade_torres,
      dados.andares,
      dados.aptos_por_andar,
      dados.nome_sindico,
      dados.engenheiro_responsavel
    ]
  );
}

// Função para inserir cliente
async function salvarCliente(dados) {
  await pool.query(
    `INSERT INTO clientes 
      (nome_cliente, cpf, cep, endereco, apartamento, bloco, nome_empreendimento, servico)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
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
  await pool.query(
    `INSERT INTO troca_servico 
      (nome_cliente, cpf_ou_contrato, servico_atual, novo_servico)
     VALUES ($1, $2, $3, $4)`,
    [
      dados.nome_cliente,
      dados.cpf_ou_contrato,
      dados.servico_atual,
      dados.novo_servico
    ]
  );
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
    await salvarManutencao(req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rota para inserir cliente
app.post('/api/clientes', async (req, res) => {
  try {
    await salvarCliente(req.body);
    res.status(200).json({ success: true });
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
    await salvarTrocaServico(req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
}); 