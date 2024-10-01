// src/agent/npc/data.ts

interface Goal {
  name: string;
  quantity: number;
}

export class NPCData {
  goals: Goal[];
  curr_goal: Goal | null;
  built: { [key: string]: any };
  home: any;
  do_routine: boolean;
  do_set_goal: boolean;

  constructor() {
    this.goals = [];
    this.curr_goal = null;
    this.built = {};
    this.home = null;
    this.do_routine = false;
    this.do_set_goal = false;
  }

  toObject(): any {
    const obj: any = {};
    if (this.goals.length > 0) obj.goals = this.goals;
    if (this.curr_goal) obj.curr_goal = this.curr_goal;
    if (Object.keys(this.built).length > 0) obj.built = this.built;
    if (this.home) obj.home = this.home;
    obj.do_routine = this.do_routine;
    obj.do_set_goal = this.do_set_goal;
    return obj;
  }

  static fromObject(obj: any): NPCData {
    const npc = new NPCData();
    if (!obj) return npc;
    if (obj.goals) {
      npc.goals = [];
      for (const goal of obj.goals) {
        if (typeof goal === "string") {
          npc.goals.push({ name: goal, quantity: 1 });
        } else {
          npc.goals.push({ name: goal.name, quantity: goal.quantity });
        }
      }
    }
    if (obj.curr_goal) npc.curr_goal = obj.curr_goal;
    if (obj.built) npc.built = obj.built;
    if (obj.home) npc.home = obj.home;
    if (obj.do_routine !== undefined) npc.do_routine = obj.do_routine;
    if (obj.do_set_goal !== undefined) npc.do_set_goal = obj.do_set_goal;
    return npc;
  }
}
