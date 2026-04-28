# HSBC Mobile Banking App - PRD

## Overview
A mobile banking app styled like HSBC with JWT authentication, account management, transfers, bill payments, and card management.

## Features

### 1. Authentication
- JWT-based email/password login
- Registration with auto-provisioned accounts and cards
- Secure password hashing with bcrypt

### 2. Account Overview (Home/Dashboard)
- Total relationship balance display
- Individual account cards (Current + Savings)
- Recent transactions list
- Monthly spending summary
- Quick action buttons (Transfer, Pay Bills, QR Pay, Cards)

### 3. Money Transfers (Pay & Transfer)
- Transfer between accounts
- **Recent Payees Quick-Select**: Horizontal scrollable chips showing previous transfer recipients
  - Auto-fills name, sort code, and account number on tap
  - Displays avatar initials and masked account numbers
  - Sorted by most recently used
  - Deduplicates payees (updates existing on repeat transfers)
- Recipient name, sort code, and account number fields
- **Sort Code Bank Lookup**: Real-time bank name display based on sort code
  - Auto-formats sort code as XX-XX-XX
  - Shows bank name (green) for recognized codes
  - Shows "Not recognized" (orange) for unknown codes
  - Supports: HSBC, Barclays, Lloyds, NatWest, Santander, Nationwide, Monzo, Starling, Revolut, and more
- **Sort Code Validation**: Blocks transfer submission if sort code is:
  - Empty → "Sort code is required"
  - Incomplete (<6 digits) → "Sort code must be 6 digits (XX-XX-XX)"
  - Unrecognized → "Sort code not recognized. Please check and try again."
- Amount input with available balance display
- Optional reference/description field

### 4. Bill Payments (Services)
- Service grid (Pay Bills, Mobile Top-up, Credit Card, Loan, etc.)
- Registered billers list (8 predefined billers)
- Payment modal with amount input
- Billers: Electric, Water, Internet, Mobile, Insurance, Gas, Cable TV, Credit Card

### 5. Card Management
- Horizontal card carousel with HSBC-branded physical card design
- Card freeze/unfreeze functionality
- Credit limit and available credit display with progress bar
- Card actions: Freeze, View PIN, Settings, ATM Locator, Alerts, Report Lost

### 6. Profile (More)
- User info card with avatar
- Quick actions (QR Code, Statements, Settings)
- Account & Settings, Help & Support, Legal sections
- Logout functionality

## Design System
- **Primary Color**: #DB0011 (HSBC Red)
- **Background**: #F5F5F5
- **Cards**: #FFFFFF with rounded corners
- **Typography**: System font, weights 500-700
- **HSBC logo**: Red/white grid pattern throughout

## Tech Stack
- **Frontend**: Expo + React Native, expo-router
- **Backend**: FastAPI, MongoDB
- **Auth**: JWT with bcrypt password hashing
- **State**: React Context + AsyncStorage

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/accounts
- GET /api/transactions
- POST /api/transfers
- GET /api/billers
- POST /api/bills/pay
- GET /api/cards
- POST /api/cards/{id}/freeze
- POST /api/cards/{id}/unfreeze
- GET /api/dashboard/stats
- GET /api/payees (list recent)
- POST /api/payees (create)
- PUT /api/payees/{id} (update)
- DELETE /api/payees/{id} (delete)
- GET /api/analytics/spending
- POST /api/chat (AI chat)
- GET /api/chat/history
