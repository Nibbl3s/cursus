export interface WorldTheme {
  id: string;
  name: string;
  description: string;
  palette: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    textMuted: string;
    success: string;
    danger: string;
  };
  vocabulary: {
    // Core nouns
    assignment: string;
    assignments: string;
    task: string;
    tasks: string;
    deadline: string;
    deadlines: string;
    habit: string;
    habits: string;
    points: string;
    level: string;
    streak: string;
    mentor: string;
    profile: string;
    // Difficulty labels
    easy: string;
    medium: string;
    hard: string;
    boss: string;
    // UI sections
    dashboardGreeting: string;
    questBoard: string;
    knowledgeCheck: string;
    board: string;
    // Flavor
    dailyQuote: string[];
    mentorAvatar: string;
    completionMessage: string;
  };
  cssTheme: string;
}
