import { Lesson, Puzzlet, createAnimationStep as step } from "./lesson";
import { Compilation } from "src/compiler/compilation";

export function createFizLesson(): Lesson {
  const puzzlets: Puzzlet[] = [
    {
      instructions: [
        step("// Welcome to the fiz tutorial!\n"),
        step("// Let's start by writing a simple formula.\n"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check if DAG has at least one node
        return compilation.DAG.getNodeList().length > 0;
      },
    },
    {
      instructions: [
        step("// Congratulatons! You completed the tutorial.\n"),
        step("// Click the Tutorial button to exit this tutorial.\n"),
      ],
      successCondition: (_compilation: Compilation) => false,
    },
  ];

  return new Lesson(puzzlets);
}
