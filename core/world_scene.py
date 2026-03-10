from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import pygame

from save_manager import load_player_state, save_player_state, load_turn_state, save_turn_state
from paths import MAPS_DIR, SLOT_1_DIR


MAP_IMAGE_PATH = MAPS_DIR / "Mappa-Finale.jpg"
NODE_RADIUS = 18


@dataclass
class PlayerToken:
    player_id: int
    color: Tuple[int, int, int]
    offset: Tuple[int, int]


class WorldScene:
    def __init__(self, game):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 20)

        self.players = load_player_state(SLOT_1_DIR)
        self.turn_state = load_turn_state(SLOT_1_DIR)
        self.current_turn = self._resolve_current_turn()
        self.selected_node_id: Optional[str] = None
        self.hovered_node_id: Optional[str] = None

        self.tokens = {
            1: PlayerToken(1, (255, 80, 80), (-14, -10)),
            2: PlayerToken(2, (80, 160, 255), (14, 10)),
        }

        self.map_surface = self._load_map()
        self.map_rect = self.map_surface.get_rect(
            center=(self.screen.get_width() // 2, self.screen.get_height() // 2)
        )

        self.node_screen_positions = self._build_node_positions()
        self.adjacency = self._build_adjacency()

    def _load_map(self) -> pygame.Surface:
        if MAP_IMAGE_PATH.exists():
            image = pygame.image.load(str(MAP_IMAGE_PATH)).convert()
            return pygame.transform.smoothscale(
                image, (self.screen.get_width(), self.screen.get_height())
            )

        fallback = pygame.Surface((self.screen.get_width(), self.screen.get_height()))
        fallback.fill((30, 40, 55))
        return fallback

    def _get_first_player(self) -> int:
        if 1 in self.players:
            return 1
        if self.players:
            return sorted(self.players.keys())[0]
        return 1
    

    def _resolve_current_turn(self) -> int:
        saved_turn = self.turn_state.get("current_turn", 1)
        if saved_turn in self.players:
            return saved_turn
        return self._get_first_player()

    def _build_node_positions(self) -> Dict[str, Tuple[int, int]]:
        positions = {}
        for node_id, node in self.game.data.world_nodes.items():
            positions[node_id] = (node.world_x, node.world_y)
        return positions

    def _build_adjacency(self) -> Dict[str, List[str]]:
        adjacency: Dict[str, List[str]] = {}
        for edge in self.game.data.world_edges:
            adjacency.setdefault(edge.from_node, []).append(edge.to_node)
            if edge.bidirectional:
                adjacency.setdefault(edge.to_node, []).append(edge.from_node)
        return adjacency

    def handle_event(self, event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.game.change_scene("menu")
                return
            if event.key in (pygame.K_RETURN, pygame.K_e):
                self._enter_current_node()
                return

        if event.type == pygame.MOUSEMOTION:
            self.hovered_node_id = self._find_node_at_pos(event.pos)

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            clicked = self._find_node_at_pos(event.pos)
            if clicked:
                self._handle_node_click(clicked)

    def _find_node_at_pos(self, pos) -> Optional[str]:
        mx, my = pos
        for node_id, (x, y) in self.node_screen_positions.items():
            dx = mx - x
            dy = my - y
            if dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS:
                return node_id
        return None

    def _handle_node_click(self, node_id: str) -> None:
        player = self.players.get(self.current_turn)
        if not player:
            return

        current_location = player["current_location"]
        valid_destinations = self.adjacency.get(current_location, [])

        if node_id == current_location:
            self.selected_node_id = node_id
            node = self.game.data.world_nodes.get(node_id)
            if node and node.node_type == "route":
                save_turn_state(self.current_turn, SLOT_1_DIR)
                self.game.change_scene("route", route_node_id=node_id)
            return

        if node_id in valid_destinations:
            self.players[self.current_turn]["current_location"] = node_id
            self.players[self.current_turn]["turn_order_status"] = 0
            save_player_state(self.players, SLOT_1_DIR)
            self.selected_node_id = node_id
            self._advance_turn()
            save_turn_state(self.current_turn, SLOT_1_DIR)


    def _advance_turn(self) -> None:
        ordered = sorted(pid for pid in self.players.keys() if pid in (1, 2))
        if not ordered:
            return

        idx = ordered.index(self.current_turn)
        self.current_turn = ordered[(idx + 1) % len(ordered)]
        save_turn_state(self.current_turn, SLOT_1_DIR)

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.blit(self.map_surface, (0, 0))
        self._draw_edges()
        self._draw_nodes()
        self._draw_players()
        self._draw_ui()

    def _draw_edges(self) -> None:
        for edge in self.game.data.world_edges:
            if edge.from_node not in self.node_screen_positions or edge.to_node not in self.node_screen_positions:
                continue
            x1, y1 = self.node_screen_positions[edge.from_node]
            x2, y2 = self.node_screen_positions[edge.to_node]
            pygame.draw.line(self.screen, (40, 40, 40), (x1, y1), (x2, y2), 5)

    def _node_color(self, node_type: str) -> Tuple[int, int, int]:
        colors = {
            "lab": (80, 220, 120),
            "town": (255, 220, 90),
            "city": (70, 120, 255),
            "league": (210, 80, 220),
            "legendary": (255, 80, 160),
        }
        return colors.get(node_type, (220, 220, 220))

    def _draw_nodes(self) -> None:
        for node_id, node in self.game.data.world_nodes.items():
            if node_id not in self.node_screen_positions:
                continue

            x, y = self.node_screen_positions[node_id]
            color = self._node_color(node.node_type)
            radius = 12 if node_id == self.hovered_node_id else 9

            pygame.draw.circle(self.screen, (20, 20, 20), (x, y), radius + 2)
            pygame.draw.circle(self.screen, color, (x, y), radius)

            if node_id == self.hovered_node_id or node_id == self.selected_node_id:
                label = self.small_font.render(node.name, True, (10, 10, 10))
                label_bg = label.get_rect(topleft=(x + 14, y - 12))
                pygame.draw.rect(self.screen, (255, 255, 255), label_bg.inflate(10, 6), border_radius=8)
                pygame.draw.rect(self.screen, (30, 30, 30), label_bg.inflate(10, 6), 2, border_radius=8)
                self.screen.blit(label, label_bg)


    def _draw_players(self) -> None:
        for player_id, token in self.tokens.items():
            player = self.players.get(player_id)
            if not player:
                continue

            node_id = player["current_location"]
            if node_id not in self.node_screen_positions:
                continue

            x, y = self.node_screen_positions[node_id]
            ox, oy = token.offset
            pygame.draw.circle(self.screen, (255, 255, 255), (x + ox, y + oy), 9)
            pygame.draw.circle(self.screen, token.color, (x + ox, y + oy), 6)

    def _draw_ui(self) -> None:
        panel = pygame.Rect(20, 20, 340, 120)
        pygame.draw.rect(self.screen, (245, 245, 245), panel, border_radius=12)
        pygame.draw.rect(self.screen, (30, 30, 30), panel, 3, border_radius=12)

        title = self.font_title.render("Mappa generale", True, (25, 25, 25))
        self.screen.blit(title, (35, 30))

        current_player = self.players.get(self.current_turn)
        turn_text = f"Turno: Giocatore {self.current_turn}"
        if current_player:
            turn_text += f" - {current_player['name']}"

        lines = [
            turn_text,
            "Click = muovi",
            "INVIO/E = entra nel nodo",
        ]

        y = 85
        for line in lines:
            surf = self.font_text.render(line, True, (40, 40, 40))
            self.screen.blit(surf, (35, y))
            y += 30


    def _enter_current_node(self) -> None:
        player = self.players.get(self.current_turn)
        if not player:
            return

        current_location = player["current_location"]
        node = self.game.data.world_nodes.get(current_location)
        if not node:
            return

        save_turn_state(self.current_turn, SLOT_1_DIR)

        if node.node_type == "route":
            self.game.change_scene("route", route_node_id=current_location)
