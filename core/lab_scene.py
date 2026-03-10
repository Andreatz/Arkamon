from __future__ import annotations

import pygame
from dataclasses import dataclass
from typing import Dict, List, Optional

from save_manager import (
    load_player_state,
    save_player_state,
    load_pokemon_instances,
    save_pokemon_instances,
    next_instance_id,
    create_pokemon_instance,
)


STARTER_IDS = [1, 5, 9]
START_LOCATION = "pordenone"
POST_LAB_LOCATION = "venezia"
STARTER_LEVEL = 5


@dataclass
class StarterCard:
    species_id: int
    name: str
    type_id: str
    rect: pygame.Rect


class LabScene:
    def __init__(self, game):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 22)

        self.players = load_player_state("saves/slot_1")
        self.instances = load_pokemon_instances("saves/slot_1")

        self.phase = 0
        self.player_order = sorted(self.players.keys())[:2]
        self.choices: Dict[int, int] = {}
        self.rival_species_id: Optional[int] = None
        self.finished = False

        self.cards: List[StarterCard] = []
        self._build_cards()

    def _build_cards(self) -> None:
        self.cards.clear()
        x0 = 120
        y = 220
        w = 280
        h = 240
        gap = 60

        for i, species_id in enumerate(STARTER_IDS):
            species = self.game.data.species.get(species_id)
            if not species:
                continue

            rect = pygame.Rect(x0 + i * (w + gap), y, w, h)
            self.cards.append(
                StarterCard(
                    species_id=species_id,
                    name=species.name,
                    type_id=species.type_id,
                    rect=rect,
                )
            )

    def handle_event(self, event) -> None:
        if self.finished:
            if event.type == pygame.KEYDOWN and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.game.change_scene("world")
            return

        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            self.game.change_scene("menu")
            return

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            mouse_pos = event.pos
            for card in self.cards:
                if card.rect.collidepoint(mouse_pos):
                    self.select_starter(card.species_id)
                    break

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_1:
                self.select_starter(1)
            elif event.key == pygame.K_2:
                self.select_starter(5)
            elif event.key == pygame.K_3:
                self.select_starter(9)

    def select_starter(self, species_id: int) -> None:
        if self.finished:
            return

        if species_id in self.choices.values():
            return

        if self.phase >= len(self.player_order):
            return

        current_player_id = self.player_order[self.phase]
        self.choices[current_player_id] = species_id
        self.phase += 1

        if self.phase >= len(self.player_order):
            remaining = [sid for sid in STARTER_IDS if sid not in self.choices.values()]
            self.rival_species_id = remaining[0] if remaining else None
            self.finalize_selection()

    def finalize_selection(self) -> None:
        next_id = next_instance_id(self.instances)

        for slot_index, player_id in enumerate(self.player_order, start=1):
            species_id = self.choices[player_id]
            species = self.game.data.species[species_id]
            hp_gain = self.game.data.hp_growth.get(species.hp_growth_id, 1)
            hp_max = int(species.base_hp + (STARTER_LEVEL - 1) * hp_gain)

            self.instances.append(
                create_pokemon_instance(
                    instance_id=next_id,
                    owner_id=player_id,
                    owner_type="player",
                    storage="party",
                    slot=1,
                    species_id=species_id,
                    level=STARTER_LEVEL,
                    hp_max=hp_max,
                    nickname="",
                )
            )
            next_id += 1

            self.players[player_id]["current_location"] = POST_LAB_LOCATION
            self.players[player_id]["active_party_slot"] = 1

        if self.rival_species_id is not None:
            species = self.game.data.species[self.rival_species_id]
            hp_gain = self.game.data.hp_growth.get(species.hp_growth_id, 1)
            hp_max = int(species.base_hp + (STARTER_LEVEL - 1) * hp_gain)

            self.instances.append(
                create_pokemon_instance(
                    instance_id=next_id,
                    owner_id=999,
                    owner_type="rival",
                    storage="party",
                    slot=1,
                    species_id=self.rival_species_id,
                    level=STARTER_LEVEL,
                    hp_max=hp_max,
                    nickname="",
                )
            )

        save_player_state(self.players, "saves/slot_1")
        save_pokemon_instances(self.instances, "saves/slot_1")
        self.finished = True

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((28, 30, 38))

        title = self.font_title.render("Laboratorio - Scelta Starter", True, (245, 245, 245))
        self.screen.blit(title, (70, 50))

        if not self.finished:
            current_player_id = self.player_order[self.phase]
            player_name = self.players[current_player_id]["name"]
            subtitle = self.font_text.render(
                f"Tocca a Giocatore {current_player_id} - {player_name}",
                True,
                (255, 220, 140),
            )
            self.screen.blit(subtitle, (70, 110))
        else:
            subtitle = self.font_text.render(
                "Scelta completata. Premi INVIO per andare alla mappa.",
                True,
                (140, 255, 180),
            )
            self.screen.blit(subtitle, (70, 110))

        help_text = self.small_font.render(
            "Mouse per selezionare, oppure tasti 1 / 2 / 3",
            True,
            (190, 210, 240),
        )
        self.screen.blit(help_text, (70, 150))

        for i, card in enumerate(self.cards, start=1):
            chosen = card.species_id in self.choices.values()
            color = (65, 85, 120) if not chosen else (70, 125, 80)
            pygame.draw.rect(self.screen, color, card.rect, border_radius=12)
            pygame.draw.rect(self.screen, (220, 220, 220), card.rect, width=3, border_radius=12)

            species = self.game.data.species[card.species_id]
            lines = [
                f"{i}) {card.name}",
                f"ID: {card.species_id}",
                f"Tipo: {card.type_id}",
                f"HP base: {species.base_hp}",
                f"Mosse: {', '.join(str(m) for m in species.move_ids)}",
            ]

            y = card.rect.y + 25
            for line in lines:
                surf = self.font_text.render(line, True, (245, 245, 245))
                self.screen.blit(surf, (card.rect.x + 20, y))
                y += 38

        y = 500
        for player_id in self.player_order:
            chosen_species_id = self.choices.get(player_id)
            if chosen_species_id:
                species_name = self.game.data.species[chosen_species_id].name
                text = f"Giocatore {player_id}: {species_name}"
            else:
                text = f"Giocatore {player_id}: in attesa"
            surf = self.font_text.render(text, True, (230, 230, 230))
            self.screen.blit(surf, (70, y))
            y += 36

        if self.finished and self.rival_species_id is not None:
            rival_name = self.game.data.species[self.rival_species_id].name
            surf = self.font_text.render(
                f"Rivale: {rival_name}",
                True,
                (255, 170, 170),
            )
            self.screen.blit(surf, (70, y))
