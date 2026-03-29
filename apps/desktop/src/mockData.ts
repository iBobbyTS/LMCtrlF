export type FileStatus = "Queued" | "Indexing" | "Ready" | "File changed" | "File updated";
export type MessageRole = "user" | "assistant";

export interface ProjectSummary {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  updatedAt: string;
  shelfLabel: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  status: FileStatus;
  progress?: number;
}

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

export const projects: ProjectSummary[] = [
  {
    id: "project-atlas",
    name: "Atlas Reader",
    tagline: "Competitive research, client notes, and launch references.",
    accent: "#c2410c",
    updatedAt: "Edited 15 minutes ago",
    shelfLabel: "Launch set"
  },
  {
    id: "project-margin",
    name: "Margin Notes",
    tagline: "Internal reviews, editorial notes, and decision logs.",
    accent: "#14532d",
    updatedAt: "Edited yesterday",
    shelfLabel: "Editorial"
  },
  {
    id: "project-orbit",
    name: "Orbit Archive",
    tagline: "Vendor packets, proposals, and archived field reports.",
    accent: "#1d4ed8",
    updatedAt: "Edited 3 days ago",
    shelfLabel: "Archive"
  }
];

export const projectDocuments: Record<string, ProjectDocument[]> = {
  "project-atlas": [
    { id: "doc-1", name: "launch-overview.pdf", status: "Ready" },
    { id: "doc-2", name: "editorial-calendar.txt", status: "Queued" },
    { id: "doc-3", name: "market-scan.pdf", status: "Indexing", progress: 64 },
    { id: "doc-4", name: "feature-requests.txt", status: "File changed" },
    { id: "doc-5", name: "stakeholder-notes.pdf", status: "File updated" }
  ],
  "project-margin": [
    { id: "doc-6", name: "copy-guidelines.pdf", status: "Ready" },
    { id: "doc-7", name: "weekly-summary.txt", status: "Ready" }
  ],
  "project-orbit": [
    { id: "doc-8", name: "vendor-landscape.pdf", status: "Ready" },
    { id: "doc-9", name: "security-checklist.txt", status: "Queued" }
  ]
};

export const projectThreads: Record<string, ChatThread[]> = {
  "project-atlas": [
    {
      id: "thread-1",
      title: "Launch summary",
      updatedAt: "2 minutes ago",
      summary: "Draft the quick brief for the kickoff call.",
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content:
            "I can help you turn this project library into a concise launch brief. Start by asking for a summary, timeline, or risk review."
        },
        {
          id: "message-2",
          role: "user",
          content: "Summarize the key documents I should review before the kickoff."
        },
        {
          id: "message-3",
          role: "assistant",
          content:
            "Start with launch-overview.pdf for the narrative, market-scan.pdf for positioning, and stakeholder-notes.pdf for open questions that still need alignment."
        }
      ]
    },
    {
      id: "thread-2",
      title: "Risk review",
      updatedAt: "25 minutes ago",
      summary: "Collect blockers and follow-up items before indexing finishes.",
      messages: [
        {
          id: "message-4",
          role: "assistant",
          content:
            "The current blockers are tied to files waiting for reindexing and one market scan still in progress. Use this thread to list anything that needs escalation."
        }
      ]
    }
  ],
  "project-margin": [
    {
      id: "thread-3",
      title: "Editorial review",
      updatedAt: "Yesterday",
      summary: "Track editing decisions and tone changes.",
      messages: [
        {
          id: "message-5",
          role: "assistant",
          content:
            "This project is ready for question answering. Ask for terminology checks, change summaries, or a quick table of approved wording."
        }
      ]
    }
  ],
  "project-orbit": [
    {
      id: "thread-4",
      title: "Procurement questions",
      updatedAt: "3 days ago",
      summary: "Keep vendor evaluation notes in one place.",
      messages: [
        {
          id: "message-6",
          role: "assistant",
          content:
            "Ask about vendor deltas, procurement timelines, or missing evidence once the latest files are indexed."
        }
      ]
    }
  ]
};

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
