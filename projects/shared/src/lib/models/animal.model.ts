export type AnimalCategory = 'farm' | 'pet' | 'wild' | 'bird' | 'sea' | 'bug' | 'other';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Animal {
  id: string;
  name: string;
  category: AnimalCategory;
  imagePath: string;
  soundPath: string;
}
