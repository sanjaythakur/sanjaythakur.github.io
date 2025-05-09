// Blog posts data
const blogPosts = [
  {
    "title": "Turing Test for AI Tutors",
    "date": "July 25, 2025",
    "category": "AI",
    "excerpt": "As AI tutoring systems become increasingly sophisticated, we need new ways to evaluate their effectiveness. The classic Turing Test asks if a machine can imitate human conversation, but for educational AI, we need different metrics altogether.",
    "file": "posts/ai-tutor-turing-test.html",
    "tags": ["AI", "education", "Turing Test", "AI Tutors"]
  },
  {
    "title": "The Art of Minimalism",
    "date": "July 10, 2023",
    "category": "Lifestyle",
    "excerpt": "Minimalism isn't just about having fewer possessions; it's a mindset that can transform how we approach life, work, and creativity.",
    "file": "posts/post 2.html",
    "tags": ["minimalism", "lifestyle", "design", "simplicity"]
  },
  {
    "title": "Modern Web Development Techniques",
    "date": "June 25, 2023",
    "category": "Technology",
    "excerpt": "Exploring the latest trends and techniques in modern web development, including responsive design, accessibility, and performance optimization.",
    "file": "posts/modern-web-development.html",
    "tags": ["web development", "coding", "technology", "responsive design"]
  },
  {
    "title": "Minimalism in Digital Design",
    "date": "June 20, 2023",
    "category": "Design",
    "excerpt": "How minimalist principles can be applied to create clean, user-friendly digital interfaces that focus on content and user experience.",
    "file": "posts/minimalism-design.html",
    "tags": ["design", "minimalism", "user experience", "interfaces"]
  },
  {
    "title": "Finding Balance in a Digital World",
    "date": "June 15, 2023",
    "category": "Lifestyle",
    "excerpt": "Strategies for maintaining a healthy relationship with technology while staying connected and productive in an increasingly digital world.",
    "file": "posts/digital-balance.html",
    "tags": ["digital life", "balance", "productivity", "mindfulness"]
  },
  {
    "title": "The Future of Artificial Intelligence",
    "date": "June 10, 2023",
    "category": "Technology",
    "excerpt": "Exploring how AI is changing our world and what developments we might expect to see in the coming years across various industries.",
    "file": "posts/ai-future.html",
    "tags": ["AI", "technology", "future", "innovation"]
  },
  {
    "title": "Capturing Moments: A Guide to Better Photography",
    "date": "June 5, 2023",
    "category": "Photography",
    "excerpt": "Tips and techniques for improving your photography skills, from composition and lighting to editing and sharing your work.",
    "file": "posts/photography-guide.html",
    "tags": ["photography", "creativity", "techniques", "visual arts"]
  },
  {
    "title": "The Psychology of Color in Design",
    "date": "May 30, 2023",
    "category": "Design",
    "excerpt": "How color choices affect user perception and behavior, and how to use color psychology to create more effective designs.",
    "file": "posts/color-psychology.html",
    "tags": ["design", "color theory", "psychology", "user experience"]
  },
  {
    "title": "Building Sustainable Habits",
    "date": "May 25, 2023",
    "category": "Lifestyle",
    "excerpt": "A framework for creating and maintaining positive habits that stick, based on behavioral science and practical experience.",
    "file": "posts/sustainable-habits.html",
    "tags": ["habits", "productivity", "personal growth", "psychology"]
  },
  {
    "title": "The Rise of No-Code Development",
    "date": "May 20, 2023",
    "category": "Technology",
    "excerpt": "How no-code tools are democratizing software creation and changing the landscape of what's possible without traditional programming.",
    "file": "posts/no-code-development.html",
    "tags": ["no-code", "technology", "development", "tools"]
  }
];

// Helper function to parse date strings
function parseDate(dateString) {
  const months = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
    'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
  };
  
  const parts = dateString.split(' ');
  const month = months[parts[0]];
  const day = parseInt(parts[1].replace(',', ''));
  const year = parseInt(parts[2]);
  
  return new Date(year, month, day);
}

// Helper function to sort posts by date (newest first)
function sortPostsByDate(posts) {
  return [...posts].sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    return dateB - dateA;
  });
}

// Helper function to get the most recent N posts
function getRecentPosts(count = 2) {
  return sortPostsByDate(blogPosts).slice(0, count);
} 