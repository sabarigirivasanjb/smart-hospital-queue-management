from typing import Dict, List
from fastapi import WebSocket
import json


class WebSocketManager:
    """Manages WebSocket connections for real-time queue updates."""

    def __init__(self):
        # user_id -> WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        # department_id -> list of connected doctor/admin WebSockets
        self.department_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    async def connect_department(self, websocket: WebSocket, department_id: int):
        await websocket.accept()
        if department_id not in self.department_connections:
            self.department_connections[department_id] = []
        self.department_connections[department_id].append(websocket)

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)

    def disconnect_department(self, websocket: WebSocket, department_id: int):
        if department_id in self.department_connections:
            try:
                self.department_connections[department_id].remove(websocket)
            except ValueError:
                pass

    async def send_to_user(self, user_id: int, message: dict):
        """Send a JSON message to a specific user."""
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.disconnect(user_id)

    async def broadcast_to_department(self, department_id: int, message: dict):
        """Broadcast a JSON message to all subscribers in a department channel."""
        dead = []
        for ws in self.department_connections.get(department_id, []):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_department(ws, department_id)

    async def broadcast_all(self, message: dict):
        """Broadcast a JSON message to ALL connected users."""
        dead = []
        for uid, ws in list(self.active_connections.items()):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(uid)


# Singleton instance shared across routers
ws_manager = WebSocketManager()
