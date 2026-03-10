from __future__ import annotations

import pygame

from data_loader import DataLoader
from lab_scene import LabScene
from world_scene import WorldScene


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

        self.data = DataLoader("data", strict=False).load_all()

        self.scenes = {
            "lab": LabScene(self),
            "world": WorldScene(self),
        }
        self.current_scene = self.scenes["lab"]

    def change_scene(self, scene_name: str) -> None:
        if scene_name == "world":
            self.scenes["world"] = WorldScene(self)
        if scene_name in self.scenes:
            self.current_scene = self.scenes[scene_name]

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