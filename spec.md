# AI-Marketer Platform OS V3.5 - Project Specification

## 1. Project Overview
AI-Marketer Platform OS V3.5 is a comprehensive, high-performance marketing orchestration platform designed to streamline the lifecycle of digital advertising through AI-driven research, creative generation, and budget optimization. It provides specific interfaces and workflows for three distinct executive roles: Marketing Experts, Platform Admins, and CMOs.

## 2. Technology Stack
### 2.1 Frontend
- **Framework**: Vite (Vanilla Javascript)
- **Styling**: Tailwind CSS (using `@tailwindcss/vite` plugin)
- **Design Pattern**: Single Page Application (SPA) with custom state-driven rendering logic
- **Aesthetics**: Premium Dark Theme with neon accents, micro-animations, and glassmorphism

### 2.2 Backend
- **Framework**: ASP.NET Core 9.0 (Minimal APIs)
- **Language**: C#
- **Communication**: RESTful API with CORS enabled for frontend integration
- **Persistence**: Local JSON-based file storage (`brand_guidelines.json`)

## 3. Core Architecture
### 3.1 State Management
The application maintains a centralized `state` object in the frontend that stores:
- Active roll and screen context
- Marketing campaign data (objectives, targeting, strategies)
- Brand guidelines (DNA, palette, whitelist/blacklist)
- Budgeting parameters

### 3.2 Role System
- **Marketing Expert**: Specialized in campaign execution. Key screens: Objective, Targeting, Strategy Hub, Creative Studio, AI Monitoring.
- **Platform Admin**: Manages the brand core. Key screens: Platform Config, Global Calendar, Brand Guidelines (the platform's DNA), Creative Assets Library.
- **CMO Dashboard**: Strategic oversight. Key screens: Budget Matrix (Allocation vs Expectations), Ad Approvals, Alert Center.

## 4. Design System
### 4.1 Color Palette
- **Background**: `#0B0E14` (Deep Night)
- **Surface**: `#151921` (Card/Dashboard elements)
- **Accents**: 
  - Primary: Cyan (`#00f3ff`)
  - Secondary: Purple (`#bf00ff`)
  - Functional: Indigo (Buttons/Links), Emerald (Positive/Whitelist), Rose (Negative/Blacklist)

### 4.2 UI Philosophy
- **High Density**: Compact containers and scaled-down typography for massive information visibility.
- **Interactivity**: Dynamic sliders with real-time value labels and instant calculated feedback (e.g., Matrix Weight monitoring).
- **Premium Feel**: Backdrop blurs (`glass`), custom scrollbars, and heavy font weights for an OS-like experience.

## 5. Key Features & Workflows
### 5.1 AI Research & Probing
A multi-step strategy workflow that researches the brand's position and asks probing questions to refine marketing outputs.

### 5.2 Creative AI Studio
An asset generation engine where users configure ratios, quantities (Photos/Videos/Posts), and review AI-generated visual content.

### 5.3 Budget Matrix & Expectation Monitoring
A CMO tool utilizing dynamic range sliders to reallocate winning ad budgets and set performance expectations (Reach/Click/Sales). Includes a real-time weight validator (Total % color coding).

### 5.4 Brand DNA Persistence
A robust system for saving and loading Brand Guidelines via the backend API. Data is saved as a JSON file and automatically restored on application initialization.

## 6. API Reference
- `GET /api/guidelines`: Fetches persisted brand guidelines from server storage.
- `POST /api/guidelines`: Overwrites the server-side JSON file with new brand configurations.
- `GET /weatherforecast`: Sample performance/data endpoint.

## 7. Development & Deployment
- **Port Mapping**:
  - Frontend: `5173` (Vite Default)
  - Backend: `5243` (HTTP) / `7110` (HTTPS)
- **Initialization Sequence**: The app runs `initApp()` on load, fetching server-side configuration before rendering the default role interface.
