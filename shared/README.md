# Shared Utilities

This directory contains shared code that can be used by both frontend and backend.

## Building Class Lookup

The `building-class-lookup.ts` file provides a canonical mapping of NYC building class codes to their human-readable descriptions.

### Structure

- **Single source of truth**: All building class codes and descriptions are defined in one place
- **Type-safe**: TypeScript interfaces ensure type safety
- **Extensible**: Easy to add new codes, categories, or metadata

### Usage

#### Frontend (TypeScript)

```typescript
import { getBuildingClassDescriptionText } from "@/lib/building-class";

// In your component
const description = getBuildingClassDescriptionText("C7");
// Returns: "Walk-up Apartments - Over Six Families with Offices and Commercial"
```

#### Backend (JavaScript)

```javascript
const { getBuildingClassDescriptionText } = require("../lib/building-class");

// In your route/service
const description = getBuildingClassDescriptionText("C7");
// Returns: "Walk-up Apartments - Over Six Families with Offices and Commercial"
```

### Database Strategy

- **Store only codes**: Database columns should store the raw code (e.g., "C7")
- **Transform on read**: Use the lookup when displaying or generating reports
- **No duplication**: Descriptions live only in this file

### Adding New Codes

1. Open `shared/building-class-lookup.ts`
2. Add your code to the `BUILDING_CLASS_LOOKUP` object:

```typescript
YOUR_CODE: {
  code: "YOUR_CODE",
  description: "Your Description Here",
  category: "Optional Category",
},
```

3. Both frontend and backend will automatically have access to it

### Future Enhancements

- Localization support (add `descriptionEn`, `descriptionEs`, etc.)
- Override system (allow custom descriptions per organization)
- Versioning (track when codes were added/changed)
- Validation (ensure all codes from data sources are mapped)

