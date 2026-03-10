from __future__ import annotations
from lab_scene import LabScene
from world_scene import WorldScene

import csv
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, List, Optional

import pygame

from data_loader import DataLoader


SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
FPS = 60
TITLE = "Arkamon"


@dataclass
class PlayerState:
    player_id: int
    name: str
    current_location: str
    money: int
    badges: int
    active_party_slot: int
    turn_order_status: int


def load_player_state(save_dir: str | Path = "saves/slot_1") -> Dict[int, PlayerState]:
    save_dir = Path(save_dir)
    file_path = save_dir / "player_state.csv"
    players: Dict[int, PlayerState] = {}

    if not file_path.exists():
        return players

    with file_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            row = {k.strip(): (v.strip() if v is not None else "") for k, v in row.items()}
            if not any(row.values()):
                continue

            try:
                player = PlayerState(
                    player_id=int(row["player_id"]),
                    name=row["name"],
                    current_location=row["current_location"],
                    money=int(row["money"]),
                    badges=int(row["badges"]),
                    active_party_slot=int(row["active_party_slot"]),
                    turn_order_status=int(row["turn_order_status"]),
                )
                players[player.player_id] = player
            except (KeyError, ValueError):
                continue

    return players


class Game:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption(TITLE)
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()
        self.running = True

        self.font_title = pygame.font.SysFont("arial", 42, bold=True)
        self.font_text = pygame.font.SysFont("arial", 26)

        self.data = DataLoader("data", strict=False).load_all()
        self.players = load_player_state("saves/slot_1")

        self.scenes = {
            "lab": LabScene(self),
            "menu": None,
            "world": WorldScene(self),
        }
        self.current_scene = self.scenes["lab"]

    def change_scene(self, scene_name: str):
        if scene_name in self.scenes:
            if scene_name == "world":
                self.scenes["world"] = WorldScene(self)
            self.current_scene = self.scenes[scene_name]

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            else:
                if hasattr(self, "current_scene") and self.current_scene:
                    self.current_scene.handle_event(event)

    def update(self, dt: float):
        if hasattr(self, "current_scene") and self.current_scene:
            self.current_scene.update(dt)

    def draw(self):
        if hasattr(self, "current_scene") and self.current_scene:
            self.current_scene.draw()
        else:
            self.screen.fill((0, 0, 0))
        pygame.display.flip()

    def run(self) -> None:
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            self.handle_events()
            self.update(dt)
            self.draw()

        pygame.quit()

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False

                elif event.key == pygame.K_RETURN:
                    if self.scene == "menu":
                        self.scene = "world"

                elif event.key == pygame.K_l:
                    self.scene = "lab"

                elif event.key == pygame.K_m:
                    self.scene = "world"

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((22, 24, 30))

        if self.scene == "menu":
            self.draw_menu()
        elif self.scene == "lab":
            self.draw_lab()
        elif self.scene == "world":
            self.draw_world()
        else:
            self.draw_fallback()

        pygame.display.flip()

    def draw_menu(self) -> None:
        title = self.font_title.render("Arkamon", True, (240, 240, 240))
        subtitle = self.font_text.render("Premi INVIO per entrare nel gioco", True, (200, 200, 200))

        self.screen.blit(title, (60, 50))
        self.screen.blit(subtitle, (60, 110))

        info_lines = [
            f"Specie caricate: {len(self.data.species)}",
            f"Mosse caricate: {len(self.data.moves_meta)}",
            f"Aree incontri: {len(self.data.wild_encounters)}",
            f"Allenatori caricati: {len(self.data.trainers)}",
            f"Nodi mondo: {len(self.data.world_nodes)}",
            f"Warning caricamento: {len(self.data.warnings)}",
            "",
            "Tasti rapidi:",
            "- INVIO = vai alla mappa",
            "- L = laboratorio",
            "- M = mappa",
            "- ESC = esci",
        ]

        y = 180
        for line in info_lines:
            text = self.font_text.render(line, True, (180, 220, 255))
            self.screen.blit(text, (60, y))
            y += 34

    def draw_lab(self) -> None:
        title = self.font_title.render("Laboratorio", True, (255, 230, 150))
        self.screen.blit(title, (60, 50))

        lines = [
            "Qui poi inseriremo la scelta starter.",
            "Starter previsti: #1, #5, #9.",
            "Il terzo starter non scelto andra al Rivale.",
            "Premi M per tornare alla mappa.",
        ]

        y = 150
        for line in lines:
            text = self.font_text.render(line, True, (230, 230, 230))
            self.screen.blit(text, (60, y))
            y += 36

    def draw_world(self) -> None:
        title = self.font_title.render("Mappa principale", True, (140, 255, 180))
        self.screen.blit(title, (60, 50))

        y = 140
        if not self.players:
            txt = self.font_text.render("Nessun salvataggio giocatore trovato.", True, (255, 160, 160))
            self.screen.blit(txt, (60, y))
            y += 50
        else:
            for player_id in sorted(self.players):
                p = self.players[player_id]
                line = (
                    f"Giocatore {p.player_id} - {p.name} | "
                    f"Luogo: {p.current_location} | "
                    f"Soldi: {p.money} | "
                    f"Medaglie: {p.badges}"
                )
                txt = self.font_text.render(line, True, (230, 230, 230))
                self.screen.blit(txt, (60, y))
                y += 40

        y += 20
        map_lines = [
            f"Nodi disponibili: {len(self.data.world_nodes)}",
            f"Collegamenti disponibili: {len(self.data.world_edges)}",
            "",
            "Questa schermata e temporanea:",
            "il prossimo step sara mostrare i nodi e il movimento a turni.",
        ]

        for line in map_lines:
            txt = self.font_text.render(line, True, (180, 220, 255))
            self.screen.blit(txt, (60, y))
            y += 34

    def draw_fallback(self) -> None:
        title = self.font_title.render("Scena sconosciuta", True, (255, 120, 120))
        self.screen.blit(title, (60, 50))


if __name__ == "__main__":
    game = Game()
    game.run()
