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
