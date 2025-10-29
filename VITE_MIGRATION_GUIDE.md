# 🚀 Vite Migration Guide - NEPSE Trading Assistant

## Overview
Migrate from Express.js backend to a lightweight Vite React application with dark mode and golden ratio color palette.

---

## 📦 Step 1: Create New Vite Project

Open a terminal in a new folder and run:

```bash
# Create new Vite + React + TypeScript project
npm create vite@latest nepse-trading-vite -- --template react-ts

# Navigate to project
cd nepse-trading-vite

# Install dependencies
npm install

# Install additional packages
npm install axios @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react clsx tailwind-merge

# Initialize Tailwind CSS
npx tailwindcss init -p
```

---

## 🎨 Step 2: Configure Tailwind CSS (Golden Ratio Palette)

**tailwind.config.js:**
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Golden Ratio Palette (Dark Mode Optimized)
        primary: {
          50: '#FFF9E6',
          100: '#FFF0B3',
          200: '#FFE680',
          300: '#FFDD4D',
          400: '#FFD31A',
          500: '#D4AF37',  // Golden
          600: '#B8942F',
          700: '#9C7A27',
          800: '#80601F',
          900: '#644617',
        },
        dark: {
          50: '#F5F5F5',
          100: '#E0E0E0',
          200: '#BDBDBD',
          300: '#9E9E9E',
          400: '#757575',
          500: '#616161',
          600: '#424242',
          700: '#303030',
          800: '#212121',
          900: '#0A0A0A',
          950: '#000000',
        },
        accent: {
          green: '#3FB950',  // Success/Buy
          red: '#F85149',    // Error/Sell
          blue: '#58A6FF',   // Info
          purple: '#BC8CFF', // Special
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      spacing: {
        // Golden ratio spacing
        'gr-xs': '0.382rem',  // φ⁻³
        'gr-sm': '0.618rem',  // φ⁻²
        'gr-md': '1rem',      // φ⁰
        'gr-lg': '1.618rem',  // φ¹
        'gr-xl': '2.618rem',  // φ²
        'gr-2xl': '4.236rem', // φ³
      },
    },
  },
  plugins: [],
}
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-dark-900 text-dark-50;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-all duration-200;
  }
  
  .btn-primary {
    @apply bg-primary-500 text-dark-900 hover:bg-primary-400;
  }
  
  .btn-success {
    @apply bg-accent-green text-white hover:bg-green-600;
  }
  
  .btn-danger {
    @apply bg-accent-red text-white hover:bg-red-600;
  }
  
  .card {
    @apply bg-dark-800 border border-dark-700 rounded-xl p-gr-lg;
  }
  
  .input {
    @apply w-full bg-dark-900 border border-dark-700 rounded-lg px-gr-md py-gr-sm 
           text-dark-50 placeholder-dark-400 focus:border-primary-500 focus:outline-none;
  }
  
  .label {
    @apply block text-dark-300 text-sm font-medium mb-gr-xs;
  }
}
```

---

## 📁 Step 3: Project Structure

```
nepse-trading-vite/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── session/
│   │   │   ├── SessionManager.tsx
│   │   │   └── HeaderParser.tsx
│   │   ├── stocks/
│   │   │   ├── StockSearch.tsx
│   │   │   └── StockList.tsx
│   │   ├── orders/
│   │   │   ├── LivePriceMonitor.tsx
│   │   │   ├── SimpleOrder.tsx
│   │   │   ├── SplitOrder.tsx
│   │   │   └── IPOSniper.tsx
│   │   ├── monitoring/
│   │   │   ├── PriceMonitor.tsx
│   │   │   └── TriggerManager.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Alert.tsx
│   ├── services/
│   │   ├── tmsApi.ts
│   │   ├── sessionService.ts
│   │   ├── orderService.ts
│   │   └── priceService.ts
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useLivePrice.ts
│   │   └── useOrders.ts
│   ├── store/
│   │   ├── sessionStore.ts
│   │   ├── stocksStore.ts
│   │   └── ordersStore.ts
│   ├── types/
│   │   ├── session.ts
│   │   ├── stock.ts
│   │   └── order.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🔧 Step 4: Core Service (TMS API Client)

**src/services/tmsApi.ts:**
```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const TMS_BASE_URL = 'https://tms56.nepsetms.com.np';

class TMSApiClient {
  private client: AxiosInstance;
  private sessionData: {
    xsrfToken?: string;
    aid?: string;
    rid?: string;
    sessionId?: string;
    memberCode?: string;
    requestOwner?: string;
  } = {};

  constructor() {
    this.client = axios.create({
      baseURL: TMS_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use((config) => {
      if (this.sessionData.xsrfToken) {
        config.headers['x-xsrf-token'] = this.sessionData.xsrfToken;
      }
      if (this.sessionData.sessionId) {
        config.headers['host-session-id'] = this.sessionData.sessionId;
      }
      if (this.sessionData.memberCode) {
        config.headers['membercode'] = this.sessionData.memberCode;
      }
      if (this.sessionData.requestOwner) {
        config.headers['request-owner'] = this.sessionData.requestOwner;
      }

      // Add cookies
      const cookies = [];
      if (this.sessionData.xsrfToken) cookies.push(`XSRF-TOKEN=${this.sessionData.xsrfToken}`);
      if (this.sessionData.aid) cookies.push(`_aid=${this.sessionData.aid}`);
      if (this.sessionData.rid) cookies.push(`_rid=${this.sessionData.rid}`);
      if (cookies.length) {
        config.headers['Cookie'] = cookies.join('; ');
      }

      return config;
    });

    // Response interceptor for auto-refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && 
            error.response?.data?.message === 'ACCESS_TOKEN_EXPIRED') {
          // Auto-refresh and retry
          await this.refreshSession();
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  updateSession(sessionData: any) {
    // Parse cookies from cookie string
    if (sessionData.cookie) {
      const cookies = sessionData.cookie.split(';').map((c: string) => c.trim());
      cookies.forEach((cookie: string) => {
        const [name, value] = cookie.split('=');
        if (name === 'XSRF-TOKEN') this.sessionData.xsrfToken = value;
        if (name === '_aid') this.sessionData.aid = value;
        if (name === '_rid') this.sessionData.rid = value;
      });
    }

    // Set headers
    this.sessionData.xsrfToken = sessionData['x-xsrf-token'] || this.sessionData.xsrfToken;
    this.sessionData.sessionId = sessionData['host-session-id'];
    this.sessionData.memberCode = sessionData['membercode'];
    this.sessionData.requestOwner = sessionData['request-owner'];
  }

  async refreshSession() {
    const response = await this.client.post('/tmsapi/authApi/authenticate/refresh', {});
    // Update session from response headers
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      // Parse and update cookies
      setCookie.forEach((cookie: string) => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name === 'XSRF-TOKEN') this.sessionData.xsrfToken = value;
        if (name === '_aid') this.sessionData.aid = value;
        if (name === '_rid') this.sessionData.rid = value;
      });
    }
    return response.data;
  }

  // Stock APIs
  async getLivePrice(symbol: string, stockId: number) {
    const response = await this.client.get(`/tmsapi/rtApi/ws/stockQuote/${stockId}`);
    return response.data;
  }

  async getOHLC(stockId: number, isin: string) {
    const response = await this.client.get(`/tmsapi/rtApi/stock/validation/ohlc/${stockId}/${isin}`);
    return response.data;
  }

  async getSTP(isin: string, code: string = 'LTPCF') {
    const response = await this.client.get(`/tmsapi/orderApi/stock/validation/stp/${isin}/${code}`);
    return response.data;
  }

  // Order APIs
  async placeOrder(orderPayload: any) {
    const response = await this.client.post('/tmsapi/orderApi/order/', orderPayload);
    return response.data;
  }

  // Client API
  async getClientInfo(ucc: string) {
    const response = await this.client.get(
      `/tmsapi/masterclients/clientsSearchInfo?ucc=${ucc}&contactPerson=null&memberCode=PG&clientOrDealer=C&`
    );
    return response.data;
  }

  getSessionStatus() {
    return {
      hasAuth: !!(this.sessionData.xsrfToken && this.sessionData.aid && this.sessionData.rid),
      ...this.sessionData,
    };
  }
}

export const tmsApi = new TMSApiClient();
export default tmsApi;
```

---

## 🎯 Step 5: State Management (Zustand)

**src/store/sessionStore.ts:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import tmsApi from '../services/tmsApi';

interface SessionState {
  isAuthenticated: boolean;
  sessionData: any;
  updateHeaders: (headers: any) => void;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      sessionData: null,

      updateHeaders: (headers: any) => {
        tmsApi.updateSession(headers);
        set({ 
          isAuthenticated: true, 
          sessionData: tmsApi.getSessionStatus() 
        });
      },

      refreshSession: async () => {
        await tmsApi.refreshSession();
        set({ sessionData: tmsApi.getSessionStatus() });
      },

      clearSession: () => {
        set({ isAuthenticated: false, sessionData: null });
      },
    }),
    {
      name: 'nepse-session-storage',
    }
  )
);
```

---

## 🎨 Step 6: Main App Component

**src/App.tsx:**
```typescript
import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { SessionManager } from './components/session/SessionManager';
import { LivePriceMonitor } from './components/orders/LivePriceMonitor';
import { SimpleOrder } from './components/orders/SimpleOrder';
import { IPOSniper } from './components/orders/IPOSniper';
import { useSessionStore } from './store/sessionStore';

function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const { isAuthenticated } = useSessionStore();

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'session' && <SessionManager />}
      
      {activeTab === 'orders' && (
        <div className="space-y-gr-lg">
          <LivePriceMonitor />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gr-lg">
            <SimpleOrder />
            <IPOSniper />
          </div>
        </div>
      )}
      
      {/* Add other tabs */}
    </Layout>
  );
}

export default App;
```

---

## 🚀 Step 7: Run the App

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🎯 Key Benefits of Vite Migration

### ✅ Performance
- **Instant Server Start**: No Express overhead
- **Lightning Fast HMR**: Sub-50ms updates
- **Optimized Build**: Tree-shaking, code-splitting
- **Direct API Calls**: No proxy overhead

### ✅ Modern Stack
- **React 18**: Latest features
- **TypeScript**: Type safety
- **Vite**: Next-gen tooling
- **Tailwind CSS**: Utility-first styling

### ✅ Developer Experience
- **Hot Module Replacement**: Instant feedback
- **ESM Native**: Modern JavaScript
- **Built-in TypeScript**: No config needed
- **Auto Imports**: Less boilerplate

### ✅ Production Ready
- **Optimized Bundle**: < 200KB gzipped
- **Code Splitting**: Load only what's needed
- **Asset Optimization**: Images, fonts, etc.
- **PWA Ready**: Easy to add offline support

---

## 📋 Migration Checklist

- [ ] Create new Vite project
- [ ] Install dependencies (Tailwind, Zustand, React Query)
- [ ] Configure Tailwind with golden ratio palette
- [ ] Create TMS API client service
- [ ] Set up Zustand stores (session, stocks, orders)
- [ ] Build UI components with Tailwind
- [ ] Implement session management
- [ ] Add live price monitoring
- [ ] Create order placement forms
- [ ] Build IPO Sniper feature
- [ ] Add split orders (separate from IPO Sniper)
- [ ] Implement price triggers
- [ ] Test all features
- [ ] Deploy to production

---

## 🎨 Color Palette Preview

### Primary (Golden)
- `primary-500`: #D4AF37 (Main golden)
- `primary-600`: #B8942F (Hover)
- `primary-700`: #9C7A27 (Active)

### Dark Background
- `dark-900`: #0A0A0A (Main bg)
- `dark-800`: #212121 (Cards)
- `dark-700`: #303030 (Borders)

### Accents
- `accent-green`: #3FB950 (Buy/Success)
- `accent-red`: #F85149 (Sell/Error)
- `accent-blue`: #58A6FF (Info)

---

## 📦 Next Steps

1. **Copy this guide** to your new Vite project
2. **Follow steps 1-7** to set up the project
3. **Migrate components** from Express app one by one
4. **Test thoroughly** with real TMS API
5. **Deploy** to Vercel/Netlify for free hosting!

---

**Ready to build a lightning-fast NEPSE Trading Assistant! ⚡**

*No backend needed - Direct browser-to-TMS API communication*
