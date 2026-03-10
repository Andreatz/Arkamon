from __future__ import annotations

import random
from typing import Optional, Dict, List


RARITY_WEIGHTS = {
    "comune": 60,
    "medio": 30,
    "difficile": 10,
}


def normalize_route_area_id(route_node_id: str) -> str:
    # route_1 -> Percorso_1
    if route_node_id.lower().startswith("route_"):
        suffix = route_node_id.split("_", 1)[1]
        return f"Percorso_{suffix}"
    return route_node_id


def bush_to_group(bush_id: str) -> str:
    mapping = {
        "b1": "A",
        "b2": "B",
        "b3": "C",
        "b4": "D",
        "b5": "E",
        "b6": "F",
        "b7": "G",
    }
    return mapping.get(bush_id, "A")


def weighted_choice(encounters: List[dict]) -> Optional[dict]:
    if not encounters:
        return None

    weights = []
    for entry in encounters:
        rarity = str(entry.get("rarity_weight", "Comune")).strip().lower()
        weights.append(RARITY_WEIGHTS.get(rarity, 1))

    return random.choices(encounters, weights=weights, k=1)[0]


def get_active_party_pokemon(instances: List[dict], player_id: int) -> Optional[dict]:
    party = []
    for row in instances:
        try:
            if int(row.get("owner_id", -1)) != int(player_id):
                continue
        except (TypeError, ValueError):
            continue

        if str(row.get("owner_type", "")).strip().lower() != "player":
            continue
        if str(row.get("storage", "")).strip().lower() != "party":
            continue
        if str(row.get("is_fainted", "0")).strip() in {"1", "true", "True"}:
            continue

        party.append(row)

    if not party:
        return None

    party.sort(key=lambda r: int(r.get("slot", 999)))
    return party[0]


def build_wild_battle_state(
    *,
    route_node_id: str,
    bush_id: str,
    player_id: int,
    player_name: str,
    player_active: dict,
    encounter_entry: dict,
    species_name: str,
    hp_max: int,
) -> dict:
    level = int(encounter_entry["level"])
    species_id = int(encounter_entry["species_id"])

    return {
        "battle_type": "wild",
        "return_node": route_node_id,
        "turn": "A",
        "side_a": {
            "player_id": player_id,
            "trainer_name": player_name,
            "active_instance_id": int(player_active["instance_id"]),
            "current_hp": int(player_active["hp_current"]),
            "status": None,
            "status_turns": 0,
            "party_slot": int(player_active["slot"]),
            "ko_slots": [],
        },
        "side_b": {
            "player_id": 0,
            "trainer_name": "Pokémon Selvatico",
            "wild_species_id": species_id,
            "wild_species_name": species_name,
            "active_instance_id": None,
            "level": level,
            "current_hp": hp_max,
            "hp_max": hp_max,
            "status": None,
            "status_turns": 0,
            "party_slot": 1,
            "ko_slots": [],
        },
        "capture_allowed": True,
        "encounter_meta": {
            "route_node_id": route_node_id,
            "area_id": normalize_route_area_id(route_node_id),
            "bush_id": bush_id,
            "encounter_group": bush_to_group(bush_id),
        },
        "pending_evolution": {
            "enabled": False,
            "instance_id": None,
            "from_species_id": None,
            "to_species_id": None,
        }
    }


def roll_wild_encounter(game_data, route_node_id: str, bush_id: str) -> Optional[dict]:
    area_id = normalize_route_area_id(route_node_id)
    group = bush_to_group(bush_id)

    area = game_data.wild_encounters.get(area_id)
    if not area:
        return None

    entries = area.get(group)
    if not entries:
        return None

    chosen = weighted_choice(entries)
    if not chosen:
        return None

    min_level = int(chosen.get("min_level", 1))
    max_level = int(chosen.get("max_level", min_level))
    level = random.randint(min_level, max_level)

    return {
        "species_id": int(chosen["species_id"]),
        "rarity_weight": chosen.get("rarity_weight", "Comune"),
        "level": level,
        "area_id": area_id,
        "encounter_group": group,
    }
