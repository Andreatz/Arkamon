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


def get_player_party(instances: list[dict], player_id: int) -> list[dict]:
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

        party.append(row)

    party.sort(key=lambda r: int(r.get("slot", 999)))
    return party


def get_alive_party_members(instances: list[dict], player_id: int, exclude_instance_id: int | None = None) -> list[dict]:
    alive = []
    for row in get_player_party(instances, player_id):
        try:
            row_instance_id = int(row.get("instance_id", -1))
            hp_current = int(row.get("hp_current", 0))
            is_fainted = str(row.get("is_fainted", "0")).strip().lower() in {"1", "true"}
        except (TypeError, ValueError):
            continue

        if exclude_instance_id is not None and row_instance_id == int(exclude_instance_id):
            continue
        if is_fainted:
            continue
        if hp_current <= 0:
            continue

        alive.append(row)

    return alive


def sync_active_instance_from_battle(battle_state: dict, instances: list[dict]) -> None:
    side_a = battle_state.get("side_a", {})
    instance_id = side_a.get("active_instance_id")
    if instance_id is None:
        return

    active = get_instance_by_id(instances, instance_id)
    if not active:
        return

    active["hp_current"] = str(side_a.get("current_hp", active.get("hp_current", 0)))

    if int(side_a.get("current_hp", 0)) <= 0:
        active["is_fainted"] = "1"
        active["hp_current"] = "0"


def set_active_pokemon(battle_state: dict, new_instance: dict) -> None:
    side_a = battle_state["side_a"]
    side_a["active_instance_id"] = int(new_instance["instance_id"])
    side_a["current_hp"] = int(new_instance["hp_current"])
    side_a["party_slot"] = int(new_instance["slot"])


def try_auto_switch_after_ko(battle_state: dict, instances: list[dict]) -> tuple[dict, str | None]:
    side_a = battle_state["side_a"]
    player_id = int(side_a["player_id"])
    fainted_instance_id = int(side_a["active_instance_id"])

    replacements = get_alive_party_members(instances, player_id, exclude_instance_id=fainted_instance_id)
    if not replacements:
        battle_state["battle_result"] = "wild_win"
        return battle_state, None

    replacement = replacements[0]
    set_active_pokemon(battle_state, replacement)
    return battle_state, replacement.get("nickname") or f"Pokémon slot {replacement['slot']}"


def switch_player_pokemon(battle_state: dict, instances: list[dict], target_slot: int) -> tuple[dict, str]:
    side_a = battle_state["side_a"]
    player_id = int(side_a["player_id"])
    current_instance_id = int(side_a["active_instance_id"])

    candidates = get_alive_party_members(instances, player_id)
    target = None

    for row in candidates:
        try:
            if int(row.get("slot", -1)) == int(target_slot):
                target = row
                break
        except (TypeError, ValueError):
            continue

    if not target:
        return battle_state, "Slot non disponibile per il cambio."

    if int(target["instance_id"]) == current_instance_id:
        return battle_state, "Quel Pokémon è già attivo."

    set_active_pokemon(battle_state, target)
    return battle_state, f"Hai mandato in campo lo slot {target_slot}."


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

    sync_active_instance_from_battle(battle_state, instances)

    if side_a["current_hp"] <= 0:
        battle_state, replacement_name = try_auto_switch_after_ko(battle_state, instances)
        if battle_state.get("battle_result") == "wild_win":
            return battle_state, f"{move_name} infligge {damage} danni, ma il selvatico risponde con {wild_damage} danni e il tuo ultimo Pokémon va KO."
        return battle_state, f"{move_name} infligge {damage} danni. Il tuo Pokémon va KO, ma entra in campo {replacement_name}."

    return battle_state, f"{move_name} infligge {damage} danni. Il selvatico risponde con {wild_damage} danni."
