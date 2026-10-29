# Purdue Meal Rec

Ranks Purdue dining hall foods by nutritional efficiency (calories per gram of protein or fiber) so students can find the best protein sources on campus.

**Demo:** https://purduemealrec.onrender.com/

(Free-tier hosting spins down after inactivity — the first load may take 30-50s to wake up.)

## Features

- **Today** and **Week** views: the week shows the next 7 days side by side, top 10 foods per day, so you can plan where to eat.
- Filter by dining court, Lunch/Dinner, and sort by protein or fiber. Courts are color coded.
- Earhart's build-your-own stir fry is ranked using its beef and chicken ingredients (🐄 / 🐔), and shown in the week header on days it has them.
- Meat items the dining halls publish no nutrition for are listed at the top of each day in the Week view, without numbers.
- Hide foods you'd never eat with the ✕ button (saved in your browser). Light and dark themes.
- Menu data is cached on the server for 15 minutes; the Refresh button forces a reload (at most once a minute).

## Running locally

```bash
npm install
npm start
```

Then open http://localhost:3000.
