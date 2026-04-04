export type MessageRole = "user" | "assistant";

export interface ThreadMessage {
  id: string;
  role: MessageRole;
  content: string;
}

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  summary: string;
  messages: ThreadMessage[];
}

export interface ProviderDraft {
  id: "lm-studio" | "openai" | "anthropic";
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AccessibilityOption {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const providerProfiles: ProviderDraft[] = [
  {
    id: "lm-studio",
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "qwen/qwen3-8b",
    apiKey: "lm-studio"
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    apiKey: "sk-live-••••••••"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    apiKey: "sk-ant-••••••••"
  }
];

export const accessibilityOptions: AccessibilityOption[] = [
  {
    id: "reduce-motion",
    label: "Reduce motion",
    description: "Limit non-essential transitions in the library and chat views.",
    enabled: false
  },
  {
    id: "high-contrast",
    label: "High contrast surfaces",
    description: "Increase separation between cards, tables, and message bubbles.",
    enabled: true
  },
  {
    id: "larger-text",
    label: "Larger reading text",
    description: "Use larger body text in long document and chat surfaces.",
    enabled: false
  }
];
