import { Injectable, signal, computed } from '@angular/core';
import { Animal, DifficultyLevel } from '../models/animal.model';

@Injectable({
  providedIn: 'root'
})
export class AnimalService {
  // All animals data (30+ animals)
  private readonly allAnimals: Animal[] = [
    // Farm Animals
    { id: 'cow', name: 'Cow', category: 'farm', imagePath: 'assets/images/animals/cow.jpg', soundPath: 'assets/sounds/animals/cow.mp3' },
    { id: 'horse', name: 'Horse', category: 'farm', imagePath: 'assets/images/animals/horse.jpg', soundPath: 'assets/sounds/animals/horse.mp3' },
    { id: 'pig', name: 'Pig', category: 'farm', imagePath: 'assets/images/animals/pig.jpg', soundPath: 'assets/sounds/animals/pig.mp3' },
    { id: 'chicken', name: 'Chicken', category: 'farm', imagePath: 'assets/images/animals/chicken.jpg', soundPath: 'assets/sounds/animals/chicken.mp3' },
    { id: 'duck', name: 'Duck', category: 'farm', imagePath: 'assets/images/animals/duck.jpg', soundPath: 'assets/sounds/animals/duck.mp3' },
    { id: 'goat', name: 'Goat', category: 'farm', imagePath: 'assets/images/animals/goat.jpg', soundPath: 'assets/sounds/animals/goat.mp3' },
    { id: 'sheep', name: 'Sheep', category: 'farm', imagePath: 'assets/images/animals/sheep.jpg', soundPath: 'assets/sounds/animals/sheep.mp3' },
    { id: 'rooster', name: 'Rooster', category: 'farm', imagePath: 'assets/images/animals/rooster.jpg', soundPath: 'assets/sounds/animals/rooster.mp3' },

    // Pets
    { id: 'dog', name: 'Dog', category: 'pet', imagePath: 'assets/images/animals/dog.jpg', soundPath: 'assets/sounds/animals/dog.mp3' },
    { id: 'cat', name: 'Cat', category: 'pet', imagePath: 'assets/images/animals/cat.jpg', soundPath: 'assets/sounds/animals/cat.mp3' },
    { id: 'rabbit', name: 'Rabbit', category: 'pet', imagePath: 'assets/images/animals/rabbit.jpg', soundPath: 'assets/sounds/animals/rabbit.mp3' },
    { id: 'hamster', name: 'Hamster', category: 'pet', imagePath: 'assets/images/animals/hamster.jpg', soundPath: 'assets/sounds/animals/hamster.mp3' },
    { id: 'parrot', name: 'Parrot', category: 'pet', imagePath: 'assets/images/animals/parrot.jpg', soundPath: 'assets/sounds/animals/parrot.mp3' },
    { id: 'goldfish', name: 'Goldfish', category: 'pet', imagePath: 'assets/images/animals/goldfish.jpg', soundPath: 'assets/sounds/animals/goldfish.mp3' },

    // Wild Animals
    { id: 'lion', name: 'Lion', category: 'wild', imagePath: 'assets/images/animals/lion.jpg', soundPath: 'assets/sounds/animals/lion.mp3' },
    { id: 'tiger', name: 'Tiger', category: 'wild', imagePath: 'assets/images/animals/tiger.jpg', soundPath: 'assets/sounds/animals/tiger.mp3' },
    { id: 'elephant', name: 'Elephant', category: 'wild', imagePath: 'assets/images/animals/elephant.jpg', soundPath: 'assets/sounds/animals/elephant.mp3' },
    { id: 'giraffe', name: 'Giraffe', category: 'wild', imagePath: 'assets/images/animals/giraffe.jpg', soundPath: 'assets/sounds/animals/giraffe.mp3' },
    { id: 'zebra', name: 'Zebra', category: 'wild', imagePath: 'assets/images/animals/zebra.jpg', soundPath: 'assets/sounds/animals/zebra.mp3' },
    { id: 'monkey', name: 'Monkey', category: 'wild', imagePath: 'assets/images/animals/monkey.jpg', soundPath: 'assets/sounds/animals/monkey.mp3' },
    { id: 'bear', name: 'Bear', category: 'wild', imagePath: 'assets/images/animals/bear.jpg', soundPath: 'assets/sounds/animals/bear.mp3' },
    { id: 'panda', name: 'Panda', category: 'wild', imagePath: 'assets/images/animals/panda.jpg', soundPath: 'assets/sounds/animals/panda.mp3' },

    // Birds
    { id: 'owl', name: 'Owl', category: 'bird', imagePath: 'assets/images/animals/owl.jpg', soundPath: 'assets/sounds/animals/owl.mp3' },
    { id: 'eagle', name: 'Eagle', category: 'bird', imagePath: 'assets/images/animals/eagle.jpg', soundPath: 'assets/sounds/animals/eagle.mp3' },
    { id: 'penguin', name: 'Penguin', category: 'bird', imagePath: 'assets/images/animals/penguin.jpg', soundPath: 'assets/sounds/animals/penguin.mp3' },
    { id: 'flamingo', name: 'Flamingo', category: 'bird', imagePath: 'assets/images/animals/flamingo.jpg', soundPath: 'assets/sounds/animals/flamingo.mp3' },

    // Sea Animals
    { id: 'dolphin', name: 'Dolphin', category: 'sea', imagePath: 'assets/images/animals/dolphin.jpg', soundPath: 'assets/sounds/animals/dolphin.mp3' },
    { id: 'whale', name: 'Whale', category: 'sea', imagePath: 'assets/images/animals/whale.jpg', soundPath: 'assets/sounds/animals/whale.mp3' },
    { id: 'shark', name: 'Shark', category: 'sea', imagePath: 'assets/images/animals/shark.jpg', soundPath: 'assets/sounds/animals/shark.mp3' },
    { id: 'octopus', name: 'Octopus', category: 'sea', imagePath: 'assets/images/animals/octopus.jpg', soundPath: 'assets/sounds/animals/octopus.mp3' },
    { id: 'turtle', name: 'Turtle', category: 'sea', imagePath: 'assets/images/animals/turtle.jpg', soundPath: 'assets/sounds/animals/turtle.mp3' },
    { id: 'seal', name: 'Seal', category: 'sea', imagePath: 'assets/images/animals/seal.jpg', soundPath: 'assets/sounds/animals/seal.mp3' },
    { id: 'seahorse', name: 'Seahorse', category: 'sea', imagePath: 'assets/images/animals/seahorse.jpg', soundPath: 'assets/sounds/animals/seahorse.mp3' },
    { id: 'starfish', name: 'Starfish', category: 'sea', imagePath: 'assets/images/animals/starfish.jpg', soundPath: 'assets/sounds/animals/starfish.mp3' },
    { id: 'jellyfish', name: 'Jellyfish', category: 'sea', imagePath: 'assets/images/animals/jellyfish.jpg', soundPath: 'assets/sounds/animals/jellyfish.mp3' },
    { id: 'crab', name: 'Crab', category: 'sea', imagePath: 'assets/images/animals/crab.jpg', soundPath: 'assets/sounds/animals/crab.mp3' },
    { id: 'clownfish', name: 'Clownfish', category: 'sea', imagePath: 'assets/images/animals/clownfish.jpg', soundPath: 'assets/sounds/animals/clownfish.mp3' },
    { id: 'stingray', name: 'Stingray', category: 'sea', imagePath: 'assets/images/animals/stingray.jpg', soundPath: 'assets/sounds/animals/stingray.mp3' },

    // More Wild Animals
    { id: 'koala', name: 'Koala', category: 'wild', imagePath: 'assets/images/animals/koala.jpg', soundPath: 'assets/sounds/animals/koala.mp3' },
    { id: 'kangaroo', name: 'Kangaroo', category: 'wild', imagePath: 'assets/images/animals/kangaroo.jpg', soundPath: 'assets/sounds/animals/kangaroo.mp3' },
    { id: 'gorilla', name: 'Gorilla', category: 'wild', imagePath: 'assets/images/animals/gorilla.jpg', soundPath: 'assets/sounds/animals/gorilla.mp3' },
    { id: 'hippo', name: 'Hippo', category: 'wild', imagePath: 'assets/images/animals/hippo.jpg', soundPath: 'assets/sounds/animals/hippo.mp3' },
    { id: 'rhino', name: 'Rhino', category: 'wild', imagePath: 'assets/images/animals/rhino.jpg', soundPath: 'assets/sounds/animals/rhino.mp3' },
    { id: 'crocodile', name: 'Crocodile', category: 'wild', imagePath: 'assets/images/animals/crocodile.jpg', soundPath: 'assets/sounds/animals/crocodile.mp3' },
    { id: 'camel', name: 'Camel', category: 'wild', imagePath: 'assets/images/animals/camel.jpg', soundPath: 'assets/sounds/animals/camel.mp3' },
    { id: 'ostrich', name: 'Ostrich', category: 'bird', imagePath: 'assets/images/animals/ostrich.jpg', soundPath: 'assets/sounds/animals/ostrich.mp3' },
    { id: 'peacock', name: 'Peacock', category: 'bird', imagePath: 'assets/images/animals/peacock.jpg', soundPath: 'assets/sounds/animals/peacock.mp3' },
    { id: 'cheetah', name: 'Cheetah', category: 'wild', imagePath: 'assets/images/animals/cheetah.jpg', soundPath: 'assets/sounds/animals/cheetah.mp3' },
    { id: 'wolf', name: 'Wolf', category: 'wild', imagePath: 'assets/images/animals/wolf.jpg', soundPath: 'assets/sounds/animals/wolf.mp3' },
    { id: 'fox', name: 'Fox', category: 'wild', imagePath: 'assets/images/animals/fox.jpg', soundPath: 'assets/sounds/animals/fox.mp3' },
    { id: 'deer', name: 'Deer', category: 'wild', imagePath: 'assets/images/animals/deer.jpg', soundPath: 'assets/sounds/animals/deer.mp3' },
    { id: 'sloth', name: 'Sloth', category: 'wild', imagePath: 'assets/images/animals/sloth.jpg', soundPath: 'assets/sounds/animals/sloth.mp3' },

    // More Farm Animals
    { id: 'turkey', name: 'Turkey', category: 'farm', imagePath: 'assets/images/animals/turkey.jpg', soundPath: 'assets/sounds/animals/turkey.mp3' },
    { id: 'donkey', name: 'Donkey', category: 'farm', imagePath: 'assets/images/animals/donkey.jpg', soundPath: 'assets/sounds/animals/donkey.mp3' },

    // Bugs & Insects
    { id: 'ladybug', name: 'Ladybug', category: 'bug', imagePath: 'assets/images/animals/ladybug.jpg', soundPath: 'assets/sounds/animals/ladybug.mp3' },
    { id: 'ant', name: 'Ant', category: 'bug', imagePath: 'assets/images/animals/ant.jpg', soundPath: 'assets/sounds/animals/ant.mp3' },
    { id: 'spider', name: 'Spider', category: 'bug', imagePath: 'assets/images/animals/spider.jpg', soundPath: 'assets/sounds/animals/spider.mp3' },
    { id: 'grasshopper', name: 'Grasshopper', category: 'bug', imagePath: 'assets/images/animals/grasshopper.jpg', soundPath: 'assets/sounds/animals/grasshopper.mp3' },
    { id: 'dragonfly', name: 'Dragonfly', category: 'bug', imagePath: 'assets/images/animals/dragonfly.jpg', soundPath: 'assets/sounds/animals/dragonfly.mp3' },

    // Others
    { id: 'frog', name: 'Frog', category: 'other', imagePath: 'assets/images/animals/frog.jpg', soundPath: 'assets/sounds/animals/frog.mp3' },
    { id: 'snake', name: 'Snake', category: 'other', imagePath: 'assets/images/animals/snake.jpg', soundPath: 'assets/sounds/animals/snake.mp3' },
    { id: 'butterfly', name: 'Butterfly', category: 'other', imagePath: 'assets/images/animals/butterfly.jpg', soundPath: 'assets/sounds/animals/butterfly.mp3' },
    { id: 'bee', name: 'Bee', category: 'other', imagePath: 'assets/images/animals/bee.jpg', soundPath: 'assets/sounds/animals/bee.mp3' }
  ];

  // Signal-based state
  private currentIndex = signal<number>(0);
  private shuffledSequence = signal<Animal[]>([]);
  private selectedDifficulty = signal<DifficultyLevel>('easy');

  // Computed signal for current animal
  currentAnimal = computed(() => {
    const sequence = this.shuffledSequence();
    const index = this.currentIndex();
    return sequence[index] || null;
  });

  constructor() {
    // Initialize with shuffled sequence
    this.shuffle();
  }

  // Get animals filtered by difficulty level with random subset selection
  private getAnimalsByDifficulty(level: DifficultyLevel): Animal[] {
    let pool: Animal[] = [];
    let minCount: number = 0;
    let maxCount: number = 0;

    switch (level) {
      case 'easy':
        // Pool: farm animals, pick 8-10 random
        pool = this.allAnimals.filter(a => a.category === 'farm');
        minCount = 8;
        maxCount = 10;
        break;
      case 'medium':
        // Pool: farm + pets, pick 12-16 random
        pool = this.allAnimals.filter(a => a.category === 'farm' || a.category === 'pet');
        minCount = 12;
        maxCount = 16;
        break;
      case 'hard':
        // Pool: all animals, pick 50-60 random
        pool = this.allAnimals;
        minCount = 50;
        maxCount = 60;
        break;
    }

    // Randomly select a subset size between min and max
    const targetCount = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

    // Randomly pick the subset using Fisher-Yates shuffle and slice
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, targetCount);
  }

  // Set difficulty level and reshuffle
  setDifficulty(level: DifficultyLevel): void {
    this.selectedDifficulty.set(level);
    this.shuffle();
  }

  // Get current difficulty level
  getCurrentDifficulty(): DifficultyLevel {
    return this.selectedDifficulty();
  }

  // Shuffle animals using Fisher-Yates algorithm
  shuffle(): void {
    const difficulty = this.selectedDifficulty();
    const animalsToShuffle = this.getAnimalsByDifficulty(difficulty);
    const shuffled = [...animalsToShuffle];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.shuffledSequence.set(shuffled);
    this.currentIndex.set(0);
  }

  // Move to next animal
  nextAnimal(): void {
    const sequence = this.shuffledSequence();
    const newIndex = (this.currentIndex() + 1) % sequence.length;

    // If we've completed the full cycle, reshuffle
    if (newIndex === 0) {
      this.shuffle();
    } else {
      this.currentIndex.set(newIndex);
    }
  }

  // Reset to first animal
  reset(): void {
    this.currentIndex.set(0);
  }

  // Get all animals (for preloading)
  getAllAnimals(): Animal[] {
    return this.shuffledSequence();
  }
}
