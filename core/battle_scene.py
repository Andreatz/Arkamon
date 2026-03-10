from __future__ import annotations

import pygame

from paths import SLOT_1_DIR
from save_manager import load_battle_state, load_pokemon_instances


class BattleScene:
    def __init__(self, game):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 20)

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

    def handle_event(self, event) -> None:
        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            self.game.change_scene("world")
            return

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for key, rect in self.buttons.items():
                if rect.collidepoint(event.pos):
                    self._handle_button(key)
                    break

    def _handle_button(self, key: str) -> None:
        if key.startswith("move_"):
            self.message = f"Hai selezionato {key}. Qui collegheremo il sistema danni."
        elif key == "capture":
            if self.battle_state.get("capture_allowed"):
                self.message = "Qui collegheremo la cattura."
            else:
                self.message = "Cattura non disponibile."
        elif key == "switch":
            self.message = "Qui collegheremo il cambio Pokémon."

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((210, 235, 255))

        pygame.draw.rect(self.screen, (120, 180, 120), (0, 350, 1280, 370))

        title = self.font_title.render("Battaglia", True, (25, 25, 25))
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
        self.screen.blit(msg, (60, 430))

        labels = {
            "move_1": "Mossa 1",
            "move_2": "Mossa 2",
            "move_3": "Mossa 3",
            "capture": "Cattura",
            "switch": "Cambia",
        }

        for key, rect in self.buttons.items():
            pygame.draw.rect(self.screen, (245, 245, 245), rect, border_radius=10)
            pygame.draw.rect(self.screen, (40, 40, 40), rect, 3, border_radius=10)
            surf = self.small_font.render(labels[key], True, (20, 20, 20))
            self.screen.blit(surf, (rect.x + 18, rect.y + 18))
