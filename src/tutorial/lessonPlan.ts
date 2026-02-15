import { Lesson, Puzzlet, normal, fast, slow, dramatic } from "./lesson";
import { Compilation } from "src/compiler/compilation";
import {
  NodeType,
  AssignmentTreeNode,
  NamedStyleTreeNode,
} from "src/compiler/ast";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import {
  getInDegree,
  getOutDegree,
  createNodeIdToVarNameCount,
  getStyleTaggedNodes,
} from "./winCheckHelpers";

export function createFizLesson(): Lesson {
  // Intro module
  const introPuzzlet: Puzzlet = {
    name: "Let's get func-y!",
    instructions: [
      normal("Welcome to an interactive fiz language tutorial!\n"),
      normal("Start by uncommenting the following line (remove the '//'):"),
    ],
    examples: [fast("// f()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().length > 0;
    },
  };
  const introModule = {
    name: "Intro",
    puzzlets: [introPuzzlet],
  };

  // Functions module
  const functionsPuzzlets: Puzzlet[] = [
    {
      name: "Getting Edgy",
      instructions: [
        normal("f() is a function.\n"),
        normal("Functions consist of a word followed by ( ).\n"),
        normal("Functions are visualized as nodes.\n"),
        normal("Functions can be input to other functions.\n"),
        normal("Put another function between the ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getEdgeList().length > 0;
      },
    },
    {
      name: "Double Edged",
      instructions: [
        normal("Arguments to functions are visualized as edges.\n"),
        normal("Functions can also take multiple comma separated inputs.\n"),
        normal("Add a ',' and then another function in the outermost ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        return compilation.DAG.getNodeList().some(
          (node) => getInDegree(node.id, edgeList) >= 2,
        );
      },
    },
    {
      name: "Compose Yourself",
      instructions: [
        normal("Functions can also be arbitrarily nested.\n"),
        normal("Add another function inside an innermost ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        return compilation.DAG.getNodeList().some((node) => {
          const inDegree = getInDegree(node.id, edgeList);
          const outDegree = getOutDegree(node.id, edgeList);
          return inDegree >= 1 && outDegree >= 1;
        });
      },
    },
  ];
  const functionsModule = {
    name: "Functions",
    puzzlets: functionsPuzzlets,
  };

  // Assignment module
  const assignmentPuzzlets: Puzzlet[] = [
    {
      name: "On Assignment",
      instructions: [
        normal("Functions can be assigned to variables using '='.\n"),
        normal("variable_name = function_name()\n"),
        normal("Uncomment the assignment below:"),
      ],
      examples: [fast("// x = f()")],
      clearEditorOnStart: true,
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getVarNameToNodeIdMap().size > 0;
      },
    },
    {
      name: "Understand the Assignment",
      instructions: [
        normal("Once assigned, variables can be input to functions.\n"),
        normal("On a new line, input the variable into another function."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const assignedNodeIds = new Set(varNameToNodeIdMap.values());
        return compilation.DAG.getEdgeList().some((edge) =>
          assignedNodeIds.has(edge.srcNodeId),
        );
      },
    },
    {
      name: "Making a Statement",
      instructions: [
        normal("Stand-alone function calls and assignments are statements.\n"),
        normal("There should only be one statement per line,\n"),
        normal("unless separated by a semicolon ';'.\n"),
        normal("Statements are run in the order they appear.\n"),
        normal("Reorder the lines so the variable is assigned before used."),
      ],
      examples: [fast("g(x); h(x)")],
      successCondition: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const assignedNodeIds = new Set(varNameToNodeIdMap.values());
        return (
          compilation.DAG.getEdgeList().filter((edge) =>
            assignedNodeIds.has(edge.srcNodeId),
          ).length >= 2
        );
      },
    },
    {
      name: "Legal Aliases",
      instructions: [
        normal("Variables can be assigned to other variables.\n"),
        normal("The new variable is an alias for the original variable.\n"),
        normal("Uncomment the function calls to use the alias"),
      ],
      examples: [
        fast("long_variable_name = f()\n"),
        fast("alias = long_variable_name\n"),
        fast("// g(long_variable_name); h(alias)"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check AST for variable-to-variable assignment
        const hasVariableToVariableAssignment = compilation.AST.Statements.some(
          (stmt) => {
            if (stmt.Type !== NodeType.Assignment) return false;
            const assignment = stmt as AssignmentTreeNode;
            if (assignment.Lhs.length !== 1) return false;
            if (assignment.Rhs?.Type !== NodeType.QualifiedVariable) {
              return false;
            }
            return true;
          },
        );

        // Check DAG for alias usage
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount =
          createNodeIdToVarNameCount(varNameToNodeIdMap);
        const edgeList = compilation.DAG.getEdgeList();
        const hasAliasUsedInDAG = Array.from(
          nodeIdToVarNameCount.entries(),
        ).some(
          ([nodeId, count]) =>
            count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
        );

        return hasVariableToVariableAssignment && hasAliasUsedInDAG;
      },
    },
    {
      name: "Do the Splits",
      instructions: [
        normal("Multiple variables can be assigned in one statement.\n"),
        normal("Separate the variables with a comma ',' like x, y, z = f()\n"),
        normal("Uncomment the assignment below:"),
      ],
      examples: [
        fast("// yolk, white = split(egg())\n"),
        fast("whisk(yolk); whip(white)\n"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check AST for multi-variable assignment
        const hasMultiVariableAssignment = compilation.AST.Statements.some(
          (stmt) => {
            if (stmt.Type !== NodeType.Assignment) return false;
            const assignment = stmt as AssignmentTreeNode;
            return assignment.Lhs.length >= 2;
          },
        );

        // Check DAG for multiple variables referencing same node
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount =
          createNodeIdToVarNameCount(varNameToNodeIdMap);
        const edgeList = compilation.DAG.getEdgeList();
        const hasMultipleVarsInDAG = Array.from(
          nodeIdToVarNameCount.entries(),
        ).some(
          ([nodeId, count]) =>
            count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
        );

        return hasMultiVariableAssignment && hasMultipleVarsInDAG;
      },
    },
    {
      name: "Ace of Diamonds",
      instructions: [
        normal("Now you're thinking with formulas!\n"), // Portal
        normal("Formulas form DAGs (Directed Acyclic Graphs).\n"),
        ...dramatic("FUNCTION IS NODE"),
        ...dramatic("ARG IS EDGE"),
        ...dramatic("CODER IS YOU!"), // Baba is you
        normal("Make a 4-node diamond DAG to continue."),
      ],
      examples: [],
      clearEditorOnStart: true,
      successCondition: (compilation: Compilation) => {
        const nodeList = compilation.DAG.getNodeList();
        const edgeList = compilation.DAG.getEdgeList();

        if (nodeList.length < 4 || edgeList.length < 4) return false;

        const topNode = nodeList.find(
          (node) =>
            getInDegree(node.id, edgeList) === 0 &&
            getOutDegree(node.id, edgeList) === 2,
        );
        if (!topNode) return false;

        const bottomNode = nodeList.find(
          (node) =>
            getInDegree(node.id, edgeList) === 2 &&
            getOutDegree(node.id, edgeList) === 0,
        );
        if (!bottomNode) return false;

        const middleNodes = nodeList.filter(
          (node) =>
            getInDegree(node.id, edgeList) === 1 &&
            getOutDegree(node.id, edgeList) === 1,
        );
        if (middleNodes.length < 2) return false;

        return middleNodes.every(
          (node) =>
            edgeList.some(
              (e) => e.srcNodeId === topNode.id && e.destNodeId === node.id,
            ) &&
            edgeList.some(
              (e) => e.srcNodeId === node.id && e.destNodeId === bottomNode.id,
            ),
        );
      },
    },
  ];
  const assignmentModule = {
    name: "Assignment",
    puzzlets: assignmentPuzzlets,
  };

  // Style module
  const stylePuzzlets: Puzzlet[] = [
    {
      name: "Seeing Red",
      instructions: [
        normal("Functions can have styles to change node appearance.\n"),
        normal("Styles are defined in the { } to the right of a function.\n"),
        normal("Styles are denoted using 'key:value' pairs.\n"),
        normal("Keep to one 'key:value' pair per line unless ';' separated.\n"),
        normal("key is a (cytoscape.js) style property.\n"),
        normal("value is the (string|number|hex) value for that property.\n"),
        normal("Uncomment the styles to see node change."),
      ],
      examples: [
        fast("first() {\n"),
        fast("  //background-color: #FF0000\n"),
        fast('  //shape: "octagon"\n'),
        fast("  //outline-width: 1\n"),
        fast("}"),
      ],
      clearEditorOnStart: true,
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().some(
          (node) => node.styleProperties.size >= 3,
        );
      },
    },
    {
      name: "Getting Tagged",
      instructions: [
        normal("Styles can be defined using #tags.\n"),
        normal("Define style tags with a hashtag '#', tag name, and { }.\n"),
        normal("e.g. #my_tag { }\n"),
        normal("Uncomment the tag to apply its styles to the function."),
      ],
      examples: [
        fast("#easy {\n"),
        fast('  background-color: "green"\n'),
        fast('  shape: "ellipse"\n'),
        fast("}\n"),
        fast("second() {\n"),
        fast("  //#easy\n"),
        fast("}\n"),
      ],
      successCondition: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nodes = compilation.DAG.getNodeList();
        return getStyleTaggedNodes(flattenedStyles, nodes).length > 0;
      },
    },
    {
      name: "Mix and Match",
      instructions: [
        normal("Multiple tags can be specified in { }.\n"),
        normal("Tags should be separated by spaces ' '.\n"),
        normal("The styles from all tags in { } will be applied together.\n"),
        normal("Uncomment both style tags to apply their styles."),
      ],
      examples: [
        fast("#mix {\n"),
        fast('  background-color: "blue"\n'),
        fast("}\n"),
        fast("#match {\n"),
        fast('  shape: "rectangle"\n'),
        fast("}\n"),
        fast("third() {\n"),
        fast("  //#mix #match\n"),
        fast("}"),
      ],
      successCondition: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nodes = compilation.DAG.getNodeList();
        const nonEmptyTagCount = Array.from(flattenedStyles.values()).filter(
          (properties) => properties.size > 0,
        ).length;
        if (nonEmptyTagCount < 2) return false;
        return getStyleTaggedNodes(flattenedStyles, nodes).some(
          (node) => node.styleTags.length >= 2,
        );
      },
    },
    {
      name: "In Style",
      instructions: [
        normal("Styles tags can also be put in another style tag's { }.\n"),
        normal("Uncomment the nested style tag to apply its styles."),
      ],
      examples: [
        fast('#black { background-color: "black" }\n'),
        fast('#diamond { shape: "diamond" }\n'),
        fast("#hard {\n"),
        fast("  #black // #diamond\n"),
        fast("}\n"),
        fast("fourth() { #hard }\n"),
        fast("fourth_too() { #hard }\n"),
      ],
      successCondition: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nonEmptyTagCount = Array.from(flattenedStyles.values()).filter(
          (properties) => properties.size > 0,
        ).length;
        if (nonEmptyTagCount < 3) return false;

        const namedStyles = compilation.AST.Statements.filter(
          (stmt) => stmt.Type === NodeType.NamedStyle,
        ) as NamedStyleTreeNode[];

        const multiTagStyleNames = namedStyles
          .filter((style) => style.StyleNode.StyleTags.length >= 2)
          .map((style) => style.StyleName)
          .filter((styleName) => {
            const properties = flattenedStyles.get(styleName);
            return (properties?.size ?? 0) > 0;
          });

        const nodes = compilation.DAG.getNodeList();
        return multiTagStyleNames.some((styleName) => {
          const styledUsers = nodes.filter((node) =>
            node.styleTags.some((tag) => tag.join(".") === styleName),
          );
          return styledUsers.length >= 2;
        });
      },
    },
    {
      name: "Silver Lining",
      instructions: [
        normal("Styles can be applied to edges too.\n"),
        normal("Edge styles are defined in a variable's { }.\n"),
        normal("Uncomment the variables styles to see the changes."),
      ],
      examples: [
        fast("#s {\n"),
        fast("  //width: 4\n"),
        fast('  //line-color: "silver"\n'),
        fast('  //line-style: "dashed"\n'),
        fast("}\n"),
        fast("x{ #s } = fifth()\n"),
        fast("fifth_too(x)\n"),
      ],
      successCondition: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        return compilation.DAG.getEdgeList().some((edge) => {
          return edge.styleTags.some((tag) => {
            const tagKey = tag.join(".");
            const properties = flattenedStyles.get(tagKey);
            return (properties?.size ?? 0) >= 3;
          });
        });
      },
    },
    {
      name: "Put a Label on it",
      instructions: [
        normal("The 'label' style property will override the current name.\n"),
        normal("Extra labels can be shown by adding strings to a { }.\n"),
        normal("Uncomment the strings in { } to see the changes."),
      ],
      examples: [
        fast("sixth() {\n"),
        fast('  //"this extra label"\n'),
        fast('  //"spans two lines"\n'),
        fast("}\n"),
      ],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().some((node) => {
          const descriptionValue =
            node.styleProperties.get(DESCRIPTION_PROPERTY);
          return descriptionValue?.includes("\n") ?? false;
        });
      },
    },
    {
      name: "In a Bind",
      instructions: [
        normal("Style bindings associate style tags with keywords.\n"),
        normal("Define a binding with a percent sign '%', keyword, and { }.\n"),
        normal("e.g. %my_keyword{ }\n"),
        normal("Only style tags can be used in a binding's { }.\n"),
        normal("Functions and variables with the keyword as its name\n"),
        normal("will receive the keyword's bound styles.\n"),
        normal("Uncomment the function call to see the binding in action."),
      ],
      examples: [
        fast('#starry { background-color: "gold"; shape: "star" }\n'),
        fast("%star { #starry }\n\n"),
        fast("// star()\n"),
      ],
      successCondition: (compilation: Compilation) => {
        const bindings = compilation.DAG.getStyleBindings();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nodes = compilation.DAG.getNodeList();

        // Find bindings that have style tags with at least one property
        return Array.from(bindings.entries()).some(([keyword, styleTags]) => {
          // Check if at least one of this binding's style tags has properties
          const bindingHasProperties = styleTags.some((styleTag) => {
            const tagName = styleTag.join(".");
            const properties = flattenedStyles.get(tagName);
            return (properties?.size ?? 0) > 0;
          });
          if (!bindingHasProperties) return false;

          // Check if any node uses this binding
          return nodes.some((node) => node.name === keyword);
        });
      },
    },
  ];
  const styleModule = {
    name: "Style",
    puzzlets: stylePuzzlets,
  };

  // Outro module
  const outroPuzzlet: Puzzlet = {
    name: "The End of the Beginning",
    instructions: [
      slow("Congratulations! "),
      normal("You completed the tutorial!\n"),
      normal("Uncomment the exit() function to exit this tutorial."),
    ],
    examples: [fast("// exit()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().some((node) => node.name === "exit");
    },
  };
  const outroModule = {
    name: "Outro",
    puzzlets: [outroPuzzlet],
  };

  return new Lesson([
    introModule,
    functionsModule,
    assignmentModule,
    styleModule,
    outroModule,
  ]);
}
