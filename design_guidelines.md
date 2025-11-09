# Design Guidelines: Mobile Auction Platform

## Design Approach

**Reference-Based**: Drawing inspiration from eBay's auction mechanics, Instagram's visual feed patterns, and Shopify's product showcasing. Mobile-first design with touch-optimized interactions.

## Core Design Principles

1. **Visual Priority**: Product images dominate - high-quality, large previews
2. **Urgency Indicators**: Clear countdown timers and bid status messaging
3. **Frictionless Actions**: One-tap bidding, quick access to favorites
4. **Scan-Friendly**: Information hierarchy optimized for quick browsing

## Typography

**Font Stack**: Inter (primary) + DM Sans (headings)
- Headings: 24px-32px, semi-bold to bold
- Body: 16px, regular
- Captions/Metadata: 14px, medium
- Prices/Bids: 20px-24px, bold (numeric emphasis)
- Countdown Timers: 16px, mono-spaced font for clarity

## Layout System

**Spacing**: Tailwind units of 3, 4, 6, 8, 12
- Card padding: p-4
- Section spacing: py-8 to py-12
- Element gaps: gap-4, gap-6
- Screen margins: px-4

**Grid Strategy**:
- Mobile: Single column (grid-cols-1)
- Tablet: 2 columns for auction cards (md:grid-cols-2)
- Never more than 2 columns on mobile devices

## Component Library

### Navigation
**Bottom Tab Bar** (fixed):
- 4 primary tabs: Browse, Search, Sell, Profile
- Active state with icon emphasis
- Safe area padding for modern phones

**Top Bar** (sticky):
- Logo/branding left
- Notifications bell right
- Filter/sort button right
- Transparent background with backdrop blur when scrolling

### Auction Cards
**Compact Card** (feed view):
- Square product image (1:1 ratio) taking 40% width
- Horizontal layout with image left, details right
- Title (2 lines max, truncated)
- Current bid (prominent, bold)
- Time remaining badge (pill shape)
- Quick bid button (small, inline)

**Expanded Card** (detail view):
- Full-width image carousel with dots indicator
- Swipe gestures for multiple images
- Seller info chip below images
- Bid history expandable accordion
- Large "Place Bid" CTA button (full-width, sticky bottom)

### Bidding Interface
**Bid Input**:
- Large numeric keypad (native mobile input)
- Minimum increment suggestion chips
- Quick bid buttons (+$5, +$10, +$25)
- Real-time validation feedback
- Confirmation modal with bid summary

**Countdown Timer**:
- Always visible on cards
- Color-coded urgency (no specific colors, just hierarchy):
  - Standard weight for >1 day
  - Medium weight for <24 hours  
  - Bold weight for <1 hour
- Pulsing animation for final minutes

### Forms (Create Listing)
**Multi-step Flow**:
- Step indicator (progress dots)
- Photo upload: Large tap zones, 4:3 ratio grid
- Title/Description: Auto-growing text areas
- Starting bid: Numeric input with currency prefix
- Duration: Segmented control (1/3/7/14 days)
- Category: Searchable dropdown with icons

### Search & Filters
**Search Bar**:
- Full-width with rounded corners
- Icon left, clear button right
- Recent searches below (dismissible chips)

**Filter Sheet** (bottom sheet modal):
- Category checkboxes with icons
- Price range slider
- Time remaining segments
- Sort options (radio buttons)
- Apply button (sticky bottom)

### Status Indicators
- **Active Bid**: Checkmark icon + "You're winning"
- **Outbid**: Alert icon + "Outbid by $X"
- **Won**: Trophy icon + "You won!"
- **Ending Soon**: Clock icon + red accent

## Images

### Hero Section
**Home Screen Hero**: Full-width banner showcasing featured auction
- Aspect ratio: 16:9
- Overlay gradient for text readability
- CTA buttons with backdrop blur background
- Image: High-quality product on contextual background

### Product Images
- **Card Thumbnails**: Square, 1:1 ratio, minimum 400x400px
- **Detail Gallery**: 4:3 ratio, swipeable, 800x600px minimum
- **Empty States**: Illustrated icons (not photos)

**Image Placement**:
- Home: Featured auction hero at top
- Browse: Thumbnail in every auction card
- Detail: Full gallery (3-10 images per listing)
- Profile: User avatar (circular, 80x80px)
- Create Listing: Upload preview grid

## Animations

**Minimal Motion**:
- Countdown pulse (final 60 seconds only)
- Pull-to-refresh indicator
- Bid success confetti (one-time, brief)
- Card swipe feedback

## Mobile Optimizations

**Touch Targets**: Minimum 44x44px
**Swipe Gestures**: 
- Horizontal: Image gallery navigation
- Pull down: Refresh auction feed
- Swipe card left: Quick favorite toggle

**Sticky Elements**:
- Bottom navigation (always visible)
- Bid button on detail view (sticky bottom)
- Top filters bar (sticky on scroll)

**Safe Areas**: Respect notches and home indicators with proper padding

## Accessibility

- Minimum contrast ratios for bid amounts and timers
- Clear focus states for all interactive elements
- Screen reader labels for countdown timers and bid status
- Touch target sizes meet WCAG guidelines