// 1. Inicializar o mapa focado em Aveiro
const map = L.map("map").setView([40.6443, -8.6455], 13);

// 2. Adicionar a camada base (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Correção para carregamento de tiles
window.addEventListener("load", () => {
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
});

async function carregarTrilho(id) {
  try {
    console.log(`A carregar trilho ID: ${id}...`);
    const response = await fetch(`/api/trilho-completo/${id}`);

    if (!response.ok) {
      console.error("Trilho não encontrado ou erro no servidor");
      return;
    }

    const data = await response.json();
    console.log("Dados recebidos com sucesso:", data);

    // 1. Limpar camadas GeoJSON antigas antes de desenhar a nova
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        map.removeLayer(layer);
      }
    });

    // 2. Criar a nova camada GeoJSON
    const camadaTrilho = L.geoJSON(data, {
      style: {
        color: "#2ecc71", // Verde esmeralda
        weight: 6,
        opacity: 0.8,
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const mongo = props.detalhes || {};

        const popupContent = `
            <div class="map-popup">
                <h3 style="margin-bottom:5px;">${props.nome || "Trilho"}</h3>
                <p><strong>Dificuldade:</strong> ${props.dificuldade || "N/A"}</p>
                <p><strong>Distância:</strong> ${props.distancia || "?"} km</p>
                <hr>
                <p>${mongo.descricao || "Sem detalhes."}</p>
            </div>`;
        layer.bindPopup(popupContent);
      },
    }).addTo(map);

    // 3. O PASSO CRÍTICO: Ajustar o zoom para os novos dados
    // Usamos um pequeno timeout para garantir que o Leaflet calculou os limites
    setTimeout(() => {
      const bounds = camadaTrilho.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        console.error("Limites do trilho inválidos.");
      }
    }, 100);
  } catch (err) {
    console.error("Erro na comunicação com o servidor:", err);
  }
}

document.getElementById("trail-selector").addEventListener("change", (e) => {
  carregarTrilho(e.target.value);
});

// Carregar o primeiro trilho ao iniciar
carregarTrilho(1);
