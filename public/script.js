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
    const data = await response.json();

    if (data.error) {
      console.error("Erro na API:", data.error);
      return;
    }

    // Limpar camadas anteriores
    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) map.removeLayer(layer);
    });

    // Adicionar o GeoJSON ao mapa
    const camadaTrilho = L.geoJSON(data, {
      style: {
        color: "#2ecc71",
        weight: 6,
        opacity: 0.8,
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const mongo = props.detalhes || {};

        const popupContent = `
            <div class="map-popup">
                <h3>${props.nome || "Trilho"}</h3>
                <p><strong>Dificuldade:</strong> ${props.dificuldade || "N/A"}</p>
                <p><strong>Distância:</strong> ${props.distancia || "?"} km</p>
                <p>${mongo.descricao || "Sem descrição disponível."}</p>
                ${
                  mongo.fotos && mongo.fotos.length > 0
                    ? `<img src="${mongo.fotos[0]}" style="width:100%; border-radius:5px;">`
                    : ""
                }
            </div>`;
        layer.bindPopup(popupContent);
      },
    }).addTo(map);

    map.fitBounds(camadaTrilho.getBounds(), { padding: [30, 30] });
  } catch (err) {
    console.error("Erro na comunicação com o servidor:", err);
  }
}

document.getElementById("trail-selector").addEventListener("change", (e) => {
  carregarTrilho(e.target.value);
});

// Carregar o primeiro trilho ao iniciar
carregarTrilho(1);
