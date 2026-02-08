import { Compilation } from "../compiler/compilation";

export interface AnimationStep {
  text: string;
  typingSpeedDelayMs: number;
}

export interface Puzzlet {
  instructions: AnimationStep[];
  successCondition: (compilation: Compilation) => boolean;
}

export class Lesson {
  private puzzlets: Puzzlet[];
  private currentPuzzletIndex: number = 0;

  constructor(puzzlets: Puzzlet[]) {
    this.puzzlets = puzzlets;
  }

  public getCurrentPuzzlet(): Puzzlet {
    return this.puzzlets[this.currentPuzzletIndex];
  }

  public isComplete(): boolean {
    return this.currentPuzzletIndex >= this.puzzlets.length;
  }

  public canAdvance(compilation: Compilation): boolean {
    if (this.isComplete()) return false;
    return this.getCurrentPuzzlet().successCondition(compilation);
  }

  public advance(): boolean {
    if (this.isComplete()) return false;
    this.currentPuzzletIndex++;
    return true;
  }

  public reset(): void {
    this.currentPuzzletIndex = 0;
  }
}
