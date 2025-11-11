# LifeOS Development Roadmap

A comprehensive dashboard for managing daily life - integrating transport, calendar, finance, smart home, and more.

## 🎯 Current Status

### ✅ Implemented Features
- **Bus Tracking** - Real-time Stagecoach bus arrivals with fallback data
- **Bus Map** - Interactive map showing bus routes and locations
- **7-Day Calendar** - Week view with Google Calendar integration and office day indicators
- **Weather** - Multi-city weather display
- **Garmin Fitness** - Activity tracking and health metrics
- **Spotify** - Currently playing track with controls
- **Finance (Monzo)** - Account balance and spending insights
- **Smart Home** - Room-by-room control and monitoring
- **Plants** - Watering schedule tracker with image gallery
- **Email** - Recent Gmail inbox preview
- **Transport Locations** - Live bus position tracking
- **Car Management** - Vehicle info, MOT, tax, mileage tracking

### 🚀 Quick Wins (1-2 days each)

#### 1. Enhanced Calendar Features
**Status:** ✅ Completed
- [x] 7-day view instead of single day
- [x] Visual indicators for office days (Tuesday/Thursday)
- [ ] Color coding by event type
- [ ] Quick add event functionality

#### 2. GitHub Integration
**Status:** In Progress
- [x] Development roadmap documentation
- [ ] Repository activity widget
- [ ] Contribution graph display
- [ ] Issue tracker integration

### 🏋️ Medium Complexity (1-2 weeks each)

#### 3. Gym Tracker
**Status:** Planned
- [ ] Leverage existing Garmin API integration
- [ ] Weekly workout summary
- [ ] Exercise type breakdown
- [ ] Progress tracking (strength, cardio, flexibility)
- [ ] Goal setting and achievement badges
- [ ] Integration with calendar for scheduling

**Implementation Notes:**
- Use Garmin API endpoints: `/api/garmin/activities`, `/api/garmin/stats`
- Create new widget: `GymWidget.tsx`
- Filter Garmin activities by type (strength_training, cardio, cycling, etc.)
- Store personal records in database

#### 4. Irish Rail (DART) Tracker
**Status:** Planned
- [ ] Real-time DART arrival times
- [ ] Similar widget design to bus tracker
- [ ] Route visualization on map
- [ ] Station favorites configuration
- [ ] Service disruption alerts

**Implementation Notes:**
- API: [Irish Rail Realtime API](http://api.irishrail.ie/realtime/)
- Create backend router: `backend/routers/irishrail.py`
- Create frontend widget: `frontend/components/widgets/DartWidget.tsx`
- Add station configuration to user settings
- Reuse map architecture from BusMapWidget

**API Endpoints:**
```python
GET /api/dart/stations          # Get all DART stations
GET /api/dart/arrivals          # Get arrivals for configured stations
GET /api/dart/station/{code}    # Get specific station details
```

### 🔧 Complex Features (2-4 weeks each)

#### 5. Notion Integration
**Status:** Planned
- [ ] OAuth authentication setup
- [ ] Recent notes widget
- [ ] Quick capture functionality
- [ ] Database integration (tasks, projects)
- [ ] Search across workspace

**Implementation Notes:**
- Notion API: https://developers.notion.com/
- OAuth flow similar to Google integration
- Store tokens in `backend/notion_tokens.json`
- Create `backend/routers/notion.py`
- Widget: `frontend/components/widgets/NotionWidget.tsx`

**Required Environment Variables:**
```
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_REDIRECT_URI=http://localhost:8000/api/notion/callback
```

#### 6. Messenger & Instagram Messages
**Status:** Research Phase
- [ ] Investigate Meta API limitations
- [ ] OAuth setup for Instagram/Messenger
- [ ] Unread message count
- [ ] Recent conversations preview
- [ ] Quick reply functionality (if API permits)

**Challenges:**
- Meta APIs have strict approval requirements
- Limited message access without business accounts
- May need to use Instagram Graph API + Messenger Platform
- Privacy and security considerations

**Alternative Approaches:**
- Notification-only integration
- Web scraping (not recommended, against TOS)
- IFTTT/Zapier webhook integration

### 🎨 UI/UX Enhancements

#### Planned Improvements
- [ ] Widget customization (drag & drop reordering)
- [ ] Theme switcher (dark/light/custom)
- [ ] Mobile responsive design
- [ ] Widget visibility toggles persistence
- [ ] Keyboard shortcuts
- [ ] Notification system for important events

### 🔐 Infrastructure & DevOps

#### Security
- [ ] Environment variable management (.env file)
- [ ] Secret rotation for API keys
- [ ] Rate limiting on API endpoints
- [ ] Input validation and sanitization

#### Performance
- [ ] Caching strategy for expensive API calls
- [ ] Database query optimization
- [ ] Frontend bundle size reduction
- [ ] Progressive web app (PWA) support

#### Monitoring
- [ ] Error tracking (Sentry integration)
- [ ] Analytics (privacy-respecting)
- [ ] API health dashboard
- [ ] Uptime monitoring

### 📱 Future Ideas (Backlog)

- **Habit Tracker** - Daily habits with streak tracking
- **Meal Planning** - Recipe integration, grocery lists
- **Book/Movie Tracker** - Currently reading/watching
- **News Aggregator** - Personalized news feed
- **Cryptocurrency Tracker** - Portfolio value and trends
- **YouTube Subscriptions** - Latest videos from followed channels
- **Reddit Integration** - Saved posts, favorite subreddits
- **Strava Integration** - Running/cycling activities
- **Steam Gaming** - Recently played, achievements
- **Discord Integration** - Server activity, DMs
- **Sleep Tracking** - Integration with Garmin/Fitbit
- **Medication Reminders** - Daily medication schedule
- **Pet Care Tracker** - Feeding, vet appointments
- **Language Learning** - Duolingo streak, progress

## 🛠️ Technical Stack

### Frontend
- **Framework:** Next.js 15 (React 19)
- **Styling:** Tailwind CSS
- **TypeScript:** Strict mode enabled
- **State Management:** React hooks (useState, useEffect)
- **API Calls:** Native fetch API
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Authentication:** OAuth 2.0 (Google, Spotify, Monzo)
- **HTTP Client:** httpx (async)

### APIs & Services
- **Transport:** Transport API (UK buses)
- **Weather:** OpenWeather API
- **Calendar/Email:** Google APIs
- **Music:** Spotify Web API
- **Finance:** Monzo API
- **Fitness:** Garmin Connect API
- **Smart Home:** Home Assistant
- **Car Data:** DVLA API

## 📚 Documentation

### Setup Guides
- [Bus/Transport API Setup](./DVLA_SETUP.md)
- [Cloudflare Tunnel Setup](./CLOUDFLARE_SETUP.md)
- [Monzo Integration](./MONZO_SETUP.md)
- [Spotify Integration](./SPOTIFY_SETUP.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Remote Access](./REMOTE_ACCESS_SUMMARY.md)
- [Scripts Documentation](./SCRIPTS_README.md)

### Contributing
1. Pick a feature from this roadmap
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Follow existing code patterns and naming conventions
4. Test locally with `.\start.ps1` (Windows) or `./start.sh` (Unix)
5. Update documentation if adding new features
6. Submit pull request with clear description

## 📈 Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| 7-Day Calendar | High | Low | ✅ Done |
| Gym Tracker | High | Medium | 🔥 Next |
| DART Tracker | Medium | Medium | 🔥 Next |
| Notion Integration | High | High | ⏳ Later |
| Messenger/Instagram | Medium | High | ⏳ Later |
| Widget Customization | Medium | Medium | ⏳ Later |

## 🐛 Known Issues

- Transport API rate limiting causing fallback to cached data
- Bus map initialization timing issues (investigating)
- Finance widget chart sizing warnings (cosmetic)
- Calendar widget needs better mobile responsiveness

## 📝 Changelog

### v0.2.0 (Current)
- Added 7-day calendar view with office day indicators
- Created development roadmap
- Improved API detection architecture (no more Cloudflare errors)
- Refactored PlantWidget and AddPlantModal to use centralized API

### v0.1.0 (Initial)
- Core dashboard functionality
- Bus tracking with live data
- Google Calendar and Gmail integration
- Spotify, Garmin, Monzo, Weather widgets
- Smart home controls
- Plant watering tracker
- Car management

---

**Last Updated:** November 9, 2025  
**Maintainer:** @cormacmadden  
**Status:** Active Development 🚀
