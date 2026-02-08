import { Lesson, Puzzlet, normal } from "./lesson";
import { Compilation } from "src/compiler/compilation";

export function createFizLesson(): Lesson {
  const puzzlets: Puzzlet[] = [
    {
      instructions: [
        normal("// Welcome to the fiz tutorial!\n"),
        normal("// Let's start by writing a simple formula.\n"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check if DAG has at least one node
        return compilation.DAG.getNodeList().length > 0;
      },
    },
    {
      instructions: [
        normal("// Congratulatons! You completed the tutorial.\n"),
        normal("// Click the Tutorial button to exit this tutorial.\n"),
      ],
      successCondition: (_compilation: Compilation) => false,
    },
  ];

  return new Lesson(puzzlets);
}
