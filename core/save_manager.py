from __future__ import annotations

import csv, json
from pathlib import Path
from typing import Dict, List

from paths import SLOT_1_DIR

LOCAL_MAP_STATE_FILE = "local_map_state.json"


PLAYER_STATE_HEADER = [
    "player_id",
    "name",
    "current_location",
    "money",
    "badges",
    "active_party_slot",
    "turn_order_status",
]

POKEMON_INSTANCES_HEADER = [
    "instance_id",
    "owner_id",
    "owner_type",       # player / rival
    "storage",          # party / box
    "slot",
    "species_id",
    "nickname",
    "level",
    "hp_current",
    "hp_max",
    "exp",
    "is_fainted",
]


def ensure_save_dir(save_dir: str | Path) -> Path:
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    return save_path


def read_csv_rows(file_path: Path, delimiter: str = ";") -> List[dict]:
    if not file_path.exists():
        return []

    with file_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        return [dict(row) for row in reader if any((v or "").strip() for v in row.values())]


def write_csv_rows(file_path: Path, header: List[str], rows: List[dict], delimiter: str = ";") -> None:
    with file_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=header, delimiter=delimiter)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def load_player_state(save_dir: str | Path = SLOT_1_DIR) -> Dict[int, dict]:
    save_path = ensure_save_dir(save_dir)
    rows = read_csv_rows(save_path / "player_state.csv")
    players = {}

    for row in rows:
        try:
            player_id = int(row["player_id"])
            players[player_id] = {
                "player_id": player_id,
                "name": row["name"],
                "current_location": row["current_location"],
                "money": int(row["money"]),
                "badges": int(row["badges"]),
                "active_party_slot": int(row["active_party_slot"]),
                "turn_order_status": int(row["turn_order_status"]),
            }
        except (KeyError, ValueError):
            continue

    return players


def save_player_state(players: Dict[int, dict], save_dir: str | Path = SLOT_1_DIR) -> None:
    save_path = ensure_save_dir(save_dir)
    rows = [players[player_id] for player_id in sorted(players)]
    write_csv_rows(save_path / "player_state.csv", PLAYER_STATE_HEADER, rows)


def load_pokemon_instances(save_dir: str | Path = SLOT_1_DIR) -> List[dict]:
    save_path = ensure_save_dir(save_dir)
    return read_csv_rows(save_path / "pokemon_instances.csv")


def save_pokemon_instances(rows: List[dict], save_dir: str | Path = SLOT_1_DIR) -> None:
    save_path = ensure_save_dir(save_dir)
    write_csv_rows(save_path / "pokemon_instances.csv", POKEMON_INSTANCES_HEADER, rows)


def next_instance_id(instances: List[dict]) -> int:
    used = []
    for row in instances:
        try:
            used.append(int(row["instance_id"]))
        except (KeyError, ValueError, TypeError):
            pass
    return max(used, default=0) + 1


def create_pokemon_instance(
    instance_id: int,
    owner_id: int,
    owner_type: str,
    storage: str,
    slot: int,
    species_id: int,
    level: int,
    hp_max: int,
    nickname: str = "",
) -> dict:
    return {
        "instance_id": instance_id,
        "owner_id": owner_id,
        "owner_type": owner_type,
        "storage": storage,
        "slot": slot,
        "species_id": species_id,
        "nickname": nickname,
        "level": level,
        "hp_current": hp_max,
        "hp_max": hp_max,
        "exp": 0,
        "is_fainted": 0,
    }

def load_local_map_state(save_dir: str | Path = SLOT_1_DIR) -> dict:
    save_path = ensure_save_dir(save_dir)
    file_path = save_path / LOCAL_MAP_STATE_FILE

    if not file_path.exists():
        return {"players": {}}

    with file_path.open("r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"players": {}}


def save_local_map_state(state: dict, save_dir: str | Path = SLOT_1_DIR) -> None:
    save_path = ensure_save_dir(save_dir)
    file_path = save_path / LOCAL_MAP_STATE_FILE

    with file_path.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def get_player_route_state(state: dict, player_id: int, route_id: str) -> dict:
    players = state.setdefault("players", {})
    player_key = str(player_id)
    player_data = players.setdefault(player_key, {})
    routes = player_data.setdefault("routes", {})
    return routes.setdefault(route_id, {
        "visited": False,
        "cleared_bushes": [],
        "defeated_npcs": []
    })
