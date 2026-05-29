// --- CONFIGURACIÓN DE CONEXIÓN ONLINE ---
const SERVER_URL = "https://impostor-futbolero-server.onrender.com"; 
const socket = io(SERVER_URL);

// --- VARIABLES DE ESTADO ---
let currentRoomCode = null;
let myPlayerName = "";
let myRoleInfo = null; 
let selectedVoteId = null;

// --- ELEMENTOS DEL DOM ---
const screens = {
    config: document.getElementById('config-screen'),
    lobby: document.getElementById('lobby-screen'),
    play: document.getElementById('game-play-screen'),
    result: document.getElementById('result-screen')
};

const roleModal = document.getElementById('role-modal');
const roleCard = document.getElementById('role-card');
const roleTextDisplay = document.querySelector('.role-text-display');
const roomCodeDisplay = document.getElementById('room-code-display');
const playersList = document.getElementById('players-list');
const startOnlineGameBtn = document.getElementById('startOnlineGameBtn');
const voteOptionsContainer = document.getElementById('vote-options-container');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const resultMessage = document.getElementById('result-message');
const impostorReveal = document.getElementById('impostor-reveal');
const wordReveal = document.getElementById('word-reveal');

const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');

// Manejador del cambio de pantallas globales
function showScreen(screenKey) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.remove('active');
    });
    screens[screenKey].classList.add('active');
}

// Re-activar botones si hay fallos
function resetHomeButtons() {
    createGameBtn.disabled = false;
    createGameBtn.textContent = "Crear Sala Nueva";
    joinGameBtn.disabled = false;
    joinGameBtn.textContent = "Unirse";
}

// --- CONTROLES DE INTERFAZ (BOTONES DE ACCIÓN) ---

// Crear una Sala Online
createGameBtn.addEventListener('click', () => {
    const name = document.getElementById('playerName').value.trim();
    const difficulty = document.getElementById('difficulty').value;
    
    if(!name) return alert("Escribe tu nombre para jugar, crack.");
    
    // Apagar botón inmediatamente para evitar duplicados por clics rápidos
    createGameBtn.disabled = true;
    createGameBtn.textContent = "Creando...";
    
    myPlayerName = name;
    socket.emit('create_room', { playerName: name, difficulty: difficulty });
});

// Unirse a una Sala Online Existente
joinGameBtn.addEventListener('click', () => {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if(!name || !code) return alert("Por favor ingresa tu nombre y el código de la sala.");
    
    // Apagar botón inmediatamente para impedir clones
    joinGameBtn.disabled = true;
    joinGameBtn.textContent = "Uniéndose...";
    
    myPlayerName = name;
    socket.emit('join_room', { roomCode: code, playerName: name });
});

// Arrancar el partido (Acción habilitada solo para el Host dueño)
startOnlineGameBtn.addEventListener('click', () => {
    if(currentRoomCode) {
        socket.emit('start_game', { roomCode: currentRoomCode });
    }
});

// Enviar Voto a la banca
submitVoteBtn.addEventListener('click', () => {
    if(!selectedVoteId) return alert("Elige a quién vas a acusar de impostor, compa.");
    
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "Voto enviado. Esperando...";
    socket.emit('cast_vote', { roomCode: currentRoomCode, votedPlayerName: selectedVoteId });
});

// Ventana de Ver Rol
document.getElementById('viewMyRoleBtn').addEventListener('click', () => {
    roleModal.classList.add('active');
});
document.getElementById('closeModalBtn').addEventListener('click', () => {
    roleModal.classList.remove('active');
});

// --- SISTEMA DE REVELACIÓN POR TOQUE / MANTENER PRESIONADO ---
function setupRevealEvents() {
    const startReveal = () => {
        if(!myRoleInfo) return;
        roleCard.classList.remove('card-hidden');
        roleCard.classList.add('card-revealed');
        
        if (myRoleInfo.isImpostor) {
            roleTextDisplay.innerHTML = "😈 ¡ERES EL IMPOSTOR!<br><small>Disimula, no tienes la palabra.</small>";
        } else {
            roleTextDisplay.innerHTML = `⚽ Jugador Estrella<br>Palabra: <strong>${myRoleInfo.word}</strong>`;
        }
    };

    const stopReveal = () => {
        roleCard.classList.remove('card-revealed');
        roleCard.classList.add('card-hidden');
        roleTextDisplay.innerHTML = "Mantén presionado aquí...";
    };

    roleCard.addEventListener('mousedown', startReveal);
    roleCard.addEventListener('mouseup', stopReveal);
    roleCard.addEventListener('mouseleave', stopReveal);
    
    // Soporte táctil para celulares
    roleCard.addEventListener('touchstart', (e) => { e.preventDefault(); startReveal(); });
    roleCard.addEventListener('touchend', stopReveal);
}
setupRevealEvents();

// --- ESCUCHADORES DE RESPUESTAS DEL SERVIDOR (RENDER) ---

socket.on('room_created', (room) => {
    currentRoomCode = room.code;
    roomCodeDisplay.textContent = room.code;
    updatePlayersLobby(room.players);
    showScreen('lobby');
    startOnlineGameBtn.style.display = "block";
    resetHomeButtons();
});

socket.on('room_updated', (room) => {
    currentRoomCode = room.code;
    roomCodeDisplay.textContent = room.code;
    updatePlayersLobby(room.players);
    
    // CORRECCIÓN MULTIJUGADOR: Forzar redirección al Lobby a los nuevos miembros que ingresan
    showScreen('lobby');
    resetHomeButtons();
    
    // Validación de permisos para iniciar juego (Solo el primer jugador de la lista puede iniciar)
    if (room.players[0].id !== socket.id) {
        startOnlineGameBtn.style.display = "none";
    } else {
        startOnlineGameBtn.style.display = "block";
        if(room.players.length >= 3) {
            startOnlineGameBtn.disabled = false;
            startOnlineGameBtn.textContent = "⚽ ¡Iniciar Partido! ⚽";
            startOnlineGameBtn.classList.remove('waiting');
        } else {
            startOnlineGameBtn.disabled = true;
            startOnlineGameBtn.textContent = "Esperando jugadores...";
            startOnlineGameBtn.classList.add('waiting');
        }
    }
});

function updatePlayersLobby(players) {
    playersList.innerHTML = "";
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name + (p.id === socket.id ? " (Tú)" : "");
        playersList.appendChild(li);
    });
}

socket.on('receive_role', (roleData) => {
    myRoleInfo = roleData;
    roleModal.classList.add('active'); 
});

socket.on('game_started_broadcast', ({ players }) => {
    submitVoteBtn.disabled = false;
    submitVoteBtn.textContent = "Confirmar Voto";
    selectedVoteId = null;
    showScreen('play');
    
    voteOptionsContainer.innerHTML = "";
    players.forEach(pName => {
        const div = document.createElement('div');
        div.classList.add('vote-option');
        div.textContent = pName;
        div.addEventListener('click', () => {
            if (submitVoteBtn.disabled) return;
            document.querySelectorAll('.vote-option').forEach(opt => opt.classList.remove('selected'));
            div.classList.add('selected');
            selectedVoteId = pName;
        });
        voteOptionsContainer.appendChild(div);
    });
});

socket.on('game_over', ({ result, impostorName, word }) => {
    if (result === "players") {
        resultMessage.textContent = "¡Los Jugadores Ganan! 🎉";
        resultMessage.style.color = "#66fcf1";
    } else {
        resultMessage.textContent = "¡El Impostor Ganó! 😈";
        resultMessage.style.color = "#ff4a5a";
    }
    impostorReveal.textContent = `El impostor era: ${impostorName}`;
    wordReveal.textContent = `La palabra secreta era: ${word}`;
    showScreen('result');
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
    currentRoomCode = null;
    myRoleInfo = null;
    selectedVoteId = null;
    document.getElementById('roomCodeInput').value = "";
    showScreen('config');
});

socket.on('error_message', (msg) => {
    alert(msg);
    resetHomeButtons();
});

// --- PESTAÑAS DEL MENÚ DE CONFIGURACIÓN INTERNO (ESTILO REFE) ---
const tabCreate = document.getElementById('tab-create');
const tabJoin = document.getElementById('tab-join');
const formCreateContent = document.getElementById('form-create-content');
const formJoinContent = document.getElementById('form-join-content');

tabCreate.addEventListener('click', () => {
    tabJoin.classList.remove('active');
    tabCreate.classList.add('active');
    formJoinContent.classList.remove('active');
    formCreateContent.classList.add('active');
});

tabJoin.addEventListener('click', () => {
    tabCreate.classList.remove('active');
    tabJoin.classList.add('active');
    formCreateContent.classList.remove('active');
    formJoinContent.classList.add('active');
});