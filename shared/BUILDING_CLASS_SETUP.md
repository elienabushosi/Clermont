# Building Class Lookup Setup Guide

## Overview

This system provides a single source of truth for NYC building class code to description mappings, usable by both frontend and backend.

## Architecture

```
shared/
  ├── building-class-lookup.ts    # TypeScript source (for frontend)
  ├── building-class-lookup.json # JSON version (for backend)
  └── README.md                   # Usage documentation

frontend/lib/
  └── building-class.ts           # Frontend wrapper/utilities

backend/lib/
  └── building-class.js           # Backend utilities
```

## Current Status

✅ Structure created
✅ Frontend integration (viewreport page updated)
✅ Backend utilities created
⚠️ **You need to add your 222-247 building class codes**

## Next Steps

### 1. Add All Building Class Codes

You need to populate `shared/building-class-lookup.ts` with all your codes. The file currently has:
- High-level categories (A-Z)
- A few example specific codes (A1-A9, B1-B3, C1-C9, D1-D9)

**Add your remaining codes** following this pattern:

```typescript
YOUR_CODE: {
  code: "YOUR_CODE",
  description: "Your Full Description Here",
  category: "Category Name", // Optional
},
```

### 2. Sync TypeScript and JSON

After updating the TypeScript file, you'll need to sync it to JSON for the backend. You can:

**Option A: Manual sync** - Copy the object to JSON format
**Option B: Use a script** - Create a build script to generate JSON from TS
**Option C: Use the JSON as source** - Maintain JSON and import it in TS

### 3. Test the Integration

The viewreport page now uses building class descriptions. Test with:
- Codes that exist in the lookup (should show description)
- Codes that don't exist (should show the code itself)

## Usage Examples

### Frontend

```typescript
import { getBuildingClassDescriptionText } from "@/lib/building-class";

// In a component
const description = getBuildingClassDescriptionText("C7");
// Returns: "Walk-up Apartments - Over Six Families with Offices and Commercial"
```

### Backend

```javascript
const { getBuildingClassDescriptionText } = require("../lib/building-class");

// In a route or service
const description = getBuildingClassDescriptionText("C7");
// Returns: "Walk-up Apartments - Over Six Families with Offices and Commercial"
```

## Database Strategy

- ✅ **Store only codes** in database (e.g., `bldgclass: "C7"`)
- ✅ **Transform on read** using the lookup
- ✅ **No duplication** - descriptions live only in shared files

## Future Enhancements

- Add validation to ensure all codes from data sources are mapped
- Create a sync script (TS → JSON)
- Add localization support
- Add versioning/tracking

