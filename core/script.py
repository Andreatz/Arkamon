from __future__ import annotations

import pygame

from data_loader import DataLoader
from lab_scene import LabScene
from menu_scene import MenuScene
from world_scene import WorldScene
from save_manager import load_pokemon_instances, load_player_state
from paths import DATA_DIR, SLOT_1_DIR


SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
FPS = 60
TITLE = "Arkamon"


class Game:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption(TITLE)
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()
        self.running = True

        self.font_title = pygame.font.SysFont("arial", 42, bold=True)
        self.font_text = pygame.font.SysFont("arial", 26)

        self.data = DataLoader(DATA_DIR, strict=False).load_all()
        self.scenes = {}
        self.current_scene = None

        self.change_scene("menu")

    def _should_start_in_lab(self) -> bool:
        players = load_player_state(SLOT_1_DIR)
        instances = load_pokemon_instances(SLOT_1_DIR)

        if len(players) < 2:
            return True

        player_party = [
            p for p in instances
            if str(p.get("owner_type", "")).strip().lower() == "player"
            and str(p.get("storage", "")).strip().lower() == "party"
        ]

        player_ids_with_starter = {
            int(p["owner_id"])
            for p in player_party
            if str(p.get("owner_id", "")).isdigit()
        }

        return not ({1, 2}.issubset(player_ids_with_starter))

    def change_scene(self, scene_name: str) -> None:
        if scene_name == "menu":
            self.scenes["menu"] = MenuScene(self)
            self.current_scene = self.scenes["menu"]
        elif scene_name == "lab":
            self.scenes["lab"] = LabScene(self)
            self.current_scene = self.scenes["lab"]
        elif scene_name == "world":
            self.scenes["world"] = WorldScene(self)
            self.current_scene = self.scenes["world"]

    def start_or_continue_game(self) -> None:
        if self._should_start_in_lab():
            self.change_scene("lab")
        else:
            self.change_scene("world")

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif self.current_scene:
                self.current_scene.handle_event(event)

    def update(self, dt: float) -> None:
        if self.current_scene:
            self.current_scene.update(dt)

    def draw(self) -> None:
        if self.current_scene:
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


if __name__ == "__main__":
    game = Game()
    game.run()
