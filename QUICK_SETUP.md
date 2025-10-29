# Quick Setup Commands - NEPSE Trading Vite App

## 🚀 Run these commands in order:

```bash
# 1. Create new Vite project
npm create vite@latest nepse-trading-vite -- --template react-ts

# 2. Navigate to project
cd nepse-trading-vite

# 3. Install core dependencies
npm install

# 4. Install additional packages
npm install axios @tanstack/react-query zustand

# 5. Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# 6. Install UI utilities
npm install lucide-react clsx tailwind-merge

# 7. Initialize Tailwind
npx tailwindcss init -p

# 8. Start development server
npm run dev
```

## 📁 Open the new project in VS Code:
```bash
code nepse-trading-vite
```

Then follow the VITE_MIGRATION_GUIDE.md to complete the setup!

## 🎨 Golden Ratio Dark Mode Theme
The new app will have:
- ✨ Dark background (#0A0A0A)
- 🏆 Golden primary color (#D4AF37)
- 📊 Professional card layouts
- ⚡ Lightning-fast performance
- 🎯 No backend needed!

## 🔥 Features to Build:
1. Session Management (parse headers)
2. Live Price Monitor (real-time LTP)
3. Simple Order Placement
4. IPO Sniper (separate feature!)
5. Split Orders
6. Price Triggers
7. Stock Search

All with beautiful golden ratio spacing and dark mode! 🌙✨
