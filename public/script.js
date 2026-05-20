let nomeTrilhoAtual = "";
let descCurtaGuardada = "";
let descLongaHtmlGuardado = "";
let exibindoLonga = false;
let listaImagensGuardadas = [];
let indiceImagemAtual = 0;
let modoInsercaoPoi = false;

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri" },
);

const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

const iconesPorTipo = {
  // --- VERDE (Natureza, Flora, Fauna, Parques) ---
  natureza: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  via: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  flora: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  fauna: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),
  "parque de lazer / merendas": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  }),

  // --- AZUL (Água, Pontes, Passadiços) ---
  água: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "ponte / passadiço": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "ponte / monumento": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),

  // --- PRETO (Túneis ou estruturas subterrâneas) ---
  túnel: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png",
  }),

  // --- AMARELO/LARANJA (Miradouros, Observação, Informação) ---
  "miradouro / observatório": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  }),
  informação: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  }),

  // --- VIOLETA/ROXO (Património, Monumentos, História) ---
  património: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "património / cultural": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  "ruína histórica": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),
  monumento: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  }),

  // --- VERMELHO (Pontos críticos e Genéricos) ---
  "início/fim": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),
  "ponto de interesse": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  }),

  // --- CINZENTO (Infraestruturas de suporte) ---
  infraestrutura: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  }),

  // --- FALLBACK (Caso falte alguma coisa na BD) ---
  default: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
};

const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm],
  zoomControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();
    const seletorTrilhos = document.getElementById("trail-selector");
    if (!seletorTrilhos) return;

    seletorTrilhos.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';
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
        // Correção de String defensiva para mapear o ícone
        const tipoChave = feature.properties.tipo
          ? feature.properties.tipo.toLowerCase().trim()
          : "default";
        return L.marker(latlng, {
          icon: iconesPorTipo[tipoChave] || iconesPorTipo["default"],
        });
      },
      onEachFeature: (feature, layer) => {
        const nomePostgres = feature.properties.nome || "Ponto de Interesse";
        layer.bindPopup(
          `<div><b>📍 ${nomePostgres}</b><br><small style="color:#7f8c8d;">A carregar detalhes do Mongo...</small></div>`,
          { className: "custom-poi-popup", maxWidth: 280 },
        );

        layer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e);
          const poiIdExterno =
            feature.properties.id_externo ||
            feature.properties.id ||
            feature.id;
          if (poiIdExterno) {
            await mostrarDetalhesPOI(poiIdExterno, layer, feature.properties);
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

    if (res.status === 404) {
      const conteudoNovoPoi = `
        <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 220px; max-width: 280px;">
          <h3 style="margin: 0 0 5px 0; color: #3498db; font-size: 1.15em;">📍 ${propertiesPostgres.nome || "Novo Ponto"}</h3>
          <span style="background: #ebf5fb; color: #3498db; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; display: inline-block;">
            ${propertiesPostgres.tipo || "Geral"}
          </span>
          <p style="margin: 10px 0 0 0; font-size: 0.9em; line-height: 1.4; text-align: justify; color: #7f8c8d; font-style: italic;">
            "Este ponto foi criado no mapa. Ainda não tem descrição detalhada ou fotos associadas no MongoDB."
          </p>
          <div style="margin-top: 10px; font-size: 0.7em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 5px; text-align: right;">
            ID Ext (Postgres): ${idExterno}
          </div>
        </div>
      `;
      layer.setPopupContent(conteudoNovoPoi);
      return;
    }

    if (!res.ok) throw new Error(`Erro: ${res.status}`);
    const data = await res.json();

    let htmlFoto = `
      <div class="zona-imagem-poi" style="border: 1px dashed #bdc3c7; background: #f8f9fa; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #95a5a6;">
        <span style="font-size: 1.5em;">📸</span>
        <span style="font-size: 0.75em; margin-top: 5px;">Sem fotografia adicionada</span>
      </div>
    `;

    if (data.imagens && data.imagens.length > 0 && data.imagens[0] !== "") {
      // Extrai o caminho correto (seja ele o objeto .url do Mongo ou a string direta)
      const urlImagem = data.imagens[0].url || data.imagens[0];

      htmlFoto = `
      <div class="zona-imagem-poi">
        <img src="${urlImagem}" alt="${data.nome || "Imagem do ponto"}" />
      </div>
    `;
    }

    const conteudoPopup = `
      <div class="poi-popup-content" style="font-family: inherit; color: #333; min-width: 240px; max-width: 280px;">
        <h3 style="margin: 0 0 5px 0; color: #2ecc71; font-size: 1.15em;">📍 ${data.nome || propertiesPostgres.nome}</h3>
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
  }
}

async function carregarTrilho(id) {
  const painel = document.getElementById("trail-info-panel");
  if (!id) {
    if (painel) painel.style.display = "none";
    // Limpa as camadas do mapa caso o utilizador selecione a opção vazia
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });
    if (window.camadaPois) map.removeLayer(window.camadaPois);
    return;
  }

  try {
    // 1. Procura os dados espaciais e propriedades base no Postgres
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    nomeTrilhoAtual = data.properties?.nome || "Trilho Sem Nome";
    descCurtaGuardada =
      data.properties?.detalhes?.descricao_curta ||
      "Sem descrição curta disponível.";
    exibindoLonga = false;

    // 2. Repõe o estado inicial correto do Painel Lateral (Aberto, curto e sem classes extras)
    if (painel) {
      painel.className = "painel-lateral-esquerdo";
      painel.style.display = "block";
    }

    document.getElementById("painel-corpo").style.display = "block";
    document.querySelector(".btn-fechar-painel").style.display = "block";
    document.getElementById("detalhes-mongo").style.display = "none";
    document.getElementById("aviso-clique").style.display = "block";
    document.getElementById("zona-alternar").style.display = "none";
    document.getElementById("zona-carrossel").style.display = "none"; // Esconde fotos do trilho anterior

    // Injeta os dados textuais do Postgres/Mongo Inicial
    document.getElementById("info-name").textContent = nomeTrilhoAtual;
    const distValor =
      data.properties?.distancia || data.properties?.distancia_km || "0";
    document.getElementById("info-dist").textContent = distValor + " km";
    document.getElementById("info-diff").textContent =
      data.properties?.dificuldade || "n/a";

    const campoDescCurta = document.getElementById("info-desc-curta");
    campoDescCurta.style.display = "block";
    campoDescCurta.textContent = descCurtaGuardada;

    // =================================================================
    // 3. LIMPA AS LINHAS ANTIGAS E DESENHA A NOVA IMEDIATAMENTE!
    // =================================================================
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON && layer !== window.camadaPois) {
        map.removeLayer(layer);
      }
    });

    // Cria a camada geográfica do novo percurso
    const camada = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        // Ao clicar na linha física, expande para ver os detalhes do Mongo (Longa + Carrossel)
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id);
        });
      },
    }).addTo(map);

    // Ajusta o zoom do mapa para enquadrar perfeitamente o novo trilho no ecrã
    if (camada.getBounds().isValid()) {
      map.fitBounds(camada.getBounds(), { padding: [50, 50] });
    }

    // 4. Carrega os pontos de interesse (POIs) deste novo trilho
    carregarPOIs(id);
  } catch (err) {
    console.error("Erro ao carregar percurso ao mudar no dropdown:", err);
  }
}

async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLongaArea = document.getElementById("info-desc-longa");
  const campoDescCurta = document.getElementById("info-desc-curta");
  const zonaAlternar = document.getElementById("zona-alternar");
  const btnAlternar = document.getElementById("btn-alternar-desc");
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
    if (zonaAlternar) zonaAlternar.style.display = "block";
    if (btnAlternar)
      btnAlternar.textContent = "← Voltar para a descrição curta";
    exibindoLonga = true;

    if (campoDescCurta) campoDescCurta.style.display = "none";
    if (zonaMongo) zonaMongo.style.display = "block";

    if (data.imagens && data.imagens.length > 0) {
      listaImagensGuardadas = data.imagens;
      indiceImagemAtual = 0;
      const primeiraImagem = listaImagensGuardadas[indiceImagemAtual];
      if (imgExibida && primeiraImagem) {
        imgExibida.src = primeiraImagem.url || primeiraImagem;
      }
      if (zonaCarrossel) zonaCarrossel.style.display = "block";
      atualizarContadorCarrossel();
    } else {
      if (zonaCarrossel) zonaCarrossel.style.display = "none";
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
  } catch (err) {
    console.error("Erro ao carregar dados do Mongo:", err);
  }
}

function mudarImagemCarrossel(direcao, event) {
  if (event) event.stopPropagation();
  if (listaImagensGuardadas.length === 0) return;

  indiceImagemAtual += direcao;
  if (indiceImagemAtual >= listaImagensGuardadas.length) indiceImagemAtual = 0;
  if (indiceImagemAtual < 0)
    indiceImagemAtual = listaImagensGuardadas.length - 1;

  const imgExibida = document.getElementById("imagem-exibida");
  if (imgExibida) {
    imgExibida.style.opacity = "0.3";
    setTimeout(() => {
      const imagemAlvo = listaImagensGuardadas[indiceImagemAtual];
      if (imagemAlvo) imgExibida.src = imagemAlvo.url || imagemAlvo;
      imgExibida.style.opacity = "1";
    }, 150);
  }
  atualizarContadorCarrossel();
}

function atualizarContadorCarrossel() {
  const contador = document.getElementById("contador-imagens");
  if (contador)
    contador.textContent = `${indiceImagemAtual + 1} de ${listaImagensGuardadas.length}`;
}

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

function minimizarPainel(event) {
  if (event) event.stopPropagation();
  const painel = document.getElementById("trail-info-panel");
  const titulo = document.getElementById("info-name");
  if (!painel || !titulo) return;

  titulo.textContent = painel.classList.contains("expandido")
    ? `${nomeTrilhoAtual} (Detalhado)`
    : nomeTrilhoAtual;
  painel.classList.add("minimizado");
}

function reabrirPeloHeader() {
  const painel = document.getElementById("trail-info-panel");
  if (painel && painel.classList.contains("minimizado")) {
    painel.classList.remove("minimizado");
    document.getElementById("info-name").textContent = nomeTrilhoAtual;
  }
}

document
  .getElementById("difficulty-filter")
  .addEventListener("change", (e) => atualizarListaTrilhos(e.target.value));
document
  .getElementById("trail-selector")
  .addEventListener("change", (e) => carregarTrilho(e.target.value));

atualizarListaTrilhos("todos");

const botaoPoiFixo = document.getElementById("btn-modo-poi");
if (botaoPoiFixo) {
  botaoPoiFixo.addEventListener("click", function (e) {
    e.stopPropagation();
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

map.on("click", function (e) {
  if (!modoInsercaoPoi) return;

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  const seletor = document.getElementById("trail-selector");
  const idTrilhoAtivo = parseInt(seletor.value, 10);
  const nomeTrilho = seletor.options[seletor.selectedIndex].text;

  // Criamos a estrutura HTML da nossa janela costumizada
  const conteudoFormulario = `
    <div class="form-novo-poi">
      <h3>📍 Novo Ponto de Interesse</h3>
      <p style="font-size:0.8em; color:#7f8c8d; margin:-10px 0 10px 0;">A adicionar ao trilho: <b>${nomeTrilho}</b></p>
      
      <div class="form-group-poi">
        <label>Nome do Ponto (Obrigatório)</label>
        <input type="text" id="novo-poi-nome" placeholder="Ex: Miradouro do Vouga" required />
      </div>
      
      <div class="form-group-poi">
        <label>Tipo</label>
        <select id="novo-poi-tipo">
          <option value="Início/Fim">Início/Fim</option>
          <option value="Ponte / Passadiço">Ponte / Passadiço</option>
          <option value="Miradouro / Observatório">Miradouro / Observatório</option>
          <option value="Água">Água</option>
          <option value="Ponto de Interesse">Ponto de Interesse</option>
          <option value="Ponte / Monumento">Ponte / Monumento</option>
          <option value="Monumento">Monumento</option>
          <option value="Ruína Histórica">Ruína Histórica</option>
          <option value="Fauna">Fauna</option>
          <option value="Flora">Flora</option>
          <option value="Parque de Lazer / Merendas">Parque de Lazer / Merendas</option>
          <option value="Património / Cultural">Património / Cultural</option>
        </select>
      </div>
      
      <div class="form-group-poi">
        <label>Descrição Curta (Obrigatório)</label>
        <input type="text" id="novo-poi-desc" placeholder="Uma breve descrição sobre o local..." required />
      </div>

      <div class="form-group-poi">
        <label>Fotografia (Opcional)</label>
        <input type="file" id="novo-poi-imagem" accept="image/png, image/jpeg" />
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

// 3. Função global disparada ao clicar no botão "Gravar Ponto" (ALTERADA PARA FORMDATA)
window.submeterNovoPoi = function (lat, lng, idTrilho) {
  const nome = document.getElementById("novo-poi-nome").value;
  const tipo = document.getElementById("novo-poi-tipo").value;
  const descricao = document.getElementById("novo-poi-desc").value;
  const inputImagem = document.getElementById("novo-poi-imagem");

  if (!nome || !descricao) {
    alert("Por favor, preencha o Nome e a Descrição!");
    return;
  }

  // --- USO DE FORMDATA PARA SUPORTAR O FICHEIRO ---
  const formData = new FormData();
  formData.append("nome", nome);
  formData.append("tipo", tipo);
  formData.append("descricao_curta", descricao);
  formData.append("lat", lat);
  formData.append("lng", lng);
  formData.append("id_trilho", idTrilho);

  // Adiciona a imagem se houver um ficheiro selecionado
  if (inputImagem.files && inputImagem.files[0]) {
    formData.append("imagem_poi", inputImagem.files[0]);
  }

  // Desativa o botão para evitar múltiplos cliques
  const btnSalvar = document.querySelector(".btn-poi-salvar");
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "A gravar...";
  }

  fetch("/api/pois/criar", {
    method: "POST",
    // IMPORTANTE: Ao usar FormData, NÃO deves definir o Content-Type manualmente.
    // O browser define automaticamente como 'multipart/form-data' com a boundary correta.
    body: formData,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro no servidor ao criar POI.");
      return res.json();
    })
    .then((data) => {
      alert(`Sucesso! O ponto "${nome}" foi registado.`);
      map.closePopup(); // Fecha o formulário
      redefinirEstadoInsercao(); // Limpa o rato

      if (typeof carregarPOIs === "function") {
        carregarPOIs(idTrilho); // Atualiza os pins no ecrã automaticamente
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao gravar os dados nas bases de dados. Verifique a consola.");
      redefinirEstadoInsercao();
    });
};

window.alternarDescricao = alternarDescricao;
