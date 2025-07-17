const fetch = require('node-fetch');

// Configuração
const NEON_API_URL = process.env.NEON_API_URL || 'https://app-jolly-tooth-51509944.dpl.myneon.app';
const DEFAULT_TIMEOUT = 30000; // 30 segundos
const DEFAULT_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

// Métricas simples
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalRetries: 0
};

// Função para delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para validar SQL básica
function validateSql(sql) {
  if (!sql || typeof sql !== 'string') {
    throw new Error('SQL query deve ser uma string não vazia');
  }
  
  // Previne alguns comandos perigosos
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

// Função para verificar se erro deve ser retentado
function isRetryableError(error) {
  const nonRetryablePatterns = [
    /syntax error/i,
    /permission denied/i,
    /relation .* does not exist/i,
    /column .* does not exist/i,
    /duplicate key/i,
    /violates.*constraint/i
  ];
  
  return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
}

// Função para executar query com timeout
async function executeQueryWithTimeout(sql, params, timeout = DEFAULT_TIMEOUT) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout após ${timeout}ms`)), timeout);
  });
  
  const queryPromise = fetch(NEON_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'NeonApiClient/1.0'
    },
    body: JSON.stringify({ sql, params })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.error) {
      throw new Error(`Database error: ${data.error}`);
    }
    return data;
  });
  
  return Promise.race([queryPromise, timeoutPromise]);
}

// Função principal com retry
async function neonQuery(sql, params = []) {
  const startTime = Date.now();
  
  try {
    // Validações
    validateSql(sql);
    
    if (!Array.isArray(params)) {
      throw new Error('Parâmetros devem ser um array');
    }
    
    metrics.totalRequests++;
    
    let lastError;
    
    // Tenta executar com retry
    for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[NEON] Tentativa ${attempt + 1}/${DEFAULT_RETRIES + 1} para query`);
          await delay(RETRY_DELAY * attempt);
          metrics.totalRetries++;
        }
        
        const result = await executeQueryWithTimeout(sql, params);
        
        if (attempt > 0) {
          console.log(`[NEON] Query executada com sucesso na tentativa ${attempt + 1}`);
        }
        
        metrics.successfulRequests++;
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Não tenta novamente para certos tipos de erro
        if (!isRetryableError(error)) {
          throw error;
        }
        
        console.warn(`[NEON] Tentativa ${attempt + 1} falhou:`, error.message);
      }
    }
    
    throw new Error(`Query falhou após ${DEFAULT_RETRIES + 1} tentativas. Último erro: ${lastError.message}`);
    
  } catch (error) {
    metrics.failedRequests++;
    console.error(`[NEON] Query error (${Date.now() - startTime}ms):`, error.message);
    throw error;
  }
}

// Função para executar múltiplas queries sequencialmente
async function neonTransaction(queries) {
  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error('Transação deve conter pelo menos uma query');
  }
  
  const results = [];
  
  for (const { sql, params } of queries) {
    const result = await neonQuery(sql, params);
    results.push(result);
  }
  
  return results;
}

// Função para health check
async function neonHealthCheck() {
  try {
    const result = await neonQuery('SELECT 1 as health_check');
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

// Função para obter métricas
function getMetrics() {
  return {
    ...metrics,
    successRate: metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) + '%'
      : '0%'
  };
}

// Health check periódico opcional
let healthCheckInterval;
function startHealthCheck(intervalMs = 60000) {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    try {
      const health = await neonHealthCheck();
      if (!health.healthy) {
        console.warn('[NEON] Health check falhou:', health.error);
      }
    } catch (error) {
      console.warn('[NEON] Health check error:', error.message);
    }
  }, intervalMs);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[NEON] Fechando aplicação...');
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[NEON] Fechando aplicação...');
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  process.exit(0);
});

// Exporta as funções
module.exports = { 
  neonQuery,
  neonTransaction,
  neonHealthCheck,
  getMetrics,
  startHealthCheck
};