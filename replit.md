# Mobile Auction Platform - BidHub

## Overview

BidHub is a mobile-first auction marketplace application inspired by eBay's auction mechanics, Instagram's visual feed patterns, and Shopify's product showcasing. The platform enables users to browse auctions, place bids, manage watchlists, and interact with a real-time bidding system. Built with a modern TypeScript stack, it prioritizes mobile user experience with touch-optimized interactions and visual-first design.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18+ with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast HMR and optimized production builds
- Wouter for lightweight client-side routing

**UI Component Library:**
- Shadcn/ui (New York style variant) with Radix UI primitives for accessible, composable components
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for type-safe component variants

**State Management:**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- React hooks for local component state

**Design System:**
- Mobile-first responsive design with breakpoints at 768px (tablet)
- Custom color system using HSL values with CSS variables for theming
- Typography system using Inter (primary), DM Sans (headings), and monospace for timers
- Consistent spacing scale based on Tailwind units (3, 4, 6, 8, 12)

### Backend Architecture

**Server Framework:**
- Express.js server with TypeScript
- Custom middleware for request logging, JSON parsing, and raw body preservation
- Session-based authentication using express-session

**API Design:**
- RESTful API endpoints under `/api` namespace
- Standardized error handling with HTTP status codes
- JSON request/response format

**Database Layer:**
- Drizzle ORM for type-safe database queries
- Neon serverless PostgreSQL as the database provider
- WebSocket support for real-time database connections
- Database schema migrations managed via Drizzle Kit

**Authentication System:**
- Replit OpenID Connect (OIDC) integration via Passport.js
- Session persistence using PostgreSQL session store (connect-pg-simple)
- Token-based authentication with access and refresh token support
- Cookie-based session management with 7-day TTL

### Data Model

**Core Tables:**
1. **sessions**: Stores user session data for authentication persistence
   - sid (primary key), sess (JSONB), expire (timestamp)
   - Indexed on expire for efficient cleanup

2. **users**: User profile information
   - id (UUID), email, firstName, lastName, profileImageUrl
   - Stripe payment fields: stripeCustomerId, stripePaymentMethodId, paymentMethodLast4, paymentMethodBrand
   - Payment status: paymentStatus (none/active), biddingBlocked, biddingBlockedReason
   - createdAt, updatedAt timestamps
   - Supports upsert operations for seamless user synchronization

3. **pendingCharges**: Tracks auction wins awaiting batch payment processing
   - id (serial), userId, auctionId, amount, status (pending/processing/completed/failed)
   - failureCount for retry logic, processed timestamp

4. **paymentHistory**: Records of completed payment transactions
   - id (serial), userId, amount, stripePaymentIntentId, status, description

**Storage Pattern:**
- Repository pattern with `IStorage` interface for data access abstraction
- `DatabaseStorage` implementation for PostgreSQL operations
- Support for user retrieval and upsert operations

### Payment System

**Stripe Integration:**
- SetupIntent flow for collecting cards without immediate charge
- Off-session charging for batch payment processing
- Payment method attachment with customer default setting

**Batch Payment Processing:**
- Runs at 4 AM EST (9 AM UTC) via admin endpoint
- Protected with x-admin-secret header (default: 'batch-4406-secret')
- Aggregates pending charges per user into single transactions
- Blocks bidding after 3 consecutive payment failures

**Bidding Gate:**
- POST /api/bids requires valid payment method
- Error codes: NO_PAYMENT_METHOD, BIDDING_BLOCKED
- Users redirected to Profile page to add payment method

### Staff Tracking & Analytics

**Staff Management:**
- Staff table with unique 4-digit PIN codes for employee tracking
- Staff shifts with clock in/out tracking
- Daily scan goals with progress tracking
- Items-per-hour performance metrics

**Batch Tracking:**
- Batches for grouping inventory intake
- Auto-assignment of active batch to new scans
- Sell-through rate calculated per batch
- ROI tracking (revenue vs cost per batch)

**Cost Tracking:**
- All items default to $2 cost
- Cost editable via admin (4406 password protected)
- Profit margin calculations

**Analytics Dashboard (/admin):**
- Staff performance: scans today, items/hour, goal progress
- Batch performance: sell-through %, ROI per batch
- Inventory aging: 30/60/90 day unsold reports
- Category performance: sell-through by category
- Financial summary: total revenue, profit, ROI

**Staff PINs (Initial):**
- Employee 1: 1001
- Employee 2: 1002
- Employee 3: 1003

### External Dependencies

**Third-Party Services:**
- **Replit Auth**: OpenID Connect provider for user authentication
  - Issuer URL: `https://replit.com/oidc` (configurable via environment)
  - Client ID: Uses REPL_ID environment variable
  - Handles user claims, token management, and session lifecycle

- **Neon Database**: Serverless PostgreSQL hosting
  - Connection via DATABASE_URL environment variable
  - WebSocket-based connections for serverless environments
  - Automatic connection pooling

**Build & Development Tools:**
- ESBuild for server-side bundling
- PostCSS with Autoprefixer for CSS processing
- TSX for TypeScript execution in development

**Runtime Dependencies:**
- Memoizee for OIDC configuration caching (1-hour TTL)
- date-fns for date manipulation and formatting
- nanoid for unique ID generation
- Zod for runtime type validation with Drizzle schemas

**Asset Management:**
- Static assets served from `/attached_assets` directory
- Generated placeholder images for auction items stored in `attached_assets/generated_images/`
- Vite handles asset optimization and bundling

### Environment Configuration

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption
- `REPL_ID`: Replit application identifier (used as OAuth client ID)
- `ISSUER_URL`: OIDC provider URL (defaults to Replit)
- `NODE_ENV`: Environment mode (development/production)

### Development vs Production

**Development Mode:**
- Vite dev server with HMR enabled
- Replit-specific plugins: cartographer (code navigation), dev banner, runtime error overlay
- Source map support via @jridgewell/trace-mapping
- TypeScript type checking without emit

**Production Mode:**
- Vite builds static assets to `dist/public`
- ESBuild bundles server code to `dist/index.js`
- Static file serving from built assets
- Optimized bundle sizes with tree-shaking