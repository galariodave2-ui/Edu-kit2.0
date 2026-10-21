const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'Edu-Kit API', status: 'online' });
});

let courses = [
  {
    id: 'c1',
    title: 'Introduction to Computer Science',
    category: 'Technology',
    instructor: 'Dr. Sarah Connor',
    lessonsCount: 12,
    description: 'Learn fundamental concepts of algorithms, data structures, and software design.'
  },
  {
    id: 'c2',
    title: 'Mathematics for Data Science',
    category: 'Mathematics',
    instructor: 'Prof. Alan Turing',
    lessonsCount: 10,
    description: 'Master linear algebra, calculus, and probability for modern analytical modeling.'
  }
];

let flashcards = [
  { id: 'f1', question: 'What is Time Complexity?', answer: 'A measure of the amount of time an algorithm takes to run as a function of input size.' },
  { id: 'f2', question: 'What is a REST API?', answer: 'An architectural style for designing networked applications using standard HTTP operations.' },
  { id: 'f3', question: 'What is state in React?', answer: 'A built-in object used to store component data that may change over time.' }
];

let quizzes = [
  {
    id: 'q1',
    title: 'Data Structures Baseline Quiz',
    questions: [
      {
        id: 1,
        question: 'Which data structure operates on a LIFO (Last In First Out) principle?',
        options: ['Queue', 'Stack', 'Array', 'Linked List'],
        answer: 1
      },
      {
        id: 2,
        question: 'What is the time complexity of array lookup by index?',
        options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'],
        answer: 2
      }
    ]
  }
];

let resources = [
  { id: 'r1', title: 'Data Structures Cheat Sheet', type: 'PDF', url: 'https://example.com/ds-cheatsheet.pdf' },
  { id: 'r2', title: 'Calculus Reference Guide', type: 'DOCX', url: 'https://example.com/calculus-guide.docx' }
];

router.get('/courses', (req, res) => {
  res.json({ success: true, data: courses });
});

router.post('/courses', (req, res) => {
  const { title, category, instructor, lessonsCount, description } = req.body;
  if (!title || !category || !instructor) {
    return res.status(400).json({ success: false, message: 'Title, category, and instructor are required.' });
  }
  const newCourse = {
    id: `c${courses.length + 1}`,
    title,
    category,
    instructor,
    lessonsCount: parseInt(lessonsCount) || 0,
    description: description || ''
  };
  courses.push(newCourse);
  res.status(201).json({ success: true, data: newCourse });
});

router.get('/flashcards', (req, res) => {
  res.json({ success: true, data: flashcards });
});

router.get('/quizzes', (req, res) => {
  res.json({ success: true, data: quizzes });
});

router.post('/quizzes/submit', (req, res) => {
  const { quizId, answers } = req.body;
  const quiz = quizzes.find((q) => q.id === quizId);
  if (!quiz) {
    return res.status(404).json({ success: false, message: 'Quiz not found.' });
  }

  let score = 0;
  quiz.questions.forEach((q) => {
    if (answers && answers[q.id] === q.answer) {
      score += 1;
    }
  });

  res.json({
    success: true,
    score,
    total: quiz.questions.length,
    percentage: Math.round((score / quiz.questions.length) * 100)
  });
});

router.get('/resources', (req, res) => {
  res.json({ success: true, data: resources });
});

module.exports = router;