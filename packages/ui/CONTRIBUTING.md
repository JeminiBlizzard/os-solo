# Contributing to @os-solo/ui

## Design System Guidelines

### Color Usage

**Purple tokens are reserved for AI-related UI elements only.**

The `ai` color palette (`bg-ai`, `text-ai`, `bg-ai-subtle`, `bg-ai-strong`, etc.) is strictly reserved for AI-related UI elements such as:
- AI agent status indicators
- AI-generated content markers
- AI task execution interfaces
- AI configuration panels

**Do not use purple tokens for:**
- General UI accents
- Primary buttons (use `brand` instead)
- Status indicators unrelated to AI
- Decorative elements

This restriction ensures users can instantly identify AI-related functionality throughout the application.

### Color Palette

- **Gray scale** (`gray-10` through `gray-100`): Carbon-aligned neutral colors for backgrounds, text, and borders
- **Brand** (`brand`): Carbon blue (#0f62fe) for primary actions and branding
- **AI** (`ai`, `ai-subtle`, `ai-strong`): Purple palette reserved for AI elements only
- **Semantic**: `success`, `warning`, `danger`, `info` for feedback states

### Typography

- **Sans**: IBM Plex Sans (default)
- **Mono**: IBM Plex Mono (for code and monospace content)

### Design Principles

- **Sharp corners**: Carbon design system uses sharp corners by default (`border-radius: 0`)
- **Consistent spacing**: Use Tailwind's spacing scale
- **Accessibility**: Maintain WCAG AA contrast ratios
