import { Component, output, ChangeDetectionStrategy } from '@angular/core';
import { DifficultyLevel } from '../../models/animal.model';

@Component({
  selector: 'app-level-select',
  standalone: true,
  templateUrl: './level-select.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './level-select.component.css'
})
export class LevelSelectComponent {
  levelSelected = output<DifficultyLevel>();

  onLevelClick(level: DifficultyLevel): void {
    this.levelSelected.emit(level);
  }
}
