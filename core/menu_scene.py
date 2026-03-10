from __future__ import annotations

import pygame


class MenuScene:
    def __init__(self, game):
        self.game = game
        self.screen = game.screen
        self.font_title = game.font_title
        self.font_text = game.font_text
        self.small_font = pygame.font.SysFont("arial", 22)

    def handle_event(self, event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.game.running = False
            elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.game.start_or_continue_game()
            elif event.key == pygame.K_l:
                self.game.change_scene("lab")
            elif event.key == pygame.K_m:
                self.game.change_scene("world")

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill((22, 24, 30))

        title = self.font_title.render("Arkamon", True, (240, 240, 240))
        subtitle = self.font_text.render("Menu principale", True, (200, 200, 200))

        self.screen.blit(title, (60, 50))
        self.screen.blit(subtitle, (60, 105))

        lines = [
            "INVIO / SPAZIO = continua o nuova partita",
            "L = forza laboratorio",
            "M = forza mappa generale",
            "ESC = esci",
            "",
            f"Specie caricate: {len(self.game.data.species)}",
            f"Mosse caricate: {len(self.game.data.moves_meta)}",
            f"Nodi mappa: {len(self.game.data.world_nodes)}",
            f"Collegamenti: {len(self.game.data.world_edges)}",
            f"Warning dati: {len(self.game.data.warnings)}",
        ]

        y = 170
        for line in lines:
            surf = self.font_text.render(line, True, (180, 220, 255))
            self.screen.blit(surf, (60, y))
            y += 34
