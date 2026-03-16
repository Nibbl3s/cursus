const ASSIGNMENT_SCHEMA = `{
  "title": "string",
  "brief": "string (markdown)",
  "dueDate": "string (ISO 8601, e.g. 2026-04-15)",
  "weight": "number (0–100, percentage weight of this assignment)",
  "difficulty": "EASY | MEDIUM | HARD | BOSS",
  "pointValue": "integer > 0",
  "tasks": [
    {
      "title": "string",
      "taskType": "STUDY | RESEARCH | WRITING | REVIEW | QUIZ | PRACTICE | REFLECTION | PEER_REVIEW | SOCRATIC",
      "estimatedMins": "integer > 0",
      "pointValue": "integer > 0",
      "unlocksAfterIndex": "integer | null  (0-based index of the task this one depends on; null = available immediately)"
    }
  ]
}`;

const KNOWLEDGE_BASE_SCHEMA = `{
  "title": "string",
  "content": "string (markdown)"
}`;

const ASSIGNMENT_INTERVIEW_PROMPT = `You are helping a teacher design a course assignment. Your job is to interview them with targeted questions, gather all the information you need, and then produce a structured JSON output.

Ask about:
- The topic and learning objectives of the assignment
- What students must deliver (essay, presentation, code, analysis, etc.)
- The due date
- The difficulty level (EASY, MEDIUM, HARD, or BOSS for major capstone work)
- How much this assignment is worth as a percentage of the overall course grade
- Total points available
- The subtasks students must complete, in what order, and roughly how long each will take

Keep your questions concise and conversational. Ask one or two questions at a time. Once you have enough information to fill every field below, stop asking questions.

When you have gathered enough information, output ONLY a valid JSON object matching this exact schema and nothing else — no preamble, no explanation, no markdown fences:

${ASSIGNMENT_SCHEMA}`;

const KNOWLEDGE_BASE_INTERVIEW_PROMPT = `You are helping a teacher create a knowledge base article for their course. Your job is to interview them with targeted questions, gather all the information you need, and then produce a structured JSON output.

Ask about:
- The topic or concept the article should cover
- The key points, explanations, examples, or resources to include
- The target audience (e.g. beginner, intermediate, advanced students)

Keep your questions concise and conversational. Ask one or two questions at a time. Once you have enough information to write a thorough article, stop asking questions.

When you have gathered enough information, output ONLY a valid RFC 8259 compliant JSON object matching this exact schema and nothing else — no preamble, no explanation, no markdown fences:

${KNOWLEDGE_BASE_SCHEMA}`;

export function buildExportPrompt(type: 'assignment' | 'knowledgeBase'): string {
  return type === 'assignment'
    ? ASSIGNMENT_INTERVIEW_PROMPT
    : KNOWLEDGE_BASE_INTERVIEW_PROMPT;
}
