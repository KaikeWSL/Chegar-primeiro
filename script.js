function showTab(idx) {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('form').forEach((form, i) => {
    form.classList.toggle('active', i === idx);
  });
  document.getElementById('notification').style.display = 'none';
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
  // Salva contexto para saber se é troca de serviço de cliente existente
  window.modalServicoContexto = contexto || null;
}
function fecharModalServicos() {
  document.getElementById('modalServicos').classList.remove('active');
}
function selecionarServico(nome, contexto) {
  if (contexto === 'clienteExistente') {
    document.getElementById('trocaServicoArea').innerHTML = `
      <label style=\"margin-bottom:4px;\"><b>Novo Serviço</b></label>
      <div class=\"servico-contratado-row\">
        <input type=\"text\" value=\"${nome}\" readonly style=\"flex:1; min-width:0;\">
        <button type=\"button\" class=\"remove-servico-btn\" onclick=\"removerTrocaServico()\">&times;</button>
      </div>
      <button type=\"button\" class=\"submit-btn\" style=\"margin-top:12px;\" onclick=\"enviarSolicitacaoTroca()\">Enviar solicitação</button>
      <div id=\"solicitacaoMsg\"></div>
    `;
    document.getElementById('btnTrocarServico').style.display = 'none';
    fecharModalServicos();
    return;
  }
  // fluxo padrão para novo cliente
  const container = document.getElementById('servicoContratadoContainer');
  container.innerHTML = `
    <div class=\"servico-contratado-row\">
      <input type=\"text\" id=\"servicoContratado\" name=\"servicoContratado\" value=\"${nome}\" readonly style=\"flex:1; min-width:0;\">
      <button type=\"button\" class=\"remove-servico-btn\" onclick=\"removerServicoSelecionado()\">&times;</button>
    </div>
  `;
  fecharModalServicos();
}
function removerServicoSelecionado() {
  const container = document.getElementById('servicoContratadoContainer');
  container.innerHTML = `
    <button type=\"button\" class=\"select-service-btn\" onclick=\"abrirModalServicos()\" id=\"btnSelecionarServico\">Selecionar serviço</button>
  `;
}
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
  .then(res => {
    if (res.ok) {
      document.getElementById('solicitacaoMsg').innerHTML = `
        <div style="background:#fff3cd; color:#856404; padding:10px; border-radius:6px; text-align:center; margin-top:8px;">
          Solicitação enviada com sucesso!
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
      }, 3000);
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
  document.getElementById('nomeEmpreendimentoVistoria').value = '';
  document.getElementById('enderecoVistoria').value = '';
  document.getElementById('apartamentoVistoria').value = '';
  document.getElementById('blocoVistoria').value = '';
  document.getElementById('nomeSindicoVistoria').value = '';
  document.getElementById('engenheiroResponsavelVistoria').value = '';
}

// CPF: apenas números, 11 dígitos e validação
const cpfInput = document.getElementById('cpfCliente');
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
function validaCPF(cpf) {
  if (!cpf || cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}
// CEP: apenas números, 8 dígitos
const cepInput = document.getElementById('cepCliente');
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
        document.getElementById('enderecoCliente').value = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      } else {
        if (!cepErroFlag) {
          alert('CEP não encontrado.');
          cepErroFlag = true;
        }
        document.getElementById('enderecoCliente').value = '';
      }
    })
    .catch(() => {
      if (!cepErroFlag) {
        alert('Erro ao buscar o CEP.');
        cepErroFlag = true;
      }
      document.getElementById('enderecoCliente').value = '';
    });
});

// Função utilitária para mostrar mensagem na tela
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
  div.textContent = msg;
  div.style.background = sucesso ? '#d4edda' : '#f8d7da';
  div.style.color = sucesso ? '#155724' : '#721c24';
  div.style.border = sucesso ? '1px solid #c3e6cb' : '1px solid #f5c6cb';
  div.style.display = 'block';
  setTimeout(() => { div.style.display = 'none'; }, 3500);
}

// Envio do formulário de Vendas (Clientes)
document.getElementById('formVendas').addEventListener('submit', function(e) {
  e.preventDefault();
  const isNovoCliente = document.querySelector('input[name="jaCliente"]:checked').value === 'nao';
  if (isNovoCliente) {
    const cpf = cpfInput.value;
    const cep = cepInput.value;
    let erro = false;
    if (cpf.length !== 11 || !validaCPF(cpf)) {
      mostrarMensagem('Digite um CPF válido com 11 dígitos.', false);
      cpfInput.focus();
      erro = true;
    }
    if (cep.length !== 8) {
      mostrarMensagem('O CEP deve ter 8 dígitos.', false);
      cepInput.focus();
      erro = true;
    }
    if (erro) {
      return;
    }
    fetch('https://chegar-primeiro.onrender.com/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_cliente: document.getElementById('nomeCliente').value,
        cpf: document.getElementById('cpfCliente').value,
        cep: document.getElementById('cepCliente').value,
        endereco: document.getElementById('enderecoCliente').value,
        apartamento: document.getElementById('apartamentoCliente').value,
        bloco: document.getElementById('blocoCliente').value,
        nome_empreendimento: document.getElementById('nomeEmpreendimento').value,
        servico: document.getElementById('servicoContratado') ? document.getElementById('servicoContratado').value : ''
      })
    })
    .then(res => {
      if (res.ok) {
        mostrarMensagem('Cliente cadastrado com sucesso!');
        limparFormCliente();
      } else {
        mostrarMensagem('Erro ao cadastrar cliente!', false);
      }
    });
  }
});

// Envio do formulário de Manutenção (Vistoria)
document.getElementById('formVistoria').addEventListener('submit', function(e) {
  e.preventDefault();
  fetch('https://chegar-primeiro.onrender.com/api/manutencoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome_empreendimento: document.getElementById('nomeEmpreendimentoVistoria').value,
      endereco: document.getElementById('enderecoVistoria').value,
      apartamento: document.getElementById('apartamentoVistoria').value,
      bloco: document.getElementById('blocoVistoria').value,
      nome_sindico: document.getElementById('nomeSindicoVistoria').value,
      engenheiro_responsavel: document.getElementById('engenheiroResponsavelVistoria').value
    })
  })
  .then(res => {
    if (res.ok) {
      mostrarMensagem('Manutenção cadastrada com sucesso!');
      limparFormManutencao();
    } else {
      mostrarMensagem('Erro ao cadastrar manutenção!', false);
    }
  });
}); 