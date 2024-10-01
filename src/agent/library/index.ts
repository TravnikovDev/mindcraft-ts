import * as utility from "./utility";
import * as combat from "./combat";
import * as movement from "./movement";
import * as worldInteraction from "./worldInteraction";
import * as inventory from "./inventory";
import * as crafting from "./crafting";
import * as world from "./world.js";

interface NamedFunction extends Function {
  name: string;
}

export function docHelper(
  functions: NamedFunction[],
  module_name: string
): string {
  let docstring = "";
  for (const skillFunc of functions) {
    const str = skillFunc.toString();
    if (str.includes("/**")) {
      docstring += module_name + "." + skillFunc.name;
      docstring +=
        str.substring(str.indexOf("/**") + 3, str.indexOf("**/")) + "\n";
    }
  }
  return docstring;
}

export function getSkillDocs(): string {
  let docstring =
    "\n*SKILL DOCS\nThese skills are JavaScript functions that can be called when writing actions and skills.\n";
  docstring += docHelper(
    Object.values({
      ...utility,
      ...combat,
      ...movement,
      ...worldInteraction,
      ...inventory,
      ...crafting,
      ...world,
    }) as NamedFunction[],
    "skills"
  );
  docstring += docHelper(Object.values(world) as NamedFunction[], "world");
  return docstring + "*\n";
}
