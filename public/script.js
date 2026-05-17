// --- 1. VARIÁVEIS GLOBAIS DE ESTADO ---
let nomeTrilhoAtual = "";
let descCurtaGuardada = "";
let descLongaHtmlGuardado = "";
let exibindoLonga = false;
let listaImagensGuardadas = [];
let indiceImagemAtual = 0;
let modoInsercaoPoi = false;

// --- 2. CONFIGURAÇÃO DE CAMADAS DO MAPA ---
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

// --- 3. ÍCONES PARA POIS ---
const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

const iconesPorTipo = {
  Natureza: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  Via: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  Água: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "Ponte / Passadiço": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  Túnel: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png",
  }),
  Miradouro: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  "Miradouro / Observatório": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  Informação: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  }),
  Património: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ruína Histórica": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ponte / Monumento": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "Ponto de Interesse": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  "Início/Fim": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  Infraestrutura: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  }),
  default: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
};

// --- 4. INICIALIZAÇÃO DO MAPA ---
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
  zoomControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// --- 5. FUNÇÕES DE CARREGAMENTO ---

async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();

    // Pegar o seletor diretamente pelo ID do teu HTML
    const seletorTrilhos = document.getElementById("trail-selector");
    if (!seletorTrilhos) return;

    // Limpa a lista antiga
    seletorTrilhos.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';

    // Adiciona os novos trilhos vindos da BD
    trilhos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.nome;
      seletorTrilhos.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao atualizar lista de trilhos na barra:", err);
  }
}

async function carregarPOIs(trilhoId) {
  try {
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();
    if (window.camadaPois) map.removeLayer(window.camadaPois);

    window.camadaPois = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const tipo = feature.properties.tipo
          ? feature.properties.tipo.trim()
          : "default";
        return L.marker(latlng, {
          icon: iconesPorTipo[tipo] || iconesPorTipo["default"],
        });
      },
      onEachFeature: (feature, layer) => {
        const nomePostgres = feature.properties.nome || "Ponto de Interesse";

        // Popup inicial temporário
        layer.bindPopup(
          `<div><b>📍 ${nomePostgres}</b><br><small style="color:#7f8c8d;">A carregar detalhes do Mongo...</small></div>`,
          {
            className: "custom-poi-popup",
            maxWidth: 280,
          },
        );

        // Evento de clique no marcador do POI
        layer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e);

          // --- MAPEAMENTO DO ID DO MONGO ---
          // Procura primeiro pelo nome exato que tens na base de dados: id_externo
          const poiIdExterno =
            feature.properties.id_externo ||
            feature.properties.id ||
            feature.id;

          if (poiIdExterno) {
            await mostrarDetalhesPOI(poiIdExterno, layer, feature.properties);
          } else {
            console.error(
              "Propriedades disponíveis neste ponto:",
              feature.properties,
            );
            layer.setPopupContent(
              `<div><b>📍 ${nomePostgres}</b><br><small style="color:#e74c3c;">Erro: id_externo não enviado pelo Postgres</small></div>`,
            );
          }
        });
      },
    }).addTo(map);
  } catch (err) {
    console.error("Erro POIs:", err);
  }
}

async function mostrarDetalhesPOI(idExterno, layer, propertiesPostgres) {
  try {
    const res = await fetch(`/api/detalhes-poi-mongo/${idExterno}`);

    // SE NÃO EXISTIR NO MONGO (Erro 404), MOSTRA OS DADOS DO POSTGRES
    if (res.status === 404) {
      const conteudoNovoPoi = `
        <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 220px; max-width: 280px;">
          <h3 style="margin: 0 0 5px 0; color: #3498db; font-size: 1.15em;">
            📍 ${propertiesPostgres.nome || "Novo Ponto"}
          </h3>
          <span style="background: #ebf5fb; color: #3498db; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; display: inline-block;">
            ${propertiesPostgres.tipo || "Geral"}
          </span>
          <p style="margin: 10px 0 0 0; font-size: 0.9em; line-height: 1.4; text-align: justify; color: #7f8c8d; font-style: italic;">
            "Este ponto foi criado no mapa. Ainda não tem descrição detalhada ou fotos associadas no MongoDB."
          </p>
          <div style="margin-top: 10px; border-radius: 8px; border: 1px dashed #bdc3c7; background: #f8f9fa; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #95a5a6;">
            <span style="font-size: 1.2em;">📝</span>
            <span style="font-size: 0.75em; margin-top: 5px;">Aguardar dados do MongoDB</span>
          </div>
          <div style="margin-top: 10px; font-size: 0.7em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
            ID Ext (Postgres): ${idExterno}
          </div>
        </div>
      `;
      // CORREÇÃO AQUI: O nome da variável agora bate certinho com a de cima!
      layer.setPopupContent(conteudoNovoPoi);
      return;
    }

    if (!res.ok) throw new Error(`Erro: ${res.status}`);
    const data = await res.json();

    // SE EXISTIR NO MONGO, MOSTRA A DESCRIÇÃO E A FOTO NORMALMENTE
    let htmlFoto = "";
    if (data.imagens && data.imagens.length > 0 && data.imagens[0] !== "") {
      htmlFoto = `
        <div style="margin-top: 10px; border-radius: 8px; overflow: hidden; max-height: 120px;">
          <img src="${data.imagens[0].url || data.imagens[0]}" alt="${data.nome}" style="width: 100%; height: auto; display: block; object-fit: cover;">
        </div>
      `;
    } else {
      htmlFoto = `
        <div style="margin-top: 10px; border-radius: 8px; border: 1px dashed #bdc3c7; background: #f8f9fa; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #95a5a6;">
          <span style="font-size: 1.5em;">📸</span>
          <span style="font-size: 0.75em; margin-top: 5px;">Sem fotografia adicionada</span>
        </div>
      `;
    }

    const conteudoPopup = `
      <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 240px; max-width: 280px;">
        <h3 style="margin: 0 0 5px 0; color: #2ecc71; font-size: 1.15em;">
          📍 ${data.nome || propertiesPostgres.nome}
        </h3>
        <span style="background: #e8f8f5; color: #2ecc71; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; display: inline-block;">
          ${data.tipo || propertiesPostgres.tipo}
        </span>
        <p style="margin: 10px 0 0 0; font-size: 0.9em; line-height: 1.4; text-align: justify; color: #555; font-style: italic;">
          "${data.descricao_curta || "Sem descrição curta disponível no MongoDB."}"
        </p>
        ${htmlFoto}
        <div style="margin-top: 10px; font-size: 0.7em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
          ID Trilho: ${data.id_trilho} | Ext: ${data.id_externo}
        </div>
      </div>
    `;

    layer.setPopupContent(conteudoPopup);
  } catch (err) {
    console.error("Erro ao carregar POI do MongoDB:", err);
    layer.setPopupContent(`...`);
  }
}

// Carrega o resumo inicial do trilho (Postgres)
async function carregarTrilho(id) {
  const painel = document.getElementById("trail-info-panel");
  if (!id) {
    if (painel) painel.style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    nomeTrilhoAtual = data.properties?.nome || "Trilho Sem Nome";
    descCurtaGuardada =
      data.properties?.detalhes?.descricao_curta ||
      "Sem descrição curta disponível.";
    exibindoLonga = false;

    // Forçar o estado inicial correto (Aberto e sem classes extras)
    if (painel) {
      painel.className = "painel-lateral-esquerdo";
      painel.style.display = "block";
    }

    // Validar e exibir elementos estruturais internos de forma segura
    const painelCorpo = document.getElementById("painel-corpo");
    if (painelCorpo) painelCorpo.style.display = "block";

    const btnFechar = document.querySelector(".btn-fechar-painel");
    if (btnFechar) btnFechar.style.display = "block";

    const detalhesMongo = document.getElementById("detalhes-mongo");
    if (detalhesMongo) detalhesMongo.style.display = "none";

    const avisoClique = document.getElementById("aviso-clique");
    if (avisoClique) avisoClique.style.display = "block";

    const zonaAlternar = document.getElementById("zona-alternar");
    if (zonaAlternar) zonaAlternar.style.display = "none";

    // Injetar dados protegidos contra valores nulos
    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;

    const infoDist = document.getElementById("info-dist");
    if (infoDist) {
      const distValor =
        data.properties?.distancia || data.properties?.distancia_km || "0";
      infoDist.textContent = distValor + " km";
    }

    const infoDiff = document.getElementById("info-diff");
    if (infoDiff) infoDiff.textContent = data.properties?.dificuldade || "n/a";

    // Injetar descrição curta
    const campoDescCurta = document.getElementById("info-desc-curta");
    if (campoDescCurta) {
      campoDescCurta.style.display = "block";
      campoDescCurta.textContent = descCurtaGuardada;
    }

    // Desenhar a linha no mapa
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois)
        map.removeLayer(layer);
    });

    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id);
        });
      },
    }).addTo(map);

    if (camada.getBounds().isValid()) {
      map.fitBounds(camada.getBounds(), { padding: [50, 50] });
    }

    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar percurso:", err);
  }
}

// Expande o painel e injeta a descrição longa (MongoDB)
async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLongaArea = document.getElementById("info-desc-longa");
  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaAlternar = document.getElementById("zona-alternar");
  const btnAlternar = document.getElementById("btn-alternar-desc");

  // Elementos do Carrossel
  const zonaCarrossel = document.getElementById("zona-carrossel");
  const imgExibida = document.getElementById("imagem-exibida");

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    if (painel) {
      painel.classList.remove("minimizado");
      painel.classList.add("expandido");
    }

    document.getElementById("aviso-clique").style.display = "none";

    // Configurar o botão de alternar
    if (zonaAlternar) zonaAlternar.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;

    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";

    // --- LÓGICA DO CARROSSEL DE IMAGENS ADAPTADA PARA OBJETO ---
    if (data.imagens && data.imagens.length > 0) {
      listaImagensGuardadas = data.imagens;
      indiceImagemAtual = 0;

      // Pegamos na primeira imagem acedendo ao objeto .url
      const primeiraImagem = listaImagensGuardadas[indiceImagemAtual];
      if (imgExibida && primeiraImagem) {
        // Se for um objeto, lê .url. Caso seja uma string simples (segurança), lê direto
        imgExibida.src = primeiraImagem.url || primeiraImagem;
      }

      if (zonaCarrossel) zonaCarrossel.style.display = "block";
      atualizarContadorCarrossel();
    } else {
      if (zonaCarrossel) zonaCarrossel.style.display = "none"; // Esconde se não houver fotos
    }

    descLongaHtmlGuardado = `
      <div class="animacao-fade">
        <p style="line-height:1.6; color:#333; text-align:justify; font-size: 0.95em; margin-bottom: 0;">
          ${data.descricao_longa || "Não existe uma descrição detalhada disponível."}
        </p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <p>🌿 <b>Flora:</b> ${data.flora ? data.flora.join(", ") : "n/a"}</p>
        <p>🦆 <b>Fauna:</b> ${data.fauna ? data.fauna.join(", ") : "n/a"}</p>
        <p>📅 <b>Melhor Época:</b> ${data.melhor_epoca || "n/a"}</p>
      </div>
    `;

    if (descLongaArea) descLongaArea.innerHTML = descLongaHtmlGuardado;

    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;
  } catch (err) {
    console.error("Erro ao carregar dados do Mongo:", err);
  }
}

function mudarImagemCarrossel(direcao, event) {
  if (event) event.stopPropagation(); // Evita conflitos com cliques no painel

  if (listaImagensGuardadas.length === 0) return;

  indiceImagemAtual += direcao;

  // Se passar do fim, volta à primeira foto
  if (indiceImagemAtual >= listaImagensGuardadas.length) {
    indiceImagemAtual = 0;
  }
  // Se recuar antes da primeira, vai para a última foto
  if (indiceImagemAtual < 0) {
    indiceImagemAtual = listaImagensGuardadas.length - 1;
  }

  const imgExibida = document.getElementById("imagem-exibida");
  if (imgExibida) {
    imgExibida.style.opacity = "0.3"; // Pequeno efeito suave de transição
    setTimeout(() => {
      const imagemAlvo = listaImagensGuardadas[indiceImagemAtual];
      if (imagemAlvo) {
        // CORREÇÃO: Acede ao campo .url do objeto ao passar a imagem
        imgExibida.src = imagemAlvo.url || imagemAlvo;
      }
      imgExibida.style.opacity = "1";
    }, 150);
  }

  atualizarContadorCarrossel();
}

// Atualiza o pequeno texto "1 de 3"
function atualizarContadorCarrossel() {
  const contador = document.getElementById("contador-imagens");
  if (contador) {
    contador.textContent = `${indiceImagemAtual + 1} de ${listaImagensGuardadas.length}`;
  }
}

// Permite ao utilizador saltar entre a curta e a longa
function alternarDescricao(event) {
  if (event) event.stopPropagation();

  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const btnAlternar = document.getElementById("btn-alternar-desc");

  if (exibindoLonga) {
    if (zonaMongo) zonaMongo.style.display = "none";
    if (campoDescCurta) campoDescCurta.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "Ver detalhes completos (Longa) →";
    exibindoLonga = false;
  } else {
    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;
  }
}

// --- 6. FUNÇÕES DE MINIMIZAR E REABRIR A BARRA ---

function minimizarPainel(event) {
  if (event) event.stopPropagation();
  const painel = document.getElementById("trail-info-panel");
  const titulo = document.getElementById("info-name");
  if (!painel || !titulo) return;

  if (painel.classList.contains("expandido")) {
    titulo.textContent = `${nomeTrilhoAtual} (Detalhado)`;
  } else {
    titulo.textContent = nomeTrilhoAtual;
  }

  painel.classList.add("minimizado");
}

function reabrirPeloHeader() {
  const painel = document.getElementById("trail-info-panel");
  if (!painel) return;

  if (painel.classList.contains("minimizado")) {
    painel.classList.remove("minimizado");

    const painelCorpo = document.getElementById("painel-corpo");
    if (painelCorpo) painelCorpo.style.display = "block";

    const btnFechar = document.querySelector(".btn-fechar-painel");
    if (btnFechar) btnFechar.style.display = "block";

    const infoName = document.getElementById("info-name");
    if (infoName) infoName.textContent = nomeTrilhoAtual;
  }
}

// --- 7. EVENTOS E INICIALIZAÇÃO ---
const filtroDificuldade = document.getElementById("difficulty-filter");
if (filtroDificuldade) {
  filtroDificuldade.addEventListener("change", (e) => {
    atualizarListaTrilhos(e.target.value);
  });
}

// Quando escolhes o Trilho na lista
const seletorTrilhoClick = document.getElementById("trail-selector");
if (seletorTrilhoClick) {
  seletorTrilhoClick.addEventListener("change", (e) => {
    carregarTrilho(e.target.value);
  });
}

// Executa imediatamente ao abrir a página para carregar "Todos os Trilhos"
atualizarListaTrilhos("todos");

window.addEventListener("load", () => {
  setTimeout(() => {
    if (typeof map !== "undefined") map.invalidateSize();
  }, 500);
});

window.alternarDescricao = alternarDescricao;

// =================================================================
// LÓGICA DE INSERÇÃO DE POIS - JANELA POPUP PROFISSIONAL (PG + MONGO)
// =================================================================

const botaoPoiFixo = document.getElementById("btn-modo-poi");

if (botaoPoiFixo) {
  botaoPoiFixo.addEventListener("click", function (e) {
    e.stopPropagation();

    // 1. Deteta o caminho ativo no teu menu dropdown
    const trilhoSelecionado = document.getElementById("trail-selector").value;
    if (!trilhoSelecionado) {
      alert("Por favor, selecione primeiro um trilho no menu superior!");
      return;
    }

    modoInsercaoPoi = !modoInsercaoPoi;

    if (modoInsercaoPoi) {
      botaoPoiFixo.textContent = "❌ Cancelar Inserção";
      botaoPoiFixo.style.backgroundColor = "#e74c3c";
      document.getElementById("map").style.cursor = "crosshair";
    } else {
      redefinirEstadoInsercao();
    }
  });
}

function redefinirEstadoInsercao() {
  modoInsercaoPoi = false;
  if (botaoPoiFixo) {
    botaoPoiFixo.textContent = "➕ Adicionar Ponto";
    botaoPoiFixo.style.backgroundColor = "#3498db";
  }
  document.getElementById("map").style.cursor = "";
}

// 2. Evento que monta a janela bonita ao clicar no mapa
map.on("click", function (e) {
  if (!modoInsercaoPoi) return;

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  const idTrilhoAtivo = parseInt(
    document.getElementById("trail-selector").value,
    10,
  );

  // Criamos a estrutura HTML da nossa janela costumizada
  const conteudoFormulario = `
    <div class="form-novo-poi">
      <h3>📍 Novo Ponto de Interesse</h3>
      
      <div class="form-group-poi">
        <label>Nome do Ponto (PG + Mongo)</label>
        <input type="text" id="novo-poi-nome" placeholder="Ex: Miradouro do Vouga" />
      </div>
      
      <div class="form-group-poi">
        <label>Tipo (PG + Mongo)</label>
        <select id="novo-poi-tipo">
          <option value="Natureza">Natureza</option>
          <option value="Ponte / Passadiço">Ponte / Passadiço</option>
          <option value="Início/Fim">Início/Fim</option>
          <option value="Património">Património</option>
          <option value="Água / Rio">Água / Rio</option>
        </select>
      </div>
      
      <div class="form-group-poi">
        <label>Descrição Curta (Apenas MongoDB)</label>
        <input type="text" id="novo-poi-desc" placeholder="Uma breve descrição sobre o local..." />
      </div>
      
      <div class="form-poi-botoes">
        <button class="btn-poi-salvar" onclick="submeterNovoPoi(${lat}, ${lng}, ${idTrilhoAtivo})">Gravar Ponto</button>
        <button class="btn-poi-cancelar" onclick="map.closePopup(); redefinirEstadoInsercao();">Sair</button>
      </div>
    </div>
  `;

  // Abre a janela bonita no formato de um Popup do Leaflet nas coordenadas do clique
  L.popup().setLatLng([lat, lng]).setContent(conteudoFormulario).openOn(map);
});

// 3. Função global disparada ao clicar no botão "Gravar Ponto"
window.submeterNovoPoi = function (lat, lng, idTrilho) {
  const nome = document.getElementById("novo-poi-nome").value;
  const tipo = document.getElementById("novo-poi-tipo").value;
  const descricao = document.getElementById("novo-poi-desc").value;

  if (!nome || !descricao) {
    alert("Por favor, preencha todos os campos obrigatórios!");
    return;
  }

  const payload = {
    nome: nome,
    tipo: tipo,
    descricao_curta: descricao, // Campo extraído para o MongoDB
    lat: lat,
    lng: lng,
    id_trilho: idTrilho,
  };

  fetch("/api/pois/criar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro no servidor.");
      return res.json();
    })
    .then((data) => {
      alert(
        `Sucesso! O ponto "${nome}" foi registado no PostgreSQL e o esqueleto no MongoDB.`,
      );
      map.closePopup(); // Fecha o formulário
      redefinirEstadoInsercao(); // Limpa o rato

      if (typeof carregarPOIs === "function") {
        carregarPOIs(idTrilho); // Atualiza os pins no ecrã automaticamente
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao gravar os dados nas bases de dados.");
      redefinirEstadoInsercao();
    });
};
