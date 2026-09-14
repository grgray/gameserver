from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_create_game_returns_starting_state():
    resp = client.post("/games")

    assert resp.status_code == 201
    body = resp.json()
    assert body["id"]
    assert body["currentPlayer"] == "black"
    assert body["gameOver"] is False
    assert body["board"][3][3] == "white"
    assert body["board"][3][4] == "black"
    assert sorted(body["validMoves"]) == sorted([[2, 3], [3, 2], [4, 5], [5, 4]])


def test_get_unknown_game_returns_404():
    resp = client.get("/games/does-not-exist")

    assert resp.status_code == 404


def test_get_game_returns_created_game():
    created = client.post("/games").json()

    resp = client.get(f"/games/{created['id']}")

    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_move_flips_pieces_and_switches_turn():
    created = client.post("/games").json()
    game_id = created["id"]

    resp = client.post(f"/games/{game_id}/moves", json={"row": 2, "col": 3})

    assert resp.status_code == 200
    body = resp.json()
    assert body["board"][2][3] == "black"
    assert body["board"][3][3] == "black"
    assert body["currentPlayer"] == "white"


def test_illegal_move_returns_409():
    created = client.post("/games").json()
    game_id = created["id"]

    resp = client.post(f"/games/{game_id}/moves", json={"row": 0, "col": 0})

    assert resp.status_code == 409


def test_out_of_range_move_returns_400():
    created = client.post("/games").json()
    game_id = created["id"]

    resp = client.post(f"/games/{game_id}/moves", json={"row": 8, "col": 0})

    assert resp.status_code == 400


def test_invalid_difficulty_returns_400():
    resp = client.post("/games", json={"difficulty": "impossible"})

    assert resp.status_code == 400


def test_computer_game_replies_after_human_move():
    created = client.post("/games", json={"difficulty": "easy", "playAgainstComputer": True}).json()
    game_id = created["id"]

    resp = client.post(f"/games/{game_id}/moves", json={"row": 2, "col": 3})

    assert resp.status_code == 200
    body = resp.json()
    # The computer (white) should have replied, handing the turn back to black,
    # unless it happened to have no legal move.
    assert body["currentPlayer"] == "black"
    assert body["score"]["white"] >= 2
