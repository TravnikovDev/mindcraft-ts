import OpenAI from "openai"; // Correct import for default export
import { getKey, hasKey } from "../utils/keys.js";
import { ChatCompletionMessageParam } from "openai/resources/index.js";

interface GPTConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
}

export class GPT {
  private model_name: string;
  private openai: OpenAI;

  constructor(model_name: string, url?: string) {
    this.model_name = model_name;

    const config: GPTConfig = {
      apiKey: getKey("OPENAI_API_KEY"),
    };

    if (url) config.baseURL = url;

    if (hasKey("OPENAI_ORG_ID")) config.organization = getKey("OPENAI_ORG_ID");

    this.openai = new OpenAI(config);
  }

  async sendRequest(
    turns: ChatCompletionMessageParam[],
    systemMessage: string,
    stop_seq: string = "***"
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemMessage },
      ...turns,
    ];

    try {
      console.log("Awaiting OpenAI API response...");
      const completion = await this.openai.chat.completions.create({
        model: this.model_name || "gpt-3.5-turbo",
        messages: messages,
        stop: stop_seq,
      });

      if (completion.choices[0].finish_reason === "length") {
        throw new Error("Context length exceeded");
      }
      console.log("Received.");
      const content = completion.choices[0].message.content;
      if (content === null) {
        throw new Error("Received null content from OpenAI API");
      }
      return content;
    } catch (err: any) {
      if (
        (err.message === "Context length exceeded" ||
          err.code === "context_length_exceeded") &&
        turns.length > 1
      ) {
        console.log(
          "Context length exceeded, trying again with shorter context."
        );
        return await this.sendRequest(turns.slice(1), systemMessage, stop_seq);
      } else {
        console.error(err);
        return "My brain disconnected, try again.";
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    const embedding = await this.openai.embeddings.create({
      model: this.model_name || "text-embedding-ada-002",
      input: text,
    });
    return embedding.data[0].embedding;
  }
}
