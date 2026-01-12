import { Injectable, signal, computed } from '@angular/core';
import { Animal } from '../models/animal.model';

@Injectable({
  providedIn: 'root'
})
export class AnimalService {
  // All animals data (30+ animals)
  private readonly allAnimals: Animal[] = [
    // Farm Animals
    { id: 'cow', name: 'Cow', imagePath: 'assets/images/animals/cow.jpg', soundPath: 'assets/sounds/animals/cow.mp3' },
    { id: 'horse', name: 'Horse', imagePath: 'assets/images/animals/horse.jpg', soundPath: 'assets/sounds/animals/horse.mp3' },
    { id: 'pig', name: 'Pig', imagePath: 'assets/images/animals/pig.jpg', soundPath: 'assets/sounds/animals/pig.mp3' },
    { id: 'chicken', name: 'Chicken', imagePath: 'assets/images/animals/chicken.jpg', soundPath: 'assets/sounds/animals/chicken.mp3' },
    { id: 'duck', name: 'Duck', imagePath: 'assets/images/animals/duck.jpg', soundPath: 'assets/sounds/animals/duck.mp3' },
    { id: 'goat', name: 'Goat', imagePath: 'assets/images/animals/goat.jpg', soundPath: 'assets/sounds/animals/goat.mp3' },
    { id: 'sheep', name: 'Sheep', imagePath: 'assets/images/animals/sheep.jpg', soundPath: 'assets/sounds/animals/sheep.mp3' },
    { id: 'rooster', name: 'Rooster', imagePath: 'assets/images/animals/rooster.jpg', soundPath: 'assets/sounds/animals/rooster.mp3' },

    // Pets
    { id: 'dog', name: 'Dog', imagePath: 'assets/images/animals/dog.jpg', soundPath: 'assets/sounds/animals/dog.mp3' },
    { id: 'cat', name: 'Cat', imagePath: 'assets/images/animals/cat.jpg', soundPath: 'assets/sounds/animals/cat.mp3' },
    { id: 'rabbit', name: 'Rabbit', imagePath: 'assets/images/animals/rabbit.jpg', soundPath: 'assets/sounds/animals/rabbit.mp3' },
    { id: 'hamster', name: 'Hamster', imagePath: 'assets/images/animals/hamster.jpg', soundPath: 'assets/sounds/animals/hamster.mp3' },
    { id: 'parrot', name: 'Parrot', imagePath: 'assets/images/animals/parrot.jpg', soundPath: 'assets/sounds/animals/parrot.mp3' },
    { id: 'goldfish', name: 'Goldfish', imagePath: 'assets/images/animals/goldfish.jpg', soundPath: 'assets/sounds/animals/goldfish.mp3' },

    // Wild Animals
    { id: 'lion', name: 'Lion', imagePath: 'assets/images/animals/lion.jpg', soundPath: 'assets/sounds/animals/lion.mp3' },
    { id: 'tiger', name: 'Tiger', imagePath: 'assets/images/animals/tiger.jpg', soundPath: 'assets/sounds/animals/tiger.mp3' },
    { id: 'elephant', name: 'Elephant', imagePath: 'assets/images/animals/elephant.jpg', soundPath: 'assets/sounds/animals/elephant.mp3' },
    { id: 'giraffe', name: 'Giraffe', imagePath: 'assets/images/animals/giraffe.jpg', soundPath: 'assets/sounds/animals/giraffe.mp3' },
    { id: 'zebra', name: 'Zebra', imagePath: 'assets/images/animals/zebra.jpg', soundPath: 'assets/sounds/animals/zebra.mp3' },
    { id: 'monkey', name: 'Monkey', imagePath: 'assets/images/animals/monkey.jpg', soundPath: 'assets/sounds/animals/monkey.mp3' },
    { id: 'bear', name: 'Bear', imagePath: 'assets/images/animals/bear.jpg', soundPath: 'assets/sounds/animals/bear.mp3' },
    { id: 'panda', name: 'Panda', imagePath: 'assets/images/animals/panda.jpg', soundPath: 'assets/sounds/animals/panda.mp3' },

    // Birds
    { id: 'owl', name: 'Owl', imagePath: 'assets/images/animals/owl.jpg', soundPath: 'assets/sounds/animals/owl.mp3' },
    { id: 'eagle', name: 'Eagle', imagePath: 'assets/images/animals/eagle.jpg', soundPath: 'assets/sounds/animals/eagle.mp3' },
    { id: 'penguin', name: 'Penguin', imagePath: 'assets/images/animals/penguin.jpg', soundPath: 'assets/sounds/animals/penguin.mp3' },
    { id: 'flamingo', name: 'Flamingo', imagePath: 'assets/images/animals/flamingo.jpg', soundPath: 'assets/sounds/animals/flamingo.mp3' },

    // Sea Animals
    { id: 'dolphin', name: 'Dolphin', imagePath: 'assets/images/animals/dolphin.jpg', soundPath: 'assets/sounds/animals/dolphin.mp3' },
    { id: 'whale', name: 'Whale', imagePath: 'assets/images/animals/whale.jpg', soundPath: 'assets/sounds/animals/whale.mp3' },
    { id: 'shark', name: 'Shark', imagePath: 'assets/images/animals/shark.jpg', soundPath: 'assets/sounds/animals/shark.mp3' },
    { id: 'octopus', name: 'Octopus', imagePath: 'assets/images/animals/octopus.jpg', soundPath: 'assets/sounds/animals/octopus.mp3' },
    { id: 'turtle', name: 'Turtle', imagePath: 'assets/images/animals/turtle.jpg', soundPath: 'assets/sounds/animals/turtle.mp3' },
    { id: 'seal', name: 'Seal', imagePath: 'assets/images/animals/seal.jpg', soundPath: 'assets/sounds/animals/seal.mp3' },
    { id: 'seahorse', name: 'Seahorse', imagePath: 'assets/images/animals/seahorse.jpg', soundPath: 'assets/sounds/animals/seahorse.mp3' },
    { id: 'starfish', name: 'Starfish', imagePath: 'assets/images/animals/starfish.jpg', soundPath: 'assets/sounds/animals/starfish.mp3' },
    { id: 'jellyfish', name: 'Jellyfish', imagePath: 'assets/images/animals/jellyfish.jpg', soundPath: 'assets/sounds/animals/jellyfish.mp3' },
    { id: 'crab', name: 'Crab', imagePath: 'assets/images/animals/crab.jpg', soundPath: 'assets/sounds/animals/crab.mp3' },
    { id: 'clownfish', name: 'Clownfish', imagePath: 'assets/images/animals/clownfish.jpg', soundPath: 'assets/sounds/animals/clownfish.mp3' },
    { id: 'stingray', name: 'Stingray', imagePath: 'assets/images/animals/stingray.jpg', soundPath: 'assets/sounds/animals/stingray.mp3' },

    // More Wild Animals
    { id: 'koala', name: 'Koala', imagePath: 'assets/images/animals/koala.jpg', soundPath: 'assets/sounds/animals/koala.mp3' },
    { id: 'kangaroo', name: 'Kangaroo', imagePath: 'assets/images/animals/kangaroo.jpg', soundPath: 'assets/sounds/animals/kangaroo.mp3' },
    { id: 'gorilla', name: 'Gorilla', imagePath: 'assets/images/animals/gorilla.jpg', soundPath: 'assets/sounds/animals/gorilla.mp3' },
    { id: 'hippo', name: 'Hippo', imagePath: 'assets/images/animals/hippo.jpg', soundPath: 'assets/sounds/animals/hippo.mp3' },
    { id: 'rhino', name: 'Rhino', imagePath: 'assets/images/animals/rhino.jpg', soundPath: 'assets/sounds/animals/rhino.mp3' },
    { id: 'crocodile', name: 'Crocodile', imagePath: 'assets/images/animals/crocodile.jpg', soundPath: 'assets/sounds/animals/crocodile.mp3' },
    { id: 'camel', name: 'Camel', imagePath: 'assets/images/animals/camel.jpg', soundPath: 'assets/sounds/animals/camel.mp3' },
    { id: 'ostrich', name: 'Ostrich', imagePath: 'assets/images/animals/ostrich.jpg', soundPath: 'assets/sounds/animals/ostrich.mp3' },
    { id: 'peacock', name: 'Peacock', imagePath: 'assets/images/animals/peacock.jpg', soundPath: 'assets/sounds/animals/peacock.mp3' },
    { id: 'cheetah', name: 'Cheetah', imagePath: 'assets/images/animals/cheetah.jpg', soundPath: 'assets/sounds/animals/cheetah.mp3' },
    { id: 'wolf', name: 'Wolf', imagePath: 'assets/images/animals/wolf.jpg', soundPath: 'assets/sounds/animals/wolf.mp3' },
    { id: 'fox', name: 'Fox', imagePath: 'assets/images/animals/fox.jpg', soundPath: 'assets/sounds/animals/fox.mp3' },
    { id: 'deer', name: 'Deer', imagePath: 'assets/images/animals/deer.jpg', soundPath: 'assets/sounds/animals/deer.mp3' },
    { id: 'sloth', name: 'Sloth', imagePath: 'assets/images/animals/sloth.jpg', soundPath: 'assets/sounds/animals/sloth.mp3' },

    // More Farm Animals
    { id: 'turkey', name: 'Turkey', imagePath: 'assets/images/animals/turkey.jpg', soundPath: 'assets/sounds/animals/turkey.mp3' },
    { id: 'donkey', name: 'Donkey', imagePath: 'assets/images/animals/donkey.jpg', soundPath: 'assets/sounds/animals/donkey.mp3' },

    // Bugs & Insects
    { id: 'ladybug', name: 'Ladybug', imagePath: 'assets/images/animals/ladybug.jpg', soundPath: 'assets/sounds/animals/ladybug.mp3' },
    { id: 'ant', name: 'Ant', imagePath: 'assets/images/animals/ant.jpg', soundPath: 'assets/sounds/animals/ant.mp3' },
    { id: 'spider', name: 'Spider', imagePath: 'assets/images/animals/spider.jpg', soundPath: 'assets/sounds/animals/spider.mp3' },
    { id: 'grasshopper', name: 'Grasshopper', imagePath: 'assets/images/animals/grasshopper.jpg', soundPath: 'assets/sounds/animals/grasshopper.mp3' },
    { id: 'dragonfly', name: 'Dragonfly', imagePath: 'assets/images/animals/dragonfly.jpg', soundPath: 'assets/sounds/animals/dragonfly.mp3' },

    // Others
    { id: 'frog', name: 'Frog', imagePath: 'assets/images/animals/frog.jpg', soundPath: 'assets/sounds/animals/frog.mp3' },
    { id: 'snake', name: 'Snake', imagePath: 'assets/images/animals/snake.jpg', soundPath: 'assets/sounds/animals/snake.mp3' },
    { id: 'butterfly', name: 'Butterfly', imagePath: 'assets/images/animals/butterfly.jpg', soundPath: 'assets/sounds/animals/butterfly.mp3' },
    { id: 'bee', name: 'Bee', imagePath: 'assets/images/animals/bee.jpg', soundPath: 'assets/sounds/animals/bee.mp3' }
  ];

  // Signal-based state
  private currentIndex = signal<number>(0);
  private shuffledSequence = signal<Animal[]>([]);

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

  // Shuffle animals using Fisher-Yates algorithm
  shuffle(): void {
    const shuffled = [...this.allAnimals];
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
