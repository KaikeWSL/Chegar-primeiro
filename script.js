function showTab(idx) {
  const forms = [document.getElementById('formVistoria'), document.getElementById('formTrocaServico')];
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === idx);
    forms[i].style.display = i === idx ? 'block' : 'none';
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
  window.modalServicoContexto = contexto || null;
}
function fecharModalServicos() {
  document.getElementById('modalServicos').classList.remove('active');
}
function selecionarServico(nome, contexto) {
  if (contexto === 'cadastro') {
    document.getElementById('cadServicoContainer').innerHTML = `
      <div class="servico-contratado-row">
        <input type="text" id="cadServico" name="cadServico" value="${nome}" readonly style="flex:1; min-width:0;">
        <button type="button" class="remove-servico-btn" onclick="removerServicoCadastro()">&times;</button>
      </div>
    `;
    fecharModalServicos();
    return;
  }
  if (contexto === 'troca') {
    document.getElementById('trocaServicoContainer').innerHTML = `
      <div class="servico-contratado-row">
        <input type="text" id="trocaNovoServico" value="${nome}" readonly style="flex:1; min-width:0;">
        <button type="button" class="remove-servico-btn" onclick="removerServicoTroca()">&times;</button>
      </div>
    `;
    fecharModalServicos();
    return;
  }
}
function removerServicoCadastro() {
  document.getElementById('cadServicoContainer').innerHTML = `
    <button type="button" class="select-service-btn" onclick="abrirModalServicos('cadastro')" id="btnSelecionarServico">Selecionar serviço</button>
  `;
}
function removerServicoTroca() {
  document.getElementById('trocaServicoContainer').innerHTML = `
    <button type="button" class="select-service-btn" onclick="abrirModalServicos('troca')" id="btnSelecionarNovoServico">Selecionar novo serviço</button>
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
  div.innerHTML = `${msg}<br><span style='font-size:0.95em;'>Protocolo: <b id='protocoloNum'>${protocolo}</b> <button onclick='copiarProtocolo()' style='margin-left:8px;padding:2px 8px;font-size:0.95em;cursor:pointer;'>Copiar</button></span>`;
  div.style.background = '#d4edda';
  div.style.color = '#155724';
  div.style.border = '1px solid #c3e6cb';
  div.style.display = 'block';
  setTimeout(() => { div.style.display = 'none'; }, 10000);
}

window.copiarProtocolo = function() {
  const num = document.getElementById('protocoloNum').textContent;
  navigator.clipboard.writeText(num);
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
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        mostrarMensagemProtocolo('Cliente cadastrado com sucesso!', data.protocolo);
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
      nome: document.getElementById('nomeVistoria').value,
      cpf: document.getElementById('cpfVistoria').value,
      cep: document.getElementById('cepVistoria').value,
      endereco: document.getElementById('enderecoVistoria').value,
      apartamento: document.getElementById('apartamentoVistoria').value,
      bloco: document.getElementById('blocoVistoria').value,
      telefone: document.getElementById('telefoneVistoria').value,
      melhor_horario: document.getElementById('horarioVistoria').value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarMensagemProtocolo('Manutenção cadastrada com sucesso!', data.protocolo);
      limparFormManutencao();
    } else {
      mostrarMensagem('Erro ao cadastrar manutenção!', false);
    }
  });
});

// --- NOVO FLUXO ---

// Alternância de telas
function mostrarLogin() {
  document.getElementById('telaInicial').style.display = 'none';
  document.getElementById('formLogin').style.display = 'flex';
  document.getElementById('formCadastro').style.display = 'none';
  document.getElementById('areaAutenticada').style.display = 'none';
}
function mostrarCadastro() {
  document.getElementById('telaInicial').style.display = 'none';
  document.getElementById('formLogin').style.display = 'none';
  document.getElementById('formCadastro').style.display = 'flex';
  document.getElementById('areaAutenticada').style.display = 'none';
}
function voltarInicio() {
  document.getElementById('telaInicial').style.display = 'block';
  document.getElementById('formLogin').style.display = 'none';
  document.getElementById('formCadastro').style.display = 'none';
  document.getElementById('areaAutenticada').style.display = 'none';
}

// Cadastro de cliente
const formCadastro = document.getElementById('formCadastro');
formCadastro.addEventListener('submit', function(e) {
  e.preventDefault();
  const senha = document.getElementById('cadSenha').value;
  const senha2 = document.getElementById('cadSenha2').value;
  if (senha !== senha2) {
    mostrarMensagem('As senhas não coincidem!', false);
    return;
  }
  fetch('https://chegar-primeiro.onrender.com/api/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome_cliente: document.getElementById('cadNome').value,
      cpf: document.getElementById('cadCpf').value,
      cep: document.getElementById('cadCep').value,
      email: document.getElementById('cadEmail').value,
      endereco: document.getElementById('cadEndereco').value,
      apartamento: document.getElementById('cadApartamento').value,
      bloco: document.getElementById('cadBloco').value,
      nome_empreendimento: document.getElementById('cadEmpreendimento').value,
      servico: document.getElementById('cadServico') ? document.getElementById('cadServico').value : '',
      senha: senha
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarMensagemProtocolo('Cadastro realizado com sucesso!', data.protocolo);
      formCadastro.reset();
      voltarInicio();
    } else {
      mostrarMensagem('Erro ao cadastrar cliente!', false);
    }
  });
});

// Login de cliente
const formLogin = document.getElementById('formLogin');
formLogin.addEventListener('submit', function(e) {
  e.preventDefault();
  fetch('https://chegar-primeiro.onrender.com/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cpf: document.getElementById('loginCpf').value,
      senha: document.getElementById('loginSenha').value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      autenticarCliente(data.cliente);
    } else {
      mostrarMensagem('CPF ou senha inválidos!', false);
    }
  });
});

// Função para autenticar e exibir área autenticada
function autenticarCliente(cliente) {
  document.getElementById('telaInicial').style.display = 'none';
  document.getElementById('formLogin').style.display = 'none';
  document.getElementById('formCadastro').style.display = 'none';
  document.getElementById('areaAutenticada').style.display = 'block';
  document.getElementById('cpfLogado').textContent = 'CPF: ' + cliente.cpf;
  document.getElementById('vistoriaCpf').value = cliente.cpf;
  document.getElementById('trocaCpf').value = cliente.cpf;
  document.getElementById('trocaServicoAtual').value = cliente.servico || '';
}

// Alternância de abas autenticadas
function showTab(idx) {
  const forms = [document.getElementById('formVistoria'), document.getElementById('formTrocaServico')];
  document.querySelectorAll('.tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === idx);
    forms[i].style.display = i === idx ? 'block' : 'none';
  });
}
// Inicializa abas
showTab(0);
document.getElementById('formVistoria').style.display = 'block';
document.getElementById('formTrocaServico').style.display = 'none';

// Envio do formulário de manutenção autenticada
const formVistoria = document.getElementById('formVistoria');
formVistoria.addEventListener('submit', function(e) {
  e.preventDefault();
  fetch('https://chegar-primeiro.onrender.com/api/manutencoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: '', // Não precisa nome aqui, só CPF
      cpf: document.getElementById('vistoriaCpf').value,
      cep: '',
      endereco: '',
      apartamento: '',
      bloco: '',
      telefone: document.getElementById('vistoriaTelefone').value,
      melhor_horario: document.getElementById('vistoriaHorario').value,
      descricao: document.getElementById('vistoriaDescricao').value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarMensagemProtocolo('Solicitação de manutenção enviada com sucesso!', data.protocolo);
      formVistoria.reset();
    } else {
      mostrarMensagem('Erro ao enviar solicitação!', false);
    }
  });
});

// Envio do formulário de troca de serviço autenticada
const formTroca = document.getElementById('formTrocaServico');
formTroca.addEventListener('submit', function(e) {
  e.preventDefault();
  fetch('https://chegar-primeiro.onrender.com/api/troca-servico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome_cliente: '',
      cpf_ou_contrato: document.getElementById('trocaCpf').value,
      servico_atual: document.getElementById('trocaServicoAtual').value,
      novo_servico: document.getElementById('trocaNovoServico') ? document.getElementById('trocaNovoServico').value : ''
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarMensagemProtocolo('Solicitação de troca enviada com sucesso!', data.protocolo);
      formTroca.reset();
      removerServicoTroca();
    } else {
      mostrarMensagem('Erro ao solicitar troca!', false);
    }
  });
}); 