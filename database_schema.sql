-- =============================================
-- SCHEMA DO BANCO DE DADOS - CHEGAR PRIMEIRO CLARO
-- =============================================

-- Tabela principal de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    celular TEXT,
    
    -- Dados de endereço
    cep TEXT NOT NULL,
    endereco TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    apartamento TEXT NOT NULL,
    bloco TEXT NOT NULL,
    empreendimento TEXT,
    
    -- Dados de acesso
    senha_hash TEXT NOT NULL,
    
    -- Metadados de segurança
    fingerprint TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    -- Status
    email_verificado BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE
);

-- Tabela para códigos de verificação de email
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    codigo TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (email) REFERENCES clientes(email) ON DELETE CASCADE
);

-- Tabela para todas as solicitações (manutenção, troca de serviço, novos clientes)
CREATE TABLE IF NOT EXISTS solicitacoes (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'novo_cliente', 'manutencao', 'troca_servico'
    nome_cliente TEXT,
    cpf TEXT,
    cep TEXT,
    email TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    apartamento TEXT,
    bloco TEXT,
    nome_empreendimento TEXT,
    servico_atual TEXT,
    novo_servico TEXT,
    telefone TEXT,
    celular TEXT,
    melhor_horario TEXT,
    descricao TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluido', 'cancelado'
    protocolo TEXT UNIQUE NOT NULL,
    
    -- Metadados de segurança
    fingerprint TEXT,
    user_agent TEXT,
    ip_address INET,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para serviços/planos
CREATE TABLE IF NOT EXISTS servicos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2),
    tipo TEXT, -- 'fibra', 'controle', 'pos'
    velocidade TEXT,
    beneficios TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento cliente-serviço
CREATE TABLE IF NOT EXISTS cliente_servicos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    data_contratacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE
);

-- Tabela para logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER,
    action TEXT NOT NULL, -- 'login', 'cadastro', 'update', 'email_verification'
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    fingerprint TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Índices principais
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes(created_at);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);

-- Índices para verificação de email
CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_codes_expires ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_codes_used ON email_verification_codes(used);

-- Índices para solicitações
CREATE INDEX IF NOT EXISTS idx_solicitacoes_tipo ON solicitacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_cpf ON solicitacoes(cpf);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_email ON solicitacoes(email);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_protocolo ON solicitacoes(protocolo);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_registro ON solicitacoes(data_registro);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at ON solicitacoes(created_at);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_audit_cliente_id ON audit_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- =============================================
-- DADOS INICIAIS - SERVIÇOS CLARO
-- =============================================

INSERT INTO servicos (nome, descricao, preco, tipo, velocidade, beneficios) VALUES
('Claro fibra 350 MEGA + globoplay', 'Internet fibra ótica com velocidade de 350 MEGA', 79.90, 'fibra', '350 MEGA', 'globoplay + Wi-Fi Grátis + McAfee + E-books'),
('Claro fibra 600 MEGA + globoplay + Claro pós 60GB', 'Internet fibra ótica com velocidade de 600 MEGA + plano móvel', 159.90, 'fibra', '600 MEGA', 'globoplay + Wi-Fi Grátis + Claro pós 60GB'),
('Claro controle 30GB + bônus', 'Plano controle com 30GB de internet móvel', 59.90, 'controle', '30GB', '15GB + 5GB redes sociais + WhatsApp ilimitado + 10GB bônus'),
('Claro pós 50GB', 'Plano pós-pago com 50GB de internet móvel', 119.90, 'pos', '50GB', '25GB + 25GB + WhatsApp ilimitado')
ON CONFLICT DO NOTHING;

-- =============================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =============================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_updated_at 
    BEFORE UPDATE ON clientes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solicitacoes_updated_at 
    BEFORE UPDATE ON solicitacoes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEWS ÚTEIS PARA RELATÓRIOS
-- =============================================

-- View para clientes ativos com serviços
CREATE OR REPLACE VIEW clientes_ativos_com_servicos AS
SELECT 
    c.id,
    c.nome,
    c.cpf,
    c.email,
    c.telefone,
    c.celular,
    c.cidade,
    c.estado,
    c.empreendimento,
    c.email_verificado,
    c.created_at,
    c.last_login,
    s.nome as servico_nome,
    s.preco as servico_preco,
    s.tipo as servico_tipo,
    cs.data_contratacao
FROM clientes c
LEFT JOIN cliente_servicos cs ON c.id = cs.cliente_id AND cs.ativo = true
LEFT JOIN servicos s ON cs.servico_id = s.id
WHERE c.ativo = true;

-- View para estatísticas básicas
CREATE OR REPLACE VIEW estatisticas_cadastros AS
SELECT 
    COUNT(*) as total_clientes,
    COUNT(CASE WHEN email_verificado = true THEN 1 END) as emails_verificados,
    COUNT(CASE WHEN last_login IS NOT NULL THEN 1 END) as clientes_logaram,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as cadastros_hoje,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as cadastros_semana,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as cadastros_mes
FROM clientes 
WHERE ativo = true;

-- =============================================
-- FUNÇÕES UTILITÁRIAS
-- =============================================

-- Função para limpar códigos de verificação expirados
CREATE OR REPLACE FUNCTION limpar_codigos_expirados()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_codes 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================

COMMENT ON TABLE clientes IS 'Tabela principal com dados dos clientes Claro';
COMMENT ON COLUMN clientes.cpf IS 'CPF ou CNPJ do cliente (único)';
COMMENT ON COLUMN clientes.senha_hash IS 'Hash da senha com salt para segurança';
COMMENT ON COLUMN clientes.fingerprint IS 'Fingerprint do dispositivo para auditoria';
COMMENT ON COLUMN clientes.email_verificado IS 'Indica se o email foi verificado via código';

COMMENT ON TABLE solicitacoes IS 'Tabela para todas as solicitações: novos clientes, manutenção, troca de serviço';
COMMENT ON COLUMN solicitacoes.protocolo IS 'Protocolo único para rastreamento da solicitação';
COMMENT ON COLUMN solicitacoes.tipo IS 'Tipo da solicitação: novo_cliente, manutencao, troca_servico';

COMMENT ON TABLE email_verification_codes IS 'Códigos temporários para verificação de email';
COMMENT ON TABLE servicos IS 'Catálogo de serviços/planos disponíveis';
COMMENT ON TABLE cliente_servicos IS 'Relacionamento entre clientes e serviços contratados';
COMMENT ON TABLE audit_logs IS 'Log de auditoria para rastreamento de ações';

-- =============================================
-- EXEMPLO DE CONSULTAS ÚTEIS
-- =============================================

/*
-- Buscar cliente por CPF
SELECT * FROM clientes WHERE cpf = '12345678901';

-- Listar clientes com serviços
SELECT * FROM clientes_ativos_com_servicos WHERE nome ILIKE '%joão%';

-- Estatísticas gerais
SELECT * FROM estatisticas_cadastros;

-- Clientes que se cadastraram hoje
SELECT nome, email, created_at 
FROM clientes 
WHERE created_at >= CURRENT_DATE 
ORDER BY created_at DESC;

-- Códigos de verificação pendentes
SELECT email, codigo, expires_at 
FROM email_verification_codes 
WHERE used = false AND expires_at > CURRENT_TIMESTAMP;

-- Limpar códigos expirados
SELECT limpar_codigos_expirados();
*/
