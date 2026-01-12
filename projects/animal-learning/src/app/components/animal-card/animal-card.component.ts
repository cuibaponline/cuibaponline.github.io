import { Component, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { AnimalService } from '../../services/animal.service';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-animal-card',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './animal-card.component.html',
  styleUrl: './animal-card.component.css'
})
export class AnimalCardComponent {
  // Inject services using modern inject() function
  private animalService = inject(AnimalService);
  private audioService = inject(AudioService);

  // Get current animal from service (computed signal)
  currentAnimal = this.animalService.currentAnimal;

  // Local state for tap animation
  isTapped = signal<boolean>(false);

  // Computed signal for checking if audio is playing
  isPlaying = computed(() => this.audioService.isPlaying());

  // Handle tap/click on card
  async onCardTap(): Promise<void> {
    const animal = this.currentAnimal();

    if (!animal || this.isPlaying()) {
      return; // No animal or already playing
    }

    // Show tap animation
    this.isTapped.set(true);
    setTimeout(() => this.isTapped.set(false), 300);

    // Play audio sequence (animal sound + name)
    await this.audioService.playSequence(animal);

    // Move to next animal
    this.animalService.nextAnimal();
  }
}
