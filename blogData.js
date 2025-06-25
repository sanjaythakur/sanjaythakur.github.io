// Blog posts data
const blogPosts = [
  {
    "title": "Peace Through Power: India's Defence Tech Moment",
    "date": "June 25, 2025",
    "category": "Defence & Technology",
    "excerpt": "India must urgently invest in next-generation defence technologies. Our priorities can be thought of as a kind of civilizational Maslow's hierarchy—from defending our borders to contributing to global safety and technological progress.",
    "file": "posts/peace-through-strength.html"
  },
  {
    "title": "Be a Markov State - A Lesson for Life",
    "date": "May 20, 2025",
    "category": "AI",
    "excerpt": "Of course, life isn't a perfect Markov process. Our states are often colored by complex histories. But as a mental model, it's empowering. It shifts our focus from helplessness to agency, from nostalgia or guilt to responsibility.",
    "file": "posts/be-a-markov-state.html"
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