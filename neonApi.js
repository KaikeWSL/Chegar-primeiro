const fetch = require('node-fetch');
const { AbortController } = require('abort-controller');

class NeonApiClient {
  constructor(apiUrl, options = {}) {
    this.apiUrl = apiUrl;
    this.options = {
      timeout: options.timeout || 30000, // 30 segundos
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000, // 1 segundo
      maxConcurrentRequests: options.maxConcurrentRequests || 10,
      ...options
    };
    
    // Pool de conexões para controlar requisições simultâneas
    this.activeRequests = 0;
    this.requestQueue = [];
    
    // Cache para prepared statements (opcional)
    this.statementCache = new Map();
    
    // Métricas básicas
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0,
      averageResponseTime: 0
    };
  }

  // Método para aguardar slot disponível no pool
  async acquireSlot() {
    if (this.activeRequests >= this.options.maxConcurrentRequests) {
      return new Promise((resolve) => {
        this.requestQueue.push(resolve);
      });
    }
    this.activeRequests++;
  }

  // Método para liberar slot no pool
  releaseSlot() {
    this.activeRequests--;
    if (this.requestQueue.length > 0) {
      const resolve = this.requestQueue.shift();
      this.activeRequests++;
      resolve();
    }
  }

  // Método para delay entre tentativas
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Método para validar SQL (básico)
  validateSql(sql) {
    if (!sql || typeof sql !== 'string') {
      throw new Error('SQL query deve ser uma string não vazia');
    }
    
    // Previne algumas injections básicas
    const prohibitedPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+/i,
      /;\s*truncate\s+/i,
      /;\s*alter\s+/i,
      /;\s*create\s+/i
    ];
    
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(sql)) {
        throw new Error('SQL query contém comandos não permitidos');
      }
    }
  }

  // Método principal para executar queries
  async query(sql, params = []) {
    const startTime = Date.now();
    
    try {
      // Validações básicas
      this.validateSql(sql);
      
      if (!Array.isArray(params)) {
        throw new Error('Parâmetros devem ser um array');
      }

      // Aguarda slot disponível
      await this.acquireSlot();

      // Executa query com retry
      const result = await this.executeWithRetry(sql, params);
      
      // Atualiza métricas
      this.updateMetrics(true, Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    } finally {
      this.releaseSlot();
    }
  }

  // Método para executar query com retry automático
  async executeWithRetry(sql, params) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[NEON] Tentativa ${attempt + 1}/${this.options.retries + 1} para query`);
          await this.delay(this.options.retryDelay * attempt);
          this.metrics.totalRetries++;
        }
        
        const result = await this.executeQuery(sql, params);
        
        if (attempt > 0) {
          console.log(`[NEON] Query executada com sucesso na tentativa ${attempt + 1}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Não faz retry para certos tipos de erro
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        console.warn(`[NEON] Tentativa ${attempt + 1} falhou:`, error.message);
      }
    }
    
    throw new Error(`Query falhou após ${this.options.retries + 1} tentativas. Último erro: ${lastError.message}`);
  }

  // Método para executar a query HTTP
  async executeQuery(sql, params) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'NeonApiClient/1.0'
        },
        body: JSON.stringify({ sql, params }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Database error: ${data.error}`);
      }
      
      return data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Query timeout após ${this.options.timeout}ms`);
      }
      
      throw error;
    }
  }

  // Verifica se o erro não deve ser retentado
  isNonRetryableError(error) {
    const nonRetryablePatterns = [
      /syntax error/i,
      /permission denied/i,
      /relation .* does not exist/i,
      /column .* does not exist/i,
      /duplicate key/i,
      /violates.*constraint/i,
      /timeout/i
    ];
    
    return nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  // Atualiza métricas
  updateMetrics(success, responseTime) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Calcula média móvel simples do tempo de resposta
    const alpha = 0.1; // Fator de suavização
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (1 - alpha)) + (responseTime * alpha);
  }

  // Método para transações (se suportado pela API)
  async transaction(queries) {
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('Transação deve conter pelo menos uma query');
    }
    
    // Se a API suportar transações, implementar aqui
    // Por enquanto, executa sequencialmente
    const results = [];
    
    for (const { sql, params } of queries) {
      const result = await this.query(sql, params);
      results.push(result);
    }
    
    return results;
  }

  // Método para health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return {
        healthy: true,
        responseTime: Date.now(),
        result: result.rows?.[0]?.health_check === 1
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        responseTime: Date.now()
      };
    }
  }

  // Método para obter métricas
  getMetrics() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // Método para limpar cache
  clearCache() {
    this.statementCache.clear();
  }

  // Método para fechar conexões (cleanup)
  async close() {
    // Aguarda todas as requisições pendentes
    while (this.activeRequests > 0 || this.requestQueue.length > 0) {
      await this.delay(100);
    }
    
    this.clearCache();
    console.log('[NEON] Cliente fechado com sucesso');
  }
}

// Instância singleton
const NEON_API_URL = process.env.NEON_API_URL || 'https://app-jolly-tooth-51509944.dpl.myneon.app';

const neonClient = new NeonApiClient(NEON_API_URL, {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  maxConcurrentRequests: 10
});

// Função de compatibilidade com a API anterior
async function neonQuery(sql, params = []) {
  return await neonClient.query(sql, params);
}

// Health check periódico (opcional)
let healthCheckInterval;
function startHealthCheck(intervalMs = 60000) {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    try {
      const health = await neonClient.healthCheck();
      if (!health.healthy) {
        console.warn('[NEON] Health check falhou:', health.error);
      }
    } catch (error) {
      console.warn('[NEON] Health check error:', error.message);
    }
  }, intervalMs);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[NEON] Fechando conexões...');
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  await neonClient.close();
  process.exit(0);
});

module.exports = { 
  neonQuery,
  neonClient,
  startHealthCheck,
  NeonApiClient
};