# OpenClaw CRM Integration API

API endpoints for OpenClaw AI assistant to interact with ClawCRM.

## Endpoints

### GET `/api/openclaw/query?q=...`

Natural language query endpoint. Detects intent and returns structured results.

**Supported queries:**
| Query pattern | Intent | Example |
|---|---|---|
| "when did I last talk to X?" | `person_lookup` | "when did I last talk to Niklas?" |
| "who works at X?" | `company_search` | "who works at Google?" |
| "meetings about X" | `topic_search` | "meetings about AI this month" |
| "how many people/meetings?" | `stats` | "how many people do I know?" |
| "recent meetings" | `recent_meetings` | "latest meetings" |

**Response:**
```json
{ "intent": "person_lookup", "answer": "Last interaction with Niklas: 2025-01-15...", "data": { "person": {...}, "lastMeeting": {...} } }
```

### POST `/api/openclaw/log`

Quick meeting logging with automatic person matching.

**Body:**
```json
{ "text": "Had coffee with Niklas, discussed the new project", "date": "2025-01-20" }
```

**Response:**
```json
{ "success": true, "meeting": {...}, "people": [{ "id": 1, "name": "Niklas", "isNew": false }], "extraction": { "names": ["Niklas"], "summary": "...", "topics": ["project"] } }
```

### GET `/api/openclaw/people?q=...&limit=10`

Enhanced people search with relationship stats.

**Response:**
```json
{ "results": [{ "id": 1, "name": "Niklas", "company": "...", "meetingCount": 5, "lastMeetingDate": "2025-01-15", "relationshipStrength": 3.5 }], "total": 1 }
```
