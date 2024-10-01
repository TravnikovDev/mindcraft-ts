interface Turn {
  role: string;
  content: string;
}

export function stringifyTurns(turns: Turn[]): string {
  let res = "";
  for (const turn of turns) {
    if (turn.role === "assistant") {
      res += `\nYour output:\n${turn.content}`;
    } else if (turn.role === "system") {
      res += `\nSystem output: ${turn.content}`;
    } else {
      res += `\nUser input: ${turn.content}`;
    }
  }
  return res.trim();
}

export function toSinglePrompt(
  turns: Turn[],
  system: string | null = null,
  stop_seq = "***",
  model_nickname = "assistant"
): string {
  let prompt = system ? `${system}${stop_seq}` : "";
  let role = "";
  for (const message of turns) {
    role = message.role;
    if (role === "assistant") role = model_nickname;
    prompt += `${role}: ${message.content}${stop_seq}`;
  }
  if (role !== model_nickname) {
    prompt += `${model_nickname}: `;
  }
  return prompt;
}

// Ensures stricter turn order for specific models
// Combines repeated messages from the same role, separates repeated assistant messages with filler user messages
export function strictFormat(turns: Turn[]): Turn[] {
  let prev_role: string | null = null;
  const messages: Turn[] = [];
  const filler: Turn = { role: "user", content: "_" };
  for (const msg of turns) {
    msg.content = msg.content.trim();
    if (msg.role === "system") {
      msg.role = "user";
      msg.content = "SYSTEM: " + msg.content;
    }
    if (msg.role === prev_role && msg.role === "assistant") {
      // Insert empty user message to separate assistant messages
      messages.push(filler);
      messages.push(msg);
    } else if (msg.role === prev_role) {
      // Combine new message with previous message instead of adding a new one
      messages[messages.length - 1].content += "\n" + msg.content;
    } else {
      messages.push(msg);
    }
    prev_role = msg.role;
  }
  if (messages.length > 0 && messages[0].role !== "user") {
    messages.unshift(filler); // Some models require user message to start
  }
  if (messages.length === 0) {
    messages.push(filler);
  }
  return messages;
}
