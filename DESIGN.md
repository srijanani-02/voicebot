# Design

## Overview
- Surface: single-screen product UI for a personal voice assistant.
- Theme: deep blue atmospheric backdrop with restrained aqua highlights.
- Tone: minimalist, focused, and conversational.

## Color
- Background: `#0a1120` to `#16233b` gradient
- Primary text: `#ecf2ff`
- Secondary text: `rgba(226, 233, 255, 0.78)`
- Accent gradient: `#6b8cff` to `#36d8b6`
- Error/recording accent: `rgba(248, 101, 125, 0.9)`

## Typography
- Family: Inter, Segoe UI, system sans stack
- Heading style: large compact sans with tight line-height
- Body style: medium-weight UI sans with relaxed reading line-height

## Components
- Main shell: centered glassmorphic card with soft border and blur
- Mode toggle: pill switch with explicit text labels for Audio and Text
- Quick actions: compact rounded buttons with low visual weight
- Chat bubbles: right-aligned user bubble, left-aligned assistant bubble
- Composer: single-line input, microphone button, send button

## Layout
- One centered card, max width around 960px
- Vertical rhythm with moderate spacing between sections
- Mobile-first stacking with wider desktop split for header and composer

## Motion
- Fast 180ms ease-out transitions for button hover and toggle state
- No decorative page choreography
