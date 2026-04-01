/**
 * Точка входа клиента: стили, игровой модуль, привязка UI лобби.
 */
import './game/gameClient.js';
import './styles/main.css';
import { mountLobbyUI } from './ui/lobbyController.js';

mountLobbyUI();

