from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import pygame

from paths import SLOT_1_DIR
from save_manager import (
    load_player_state,
    save_player_state,
    load_local_map_state,
    save_local_map_state,
    get_player_route_state,
)


TILE = 48
GRID_W = 20
GRID_H = 12


@dataclass
class Bush:
    bush_id: str
    rect: pygame.Rect


@dataclass
class Npc:
    npc_id: str
    rect: pygame.Rect


class RouteScene:
    def __init__(self, game, route_node_id: str):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 20)

        self.players = load_player_state(SLOT_1_DIR)
        self.route_node_id = route_node_id
        self.route_node = self.game.data.world_nodes[route_node_id]

        self.current_player_id = self._resolve_current_player()
        self.current_player = self.players[self.current_player_id]

        self.local_state = load_local_map_state(SLOT_1_DIR)
        self.player_route_state = get_player_route_state(
            self.local_state,
            self.current_player_id,
            self.route_node_id
        )
        self.player_route_state["visited"] = True

        self.player_pos = [2, 9]
        self.exit_rect = pygame.Rect(17 * TILE, 9 * TILE, TILE * 2, TILE * 2)

        self.bushes = [
            Bush("b1", pygame.Rect(6 * TILE, 3 * TILE, TILE, TILE)),
            Bush("b2", pygame.Rect(7 * TILE, 3 * TILE, TILE, TILE)),
            Bush("b3", pygame.Rect(6 * TILE, 4 * TILE, TILE, TILE)),
            Bush("b4", pygame.Rect(13 * TILE, 6 * TILE, TILE, TILE)),
        ]

        self.npcs = [
            Npc("npc_1", pygame.Rect(10 * TILE, 5 * TILE, TILE, TILE)),
        ]

        self.message = f"Entrato in {self.route_node.name}"
        save_local_map_state(self.local_state, SLOT_1_DIR)

    def _resolve_current_player(self) -> int:
        for pid in sorted(self.players):
            if self.players[pid]["turn_order_status"] == 0:
                return pid
        return sorted(self.players)[0]

    def handle_event(self, event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.game.change_scene("world")
                return

            dx, dy = 0, 0
            if event.key == pygame.K_LEFT:
                dx = -1
            elif event.key == pygame.K_RIGHT:
                dx = 1
            elif event.key == pygame.K_UP:
                dy = -1
            elif event.key == pygame.K_DOWN:
                dy = 1
            elif event.key == pygame.K_e:
                self._interact()

            if dx or dy:
                self._move_player(dx, dy)

    def _move_player(self, dx: int, dy: int) -> None:
        new_x = max(0, min(GRID_W - 1, self.player_pos[0] + dx))
        new_y = max(0, min(GRID_H - 1, self.player_pos[1] + dy))
        self.player_pos = [new_x, new_y]

        player_rect = self._player_rect()

        if player_rect.colliderect(self.exit_rect):
            self.message = "Uscita verso la mappa generale. Premi E."
            return

        for bush in self.bushes:
            if player_rect.colliderect(bush.rect):
                self.message = f"Cespuglio {bush.bush_id}. Premi E per esplorare."
                return

        for npc in self.npcs:
            if player_rect.colliderect(npc.rect):
                self.message = f"NPC {npc.npc_id}. Premi E per parlare/sfidare."
                return

        self.message = f"Esplorazione {self.route_node.name}"

    def _player_rect(self) -> pygame.Rect:
        return pygame.Rect(self.player_pos[0] * TILE, self.player_pos[1] * TILE, TILE, TILE)

    def _interact(self) -> None:
        player_rect = self._player_rect()

        if player_rect.colliderect(self.exit_rect):
            save_local_map_state(self.local_state, SLOT_1_DIR)
            self.game.change_scene("world")
            return

        for bush in self.bushes:
            if player_rect.colliderect(bush.rect):
                cleared = self.player_route_state["cleared_bushes"]
                if bush.bush_id in cleared:
                    self.message = f"{bush.bush_id} già visitato da questo giocatore."
                else:
                    cleared.append(bush.bush_id)
                    group = self.route_node.encounter_group or self.route_node_id
                    self.message = f"Esplorato {bush.bush_id}. Qui partirà l'incontro del gruppo {group}."
                    save_local_map_state(self.local_state, SLOT_1_DIR)
                return

        for npc in self.npcs:
            if player_rect.colliderect(npc.rect):
                defeated = self.player_route_state["defeated_npcs"]
                if npc.npc_id in defeated:
                    self.message = f"{npc.npc_id} già sconfitto."
                else:
                    defeated.append(npc.npc_id)
                    self.message = f"Sfida avviabile contro {npc.npc_id}."
                    save_local_map_state(self.local_state, SLOT_1_DIR)
                return

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((95, 155, 95))
        self._draw_grid()
        self._draw_bushes()
        self._draw_npcs()
        self._draw_exit()
        self._draw_player()
        self._draw_ui()

    def _draw_grid(self) -> None:
        for y in range(GRID_H):
            for x in range(GRID_W):
                rect = pygame.Rect(x * TILE, y * TILE, TILE, TILE)
                color = (110, 175, 110) if (x + y) % 2 == 0 else (105, 168, 105)
                pygame.draw.rect(self.screen, color, rect)

    def _draw_bushes(self) -> None:
        cleared = set(self.player_route_state["cleared_bushes"])
        for bush in self.bushes:
            color = (50, 110, 50) if bush.bush_id not in cleared else (90, 90, 90)
            pygame.draw.rect(self.screen, color, bush.rect)
            pygame.draw.rect(self.screen, (20, 40, 20), bush.rect, 2)

    def _draw_npcs(self) -> None:
        defeated = set(self.player_route_state["defeated_npcs"])
        for npc in self.npcs:
            color = (255, 200, 80) if npc.npc_id not in defeated else (140, 140, 140)
            pygame.draw.rect(self.screen, color, npc.rect)
            pygame.draw.rect(self.screen, (40, 40, 40), npc.rect, 2)

    def _draw_exit(self) -> None:
        pygame.draw.rect(self.screen, (120, 160, 220), self.exit_rect)
        pygame.draw.rect(self.screen, (20, 20, 20), self.exit_rect, 3)

    def _draw_player(self) -> None:
        rect = self._player_rect()
        pygame.draw.rect(self.screen, (220, 60, 60), rect)
        pygame.draw.rect(self.screen, (255, 255, 255), rect, 2)

    def _draw_ui(self) -> None:
        panel = pygame.Rect(20, 20, 520, 170)
        pygame.draw.rect(self.screen, (245, 245, 245), panel, border_radius=12)
        pygame.draw.rect(self.screen, (25, 25, 25), panel, 3, border_radius=12)

        title = self.font_title.render(self.route_node.name, True, (25, 25, 25))
        self.screen.blit(title, (35, 30))

        lines = [
            f"Giocatore attivo: {self.current_player_id} - {self.current_player['name']}",
            f"Tipo nodo: {self.route_node.node_type}",
            f"Gruppo incontri: {self.route_node.encounter_group}",
            self.message,
            "Frecce = muovi, E = interagisci, ESC = world map",
        ]

        y = 85
        for line in lines:
            surf = self.small_font.render(str(line), True, (40, 40, 40))
            self.screen.blit(surf, (35, y))
            y += 24
