# **App Name**: NeutralEdu AI

## Core Features:

- PDF Upload: Allow users to upload PDF documents for summarization.
- AI-Powered Summarization: Use the Gemini API to summarize the text extracted from the uploaded PDF, tailoring the summary for student comprehension. Summary should include simplified explanations, bullet points of key ideas, main concepts, potential exam questions and relevant examples if needed (only include when necessary, AI should decide).
- Summary Display: Display the generated summary in a clean and readable UI format. Optionally allow download as PDF and save to Firebase Storage.
- User Authentication: Use Firebase Authentication (email + password) to manage login/signup. On registration, store the following in Firestore: uid, plan, dailyRemainingQuota, lastSummaryDate.
- Quota Control & Display: Show user's daily remaining summarization quota on dashboard. Before summarization, check plan type & remaining quota. If quota exceeded, display an error message. After each summary, decrease quota by 1 and update lastSummaryDate in Firestore.

## Style Guidelines:

- Dark Theme
- Primary Color: #8A2BE2 or #9b59b6
- Background: #000000 (black)
- Cards: #1e1e1e (dark gray)
- Accent Color: #E6E6FA (lavender)
- Modern & clean fonts (e.g., Inter, Roboto, Poppins)
- Tailwind CSS or Material UI
- Grid-based layout for responsiveness
- Subtle transitions & hover effects
- Minimalist icons (e.g., HeroIcons, Lucide)