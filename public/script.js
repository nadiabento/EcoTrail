// 1. CONFIGURAÇÃO DE CAMADAS DO MAPA
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
});

// 2. DEFINIÇÃO DO ÍCONE PARA PONTOS DE INTERESSE (POIs)
// Função para criar ícones SVG bonitos e coloridos
const baseIconParams = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
};

const iconesPorTipo = {
  // --- VERDES (Natureza e Caminhos) ---
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

  // --- AZUIS (Água e Engenharia) ---
  Água: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  }),
  "Ponte / Passadiço": L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-cyan.png",
  }),
  Túnel: L.icon({
    ...baseIconParams,
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png",
  }),

  // --- LARANJA/AMARELO (Vistas e Informação) ---
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

  // --- VIOLETA/VERMELHO (História e Destaques) ---
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

  // --- CINZA (Infraestrutura) ---
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
const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri",
  },
);

// Inicialização do Mapa Leaflet
const map = L.map("map", {
  center: [40.6443, -8.6455],
  zoom: 11,
  layers: [osm], // Camada inicial
});

// Adiciona o seletor de camadas no topo direito
L.control.layers({ "🗺️ Rua": osm, "🛰️ Satélite": satellite }).addTo(map);

// Referências aos elementos do DOM (HTML)
const difficultyFilter = document.getElementById("difficulty-filter");
const trailSelector = document.getElementById("trail-selector");
const infoPanel = document.getElementById("trail-info-panel");
//const btnReopen = document.getElementById("btn-reopen");

/**
 * FUNÇÃO: Atualiza o seletor de trilhos conforme a dificuldade escolhida
 */
async function atualizarListaTrilhos(dificuldade) {
  try {
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();

    // Limpa e reseta o seletor de trilhos
    trailSelector.innerHTML =
      '<option value="">-- Selecione um trilho --</option>';

    trilhos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.nome;
      trailSelector.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao atualizar lista:", err);
  }
}

// --- FUNÇÃO PARA CARREGAR OS PONTOS DE INTERESSE ---
async function carregarPOIs(trilhoId) {
  try {
    const response = await fetch(`/api/pois/${trilhoId}`);
    const data = await response.json();

    if (window.camadaPois) {
      map.removeLayer(window.camadaPois);
    }

    window.camadaPois = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        // Pega o tipo da BD e remove espaços extras
        const tipoOriginal = feature.properties.tipo
          ? feature.properties.tipo.trim()
          : "default";

        // Busca no objeto iconesPorTipo. Se não existir o nome exato, usa o default.
        const iconeSelecionado =
          iconesPorTipo[tipoOriginal] || iconesPorTipo["default"];

        return L.marker(latlng, { icon: iconeSelecionado });
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div style="text-align:center;">
            <b style="color:#2c3e50;">📍 ${feature.properties.nome}</b><br>
            <small style="color:#7f8c8d;">${feature.properties.tipo}</small>
          </div>
        `);
      },
    }).addTo(map);
  } catch (err) {
    console.error("Erro ao carregar POIs:", err);
  }
}
// --- FUNÇÃO PARA CARREGAR O TRILHO ---
// --- FUNÇÃO PARA CARREGAR TUDO (NEON + MONGO) DE UMA VEZ ---
async function carregarTrilho(id) {
  if (!id) {
    infoPanel.style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const dataGeo = await response.json();

    // 1. Desenhar no mapa
    map.eachLayer((l) => {
      if (l instanceof L.GeoJSON && l !== window.camadaPois) map.removeLayer(l);
    });

    const camada = L.geoJSON(dataGeo, {
      style: { color: "#2ecc71", weight: 6, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          // AQUI: Fecha a pequena e abre a grande
          infoPanel.style.display = "none";
          abrirModalGrande(id);
        });
      },
    }).addTo(map);

    map.fitBounds(camada.getBounds(), { padding: [50, 50] });

    // 2. MOSTRAR JANELA PEQUENA (Resumo Postgres)
    infoPanel.style.display = "block";
    document.getElementById("info-name").textContent = dataGeo.properties.nome;
    document.getElementById("info-dist").textContent =
      dataGeo.properties.distancia + " km";
    document.getElementById("info-diff").textContent =
      dataGeo.properties.dificuldade;
    document.getElementById("info-desc").textContent =
      "Clica na linha para ver fauna e flora.";

    carregarPOIs(id);
  } catch (err) {
    console.error(err);
  }
  if (!id) {
    document.getElementById("trail-info-panel").style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const dataGeo = await response.json();

    // Configura o painel para o estado inicial (Pequeno)
    const painel = document.getElementById("trail-info-panel");
    painel.classList.remove("expandido");
    painel.style.display = "block";
    document.getElementById("detalhes-mongo").style.display = "none";
    document.getElementById("aviso-clique").style.display = "block";

    // Preenche os dados básicos (Postgres)
    document.getElementById("info-name").textContent = dataGeo.properties.nome;
    document.getElementById("info-dist").textContent =
      dataGeo.properties.distancia + " km";
    document.getElementById("info-diff").textContent =
      dataGeo.properties.dificuldade;

    // Desenha no mapa
    map.eachLayer((l) => {
      if (l instanceof L.GeoJSON && l !== window.camadaPois) map.removeLayer(l);
    });

    const camada = L.geoJSON(dataGeo, {
      style: { color: "#2ecc71", weight: 6, cursor: "pointer" },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          mostrarDetalhesNoPainel(id); // Expande a janela
        });
      },
    }).addTo(map);

    map.fitBounds(camada.getBounds(), { padding: [50, 50] });
    carregarPOIs(id);
  } catch (err) {
    console.error(err);
  }
}

// --- EVENTOS ---

// Quando muda a dificuldade, recarrega a lista
difficultyFilter.addEventListener("change", (e) => {
  atualizarListaTrilhos(e.target.value);
});

// Quando seleciona um trilho, carrega os dados
trailSelector.addEventListener("change", (e) => {
  carregarTrilho(e.target.value);
});

// NOVO: Evento para o botão "i" - Reabre a janela se o utilizador a fechou
/*btnReopen.addEventListener("click", () => {
  const selectedId = trailSelector.value;
  if (selectedId) {
    carregarTrilho(selectedId); // Re-executa a função para abrir a janela
  } else {
    alert("Selecione primeiro um trilho na lista!");
  }
});*/

// Inicialização: Preenche a lista com "todos" ao carregar a página
atualizarListaTrilhos("todos");

// Correção para redimensionamento do mapa
window.addEventListener("load", () => {
  setTimeout(() => map.invalidateSize(), 500);
});

async function abrirPainelDetalhado(id) {
  // Aqui podes usar o painel lateral que criámos antes (id="painel-detalhes")
  const painelGrande = document.getElementById("painel-detalhes");
  const conteudo = document.getElementById("conteudo-detalhes");

  painelGrande.classList.add("aberto");
  conteudo.innerHTML = "<em>A carregar fauna, flora e curiosidades...</em>";

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    conteudo.innerHTML = `
            <h2 style="color:#2ecc71; border-bottom:2px solid #eee; padding-bottom:10px;">${data.nome || "Detalhes do Trilho"}</h2>
            <div style="margin-top:15px;">
                <p><strong>📜 Descrição Completa:</strong></p>
                <p style="text-align:justify;">${data.descricao_longa || "Sem descrição disponível."}</p>
                <hr>
                <p>🌿 <b>Flora:</b> ${data.flora ? data.flora.join(", ") : "n/a"}</p>
                <p>🦆 <b>Fauna:</b> ${data.fauna ? data.fauna.join(", ") : "n/a"}</p>
                <p>📅 <b>Melhor Época:</b> ${data.melhor_epoca || "n/a"}</p>
                <p>💡 <b>Curiosidades:</b></p>
                <ul>
                    ${data.curiosidades ? data.curiosidades.map((c) => `<li>${c}</li>`).join("") : "<li>Descobre mais ao percorrer o trilho!</li>"}
                </ul>
            </div>
        `;
  } catch (err) {
    conteudo.innerHTML = "<p>Erro ao ligar ao MongoDB.</p>";
  }
}

async function abrirModalGrande(id) {
  const modal = document.getElementById("modal-detalhes");
  const conteudo = document.getElementById("conteudo-detalhes-grande");

  modal.style.display = "flex";
  conteudo.innerHTML = "<h2>A carregar detalhes...</h2>";

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    conteudo.innerHTML = `
            <h1 style="color:#2ecc71; margin-bottom:10px;">${data.nome}</h1>
            <p style="font-size:1.2em; line-height:1.6; color:#333;">${data.descricao_longa}</p>
            <hr style="margin:20px 0;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div>
                    <h3>🌿 Flora</h3>
                    <p>${data.flora ? data.flora.join(", ") : "Não especificado"}</p>
                </div>
                <div>
                    <h3>🦆 Fauna</h3>
                    <p>${data.fauna ? data.fauna.join(", ") : "Não especificado"}</p>
                </div>
            </div>
            <div style="margin-top:20px; background:#f9f9f9; padding:15px; border-radius:10px;">
                <p>💡 <b>Dica:</b> ${data.melhor_epoca ? "A melhor altura para visitar é na " + data.melhor_epoca : "Trilho incrível em qualquer época!"}</p>
            </div>
        `;
  } catch (err) {
    conteudo.innerHTML = "<h2>Erro ao carregar dados do MongoDB.</h2>";
  }
}

async function mostrarDetalhesNoPainel(id) {
  const painel = document.getElementById("trail-info-panel");
  const zonaMongo = document.getElementById("detalhes-mongo");
  const descLonga = document.getElementById("info-desc-longa");

  try {
    const res = await fetch(`/api/detalhes-mongo/${id}`);
    const data = await res.json();

    // Expande o painel e mostra os dados do Mongo
    painel.classList.add("expandido");
    document.getElementById("aviso-clique").style.display = "none";
    zonaMongo.style.display = "block";

    descLonga.innerHTML = `
            <p style="line-height:1.5; color:#444;">${data.descricao_longa}</p>
            <p>🌿 <b>Flora:</b> ${data.flora ? data.flora.join(", ") : "n/a"}</p>
            <p>🦆 <b>Fauna:</b> ${data.fauna ? data.fauna.join(", ") : "n/a"}</p>
            <p>📅 <b>Época:</b> ${data.melhor_epoca || "n/a"}</p>
        `;
  } catch (err) {
    console.error("Erro ao carregar Mongo:", err);
  }
}

function fecharPainel() {
  document.getElementById("trail-info-panel").style.display = "none";
}
