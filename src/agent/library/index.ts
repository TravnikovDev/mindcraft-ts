export * from "./utility";
export * from "./combat";
export * from "./movement";
export * from "./worldInteraction";
export * from "./inventory";
export * from "./crafting";
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
  docstring += docHelper(Object.values(skills) as NamedFunction[], "skills");
  docstring += docHelper(Object.values(world) as NamedFunction[], "world");
  return docstring + "*\n";
}
