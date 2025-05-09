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
    "title": "Book Reviews",
    "date": "July 25, 2025",
    "category": "AI",
    "excerpt": "As AI tutoring systems become increasingly sophisticated, we need new ways to evaluate their effectiveness. The classic Turing Test asks if a machine can imitate human conversation, but for educational AI, we need different metrics altogether.",
    "file": "posts/book-reviews.html",
  },
  {
    "title": "Start being fit when young, thank me later",
    "date": "July 25, 2025",
    "category": "AI",
    "excerpt": "As AI tutoring systems become increasingly sophisticated, we need new ways to evaluate their effectiveness. The classic Turing Test asks if a machine can imitate human conversation, but for educational AI, we need different metrics altogether.",
    "file": "posts/start-being-fit-when-young-thank-me-later.html",
  },
  {
    "title": "Be a Markov State - A Lesson for Life",
    "date": "July 25, 2025",
    "category": "AI",
    "excerpt": "As AI tutoring systems become increasingly sophisticated, we need new ways to evaluate their effectiveness. The classic Turing Test asks if a machine can imitate human conversation, but for educational AI, we need different metrics altogether.",
    "file": "posts/be-a-markov-state.html",
  },
  {
    "title": "Movie/Series Review",
    "date": "July 25, 2025",
    "category": "AI",
    "excerpt": "As AI tutoring systems become increasingly sophisticated, we need new ways to evaluate their effectiveness. The classic Turing Test asks if a machine can imitate human conversation, but for educational AI, we need different metrics altogether.",
    "file": "posts/movie-review.html",
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