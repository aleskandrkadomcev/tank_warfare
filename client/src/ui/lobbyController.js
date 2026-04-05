/**
 * Кнопки лобби и меню без глобальных window.* (фаза 2.4).
 */
import {
    addBot,
    createLobby,
    joinLobby,
    joinLobbyByCode,
    rejoinLobby,
    removeBot,
    sendChatMessage,
    setTeam,
    startGame,
    toggleReady,
} from '../game/gameClient.js';

export function mountLobbyUI() {
    document.getElementById('btnCreate')?.addEventListener('click', () => createLobby());
    document.getElementById('btnJoin')?.addEventListener('click', () => joinLobbyByCode());
    document.querySelector('.team-btn.t1')?.addEventListener('click', () => setTeam(1));
    document.querySelector('.team-btn.t2')?.addEventListener('click', () => setTeam(2));
    document.getElementById('btnReady')?.addEventListener('click', () => toggleReady());
    document.getElementById('btnStart')?.addEventListener('click', () => startGame());
    document.getElementById('btnAddBotMain')?.addEventListener('click', () => {
        const menu = document.getElementById('botDiffMenu');
        if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('botDiffMenu')?.addEventListener('click', (e) => {
        const item = e.target.closest('[data-diff]');
        if (!item) return;
        const diff = parseInt(item.getAttribute('data-diff'), 10);
        addBot(diff);
        document.getElementById('botDiffMenu').style.display = 'none';
    });
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('botDiffMenu');
        if (menu && !e.target.closest('#btnAddBot')) menu.style.display = 'none';
    });
    document.getElementById('btnRemoveBot')?.addEventListener('click', () => removeBot());
    document.getElementById('btnLeaveLobby')?.addEventListener('click', () => { sessionStorage.removeItem('lobbyReconnect'); location.reload(); });
    document.getElementById('lobby-chat-send')?.addEventListener('click', () => sendChatMessage());
    document.getElementById('lobby-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
    });

    document.getElementById('lobbyList')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.join-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-lobby-id');
        if (!id) return;
        if (btn.getAttribute('data-rejoin') === '1') {
            rejoinLobby(id);
        } else {
            joinLobby(id);
        }
    });
}
