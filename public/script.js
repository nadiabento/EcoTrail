// 1. Inicializar o mapa focado em Aveiro
const map = L.map("map").setView([40.6443, -8.6455], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Referências aos elementos do HTML (IDs definidos no index.html)
const difficultyFilter = document.getElementById("difficulty-filter");
const trailSelector = document.getElementById("trail-selector");

/**
 * FUNÇÃO: Atualiza as opções do seletor de trilhos com base na dificuldade
 */
async function atualizarListaTrilhos(dificuldade) {
  try {
    console.log(`A filtrar lista por: ${dificuldade}`);
    const response = await fetch(`/api/trilhos/${dificuldade}`);
    const trilhos = await response.json();

    // Limpa o seletor atual
    trailSelector.innerHTML =
      '<option value="">-- Escolha um Trilho --</option>';

    // Adiciona cada trilho recebido como uma nova <option>
    trilhos.forEach((t) => {
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = t.nome;
      trailSelector.appendChild(option);
    });
  } catch (err) {
    console.error("Erro ao carregar lista de nomes:", err);
  }
}

/**
 * FUNÇÃO: Desenha o trilho selecionado no mapa
 */
async function carregarTrilhoNoMapa(id) {
  if (!id) return; // Se for o valor vazio da lista, não faz nada

  try {
    const response = await fetch(`/api/trilho-completo/${id}`);
    const data = await response.json();

    // 1. Limpar desenhos anteriores (para não sobrepor trilhos)
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) map.removeLayer(layer);
    });

    // 2. Criar a camada GeoJSON e adicionar ao mapa
    const camadaTrilho = L.geoJSON(data, {
      style: { color: "#2ecc71", weight: 6, opacity: 0.8 },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const mongo = props.detalhes;

        // Criar conteúdo do balão (Pop-up)
        let popupHTML = `
                    <h3>${props.nome}</h3>
                    <p><b>Dificuldade:</b> ${props.dificuldade}</p>
                    <p><b>Distância:</b> ${props.distancia} km</p>
                    <hr>
                    <p>${mongo.descricao}</p>
                `;

        // Se houver fotos no Mongo, adicionamos a primeira ao pop-up
        if (mongo.fotos && mongo.fotos.length > 0) {
          popupHTML += `<img src="${mongo.fotos[0]}" style="width:100%; border-radius:5px; margin-top:10px;">`;
        }

        layer.bindPopup(popupHTML);
      },
    }).addTo(map);

    // 3. Focar o mapa no trilho desenhado
    setTimeout(() => {
      map.fitBounds(camadaTrilho.getBounds(), { padding: [50, 50] });
    }, 100);
  } catch (err) {
    console.error("Erro ao desenhar trilho:", err);
  }
}

// --- CONFIGURAÇÃO DOS EVENTOS ---

// Quando mudamos a dificuldade, recarregamos a lista de nomes
difficultyFilter.addEventListener("change", (e) => {
  atualizarListaTrilhos(e.target.value);
});

// Quando escolhemos um trilho específico, desenhamos no mapa
trailSelector.addEventListener("change", (e) => {
  carregarTrilhoNoMapa(e.target.value);
});

// Ao abrir a página, carregamos todos os trilhos na lista inicial
atualizarListaTrilhos("todos");
