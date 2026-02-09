import { Lesson, Puzzlet, normal, editable } from "./lesson";
import { Compilation } from "src/compiler/compilation";

export function createFizLesson(): Lesson {
  const puzzlets: Puzzlet[] = [
    {
      instructions: [
        normal("Welcome to the fiz tutorial!\n"),
        normal("This is an interactive fiz language tutorial\n"),
        normal("Start by uncommenting the following line:"),
        editable("// f()"),
      ],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().length > 0;
      },
    },
    {
      instructions: [
        normal("f() is a function\n"),
        normal("functions consist of a word followed by ( )\n"),
        normal("functions are visualized as nodes\n"),
        normal("Write another function below:"),
      ],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().length >= 2;
      },
    },
    {
      instructions: [
        normal("Congratulatons! You completed the tutorial\n"),
        normal("Click the Tutorial button to exit this tutorial"),
      ],
      successCondition: (_compilation: Compilation) => false,
    },
  ];

  return new Lesson(puzzlets);
}
