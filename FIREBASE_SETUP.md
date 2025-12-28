# Firebase Setup Guide

## Quick Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" and follow the wizard

2. **Enable Authentication**
   - In your project, go to **Authentication** → **Get Started**
   - Enable **Email/Password** provider
   - Enable **Google** provider (optional but recommended)

3. **Create Firestore Database**
   - Go to **Firestore Database** → **Create database**
   - Start in **test mode** for development
   - Choose your preferred region

4. **Get Your Config**
   - Go to **Project Settings** (gear icon) → **General**
   - Scroll to "Your apps" and click the web icon (`</>`)
   - Register your app and copy the config values

5. **Create `.env.local`**
   Create a file called `.env.local` in the project root with:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

6. **Restart the dev server**
   ```bash
   npm run dev
   ```

## Required Firestore Indexes

The app uses composite queries that require indexes. Create them using **either** method:

### Option 1: Web Console (easiest)
Click this link to auto-create the index:
[Create Index in Firebase Console](https://console.firebase.google.com/v1/r/project/sovereign-finance/firestore/indexes?create_composite=ClZwcm9qZWN0cy9zb3ZlcmVpZ24tZmluYW5jZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvdHJhbnNhY3Rpb25zL2luZGV4ZXMvXxABGggKBHR5cGUQARoICgRkYXRlEAEaDAoIX19uYW1lX18QAQ)

### Option 2: gcloud CLI
If you have the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed:

```bash
gcloud firestore indexes composite create \
  --collection-group=transactions \
  --field-config=field-path=type,order=ascending \
  --field-config=field-path=date,order=ascending \
  --field-config=field-path=__name__,order=ascending \
  --database="(default)"
```

> **Note**: Indexes may take a few minutes to build. The app will show errors until they're ready.
> You can monitor progress in the [Google Cloud Console](https://console.cloud.google.com/firestore/databases/-default-/indexes) under Databases → Indexes.

### Index 2: Recurring by Type + Active (for recurring items)

**ID de la colección**: `recurring`

**Campos que se indexarán**:
| # | Ruta del campo | Orden |
|---|----------------|-------|
| 1 | `isActive` | Ascendente |
| 2 | `type` | Ascendente |
| 3 | `name` | Ascendente |

**Permisos de las consultas**: `Colección`

## Groq API (Optional - for AI features)

1. Go to [Groq Console](https://console.groq.com/)
2. Create an API key
3. Add to `.env.local`:
   ```
   GROQ_API_KEY=gsk_...
   ```
