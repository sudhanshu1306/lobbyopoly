# stdlib imports

# vendor imports
import beanie
import bson.json_util
import fastapi
import starlette.websockets
import starsessions
import typing

# local imports
from . import model


# Create the router
socketRouter = fastapi.APIRouter()


def compose_update_message(
    lobby: model.db.Lobby,
    events: list[model.db.Event],
    viewer: typing.Optional[beanie.PydanticObjectId] = None,
) -> str:
    lobby_dump = lobby.model_dump()
    # Redact other players' balances server-side so they never reach the client
    if lobby.options.hideBalances:
        for ply in lobby_dump["players"]:
            if ply["id"] != viewer:
                ply["balance"] = None
    return bson.json_util.dumps(
        {
            "type": "update",
            "payload": {
                "lobby": lobby_dump,
                "events": [e.model_dump() for e in events],
            },
        }
    )


def compose_kick_message(
    player: typing.Optional[model.db.Player] = None,
) -> str:
    return bson.json_util.dumps(
        {"type": "kick", "player": player.id if player else None}
    )


class ConnectionManager:
    def __init__(self) -> None:
        self.lobby_sockets: dict[
            beanie.PydanticObjectId,
            list[tuple[fastapi.WebSocket, typing.Optional[beanie.PydanticObjectId]]],
        ] = {}

    def register_connection(
        self,
        lobby_id: beanie.PydanticObjectId,
        sock: fastapi.WebSocket,
        player_id: typing.Optional[beanie.PydanticObjectId],
    ) -> None:
        if lobby_id not in self.lobby_sockets:
            self.lobby_sockets[lobby_id] = []
        self.lobby_sockets[lobby_id].append((sock, player_id))

    def remove_connection(
        self, lobby_id: beanie.PydanticObjectId, sock: fastapi.WebSocket
    ):
        if lobby_id in self.lobby_sockets:
            self.lobby_sockets[lobby_id] = [
                s for s in self.lobby_sockets[lobby_id] if s[0] is not sock
            ]

    async def send_message_to_lobby(self, lobby: model.db.Lobby, message: str):
        """Send a string message to all players in a lobby."""
        assert lobby.id is not None
        for sock, _ in self.lobby_sockets.get(lobby.id, []):
            if (
                sock.application_state
                == starlette.websockets.WebSocketState.CONNECTED
            ):
                await sock.send_text(message)

    async def broadcast_update(
        self,
        lobby: model.db.Lobby,
        events: list[model.db.Event] = [],
    ):
        """Broadcast a new event to all players in a lobby"""
        assert lobby.id is not None
        for sock, player_id in self.lobby_sockets.get(lobby.id, []):
            if (
                sock.application_state
                == starlette.websockets.WebSocketState.CONNECTED
            ):
                await sock.send_text(
                    compose_update_message(lobby, events, player_id)
                )

    async def broadcast_disband(self, lobby: model.db.Lobby):
        """Broadcast a disband message to all players in a lobby."""
        await self.send_message_to_lobby(lobby, compose_kick_message())

    async def broadcast_kick(
        self, lobby: model.db.Lobby, player: model.db.Player
    ):
        """Broadcast a message to kick a specific player to an entire lobby"""
        await self.send_message_to_lobby(lobby, compose_kick_message(player))


manager = ConnectionManager()


@socketRouter.websocket("/events/{lobby_id}")
async def socket_endpoint(websocket: fastapi.WebSocket, lobby_id: str):
    # Accept the socket connection on a preliminary basis
    await websocket.accept()

    # Try to find the lobby by ID, and close the connection if not found
    lobby = await model.db.Lobby.get(lobby_id)
    if lobby is None:
        await websocket.close()
        return
    assert lobby.id is not None

    # Begin by sending all the current events to the client
    event_docs = (
        await model.db.Event.find(model.db.Event.lobby == lobby.id)
        .sort([("time", beanie.SortDirection.ASCENDING)])
        .to_list()
    )
    # Identify the viewing player from the session (None if not in this lobby)
    await starsessions.load_session(websocket)
    player_id = None
    if websocket.session.get("lobbyId") == str(lobby.id):
        player_id = beanie.PydanticObjectId(websocket.session.get("playerId"))

    await websocket.send_text(
        compose_update_message(lobby, event_docs, player_id)
    )

    # Then register the websocket to receive future updates
    manager.register_connection(lobby.id, websocket, player_id)

    while True:
        message = await websocket.receive()

        # Upon receiving disconnect, close the connection and return
        if message["type"] == "websocket.disconnect":
            await websocket.close()
            manager.remove_connection(lobby.id, websocket)
            break
