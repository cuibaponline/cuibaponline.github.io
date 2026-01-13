import { Component, inject, signal } from '@angular/core';
import { AnimalCardComponent } from './components/animal-card/animal-card.component';
import { LevelSelectComponent } from './components/level-select/level-select.component';
import { AnimalService } from './services/animal.service';
import { DifficultyLevel } from './models/animal.model';

@Component({
  selector: 'app-root',
  imports: [AnimalCardComponent, LevelSelectComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Animal Learning';

  private animalService = inject(AnimalService);
  viewState = signal<'level-select' | 'gameplay'>('level-select');

  onLevelSelected(level: DifficultyLevel): void {
    this.animalService.setDifficulty(level);
    this.viewState.set('gameplay');
  }

  onBackToLevels(): void {
    this.viewState.set('level-select');
  }
}
