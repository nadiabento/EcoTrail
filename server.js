// 1. Importa o pacote CORS (permite que o Frontend aceda à API)
const cors = require("cors");

// 2. Ativa o CORS (essencial para o mapa no browser não ser bloqueado por segurança)
app.use(cors());

// 3. Permite que o servidor leia ficheiros JSON no corpo das requisições
app.use(express.json());

// 4. Diz ao Node que a pasta "public" contém os ficheiros do site (HTML, CSS, JS)
// Assim, ao abrir http://localhost:3000, o Node procura o index.html lá dentro.
app.use(express.static("public"));
