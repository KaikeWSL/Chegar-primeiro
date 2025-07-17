const fetch = require('node-fetch');

const NEON_API_URL = process.env.NEON_API_URL || 'https://app-jolly-tooth-51509944.dpl.myneon.app';

async function neonQuery(sql, params = []) {
  try {
    const response = await fetch(NEON_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Database error: ${data.error}`);
    }
    
    return data;
  } catch (error) {
    console.error('[NEON_API_ERROR]', error.message);
    throw error;
  }
}

module.exports = { neonQuery };