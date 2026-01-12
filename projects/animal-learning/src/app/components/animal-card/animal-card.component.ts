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

  // Track click count and current animal ID for multi-click detection
  private clickCount = signal<number>(0);
  private lastAnimalId = signal<string>('');

  // Computed signal for checking if audio is playing
  isPlaying = computed(() => this.audioService.isPlaying());

  // Handle tap/click on card
  async onCardTap(): Promise<void> {
    const animal = this.currentAnimal();

    if (!animal || this.isPlaying()) {
      return; // No animal or already playing
    }

    // Reset click count if we've moved to a different animal
    if (animal.id !== this.lastAnimalId()) {
      this.clickCount.set(0);
      this.lastAnimalId.set(animal.id);
    }

    // Show tap animation
    this.isTapped.set(true);
    setTimeout(() => this.isTapped.set(false), 300);

    // Increment click count
    this.clickCount.update(count => count + 1);

    // Speak only the animal name (no sound)
    await this.audioService.speakNameOnly(animal.name);

    // After 2 clicks, advance to next animal with a small delay
    if (this.clickCount() === 2) {
      await this.delay(500); // Small delay before advancing
      this.animalService.nextAnimal();
      this.clickCount.set(0); // Reset for the new animal
    }
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
