// === SISTEMA DE NAVEGAÇÃO E ROTEAMENTO ===

/**
 * Sistema de navegação entre as páginas do Chegar Primeiro
 * Gerencia autenticação, sessões e transições de página
 */

class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.isAuthenticated = this.checkAuthentication();
    this.initNavigation();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('login.html')) return 'login';
    if (path.includes('cadastro.html')) return 'cadastro';
    if (path.includes('dashboard.html')) return 'dashboard';
    if (path.includes('index-principal.html')) return 'home';
    return 'unknown';
  }

  checkAuthentication() {
    return localStorage.getItem('userAuthenticated') === 'true';
  }

  initNavigation() {
    // Proteger páginas que requerem autenticação
    if (this.currentPage === 'dashboard' && !this.isAuthenticated) {
      this.redirectTo('home');
      return;
    }

    // Redirecionar usuários autenticados para dashboard
    if ((this.currentPage === 'login' || this.currentPage === 'home') && this.isAuthenticated) {
      this.redirectTo('dashboard');
      return;
    }

    this.setupPageSpecificFunctions();
  }

  redirectTo(page) {
    const routes = {
      'home': 'index-principal.html',
      'login': 'login.html',
      'cadastro': 'cadastro.html',
      'dashboard': 'dashboard.html'
    };

    if (routes[page]) {
      window.location.href = routes[page];
    }
  }

  setupPageSpecificFunctions() {
    // Funções globais para navegação entre páginas
    window.goToLogin = () => this.redirectTo('login');
    window.goToRegister = () => this.redirectTo('cadastro');
    window.goToDashboard = () => this.redirectTo('dashboard');
    window.goToHome = () => this.redirectTo('home');

    // Função de logout global
    window.logout = () => {
      localStorage.removeItem('userAuthenticated');
      localStorage.removeItem('userData');
      localStorage.removeItem('rememberMe');
      this.redirectTo('home');
    };

    // Login success handler
    window.handleLoginSuccess = (userData) => {
      localStorage.setItem('userAuthenticated', 'true');
      localStorage.setItem('userData', JSON.stringify(userData));
      this.redirectTo('dashboard');
    };

    // Register success handler
    window.handleRegisterSuccess = (userData) => {
      localStorage.setItem('userAuthenticated', 'true');
      localStorage.setItem('userData', JSON.stringify(userData));
      this.redirectTo('dashboard');
    };
  }

  // Utility functions for session management
  setUserData(userData) {
    localStorage.setItem('userData', JSON.stringify(userData));
  }

  getUserData() {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  }

  clearSession() {
    localStorage.removeItem('userAuthenticated');
    localStorage.removeItem('userData');
    localStorage.removeItem('rememberMe');
  }
}

// === FUNÇÕES LEGADAS PARA COMPATIBILIDADE ===

// Funções originais mantidas para compatibilidade com o código existente
function mostrarLogin() {
  window.location.href = 'login.html';
}

function mostrarCadastro() {
  window.location.href = 'cadastro.html';
}

function voltarInicio() {
  window.location.href = 'index-principal.html';
}

// === INICIALIZAÇÃO ===

// Inicializar o sistema de navegação quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
  // Só inicializar se não estivermos na página original clientes.html
  if (!window.location.pathname.includes('clientes.html')) {
    window.navigationManager = new NavigationManager();
  }
});

// === UTILITÁRIOS DE INTERFACE ===

/**
 * Mostra notificação na tela
 */
function mostrarNotificacao(mensagem, tipo = 'info', duracao = 5000) {
  const notification = document.getElementById('notification');
  if (!notification) return;

  // Configurar estilo baseado no tipo
  notification.className = `notification show ${tipo}`;
  notification.textContent = mensagem;

  // Auto-hide após a duração especificada
  setTimeout(() => {
    notification.classList.remove('show');
  }, duracao);
}

/**
 * Mostra/esconde overlay de loading
 */
function toggleLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Formata CPF para exibição
 */
function formatarCPF(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata telefone para exibição
 */
function formatarTelefone(telefone) {
  if (telefone.length === 11) {
    return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (telefone.length === 10) {
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return telefone;
}

/**
 * Valida formato de email
 */
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida formato de CPF
 */
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, '');
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

// === EXPORTAR PARA USO GLOBAL ===
window.NavigationManager = NavigationManager;
window.mostrarNotificacao = mostrarNotificacao;
window.toggleLoading = toggleLoading;
window.formatarCPF = formatarCPF;
window.formatarTelefone = formatarTelefone;
window.validarEmail = validarEmail;
window.validarCPF = validarCPF;
