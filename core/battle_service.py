from __future__ import annotations

import random


def get_instance_by_id(instances: list[dict], instance_id: int) -> dict | None:
    for row in instances:
        try:
            if int(row.get("instance_id", -1)) == int(instance_id):
                return row
        except (TypeError, ValueError):
            continue
    return None


def get_species(game_data, species_id: int):
    return game_data.species.get(int(species_id))


def get_move_ids_for_species(species) -> list[int]:
    return [m for m in species.move_ids if int(m) > 0][:3]


def compute_move_damage(level: int) -> int:
    base_dice = 2
    extra_dice = max(0, (level - 1) // 10)
    total_dice = base_dice + extra_dice
    flat_bonus = max(1, level // 3)
    return sum(random.randint(1, 6) for _ in range(total_dice)) + flat_bonus


def apply_damage(current_hp: int, damage: int) -> int:
    return max(0, int(current_hp) - int(damage))


def resolve_player_attack(game_data, battle_state: dict, instances: list[dict], move_index: int) -> tuple[dict, str]:
    side_a = battle_state["side_a"]
    side_b = battle_state["side_b"]

    player_instance = get_instance_by_id(instances, side_a["active_instance_id"])
    if not player_instance:
        return battle_state, "Pokémon attivo del giocatore non trovato."

    player_species = get_species(game_data, player_instance["species_id"])
    if not player_species:
        return battle_state, "Specie del giocatore non trovata."

    move_ids = get_move_ids_for_species(player_species)
    if move_index < 0 or move_index >= len(move_ids):
        return battle_state, "Mossa non disponibile."

    move_id = move_ids[move_index]
    move_meta = game_data.moves_meta.get(move_id)
    move_name = move_meta.move_name if move_meta else f"Mossa {move_id}"

    player_level = int(player_instance.get("level", 1))
    damage = compute_move_damage(player_level)
    side_b["current_hp"] = apply_damage(side_b["current_hp"], damage)

    if side_b["current_hp"] <= 0:
        battle_state["battle_result"] = "player_win"
        return battle_state, f"{move_name} infligge {damage} danni. Il Pokémon selvatico è KO."

    wild_level = int(side_b.get("level", 1))
    wild_damage = compute_move_damage(wild_level)
    side_a["current_hp"] = apply_damage(side_a["current_hp"], wild_damage)

    if side_a["current_hp"] <= 0:
        battle_state["battle_result"] = "wild_win"
        return battle_state, f"{move_name} infligge {damage} danni, ma il selvatico risponde e manda KO il tuo Pokémon."

    return battle_state, f"{move_name} infligge {damage} danni. Il selvatico risponde con {wild_damage} danni."
