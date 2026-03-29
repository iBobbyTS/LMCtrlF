export const projects = [
  {
    name: "Software Design Course",
    description: "Lecture notes, rubrics, and assignment briefs for ENSF 400.",
    documents: 4
  },
  {
    name: "Contract Review",
    description: "Policy documents and contract clauses grouped for comparison.",
    documents: 3
  },
  {
    name: "Research References",
    description: "Long-form papers prepared for citation-backed question answering.",
    documents: 5
  }
];

export const documents = [
  {
    name: "Assignment3_ENSF400_L02_Group01.pdf",
    type: "PDF",
    project: "Software Design Course",
    status: "Indexed",
    updatedAt: "Mar 29"
  },
  {
    name: "Course_Project_Rubric.txt",
    type: "TXT",
    project: "Software Design Course",
    status: "Ready",
    updatedAt: "Mar 28"
  },
  {
    name: "Vendor_SLA_Review.pdf",
    type: "PDF",
    project: "Contract Review",
    status: "Queued",
    updatedAt: "Mar 27"
  },
  {
    name: "Retrieval_Notes.pdf",
    type: "PDF",
    project: "Research References",
    status: "Indexed",
    updatedAt: "Mar 25"
  }
];

export const importJobs = [
  {
    name: "Vendor_SLA_Review.pdf",
    status: "Parsing text",
    progress: 42
  },
  {
    name: "Course_Project_Rubric.txt",
    status: "Ready for indexing",
    progress: 100
  },
  {
    name: "Assignment3_ENSF400_L02_Group01.pdf",
    status: "Embedding complete",
    progress: 100
  }
];

export const chatMessages = [
  {
    id: "m1",
    role: "User",
    content: "Summarize the required desktop pages defined by the assignment materials."
  },
  {
    id: "m2",
    role: "Assistant",
    content:
      "The assignment material defines three primary desktop pages: document management, chat, and configuration. The document and configuration pages support import and provider setup, while the chat page is the main question-answering surface."
  },
  {
    id: "m3",
    role: "User",
    content: "What guidance should the app show about response quality?"
  },
  {
    id: "m4",
    role: "Assistant",
    content:
      "The interface should remind users that LLM responses are not always correct and that the original document should be checked for the most accurate answer."
  }
];

export const citations = [
  {
    id: "c1",
    title: "System Features",
    source: "Assignment1_ENSF400_L02_Group01.md",
    snippet:
      "The user interface must contain three main pages: document/project management, chat, and configurations."
  },
  {
    id: "c2",
    title: "Usability and Progress Display",
    source: "Assignment1_ENSF400_L02_Group01.md",
    snippet:
      "The system should show indexing, searching, and response progress, and help users understand what the application is doing."
  },
  {
    id: "c3",
    title: "Accuracy Requirement",
    source: "Assignment1_ENSF400_L02_Group01.md",
    snippet:
      "The application should warn users that the LLM is not always correct and that the original document should be checked."
  }
];

export const localProfiles = [
  {
    name: "LM Studio",
    status: "Preferred",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "qwen2.5-7b-instruct",
    note: "Recommended for local-first testing with an OpenAI-compatible endpoint."
  },
  {
    name: "Offline Classroom Runtime",
    status: "Draft",
    baseUrl: "http://localhost:8008/v1",
    model: "mistral-small",
    note: "Use only when the machine has sufficient memory and GPU resources."
  }
];

export const cloudProfiles = [
  {
    name: "OpenAI-Compatible Cloud",
    status: "Connected",
    baseUrl: "https://api.example-provider.com/v1",
    apiKeyPreview: "sk-••••••••••••",
    model: "gpt-4.1-mini",
    note: "Best for consistent latency and stronger responses when internet access is available."
  },
  {
    name: "Budget Research Endpoint",
    status: "Needs Review",
    baseUrl: "https://api.alt-models.dev/v1",
    apiKeyPreview: "rk-••••••••••••",
    model: "deepseek-v3.2",
    note: "Lower cost, but model availability and usage terms should be reviewed carefully."
  }
];

export const hardwareTiers = [
  {
    title: "Minimum Local Setup",
    memory: "8GB GPU memory",
    description: "Suitable for small local models, with slower indexing and answer quality trade-offs."
  },
  {
    title: "Comfortable Desktop Setup",
    memory: "16GB to 32GB memory",
    description: "Supports stronger local models and more responsive document workflows."
  },
  {
    title: "High-Performance Setup",
    memory: "32GB+ unified or GPU memory",
    description: "Best choice for larger local models and sustained document indexing workloads."
  }
];

export const accessibilityOptions = [
  {
    name: "Dark Mode",
    description: "Keep extended reading sessions comfortable and maintain contrast in low-light environments.",
    state: "Enabled"
  },
  {
    name: "Text to Speech",
    description: "Reserved for future voice playback of answers and highlighted source text.",
    state: "Planned"
  },
  {
    name: "Tooltip Guidance",
    description: "Surface contextual explanations for import steps, provider setup, and warnings.",
    state: "Enabled"
  }
];
