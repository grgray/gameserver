import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from api.main import app
from api.store import store
from game_engine import Board

TL_CW = {"quadrant": "top-left", "direction": "clockwise"}


@pytest.fixture
def client():
    # One client for the whole test, so REST calls and WebSockets share an event loop.
    with TestClient(app) as c:
        yield c


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def move(client, game_id, token, row, col, rotation=TL_CW):
    body = {"row": row, "col": col}
    if rotation is not None:
        body["rotation"] = rotation
    return client.post(f"/games/{game_id}/moves", json=body, headers=auth(token))


def start_online_game(client):
    """Create an online game and join it; returns (game id, black token, white token)."""
    created = client.post("/games", json={"mode": "online"}).json()
    joined = client.post("/games/join", json={"code": created["joinCode"]}).json()
    return created["game"]["id"], created["playerToken"], joined["playerToken"]


# --- creating and joining ----------------------------------------------------


def test_create_online_game_waits_for_an_opponent(client):
    resp = client.post("/games", json={"mode": "online"})

    assert resp.status_code == 201
    body = resp.json()
    assert body["playerToken"]
    assert body["colors"] == ["black"]
    assert len(body["joinCode"]) == 6
    game = body["game"]
    assert game["status"] == "waiting_for_opponent"
    assert game["currentPlayer"] == "black"
    assert game["board"] == [[None] * 6 for _ in range(6)]
    assert game["players"] == {
        "black": {"kind": "human", "joined": True},
        "white": {"kind": "human", "joined": False},
    }


def test_create_defaults_to_an_online_game(client):
    body = client.post("/games").json()

    assert body["game"]["mode"] == "online"
    assert body["joinCode"]


def test_creator_can_choose_white(client):
    body = client.post("/games", json={"mode": "online", "color": "white"}).json()

    assert body["colors"] == ["white"]
    assert body["game"]["players"]["black"]["joined"] is False


def test_joining_takes_the_open_seat_and_starts_the_game(client):
    created = client.post("/games", json={"mode": "online"}).json()

    resp = client.post("/games/join", json={"code": created["joinCode"].lower()})

    assert resp.status_code == 200
    body = resp.json()
    assert body["colors"] == ["white"]
    assert body["playerToken"] != created["playerToken"]
    assert body["joinCode"] is None
    assert body["game"]["status"] == "in_progress"
    assert body["game"]["players"]["white"]["joined"] is True


def test_join_code_works_only_once(client):
    created = client.post("/games", json={"mode": "online"}).json()
    client.post("/games/join", json={"code": created["joinCode"]})

    resp = client.post("/games/join", json={"code": created["joinCode"]})

    assert resp.status_code == 404


def test_unknown_join_code_returns_404(client):
    assert client.post("/games/join", json={"code": "NOPE00"}).status_code == 404


def test_get_game_returns_its_state(client):
    game_id, _, _ = start_online_game(client)

    resp = client.get(f"/games/{game_id}")

    assert resp.status_code == 200
    assert resp.json()["id"] == game_id


def test_get_unknown_game_returns_404(client):
    assert client.get("/games/does-not-exist").status_code == 404


def test_invalid_mode_is_rejected(client):
    assert client.post("/games", json={"mode": "solitaire"}).status_code == 422


# --- moves -------------------------------------------------------------------


def test_move_is_applied_and_passes_the_turn(client):
    game_id, black, _ = start_online_game(client)

    resp = move(client, game_id, black, 0, 0, {"quadrant": "top-left", "direction": "clockwise"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["board"][0][2] == "black"
    assert body["currentPlayer"] == "white"
    assert body["moveCount"] == 1
    assert body["lastMove"] == {
        "player": "black",
        "row": 0,
        "col": 0,
        "rotation": {"quadrant": "top-left", "direction": "clockwise"},
    }


def test_players_alternate(client):
    game_id, black, white = start_online_game(client)

    assert move(client, game_id, black, 0, 0).status_code == 200
    assert move(client, game_id, white, 5, 5).status_code == 200
    assert move(client, game_id, black, 3, 3).status_code == 200


def test_cannot_move_out_of_turn(client):
    game_id, black, white = start_online_game(client)

    resp = move(client, game_id, white, 0, 0)

    assert resp.status_code == 409
    assert "black's turn" in resp.json()["detail"]


def test_cannot_move_before_an_opponent_joins(client):
    created = client.post("/games", json={"mode": "online"}).json()

    resp = move(client, created["game"]["id"], created["playerToken"], 0, 0)

    assert resp.status_code == 409
    assert "waiting" in resp.json()["detail"]


def test_move_without_a_token_returns_401(client):
    game_id, _, _ = start_online_game(client)

    resp = client.post(f"/games/{game_id}/moves", json={"row": 0, "col": 0, "rotation": TL_CW})

    assert resp.status_code == 401


def test_move_with_another_games_token_returns_401(client):
    game_id, _, _ = start_online_game(client)
    _, other_black, _ = start_online_game(client)

    assert move(client, game_id, other_black, 0, 0).status_code == 401


def test_move_on_an_occupied_cell_returns_409(client):
    game_id, black, white = start_online_game(client)
    move(client, game_id, black, 4, 4)

    resp = move(client, game_id, white, 4, 4)

    assert resp.status_code == 409
    assert "occupied" in resp.json()["detail"]


def test_move_without_a_rotation_returns_409(client):
    game_id, black, _ = start_online_game(client)

    resp = move(client, game_id, black, 0, 0, rotation=None)

    assert resp.status_code == 409
    assert "rotation" in resp.json()["detail"]


@pytest.mark.parametrize(
    "body",
    [
        {"row": 6, "col": 0, "rotation": TL_CW},
        {"row": 0, "col": -1, "rotation": TL_CW},
        {"row": 0, "col": 0, "rotation": {"quadrant": "middle", "direction": "clockwise"}},
        {"row": 0, "col": 0, "rotation": {"quadrant": "top-left", "direction": "sideways"}},
    ],
)
def test_malformed_move_returns_422(client, body):
    game_id, black, _ = start_online_game(client)

    resp = client.post(f"/games/{game_id}/moves", json=body, headers=auth(black))

    assert resp.status_code == 422


def test_winning_placement_ends_the_game(client):
    game_id, black, white = start_online_game(client)
    store.get(game_id).game.board = Board.from_rows([
        "BBBB..",
        "WWWW..",
        "......",
        "......",
        "......",
        "......",
    ])

    resp = move(client, game_id, black, 0, 4)

    body = resp.json()
    assert resp.status_code == 200
    assert body["status"] == "black_wins"
    assert body["lastMove"]["rotation"] is None
    assert body["winningLines"] == [[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]]
    assert move(client, game_id, white, 5, 5).status_code == 409


# --- local and computer games ---------------------------------------------------


def test_local_game_token_plays_both_colours(client):
    body = client.post("/games", json={"mode": "local"}).json()
    game_id, token = body["game"]["id"], body["playerToken"]

    assert body["colors"] == ["black", "white"]
    assert body["joinCode"] is None
    assert body["game"]["status"] == "in_progress"
    assert move(client, game_id, token, 0, 0).status_code == 200
    assert move(client, game_id, token, 5, 5).status_code == 200


def test_computer_replies_after_the_humans_move(client):
    body = client.post("/games", json={"mode": "computer", "difficulty": "easy"}).json()
    game_id, token = body["game"]["id"], body["playerToken"]
    assert body["game"]["players"]["white"] == {"kind": "computer", "joined": True}

    resp = move(client, game_id, token, 0, 0)

    # The response shows the human's move; the computer answers straight after.
    assert resp.json()["moveCount"] == 1
    state = client.get(f"/games/{game_id}").json()
    assert state["moveCount"] == 2
    assert state["lastMove"]["player"] == "white"
    assert state["currentPlayer"] == "black"


def test_computer_moves_first_when_it_plays_black(client):
    body = client.post("/games", json={"mode": "computer", "color": "white", "difficulty": "easy"}).json()

    state = client.get(f"/games/{body['game']['id']}").json()

    assert state["moveCount"] == 1
    assert state["currentPlayer"] == "white"


def test_human_cannot_move_for_the_computer(client):
    body = client.post("/games", json={"mode": "computer", "color": "white", "difficulty": "easy"}).json()
    game_id, token = body["game"]["id"], body["playerToken"]
    store.get(game_id).game.current_player = store.get(game_id).computer  # freeze it on the computer's turn

    assert move(client, game_id, token, 5, 5).status_code == 409


# --- WebSocket -----------------------------------------------------------------


def test_websocket_sends_the_current_state_on_connect(client):
    game_id, _, _ = start_online_game(client)

    with client.websocket_connect(f"/games/{game_id}/ws") as ws:
        message = ws.receive_json()

    assert message["type"] == "state"
    assert message["game"]["id"] == game_id


def test_websocket_pushes_join_and_moves_to_every_watcher(client):
    created = client.post("/games", json={"mode": "online"}).json()
    game_id = created["game"]["id"]

    with client.websocket_connect(f"/games/{game_id}/ws") as ws1, \
            client.websocket_connect(f"/games/{game_id}/ws") as ws2:
        ws1.receive_json()
        ws2.receive_json()

        joined = client.post("/games/join", json={"code": created["joinCode"]}).json()
        assert ws1.receive_json()["game"]["status"] == "in_progress"
        assert ws2.receive_json()["game"]["status"] == "in_progress"

        move(client, game_id, created["playerToken"], 2, 2)
        assert ws1.receive_json()["game"]["moveCount"] == 1
        assert ws2.receive_json()["game"]["moveCount"] == 1

        move(client, game_id, joined["playerToken"], 3, 3)
        assert ws1.receive_json()["game"]["lastMove"]["player"] == "white"


def test_websocket_pushes_the_computers_move(client):
    body = client.post("/games", json={"mode": "computer", "difficulty": "easy"}).json()
    game_id, token = body["game"]["id"], body["playerToken"]

    with client.websocket_connect(f"/games/{game_id}/ws") as ws:
        ws.receive_json()
        move(client, game_id, token, 0, 0)

        assert ws.receive_json()["game"]["moveCount"] == 1
        computer = ws.receive_json()["game"]
        assert computer["moveCount"] == 2
        assert computer["lastMove"]["player"] == "white"


def test_websocket_for_an_unknown_game_is_closed(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/games/does-not-exist/ws") as ws:
            ws.receive_json()

    assert exc.value.code == 4404
