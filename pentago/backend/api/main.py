"""REST + WebSocket API for the Pentago engine, built with FastAPI.

The server is the authority on every game. Clients send intentions (create,
join, move) over REST and receive the resulting state; anyone watching a
game over its WebSocket is pushed the new state after every change,
including the computer's replies, which are played in the background.
"""

from __future__ import annotations

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from game_engine import Color, IllegalMove, Move, Rotation
from game_engine.ai import choose_move

from .schemas import (
    CreateGameRequest,
    GameState,
    JoinGameRequest,
    LastMove,
    MoveRequest,
    PlayerInfo,
    RotationBody,
    SeatResponse,
    StateMessage,
)
from .store import GameRecord, Mode, store

app = FastAPI(title="Pentago API")


def _serialize(record: GameRecord) -> GameState:
    game = record.game
    last_move = None
    if game.last_move is not None and game.last_mover is not None:
        rotation = game.last_move.rotation
        last_move = LastMove(
            player=game.last_mover,
            row=game.last_move.row,
            col=game.last_move.col,
            rotation=RotationBody(quadrant=rotation.quadrant, direction=rotation.direction) if rotation else None,
        )
    return GameState(
        id=record.id,
        mode=record.mode,
        status="waiting_for_opponent" if record.waiting_for_opponent else game.status.value,
        board=game.board.grid(),
        current_player=game.current_player,
        move_count=game.move_count,
        last_move=last_move,
        winning_lines=game.winning_lines(),
        players={
            color: PlayerInfo(kind="computer" if color == record.computer else "human", joined=record.seated(color))
            for color in Color
        },
        difficulty=record.difficulty,
    )


async def _broadcast(record: GameRecord, state: GameState) -> None:
    message = StateMessage(game=state).model_dump(mode="json", by_alias=True)
    for ws in list(record.subscribers):
        try:
            await ws.send_json(message)
        except Exception:
            record.subscribers.discard(ws)


async def _play_computer_turn(record: GameRecord) -> None:
    """Let the computer move. Runs after the response to the move that handed it the turn."""
    async with record.lock:
        if not record.computer_to_move:
            return
        game = record.game
        board, color, move_count = game.board, game.current_player, game.move_count

    # The search is CPU-bound; keep it off the event loop so other games stay responsive.
    move = await run_in_threadpool(choose_move, board, color, record.difficulty)

    async with record.lock:
        if game.move_count != move_count:
            return
        game.play(move)
        state = _serialize(record)
    await _broadcast(record, state)


def _get_record(game_id: str) -> GameRecord:
    record = store.get(game_id)
    if record is None:
        raise HTTPException(404, "game not found")
    return record


def _bearer_token(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "missing player token; send 'Authorization: Bearer <token>'")
    return token.strip()


@app.post("/games", status_code=201, response_model=SeatResponse)
async def create_game(background: BackgroundTasks, req: CreateGameRequest | None = None) -> SeatResponse:
    req = req or CreateGameRequest()
    record = store.create(req.mode)
    join_code = None

    if req.mode is Mode.LOCAL:
        colors = frozenset(Color)
    else:
        colors = frozenset({req.color})
        if req.mode is Mode.COMPUTER:
            record.computer = req.color.opponent
            record.difficulty = req.difficulty
        else:
            join_code = store.issue_join_code(record)
    token = record.add_player(colors)

    if record.computer_to_move:
        background.add_task(_play_computer_turn, record)
    return SeatResponse(
        game=_serialize(record),
        player_token=token,
        colors=[color for color in Color if color in colors],
        join_code=join_code,
    )


@app.post("/games/join", response_model=SeatResponse)
async def join_game(req: JoinGameRequest) -> SeatResponse:
    record = store.claim_join_code(req.code)
    if record is None:
        raise HTTPException(404, "no game is waiting for that join code")

    async with record.lock:
        open_seat = next(color for color in Color if not record.seated(color))
        token = record.add_player(frozenset({open_seat}))
        state = _serialize(record)
    await _broadcast(record, state)
    return SeatResponse(game=state, player_token=token, colors=[open_seat])


@app.get("/games/{game_id}", response_model=GameState)
async def get_game(game_id: str) -> GameState:
    return _serialize(_get_record(game_id))


@app.post("/games/{game_id}/moves", response_model=GameState)
async def make_move(
    game_id: str,
    req: MoveRequest,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> GameState:
    record = _get_record(game_id)
    token = _bearer_token(authorization)

    async with record.lock:
        colors = record.colors_for(token)
        if not colors:
            raise HTTPException(401, "that token does not belong to a player in this game")
        if record.waiting_for_opponent:
            raise HTTPException(409, "waiting for an opponent to join")
        game = record.game
        if game.status.is_over:
            raise HTTPException(409, "the game is already over")
        if game.current_player not in colors:
            raise HTTPException(409, f"it is {game.current_player.value}'s turn")

        rotation = Rotation(req.rotation.quadrant, req.rotation.direction) if req.rotation else None
        try:
            game.play(Move(req.row, req.col, rotation))
        except IllegalMove as e:
            raise HTTPException(409, str(e)) from e
        state = _serialize(record)

    await _broadcast(record, state)
    if record.computer_to_move:
        background.add_task(_play_computer_turn, record)
    return state


@app.websocket("/games/{game_id}/ws")
async def watch_game(websocket: WebSocket, game_id: str) -> None:
    """Push the game's state now and after every change. Messages from the client are ignored."""
    record = store.get(game_id)
    if record is None:
        await websocket.close(code=4404, reason="game not found")
        return

    await websocket.accept()
    record.subscribers.add(websocket)
    try:
        await websocket.send_json(StateMessage(game=_serialize(record)).model_dump(mode="json", by_alias=True))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        record.subscribers.discard(websocket)
