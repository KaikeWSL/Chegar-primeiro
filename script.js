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
  // Simulação de busca de cadastro
  document.getElementById('dadosClienteEncontrado').style.display = 'block';
  document.getElementById('nomeCompletoCliente').value = 'João da Silva';
  document.getElementById('enderecoCompletoCliente').value = 'Rua das Flores, 123, Centro, São Paulo - SP';
  document.getElementById('empreendimentoCliente').value = 'Residencial Jardim Claro';
  document.getElementById('servicoAtualCliente').value = 'Claro fibra 350 MEGA + globoplay';
  document.getElementById('trocaServicoArea').innerHTML = '';
  document.getElementById('btnTrocarServico').style.display = 'inline-block';
}
function iniciarTrocaServico() {
  abrirModalServicos('clienteExistente');
}
function removerTrocaServico() {
  document.getElementById('trocaServicoArea').innerHTML = '';
  document.getElementById('btnTrocarServico').style.display = 'inline-block';
}
function enviarSolicitacaoTroca() {
  document.getElementById('solicitacaoMsg').innerHTML = `
    <div style="background:#fff3cd; color:#856404; padding:10px; border-radius:6px; text-align:center; margin-top:8px;">
      Solicitação enviada com sucesso!
    </div>
  `;
  setTimeout(() => {
    document.getElementById('solicitacaoMsg').innerHTML = '';
    removerTrocaServico();
  }, 3000);
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

document.getElementById('formVendas').addEventListener('submit', function(e) {
  // Só valida se for novo cliente
  const isNovoCliente = document.querySelector('input[name="jaCliente"]:checked').value === 'nao';
  if (isNovoCliente) {
    const cpf = cpfInput.value;
    const cep = cepInput.value;
    let erro = false;
    if (cpf.length !== 11 || !validaCPF(cpf)) {
      alert('Digite um CPF válido com 11 dígitos.');
      cpfInput.focus();
      erro = true;
    }
    if (cep.length !== 8) {
      alert('O CEP deve ter 8 dígitos.');
      cepInput.focus();
      erro = true;
    }
    if (erro) {
      e.preventDefault();
    }
  }
}); 