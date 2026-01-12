import { Component } from '@angular/core';
import { AnimalCardComponent } from './components/animal-card/animal-card.component';

@Component({
  selector: 'app-root',
  imports: [AnimalCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Animal Learning';
}
