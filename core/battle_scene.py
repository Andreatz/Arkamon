from __future__ import annotations

import random
from pathlib import Path

import pygame

from paths import (
    SLOT_1_DIR,
    BACK_SPRITES_DIR,
    FRONT_SPRITES_DIR,
    BACKGROUND_DIR,
    UI_DIR,
)
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
    VIRTUAL_W = 1920
    VIRTUAL_H = 1080

    def __init__(self, game):
        self.game = game
        self.screen = game.screen

        self.screen_w, self.screen_h = self.screen.get_size()
        self.sx = self.screen_w / self.VIRTUAL_W
        self.sy = self.screen_h / self.VIRTUAL_H

        self.font_title     = pygame.font.SysFont("arial", max(24, int(42 * self.sy)), bold=True)
        self.font_name      = pygame.font.SysFont("arial", max(20, int(28 * self.sy)), bold=True)
        self.font_text      = pygame.font.SysFont("arial", max(18, int(24 * self.sy)), bold=True)
        self.font_small     = pygame.font.SysFont("arial", max(15, int(19 * self.sy)))
        self.font_small_bold = pygame.font.SysFont("arial", max(15, int(19 * self.sy)), bold=True)

        self.awaiting_switch = False

        self.battle_state = load_battle_state(SLOT_1_DIR)
        self.instances    = load_pokemon_instances(SLOT_1_DIR)

        self.bg_forest = self._load_scaled_image(
            BACKGROUND_DIR / "battle_forest.jpg",
            (self.screen_w, self.screen_h),
            alpha=False,
        )

        self.ui_text_box = self._load_scaled_image(
            UI_DIR / "infobox.png",
            self._scale_size(760, 200),
            alpha=True,
        )

        self.ui_hp_enemy = self._load_scaled_image(
            UI_DIR / "hp_bar_enemy.png",
            self._scale_size(580, 110),
            alpha=True,
        )

        self.ui_hp_player = self._load_scaled_image(
            UI_DIR / "hp_bar_player.png",
            self._scale_size(580, 110),
            alpha=True,
        )

        self.ui_move_panel = self._load_optional_ui(
            ["move_button.png"],
            self._scale_size(320, 110),
        )

        self.ui_action_panel = self._load_optional_ui(
            ["general_button.png", "move_button.png"],
            self._scale_size(320, 90),
        )

        self.buttons = self._build_buttons()
        self.message = self._build_intro_message()

    # ------------------------------------------------------------------ helpers

    def _vr(self, x: int, y: int, w: int, h: int) -> pygame.Rect:
        return pygame.Rect(
            int(x * self.sx),
            int(y * self.sy),
            max(1, int(w * self.sx)),
            max(1, int(h * self.sy)),
        )

    def _scale_size(self, w: int, h: int) -> tuple[int, int]:
        return max(1, int(w * self.sx)), max(1, int(h * self.sy))

    def _load_scaled_image(self, path: Path, size: tuple[int, int], alpha: bool = True):
        image = pygame.image.load(str(path))
        image = image.convert_alpha() if alpha else image.convert()
        return pygame.transform.smoothscale(image, size)

    def _load_optional_ui(self, filenames: list[str], size: tuple[int, int]):
        for name in filenames:
            path = UI_DIR / name
            if path.exists():
                return self._load_scaled_image(path, size, alpha=True)
        return None

    def _build_buttons(self) -> dict[str, pygame.Rect]:
        return {
            "move_1":  self._vr(860,  840, 320, 110),
            "move_2":  self._vr(1200, 840, 320, 110),
            "move_3":  self._vr(1540, 840, 320, 110),
            "capture": self._vr(860,  960, 320,  90),
            "switch":  self._vr(1200, 960, 320,  90),
        }

    def _wrap_text(self, text: str, max_chars: int = 38) -> list[str]:
        words = text.split()
        if not words:
            return [""]
        lines = []
        current = words[0]
        for word in words[1:]:
            if len(current) + 1 + len(word) <= max_chars:
                current += " " + word
            else:
                lines.append(current)
                current = word
        lines.append(current)
        return lines

    def _draw_fallback_panel(self, rect: pygame.Rect, border_color=(60, 60, 60)):
        panel = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel, (235, 235, 235, 205), panel.get_rect(), border_radius=18)
        pygame.draw.rect(panel, border_color, panel.get_rect(), 4, border_radius=18)
        self.screen.blit(panel, rect.topleft)

    def _draw_hp_fill(self, rect: pygame.Rect, current_hp: int, hp_max: int):
        ratio = 0 if hp_max <= 0 else max(0.0, min(1.0, current_hp / hp_max))

        if ratio > 0.5:
            color = (81, 224, 86)
        elif ratio > 0.2:
            color = (238, 204, 64)
        else:
            color = (221, 78, 78)

        pygame.draw.rect(self.screen, (220, 220, 220), rect, border_radius=max(4, rect.height // 2))
        if ratio > 0:
            fill = pygame.Rect(rect.x, rect.y, max(4, int(rect.width * ratio)), rect.height)
            pygame.draw.rect(self.screen, color, fill, border_radius=max(4, rect.height // 2))

    # ------------------------------------------------------------------ dati battaglia

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

    def _get_available_move_keys(self) -> list[str]:
        player_instance = self._get_active_player_instance()
        if not player_instance:
            return ["move_1"]
        species = get_species(self.game.data, player_instance["species_id"])
        if not species:
            return ["move_1"]
        move_ids = get_move_ids_for_species(species)
        return [f"move_{idx}" for idx in range(1, len(move_ids[:3]) + 1)] or ["move_1"]

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

    # ------------------------------------------------------------------ risultati / navigazione

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
        player_id  = side_a.get("player_id")
        species_id = side_b.get("wild_species_id")
        current_hp = int(side_b.get("current_hp", 1))
        hp_max     = int(side_b.get("hp_max", 1))
        level      = int(side_b.get("level", 1))

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
        hp_factor  = 1.0 - (current_hp / max(1, hp_max))
        chance     = 0.20 + hp_factor * 0.50 + min(catch_rate, 100) / 500.0
        chance     = max(0.05, min(0.95, chance))

        if random.random() > chance:
            self.message = "Il Pokémon si è liberato!"
            return

        party    = self._get_player_party(player_id)
        box_rows = self._get_player_box(player_id)

        if len(party) < 6:
            storage = "party"
            slot    = len(party) + 1
        else:
            storage = "box"
            slot    = len(box_rows) + 1

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
        self.battle_state["battle_result"]   = "captured"
        self.battle_state["capture_allowed"] = False
        save_battle_state(self.battle_state, SLOT_1_DIR)

        if storage == "party":
            self.message = f"{species.name} catturato e aggiunto alla squadra!"
        else:
            self.message = f"{species.name} catturato e inviato al box!"

    # ------------------------------------------------------------------ switch

    def _sync_instances_after_turn(self) -> None:
        sync_active_instance_from_battle(self.battle_state, self.instances)
        save_pokemon_instances(self.instances, SLOT_1_DIR)

    def _get_switchable_slots(self) -> list[int]:
        side_a    = self.battle_state.get("side_a", {})
        player_id = side_a.get("player_id")
        active_slot = side_a.get("party_slot")

        if player_id is None:
            return []

        party = get_player_party(self.instances, int(player_id))
        slots = []

        for row in party:
            try:
                slot       = int(row.get("slot", -1))
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

    # ------------------------------------------------------------------ sprite

    def _load_sprite(self, folder: Path, species_id: int, size: tuple[int, int]):
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
        wild_sprite   = None

        player_instance = self._get_active_player_instance()
        if player_instance:
            player_sprite = self._load_sprite(
                BACK_SPRITES_DIR,
                int(player_instance["species_id"]),
                self._scale_size(420, 420),
            )

        side_b = self.battle_state.get("side_b", {})
        wild_species_id = side_b.get("wild_species_id")
        if wild_species_id is not None:
            wild_sprite = self._load_sprite(
                FRONT_SPRITES_DIR,
                int(wild_species_id),
                self._scale_size(380, 380),
            )

        return player_sprite, wild_sprite

    # ------------------------------------------------------------------ eventi

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
            available_keys = self._get_available_move_keys()
            if key not in available_keys:
                return
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

    # ------------------------------------------------------------------ drawing

    def _draw_action_button(self, key: str, label: str):
        rect = self.buttons[key]
        if self.ui_action_panel:
            panel = pygame.transform.smoothscale(self.ui_action_panel, (rect.width, rect.height))
            self.screen.blit(panel, rect.topleft)
        else:
            self._draw_fallback_panel(rect)
        txt      = self.font_text.render(label, True, (25, 25, 25))
        txt_rect = txt.get_rect(center=rect.center)
        self.screen.blit(txt, txt_rect)

    def _draw_move_button(self, key: str, label: str):
        rect = self.buttons[key]
        if self.ui_move_panel:
            panel = pygame.transform.smoothscale(self.ui_move_panel, (rect.width, rect.height))
            self.screen.blit(panel, rect.topleft)
        else:
            self._draw_fallback_panel(rect)
        title      = self.font_text.render(label, True, (25, 25, 25))
        title_rect = title.get_rect(center=(rect.centerx, rect.y + int(rect.height * 0.45)))
        self.screen.blit(title, title_rect)

    def draw(self) -> None:
        # --- dati battaglia ---
        side_a = self.battle_state.get("side_a", {})
        side_b = self.battle_state.get("side_b", {})

        # --- calcolo HP giocatore PRIMA di usarli ---
        player_instance     = self._get_active_player_instance()
        player_species_name = "---"
        player_level        = "---"
        player_hp_current   = int(side_a.get("current_hp", 0))
        player_hp_max       = 1

        if player_instance:
            player_species = self.game.data.species.get(int(player_instance["species_id"]))
            if player_species:
                player_species_name = player_species.name
            player_level = player_instance.get("level", "---")
            try:
                player_hp_max = int(player_instance.get("hp_max", 1))
            except (TypeError, ValueError):
                player_hp_max = 1

        # --- sfondo ---
        self.screen.blit(self.bg_forest, (0, 0))

        # --- sprite ---
        player_sprite, wild_sprite = self._get_battle_sprites()

        if player_sprite:
            self.screen.blit(player_sprite, self._vr(80, 480, 420, 420).topleft)
        if wild_sprite:
            self.screen.blit(wild_sprite, self._vr(1370, 80, 380, 380).topleft)

        # --- frame UI ---
        enemy_bar_rect  = self._vr(850,  60, 580, 110)
        player_bar_rect = self._vr(80,  720, 580, 110)
        text_box_rect   = self._vr(80,  840, 760, 200)

        self.screen.blit(self.ui_hp_enemy,  enemy_bar_rect.topleft)
        self.screen.blit(self.ui_hp_player, player_bar_rect.topleft)
        self.screen.blit(self.ui_text_box,  text_box_rect.topleft)

        # --- barre HP dinamiche ---
        enemy_fill_rect  = self._vr(860, 120, 470, 22)
        player_fill_rect = self._vr(90,  784, 470, 22)

        self._draw_hp_fill(
            enemy_fill_rect,
            int(side_b.get("current_hp", 0)),
            int(side_b.get("hp_max", 1)),
        )
        self._draw_hp_fill(
            player_fill_rect,
            player_hp_current,
            player_hp_max,
        )

        # --- testi barre HP ---
        enemy_name  = side_b.get("wild_species_name", side_b.get("trainer_name", "---"))
        enemy_level = side_b.get("level", "---")

        self.screen.blit(
            self.font_name.render(str(enemy_name),           True, (255, 255, 255)),
            self._vr(860,  68, 0, 0).topleft,
        )
        self.screen.blit(
            self.font_name.render(f"LV. {enemy_level}",     True, (255, 255, 255)),
            self._vr(1290, 68, 0, 0).topleft,
        )
        self.screen.blit(
            self.font_name.render(str(player_species_name), True, (255, 255, 255)),
            self._vr(90,  728, 0, 0).topleft,
        )
        self.screen.blit(
            self.font_name.render(f"LV. {player_level}",   True, (255, 255, 255)),
            self._vr(490, 728, 0, 0).topleft,
        )
        self.screen.blit(
            self.font_small_bold.render(
                f"{player_hp_current}/{player_hp_max}",
                True,
                (30, 30, 30),
            ),
            self._vr(90, 786, 0, 0).topleft,
        )

        # --- testo infobox ---
        message_lines = self._wrap_text(self.message, max_chars=38)
        text_y = text_box_rect.y + int(50 * self.sy)
        for line in message_lines[:4]:
            self.screen.blit(
                self.font_text.render(line, True, (30, 30, 30)),
                (text_box_rect.x + int(40 * self.sx), text_y),
            )
            text_y += int(40 * self.sy)

        if self.awaiting_switch:
            self.screen.blit(
                self.font_small_bold.render(
                    "Cambio attivo: premi 1-6 per scegliere.",
                    True,
                    (170, 110, 20),
                ),
                (text_box_rect.x + int(40 * self.sx), text_box_rect.y + int(165 * self.sy)),
            )

        # --- pulsanti mosse e azioni ---
        labels    = self._get_player_move_labels()
        move_keys = self._get_available_move_keys()

        for move_key in move_keys:
            self._draw_move_button(move_key, labels[move_key])

        self._draw_action_button("capture", "Cattura")
        self._draw_action_button("switch",  "Cambia")

        # --- risultato battaglia ---
        result = self.battle_state.get("battle_result")
        if result == "player_win":
            self.screen.blit(
                self.font_small_bold.render(
                    "Hai vinto! Clicca per tornare al percorso.",
                    True, (20, 120, 20),
                ),
                self._vr(120, 1010, 0, 0).topleft,
            )
        elif result == "wild_win":
            self.screen.blit(
                self.font_small_bold.render(
                    "Hai perso. Clicca per uscire.",
                    True, (170, 40, 40),
                ),
                self._vr(120, 1010, 0, 0).topleft,
            )
        elif result == "captured":
            self.screen.blit(
                self.font_small_bold.render(
                    "Pokémon catturato! Clicca per tornare.",
                    True, (20, 120, 20),
                ),
                self._vr(120, 1010, 0, 0).topleft,
            )
