from __future__ import annotations

import random
import pygame

from paths import SLOT_1_DIR, BACK_SPRITES_DIR, FRONT_SPRITES_DIR
from save_manager import (
    load_battle_state,
    load_pokemon_instances,
    save_battle_state,
    save_pokemon_instances,
    next_instance_id,
    create_pokemon_instance,
    heal_player_party,
    clear_battle_state,
)
from battle_service import (
    get_instance_by_id,
    get_species,
    get_move_ids_for_species,
    resolve_player_attack,
    get_player_party,
    switch_player_pokemon,
    sync_active_instance_from_battle,
)


class BattleScene:
    def __init__(self, game):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 20)
        self.awaiting_switch = False

        self.battle_state = load_battle_state(SLOT_1_DIR)
        self.instances = load_pokemon_instances(SLOT_1_DIR)

        self.buttons = {
            "move_1": pygame.Rect(60, 520, 240, 60),
            "move_2": pygame.Rect(320, 520, 240, 60),
            "move_3": pygame.Rect(580, 520, 240, 60),
            "capture": pygame.Rect(860, 520, 160, 60),
            "switch": pygame.Rect(1040, 520, 160, 60),
        }

        self.message = self._build_intro_message()

    def _build_intro_message(self) -> str:
        if not self.battle_state:
            return "Nessuna battaglia caricata."

        if self.battle_state.get("battle_type") == "wild":
            side_b = self.battle_state.get("side_b", {})
            species_name = side_b.get("wild_species_name", "???")
            level = side_b.get("level", "?")
            return f"Un {species_name} selvatico di livello {level} appare!"

        return "Battaglia caricata."

    def _get_active_player_instance(self):
        side_a = self.battle_state.get("side_a", {})
        instance_id = side_a.get("active_instance_id")
        if instance_id is None:
            return None
        return get_instance_by_id(self.instances, instance_id)

    def _get_player_move_labels(self) -> dict[str, str]:
        labels = {
            "move_1": "Mossa 1",
            "move_2": "Mossa 2",
            "move_3": "Mossa 3",
            "capture": "Cattura",
            "switch": "Cambia",
        }

        player_instance = self._get_active_player_instance()
        if not player_instance:
            return labels

        species = get_species(self.game.data, player_instance["species_id"])
        if not species:
            return labels

        move_ids = get_move_ids_for_species(species)
        for idx, move_id in enumerate(move_ids[:3], start=1):
            move_meta = self.game.data.moves_meta.get(move_id)
            labels[f"move_{idx}"] = move_meta.move_name if move_meta else f"Mossa {move_id}"

        return labels

    def _get_player_party(self, player_id: int) -> list[dict]:
        party = []
        for row in self.instances:
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

    def _get_player_box(self, player_id: int) -> list[dict]:
        box_rows = []
        for row in self.instances:
            try:
                if int(row.get("owner_id", -1)) != int(player_id):
                    continue
            except (TypeError, ValueError):
                continue

            if str(row.get("owner_type", "")).strip().lower() != "player":
                continue
            if str(row.get("storage", "")).strip().lower() != "box":
                continue

            box_rows.append(row)

        box_rows.sort(key=lambda r: int(r.get("slot", 999)))
        return box_rows

    def _return_after_battle(self) -> None:
        side_a = self.battle_state.get("side_a", {})
        player_id = side_a.get("player_id")

        if self.battle_state.get("battle_type") == "wild" and player_id:
            heal_player_party(int(player_id), SLOT_1_DIR)
            self.instances = load_pokemon_instances(SLOT_1_DIR)

        battle_type = self.battle_state.get("battle_type")
        return_node = self.battle_state.get("return_node")

        clear_battle_state(SLOT_1_DIR)

        if battle_type == "wild" and return_node:
            self.game.change_scene("route", route_node_id=return_node)
        else:
            self.game.change_scene("world")

    def _try_capture(self) -> None:
        if not self.battle_state.get("capture_allowed"):
            self.message = "Cattura non disponibile."
            return

        if self.battle_state.get("battle_type") != "wild":
            self.message = "Puoi catturare solo i Pokémon selvatici."
            return

        if self.battle_state.get("battle_result") in {"player_win", "wild_win", "captured"}:
            self.message = "La battaglia è già terminata."
            return

        side_a = self.battle_state.get("side_a", {})
        side_b = self.battle_state.get("side_b", {})

        player_id = side_a.get("player_id")
        species_id = side_b.get("wild_species_id")
        current_hp = int(side_b.get("current_hp", 1))
        hp_max = int(side_b.get("hp_max", 1))
        level = int(side_b.get("level", 1))

        if current_hp <= 0:
            self.message = "Non puoi catturare un Pokémon già KO."
            return

        if not player_id or not species_id:
            self.message = "Dati cattura incompleti."
            return

        species = self.game.data.species.get(int(species_id))
        if not species:
            self.message = "Specie selvaggia non trovata."
            return

        catch_rate = int(getattr(species, "catch_rate", 0) or 0)

        hp_factor = 1.0 - (current_hp / max(1, hp_max))
        chance = 0.20 + hp_factor * 0.50 + min(catch_rate, 100) / 500.0
        chance = max(0.05, min(0.95, chance))

        if random.random() > chance:
            self.message = "Il Pokémon si è liberato!"
            return

        party = self._get_player_party(player_id)
        box_rows = self._get_player_box(player_id)

        if len(party) < 6:
            storage = "party"
            slot = len(party) + 1
        else:
            storage = "box"
            slot = len(box_rows) + 1

        new_instance_id = next_instance_id(self.instances)

        self.instances.append(
            create_pokemon_instance(
                instance_id=new_instance_id,
                owner_id=int(player_id),
                owner_type="player",
                storage=storage,
                slot=slot,
                species_id=int(species_id),
                level=level,
                hp_max=hp_max,
                nickname="",
            )
        )

        save_pokemon_instances(self.instances, SLOT_1_DIR)
        self.battle_state["battle_result"] = "captured"
        self.battle_state["capture_allowed"] = False
        save_battle_state(self.battle_state, SLOT_1_DIR)

        if storage == "party":
            self.message = f"{species.name} catturato e aggiunto alla squadra!"
        else:
            self.message = f"{species.name} catturato e inviato al box!"

    def handle_event(self, event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self._return_after_battle()
                return

            if self.awaiting_switch:
                key_to_slot = {
                    pygame.K_1: 1,
                    pygame.K_2: 2,
                    pygame.K_3: 3,
                    pygame.K_4: 4,
                    pygame.K_5: 5,
                    pygame.K_6: 6,
                }
                if event.key in key_to_slot:
                    slot = key_to_slot[event.key]
                    self.battle_state, self.message = switch_player_pokemon(
                        self.battle_state,
                        self.instances,
                        slot,
                    )
                    self.awaiting_switch = False
                    save_battle_state(self.battle_state, SLOT_1_DIR)
                    return

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for key, rect in self.buttons.items():
                if rect.collidepoint(event.pos):
                    self._handle_button(key)
                    break

    def _handle_button(self, key: str) -> None:
        if self.battle_state.get("battle_result") in {"player_win", "wild_win", "captured"}:
            self._return_after_battle()
            return

        if key.startswith("move_"):
            move_index = int(key.split("_")[1]) - 1
            self.battle_state, self.message = resolve_player_attack(
                self.game.data,
                self.battle_state,
                self.instances,
                move_index,
            )
            self._sync_instances_after_turn()
            save_battle_state(self.battle_state, SLOT_1_DIR)

        elif key == "capture":
            self._try_capture()

        elif key == "switch":
            slots = self._get_switchable_slots()
            if not slots:
                self.message = "Nessun altro Pokémon disponibile per il cambio."
            else:
                self.awaiting_switch = True
                self.message = f"Scegli uno slot con i tasti {', '.join(str(s) for s in slots)}."

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((210, 235, 255))
        pygame.draw.rect(self.screen, (120, 180, 120), (0, 350, 1280, 370))

        title = self.font_title.render("Battaglia", True, (25, 25, 25))
        player_sprite, wild_sprite = self._get_battle_sprites()

        if player_sprite:
            self.screen.blit(player_sprite, (140, 220))
        else:
            pygame.draw.rect(self.screen, (180, 180, 180), (140, 220, 220, 220))
            txt = self.small_font.render("Back sprite mancante", True, (20, 20, 20))
            self.screen.blit(txt, (155, 320))

        if wild_sprite:
            self.screen.blit(wild_sprite, (880, 120))
        else:
            pygame.draw.rect(self.screen, (180, 180, 180), (880, 120, 220, 220))
            txt = self.small_font.render("Front sprite mancante", True, (20, 20, 20))
            self.screen.blit(txt, (895, 220))

        self.screen.blit(title, (40, 30))

        side_a = self.battle_state.get("side_a", {})
        side_b = self.battle_state.get("side_b", {})

        a_text = [
            f"Giocatore: {side_a.get('trainer_name', '---')}",
            f"Instance ID: {side_a.get('active_instance_id', '---')}",
            f"HP correnti: {side_a.get('current_hp', '---')}",
        ]

        b_text = [
            f"Avversario: {side_b.get('wild_species_name', side_b.get('trainer_name', '---'))}",
            f"Livello: {side_b.get('level', '---')}",
            f"HP: {side_b.get('current_hp', '---')} / {side_b.get('hp_max', '---')}",
        ]

        y = 110
        for line in a_text:
            surf = self.font_text.render(str(line), True, (30, 30, 30))
            self.screen.blit(surf, (60, y))
            y += 36

        y = 110
        for line in b_text:
            surf = self.font_text.render(str(line), True, (30, 30, 30))
            self.screen.blit(surf, (760, y))
            y += 36

        msg = self.font_text.render(self.message, True, (30, 30, 30))
        if self.awaiting_switch:
            switch_msg = self.small_font.render("Cambio attivo: premi 1-6 per scegliere lo slot.", True, (30, 30, 30))
            self.screen.blit(switch_msg, (60, 465))
        self.screen.blit(msg, (60, 430))

        labels = self._get_player_move_labels()

        for key, rect in self.buttons.items():
            pygame.draw.rect(self.screen, (245, 245, 245), rect, border_radius=10)
            pygame.draw.rect(self.screen, (40, 40, 40), rect, 3, border_radius=10)
            surf = self.small_font.render(labels[key], True, (20, 20, 20))
            self.screen.blit(surf, (rect.x + 18, rect.y + 18))

        if self.battle_state.get("battle_result") == "player_win":
            win_msg = self.font_text.render("Hai vinto. Clicca un pulsante per tornare al percorso.", True, (20, 120, 20))
            self.screen.blit(win_msg, (60, 470))
        elif self.battle_state.get("battle_result") == "wild_win":
            lose_msg = self.font_text.render("Hai perso. Clicca un pulsante per uscire.", True, (160, 40, 40))
            self.screen.blit(lose_msg, (60, 470))
        elif self.battle_state.get("battle_result") == "captured":
            cap_msg = self.font_text.render("Pokémon catturato. Clicca un pulsante per tornare al percorso.", True, (20, 120, 20))
            self.screen.blit(cap_msg, (60, 470))

    def _sync_instances_after_turn(self) -> None:
        sync_active_instance_from_battle(self.battle_state, self.instances)
        save_pokemon_instances(self.instances, SLOT_1_DIR)


    def _get_switchable_slots(self) -> list[int]:
        side_a = self.battle_state.get("side_a", {})
        player_id = side_a.get("player_id")
        active_slot = side_a.get("party_slot")

        if player_id is None:
            return []

        party = get_player_party(self.instances, int(player_id))
        slots = []

        for row in party:
            try:
                slot = int(row.get("slot", -1))
                hp_current = int(row.get("hp_current", 0))
                is_fainted = str(row.get("is_fainted", "0")).strip().lower() in {"1", "true"}
            except (TypeError, ValueError):
                continue

            if slot == int(active_slot):
                continue
            if is_fainted or hp_current <= 0:
                continue

            slots.append(slot)

        return slots
    
    def _load_sprite(self, folder, species_id: int, size: tuple[int, int]):
        candidates = [
            folder / f"{species_id}.png",
            folder / f"{species_id:03}.png",
            folder / f"{species_id}.jpg",
            folder / f"{species_id:03}.jpg",
        ]

        for path in candidates:
            if path.exists():
                image = pygame.image.load(str(path)).convert_alpha()
                return pygame.transform.smoothscale(image, size)

        return None


    def _get_battle_sprites(self):
        player_sprite = None
        wild_sprite = None

        player_instance = self._get_active_player_instance()
        if player_instance:
            player_sprite = self._load_sprite(
                BACK_SPRITES_DIR,
                int(player_instance["species_id"]),
                (220, 220),
            )

        side_b = self.battle_state.get("side_b", {})
        wild_species_id = side_b.get("wild_species_id")
        if wild_species_id is not None:
            wild_sprite = self._load_sprite(
                FRONT_SPRITES_DIR,
                int(wild_species_id),
                (220, 220),
            )

        return player_sprite, wild_sprite
