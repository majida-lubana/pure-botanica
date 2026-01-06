// server.js

// ✅ This loads immediately as a side-effect (not hoisted)
import 'dotenv/config';

import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin/login`);
  console.log(`User Site: http://localhost:${PORT}/`);
});