import { describe, test, expect } from "vitest";
import { parseFromSource } from "src/compiler/driver";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  AliasTreeNode as Alias,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  StyleTreeNode as Style,
  NamedStyleTreeNode as NamedStyle,
  StyleBindingTreeNode as StyleBinding,
  NamespaceTreeNode as Namespace,
  ImportTreeNode as Import,
  BaseTreeNode,
} from "src/compiler/ast";

function makeTree(input: string): BaseTreeNode {
  return parseFromSource(input);
}

describe("inactive elements", () => {
  test("with empty string", () => {
    const input = "";
    expect(makeTree(input)).toEqual(new Recipe());
  });
  test("with whitespaces", () => {
    const input = " \n\t";
    expect(makeTree(input)).toEqual(new Recipe());
  });
  test("line comment", () => {
    const input = "// line comment";
    expect(makeTree(input)).toEqual(new Recipe());
  });
  test("block comment", () => {
    const input = "/* block comment */";
    expect(makeTree(input)).toEqual(new Recipe());
  });
});

describe("single statements", () => {
  test("call statement", () => {
    const input = "f(v)";
    expect(makeTree(input)).toEqual(
      new Recipe([new Call("f", [new QualifiedVariable(["v"])])]),
    );
  });
  test("variable statement", () => {
    const input = "x";
    expect(makeTree(input)).toEqual(new Recipe([new QualifiedVariable(["x"])]));
  });
  test("alias statement", () => {
    const input = "y = x";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Alias(new LocalVariable("y"), new QualifiedVariable(["x"])),
      ]),
    );
  });
  test("assignment statement", () => {
    const input = "a, b = c()";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment(
          [new LocalVariable("a"), new LocalVariable("b")],
          new Call("c", []),
        ),
      ]),
    );
  });
  test("assignment with anonymous namespace", () => {
    const input = "x = []";
    expect(makeTree(input)).toEqual(
      new Recipe([new Assignment([new LocalVariable("x")], new Namespace(""))]),
    );
  });
  test("assignment with namespace", () => {
    const input = "x = n[]";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new LocalVariable("x")], new Namespace("n", [])),
      ]),
    );
  });
  test("assignment with anonymous import", () => {
    const input = 'x = @"path"';
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new LocalVariable("x")], new Import("path")),
      ]),
    );
  });
  test("assignment with named import", () => {
    const input = 'x = n @ "path"';
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new LocalVariable("x")], new Import("path", "n")),
      ]),
    );
  });
  test("style declaration", () => {
    const input = "#s{}";
    expect(makeTree(input)).toEqual(new Recipe([new NamedStyle("s")]));
  });
  test("namespace declaration", () => {
    const input = "n[]";
    expect(makeTree(input)).toEqual(new Recipe([new Namespace("n")]));
  });
});

describe("style nodes", () => {
  test("basic style declaration", () => {
    const input = '#s{x:1px\ny:#abc\nz:"w"}';
    expect(makeTree(input)).toEqual(
      new Recipe([
        new NamedStyle(
          "s",
          new Style(
            new Map([
              ["x", "1px"],
              ["y", "#abc"],
              ["z", "w"],
            ]),
          ),
        ),
      ]),
    );
  });
  test("styled call", () => {
    const input = "f(){x:1}";
    expect(makeTree(input)).toEqual(
      new Recipe([new Call("f", [], new Style(new Map([["x", "1"]])))]),
    );
  });
  test("styled assignment", () => {
    const input = "a{b:1}, c{#d #e} = f()";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment(
          [
            new LocalVariable("a", new Style(new Map([["b", "1"]]))),
            new LocalVariable("c", new Style(undefined, [["d"], ["e"]])),
          ],
          new Call("f", []),
        ),
      ]),
    );
  });
  test("styled alias", () => {
    const input = "x{#y} = z";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Alias(
          new LocalVariable("x", new Style(undefined, [["y"]])),
          new QualifiedVariable(["z"]),
        ),
      ]),
    );
  });
  test("styled namespace", () => {
    const input = "n[]{#s}";
    expect(makeTree(input)).toEqual(
      new Recipe([new Namespace("n", [], [], new Style(undefined, [["s"]]))]),
    );
  });
  test("style with mixed types", () => {
    const input = "#s{a-b:1\nc--d:2;e_f:3,4,5\n #x #y; #z}";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new NamedStyle(
          "s",
          new Style(
            new Map([
              ["a-b", "1"],
              ["c--d", "2"],
              ["e_f", "3,4,5"],
            ]),
            [["x"], ["y"], ["z"]],
          ),
        ),
      ]),
    );
  });
  test("single description line", () => {
    const input = "f(){'test'}";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Call("f", [], new Style(new Map([[DESCRIPTION_PROPERTY, "test"]]))),
      ]),
    );
  });
  test("multiple description lines", () => {
    const input = 'f(){"one"\n"two"}';
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Call(
          "f",
          [],
          new Style(new Map([[DESCRIPTION_PROPERTY, "one\ntwo"]])),
        ),
      ]),
    );
  });
  test("description and properties", () => {
    const input = 'f(){foo:"bar"\n"test"}';
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Call(
          "f",
          [],
          new Style(
            new Map([
              [DESCRIPTION_PROPERTY, "test"],
              ["foo", "bar"],
            ]),
          ),
        ),
      ]),
    );
  });
});

describe("style bindings", () => {
  test("empty style binding", () => {
    const input = "%x{}";
    expect(makeTree(input)).toEqual(new Recipe([new StyleBinding("x", [])]));
  });
  test("style bind multiple styles", () => {
    const input = "%x{#a #b #c}";
    expect(makeTree(input)).toEqual(
      new Recipe([new StyleBinding("x", [["a"], ["b"], ["c"]])]),
    );
  });
});

describe("multiple statements", () => {
  test("newline separated", () => {
    const input = "y = f()\n x = y\n z(x)";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new LocalVariable("y")], new Call("f", [])),
        new Alias(new LocalVariable("x"), new QualifiedVariable(["y"])),
        new Call("z", [new QualifiedVariable(["x"])]),
      ]),
    );
  });
  test("semicolon seperated", () => {
    const input = "y=f();x=y;z(x)";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new LocalVariable("y")], new Call("f", [])),
        new Alias(new LocalVariable("x"), new QualifiedVariable(["y"])),
        new Call("z", [new QualifiedVariable(["x"])]),
      ]),
    );
  });
  test("namespace with multiple statements", () => {
    const input = "n[y=f();z=x](a, b()){#s}";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Namespace(
          "n",
          [
            new Assignment([new LocalVariable("y")], new Call("f", [])),
            new Alias(new LocalVariable("z"), new QualifiedVariable(["x"])),
          ],
          [new QualifiedVariable(["a"]), new Call("b", [])],
          new Style(undefined, [["s"]]),
        ),
      ]),
    );
  });
});

describe("import statements", () => {
  test("import statement", () => {
    const input = 'n @ "path"';
    expect(makeTree(input)).toEqual(new Recipe([new Import("path", "n")]));
  });
  test("import statement with no alias", () => {
    const input = '@ "path"';
    expect(makeTree(input)).toEqual(new Recipe([new Import("path")]));
  });
  test("import statement with url path", () => {
    const testUrl = "https://github.com/formulavize";
    const input = `n @ "${testUrl}"`;
    expect(makeTree(input)).toEqual(new Recipe([new Import(testUrl, "n")]));
  });
  test("import statement in namespace", () => {
    const input = 'n[@"test"]';
    expect(makeTree(input)).toEqual(
      new Recipe([new Namespace("n", [new Import("test")])]),
    );
  });
});

describe("incomplete statements", () => {
  test("incomplete assignment", () => {
    const input = "y=f(";
    expect(makeTree(input)).toEqual(
      new Recipe([new Assignment([new LocalVariable("y")], new Call("f", []))]),
    );
  });
  test("incomplete nested call", () => {
    const input = "x=y //test \ny=f(\n\t z()";
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Alias(new LocalVariable("x"), new QualifiedVariable(["y"])),
        new Assignment(
          [new LocalVariable("y")],
          new Call("f", [new Call("z", [])]),
        ),
      ]),
    );
  });
  test("incomplete style", () => {
    const input = "f(){x:1";
    expect(makeTree(input)).toEqual(
      new Recipe([new Call("f", [], new Style(new Map([["x", "1"]])))]),
    );
  });
  test("incomplete style binding", () => {
    const input = "%x";
    expect(makeTree(input)).toEqual(new Recipe([new StyleBinding("x", [])]));
  });
  test("incomplete namespace", () => {
    const input = "n[";
    expect(makeTree(input)).toEqual(new Recipe([new Namespace("n")]));
  });
  test("incomplete import", () => {
    const input = "@";
    expect(makeTree(input)).toEqual(new Recipe([new Import("")]));
  });
  test("import statement with no path", () => {
    const input = "n @";
    expect(makeTree(input)).toEqual(new Recipe([new Import("", "n")]));
  });
});
