import { cosineSimilarity } from "./math.js";
import { stringifyTurns } from "./text.js";

interface Turn {
  role: string;
  content: string;
}

interface Model {
  embed(text: string): Promise<number[]>;
}

export class Examples {
  private examples: Turn[][] = [];
  private model: Model | null;
  private select_num: number;
  private embeddings: Record<string, number[]> = {};

  constructor(model: Model | null, select_num = 2) {
    this.model = model;
    this.select_num = select_num;
  }

  private turnsToText(turns: Turn[]): string {
    let messages = "";
    for (const turn of turns) {
      if (turn.role !== "assistant") {
        messages +=
          turn.content.substring(turn.content.indexOf(":") + 1).trim() + "\n";
      }
    }
    return messages.trim();
  }

  private getWords(text: string): string[] {
    return text
      .replace(/[^a-zA-Z ]/g, "")
      .toLowerCase()
      .split(" ");
  }

  private wordOverlapScore(text1: string, text2: string): number {
    const words1 = this.getWords(text1);
    const words2 = this.getWords(text2);
    const intersection = words1.filter((word) => words2.includes(word));
    return (
      intersection.length /
      (words1.length + words2.length - intersection.length)
    );
  }

  async load(examples: Turn[][]): Promise<void> {
    this.examples = examples;
    if (this.model !== null) {
      const embeddingPromises = this.examples.map(async (example) => {
        const turn_text = this.turnsToText(example);
        this.embeddings[turn_text] = await this.model!.embed(turn_text);
      });
      await Promise.all(embeddingPromises);
    }
  }

  private async getRelevant(turns: Turn[]): Promise<Turn[][]> {
    const turn_text = this.turnsToText(turns);
    if (this.model !== null) {
      const embedding = await this.model.embed(turn_text);
      this.examples.sort(
        (a, b) =>
          cosineSimilarity(embedding, this.embeddings[this.turnsToText(b)]) -
          cosineSimilarity(embedding, this.embeddings[this.turnsToText(a)])
      );
    } else {
      this.examples.sort(
        (a, b) =>
          this.wordOverlapScore(turn_text, this.turnsToText(b)) -
          this.wordOverlapScore(turn_text, this.turnsToText(a))
      );
    }
    return this.examples
      .slice(0, this.select_num)
      .map((example) => [...example]); // deep copy
  }

  async createExampleMessage(turns: Turn[]): Promise<string> {
    const selected_examples = await this.getRelevant(turns);

    console.log("Selected examples:");
    for (const example of selected_examples) {
      console.log(example[0].content);
    }

    let msg = "Examples of how to respond:\n";
    for (let i = 0; i < selected_examples.length; i++) {
      const example = selected_examples[i];
      msg += `Example ${i + 1}:\n${stringifyTurns(example)}\n\n`;
    }
    return msg;
  }
}
