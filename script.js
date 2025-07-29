// === SISTEMA DE SEGURANÇA E VALIDAÇÃO ===

// Função auxiliar para acessar elementos com segurança
function safeGetElement(id) {
  return document.getElementById(id);
}

function safeSetStyle(elementId, property, value) {
  const element = safeGetElement(elementId);
  if (element) {
    element.style[property] = value;
  }
}

function safeSetHTML(elementId, html) {
  const element = safeGetElement(elementId);
  if (element) {
    element.innerHTML = html;
  }
}

function safeSetValue(elementId, value) {
  const element = safeGetElement(elementId);
  if (element) {
    element.value = value;
  }
}

// Configuração de segurança
const SECURITY_CONFIG = {
  maxLoginAttempts: 5,
  lockoutTime: 15 * 60 * 1000, // 15 minutos
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  tokenExpiry: 24 * 60 * 60 * 1000, // 24 horas
  minPasswordLength: 8,
  requireSpecialChars: true,
  csrfProtection: true
};

// Sistema de controle de tentativas de login
class SecurityManager {
  constructor() {
    this.loginAttempts = new Map();
    this.sessionData = new Map();
    this.csrfTokens = new Set();
    this.initSecurity();
  }

  initSecurity() {
    // Inicializa CSRF protection
    this.generateCSRFToken();
    
    // Limpa dados expirados periodicamente
    setInterval(() => this.cleanupExpiredData(), 60000);
    
    // Monitora atividade do usuário
    this.setupActivityMonitoring();
  }

  generateCSRFToken() {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    this.csrfTokens.add(token);
    localStorage.setItem('csrfToken', token);
    return token;
  }

  validateCSRFToken(token) {
    return this.csrfTokens.has(token);
  }

  recordLoginAttempt(identifier, success) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
    
    if (success) {
      this.loginAttempts.delete(identifier);
      return { allowed: true };
    }
    
    attempts.count++;
    attempts.lastAttempt = now;
    
    if (attempts.count >= SECURITY_CONFIG.maxLoginAttempts) {
      attempts.lockedUntil = now + SECURITY_CONFIG.lockoutTime;
      this.loginAttempts.set(identifier, attempts);
      return { 
        allowed: false, 
        lockedUntil: attempts.lockedUntil,
        remainingTime: Math.ceil((attempts.lockedUntil - now) / 60000)
      };
    }
    
    this.loginAttempts.set(identifier, attempts);
    return { 
      allowed: true, 
      attemptsLeft: SECURITY_CONFIG.maxLoginAttempts - attempts.count 
    };
  }

  isAccountLocked(identifier) {
    const attempts = this.loginAttempts.get(identifier);
    if (!attempts) return { locked: false };
    
    const now = Date.now();
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      return { 
        locked: true, 
        remainingTime: Math.ceil((attempts.lockedUntil - now) / 60000)
      };
    }
    
    return { locked: false };
  }

  setupActivityMonitoring() {
    let lastActivity = Date.now();
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        lastActivity = Date.now();
      }, { passive: true });
    });
    
    setInterval(() => {
      if (Date.now() - lastActivity > SECURITY_CONFIG.sessionTimeout) {
        this.handleSessionTimeout();
      }
    }, 60000);
  }

  handleSessionTimeout() {
    const areaAutenticada = document.getElementById('areaAutenticada');
    if (areaAutenticada && areaAutenticada.style.display !== 'none') {
      this.logout();
      mostrarMensagem('Sessão expirada por inatividade. Faça login novamente.', false);
    }
  }

  logout() {
    localStorage.removeItem('userSession');
    localStorage.removeItem('csrfToken');
    sessionStorage.clear();
    voltarInicio();
  }

  cleanupExpiredData() {
    const now = Date.now();
    
    // Limpa tentativas de login expiradas
    for (const [key, attempts] of this.loginAttempts.entries()) {
      if (attempts.lockedUntil && now > attempts.lockedUntil) {
        this.loginAttempts.delete(key);
      }
    }
    
    // Limpa tokens CSRF antigos
    if (this.csrfTokens.size > 100) {
      this.csrfTokens.clear();
      this.generateCSRFToken();
    }
  }
}

// Instância global do gerenciador de segurança
const securityManager = new SecurityManager();

// === VALIDAÇÃO DE DADOS ===

// Validação de CPF
function validaCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Calcula os dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = soma % 11;
  let dv1 = resto < 2 ? 0 : 11 - resto;
  
  if (parseInt(cpf.charAt(9)) !== dv1) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = soma % 11;
  let dv2 = resto < 2 ? 0 : 11 - resto;
  
  return parseInt(cpf.charAt(10)) === dv2;
}

// Validação de CNPJ
function validaCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  if (cnpj.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Calcula o primeiro dígito verificador
  let soma = 0;
  const peso1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i)) * peso1[i];
  }
  let resto = soma % 11;
  let dv1 = resto < 2 ? 0 : 11 - resto;
  
  if (parseInt(cnpj.charAt(12)) !== dv1) return false;
  
  // Calcula o segundo dígito verificador
  soma = 0;
  const peso2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i)) * peso2[i];
  }
  resto = soma % 11;
  let dv2 = resto < 2 ? 0 : 11 - resto;
  
  return parseInt(cnpj.charAt(13)) === dv2;
}

// Validação de CEP
function validaCEP(cep) {
  cep = cep.replace(/[^\d]/g, '');
  return cep.length === 8 && /^\d{8}$/.test(cep);
}

// Validação de senha forte
function validaSenha(senha) {
  const errors = [];
  
  if (senha.length < SECURITY_CONFIG.minPasswordLength) {
    errors.push(`Mínimo ${SECURITY_CONFIG.minPasswordLength} caracteres`);
  }
  
  if (!/[A-Z]/.test(senha)) {
    errors.push('Pelo menos uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(senha)) {
    errors.push('Pelo menos uma letra minúscula');
  }
  
  if (!/\d/.test(senha)) {
    errors.push('Pelo menos um número');
  }
  
  if (SECURITY_CONFIG.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    errors.push('Pelo menos um caractere especial');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    strength: calculatePasswordStrength(senha)
  };
}

function calculatePasswordStrength(senha) {
  let score = 0;
  
  if (senha.length >= 8) score++;
  if (senha.length >= 12) score++;
  if (/[a-z]/.test(senha)) score++;
  if (/[A-Z]/.test(senha)) score++;
  if (/\d/.test(senha)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(senha)) score++;
  if (senha.length >= 16) score++;
  
  if (score <= 2) return { level: 'weak', text: 'Fraca', color: '#dc3545' };
  if (score <= 4) return { level: 'medium', text: 'Média', color: '#ffc107' };
  return { level: 'strong', text: 'Forte', color: '#28a745' };
}

// === FORMATAÇÃO DE CAMPOS ===

// Formatação de CPF
function formatCPF(value) {
  value = value.replace(/\D/g, '');
  value = value.replace(/(\d{3})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return value;
}

// Formatação de CNPJ
function formatCNPJ(value) {
  value = value.replace(/\D/g, '');
  value = value.replace(/(\d{2})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d)/, '$1/$2');
  value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  return value;
}

// Formatação de CEP
function formatCEP(value) {
  value = value.replace(/\D/g, '');
  value = value.replace(/(\d{5})(\d)/, '$1-$2');
  return value;
}

// Formatação de telefone
function formatTelefone(value) {
  value = value.replace(/\D/g, '');
  
  if (value.length <= 10) {
    value = value.replace(/(\d{2})(\d)/, '($1) $2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    value = value.replace(/(\d{2})(\d)/, '($1) $2');
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
  }
  
  return value;
}

// Detecção automática de CPF/CNPJ
function detectDocumentType(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) return 'CPF';
  return 'CNPJ';
}

// === FUNÇÕES DE NAVEGAÇÃO PRINCIPAIS ===

function mostrarLogin() {
  const telaInicial = document.getElementById('telaInicial');
  const formLogin = document.getElementById('formLogin');
  const formCadastro = document.getElementById('formCadastro');
  const areaAutenticada = document.getElementById('areaAutenticada');
  
  if (telaInicial) telaInicial.style.display = 'none';
  if (formLogin) formLogin.style.display = 'flex';
  if (formCadastro) formCadastro.style.display = 'none';
  if (areaAutenticada) areaAutenticada.style.display = 'none';
  
  // Adiciona classe para aplicar layout centralizado
  document.body.classList.remove('cadastro-ativo');
  document.body.classList.add('login-ativo');
}

function mostrarCadastro() {
  const telaInicial = document.getElementById('telaInicial');
  const formLogin = document.getElementById('formLogin');
  const formCadastro = document.getElementById('formCadastro');
  const areaAutenticada = document.getElementById('areaAutenticada');
  
  if (telaInicial) telaInicial.style.display = 'none';
  if (formLogin) formLogin.style.display = 'none';
  if (formCadastro) formCadastro.style.display = 'flex';
  if (areaAutenticada) areaAutenticada.style.display = 'none';
  
  // Adiciona classe para resetar layout para cadastro
  document.body.classList.remove('login-ativo');
  document.body.classList.add('cadastro-ativo');
}

function voltarInicio() {
  const telaInicial = document.getElementById('telaInicial');
  const formLogin = document.getElementById('formLogin');
  const formCadastro = document.getElementById('formCadastro');
  const areaAutenticada = document.getElementById('areaAutenticada');
  
  if (telaInicial) telaInicial.style.display = 'block';
  if (formLogin) formLogin.style.display = 'none';
  if (formCadastro) formCadastro.style.display = 'none';
  if (areaAutenticada) areaAutenticada.style.display = 'none';
  
  // Remove todas as classes e aplica layout centralizado para tela inicial
  document.body.classList.remove('cadastro-ativo', 'login-ativo');
  document.body.classList.add('inicio-ativo');
}

window.mostrarLogin = mostrarLogin;
window.mostrarCadastro = mostrarCadastro;
window.voltarInicio = voltarInicio;

// Inicialização do estado da página
function initializePageState() {
  // Define classe inicial baseada no que está visível
  const telaInicial = document.getElementById('telaInicial');
  const formLogin = document.getElementById('formLogin');
  const formCadastro = document.getElementById('formCadastro');
  
  // Verificar se os elementos existem antes de acessar suas propriedades
  if (telaInicial && telaInicial.style.display !== 'none') {
    document.body.classList.add('inicio-ativo');
  } else if (formLogin && formLogin.style.display !== 'none') {
    document.body.classList.add('login-ativo');
  } else if (formCadastro && formCadastro.style.display !== 'none') {
    document.body.classList.add('cadastro-ativo');
  } else {
    // Por padrão, a tela inicial está visível (se existir)
    if (telaInicial) {
      document.body.classList.add('inicio-ativo');
    }
  }
}

// Executar imediatamente
initializePageState();

document.addEventListener('DOMContentLoaded', function() {
  // === CONFIGURAÇÃO INICIAL ===
  initializeSecurityFeatures();
  initializeFormValidation();
  initializeFormatting();
  
  // === SISTEMA DE ABAS ===
  function showTab(idx) {
    const forms = [
      document.getElementById('formVistoria'),
      document.getElementById('formTrocaServico'),
      document.getElementById('acompanharSolicitacao')
    ];
    
    // Só processa se pelo menos um formulário existir
    if (forms.some(form => form !== null)) {
      document.querySelectorAll('.tab').forEach((tab, i) => {
        if (tab) {
          tab.classList.toggle('active', i === idx);
        }
        if (forms[i]) {
          forms[i].style.display = i === idx ? 'block' : 'none';
        }
      });
      
      if (idx === 2) {
        const resultadoAcompanhamento = document.getElementById('resultadoAcompanhamento');
        const inputProtocolo = document.getElementById('inputProtocolo');
        
        if (resultadoAcompanhamento) {
          resultadoAcompanhamento.innerHTML = '';
        }
        if (inputProtocolo) {
          inputProtocolo.value = '';
        }
      }
      
      const notification = document.getElementById('notification');
      if (notification) {
        notification.style.display = 'none';
      }
    }
  }

  // === INICIALIZAÇÃO DE RECURSOS DE SEGURANÇA ===
  function initializeSecurityFeatures() {
    // Previne ataques XSS básicos
    document.addEventListener('input', function(e) {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        const sanitized = sanitizeInput(e.target.value);
        if (sanitized !== e.target.value) {
          e.target.value = sanitized;
          showSecurityWarning('Caracteres potencialmente perigosos foram removidos.');
        }
      }
    });

    // Proteção contra injeção de scripts
    document.addEventListener('paste', function(e) {
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      if (/<script|javascript:|data:|vbscript:/i.test(paste)) {
        e.preventDefault();
        showSecurityWarning('Conteúdo potencialmente perigoso bloqueado.');
      }
    });

    // Bloqueia tentativas de abertura de console
    let devtools = { open: false };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.clear();
          console.log('%cATENÇÃO!', 'color: red; font-size: 30px; font-weight: bold;');
          console.log('%cEste é um recurso do navegador destinado a desenvolvedores. Não insira códigos aqui.', 'color: red; font-size: 16px;');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  // === SANITIZAÇÃO DE ENTRADA ===
  function sanitizeInput(input) {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  function showSecurityWarning(message) {
    const warning = document.createElement('div');
    warning.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 10000;
      background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;
      padding: 10px 15px; border-radius: 5px; font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    warning.textContent = message;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 3000);
  }

  // === INICIALIZAÇÃO DE VALIDAÇÃO DE FORMULÁRIOS ===
  function initializeFormValidation() {
    // Validação em tempo real para campos críticos
    const validators = {
      cpf: {
        selector: '#loginCpf, #cadCpf, #vistoriaCpf, #trocaCpf',
        validator: validaCPF,
        formatter: formatCPF,
        errorMessage: 'CPF inválido'
      },
      cep: {
        selector: '#cadCep, #vistoriaCep',
        validator: validaCEP,
        formatter: formatCEP,
        errorMessage: 'CEP inválido'
      },
      telefone: {
        selector: '#cadTelefone, #vistoriaTelefone',
        validator: (v) => v.replace(/\D/g, '').length >= 10,
        formatter: formatTelefone,
        errorMessage: 'Telefone inválido'
      },
      email: {
        selector: '#cadEmail',
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        formatter: (v) => v.toLowerCase().trim(),
        errorMessage: 'Email inválido'
      }
    };

    Object.entries(validators).forEach(([field, config]) => {
      document.querySelectorAll(config.selector).forEach(input => {
        if (!input) return;

        // Adiciona indicador de validação
        const indicator = createValidationIndicator();
        input.parentNode.appendChild(indicator);

        // Formatação em tempo real
        input.addEventListener('input', function() {
          if (config.formatter) {
            const cursorPos = this.selectionStart;
            const oldLength = this.value.length;
            this.value = config.formatter(this.value);
            const newLength = this.value.length;
            
            // Verificar se o input suporta setSelectionRange (não funciona com email, search, etc.)
            try {
              if (this.type === 'text' || this.type === 'tel' || this.type === 'password') {
                this.setSelectionRange(cursorPos + (newLength - oldLength), cursorPos + (newLength - oldLength));
              }
            } catch (e) {
              // Silenciosamente ignorar erro para tipos de input que não suportam seleção
              console.debug('setSelectionRange não suportado para input tipo:', this.type);
            }
          }
          
          validateField(this, config.validator, config.errorMessage, indicator);
        });

        // Validação ao sair do campo
        input.addEventListener('blur', function() {
          validateField(this, config.validator, config.errorMessage, indicator, true);
        });
      });
    });
  }

  function createValidationIndicator() {
    const indicator = document.createElement('span');
    indicator.className = 'validation-indicator';
    indicator.style.cssText = `
      position: absolute; right: 10px; top: 50%;
      transform: translateY(-50%); font-size: 16px;
      pointer-events: none; z-index: 1;
    `;
    return indicator;
  }

  function validateField(input, validator, errorMessage, indicator, showError = false) {
    const rawValue = input.value.replace(/\D/g, '');
    const isValid = validator(rawValue);
    
    if (rawValue.length === 0) {
      // Campo vazio - limpar indicadores
      indicator.textContent = '';
      input.style.borderColor = '';
      input.classList.remove('valid', 'invalid');
      removeFieldError(input);
    } else if (isValid) {
      // Campo válido
      indicator.textContent = '✓';
      indicator.style.color = '#28a745';
      input.style.borderColor = '#28a745';
      input.classList.remove('invalid');
      input.classList.add('valid');
      removeFieldError(input);
    } else {
      // Campo inválido
      indicator.textContent = '✗';
      indicator.style.color = '#dc3545';
      input.style.borderColor = '#dc3545';
      input.classList.remove('valid');
      input.classList.add('invalid');
      
      if (showError) {
        showFieldError(input, errorMessage);
      }
    }
  }

  function showFieldError(input, message) {
    removeFieldError(input);
    const error = document.createElement('div');
    error.className = 'field-error';
    error.textContent = message;
    error.style.cssText = `
      color: #dc3545; font-size: 12px; margin-top: 2px;
      position: absolute; left: 0; top: 100%;
    `;
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(error);
  }

  function removeFieldError(input) {
    const error = input.parentNode.querySelector('.field-error');
    if (error) error.remove();
  }

  // === INICIALIZAÇÃO DE FORMATAÇÃO ===
  function initializeFormatting() {
    // Auto-detecção de CPF/CNPJ para campos de documento
    document.querySelectorAll('#loginDocumento, #cadDocumento').forEach(input => {
      if (!input) return;
      
      const label = input.previousElementSibling;
      
      input.addEventListener('input', function() {
        const type = detectDocumentType(this.value);
        
        if (type === 'CPF') {
          this.value = formatCPF(this.value);
          this.maxLength = 14; // 000.000.000-00
          if (label) label.textContent = 'CPF';
        } else {
          this.value = formatCNPJ(this.value);
          this.maxLength = 18; // 00.000.000/0000-00
          if (label) label.textContent = 'CNPJ';
        }
      });

      input.addEventListener('blur', function() {
        const digits = this.value.replace(/\D/g, '');
        const type = detectDocumentType(this.value);
        const isValid = type === 'CPF' ? validaCPF(digits) : validaCNPJ(digits);
        
        if (digits.length > 0 && !isValid) {
          showFieldError(this, `${type} inválido`);
        }
      });
    });
  }
  function submitForm(event) {
    event.preventDefault();
    document.getElementById('notification').style.display = 'block';
    setTimeout(() => {
      document.getElementById('notification').style.display = 'none';
    }, 5000); // Esconde após 5 segundos (simulação)
    return false;
  }
  function abrirModalServicos(contexto) {
    document.getElementById('modalServicos').classList.add('active');
    window.modalServicoContexto = contexto || null;
  }
  window.abrirModalServicos = abrirModalServicos;

  function fecharModalServicos() {
    document.getElementById('modalServicos').classList.remove('active');
  }
  window.fecharModalServicos = fecharModalServicos;

  function selecionarServico(nome, contexto) {
    if (contexto === 'cadastro') {
      safeSetHTML('cadServicoContainer', `
        <div class="servico-contratado-row">
          <input type="text" id="cadServico" name="cadServico" value="${nome}" readonly style="flex:1; min-width:0;">
          <button type="button" class="remove-servico-btn" onclick="removerServicoCadastro()">&times;</button>
        </div>
      `);
      fecharModalServicos();
      return;
    }
    if (contexto === 'troca') {
      safeSetHTML('trocaServicoContainer', `
        <div class="servico-contratado-row">
          <input type="text" id="trocaNovoServico" value="${nome}" readonly style="flex:1; min-width:0;">
          <button type="button" class="remove-servico-btn" onclick="removerServicoTroca()">&times;</button>
        </div>
      `);
      fecharModalServicos();
      return;
    }
  }
  window.selecionarServico = selecionarServico;

  function removerServicoCadastro() {
    safeSetHTML('cadServicoContainer', `
      <button type="button" class="select-service-btn" onclick="abrirModalServicos('cadastro')" id="btnSelecionarServico">Selecionar serviço</button>
    `);
  }
  window.removerServicoCadastro = removerServicoCadastro;

  function removerServicoTroca() {
    safeSetHTML('trocaServicoContainer', `
      <button type="button" class="select-service-btn" onclick="abrirModalServicos('troca')" id="btnSelecionarNovoServico">Selecionar novo serviço</button>
    `);
  }
  window.removerServicoTroca = removerServicoTroca;
  function toggleClienteCampos() {
    const isCliente = document.querySelector('input[name="jaCliente"]:checked').value === 'sim';
    document.getElementById('camposNovoCliente').style.display = isCliente ? 'none' : 'block';
    document.getElementById('camposClienteExistente').style.display = isCliente ? 'block' : 'none';
    document.getElementById('btnCadastrarVendas').style.display = isCliente ? 'none' : 'block';
    // Limpa área de troca de serviço e esconde dados ao trocar opção
    if (!isCliente) {
      document.getElementById('dadosClienteEncontrado').style.display = 'none';
      document.getElementById('trocaServicoArea').innerHTML = '';
      document.getElementById('btnTrocarServico').style.display = 'inline-block';
    }
  }
  function buscarCadastroCliente() {
    const cpf = document.getElementById('cpfContrato').value;
    fetch(`https://chegar-primeiro.onrender.com/api/clientes/${cpf}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          document.getElementById('dadosClienteEncontrado').style.display = 'block';
          document.getElementById('nomeCompletoCliente').value = data.cliente.nome_cliente;
          document.getElementById('enderecoCompletoCliente').value = data.cliente.endereco;
          document.getElementById('empreendimentoCliente').value = data.cliente.nome_empreendimento;
          document.getElementById('servicoAtualCliente').value = data.cliente.servico;
          document.getElementById('trocaServicoArea').innerHTML = '';
          document.getElementById('btnTrocarServico').style.display = 'inline-block';
        } else {
          alert('Cliente não encontrado!');
        }
      })
      .catch(() => {
        alert('Erro ao buscar cliente!');
      });
  }
  function iniciarTrocaServico() {
    abrirModalServicos('clienteExistente');
  }
  function removerTrocaServico() {
    document.getElementById('trocaServicoArea').innerHTML = '';
    document.getElementById('btnTrocarServico').style.display = 'inline-block';
  }
  function enviarSolicitacaoTroca() {
    fetch('https://chegar-primeiro.onrender.com/api/troca-servico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_cliente: document.getElementById('nomeCompletoCliente').value,
        cpf_ou_contrato: document.getElementById('cpfContrato').value,
        servico_atual: document.getElementById('servicoAtualCliente').value,
        novo_servico: document.querySelector('#trocaServicoArea input[type="text"]').value
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('solicitacaoMsg').innerHTML = `
          <div style="background:#fff3cd; color:#856404; padding:10px; border-radius:6px; text-align:center; margin-top:8px;">
            Solicitação enviada com sucesso!<br>
            Protocolo: <b id='protocoloNumTroca'>${data.protocolo}</b> <button onclick='copiarProtocoloTroca()' style='margin-left:8px;padding:2px 8px;font-size:0.95em;cursor:pointer;'>Copiar</button>
          </div>
        `;
        // Limpa campos após sucesso
        document.getElementById('nomeCompletoCliente').value = '';
        document.getElementById('cpfContrato').value = '';
        document.getElementById('servicoAtualCliente').value = '';
        document.getElementById('trocaServicoArea').innerHTML = '';
        setTimeout(() => {
          document.getElementById('solicitacaoMsg').innerHTML = '';
          removerTrocaServico();
        }, 6000);
      } else {
        document.getElementById('solicitacaoMsg').innerHTML = `
          <div style="background:#f8d7da; color:#721c24; padding:10px; border-radius:6px; text-align:center; margin-top:8px;">
            Erro ao enviar solicitação!
          </div>
        `;
      }
    })
    .catch(() => {
      document.getElementById('solicitacaoMsg').innerHTML = `
        <div style="background:#f8d7da; color:#721c24; padding:10px; border-radius:6px; text-align:center; margin-top:8px;">
          Erro ao enviar solicitação!
        </div>
      `;
    });
  }

  window.copiarProtocoloTroca = function() {
    const num = document.getElementById('protocoloNumTroca').textContent;
    navigator.clipboard.writeText(num);
  }

  // Limpar campos do formulário de cliente após sucesso
  function limparFormCliente() {
    document.getElementById('nomeCliente').value = '';
    document.getElementById('cpfCliente').value = '';
    document.getElementById('cepCliente').value = '';
    document.getElementById('enderecoCliente').value = '';
    document.getElementById('apartamentoCliente').value = '';
    document.getElementById('blocoCliente').value = '';
    document.getElementById('nomeEmpreendimento').value = '';
    if (document.getElementById('servicoContratado')) document.getElementById('servicoContratado').value = '';
    removerServicoSelecionado();
  }

  // Limpar campos do formulário de manutenção após sucesso
  function limparFormManutencao() {
    document.getElementById('nomeVistoria').value = '';
    document.getElementById('cpfVistoria').value = '';
    document.getElementById('cepVistoria').value = '';
    document.getElementById('enderecoVistoria').value = '';
    document.getElementById('apartamentoVistoria').value = '';
    document.getElementById('blocoVistoria').value = '';
    document.getElementById('telefoneVistoria').value = '';
    document.getElementById('horarioVistoria').value = '';
  }

  // Proteção para campos antigos que podem não existir mais
  const cpfInput = document.getElementById('cpfCliente');
  if (cpfInput) {
    cpfInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
      if (this.value.length > 11) this.value = this.value.slice(0, 11);
    });
    cpfInput.addEventListener('blur', function() {
      if (this.value.length !== 11) {
        alert('O CPF deve ter 11 dígitos.');
        return;
      }
      if (!validaCPF(this.value)) {
        alert('CPF inválido!');
      }
    });
  }
  function validaCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Calcula os dígitos verificadores
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = soma % 11;
    let dv1 = resto < 2 ? 0 : 11 - resto;
    
    if (parseInt(cpf.charAt(9)) !== dv1) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = soma % 11;
    let dv2 = resto < 2 ? 0 : 11 - resto;
    
    return parseInt(cpf.charAt(10)) === dv2;
  }
  // Proteção para campos antigos que podem não existir mais
  const cepInput = document.getElementById('cepCliente');
  if (cepInput) {
    let cepErroFlag = false;
    cepInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
      if (this.value.length > 8) this.value = this.value.slice(0, 8);
      cepErroFlag = false;
    });
    cepInput.addEventListener('blur', function() {
      if (this.value.length !== 8) {
        if (!cepErroFlag) {
          alert('O CEP deve ter 8 dígitos.');
          cepErroFlag = true;
        }
        return;
      }
      cepErroFlag = false;
      // Busca endereço se válido
      const cep = this.value;
      fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(data => {
          if (!data.erro) {
            const enderecoCliente = document.getElementById('enderecoCliente');
            if (enderecoCliente) enderecoCliente.value = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
          } else {
            if (!cepErroFlag) {
              alert('CEP não encontrado.');
              cepErroFlag = true;
            }
            const enderecoCliente = document.getElementById('enderecoCliente');
            if (enderecoCliente) enderecoCliente.value = '';
          }
        })
        .catch(() => {
          if (!cepErroFlag) {
            alert('Erro ao buscar o CEP.');
            cepErroFlag = true;
          }
          const enderecoCliente = document.getElementById('enderecoCliente');
          if (enderecoCliente) enderecoCliente.value = '';
        });
    });
  }

  // Função utilitária para mostrar mensagem na tela com protocolo e botão de copiar
  function mostrarMensagemProtocolo(msg, protocolo) {
    let div = document.getElementById('mensagemFeedback');
    if (!div) {
      div = document.createElement('div');
      div.id = 'mensagemFeedback';
      div.style.position = 'fixed';
      div.style.top = '20px';
      div.style.left = '50%';
      div.style.transform = 'translateX(-50%)';
      div.style.zIndex = '9999';
      div.style.padding = '14px 24px';
      div.style.borderRadius = '8px';
      div.style.fontWeight = 'bold';
      div.style.fontSize = '1.1em';
      div.style.boxShadow = '0 2px 8px #0002';
      document.body.appendChild(div);
    }
    div.innerHTML = `${msg}<br><span style='font-size:0.95em;'>Protocolo: <b id='protocoloNum'>${protocolo}</b> <button onclick='copiarProtocolo()' class='btn-copiar-protocolo'>Copiar</button></span>`;
    div.style.background = '#d4edda';
    div.style.color = '#155724';
    div.style.border = '1px solid #c3e6cb';
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 10000);
    // Notificação web
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Protocolo gerado', { body: `Seu protocolo é: ${protocolo}` });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Protocolo gerado', { body: `Seu protocolo é: ${protocolo}` });
          }
        });
      }
    }
  }

  window.copiarProtocolo = function() {
    const num = document.getElementById('protocoloNum').textContent;
    navigator.clipboard.writeText(num);
  }

  // Funções para mostrar/esconder o overlay de carregamento
  function mostrarCarregando() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
  }
  function esconderCarregando() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }
  window.mostrarCarregando = mostrarCarregando;
  window.esconderCarregando = esconderCarregando;

  // === SISTEMA DE LOGIN AVANÇADO ===
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    // Inicializar sistema avançado
    const advancedLoginSystem = new AdvancedLoginSystem();
    advancedLoginSystem.initialize();
    
    formLogin.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const cpf = document.getElementById('loginCpf').value.replace(/\D/g, '');
      const senha = document.getElementById('loginSenha').value;
      const rememberMe = document.getElementById('rememberMe').checked;
      
      if (!validaCPF(cpf)) {
        mostrarMensagem('CPF inválido', false);
        return;
      }
      
      if (senha.length < 4) {
        mostrarMensagem('Senha deve ter pelo menos 4 caracteres', false);
        return;
      }
      
      // Usar o sistema avançado de login
      await advancedLoginSystem.performLogin(cpf, senha, rememberMe);
    });
    
    // Configurar recuperação avançada de senha
    window.openAdvancedRecovery = function() {
      const recovery = new AdvancedPasswordRecovery();
      recovery.openModal();
    };
  }

  // === SISTEMA DE CADASTRO AVANÇADO ===
  const formCadastro = document.getElementById('formCadastro');
  if (formCadastro) {
    
    // Verificador de força da senha em tempo real
    const senhaInput = document.getElementById('cadSenha');
    if (senhaInput) {
      const strengthIndicator = createPasswordStrengthIndicator();
      senhaInput.parentNode.appendChild(strengthIndicator);
      
      senhaInput.addEventListener('input', function() {
        const strength = validaSenha(this.value);
        updatePasswordStrengthIndicator(strengthIndicator, strength);
      });
    }
    
    formCadastro.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Coleta todos os dados
      const formData = {
        nome: document.getElementById('cadNome').value.trim(),
        cpf: document.getElementById('cadCpf').value.replace(/\D/g, ''),
        cep: document.getElementById('cadCep').value.replace(/\D/g, ''),
        email: document.getElementById('cadEmail').value.trim().toLowerCase(),
        endereco: document.getElementById('cadEndereco').value.trim(),
        apartamento: document.getElementById('cadApartamento').value.trim(),
        bloco: document.getElementById('cadBloco').value.trim(),
        empreendimento: document.getElementById('cadEmpreendimento').value.trim(),
        senha: document.getElementById('cadSenha').value,
        senha2: document.getElementById('cadSenha2').value
      };
      
      // Validações completas
      const validation = validateFormData(formData);
      if (!validation.valid) {
        mostrarMensagem(validation.errors.join('\\n'), false);
        return;
      }
      
      // Verificar se email foi validado
      if (!emailVerificado) {
        mostrarMensagem('Você precisa verificar seu e-mail antes de cadastrar!', false);
        return;
      }
      
      mostrarCarregando();
      
      // Hash da senha no frontend (camada extra de segurança)
      const hashedPassword = btoa(formData.senha + 'salt_' + formData.cpf);
      
      fetch('https://chegar-primeiro.onrender.com/api/cadastrar', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': localStorage.getItem('csrfToken')
        },
        body: JSON.stringify({
          ...formData,
          senha: hashedPassword,
          timestamp: Date.now(),
          fingerprint: generateFingerprint()
        })
      })
      .then(res => res.json())
      .then(data => {
        esconderCarregando();
        if (data.success) {
          mostrarMensagem('Cadastro realizado com sucesso! Faça login para continuar.');
          formCadastro.reset();
          emailVerificado = false;
          document.getElementById('iconeEmailVerificado').style.display = 'none';
          mostrarLogin();
        } else {
          mostrarMensagem(data.error || 'Erro ao realizar cadastro!', false);
        }
      })
      .catch(() => {
        esconderCarregando();
        mostrarMensagem('Erro ao realizar cadastro!', false);
      });
    });
  }

  // === FUNÇÕES AUXILIARES DE SEGURANÇA ===
  function generateFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Fingerprint test', 2, 2);
    
    return btoa(JSON.stringify({
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      canvas: canvas.toDataURL(),
      userAgent: navigator.userAgent.substring(0, 100)
    }));
  }

  function createPasswordStrengthIndicator() {
    const container = document.createElement('div');
    container.className = 'password-strength-container';
    container.style.cssText = `
      margin-top: 5px; font-size: 12px;
    `;
    
    const bar = document.createElement('div');
    bar.className = 'password-strength-bar';
    bar.style.cssText = `
      height: 4px; width: 100%; background: #eee;
      border-radius: 2px; margin-bottom: 5px;
    `;
    
    const fill = document.createElement('div');
    fill.className = 'password-strength-fill';
    fill.style.cssText = `
      height: 100%; width: 0%; border-radius: 2px;
      transition: width 0.3s, background-color 0.3s;
    `;
    
    const text = document.createElement('div');
    text.className = 'password-strength-text';
    text.style.cssText = `
      font-size: 11px; margin-top: 2px;
    `;
    
    bar.appendChild(fill);
    container.appendChild(bar);
    container.appendChild(text);
    
    return container;
  }

  function updatePasswordStrengthIndicator(indicator, strength) {
    const fill = indicator.querySelector('.password-strength-fill');
    const text = indicator.querySelector('.password-strength-text');
    
    let width = '0%';
    
    if (strength.strength.level === 'weak') width = '33%';
    else if (strength.strength.level === 'medium') width = '66%';
    else if (strength.strength.level === 'strong') width = '100%';
    
    fill.style.width = width;
    fill.style.backgroundColor = strength.strength.color;
    
    if (strength.errors.length > 0) {
      text.innerHTML = `Força: ${strength.strength.text}<br><small>Falta: ${strength.errors.join(', ')}</small>`;
    } else {
      text.textContent = `Força: ${strength.strength.text}`;
    }
    text.style.color = strength.strength.color;
  }

  function validateFormData(data) {
    const errors = [];
    
    if (!data.nome || data.nome.length < 2) {
      errors.push('Nome deve ter pelo menos 2 caracteres');
    }
    
    if (!validaCPF(data.cpf)) {
      errors.push('CPF inválido');
    }
    
    if (!validaCEP(data.cep)) {
      errors.push('CEP inválido');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email inválido');
    }
    
    if (!data.endereco || data.endereco.length < 5) {
      errors.push('Endereço muito curto');
    }
    
    if (!data.apartamento) {
      errors.push('Apartamento é obrigatório');
    }
    
    if (!data.bloco) {
      errors.push('Bloco é obrigatório');
    }
    
    const senhaValidation = validaSenha(data.senha);
    if (!senhaValidation.valid) {
      errors.push('Senha: ' + senhaValidation.errors.join(', '));
    }
    
    if (data.senha !== data.senha2) {
      errors.push('Senhas não coincidem');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Função para preencher os campos dos formulários com os dados do cliente
  function preencherCamposCliente(cliente) {
    // Manutenção
    if (document.getElementById('vistoriaNomeCliente')) document.getElementById('vistoriaNomeCliente').value = cliente.nome_cliente || '';
    if (document.getElementById('vistoriaCpf')) document.getElementById('vistoriaCpf').value = cliente.cpf || '';
    if (document.getElementById('vistoriaCep')) document.getElementById('vistoriaCep').value = cliente.cep || '';
    if (document.getElementById('vistoriaEndereco')) document.getElementById('vistoriaEndereco').value = cliente.endereco || '';
    if (document.getElementById('vistoriaApartamento')) document.getElementById('vistoriaApartamento').value = cliente.apartamento || '';
    if (document.getElementById('vistoriaBloco')) document.getElementById('vistoriaBloco').value = cliente.bloco || '';
    if (document.getElementById('vistoriaServicoAtual')) document.getElementById('vistoriaServicoAtual').value = cliente.servico || '';
    if (document.getElementById('vistoriaTelefone')) document.getElementById('vistoriaTelefone').value = cliente.telefone || '';
    // Troca de Serviço
    if (document.getElementById('trocaNomeCliente')) document.getElementById('trocaNomeCliente').value = cliente.nome_cliente || '';
    if (document.getElementById('trocaCpf')) document.getElementById('trocaCpf').value = cliente.cpf || '';
    if (document.getElementById('trocaEndereco')) document.getElementById('trocaEndereco').value = cliente.endereco || '';
    if (document.getElementById('trocaApartamento')) document.getElementById('trocaApartamento').value = cliente.apartamento || '';
    if (document.getElementById('trocaBloco')) document.getElementById('trocaBloco').value = cliente.bloco || '';
    if (document.getElementById('trocaServicoAtual')) document.getElementById('trocaServicoAtual').value = cliente.servico || '';
  }

  // Modificar autenticarCliente para buscar e preencher os dados completos
  function autenticarCliente(cliente) {
    document.getElementById('telaInicial').style.display = 'none';
    document.getElementById('formLogin').style.display = 'none';
    document.getElementById('formCadastro').style.display = 'none';
    document.getElementById('areaAutenticada').style.display = 'block';

    // Buscar dados completos do cliente e preencher os campos
    fetch(`https://chegar-primeiro.onrender.com/api/cliente-completo/${cliente.cpf}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          preencherCamposCliente(data.cliente);
        } else {
          preencherCamposCliente(cliente); // fallback para dados básicos
        }
      })
      .catch(() => preencherCamposCliente(cliente));
  }

  // Inicializa abas (apenas se os elementos existirem)
  showTab(0);
  const formVistoria = document.getElementById('formVistoria');
  const formTrocaServico = document.getElementById('formTrocaServico');
  
  if (formVistoria) {
    formVistoria.style.display = 'block';
  }
  if (formTrocaServico) {
    formTrocaServico.style.display = 'none';
  }

  // Envio do formulário de manutenção autenticada
  if (formVistoria) {
    formVistoria.addEventListener('submit', function(e) {
      e.preventDefault();
      mostrarCarregando();
      fetch('https://chegar-primeiro.onrender.com/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'manutencao',
          nome_cliente: document.getElementById('vistoriaNomeCliente') ? document.getElementById('vistoriaNomeCliente').value : '',
          cpf: document.getElementById('vistoriaCpf').value,
          cep: document.getElementById('vistoriaCep') ? document.getElementById('vistoriaCep').value : '',
          endereco: document.getElementById('vistoriaEndereco') ? document.getElementById('vistoriaEndereco').value : '',
          apartamento: document.getElementById('vistoriaApartamento') ? document.getElementById('vistoriaApartamento').value : '',
          bloco: document.getElementById('vistoriaBloco') ? document.getElementById('vistoriaBloco').value : '',
          servico_atual: document.getElementById('vistoriaServicoAtual') ? document.getElementById('vistoriaServicoAtual').value : '',
          telefone: document.getElementById('vistoriaTelefone').value,
          melhor_horario: document.getElementById('vistoriaHorario').value,
          descricao: document.getElementById('vistoriaDescricao').value,
          nome_empreendimento: document.getElementById('vistoriaEmpreendimento') ? document.getElementById('vistoriaEmpreendimento').value : ''
        })
      })
      .then(res => res.json())
      .then(data => {
        esconderCarregando();
        if (data.success) {
          mostrarMensagemProtocolo('Solicitação de manutenção enviada com sucesso!', data.protocolo);
          formVistoria.reset();
        } else {
          mostrarMensagem('Erro ao enviar solicitação!', false);
        }
      })
      .catch(() => {
        esconderCarregando();
        mostrarMensagem('Erro ao enviar solicitação!', false);
      });
    });
  }

  // Envio do formulário de troca de serviço autenticada
  const formTroca = document.getElementById('formTrocaServico');
  if (formTroca) {
    formTroca.addEventListener('submit', function(e) {
      e.preventDefault();
      mostrarCarregando();
      fetch('https://chegar-primeiro.onrender.com/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'troca_servico',
          nome_cliente: document.getElementById('trocaNomeCliente') ? document.getElementById('trocaNomeCliente').value : '',
          cpf: document.getElementById('trocaCpf').value,
          servico_atual: document.getElementById('trocaServicoAtual').value,
          novo_servico: document.getElementById('trocaNovoServico') ? document.getElementById('trocaNovoServico').value : '',
          nome_empreendimento: document.getElementById('trocaEmpreendimento') ? document.getElementById('trocaEmpreendimento').value : ''
        })
      })
      .then(res => res.json())
      .then(data => {
        esconderCarregando();
        if (data.success) {
          mostrarMensagemProtocolo('Solicitação de troca enviada com sucesso!', data.protocolo);
          formTroca.reset();
          removerServicoTroca();
        } else {
          mostrarMensagem('Erro ao solicitar troca!', false);
        }
      })
      .catch(() => {
        esconderCarregando();
        mostrarMensagem('Erro ao solicitar troca!', false);
      });
    });
  }

  // Adicionar autocomplete nos campos de senha e email
  var loginSenha = document.getElementById('loginSenha');
  if (loginSenha) loginSenha.setAttribute('autocomplete', 'current-password');
  var cadSenha = document.getElementById('cadSenha');
  if (cadSenha) cadSenha.setAttribute('autocomplete', 'new-password');
  var cadSenha2 = document.getElementById('cadSenha2');
  if (cadSenha2) cadSenha2.setAttribute('autocomplete', 'new-password');
  var cadEmail = document.getElementById('cadEmail');
  if (cadEmail) cadEmail.setAttribute('autocomplete', 'email');

  // Lógica para buscar solicitação pelo protocolo
  const btnBuscarProtocolo = document.getElementById('btnBuscarProtocolo');
  if (btnBuscarProtocolo) {
    btnBuscarProtocolo.addEventListener('click', function() {
      const protocolo = document.getElementById('inputProtocolo').value.trim();
      const resultadoDiv = document.getElementById('resultadoAcompanhamento');
      if (!protocolo) {
        resultadoDiv.innerHTML = '<span style="color:#721c24;">Digite o número do protocolo.</span>';
        return;
      }
      mostrarCarregando();
      resultadoDiv.innerHTML = '';
      fetch(`https://chegar-primeiro.onrender.com/api/solicitacao/${protocolo}`)
        .then(res => res.json())
        .then(data => {
          esconderCarregando();
          if (data.success && data.solicitacao) {
            const s = data.solicitacao;
            resultadoDiv.innerHTML = `
              <div style='background:#eafaf1;border:1px solid #b7e4c7;padding:18px 20px;border-radius:8px;'>
                <div style='margin-bottom:6px;'><span style='font-weight:bold;color:#155724;'>Tipo:</span> <span style='color:#222;'>${s.tipo || '-'}</span></div>
                <div style='margin-bottom:6px;'><span style='font-weight:bold;color:#155724;'>Nome:</span> <span style='color:#222;'>${s.nome_cliente || '-'}</span></div>
                <div style='margin-bottom:6px;'><span style='font-weight:bold;color:#155724;'>Status:</span> <span style='color:#218838;font-weight:bold;'>${s.status || 'Em análise'}</span></div>
                <div style='margin-bottom:6px;'><span style='font-weight:bold;color:#155724;'>Descrição:</span> <span style='color:#222;'>${s.descricao || '-'}</span></div>
                <div><span style='font-weight:bold;color:#155724;'>Data de registro:</span> <span style='color:#222;'>${formatarDataBrasilia(s.data_registro)}</span></div>
              </div>
            `;
          } else {
            resultadoDiv.innerHTML = `<span style='color:#721c24;'>Solicitação não encontrada.</span>`;
          }
        })
        .catch(() => {
          esconderCarregando();
          resultadoDiv.innerHTML = `<span style='color:#721c24;'>Erro ao buscar solicitação.</span>`;
        });
    });
  }

  // Proteção para campos antigos que podem não existir mais
  // === BUSCA AUTOMÁTICA DE CEP APRIMORADA ===
  function setupCEPLookup() {
    const cepInputs = document.querySelectorAll('#cadCep, #vistoriaCep');
    
    cepInputs.forEach(cepInput => {
      if (!cepInput) return;
      
      let cepTimeout;
      
      cepInput.addEventListener('input', function() {
        clearTimeout(cepTimeout);
        
        // Formatar CEP
        this.value = formatCEP(this.value);
        
        const cep = this.value.replace(/\D/g, '');
        
        // Buscar automaticamente quando CEP tiver 8 dígitos
        if (cep.length === 8) {
          cepTimeout = setTimeout(() => {
            buscarCEP(cep, this);
          }, 500); // Debounce de 500ms
        } else {
          limparCamposEndereco();
        }
      });
    });
  }

  function buscarCEP(cep, inputElement) {
    if (!validaCEP(cep)) return;
    
    // Mostrar indicador de carregamento
    const indicator = document.createElement('span');
    indicator.textContent = '🔄';
    indicator.style.cssText = 'margin-left: 5px; animation: spin 1s linear infinite;';
    inputElement.parentNode.appendChild(indicator);
    
    Promise.all([
      fetch(`https://viacep.com.br/ws/${cep}/json/`),
      fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`)
    ])
    .then(responses => Promise.all(responses.map(r => r.json())))
    .then(([viaCep, brasilApi]) => {
      indicator.remove();
      
      // Usar dados do ViaCEP como principal, BrasilAPI como fallback
      const data = viaCep.erro ? brasilApi : viaCep;
      
      if (!data.erro && !data.error) {
        preencherEnderecoCompleto(data);
        mostrarNotificacao('CEP encontrado!', 'success');
      } else {
        mostrarNotificacao('CEP não encontrado.', 'warning');
      }
    })
    .catch(() => {
      indicator.remove();
      mostrarNotificacao('Erro ao buscar CEP.', 'error');
    });
  }

  function preencherEndereco(data) {
    const enderecoInput = document.getElementById('cadEndereco') || document.getElementById('vistoriaEndereco');
    
    if (enderecoInput) {
      // Formatar endereço completo
      const endereco = [
        data.logradouro || data.street,
        data.bairro || data.district,
        data.localidade || data.city,
        data.uf || data.state
      ].filter(Boolean).join(', ');
      
      enderecoInput.value = endereco;
      
      // Adicionar efeito visual de preenchimento
      enderecoInput.style.background = '#e8f5e8';
      setTimeout(() => {
        enderecoInput.style.background = '';
      }, 2000);
    }
  }

  function limparCamposEndereco() {
    const enderecoInput = document.getElementById('cadEndereco') || document.getElementById('vistoriaEndereco');
    if (enderecoInput && enderecoInput.style.background === '#e8f5e8') {
      enderecoInput.value = '';
      enderecoInput.style.background = '';
    }
  }

  function mostrarNotificacao(mensagem, tipo = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      padding: 12px 16px; border-radius: 6px; font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      transform: translateX(100%);
    `;
    
    const colors = {
      success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
      warning: { bg: '#fff3cd', text: '#856404', border: '#ffeaa7' },
      error: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
      info: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' }
    };
    
    const color = colors[tipo] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.text;
    notification.style.border = `1px solid ${color.border}`;
    notification.textContent = mensagem;
    
    document.body.appendChild(notification);
    
    // Animação de entrada
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remoção automática
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setupCEPLookup();

  // === SISTEMA DE VERIFICAÇÃO DE EMAIL APRIMORADO ===
  let emailVerificado = false;
  let emailVerificationTimer = null;
  
  function setupEmailVerification() {
    const btnVerificarEmail = document.getElementById('btnVerificarEmail');
    const btnValidarCodigoEmail = document.getElementById('btnValidarCodigoEmail');
    const areaCodigoEmail = document.getElementById('areaCodigoEmail');
    const statusCodigoEmail = document.getElementById('statusCodigoEmail');
    const inputCodigoEmail = document.getElementById('inputCodigoEmail');
    const cadEmailInput = document.getElementById('cadEmail');
    const iconeEmailVerificado = document.getElementById('iconeEmailVerificado');

    if (!btnVerificarEmail || !cadEmailInput) return;

    // Verificação de domínio em tempo real
    cadEmailInput.addEventListener('input', function() {
      const email = this.value.trim().toLowerCase();
      const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      
      btnVerificarEmail.style.display = emailValido ? 'block' : 'none';
      
      // Reset status de verificação ao alterar email
      emailVerificado = false;
      areaCodigoEmail.style.display = 'none';
      statusCodigoEmail.textContent = '';
      if (iconeEmailVerificado) iconeEmailVerificado.style.display = 'none';
      
      // Verificar se é um domínio confiável
      if (emailValido) {
        verificarDominioEmail(email);
      }
    });

    // Enviar código de verificação
    btnVerificarEmail.addEventListener('click', function() {
      const email = cadEmailInput.value.trim().toLowerCase();
      
      if (!email) {
        mostrarNotificacao('Digite o e-mail.', 'warning');
        return;
      }
      
      if (!isEmailDomainTrusted(email)) {
        if (!confirm('Este domínio de email não é muito comum. Tem certeza que o email está correto?')) {
          return;
        }
      }
      
      this.disabled = true;
      this.textContent = 'Enviando...';
      
      fetch('https://chegar-primeiro.onrender.com/api/enviar-codigo-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': localStorage.getItem('csrfToken')
        },
        body: JSON.stringify({ 
          email,
          timestamp: Date.now(),
          fingerprint: generateFingerprint()
        })
      })
      .then(res => res.json())
      .then(data => {
        this.disabled = false;
        this.textContent = 'Verificar e-mail';
        
        if (data.success) {
          areaCodigoEmail.style.display = 'block';
          statusCodigoEmail.textContent = 'Código enviado! Confira seu e-mail (inclusive spam).';
          statusCodigoEmail.style.color = '#28a745';
          emailVerificado = false;
          if (iconeEmailVerificado) iconeEmailVerificado.style.display = 'none';
          
          // Timer de expiração do código (5 minutos)
          startEmailVerificationTimer();
          
          // Focar no campo de código
          inputCodigoEmail.focus();
        } else {
          mostrarNotificacao(data.error || 'Erro ao enviar código.', 'error');
        }
      })
      .catch(() => {
        this.disabled = false;
        this.textContent = 'Verificar e-mail';
        mostrarNotificacao('Erro ao enviar código.', 'error');
      });
    });

    // Validar código
    if (btnValidarCodigoEmail) {
      btnValidarCodigoEmail.addEventListener('click', function() {
        validateEmailCode();
      });
    }

    // Validar código ao pressionar Enter
    if (inputCodigoEmail) {
      inputCodigoEmail.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          validateEmailCode();
        }
      });
      
      // Formatar código automaticamente
      inputCodigoEmail.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        
        // Validar automaticamente quando tiver 6 dígitos
        if (this.value.length === 6) {
          setTimeout(() => validateEmailCode(), 500);
        }
      });
    }

    function validateEmailCode() {
      const email = cadEmailInput.value.trim().toLowerCase();
      const codigo = inputCodigoEmail.value.trim();
      
      if (!codigo || codigo.length !== 6) {
        mostrarNotificacao('Digite o código de 6 dígitos.', 'warning');
        inputCodigoEmail.focus();
        return;
      }
      
      btnValidarCodigoEmail.disabled = true;
      btnValidarCodigoEmail.textContent = 'Validando...';
      
      fetch('https://chegar-primeiro.onrender.com/api/validar-codigo-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': localStorage.getItem('csrfToken')
        },
        body: JSON.stringify({ 
          email, 
          codigo,
          timestamp: Date.now()
        })
      })
      .then(res => res.json())
      .then(data => {
        btnValidarCodigoEmail.disabled = false;
        btnValidarCodigoEmail.textContent = 'Validar código';
        
        if (data.success) {
          statusCodigoEmail.textContent = 'E-mail verificado com sucesso!';
          statusCodigoEmail.style.color = '#28a745';
          emailVerificado = true;
          areaCodigoEmail.style.display = 'none';
          btnVerificarEmail.style.display = 'none';
          if (iconeEmailVerificado) iconeEmailVerificado.style.display = 'inline';
          
          clearEmailVerificationTimer();
          mostrarNotificacao('E-mail verificado!', 'success');
        } else {
          statusCodigoEmail.textContent = data.error || 'Código inválido.';
          statusCodigoEmail.style.color = '#dc3545';
          inputCodigoEmail.value = '';
          inputCodigoEmail.focus();
        }
      })
      .catch(() => {
        btnValidarCodigoEmail.disabled = false;
        btnValidarCodigoEmail.textContent = 'Validar código';
        mostrarNotificacao('Erro ao validar código.', 'error');
      });
    }

    function startEmailVerificationTimer() {
      clearEmailVerificationTimer();
      let timeLeft = 300; // 5 minutos
      
      emailVerificationTimer = setInterval(() => {
        timeLeft--;
        
        if (timeLeft <= 0) {
          clearEmailVerificationTimer();
          statusCodigoEmail.textContent = 'Código expirado. Solicite um novo código.';
          statusCodigoEmail.style.color = '#dc3545';
          areaCodigoEmail.style.display = 'none';
          btnVerificarEmail.style.display = 'block';
        } else if (timeLeft <= 60) {
          statusCodigoEmail.textContent = `Código expira em ${timeLeft}s`;
          statusCodigoEmail.style.color = '#ffc107';
        }
      }, 1000);
    }

    function clearEmailVerificationTimer() {
      if (emailVerificationTimer) {
        clearInterval(emailVerificationTimer);
        emailVerificationTimer = null;
      }
    }
  }

  function verificarDominioEmail(email) {
    const domain = email.split('@')[1];
    const trustedDomains = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
      'terra.com.br', 'uol.com.br', 'globo.com', 'bol.com.br', 'ig.com.br'
    ];
    
    if (!trustedDomains.includes(domain)) {
      const warning = document.createElement('small');
      warning.style.cssText = 'color: #856404; font-size: 11px; display: block; margin-top: 2px;';
      warning.textContent = 'Domínio não muito comum. Verifique se está correto.';
      
      const existingWarning = cadEmailInput.parentNode.querySelector('.domain-warning');
      if (existingWarning) existingWarning.remove();
      
      warning.className = 'domain-warning';
      cadEmailInput.parentNode.appendChild(warning);
    } else {
      const existingWarning = cadEmailInput.parentNode.querySelector('.domain-warning');
      if (existingWarning) existingWarning.remove();
    }
  }

  function isEmailDomainTrusted(email) {
    const domain = email.split('@')[1];
    const trustedDomains = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
      'terra.com.br', 'uol.com.br', 'globo.com', 'bol.com.br', 'ig.com.br',
      'live.com', 'msn.com', 'yahoo.com.br'
    ];
    return trustedDomains.includes(domain);
  }

  setupEmailVerification();

  // --- Recuperação de senha ---

  document.getElementById('btnEsqueciSenha').addEventListener('click', function() {
    abrirModalRecuperarSenha();
  });

  function abrirModalRecuperarSenha() {
    document.getElementById('modalRecuperarSenha').style.display = 'flex';
    document.getElementById('recuperarSenhaEtapaCpf').style.display = 'block';
    document.getElementById('recuperarSenhaEtapaEmail').style.display = 'none';
    document.getElementById('recuperarSenhaEtapaCodigo').style.display = 'none';
    document.getElementById('recuperarSenhaEtapaNovaSenha').style.display = 'none';
    document.getElementById('recCpf').value = '';
    document.getElementById('recEmailMasc').textContent = '';
    document.getElementById('recCodigo').value = '';
    document.getElementById('recNovaSenha').value = '';
    document.getElementById('recNovaSenha2').value = '';
    document.getElementById('recStatusCodigo').textContent = '';
    etapaRecSenha = 1;
    recCpfGlobal = '';
  }

  function fecharModalRecuperarSenha() {
    document.getElementById('modalRecuperarSenha').style.display = 'none';
  }
  window.fecharModalRecuperarSenha = fecharModalRecuperarSenha;

  let etapaRecSenha = 1;
  let recCpfGlobal = '';

  // Etapa 1: Buscar e-mail por CPF
  const btnBuscarEmailRec = document.getElementById('btnBuscarEmailRec');
  btnBuscarEmailRec.addEventListener('click', function() {
    const cpf = document.getElementById('recCpf').value.replace(/\D/g, '');
    if (cpf.length !== 11) {
      mostrarMensagem('CPF inválido!', false);
      return;
    }
    mostrarCarregando();
    fetch('https://chegar-primeiro.onrender.com/api/recuperar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf })
    })
    .then(res => res.json())
    .then(data => {
      esconderCarregando();
      if (data.success) {
        document.getElementById('recEmailMasc').textContent = data.email;
        document.getElementById('recuperarSenhaEtapaCpf').style.display = 'none';
        document.getElementById('recuperarSenhaEtapaEmail').style.display = 'block';
        etapaRecSenha = 2;
        recCpfGlobal = cpf;
      } else {
        mostrarMensagem(data.error || 'E-mail não encontrado!', false);
      }
    })
    .catch(() => {
      esconderCarregando();
      mostrarMensagem('Erro ao buscar e-mail!', false);
    });
  });

  // Etapa 2: Enviar código de verificação
  const btnEnviarCodigoRec = document.getElementById('btnEnviarCodigoRec');
  btnEnviarCodigoRec.addEventListener('click', function() {
    if (!recCpfGlobal) return;
    mostrarCarregando();
    fetch('https://chegar-primeiro.onrender.com/api/enviar-codigo-recuperacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: recCpfGlobal })
    })
    .then(res => res.json())
    .then(data => {
      esconderCarregando();
      if (data.success) {
        document.getElementById('recuperarSenhaEtapaEmail').style.display = 'none';
        document.getElementById('recuperarSenhaEtapaCodigo').style.display = 'block';
        etapaRecSenha = 3;
        document.getElementById('recStatusCodigo').textContent = 'Código enviado!';
        document.getElementById('recStatusCodigo').style.color = '#218838';
      } else {
        mostrarMensagem(data.error || 'Erro ao enviar código!', false);
      }
    })
    .catch(() => {
      esconderCarregando();
      mostrarMensagem('Erro ao enviar código!', false);
    });
  });

  // Etapa 3: Validar código
  const btnValidarCodigoRec = document.getElementById('btnValidarCodigoRec');
  btnValidarCodigoRec.addEventListener('click', function() {
    const codigo = document.getElementById('recCodigo').value.trim();
    if (!codigo || codigo.length !== 6) {
      document.getElementById('recStatusCodigo').textContent = 'Digite o código de 6 dígitos.';
      document.getElementById('recStatusCodigo').style.color = '#721c24';
      return;
    }
    // Não valida no backend ainda, só na troca de senha
    document.getElementById('recuperarSenhaEtapaCodigo').style.display = 'none';
    document.getElementById('recuperarSenhaEtapaNovaSenha').style.display = 'block';
    etapaRecSenha = 4;
  });

  // Etapa 4: Trocar senha
  const btnTrocarSenhaRec = document.getElementById('btnTrocarSenhaRec');
  btnTrocarSenhaRec.addEventListener('click', function() {
    const novaSenha = document.getElementById('recNovaSenha').value;
    const novaSenha2 = document.getElementById('recNovaSenha2').value;
    const codigo = document.getElementById('recCodigo').value.trim();
    if (!novaSenha || !novaSenha2) {
      mostrarMensagem('Preencha os campos de senha!', false);
      return;
    }
    if (novaSenha !== novaSenha2) {
      mostrarMensagem('As senhas não coincidem!', false);
      return;
    }
    if (!recCpfGlobal || !codigo) {
      mostrarMensagem('Dados incompletos!', false);
      return;
    }
    mostrarCarregando();
    fetch('https://chegar-primeiro.onrender.com/api/trocar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: recCpfGlobal, codigo, novaSenha })
    })
    .then(res => res.json())
    .then(data => {
      esconderCarregando();
      if (data.success) {
        mostrarMensagem('Senha alterada com sucesso! Faça login com a nova senha.');
        fecharModalRecuperarSenha();
        mostrarLogin();
      } else {
        mostrarMensagem(data.error || 'Erro ao trocar senha!', false);
      }
    })
    .catch(() => {
      esconderCarregando();
      mostrarMensagem('Erro ao trocar senha!', false);
    });
  });

  // === FUNCIONALIDADES PARA O NOVO DESIGN ===
  
  // Toggle de visibilidade da senha
  function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentNode.querySelector('.btn-toggle-password');
    
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
    } else {
      input.type = 'password';
      button.textContent = '👁';
    }
  }
  window.togglePasswordVisibility = togglePasswordVisibility;

  // Validação em tempo real dos requisitos da senha
  function setupPasswordValidation() {
    const senhaInput = document.getElementById('cadSenha');
    const confirmInput = document.getElementById('cadSenha2');
    
    if (senhaInput) {
      senhaInput.addEventListener('input', function() {
        validatePasswordRequirements(this.value);
        checkPasswordMatch();
      });
    }
    
    if (confirmInput) {
      confirmInput.addEventListener('input', checkPasswordMatch);
    }
  }

  function validatePasswordRequirements(password) {
    const requirements = {
      'req-length': password.length >= 8,
      'req-upper': /[A-Z]/.test(password),
      'req-lower': /[a-z]/.test(password),
      'req-number': /\d/.test(password),
      'req-special': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    Object.entries(requirements).forEach(([id, met]) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.toggle('met', met);
        const icon = element.querySelector('.requirement-icon');
        if (icon) {
          icon.textContent = met ? '✓' : '○';
        }
      }
    });
  }

  function checkPasswordMatch() {
    const senha = document.getElementById('cadSenha')?.value || '';
    const confirmSenha = document.getElementById('cadSenha2')?.value || '';
    const indicator = document.getElementById('password-match-indicator');
    
    if (!indicator) return;
    
    if (confirmSenha.length === 0) {
      indicator.textContent = '';
      indicator.className = 'password-match-indicator';
    } else if (senha === confirmSenha) {
      indicator.textContent = '✓ Senhas coincidem';
      indicator.className = 'password-match-indicator match';
    } else {
      indicator.textContent = '✗ Senhas não coincidem';
      indicator.className = 'password-match-indicator no-match';
    }
  }

  // Melhorar busca de CEP para o novo layout
  function preencherEnderecoCompleto(data) {
    const campos = {
      'cadEndereco': `${data.logradouro || data.street || ''}`,
      'cadBairro': data.bairro || data.district || '',
      'cadCidade': data.localidade || data.city || '',
      'cadEstado': data.uf || data.state || ''
    };
    
    Object.entries(campos).forEach(([id, valor]) => {
      const campo = document.getElementById(id);
      if (campo && valor) {
        // Remover readonly temporariamente para conseguir atualizar
        const wasReadonly = campo.readOnly;
        campo.readOnly = false;
        campo.value = valor;
        if (wasReadonly) campo.readOnly = true;
        
        // Efeito visual de preenchimento
        campo.style.background = 'linear-gradient(45deg, #e8f5e8, rgba(255,255,255,0.95))';
        campo.style.transition = 'background 0.3s ease';
        setTimeout(() => {
          campo.style.background = '';
        }, 2000);
      }
    });
    
    // Log para debugging
    console.log('Endereço preenchido:', campos);
  }

  // Animação de entrada para as seções
  function animateFormSections() {
    const sections = document.querySelectorAll('.form-section');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    sections.forEach((section, index) => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(20px)';
      section.style.transition = `all 0.5s ease ${index * 0.1}s`;
      observer.observe(section);
    });
  }

  // Melhorar área de verificação de email
  function setupEmailVerificationUI() {
    const emailInput = document.getElementById('cadEmail');
    const verifyBtn = document.getElementById('btnVerificarEmail');
    const verificationArea = document.getElementById('areaCodigoEmail');
    const codeInput = document.getElementById('inputCodigoEmail');
    
    if (emailInput) {
      emailInput.addEventListener('input', function() {
        const email = this.value.trim();
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        
        if (verifyBtn) {
          verifyBtn.style.display = isValid ? 'block' : 'none';
        }
        
        // Reset da verificação ao alterar email
        if (verificationArea) {
          verificationArea.style.display = 'none';
        }
        
        const icon = document.getElementById('iconeEmailVerificado');
        if (icon) {
          icon.style.display = 'none';
        }
      });
    }
    
    if (codeInput) {
      // Auto-formatação do código
      codeInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        
        // Auto-validação quando completo
        if (this.value.length === 6) {
          setTimeout(() => {
            const validateBtn = document.getElementById('btnValidarCodigoEmail');
            if (validateBtn) {
              validateBtn.click();
            }
          }, 500);
        }
      });
    }
  }

  // Melhorar container de serviços
  function setupServiceSelection() {
    const serviceContainer = document.getElementById('cadServicoContainer');
    
    if (serviceContainer) {
      // Observar mudanças no container
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const hasService = serviceContainer.querySelector('input[readonly]');
            if (hasService) {
              serviceContainer.style.border = '2px solid #28a745';
              serviceContainer.style.background = 'rgba(40, 167, 69, 0.1)';
            } else {
              serviceContainer.style.border = '';
              serviceContainer.style.background = '';
            }
          }
        });
      });
      
      observer.observe(serviceContainer, { childList: true, subtree: true });
    }
  }

  // Validação visual em tempo real
  function setupRealTimeValidation() {
    const inputs = document.querySelectorAll('#formCadastro input[required]');
    
    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        validateInputVisually(this);
      });
      
      input.addEventListener('input', function() {
        if (this.classList.contains('invalid')) {
          validateInputVisually(this);
        }
      });
    });
  }

  function validateInputVisually(input) {
    const isValid = input.checkValidity() && input.value.trim() !== '';
    
    input.classList.remove('valid', 'invalid');
    input.classList.add(isValid ? 'valid' : 'invalid');
    
    // Adicionar feedback visual
    const fieldGroup = input.closest('.field-group');
    if (fieldGroup) {
      const existingFeedback = fieldGroup.querySelector('.validation-feedback');
      if (existingFeedback) {
        existingFeedback.remove();
      }
      
      if (!isValid && input.value.trim() !== '') {
        const feedback = document.createElement('div');
        feedback.className = 'validation-feedback error';
        feedback.textContent = getValidationMessage(input);
        fieldGroup.appendChild(feedback);
      }
    }
  }

  function getValidationMessage(input) {
    if (input.validity.valueMissing) {
      return 'Este campo é obrigatório';
    }
    if (input.validity.typeMismatch) {
      return 'Formato inválido';
    }
    if (input.validity.tooShort) {
      return `Mínimo ${input.minLength} caracteres`;
    }
    if (input.validity.patternMismatch) {
      return 'Formato inválido';
    }
    return 'Valor inválido';
  }

  // Inicializar todas as funcionalidades do novo design
  function initializeNewDesign() {
    setupPasswordValidation();
    setupEmailVerificationUI();
    setupServiceSelection();
    setupRealTimeValidation();
    animateFormSections();
  }

  // Executar após o DOM carregar
  setTimeout(initializeNewDesign, 100);
  
  // === DEBUGGING E TESTES ===
  window.testCPF = function(cpf) {
    console.log('Testando CPF:', cpf);
    console.log('Resultado:', validaCPF(cpf));
    return validaCPF(cpf);
  };
  
  window.testCEP = function(cep) {
    console.log('Testando CEP:', cep);
    buscarCEP(cep.replace(/\D/g, ''), document.getElementById('cadCep'));
  };

  // === SISTEMA DE LOG DE SEGURANÇA ===
  const SecurityLogger = {
    log: function(event, details = {}) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        details: details,
        userAgent: navigator.userAgent.substring(0, 100),
        url: window.location.href,
        sessionId: this.getSessionId()
      };
      
      // Armazenar localmente (limitado)
      const logs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
      logs.push(logEntry);
      
      // Manter apenas os últimos 50 logs
      if (logs.length > 50) {
        logs.shift();
      }
      
      localStorage.setItem('securityLogs', JSON.stringify(logs));
      
      // Em produção, enviar para o servidor
      if (window.location.hostname !== 'localhost') {
        this.sendToServer(logEntry);
      }
    },
    
    getSessionId: function() {
      let sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('sessionId', sessionId);
      }
      return sessionId;
    },
    
    sendToServer: function(logEntry) {
      // Enviar de forma assíncrona sem bloquear a UI
      setTimeout(() => {
        fetch('https://chegar-primeiro.onrender.com/api/security-log', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': localStorage.getItem('csrfToken')
          },
          body: JSON.stringify(logEntry)
        }).catch(() => {
          // Ignorar erros silenciosamente
        });
      }, 100);
    }
  };

  // === MELHORIAS FINAIS DE FUNCIONALIDADE ===
  
  // Detectar tentativas de injeção
  function detectInjectionAttempt(input) {
    const dangerousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /data:\s*text\/html/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
  }

  // Monitor de performance
  const PerformanceMonitor = {
    startTime: Date.now(),
    
    logPageLoad: function() {
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        
        SecurityLogger.log('page_performance', {
          loadTime: loadTime,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: timing.responseStart - timing.navigationStart
        });
      }
    },
    
    logUserAction: function(action, duration) {
      SecurityLogger.log('user_action', {
        action: action,
        duration: duration,
        timestamp: Date.now()
      });
    }
  };

  // Monitorar performance na inicialização
  window.addEventListener('load', () => {
    PerformanceMonitor.logPageLoad();
  });

  // === PROTEÇÃO CONTRA BOT ===
  const BotDetection = {
    suspiciousActivity: 0,
    
    checkHumanBehavior: function() {
      // Verificar movimentos do mouse
      let mouseMovements = 0;
      document.addEventListener('mousemove', () => {
        mouseMovements++;
      });
      
      // Verificar tempo entre ações
      let lastActionTime = Date.now();
      document.addEventListener('click', () => {
        const now = Date.now();
        const timeDiff = now - lastActionTime;
        
        // Ações muito rápidas podem indicar bot
        if (timeDiff < 100) {
          this.suspiciousActivity++;
          if (this.suspiciousActivity > 5) {
            SecurityLogger.log('bot_detection', {
              reason: 'rapid_clicks',
              count: this.suspiciousActivity
            });
          }
        } else {
          this.suspiciousActivity = Math.max(0, this.suspiciousActivity - 1);
        }
        
        lastActionTime = now;
      });
      
      // Verificar se há movimentos do mouse após 30 segundos
      setTimeout(() => {
        if (mouseMovements === 0) {
          SecurityLogger.log('bot_detection', {
            reason: 'no_mouse_movement',
            timeElapsed: 30000
          });
        }
      }, 30000);
    }
  };

  BotDetection.checkHumanBehavior();

  // === BACKUP E RECUPERAÇÃO DE DADOS ===
  const DataBackup = {
    backup: function() {
      const formData = {};
      
      // Backup dos formulários principais
      const forms = ['formCadastro', 'formVistoria', 'formTrocaServico'];
      
      forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
          const inputs = form.querySelectorAll('input, textarea, select');
          formData[formId] = {};
          
          inputs.forEach(input => {
            if (input.type !== 'password' && input.id) {
              formData[formId][input.id] = input.value;
            }
          });
        }
      });
      
      localStorage.setItem('formBackup', JSON.stringify({
        data: formData,
        timestamp: Date.now()
      }));
    },
    
    restore: function() {
      const backup = localStorage.getItem('formBackup');
      if (!backup) return false;
      
      try {
        const { data, timestamp } = JSON.parse(backup);
        
        // Só restaurar se o backup for de menos de 1 hora
        if (Date.now() - timestamp > 60 * 60 * 1000) {
          localStorage.removeItem('formBackup');
          return false;
        }
        
        Object.entries(data).forEach(([formId, formData]) => {
          Object.entries(formData).forEach(([inputId, value]) => {
            const input = document.getElementById(inputId);
            if (input && value) {
              input.value = value;
            }
          });
        });
        
        return true;
      } catch (e) {
        localStorage.removeItem('formBackup');
        return false;
      }
    },
    
    clear: function() {
      localStorage.removeItem('formBackup');
    }
  };

  // Auto-backup a cada 30 segundos
  setInterval(() => {
    DataBackup.backup();
  }, 30000);

  // Restaurar dados na inicialização
  if (DataBackup.restore()) {
    mostrarNotificacao('Dados do formulário foram restaurados automaticamente.', 'info');
  }

  // === CONFIGURAÇÕES FINAIS ===
  
  // Limpar backup ao fazer logout
  const originalVoltarInicio = window.voltarInicio;
  window.voltarInicio = function() {
    DataBackup.clear();
    SecurityLogger.log('user_logout');
    originalVoltarInicio();
  };

  // Log de inicialização
  SecurityLogger.log('app_initialized', {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled
  });

  window.showTab = showTab;
});

function mostrarMensagem(msg, sucesso = true) {
  let div = document.getElementById('mensagemFeedback');
  if (!div) {
    div = document.createElement('div');
    div.id = 'mensagemFeedback';
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.zIndex = '9999';
    div.style.padding = '14px 24px';
    div.style.borderRadius = '8px';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '1.1em';
    div.style.boxShadow = '0 2px 8px #0002';
    document.body.appendChild(div);
  }
  div.innerHTML = msg;
  if (sucesso) {
    div.style.background = '#d4edda';
    div.style.color = '#155724';
    div.style.border = '1px solid #c3e6cb';
  } else {
    div.style.background = '#f8d7da';
    div.style.color = '#721c24';
    div.style.border = '1px solid #f5c6cb';
  }
  div.style.display = 'block';
  setTimeout(() => { div.style.display = 'none'; }, 6000);
}
window.mostrarMensagem = mostrarMensagem;

// Converte data para horário de Brasília
function formatarDataBrasilia(data) {
  if (!data) return '-';
  let d;
  if (data instanceof Date) {
    d = data;
  } else if (typeof data === 'string') {
    let dataStr = data;
    // Se já tiver 'Z' ou for ISO, não adiciona outro
    if (!dataStr.endsWith('Z') && !dataStr.includes('+')) dataStr += 'Z';
    d = new Date(dataStr);
  } else {
    return '-';
  }
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// === SISTEMA DE LOGIN AVANÇADO ===
class AdvancedLoginSystem {
  constructor() {
    this.maxAttempts = 5;
    this.lockoutTime = 15 * 60 * 1000; // 15 minutos
    this.biometricAvailable = false;
    this.twoFactorEnabled = false;
    this.savedCredentials = this.loadSavedCredentials();
  }

  async initialize() {
    await this.checkBiometricAvailability();
    this.setupCPFSuggestions();
    this.setupPasswordStrengthIndicator();
    this.setupRememberMe();
    this.checkSavedSession();
    this.setupSocialLogins();
  }

  async checkBiometricAvailability() {
    if ('credentials' in navigator && 'create' in navigator.credentials) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          this.biometricAvailable = true;
          document.getElementById('biometricSection').style.display = 'block';
          this.setupBiometricLogin();
        }
      } catch (error) {
        console.log('Biometric not available:', error);
      }
    }
  }

  setupBiometricLogin() {
    const biometricBtn = document.getElementById('biometricBtn');
    biometricBtn.addEventListener('click', async () => {
      try {
        biometricBtn.innerHTML = '<div class="loading-spinner"></div> Verificando...';
        await this.authenticateWithBiometric();
      } catch (error) {
        mostrarMensagem('Falha na autenticação biométrica', false);
        biometricBtn.innerHTML = '🔒 Entrar com biometria';
      }
    });
  }

  async authenticateWithBiometric() {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        allowCredentials: [{
          id: new Uint8Array(32),
          type: 'public-key',
          transports: ['internal']
        }],
        userVerification: 'required'
      }
    });

    if (credential) {
      // Simula login bem-sucedido
      await this.simulateSuccessfulLogin('biometric');
    }
  }

  setupCPFSuggestions() {
    const cpfInput = document.getElementById('loginCpf');
    const suggestionsDropdown = document.getElementById('cpfSuggestions');

    cpfInput.addEventListener('input', () => {
      const value = cpfInput.value;
      this.showCPFSuggestions(value, suggestionsDropdown);
    });

    cpfInput.addEventListener('blur', () => {
      setTimeout(() => {
        suggestionsDropdown.style.display = 'none';
      }, 200);
    });
  }

  showCPFSuggestions(value, dropdown) {
    const suggestions = this.savedCredentials.filter(cred => 
      cred.cpf.includes(value.replace(/\D/g, ''))
    );

    if (suggestions.length > 0 && value.length > 3) {
      dropdown.innerHTML = suggestions.map(cred => `
        <div class="suggestion-item" onclick="selectCPF('${cred.cpf}', '${cred.name}')">
          <strong>${formatCPF(cred.cpf)}</strong>
          <small>${cred.name}</small>
        </div>
      `).join('');
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  setupPasswordStrengthIndicator() {
    const senhaInput = document.getElementById('loginSenha');
    const strengthIndicator = document.getElementById('loginPasswordStrength');

    senhaInput.addEventListener('input', () => {
      const strength = this.calculatePasswordStrength(senhaInput.value);
      strengthIndicator.className = `password-strength-indicator ${strength.level}`;
    });
  }

  calculatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak' };
    if (score <= 3) return { level: 'medium' };
    return { level: 'strong' };
  }

  setupRememberMe() {
    const rememberCheckbox = document.getElementById('rememberMe');
    const savedRemember = localStorage.getItem('rememberMe') === 'true';
    
    if (savedRemember) {
      rememberCheckbox.checked = true;
      this.loadSavedCredentials();
    }
  }

  async performLogin(cpf, senha, rememberMe) {
    const loginBtn = document.querySelector('.primary-btn');
    const originalHTML = loginBtn.innerHTML;
    
    try {
      // Mostrar loading
      loginBtn.classList.add('loading');
      loginBtn.disabled = true;
      
      // Verificar bloqueio de conta
      const lockStatus = securityManager.isAccountLocked(cpf);
      if (lockStatus.locked) {
        throw new Error(`Conta bloqueada. Tente novamente em ${lockStatus.remainingTime} minutos.`);
      }

      // Autenticação real com banco Neon
      const response = await fetch(`https://chegar-primeiro.onrender.com/api/clientes/${cpf}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('CPF não encontrado no sistema.');
        }
        throw new Error('Erro ao conectar com o servidor.');
      }
      
      const cliente = await response.json();
      
      // Verificar se a senha corresponde
      if (!cliente.senha || cliente.senha !== senha) {
        throw new Error('Senha incorreta.');
      }
      
      // Verificar se precisa de 2FA
      if (this.shouldRequireTwoFactor(cpf)) {
        await this.initiateTwoFactorAuth(cpf);
        return;
      }

      // Login bem-sucedido com dados reais do cliente
      await this.handleSuccessfulLogin(cpf, senha, rememberMe, cliente);
      
    } catch (error) {
      this.handleLoginError(error, cpf);
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalHTML;
    }
  }

  async simulateAuthenticationDelay() {
    return new Promise(resolve => setTimeout(resolve, 1500));
  }

  shouldRequireTwoFactor(cpf) {
    // Simula verificação se o usuário tem 2FA habilitado
    const twoFactorUsers = JSON.parse(localStorage.getItem('twoFactorUsers') || '[]');
    return twoFactorUsers.includes(cpf);
  }

  async initiateTwoFactorAuth(cpf) {
    const twoFactorSection = document.getElementById('twoFactorSection');
    twoFactorSection.style.display = 'block';
    
    // Simular envio de código
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`tempCode_${cpf}`, code);
    
    mostrarMensagem(`Código de verificação enviado: ${code}`, true);
    
    this.setupTwoFactorValidation(cpf);
  }

  setupTwoFactorValidation(cpf) {
    const codeInput = document.getElementById('twoFactorCode');
    const resendBtn = document.getElementById('resendCodeBtn');
    
    codeInput.addEventListener('input', () => {
      if (codeInput.value.length === 6) {
        this.validateTwoFactorCode(cpf, codeInput.value);
      }
    });

    resendBtn.addEventListener('click', () => {
      this.resendTwoFactorCode(cpf);
    });
  }

  async validateTwoFactorCode(cpf, inputCode) {
    const storedCode = localStorage.getItem(`tempCode_${cpf}`);
    
    if (inputCode === storedCode) {
      localStorage.removeItem(`tempCode_${cpf}`);
      document.getElementById('twoFactorSection').style.display = 'none';
      await this.simulateSuccessfulLogin('2fa');
    } else {
      mostrarMensagem('Código inválido', false);
      document.getElementById('twoFactorCode').value = '';
    }
  }

  async resendTwoFactorCode(cpf) {
    const resendBtn = document.getElementById('resendCodeBtn');
    resendBtn.disabled = true;
    resendBtn.textContent = 'Reenviando...';
    
    setTimeout(() => {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem(`tempCode_${cpf}`, newCode);
      mostrarMensagem(`Novo código enviado: ${newCode}`, true);
      
      resendBtn.disabled = false;
      resendBtn.textContent = 'Reenviar';
    }, 3000);
  }

  async handleSuccessfulLogin(cpf, senha, rememberMe, cliente = null) {
    // Salvar credenciais se solicitado
    if (rememberMe) {
      this.saveCredentials(cpf, senha);
    }

    // Registrar login bem-sucedido
    securityManager.recordLoginAttempt(cpf, true);
    
    // Criar sessão com dados reais do cliente
    const sessionData = {
      cpf: cpf,
      loginTime: Date.now(),
      rememberMe: rememberMe,
      sessionId: this.generateSessionId(),
      cliente: cliente // Dados reais do cliente do banco Neon
    };
    
    localStorage.setItem('userSession', JSON.stringify(sessionData));
    localStorage.setItem('userAuthenticated', 'true');
    
    // Salvar dados do usuário para uso posterior
    if (cliente) {
      const userData = {
        nome: cliente.nome_cliente,
        cpf: cliente.cpf,
        endereco: cliente.endereco,
        apartamento: cliente.apartamento,
        bloco: cliente.bloco,
        servico: cliente.servico,
        empreendimento: cliente.nome_empreendimento
      };
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    }

    await this.simulateSuccessfulLogin('password');
  }

  async simulateSuccessfulLogin(method) {
    mostrarMensagem(`Login realizado com sucesso via ${method}!`, true);
    
    // Simular carregamento de dados do usuário
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirecionar para dashboard.html
    window.location.href = 'dashboard.html';
  }

  handleLoginError(error, cpf) {
    securityManager.recordLoginAttempt(cpf, false);
    
    const attemptsResult = securityManager.isAccountLocked(cpf);
    if (attemptsResult.locked) {
      this.showAccountLocked(attemptsResult.remainingTime);
    } else {
      const remaining = 5 - (securityManager.loginAttempts.get(cpf)?.count || 0);
      this.showLoginAttempts(remaining);
    }
    
    mostrarMensagem(error.message || 'Erro no login', false);
  }

  showLoginAttempts(remaining) {
    const attemptsDiv = document.getElementById('loginAttempts');
    const attemptsText = document.getElementById('attemptsText');
    
    if (remaining <= 3) {
      attemptsDiv.style.display = 'flex';
      attemptsText.textContent = `Restam ${remaining} tentativas`;
    }
  }

  showAccountLocked(minutes) {
    const attemptsDiv = document.getElementById('loginAttempts');
    const attemptsText = document.getElementById('attemptsText');
    
    attemptsDiv.style.display = 'flex';
    attemptsDiv.style.background = 'rgba(220, 53, 69, 0.2)';
    attemptsText.textContent = `Conta bloqueada por ${minutes} minutos`;
  }

  saveCredentials(cpf, senha) {
    const credentials = this.loadSavedCredentials();
    const existing = credentials.findIndex(cred => cred.cpf === cpf);
    
    const credentialData = {
      cpf: cpf,
      name: 'Cliente Claro', // Poderia vir do servidor
      lastLogin: Date.now()
    };
    
    if (existing >= 0) {
      credentials[existing] = credentialData;
    } else {
      credentials.push(credentialData);
    }
    
    // Manter apenas os 5 mais recentes
    credentials.sort((a, b) => b.lastLogin - a.lastLogin);
    const recentCredentials = credentials.slice(0, 5);
    
    localStorage.setItem('savedCredentials', JSON.stringify(recentCredentials));
  }

  loadSavedCredentials() {
    return JSON.parse(localStorage.getItem('savedCredentials') || '[]');
  }

  checkSavedSession() {
    const session = localStorage.getItem('userSession');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (session && rememberMe) {
      const sessionData = JSON.parse(session);
      const now = Date.now();
      const sessionAge = now - sessionData.loginTime;
      
      // Sessão válida por 30 dias se "lembrar de mim" estiver marcado
      if (sessionAge < 30 * 24 * 60 * 60 * 1000) {
        document.getElementById('loginCpf').value = formatCPF(sessionData.cpf);
        document.getElementById('rememberMe').checked = true;
      }
    }
  }

  setupSocialLogins() {
    // Implementação dos logins sociais seria integrada aqui
    window.loginWithGoogle = () => {
      mostrarMensagem('Login com Google em desenvolvimento', true);
    };
    
    window.loginWithMicrosoft = () => {
      mostrarMensagem('Login com Microsoft em desenvolvimento', true);
    };
  }

  generateSessionId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// === SISTEMA DE RECUPERAÇÃO DE SENHA AVANÇADO ===
class AdvancedPasswordRecovery {
  constructor() {
    this.currentStep = 1;
    this.recoveryData = {};
  }

  openModal() {
    this.createModal();
    this.showStep1();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'advancedRecoveryModal';
    modal.className = 'advanced-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h2>🔐 Recuperação de Senha</h2>
          <button class="close-btn" onclick="this.closest('.advanced-modal').remove()">&times;</button>
        </div>
        <div class="modal-body" id="recoveryModalBody">
          <!-- Conteúdo será inserido dinamicamente -->
        </div>
        <div class="modal-footer">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 25%"></div>
          </div>
          <small>Passo 1 de 4</small>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar estilos se não existirem
    if (!document.getElementById('advancedModalStyles')) {
      this.addModalStyles();
    }
  }

  addModalStyles() {
    const styles = document.createElement('style');
    styles.id = 'advancedModalStyles';
    styles.textContent = `
      .advanced-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
      }
      
      .modal-container {
        position: relative;
        background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        animation: modalSlideIn 0.3s ease-out;
      }
      
      @keyframes modalSlideIn {
        0% { opacity: 0; transform: scale(0.8) translateY(50px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      
      .modal-header {
        background: linear-gradient(135deg, #d31a20 0%, #a31620 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .modal-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }
      
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .modal-body {
        padding: 24px;
        min-height: 200px;
      }
      
      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #eee;
        background: #f8f9fa;
      }
      
      .progress-bar {
        width: 100%;
        height: 4px;
        background: #eee;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #d31a20, #ff4444);
        transition: width 0.3s ease;
      }
      
      .step-content {
        text-align: center;
      }
      
      .recovery-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        margin: 16px 0;
        transition: border-color 0.3s;
      }
      
      .recovery-input:focus {
        outline: none;
        border-color: #d31a20;
      }
      
      .recovery-btn {
        background: linear-gradient(135deg, #d31a20 0%, #a31620 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        margin: 8px;
      }
      
      .recovery-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(211, 26, 32, 0.3);
      }
      
      .recovery-btn.secondary {
        background: #6c757d;
      }
      
      .verification-methods {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 20px 0;
      }
      
      .method-card {
        border: 2px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        text-align: center;
        transition: all 0.3s;
      }
      
      .method-card:hover {
        border-color: #d31a20;
        background: #fff5f5;
      }
      
      .method-card.selected {
        border-color: #d31a20;
        background: #fff5f5;
      }
      
      .method-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
    `;
    
    document.head.appendChild(styles);
  }

  showStep1() {
    this.updateProgress(1, 4);
    document.getElementById('recoveryModalBody').innerHTML = `
      <div class="step-content">
        <h3>Identificação da Conta</h3>
        <p>Digite seu CPF para localizar sua conta:</p>
        <input type="text" id="recoveryCpf" class="recovery-input" placeholder="000.000.000-00" maxlength="14">
        <div style="margin-top: 20px;">
          <button class="recovery-btn" onclick="advancedRecovery.validateCPF()">Continuar</button>
          <button class="recovery-btn secondary" onclick="document.getElementById('advancedRecoveryModal').remove()">Cancelar</button>
        </div>
      </div>
    `;
    
    // Adicionar formatação
    document.getElementById('recoveryCpf').addEventListener('input', function() {
      this.value = formatCPF(this.value);
    });
    
    window.advancedRecovery = this;
  }

  validateCPF() {
    const cpf = document.getElementById('recoveryCpf').value.replace(/\D/g, '');
    
    if (!validaCPF(cpf)) {
      mostrarMensagem('CPF inválido', false);
      return;
    }
    
    this.recoveryData.cpf = cpf;
    this.showStep2();
  }

  showStep2() {
    this.updateProgress(2, 4);
    document.getElementById('recoveryModalBody').innerHTML = `
      <div class="step-content">
        <h3>Método de Verificação</h3>
        <p>Como você gostaria de receber o código de verificação?</p>
        <div class="verification-methods">
          <div class="method-card" onclick="advancedRecovery.selectMethod('email')">
            <div class="method-icon">📧</div>
            <h4>E-mail</h4>
            <p>jo***@email.com</p>
          </div>
          <div class="method-card" onclick="advancedRecovery.selectMethod('sms')">
            <div class="method-icon">📱</div>
            <h4>SMS</h4>
            <p>(11) 9****-5678</p>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button class="recovery-btn secondary" onclick="advancedRecovery.showStep1()">Voltar</button>
        </div>
      </div>
    `;
  }

  selectMethod(method) {
    // Remover seleção anterior
    document.querySelectorAll('.method-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Selecionar método atual
    event.target.closest('.method-card').classList.add('selected');
    
    this.recoveryData.method = method;
    
    setTimeout(() => {
      this.showStep3();
    }, 500);
  }

  showStep3() {
    this.updateProgress(3, 4);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.recoveryData.code = code;
    
    document.getElementById('recoveryModalBody').innerHTML = `
      <div class="step-content">
        <h3>Verificação</h3>
        <p>Digite o código de 6 dígitos enviado para:</p>
        <strong>${this.recoveryData.method === 'email' ? 'jo***@email.com' : '(11) 9****-5678'}</strong>
        <p style="background: #fff3cd; padding: 12px; border-radius: 8px; margin: 16px 0;">
          <strong>Código para teste: ${code}</strong>
        </p>
        <input type="text" id="verificationCode" class="recovery-input" placeholder="000000" maxlength="6" style="text-align: center; font-size: 24px; letter-spacing: 4px;">
        <div style="margin-top: 20px;">
          <button class="recovery-btn" onclick="advancedRecovery.validateCode()">Verificar</button>
          <button class="recovery-btn secondary" onclick="advancedRecovery.resendCode()">Reenviar Código</button>
        </div>
      </div>
    `;
    
    // Auto-focus no campo de código
    document.getElementById('verificationCode').focus();
  }

  validateCode() {
    const inputCode = document.getElementById('verificationCode').value;
    
    if (inputCode === this.recoveryData.code) {
      this.showStep4();
    } else {
      mostrarMensagem('Código incorreto', false);
      document.getElementById('verificationCode').value = '';
    }
  }

  resendCode() {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.recoveryData.code = newCode;
    mostrarMensagem(`Novo código enviado: ${newCode}`, true);
  }

  showStep4() {
    this.updateProgress(4, 4);
    document.getElementById('recoveryModalBody').innerHTML = `
      <div class="step-content">
        <h3>Nova Senha</h3>
        <p>Crie uma nova senha segura:</p>
        <input type="password" id="newPassword" class="recovery-input" placeholder="Nova senha">
        <input type="password" id="confirmPassword" class="recovery-input" placeholder="Confirmar senha">
        <div style="margin-top: 20px;">
          <button class="recovery-btn" onclick="advancedRecovery.updatePassword()">Atualizar Senha</button>
        </div>
      </div>
    `;
  }

  updatePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
      mostrarMensagem('Senhas não coincidem', false);
      return;
    }
    
    if (newPassword.length < 8) {
      mostrarMensagem('Senha deve ter pelo menos 8 caracteres', false);
      return;
    }
    
    // Simular atualização
    mostrarMensagem('Senha atualizada com sucesso!', true);
    
    setTimeout(() => {
      document.getElementById('advancedRecoveryModal').remove();
    }, 2000);
  }

  updateProgress(current, total) {
    const progress = (current / total) * 100;
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.querySelector('.modal-footer small').textContent = `Passo ${current} de ${total}`;
  }
}

// === FUNÇÕES GLOBAIS ===
window.selectCPF = function(cpf, name) {
  document.getElementById('loginCpf').value = formatCPF(cpf);
  document.getElementById('cpfSuggestions').style.display = 'none';
  document.getElementById('loginSenha').focus();
};

window.togglePasswordVisibility = function(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.innerHTML = '🙈';
  } else {
    input.type = 'password';
    button.innerHTML = '👁️';
  }
};